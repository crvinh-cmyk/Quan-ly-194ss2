import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Order, WorkshopInfo, S1aDayOverride, S1aManualEntry } from '../types';
import { formatCurrency, formatDateVN } from '../utils/formatters';
import { getRevenueMultiplier } from '../utils/partnerConfig';
import {
  subscribeS1aOverrides,
  saveS1aOverridesToFirestore,
  subscribeS1aManualEntries,
  saveS1aManualEntriesToFirestore,
  AuthUserContext
} from '../services/firestoreService';
import { generateS1aCanvas300DPI } from '../utils/exportS1aCanvas';
import {
  Printer,
  Download,
  Calendar,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  Sparkles,
  Loader2,
  Edit2,
  PlusCircle,
  Trash2,
  Save,
  X,
  RotateCcw
} from 'lucide-react';

interface RevenueTrackingS1aViewProps {
  orders: Order[];
  workshop: WorkshopInfo;
  userContext?: AuthUserContext | null;
}

export const RevenueTrackingS1aView: React.FC<RevenueTrackingS1aViewProps> = ({
  orders,
  workshop,
  userContext
}) => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1); // 1-12
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Sync state for overrides and manual entries
  const [overrides, setOverrides] = useState<Record<string, S1aDayOverride>>({});
  const [manualEntries, setManualEntries] = useState<S1aManualEntry[]>([]);

  // Modal / Form states
  const [editingDay, setEditingDay] = useState<{
    dateKey: string;
    dayNumber: number;
    explanation: string;
    amount: number;
    hasOriginal: boolean;
    originalAmount: number;
    originalExplanation: string;
  } | null>(null);

  const [showAddManualModal, setShowAddManualModal] = useState<boolean>(false);
  const [manualFormDate, setManualFormDate] = useState<string>(() => {
    const mStr = String(currentDate.getMonth() + 1).padStart(2, '0');
    return `${currentDate.getFullYear()}-${mStr}-01`;
  });
  const [manualFormExplanation, setManualFormExplanation] = useState<string>('In ảnh và đóng khung ảnh');
  const [manualFormAmount, setManualFormAmount] = useState<string>('');

  // Fixed metadata according to specifications & Circular 152/2025/TT-BTC
  const businessName = 'Tiệm in 194';
  const businessAddress = 'Thôn 3 Quỳnh Giang cũ, xã Quỳnh Lưu, Nghệ An';
  const taxCode = '40094013626';
  const currencyUnit = 'VNĐ';

  const multiplier = getRevenueMultiplier(); // Hệ số doanh thu đối tác

  // 1. Subscribe to Firestore overrides and manual entries
  useEffect(() => {
    const unsubOverrides = subscribeS1aOverrides((data) => {
      setOverrides(data || {});
    });
    const unsubManual = subscribeS1aManualEntries((data) => {
      setManualEntries(data || []);
    });

    return () => {
      unsubOverrides();
      unsubManual();
    };
  }, []);

  // Update default manual form date when month/year changes
  useEffect(() => {
    const paddedMonth = String(selectedMonth).padStart(2, '0');
    setManualFormDate(`${selectedYear}-${paddedMonth}-01`);
  }, [selectedYear, selectedMonth]);

  // Calculate days in selected month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Aggregate daily revenue from main orders, combined with overrides and manual entries
  const dailyData = useMemo(() => {
    // Group orders by day of month (1 to daysInMonth)
    const dailyMap: Record<number, { originalTotal: number; ordersCount: number }> = {};

    orders.forEach(order => {
      if (order.status === 'cancelled') return;

      const items = order.items && order.items.length > 0 ? order.items : [];
      const orderSubtotal = order.subtotal || 0;
      const orderDiscount = order.discount || 0;
      // Tỷ lệ chiết khấu (nếu đơn có giảm giá thì phân bổ theo giá trị từng dòng)
      const discountRatio = orderSubtotal > 0 ? Math.max(0, orderSubtotal - orderDiscount) / orderSubtotal : 1;

      if (items.length === 0) {
        if (!order.date) return;
        const [yStr, mStr, dStr] = order.date.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10);
        const d = parseInt(dStr, 10);

        if (y === selectedYear && m === selectedMonth && d >= 1 && d <= 31) {
          if (!dailyMap[d]) {
            dailyMap[d] = { originalTotal: 0, ordersCount: 0 };
          }
          const orderRev = Math.max(0, orderSubtotal - orderDiscount);
          dailyMap[d].originalTotal += orderRev;
          dailyMap[d].ordersCount += 1;
        }
      } else {
        // Tính doanh thu theo ngày thực tế của từng dòng hàng (hàng bổ sung ngày hôm nay sẽ tính vào hôm nay)
        const recordedDaysForOrder = new Set<number>();

        items.forEach(it => {
          const itemDate = it.date || order.date;
          if (!itemDate) return;
          const [yStr, mStr, dStr] = itemDate.split('-');
          const y = parseInt(yStr, 10);
          const m = parseInt(mStr, 10);
          const d = parseInt(dStr, 10);

          if (y === selectedYear && m === selectedMonth && d >= 1 && d <= 31) {
            if (!dailyMap[d]) {
              dailyMap[d] = { originalTotal: 0, ordersCount: 0 };
            }
            const itemAmount = (it.amount !== undefined ? it.amount : (it.quantity * (it.price || 0))) || 0;
            const netItemRev = Math.round(itemAmount * discountRatio);
            dailyMap[d].originalTotal += netItemRev;

            if (!recordedDaysForOrder.has(d)) {
              dailyMap[d].ordersCount += 1;
              recordedDaysForOrder.add(d);
            }
          }
        });
      }
    });

    // Also collect manual entries for this month
    const manualMap: Record<number, { amount: number; explanation: string; entries: S1aManualEntry[] }> = {};
    manualEntries.forEach(entry => {
      if (!entry.date) return;
      const [yStr, mStr, dStr] = entry.date.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const d = parseInt(dStr, 10);

      if (y === selectedYear && m === selectedMonth && d >= 1 && d <= 31) {
        if (!manualMap[d]) {
          manualMap[d] = { amount: 0, explanation: entry.explanation, entries: [] };
        }
        manualMap[d].amount += entry.amount || 0;
        manualMap[d].entries.push(entry);
      }
    });

    const rows = [];
    let monthlyTotal = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const paddedDay = day.toString().padStart(2, '0');
      const paddedMonth = selectedMonth.toString().padStart(2, '0');
      const dateKey = `${selectedYear}-${paddedMonth}-${paddedDay}`;
      const dateString = `${paddedDay}/${paddedMonth}/${selectedYear}`;

      const orderData = dailyMap[day];
      const manualData = manualMap[day];

      const baseOrdersRevenue = orderData && orderData.originalTotal > 0
        ? Math.round(orderData.originalTotal * multiplier)
        : 0;

      const baseManualRevenue = manualData ? manualData.amount : 0;
      const totalBaseRevenue = baseOrdersRevenue + baseManualRevenue;

      let defaultExplanation = 'Nghỉ bán không phát sinh doanh thu';
      if (manualData && manualData.amount > 0) {
        defaultExplanation = manualData.explanation || 'In ảnh và đóng khung ảnh';
      } else if (orderData && orderData.originalTotal > 0) {
        defaultExplanation = 'In ảnh và đóng khung ảnh';
      }

      // Check if there is an explicit override for this day
      const override = overrides[dateKey];
      const isOverridden = !!(override && override.isEdited);

      const finalAmount = isOverridden && typeof override.amount === 'number'
        ? override.amount
        : totalBaseRevenue;

      const finalExplanation = isOverridden && override.explanation
        ? override.explanation
        : defaultExplanation;

      monthlyTotal += finalAmount;

      rows.push({
        dayNumber: day,
        dateKey,
        dateString,
        hasRevenue: finalAmount > 0,
        explanation: finalExplanation,
        amount: finalAmount,
        isOverridden,
        originalAmount: totalBaseRevenue,
        originalExplanation: defaultExplanation,
        manualEntriesCount: manualData ? manualData.entries.length : 0
      });
    }

    return {
      rows,
      monthlyTotal
    };
  }, [orders, selectedYear, selectedMonth, daysInMonth, multiplier, overrides, manualEntries]);

  // Handle direct print
  const handlePrint = () => {
    window.print();
  };

  // Handle high quality image export (20x30 cm ratio: 2:3 aspect ratio, 300 DPI high resolution)
  const handleExportImage = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    setExportError(null);

    try {
      if (document.fonts) {
        await document.fonts.ready;
      }

      // Khổ 20x30 cm ở chuẩn in ấn 300 DPI (2362 x 3543 pixels)
      // Render trực tiếp qua Canvas 2D engine siêu nét, không bị phụ thuộc CSS oklch của DOM
      const canvas = await generateS1aCanvas300DPI({
        businessName,
        businessAddress,
        taxCode,
        selectedMonth,
        selectedYear,
        currencyUnit,
        daysInMonth,
        rows: dailyData.rows,
        monthlyTotal: dailyData.monthlyTotal,
        workshop
      });

      const paddedMonth = selectedMonth.toString().padStart(2, '0');
      const fileName = `So_Theo_Doi_Doanh_Thu_Mauso_S1a_TiemIn194_Thang_${paddedMonth}_${selectedYear}.jpg`;

      // Xuất file ảnh JPEG chất lượng cao nhất (0.96)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.96);
      
      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4500);
    } catch (err: any) {
      console.error('Lỗi khi xuất ảnh mẫu S1a:', err);
      setExportError(err?.message || 'Không thể tạo file ảnh. Vui lòng thử lại hoặc dùng tính năng In Sổ.');
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  // Open editor for a specific row
  const handleStartEditRow = (row: typeof dailyData.rows[0]) => {
    setEditingDay({
      dateKey: row.dateKey,
      dayNumber: row.dayNumber,
      explanation: row.explanation,
      amount: row.amount,
      hasOriginal: row.originalAmount > 0,
      originalAmount: row.originalAmount,
      originalExplanation: row.originalExplanation
    });
  };

  // Save row override
  const handleSaveRowOverride = async () => {
    if (!editingDay) return;
    const newOverrides = {
      ...overrides,
      [editingDay.dateKey]: {
        explanation: editingDay.explanation.trim() || 'Nghỉ bán không phát sinh doanh thu',
        amount: Math.max(0, Number(editingDay.amount) || 0),
        isEdited: true
      }
    };
    setOverrides(newOverrides);
    setEditingDay(null);
    await saveS1aOverridesToFirestore(newOverrides, userContext);
  };

  // Reset row to automatic calculation
  const handleResetRowOverride = async (dateKey: string) => {
    const newOverrides = { ...overrides };
    delete newOverrides[dateKey];
    setOverrides(newOverrides);
    if (editingDay?.dateKey === dateKey) {
      setEditingDay(null);
    }
    await saveS1aOverridesToFirestore(newOverrides, userContext);
  };

  // Add manual entry (e.g., historical revenue before software usage)
  const handleAddManualEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseInt(manualFormAmount.replace(/\D/g, ''), 10);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ');
      return;
    }
    if (!manualFormDate) {
      alert('Vui lòng chọn ngày phát sinh');
      return;
    }

    const newEntry: S1aManualEntry = {
      id: `s1a_manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date: manualFormDate,
      explanation: manualFormExplanation.trim() || 'In ảnh và đóng khung ảnh',
      amount: cleanAmount,
      createdAt: new Date().toISOString()
    };

    const updatedList = [newEntry, ...manualEntries];
    setManualEntries(updatedList);
    setShowAddManualModal(false);
    setManualFormAmount('');

    await saveS1aManualEntriesToFirestore(updatedList, userContext);
  };

  // Delete a manual entry
  const handleDeleteManualEntry = async (entryId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa dòng dữ liệu bổ sung này không?')) return;
    const updatedList = manualEntries.filter(item => item.id !== entryId);
    setManualEntries(updatedList);
    await saveS1aManualEntriesToFirestore(updatedList, userContext);
  };

  // Filter manual entries for selected month for review list
  const currentMonthManualEntries = useMemo(() => {
    return manualEntries.filter(entry => {
      if (!entry.date) return false;
      const [y, m] = entry.date.split('-');
      return parseInt(y, 10) === selectedYear && parseInt(m, 10) === selectedMonth;
    });
  }, [manualEntries, selectedYear, selectedMonth]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar (No Print) */}
      <div className="no-print bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                Mẫu S1a-HKD
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Thông tư số 152/2025/TT-BTC
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-1">
              Sổ Theo Dõi Doanh Thu Bán Hàng & Dịch Vụ
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hệ thống quản lý và xuất sổ theo dõi doanh thu chuẩn Thông tư 152/2025/TT-BTC khổ in 20x30 cm
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Chèn thêm dữ liệu thủ công */}
            <button
              onClick={() => setShowAddManualModal(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
              title="Thêm doanh thu phát sinh thủ công hoặc ngày trước khi dùng phần mềm"
            >
              <PlusCircle className="w-4 h-4 text-emerald-200" />
              <span>Chèn doanh thu thủ công</span>
            </button>

            {/* In sổ */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
              title="In trực tiếp ra giấy khổ 20x30 cm hoặc A4"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>In Sổ S1a</span>
            </button>

            {/* Xuất file ảnh 20x30 cm */}
            <button
              onClick={handleExportImage}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/20 transition cursor-pointer disabled:opacity-60"
              title="Xuất file ảnh độ phân giải cao 300 DPI tỉ lệ 20x30 cm"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Đang xuất ảnh 300 DPI...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-slate-950" />
                  <span>Xuất ảnh in 20x30 cm</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters: Month & Year Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>Kỳ kê khai:</span>
            </div>

            {/* Month Selector */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m < 10 ? `0${m}` : m}
                </option>
              ))}
            </select>

            {/* Year Selector */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Summary Pill & Feedback Messages */}
          <div className="flex items-center gap-3">
            {exportSuccess && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Đã tải file ảnh sổ 20x30 cm thành công!
              </span>
            )}
            {exportError && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                {exportError}
              </span>
            )}
            <div className="text-right">
              <span className="text-[11px] text-slate-400 font-medium block">
                Tổng doanh thu tháng {selectedMonth}/{selectedYear}:
              </span>
              <span className="text-base font-black text-amber-600 font-mono">
                {formatCurrency(dailyData.monthlyTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Danh sách các khoản chèn thủ công trong tháng (nếu có) */}
        {currentMonthManualEntries.length > 0 && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Các khoản doanh thu bổ sung thủ công trong tháng ({currentMonthManualEntries.length}):
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentMonthManualEntries.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-xs shadow-2xs"
                >
                  <span className="font-mono font-bold text-slate-800">{formatDateVN(item.date)}:</span>
                  <span className="text-slate-600">{item.explanation}</span>
                  <span className="font-mono font-black text-emerald-600">+{formatCurrency(item.amount)}</span>
                  <button
                    onClick={() => handleDeleteManualEntry(item.id)}
                    className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    title="Xóa khoản này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: CHỈNH SỬA DÒNG DOANH THU TRONG NGÀY */}
      {editingDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Sửa dữ liệu ngày {editingDay.dayNumber}/{selectedMonth}/{selectedYear}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Chỉnh sửa diễn giải hoặc số tiền trên sổ S1a
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingDay(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Diễn giải:
                </label>
                <input
                  type="text"
                  value={editingDay.explanation}
                  onChange={(e) => setEditingDay({ ...editingDay, explanation: e.target.value })}
                  placeholder="In ảnh và đóng khung ảnh"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số tiền doanh thu (VNĐ):
                </label>
                <input
                  type="number"
                  value={editingDay.amount}
                  onChange={(e) => setEditingDay({ ...editingDay, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  min="0"
                  step="1000"
                />
              </div>

              {/* Thông tin số liệu tự động ban đầu */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <p>
                  <strong>Số liệu tự động từ hệ thống:</strong> {formatCurrency(editingDay.originalAmount)}
                </p>
                <p>
                  <strong>Diễn giải mặc định:</strong> {editingDay.originalExplanation}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => handleResetRowOverride(editingDay.dateKey)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 hover:text-rose-600 rounded-xl transition cursor-pointer"
                title="Khôi phục lại số liệu tự động từ hệ thống"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục mặc định</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDay(null)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveRowOverride}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-sm transition cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu thay đổi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BỔ SUNG DOANH THU THỦ CÔNG */}
      {showAddManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 no-print">
          <form
            onSubmit={handleAddManualEntrySubmit}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Bổ sung doanh thu thủ công
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Nhập ngày phát sinh trước thời điểm dùng app hoặc khoản thu ngoài
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddManualModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ngày ghi sổ:
                </label>
                <input
                  type="date"
                  value={manualFormDate}
                  onChange={(e) => setManualFormDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Diễn giải hoạt động:
                </label>
                <input
                  type="text"
                  value={manualFormExplanation}
                  onChange={(e) => setManualFormExplanation(e.target.value)}
                  placeholder="In ảnh và đóng khung ảnh"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số tiền doanh thu (VNĐ):
                </label>
                <input
                  type="text"
                  value={manualFormAmount}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setManualFormAmount(raw ? Number(raw).toLocaleString('vi-VN') : '');
                  }}
                  placeholder="Ví dụ: 1.500.000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddManualModal(false)}
                className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Thêm vào sổ S1a</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* S1A SHEET CONTAINER - STANDARD 20x30 CM CANVAS */}
      <div className="flex justify-center overflow-x-auto pb-10">
        <div
          ref={printAreaRef}
          className="s1a-sheet bg-white text-slate-900 p-8 sm:p-10 shadow-xl border border-slate-300 w-full max-w-[840px] font-sans printable-area transition-all"
          style={{
            minHeight: '1200px', // Chuẩn tỉ lệ khổ 20x30 (2:3)
            boxSizing: 'border-box'
          }}
        >
          {/* HEADER SECTION OF S1A FORM */}
          <div className="flex justify-between items-start gap-4 pb-4 border-b border-slate-900/40">
            {/* Left: Business Info */}
            <div className="text-xs space-y-1 max-w-[55%]">
              <p>
                <strong>Hộ, cá nhân kinh doanh:</strong>{' '}
                <span className="font-bold uppercase text-slate-950">{businessName}</span>
              </p>
              <p className="leading-snug">
                <strong>Địa chỉ / Địa điểm kinh doanh:</strong>{' '}
                <span className="text-slate-800">{businessAddress}</span>
              </p>
              <p>
                <strong>Mã số thuế:</strong>{' '}
                <span className="font-mono">{taxCode || '...........................................'}</span>
              </p>
            </div>

            {/* Right: Circular Form Specification Code */}
            <div className="text-right text-xs shrink-0">
              <p className="font-black text-sm tracking-wide text-slate-950">
                Mẫu số: S1a-HKD
              </p>
              <p className="text-[11px] text-slate-700 italic max-w-[260px] text-right mt-0.5 leading-tight">
                (Ban hành kèm theo Thông tư số 152/2025/TT-BTC ngày 31/12/2025 của Bộ Tài chính)
              </p>
            </div>
          </div>

          {/* MAIN TITLE */}
          <div className="text-center my-6 space-y-1">
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-wider text-slate-950">
              SỔ THEO DÕI DOANH THU BÁN HÀNG HOÁ, DỊCH VỤ
            </h1>
            <p className="text-xs font-bold text-slate-800">
              Kỳ kê khai: Tháng {selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth} năm {selectedYear}
            </p>
            <p className="text-[11px] text-slate-600 italic">
              Đơn vị tính: {currencyUnit}
            </p>
          </div>

          {/* S1A TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-900 text-xs">
              <thead>
                <tr className="bg-slate-100/90 text-center font-bold text-slate-950">
                  <th className="border border-slate-900 p-2 w-12">STT</th>
                  <th className="border border-slate-900 p-2 w-32">
                    Ngày, tháng ghi sổ
                  </th>
                  <th className="border border-slate-900 p-2">
                    Diễn giải
                  </th>
                  <th className="border border-slate-900 p-2 w-44 text-right">
                    Số tiền ({currencyUnit})
                  </th>
                </tr>
                <tr className="bg-slate-50 text-center text-[10px] italic text-slate-600 font-medium">
                  <td className="border border-slate-900 py-0.5"></td>
                  <td className="border border-slate-900 py-0.5">A</td>
                  <td className="border border-slate-900 py-0.5">B</td>
                  <td className="border border-slate-900 py-0.5 text-right pr-2">1</td>
                </tr>
              </thead>
              <tbody>
                {dailyData.rows.map((row, idx) => (
                  <tr
                    key={row.dayNumber}
                    className={`hover:bg-slate-50 transition-colors group ${
                      row.hasRevenue ? 'bg-amber-50/20' : ''
                    } ${row.isOverridden ? 'bg-blue-50/20' : ''}`}
                  >
                    {/* STT */}
                    <td className="border border-slate-900 p-1.5 text-center text-slate-600 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    {/* Cột A: Ngày tháng */}
                    <td className="border border-slate-900 p-1.5 text-center font-mono font-medium text-slate-800 text-[11px]">
                      {row.dateString}
                    </td>

                    {/* Cột B: Diễn giải */}
                    <td className="border border-slate-900 p-1.5 text-slate-900 relative">
                      <div className="flex items-center justify-between gap-1">
                        <span className={row.hasRevenue ? 'font-bold text-slate-900' : 'text-slate-500 italic'}>
                          {row.explanation}
                        </span>

                        {/* Edit pencil icon (only visible on screen hover) */}
                        <button
                          type="button"
                          onClick={() => handleStartEditRow(row)}
                          className="no-print opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-amber-700 transition"
                          title="Chỉnh sửa dòng này"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Cột 1: Số tiền */}
                    <td className="border border-slate-900 p-1.5 text-right font-mono font-bold text-slate-950">
                      {row.amount > 0 ? (
                        formatCurrency(row.amount)
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>
                  </tr>
                ))}

                {/* DÒNG TỔNG CỘNG */}
                <tr className="bg-slate-200/90 font-black text-slate-950">
                  <td
                    colSpan={3}
                    className="border border-slate-900 p-2 text-center uppercase tracking-wide text-xs"
                  >
                    Tổng cộng
                  </td>
                  <td className="border border-slate-900 p-2 text-right font-mono text-sm text-slate-950">
                    {formatCurrency(dailyData.monthlyTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* FOOTER & SIGNATURE SECTION */}
          <div className="mt-8 pt-4 flex justify-between items-start text-xs text-slate-900">
            {/* Left side: Date opened */}
            <div className="space-y-1">
              <p className="italic text-[11px] text-slate-700">
                - Sổ này có {dailyData.rows.length} dòng ghi chép tương ứng {dailyData.rows.length} ngày trong tháng.
              </p>
              <p className="italic text-[11px] text-slate-700">
                - Mở sổ ngày 01 tháng {selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth} năm {selectedYear}
              </p>
            </div>

            {/* Right side: Signature block */}
            <div className="text-center w-72 space-y-1">
              <p className="italic text-slate-700 text-[11px]">
                Ngày {daysInMonth} tháng {selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth} năm {selectedYear}
              </p>
              <p className="font-bold uppercase tracking-wider text-slate-950 leading-tight">
                NGƯỜI ĐẠI DIỆN HỘ KINH DOANH / CÁ NHÂN KINH DOANH
              </p>
              <p className="text-[10px] text-slate-600 italic">
                (Ký, ghi rõ họ tên, đóng dấu (nếu có))
              </p>
              
              {/* Generous signature space */}
              <div className="h-24"></div>

              <p className="font-bold text-slate-950 uppercase pt-2">
                {workshop.bankAccount?.accountHolder || 'Tiệm in 194'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
