import React, { useState, useMemo, useEffect } from 'react';
import { Order, OrderItem, MaterialDeduction, Product, StockImportReceipt, Customer, ProductCostMap, BoardCorePriceMap, ArchivedDeletedCustomerRevenue } from '../types';
import { formatCurrency } from '../utils/formatters';
import { isPartnerMode, getDisplayPrice } from '../utils/partnerConfig';
import {
  Calendar, DollarSign, Award, BarChart3, RotateCcw,
  Sparkles, CheckCircle2, Flame, ArrowDown, TrendingUp, Coins,
  Table2, ShieldAlert, Layers, Percent, TrendingDown
} from 'lucide-react';
import { ProductCostAnalyticsTable, computeProductCostLookupMap } from './ProductCostAnalyticsTable';
import {
  subscribeRevenueDeductions,
  saveRevenueDeductionsToFirestore,
  getLocalRevenueDeductions,
  subscribeProductCosts,
  getLocalProductCosts,
  subscribeBoardCorePrices,
  getLocalBoardCorePrices
} from '../services/firestoreService';

interface AnalyticsViewProps {
  orders: Order[];
  products: Product[];
  stockImports?: StockImportReceipt[];
  customers?: Customer[];
  currentUserEmail?: string | null;
  onResetYearData?: (year: number, resetType: 'all' | 'ordersOnly' | 'baselineOnly') => void;
  archivedDeletedRevenues?: ArchivedDeletedCustomerRevenue[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  orders,
  products,
  customers = [],
  currentUserEmail,
  onResetYearData,
  archivedDeletedRevenues = []
}) => {
  // Current real year
  const currentRealYear = new Date().getFullYear();
  const currentRealMonth = new Date().getMonth() + 1;
  const currentRealDayStr = new Date().toISOString().slice(0, 10);

  const [selectedYear, setSelectedYear] = useState<number>(currentRealYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all'); // 1-12 or 'all'
  const [dailyMonth, setDailyMonth] = useState<number>(currentRealMonth);
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'monthly' | 'daily'>('all');
  const [activeMainSection, setActiveMainSection] = useState<'sales' | 'product_cost'>('sales');

  // Khấu trừ doanh thu thủ công theo từng tháng / năm
  const [revenueDeductions, setRevenueDeductions] = useState<Record<string, number>>(() =>
    getLocalRevenueDeductions()
  );

  // Lắng nghe dữ liệu khấu trừ doanh thu thời gian thực từ Cloud Firestore
  useEffect(() => {
    const unsub = subscribeRevenueDeductions((data) => {
      setRevenueDeductions(data);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // Dữ liệu đơn giá vốn định mức sản phẩm từ "Bảng Thống Kê Định Mức Giá Vốn" & "Bảng Giá Cốt Vật Tư"
  const [costMap, setCostMap] = useState<ProductCostMap>(() => getLocalProductCosts());
  const [boardCorePrices, setBoardCorePrices] = useState<BoardCorePriceMap>(() => getLocalBoardCorePrices());

  useEffect(() => {
    const unsubCosts = subscribeProductCosts((data) => setCostMap(data || {}));
    const unsubCore = subscribeBoardCorePrices((data) => setBoardCorePrices(data || {}));
    return () => {
      if (typeof unsubCosts === 'function') unsubCosts();
      if (typeof unsubCore === 'function') unsubCore();
    };
  }, []);

  // Map đơn giá vốn định mức cho tất cả các mã sản phẩm
  const productCostLookup = useMemo(() => {
    return computeProductCostLookupMap(costMap, boardCorePrices, products);
  }, [costMap, boardCorePrices, products]);

  // Tính chi phí nguyên vật liệu định mức cho 1 dòng sản phẩm bán ra
  const getItemMaterialCost = (it: OrderItem): number => {
    const codeKey = (it.productCode || '').trim().toUpperCase();
    let unitCost = productCostLookup[codeKey];

    if (unitCost === undefined) {
      const matched = products.find(p => p.code.toUpperCase() === codeKey);
      if (matched && productCostLookup[matched.code.toUpperCase()] !== undefined) {
        unitCost = productCostLookup[matched.code.toUpperCase()];
      } else {
        unitCost = 0;
      }
    }

    return (it.quantity || 0) * (unitCost || 0);
  };

  // Xử lý thay đổi số tiền khấu trừ doanh thu cho một tháng cụ thể
  const handleDeductionChange = (month: number, rawVal: number) => {
    if (isPartnerMode()) return; // Chế độ đối tác chỉ xem, không thay đổi dữ liệu gốc
    const key = `${selectedYear}-${month}`;
    const cleanVal = Math.max(0, rawVal);
    const nextMap = {
      ...revenueDeductions,
      [key]: cleanVal
    };
    setRevenueDeductions(nextMap);
    saveRevenueDeductionsToFirestore(nextMap, { email: currentUserEmail }).catch(err => {
      console.error('Lỗi lưu khấu trừ doanh thu lên Firestore:', err);
    });
  };

  // Reset modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetOption, setResetOption] = useState<'all' | 'ordersOnly' | 'baselineOnly'>('all');
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');

  // Extract all existing years from orders & customer initial records
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    for (let y = currentRealYear; y <= currentRealYear + 5; y++) {
      yearsSet.add(y);
    }
    orders.forEach(o => {
      const y = new Date(o.date).getFullYear();
      if (!isNaN(y)) yearsSet.add(y);
    });
    customers.forEach(c => {
      if (c.initialYearlyRevenues) {
        Object.keys(c.initialYearlyRevenues).forEach(yrStr => {
          const yr = Number(yrStr);
          if (!isNaN(yr)) yearsSet.add(yr);
        });
      }
    });
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [orders, customers, currentRealYear]);

  // Filter orders by year and month
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.status === 'cancelled') return false;
      const orderDate = new Date(o.date);
      const y = orderDate.getFullYear();
      const m = orderDate.getMonth() + 1;

      if (y !== selectedYear) return false;
      if (selectedMonth !== 'all' && m !== selectedMonth) return false;
      return true;
    });
  }, [orders, selectedYear, selectedMonth]);

  // Tổng doanh thu đầu kỳ của tất cả khách hàng (gồm khách hiện tại + khách đã xóa)
  const totalCustomersInitialRevenue = useMemo(() => {
    const activeManual = customers.reduce((sum, c) => {
      const manual = (c.initialYearlyRevenues && c.initialYearlyRevenues[selectedYear] !== undefined)
        ? (c.initialYearlyRevenues[selectedYear] || 0)
        : (c.initialYearlyRevenue || 0);
      return sum + manual;
    }, 0);
    const archivedManual = archivedDeletedRevenues.reduce((sum, r) => {
      return sum + (r.yearlyRevenues?.[selectedYear]?.manualBaseline || 0);
    }, 0);
    return activeManual + archivedManual;
  }, [customers, selectedYear, archivedDeletedRevenues]);

  // Doanh thu từ hóa đơn phát sinh trên app trong kỳ
  const ordersRevenue = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.subtotal - (o.discount || 0)), 0);
  }, [filteredOrders]);

  // Monthly 1-12 data for the selected year with deductions & net revenue
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const mNum = i + 1;
      const deductionKey = `${selectedYear}-${mNum}`;
      const rawDeduction = revenueDeductions[deductionKey] || 0;
      const deduction = isPartnerMode() ? getDisplayPrice(rawDeduction) : rawDeduction;
      return {
        month: mNum,
        name: `Th ${mNum}`,
        revenue: 0,
        deduction,
        netRevenue: 0,
        materialCost: 0,
        grossProfit: 0,
        ordersCount: 0
      };
    });

    // Aggregate sales orders by item date (hàng bổ sung tính theo ngày thực tế bổ sung)
    orders.forEach(o => {
      if (o.status === 'cancelled') return;
      const sub = o.subtotal || 0;
      const disc = o.discount || 0;
      const ratio = sub > 0 ? Math.max(0, sub - disc) / sub : 1;
      const items = o.items && o.items.length > 0 ? o.items : [];

      if (items.length === 0) {
        const d = new Date(o.date);
        if (d.getFullYear() === selectedYear) {
          const mIdx = d.getMonth();
          if (mIdx >= 0 && mIdx < 12) {
            months[mIdx].revenue += Math.max(0, sub - disc);
            months[mIdx].ordersCount += 1;
          }
        }
      } else {
        const countedMonthsForOrder = new Set<number>();
        items.forEach(it => {
          const itDate = it.date || o.date;
          if (!itDate) return;
          const d = new Date(itDate);
          if (d.getFullYear() === selectedYear) {
            const mIdx = d.getMonth();
            if (mIdx >= 0 && mIdx < 12) {
              const itAmt = (it.amount !== undefined ? it.amount : (it.quantity * (it.price || 0))) || 0;
              months[mIdx].revenue += Math.round(itAmt * ratio);
              months[mIdx].materialCost += getItemMaterialCost(it);
              if (!countedMonthsForOrder.has(mIdx)) {
                months[mIdx].ordersCount += 1;
                countedMonthsForOrder.add(mIdx);
              }
            }
          }
        });
      }
    });

    // Compute net revenue & gross profit
    months.forEach(m => {
      m.netRevenue = Math.max(0, m.revenue - m.deduction);
      m.grossProfit = m.netRevenue - m.materialCost;
    });

    return months;
  }, [orders, selectedYear, revenueDeductions, productCostLookup, products]);

  // Tổng số liệu cả năm
  const totalYearGrossOrdersRevenue = useMemo(() => {
    return monthlyData.reduce((sum, m) => sum + m.revenue, 0);
  }, [monthlyData]);

  const totalYearDeductions = useMemo(() => {
    return monthlyData.reduce((sum, m) => sum + m.deduction, 0);
  }, [monthlyData]);

  const totalYearNetOrdersRevenue = useMemo(() => {
    return monthlyData.reduce((sum, m) => sum + m.netRevenue, 0);
  }, [monthlyData]);

  const totalYearMaterialCost = useMemo(() => {
    return monthlyData.reduce((sum, m) => sum + m.materialCost, 0);
  }, [monthlyData]);

  const totalYearGrossProfit = useMemo(() => {
    return totalYearNetOrdersRevenue - totalYearMaterialCost;
  }, [totalYearNetOrdersRevenue, totalYearMaterialCost]);


  // Tổng doanh thu gộp (Gross Revenue)
  const totalGrossRevenue = useMemo(() => {
    if (selectedMonth === 'all') {
      return totalYearGrossOrdersRevenue + totalCustomersInitialRevenue;
    }
    const currentM = monthlyData.find(m => m.month === selectedMonth);
    return currentM ? currentM.revenue : 0;
  }, [selectedMonth, totalYearGrossOrdersRevenue, totalCustomersInitialRevenue, monthlyData]);

  // Tổng khấu trừ kỳ đang chọn (Selected Period Deductions)
  const selectedPeriodDeductions = useMemo(() => {
    if (selectedMonth === 'all') {
      return totalYearDeductions;
    }
    const currentM = monthlyData.find(m => m.month === selectedMonth);
    return currentM ? currentM.deduction : 0;
  }, [selectedMonth, totalYearDeductions, monthlyData]);

  // Top level KPI: "Doanh Thu Thuần" dùng cho toàn bộ báo cáo doanh thu năm và thống kê sát thực tế
  const totalNetRevenue = useMemo(() => {
    if (selectedMonth === 'all') {
      return totalYearNetOrdersRevenue + totalCustomersInitialRevenue;
    }
    const currentM = monthlyData.find(m => m.month === selectedMonth);
    return currentM ? currentM.netRevenue : 0;
  }, [selectedMonth, totalYearNetOrdersRevenue, totalCustomersInitialRevenue, monthlyData]);

  const totalOrdersCount = filteredOrders.length;
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalNetRevenue / totalOrdersCount) : 0;

  const maxChartValue = useMemo(() => {
    let max = 1000000;
    monthlyData.forEach(m => {
      const compareVal = Math.max(m.revenue, m.netRevenue);
      if (compareVal > max) max = compareVal;
    });
    return max;
  }, [monthlyData]);

  // ==========================================
  // THỐNG KÊ DOANH SỐ PHÁT SINH TỪNG NGÀY TRONG THÁNG
  // ==========================================
  const dailyBreakdown = useMemo(() => {
    // Number of days in dailyMonth of selectedYear
    const daysCount = new Date(selectedYear, dailyMonth, 0).getDate();
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

    const days = Array.from({ length: daysCount }, (_, i) => {
      const dayNum = i + 1;
      const dateStr = `${selectedYear}-${String(dailyMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayDate = new Date(selectedYear, dailyMonth - 1, dayNum);
      const dayName = dayNames[dayDate.getDay()];

      // Find orders and revenue/material cost on this day based on item dates
      let dayRevenue = 0;
      let dayMaterialCost = 0;
      const dayOrdersSet = new Set<string>();
      const dayOrders: Order[] = [];

      orders.forEach(o => {
        if (o.status === 'cancelled') return;
        const sub = o.subtotal || 0;
        const disc = o.discount || 0;
        const ratio = sub > 0 ? Math.max(0, sub - disc) / sub : 1;
        const items = o.items && o.items.length > 0 ? o.items : [];

        if (items.length === 0) {
          if (o.date === dateStr) {
            dayRevenue += Math.max(0, sub - disc);
            if (!dayOrdersSet.has(o.id)) {
              dayOrdersSet.add(o.id);
              dayOrders.push(o);
            }
          }
        } else {
          let hasItemOnThisDay = false;
          items.forEach(it => {
            const itDate = it.date || o.date;
            if (itDate === dateStr) {
              const itAmt = (it.amount !== undefined ? it.amount : (it.quantity * (it.price || 0))) || 0;
              dayRevenue += Math.round(itAmt * ratio);
              dayMaterialCost += getItemMaterialCost(it);
              hasItemOnThisDay = true;
            }
          });
          if (hasItemOnThisDay && !dayOrdersSet.has(o.id)) {
            dayOrdersSet.add(o.id);
            dayOrders.push(o);
          }
        }
      });

      const dayGrossProfit = dayRevenue - dayMaterialCost;

      return {
        day: dayNum,
        dateStr,
        dayName,
        isWeekend: dayDate.getDay() === 0 || dayDate.getDay() === 6,
        isToday: dateStr === currentRealDayStr,
        ordersCount: dayOrders.length,
        orders: dayOrders,
        revenue: dayRevenue,
        materialCost: dayMaterialCost,
        grossProfit: dayGrossProfit
      };
    });

    const totalMonthRevenue = days.reduce((sum, d) => sum + d.revenue, 0);
    const totalMonthMaterialCost = days.reduce((sum, d) => sum + d.materialCost, 0);
    const totalMonthGrossProfit = totalMonthRevenue - totalMonthMaterialCost;
    const monthMargin = totalMonthRevenue > 0 ? Math.round((totalMonthGrossProfit / totalMonthRevenue) * 1000) / 10 : 0;
    const totalMonthOrders = days.reduce((sum, d) => sum + d.ordersCount, 0);

    const activeDays = days.filter(d => d.revenue > 0);
    const maxRevenue = activeDays.length > 0 ? Math.max(...activeDays.map(d => d.revenue)) : 0;
    const minRevenue = activeDays.length > 0 ? Math.min(...activeDays.map(d => d.revenue)) : 0;

    const maxDay = activeDays.find(d => d.revenue === maxRevenue) || null;
    const minDay = activeDays.length > 1 ? activeDays.find(d => d.revenue === minRevenue) : (activeDays.length === 1 ? activeDays[0] : null);

    const avgDailyRevenue = activeDays.length > 0 ? Math.round(totalMonthRevenue / daysCount) : 0;
    const avgPerActiveDay = activeDays.length > 0 ? Math.round(totalMonthRevenue / activeDays.length) : 0;

    return {
      days,
      daysCount,
      totalMonthRevenue,
      totalMonthMaterialCost,
      totalMonthGrossProfit,
      monthMargin,
      totalMonthOrders,
      activeDaysCount: activeDays.length,
      maxDay,
      minDay,
      maxRevenue,
      minRevenue,
      avgDailyRevenue,
      avgPerActiveDay
    };
  }, [orders, selectedYear, dailyMonth, currentRealDayStr, productCostLookup, products]);

  const handleConfirmReset = () => {
    if (onResetYearData) {
      onResetYearData(selectedYear, resetOption);
      setResetSuccessMsg(`Đã đặt lại thành công dữ liệu năm ${selectedYear}!`);
      setTimeout(() => {
        setResetSuccessMsg('');
        setIsResetModalOpen(false);
      }, 1500);
    }
  };

  return (
    <div className="space-y-6">
      {/* TOP PRIMARY TABS: DOANH SỐ / ĐỊNH MỨC GIÁ VỐN & TỶ SUẤT LỢI NHUẬN GỘP */}
      <div className="bg-white rounded-2xl p-2.5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveMainSection('sales')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeMainSection === 'sales'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>1. Báo Cáo Doanh Số Bán Hàng</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
              Năm {selectedYear}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainSection('product_cost')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeMainSection === 'product_cost'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Table2 className="w-4 h-4 text-slate-900" />
            <span>2. Bảng Định Mức Giá Vốn & Tỷ Suất LNG</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-white font-mono font-bold">
              Đầy đủ Giá Studio
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1.5 px-2">
          {activeMainSection === 'sales' ? (
            <span className="flex items-center gap-1 text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Doanh số 12 tháng & chi tiết từng ngày
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Tự động liên kết Bảng Giá SP & Tự động tính Tỷ suất LNG / Giá bán
            </span>
          )}
        </div>
      </div>

      {activeMainSection === 'product_cost' ? (
        <ProductCostAnalyticsTable products={products} currentUserEmail={currentUserEmail} />
      ) : (
        <>
          {/* Header & Year/Month Filter Toolbar */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 uppercase">
              BÁO CÁO THỐNG KÊ DOANH SỐ BÁN ẢNH
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 shadow-xs">
              NĂM {selectedYear}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi tổng hợp doanh số 12 tháng và chi tiết doanh số phát sinh từng ngày trong tháng
          </p>
        </div>

        {/* Action controls & Year selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Year selector buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-500 px-2 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              Năm:
            </span>
            <div className="flex gap-1">
              {availableYears.slice(0, 5).map(year => (
                <button
                  key={year}
                  type="button"
                  onClick={() => {
                    setSelectedYear(year);
                    if (selectedMonth !== 'all') {
                      setDailyMonth(selectedMonth);
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    selectedYear === year
                      ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {year} {year === currentRealYear ? '(Nay)' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Month selector for KPI filter */}
          <select
            value={selectedMonth}
            onChange={(e) => {
              const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
              setSelectedMonth(val);
              if (val !== 'all') {
                setDailyMonth(val);
              }
            }}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
          >
            <option value="all">📅 Toàn bộ cả năm {selectedYear}</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Tháng {i + 1} / {selectedYear}
              </option>
            ))}
          </select>

          {/* Manual Reset Year Data Button */}
          {onResetYearData && (
            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition cursor-pointer shadow-2xs hover:shadow-xs"
              title={`Xóa hoặc đặt lại dữ liệu của năm ${selectedYear} để làm bảng mới`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
              <span>Reset Dữ Liệu Năm {selectedYear}</span>
            </button>
          )}
        </div>
      </div>

      {/* TOP REVENUE SUMMARY BANNER */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-800 text-white rounded-2xl p-5 border border-slate-700 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <DollarSign className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                TỔNG DOANH THU THUẦN ({selectedMonth !== 'all' ? `THÁNG ${selectedMonth}` : `CẢ NĂM ${selectedYear}`})
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Thực tế sau khấu trừ
              </span>
            </div>
            <div className="font-mono text-3xl sm:text-4xl font-black text-amber-400">
              {formatCurrency(totalNetRevenue)}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-slate-300">
              <span>Doanh thu bán ảnh gộp: <strong className="font-mono text-white">{formatCurrency(totalGrossRevenue)}</strong></span>
              {selectedPeriodDeductions > 0 && (
                <>
                  <span className="text-slate-500">•</span>
                  <span className="text-rose-300">
                    Khấu trừ doanh thu: <strong className="font-mono text-rose-300">-{formatCurrency(selectedPeriodDeductions)}</strong>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 sm:border-l sm:border-slate-700 sm:pl-6">
            <div>
              <p className="text-xs text-slate-400">Tổng số đơn hàng</p>
              <p className="font-mono text-xl font-bold text-white mt-0.5">{totalOrdersCount} đơn</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Giá trị TB thuần / đơn</p>
              <p className="font-mono text-xl font-bold text-blue-300 mt-0.5">{formatCurrency(avgOrderValue)}</p>
            </div>
          </div>
        </div>

        {totalCustomersInitialRevenue > 0 && selectedMonth === 'all' && (
          <div className="text-xs text-slate-300 mt-3 pt-3 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
            <span className="text-amber-300 flex items-center gap-1.5 font-semibold">
              <Award className="w-4 h-4 text-amber-400" />
              Doanh thu đầu kỳ (nhập tay trong sổ khách hàng): <strong className="font-mono text-amber-300 text-sm">{formatCurrency(totalCustomersInitialRevenue)}</strong>
            </span>
            <span className="text-slate-400">
              Hóa đơn phát sinh trên app: <strong className="font-mono text-white text-sm">{formatCurrency(totalYearGrossOrdersRevenue)}</strong> ({totalOrdersCount} đơn)
            </span>
          </div>
        )}
      </div>

      {/* SUB-TAB NAVIGATOR FOR TABLES */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📑 Hiển thị cả 2 bảng
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('monthly')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'monthly'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📊 Bảng Doanh Số 12 Tháng
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('daily')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'daily'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📅 Bảng Doanh Số Từng Ngày
          </button>

          <button
            type="button"
            onClick={() => setActiveMainSection('product_cost')}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1.5 ml-1"
            title="Mở Bảng Định Mức Giá Vốn & Tỷ Suất Lợi Nhuận Gộp theo mẫu PDF"
          >
            <Table2 className="w-3.5 h-3.5 text-amber-700" />
            <span>Bảng Định Mức Giá Vốn & LNG (Mẫu PDF)</span>
          </button>
        </div>

        {/* Hint */}
        <span className="text-xs text-slate-400 hidden sm:inline-flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Bấm nút "Xem ngày" để mở chi tiết từng ngày của tháng đó
        </span>
      </div>

      {/* ========================================================= */}
      {/* 1. BẢNG THỐNG KÊ DOANH SỐ 12 THÁNG TRONG NĂM */}
      {/* ========================================================= */}
      {(activeSubTab === 'all' || activeSubTab === 'monthly') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                <BarChart3 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wide text-white">
                  1. BẢNG THỐNG KÊ DOANH SỐ 12 THÁNG NĂM {selectedYear}
                </h3>
                <p className="text-xs text-slate-300">
                  Tổng hợp doanh thu bán ảnh theo từng tháng từ Tháng 1 đến Tháng 12
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onResetYearData && (
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(true)}
                  className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset bảng năm {selectedYear}</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                  <th className="py-3 px-3 w-28">Tháng</th>
                  <th className="py-3 px-2 w-20 text-center">Số Đơn</th>
                  <th className="py-3 px-3 w-36 text-right text-sm">Doanh Thu Bán Ảnh (VNĐ)</th>
                  <th className="py-3 px-3 w-40 text-right bg-rose-50/70 text-rose-900 border-l border-rose-200" title="Khoản trừ sau giảm giá, nợ không đòi được, hủy đơn hoặc lý do không thực hiện được (Nhập thủ công)">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1 font-black text-xs text-rose-800">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                        <span>Khấu Trừ Doanh Thu</span>
                      </div>
                      <span className="text-[10px] text-rose-600 font-normal mt-0.5">(Nhập thủ công)</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 w-40 text-right bg-emerald-50/80 text-emerald-950 border-l border-emerald-200 font-black text-sm" title="Doanh Thu Thuần = Doanh Thu Bán Ảnh - Khấu Trừ Doanh Thu">
                    <div className="flex flex-col items-end">
                      <span className="text-emerald-900 font-black text-xs">Doanh Thu Thuần</span>
                      <span className="text-[10px] text-emerald-700 font-normal mt-0.5">(= Bán ảnh - Khấu trừ)</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 w-44 text-right bg-orange-50/80 text-orange-950 border-l border-orange-200 font-black text-sm" title="Tổng Chi Phí Vật Tư Tiêu Hao (Tháng) = Tổng lũy kế cột Chi Phí Nguyên Vật Liệu của tất cả các ngày trong tháng đó">
                    <div className="flex flex-col items-end">
                      <span className="text-orange-900 font-black text-xs">Tổng Chi Phí Vật Tư Tiêu Hao (VNĐ)</span>
                      <span className="text-[10px] text-orange-700 font-normal mt-0.5">(Lũy kế NVL từng ngày)</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 w-44 text-right bg-blue-50/80 text-blue-950 border-l border-blue-200 font-black text-sm" title="Lợi Nhuận Gộp Ước Tính (Tháng) = [Doanh Thu Thuần] - [Tổng Chi Phí Vật Tư Tiêu Hao]">
                    <div className="flex flex-col items-end">
                      <span className="text-blue-950 font-black text-xs">Lợi Nhuận Gộp Ước Tính (VNĐ)</span>
                      <span className="text-[10px] text-blue-700 font-normal mt-0.5">(= DT thuần - Vật tư)</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 w-28 text-center">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {totalCustomersInitialRevenue > 0 && (
                  <tr className="bg-amber-50/70 text-slate-800 font-semibold border-b border-amber-200">
                    <td className="py-3 px-3 font-bold text-amber-950 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Đầu kỳ (Sổ khách hàng)</span>
                    </td>
                    <td className="py-3 px-2 text-center text-slate-500 font-mono text-xs">
                      Trước app
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-amber-800 text-sm">
                      {formatCurrency(totalCustomersInitialRevenue)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-400 border-l border-amber-200 text-xs">
                      —
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-amber-900 text-sm border-l border-amber-200 bg-amber-100/50">
                      {formatCurrency(totalCustomersInitialRevenue)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-400 border-l border-amber-200 text-xs">
                      —
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-amber-900 text-sm border-l border-amber-200 bg-amber-100/30">
                      {formatCurrency(totalCustomersInitialRevenue)}
                    </td>
                    <td className="py-3 px-3 text-center text-xs font-semibold text-amber-800">
                      Sổ ghi nhận
                    </td>
                  </tr>
                )}

                {monthlyData.map(m => {
                  const isCurrentSelected = dailyMonth === m.month;
                  return (
                    <tr
                      key={m.month}
                      className={`hover:bg-slate-50 transition ${
                        isCurrentSelected ? 'bg-amber-50/40 font-semibold' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-bold text-slate-900 text-sm">
                        Tháng {m.month}/{selectedYear}
                      </td>
                      <td className="py-3 px-2 text-center font-mono">
                        {m.ordersCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-xs">
                            {m.ordersCount} đơn
                          </span>
                        ) : (
                          <span className="text-slate-400">0 đơn</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                        {formatCurrency(m.revenue)}
                      </td>

                      {/* KHẤU TRỪ DOANH THU (NHẬP THỦ CÔNG) */}
                      <td className="py-2 px-3 text-right bg-rose-50/30 border-l border-rose-100">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            disabled={isPartnerMode()}
                            value={m.deduction > 0 ? m.deduction.toLocaleString('en-US') : ''}
                            onChange={(e) => {
                              const val = Number(e.target.value.replace(/\D/g, '')) || 0;
                              handleDeductionChange(m.month, val);
                            }}
                            placeholder="0"
                            title={isPartnerMode() ? 'Chế độ đối tác (chỉ xem, khấu trừ tự động đồng bộ từ hệ thống)' : 'Khấu trừ doanh thu: nợ khó đòi, trừ sau giảm giá, lý do không thu được...'}
                            className={`w-28 px-2 py-1 bg-white border border-slate-300 rounded-lg text-right font-mono text-xs font-black text-rose-700 outline-none transition shadow-2xs ${
                              isPartnerMode() ? 'opacity-80 cursor-not-allowed bg-slate-50' : 'hover:bg-rose-50/20 focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                            }`}
                          />
                          <span className="text-[11px] text-slate-400 font-mono">₫</span>
                        </div>
                      </td>

                      {/* DOANH THU THUẦN (= DOANH THU BÁN ẢNH - KHẤU TRỪ DOANH THU) */}
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-800 text-sm bg-emerald-50/40 border-l border-emerald-100">
                        {formatCurrency(m.netRevenue)}
                      </td>

                      {/* CỘT BỔ SUNG 1: TỔNG CHI PHÍ VẬT TƯ TIÊU HOA (VNĐ) */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-orange-900 text-sm bg-orange-50/30 border-l border-orange-100">
                        {formatCurrency(m.materialCost)}
                      </td>

                      {/* CỘT BỔ SUNG 2: LỢI NHUẬN GỘP ƯỚC TÍNH (VNĐ) (= [Doanh Thu Thuần] - [Tổng Chi Phí Vật Tư Tiêu Hao]) */}
                      <td className={`py-3 px-3 text-right font-mono font-black text-sm border-l border-blue-100 ${
                        m.grossProfit >= 0 ? 'bg-blue-50/40 text-blue-900' : 'bg-rose-50/60 text-rose-700'
                      }`}>
                        {formatCurrency(m.grossProfit)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setDailyMonth(m.month);
                            if (activeSubTab === 'monthly') {
                              setActiveSubTab('daily');
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs ${
                            isCurrentSelected
                              ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                          title={`Xem chi tiết doanh số từng ngày trong Tháng ${m.month}`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Xem ngày</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-extrabold text-sm">
                  <td className="py-3.5 px-3">TỔNG NĂM {selectedYear}</td>
                  <td className="py-3.5 px-2 text-center font-mono text-blue-300 text-xs">
                    {monthlyData.reduce((s, m) => s + m.ordersCount, 0)} đơn
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-200 text-sm font-bold">
                    {formatCurrency(totalGrossRevenue)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-rose-300 text-sm font-bold border-l border-slate-800">
                    {totalYearDeductions > 0 ? `-${formatCurrency(totalYearDeductions)}` : '0 ₫'}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-amber-400 text-base font-black border-l border-slate-800 bg-slate-950/40">
                    {formatCurrency(totalNetRevenue)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-orange-300 text-sm font-bold border-l border-slate-800">
                    {formatCurrency(totalYearMaterialCost)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-blue-300 text-base font-black border-l border-slate-800 bg-slate-950/60">
                    {formatCurrency(totalYearGrossProfit)}
                  </td>
                  <td className="py-3.5 px-3 text-center text-slate-400 text-xs font-normal">
                    12 Tháng
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. BẢNG DOANH SỐ PHÁT SINH TỪNG NGÀY TRONG THÁNG */}
      {/* ========================================================= */}
      {(activeSubTab === 'all' || activeSubTab === 'daily') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-4 sm:p-5">
          {/* Header of Daily View */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-amber-500/20 text-amber-700 rounded-xl">
                <Calendar className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wide text-slate-900 flex items-center gap-2">
                  <span>2. BẢNG DOANH SỐ PHÁT SINH TỪNG NGÀY TRONG THÁNG {dailyMonth}/{selectedYear}</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-800">
                    {dailyBreakdown.daysCount} ngày
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Nắm bắt mỗi ngày phát sinh bao nhiêu doanh số, ngày nhiều nhất và ngày ít nhất trong tháng
                </p>
              </div>
            </div>

            {/* Month Quick Selector for Daily Table */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
              <span className="text-xs font-bold text-slate-500 shrink-0 mr-1">Chọn tháng:</span>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDailyMonth(m)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                    dailyMonth === m
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Th{m}
                </button>
              ))}
            </div>
          </div>

          {/* DAILY STATISTICAL HIGHLIGHTS / KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Ngày nhiều doanh thu nhất (Đỉnh điểm) */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950 to-slate-900 text-white border border-emerald-500/40 shadow-xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-emerald-300 flex items-center gap-1">
                  <Flame className="w-4 h-4 text-amber-400" />
                  DOANH THU CAO NHẤT
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-500 text-slate-950">
                  Kỷ Lục
                </span>
              </div>
              {dailyBreakdown.maxDay ? (
                <div>
                  <div className="font-mono text-xl font-black text-amber-400 mt-1">
                    {formatCurrency(dailyBreakdown.maxDay.revenue)}
                  </div>
                  <div className="text-xs text-slate-300 mt-1 flex items-center justify-between">
                    <span>
                      📅 <strong>{dailyBreakdown.maxDay.dayName}</strong> ({dailyBreakdown.maxDay.dateStr})
                    </span>
                    <span className="text-amber-300 font-bold">{dailyBreakdown.maxDay.ordersCount} đơn</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-2">Chưa có phát sinh doanh thu trong tháng này</p>
              )}
            </div>

            {/* 2. Ngày ít doanh thu nhất */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white border border-slate-700 shadow-xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-rose-300 flex items-center gap-1">
                  <ArrowDown className="w-4 h-4 text-rose-400" />
                  DOANH THU THẤP NHẤT
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-slate-700 text-slate-300">
                  Đáy Tháng
                </span>
              </div>
              {dailyBreakdown.minDay ? (
                <div>
                  <div className="font-mono text-xl font-black text-rose-300 mt-1">
                    {formatCurrency(dailyBreakdown.minDay.revenue)}
                  </div>
                  <div className="text-xs text-slate-300 mt-1 flex items-center justify-between">
                    <span>
                      📅 <strong>{dailyBreakdown.minDay.dayName}</strong> ({dailyBreakdown.minDay.dateStr})
                    </span>
                    <span className="text-rose-300 font-bold">{dailyBreakdown.minDay.ordersCount} đơn</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-2">Chưa có phát sinh đơn</p>
              )}
            </div>

            {/* 3. Doanh thu trung bình mỗi ngày */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-xs mb-1 text-slate-600">
                <span className="font-bold flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  DOANH THU TRUNG BÌNH
                </span>
                <span className="text-[11px] font-mono text-slate-500">/{dailyBreakdown.daysCount} ngày</span>
              </div>
              <div className="font-mono text-xl font-black text-slate-900 mt-1">
                {formatCurrency(dailyBreakdown.avgDailyRevenue)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                TB ngày có đơn: <strong className="text-blue-700">{formatCurrency(dailyBreakdown.avgPerActiveDay)}</strong>
              </p>
            </div>

            {/* 4. Tổng kết tháng đang xem */}
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200">
              <div className="flex items-center justify-between text-xs mb-1 text-amber-900">
                <span className="font-bold flex items-center gap-1">
                  <Coins className="w-4 h-4 text-amber-700" />
                  TỔNG THÁNG {dailyMonth}/{selectedYear}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-200 text-amber-900">
                  {dailyBreakdown.activeDaysCount}/{dailyBreakdown.daysCount} ngày bán
                </span>
              </div>
              <div className="font-mono text-xl font-black text-amber-900 mt-1">
                {formatCurrency(dailyBreakdown.totalMonthRevenue)}
              </div>
              <p className="text-[11px] text-amber-800 mt-1">
                Tổng <strong>{dailyBreakdown.totalMonthOrders}</strong> đơn hàng phát sinh
              </p>
            </div>
          </div>

          {/* THE DAILY BREAKDOWN TABLE */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                  <th className="py-3 px-4 w-40">Ngày</th>
                  <th className="py-3 px-4 w-36">Vị Trí / Đánh Giá</th>
                  <th className="py-3 px-4 w-24 text-center">Số Đơn</th>
                  <th className="py-3 px-4 text-right text-sm">Doanh Số Ngày (VNĐ)</th>
                  <th className="py-3 px-4 text-right text-xs bg-orange-50/70 text-orange-950 border-l border-orange-200 font-black" title="Chi Phí Nguyên Vật Liệu (Ngày) = Tổng (Số lượng từng sản phẩm x Giá vốn định mức tương ứng)">
                    <div className="flex flex-col items-end">
                      <span>Chi Phí Nguyên Vật Liệu (VNĐ)</span>
                      <span className="text-[10px] text-orange-700 font-normal mt-0.5">(Giá vốn định mức)</span>
                    </div>
                  </th>
                  <th className="py-3 px-4 text-right text-xs bg-blue-50/70 text-blue-950 border-l border-blue-200 font-black" title="Lợi Nhuận Gộp Ước Tính (Ngày) = [Doanh Số Ngày] - [Chi Phí Nguyên Vật Liệu]">
                    <div className="flex flex-col items-end">
                      <span>Lợi Nhuận Gộp Ước Tính (VNĐ)</span>
                      <span className="text-[10px] text-blue-700 font-normal mt-0.5">(= Doanh số - NVL)</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyBreakdown.days.map(d => {
                  const isMax = dailyBreakdown.maxDay && d.dateStr === dailyBreakdown.maxDay.dateStr && d.revenue > 0;
                  const isMin = dailyBreakdown.minDay && d.dateStr === dailyBreakdown.minDay.dateStr && d.revenue > 0;
                  const percent = dailyBreakdown.totalMonthRevenue > 0
                    ? Math.round((d.revenue / dailyBreakdown.totalMonthRevenue) * 100)
                    : 0;

                  return (
                    <tr
                      key={d.dateStr}
                      className={`hover:bg-slate-50 transition ${
                        isMax
                          ? 'bg-emerald-50/60 font-semibold'
                          : isMin
                          ? 'bg-rose-50/40'
                          : d.isToday
                          ? 'bg-blue-50/40'
                          : d.isWeekend
                          ? 'bg-slate-50/50'
                          : ''
                      }`}
                    >
                      {/* Ngày & Thứ */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${d.isWeekend ? 'text-rose-700' : 'text-slate-900'}`}>
                            {d.dateStr}
                          </span>
                          <span className="text-xs text-slate-500 font-normal">
                            ({d.dayName})
                          </span>
                          {d.isToday && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-blue-600 text-white">
                              Hôm nay
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Đánh giá / Điểm nhấn */}
                      <td className="py-3 px-4">
                        {isMax ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-black bg-emerald-600 text-white shadow-2xs">
                            <Flame className="w-3.5 h-3.5 text-amber-300" />
                            👑 CAO NHẤT THÁNG
                          </span>
                        ) : isMin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-800">
                            <ArrowDown className="w-3.5 h-3.5 text-rose-600" />
                            🔻 THẤP NHẤT
                          </span>
                        ) : d.revenue > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Có doanh số
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">---</span>
                        )}
                      </td>

                      {/* Số đơn */}
                      <td className="py-3 px-4 text-center font-mono">
                        {d.ordersCount > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-xs">
                            {d.ordersCount} đơn
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>

                      {/* Doanh số ngày */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                        {d.revenue > 0 ? (
                          <div className="flex items-center justify-end gap-3">
                            <span className={isMax ? 'text-emerald-700 font-black text-base' : ''}>
                              {formatCurrency(d.revenue)}
                            </span>
                            <span className="font-mono text-xs font-semibold text-slate-400 w-10 text-right">
                              ({percent}%)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-normal">0 đ</span>
                        )}
                      </td>

                      {/* CỘT BỔ SUNG 1: Chi Phí Nguyên Vật Liệu (VNĐ) */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-orange-900 text-xs bg-orange-50/20 border-l border-orange-100">
                        {d.materialCost > 0 ? (
                          formatCurrency(d.materialCost)
                        ) : (
                          <span className="text-slate-300 font-normal">0 đ</span>
                        )}
                      </td>

                      {/* CỘT BỔ SUNG 2: Lợi Nhuận Gộp Ước Tính (VNĐ) */}
                      <td className={`py-3 px-4 text-right font-mono font-black text-xs border-l border-blue-100 ${
                        d.grossProfit > 0
                          ? 'bg-blue-50/30 text-blue-900'
                          : d.grossProfit < 0
                          ? 'bg-rose-50/40 text-rose-700'
                          : 'text-slate-400'
                      }`}>
                        {d.revenue > 0 || d.materialCost > 0 ? (
                          formatCurrency(d.grossProfit)
                        ) : (
                          <span className="text-slate-300 font-normal">0 đ</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-extrabold text-sm">
                  <td className="py-3.5 px-4">TỔNG THÁNG {dailyMonth}/{selectedYear}</td>
                  <td className="py-3.5 px-4 text-slate-300 font-normal text-xs">
                    {dailyBreakdown.activeDaysCount}/{dailyBreakdown.daysCount} ngày có doanh số
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-amber-400">
                    {dailyBreakdown.totalMonthOrders} đơn
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-amber-400 text-base font-black">
                    {formatCurrency(dailyBreakdown.totalMonthRevenue)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-orange-300 text-sm font-bold border-l border-slate-800">
                    {formatCurrency(dailyBreakdown.totalMonthMaterialCost)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-blue-300 text-base font-black border-l border-slate-800 bg-slate-950/60">
                    {formatCurrency(dailyBreakdown.totalMonthGrossProfit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 12 Months Visual Chart & Breakdown */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <span>BIỂU ĐỒ DOANH THU THUẦN 12 THÁNG NĂM {selectedYear}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Thực tế sau khấu trừ
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Nhấp vào từng cột tháng để chuyển nhanh xem chi tiết từng ngày của tháng đó
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block"></span>
              <span>Doanh thu thuần</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block"></span>
              <span>Tháng đang chọn</span>
            </div>
          </div>
        </div>

        {/* Bar chart container */}
        <div className="h-56 flex items-end justify-between gap-1 sm:gap-3 pt-6 pb-2 px-1 border-b border-slate-200">
          {monthlyData.map(m => {
            const revHeight = maxChartValue > 0 ? (m.netRevenue / maxChartValue) * 100 : 0;
            const isCurrentSelected = dailyMonth === m.month;

            return (
              <div
                key={m.month}
                onClick={() => setDailyMonth(m.month)}
                className={`flex-1 flex flex-col items-center h-full justify-end group cursor-pointer p-1 rounded-t-lg transition ${
                  isCurrentSelected ? 'bg-amber-100/60 font-bold' : 'hover:bg-slate-50'
                }`}
                title={`Tháng ${m.month}/${selectedYear}: Doanh thu thuần ${formatCurrency(m.netRevenue)}${
                  m.deduction > 0 ? ` (Bán ảnh gộp: ${formatCurrency(m.revenue)} - Khấu trừ: ${formatCurrency(m.deduction)})` : ''
                }`}
              >
                {/* Value tooltip on hover */}
                <div className="text-[10px] font-mono text-slate-500 mb-1 opacity-0 group-hover:opacity-100 transition whitespace-nowrap hidden sm:block">
                  {m.netRevenue > 0 ? `${Math.round(m.netRevenue / 1000000)}Tr` : '0'}
                </div>

                <div className="w-full flex items-end justify-center h-40">
                  {/* Revenue Bar */}
                  <div
                    style={{ height: `${Math.max(revHeight, m.netRevenue > 0 ? 4 : 0)}%` }}
                    className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                      isCurrentSelected
                        ? 'bg-amber-500 group-hover:bg-amber-600 shadow-xs'
                        : 'bg-emerald-600 group-hover:bg-emerald-500'
                    }`}
                  />
                </div>

                <span className={`text-[10px] sm:text-xs font-bold mt-2 ${
                  isCurrentSelected ? 'text-amber-900 font-black scale-110' : 'text-slate-600'
                }`}>
                  T{m.month}
                </span>
              </div>
            );
          })}
        </div>
      </div>
        </>
      )}

      {/* ========================================================= */}
      {/* MODAL: RESET DỮ LIỆU NĂM THỦ CÔNG */}
      {/* ========================================================= */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-rose-500/20 text-rose-400 rounded-lg">
                  <RotateCcw className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-sm">Đặt Lại / Reset Dữ Liệu Năm {selectedYear}</h3>
                  <p className="text-[11px] text-slate-400">Xóa dữ liệu để chuẩn bị đón năm mới hoặc bắt đầu năm tài chính mới</p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              {resetSuccessMsg ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-emerald-800 font-bold flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  <span>{resetSuccessMsg}</span>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                    <strong>Lưu ý:</strong> Hành động này sẽ xóa dữ liệu doanh số và đơn hàng của riêng <strong>Năm {selectedYear}</strong>. Các năm khác và danh mục bảng giá, danh sách khách hàng sẽ <strong>vẫn được giữ nguyên an toàn</strong>.
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700">Chọn hình thức đặt lại cho Năm {selectedYear}:</label>

                    <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                      resetOption === 'all'
                        ? 'bg-rose-50 border-rose-400 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="resetOpt"
                        checked={resetOption === 'all'}
                        onChange={() => setResetOption('all')}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-bold">Xóa sạch toàn bộ đơn hàng & doanh thu đầu kỳ Năm {selectedYear}</p>
                        <p className="text-[11px] text-slate-500">Đưa toàn bộ doanh số Năm {selectedYear} về 0đ để bắt đầu năm mới hoàn toàn.</p>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                      resetOption === 'ordersOnly'
                        ? 'bg-rose-50 border-rose-400 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="resetOpt"
                        checked={resetOption === 'ordersOnly'}
                        onChange={() => setResetOption('ordersOnly')}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-bold">Chỉ xóa các đơn hàng phát sinh trong Năm {selectedYear}</p>
                        <p className="text-[11px] text-slate-500">Giữ nguyên số liệu doanh thu ban đầu đã nhập tay trong sổ khách hàng.</p>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                      resetOption === 'baselineOnly'
                        ? 'bg-rose-50 border-rose-400 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="resetOpt"
                        checked={resetOption === 'baselineOnly'}
                        onChange={() => setResetOption('baselineOnly')}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-bold">Chỉ xóa số liệu doanh thu ban đầu nhập tay (Sổ khách hàng)</p>
                        <p className="text-[11px] text-slate-500">Giữ nguyên các hóa đơn đã tạo trên app.</p>
                      </div>
                    </label>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            {!resetSuccessMsg && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReset}
                  className="px-4 py-2 text-xs font-black bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md cursor-pointer transition flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Xác Nhận Đặt Lại Năm {selectedYear}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
