import React, { useState, useMemo } from 'react';
import { Customer, Order, ProductCategory, WorkshopInfo, ArchivedDeletedCustomerRevenue } from '../types';
import { FavoriteCustomersSection } from './FavoriteCustomersSection';
import { formatCurrency, formatDateVN, getCustomerFacingName, isFreelanceWalkInPool, isRetailWalkInPool, isWalkInPoolCustomer } from '../utils/formatters';
import { calculateCustomerDebt } from '../utils/storage';
import {
  Users, Plus, Search, DollarSign, Phone, MapPin, CheckCircle2, History, Star,
  AlertCircle, Building2, Camera, User, Award, Crown, TrendingUp, Calendar,
  ArrowUpDown, Sparkles, Edit3, Printer, Eye, X, ExternalLink, Trash2
} from 'lucide-react';
import { MoneyInput } from './MoneyInput';

interface CustomerManagementViewProps {
  customers: Customer[];
  orders: Order[];
  workshop?: WorkshopInfo;
  onAddCustomer: (customer: Customer) => void;
  onUpdateCustomer: (customer: Customer) => void;
  onDeleteCustomer?: (customerId: string) => void;
  onRecordDebtPayment: (customerId: string, amount: number, note: string) => void;
  onViewCustomerOrders: (customerId: string) => void;
  onPrintOrder?: (order: Order) => void;
  archivedDeletedRevenues?: ArchivedDeletedCustomerRevenue[];
}

export const CustomerManagementView: React.FC<CustomerManagementViewProps> = ({
  customers,
  orders,
  workshop,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onRecordDebtPayment,
  onViewCustomerOrders,
  onPrintOrder,
  archivedDeletedRevenues = []
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'favorites'>('all');
  const [toastMsg, setToastMsg] = useState<string>('');
  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3500); };
  const [searchTerm, setSearchTerm] = useState('');
  const [debtFilter, setDebtFilter] = useState<'all' | 'hasDebt' | 'favorites'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProductCategory>('all');

  // Year tracking for "Tổng doanh thu năm" (Mặc định năm hiện tại 2026)
  const currentRealYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentRealYear);
  const [sortBy, setSortBy] = useState<'mvp' | 'debt' | 'orders' | 'name'>('mvp');

  // Modal create/edit customer
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCust, setEditingCust] = useState<Customer | null>(null);

  // Modal confirm delete customer
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // Modal viewing customer orders
  const [viewingOrdersCustomer, setViewingOrdersCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [studioName, setStudioName] = useState('');
  const [customerType, setCustomerType] = useState<ProductCategory>('GIÁ STUDIO');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [initialDebt, setInitialDebt] = useState<number>(0);
  const [initialYearlyRevenue, setInitialYearlyRevenue] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [customerError, setCustomerError] = useState('');

  // Pay Debt Modal
  const [payModalCustomer, setPayModalCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentNote, setPaymentNote] = useState('');

  // Quick Baseline Yearly Revenue Modal (nhập nhanh doanh thu trước khi dùng app)
  const [quickRevenueCustomer, setQuickRevenueCustomer] = useState<Customer | null>(null);
  const [quickRevenueAmount, setQuickRevenueAmount] = useState<number>(0);

  // Available years from orders & customer initial years & current year
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(currentRealYear);
    yearsSet.add(currentRealYear - 1);
    orders.forEach(o => {
      if (o.date) {
        const y = new Date(o.date).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    customers.forEach(c => {
      if (c.initialYearlyRevenues) {
        Object.keys(c.initialYearlyRevenues).forEach(yrStr => {
          const yr = Number(yrStr);
          if (!isNaN(yr)) yearsSet.add(yr);
        });
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [orders, customers, currentRealYear]);

  // Customers with computed live debt and yearly revenue (từ 01/01 đến 31/12 hàng năm)
  const customersWithMetrics = useMemo(() => {
    const startOfYear = `${selectedYear}-01-01`;
    const endOfYear = `${selectedYear}-12-31`;

    return customers.map(c => {
      const debt = calculateCustomerDebt(c.id, orders, customers);
      const customerOrders = orders.filter(o => o.customerId === c.id && o.status !== 'cancelled');
      const totalOrdersSpent = customerOrders.reduce((sum, o) => sum + (o.subtotal - (o.discount || 0)), 0);

      // Lọc các hóa đơn trong năm tài chính từ 01/01 đến 31/12
      const yearlyOrders = customerOrders.filter(o => {
        if (!o.date) return false;
        const oYear = new Date(o.date).getFullYear();
        return oYear === selectedYear || (o.date >= startOfYear && o.date <= endOfYear);
      });

      // Doanh thu từ hóa đơn phát sinh trong phần mềm trong năm
      const appOrdersRevenue = yearlyOrders.reduce((sum, o) => sum + (o.subtotal - (o.discount || 0)), 0);

      // Doanh thu ban đầu (nhập thủ công trước khi dùng app cho năm này)
      const manualBaseline = (c.initialYearlyRevenues && c.initialYearlyRevenues[selectedYear] !== undefined)
        ? (c.initialYearlyRevenues[selectedYear] || 0)
        : (c.initialYearlyRevenue || 0);

      // Tổng doanh thu năm: được cộng dồn (Doanh thu ban đầu nhập tay + mỗi hóa đơn phát sinh)
      const yearlyRevenue = manualBaseline + appOrdersRevenue;

      return {
        ...c,
        currentDebt: debt,
        ordersCount: customerOrders.length,
        totalSpent: totalOrdersSpent + manualBaseline,
        yearlyRevenue,
        appOrdersRevenue,
        manualBaseline,
        yearlyOrdersCount: yearlyOrders.length
      };
    });
  }, [customers, orders, selectedYear]);

  // Tìm mức doanh thu năm cao nhất để xác định khách hàng MVP
  const maxYearlyRevenue = useMemo(() => {
    if (customersWithMetrics.length === 0) return 0;
    return Math.max(0, ...customersWithMetrics.map(c => c.yearlyRevenue));
  }, [customersWithMetrics]);

  const mvpCustomer = useMemo(() => {
    if (maxYearlyRevenue <= 0) return null;
    return customersWithMetrics.find(c => c.yearlyRevenue === maxYearlyRevenue) || null;
  }, [customersWithMetrics, maxYearlyRevenue]);

  // Doanh thu bảo lưu từ các khách hàng đã từng xóa thủ công trong năm được chọn
  const totalArchivedYearlyRevenue = useMemo(() => {
    if (!archivedDeletedRevenues || archivedDeletedRevenues.length === 0) return 0;
    return archivedDeletedRevenues.reduce((sum, r) => {
      const yrData = r.yearlyRevenues?.[selectedYear];
      return sum + (yrData?.total || 0);
    }, 0);
  }, [archivedDeletedRevenues, selectedYear]);

  // Tổng doanh thu năm của tất cả khách hàng (gồm khách hiện tại + doanh thu đã bảo lưu của khách đã xóa)
  const totalYearlyRevenueAll = useMemo(() => {
    const activeTotal = customersWithMetrics.reduce((sum, c) => sum + c.yearlyRevenue, 0);
    return activeTotal + totalArchivedYearlyRevenue;
  }, [customersWithMetrics, totalArchivedYearlyRevenue]);

  const totalAllDebt = useMemo(() => {
    return customersWithMetrics.reduce((sum, c) => sum + c.currentDebt, 0);
  }, [customersWithMetrics]);

  // Filtered and Sorted Customers
  const filteredCustomers = useMemo(() => {
    let result = customersWithMetrics.filter(c => {
      if (debtFilter === 'hasDebt' && c.currentDebt <= 0) return false;
      if (debtFilter === 'favorites' && !c.isFavorite) return false;
      if (categoryFilter !== 'all' && c.customerType !== categoryFilter) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.studioName && c.studioName.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
      );
    });

    if (sortBy === 'mvp') {
      result.sort((a, b) => b.yearlyRevenue - a.yearlyRevenue || b.totalSpent - a.totalSpent);
    } else if (sortBy === 'debt') {
      result.sort((a, b) => b.currentDebt - a.currentDebt);
    } else if (sortBy === 'orders') {
      result.sort((a, b) => b.ordersCount - a.ordersCount);
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    }

    return result;
  }, [customersWithMetrics, debtFilter, categoryFilter, searchTerm, sortBy]);

    const handleToggleFavorite = (cust: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextVal = !cust.isFavorite;
    onUpdateCustomer({ ...cust, isFavorite: nextVal });
    showToast(nextVal ? `⭐ Đã thêm "${cust.name}" vào Khách Yêu Thích!` : `Đã bỏ gắn sao "${cust.name}"`);
  };

  const handleOpenAdd = () => {
    setEditingCust(null);
    setName('');
    setStudioName('');
    setCustomerType('GIÁ STUDIO');
    setPhone('');
    setAddress('');
    setInitialDebt(0);
    setInitialYearlyRevenue(0);
    setNotes('');
    setIsFavorite(false);
    setCustomerError('');
    setIsCustomerModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCust(c);
    setName(c.name);
    setStudioName(c.studioName || '');
    setCustomerType(c.customerType || 'GIÁ STUDIO');
    setPhone(c.phone);
    setAddress(c.address || '');
    setInitialDebt(c.initialDebt || 0);
    const curInitialYearly = (c.initialYearlyRevenues && c.initialYearlyRevenues[selectedYear] !== undefined)
      ? c.initialYearlyRevenues[selectedYear]
      : (c.initialYearlyRevenue || 0);
    setInitialYearlyRevenue(curInitialYearly);
    setNotes(c.notes || '');
    setIsFavorite(c.isFavorite || false);
    setCustomerError('');
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = () => {
    setCustomerError('');
    if (!name.trim()) {
      setCustomerError('Vui lòng nhập tên khách hàng hoặc Studio!');
      return;
    }

    if (editingCust) {
      const updatedYearlyRevenues = {
        ...(editingCust.initialYearlyRevenues || {}),
        [selectedYear]: Number(initialYearlyRevenue) || 0
      };
      onUpdateCustomer({
        ...editingCust,
        name: name.trim(),
        studioName: studioName.trim() || undefined,
        customerType,
        phone: phone.trim(),
        address: address.trim() || undefined,
        initialDebt: Number(initialDebt) || 0,
        initialYearlyRevenue: Number(initialYearlyRevenue) || 0,
        initialYearlyRevenues: updatedYearlyRevenues,
        notes: notes.trim() || undefined,
        isFavorite: isFavorite
      });
    } else {
      onAddCustomer({
        id: `c-${Date.now()}`,
        name: name.trim(),
        studioName: studioName.trim() || undefined,
        customerType,
        phone: phone.trim(),
        address: address.trim() || undefined,
        initialDebt: Number(initialDebt) || 0,
        initialYearlyRevenue: Number(initialYearlyRevenue) || 0,
        initialYearlyRevenues: { [selectedYear]: Number(initialYearlyRevenue) || 0 },
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString()
      });
    }

    setIsCustomerModalOpen(false);
  };

  // Quick Baseline Yearly Revenue Handlers (cho phép nhập thủ công doanh thu trước khi dùng app)
  const handleOpenQuickRevenue = (c: Customer) => {
    const curInitialYearly = (c.initialYearlyRevenues && c.initialYearlyRevenues[selectedYear] !== undefined)
      ? c.initialYearlyRevenues[selectedYear]
      : (c.initialYearlyRevenue || 0);
    setQuickRevenueCustomer(c);
    setQuickRevenueAmount(curInitialYearly);
  };

  const handleSaveQuickRevenue = () => {
    if (!quickRevenueCustomer) return;
    const updatedYearlyRevenues = {
      ...(quickRevenueCustomer.initialYearlyRevenues || {}),
      [selectedYear]: Number(quickRevenueAmount) || 0
    };
    onUpdateCustomer({
      ...quickRevenueCustomer,
      initialYearlyRevenue: Number(quickRevenueAmount) || 0,
      initialYearlyRevenues: updatedYearlyRevenues
    });
    setQuickRevenueCustomer(null);
  };

  const handleOpenPayDebt = (c: Customer) => {
    const debt = calculateCustomerDebt(c.id, orders, customers);
    setPayModalCustomer(c);
    setPaymentAmount(debt);
    setPaymentNote(`Khách thanh toán tiền nợ in ảnh`);
  };

  const handleConfirmPayDebt = () => {
    if (!payModalCustomer || paymentAmount <= 0) return;
    onRecordDebtPayment(payModalCustomer.id, paymentAmount, paymentNote);
    setPayModalCustomer(null);
  };

  // Editing customer's yearly revenue preview
  const editingCustMetrics = useMemo(() => {
    if (!editingCust) return null;
    return customersWithMetrics.find(c => c.id === editingCust.id) || null;
  }, [editingCust, customersWithMetrics]);

  // Orders belonging to currently viewed customer
  const viewingCustomerOrders = useMemo(() => {
    if (!viewingOrdersCustomer) return [];
    const isFlWalkIn = isFreelanceWalkInPool(viewingOrdersCustomer);
    const isKlWalkIn = isRetailWalkInPool(viewingOrdersCustomer);

    return orders
      .filter(o => {
        if (o.customerId === viewingOrdersCustomer.id) return true;
        if (isKlWalkIn && (
          o.customerName.toLowerCase().startsWith('khách lẻ') ||
          o.customerName.toLowerCase().startsWith('khach le')
        )) {
          return true;
        }
        if (isFlWalkIn && (
          o.customerName.toLowerCase().startsWith('freelance') ||
          o.customerName.toLowerCase().startsWith('frelance') ||
          o.customerName.toLowerCase().startsWith('tổng hợp freelance')
        )) {
          return true;
        }
        return false;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.createdAt.localeCompare(a.createdAt));
  }, [viewingOrdersCustomer, orders]);

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600" />
            <span>Quản Lý Khách Hàng, Studio & Sổ Nợ Tiệm In 194</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi phân loại giá, công nợ và <strong>Tổng doanh thu năm</strong> (tích lũy từ 01/01 đến 31/12) để tìm khách hàng <strong>MVP</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* MVP Highlight Pill */}
          {mvpCustomer && (
            <div className="px-3 py-1.5 bg-gradient-to-r from-amber-500/10 via-yellow-500/20 to-amber-500/10 border border-amber-400 rounded-xl text-xs font-bold text-amber-950 flex items-center gap-1.5 shadow-2xs">
              <Crown className="w-4 h-4 text-amber-600 fill-amber-400 shrink-0" />
              <span>MVP Năm {selectedYear}:</span>
              <span className="font-extrabold text-amber-900">{mvpCustomer.studioName || mvpCustomer.name}</span>
              <span className="font-mono text-amber-800 font-black">({formatCurrency(mvpCustomer.yearlyRevenue)})</span>
            </div>
          )}

          {/* Total Debt Pill */}
          <div className="px-3 py-1.5 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-900 flex items-center gap-1.5">
            <span>Tổng nợ tồn:</span>
            <span className="font-mono text-rose-700 font-extrabold">{formatCurrency(totalAllDebt)}</span>
          </div>

          {/* Total Yearly Revenue Pill */}
          <div
            className="px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold text-amber-950 flex items-center gap-1.5 shadow-2xs"
            title={totalArchivedYearlyRevenue > 0 ? `Bao gồm ${formatCurrency(totalArchivedYearlyRevenue)} doanh thu bảo lưu từ khách hàng đã xóa` : undefined}
          >
            <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-slate-700">Tổng DT năm {selectedYear}:</span>
            <span className="font-mono text-amber-700 font-bold">{formatCurrency(totalYearlyRevenueAll)}</span>
            {totalArchivedYearlyRevenue > 0 && (
              <span className="text-[10px] text-amber-900 bg-amber-200/80 px-1.5 py-0.5 rounded-md font-semibold">
                (Đã gồm DT khách xóa)
              </span>
            )}
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Thêm Khách Hàng / Studio
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-amber-300 border border-amber-400 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Sub Navigation: Tất Cả vs Khách Yêu Thích */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl w-fit border border-slate-200 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveSubTab("all")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubTab === "all"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Users className="w-4 h-4 text-slate-700" />
          <span>Tất Cả Khách & Sổ Nợ</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 text-slate-800 font-bold border border-slate-200">
            {customers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("favorites")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubTab === "favorites"
              ? "bg-amber-500 text-slate-950 shadow-md font-black"
              : "text-slate-700 hover:text-amber-900 hover:bg-amber-100/60"
          }`}
        >
          <Star className={`w-4 h-4 ${activeSubTab === "favorites" ? "fill-slate-950 text-slate-950" : "text-amber-500 fill-amber-400"}`} />
          <span>Mục Khách Yêu Thích</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
            activeSubTab === "favorites" ? "bg-slate-950 text-amber-300" : "bg-amber-100 text-amber-900 border border-amber-300"
          }`}>
            {customers.filter(c => c.isFavorite).length}
          </span>
        </button>
      </div>

      {activeSubTab === "favorites" ? (
        <FavoriteCustomersSection
          customers={customers}
          orders={orders}
          onUpdateCustomer={onUpdateCustomer}
          onViewCustomerOrders={onViewCustomerOrders}
          onSwitchToAllCustomers={() => setActiveSubTab("all")}
          workshopName={workshop?.name}
        />
      ) : (
        <>
      {/* Filter & Sort Toolbar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên khách, tên Studio, số điện thoại, địa chỉ..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex gap-2 flex-wrap items-center">
          {/* Year Selector */}
          <div className="flex items-center gap-1 bg-amber-50/70 border border-amber-300 rounded-xl px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span className="text-xs font-bold text-amber-900 shrink-0">Năm:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-extrabold text-amber-950 outline-hidden cursor-pointer"
              title="Chọn năm để tính Tổng Doanh Thu Năm (từ 01/01 đến 31/12)"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr} className="bg-white text-slate-900 font-bold">
                  {yr} {yr === currentRealYear ? '(Hiện tại)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-600 shrink-0">Xếp theo:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-900 outline-hidden cursor-pointer"
            >
              <option value="mvp">👑 Doanh thu năm (MVP cao nhất)</option>
              <option value="debt">💰 Nợ hiện tại cao nhất</option>
              <option value="orders">📦 Số đơn hàng nhiều nhất</option>
              <option value="name">🔤 Tên khách hàng (A-Z)</option>
            </select>
          </div>

          {/* Price Tier Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
          >
            <option value="all">Tất cả bảng giá</option>
            <option value="GIÁ STUDIO">🏢 GIÁ STUDIO</option>
            <option value="Freelance">📸 Freelance</option>
            <option value="Khách Lẻ">👤 Khách Lẻ</option>
          </select>

          {/* Debt Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setDebtFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                debtFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({customers.length})
            </button>
            <button
              onClick={() => setDebtFilter('hasDebt')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                debtFilter === 'hasDebt' ? 'bg-red-600 text-white shadow-2xs' : 'text-red-700 hover:text-red-900'
              }`}
            >
              Còn nợ ({customersWithMetrics.filter(c => c.currentDebt > 0).length})
            </button>
          </div>
        </div>
      </div>

      {/* Customers List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map(cust => {
          const isMvp = cust.yearlyRevenue > 0 && cust.yearlyRevenue === maxYearlyRevenue;
          const rankedCustomers = customersWithMetrics.filter(c => c.yearlyRevenue > 0).sort((a, b) => b.yearlyRevenue - a.yearlyRevenue);
          const yearlyRank = rankedCustomers.findIndex(c => c.id === cust.id) + 1;

          return (
            <div
              key={cust.id}
              className={`rounded-2xl p-4 border transition-all flex flex-col justify-between relative ${
                isMvp
                  ? 'bg-white border-amber-400 shadow-xs ring-1 ring-amber-400/30'
                  : 'bg-white border-slate-200 shadow-xs hover:border-amber-300'
              }`}
            >
              <div>
                {/* Header: Customer Name, Tier Badge, Current Debt */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(cust, e)}
                        className="p-1 rounded-lg hover:bg-amber-100/70 transition cursor-pointer shrink-0"
                        title={cust.isFavorite ? "Bỏ gắn sao khách yêu thích" : "Gắn sao ⭐ Khách Hàng Yêu Thích"}
                      >
                        <Star className={`w-4 h-4 transition ${
                          cust.isFavorite
                            ? "text-amber-500 fill-amber-400 drop-shadow-xs"
                            : "text-slate-300 hover:text-amber-400"
                        }`} />
                      </button>
                      <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1">
                        <span>{cust.name}</span>
                        {isMvp && (
                          <span title="Khách hàng MVP có doanh thu cao nhất năm" className="cursor-help">
                            👑
                          </span>
                        )}
                      </h3>

                      {cust.customerType === 'GIÁ STUDIO' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Building2 className="w-2.5 h-2.5" /> STUDIO
                        </span>
                      ) : cust.customerType === 'Freelance' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Camera className="w-2.5 h-2.5" /> Freelance
                        </span>
                      ) : cust.customerType === 'Khách Lẻ' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <User className="w-2.5 h-2.5" /> Khách Lẻ
                        </span>
                      ) : null}
                    </div>

                    {cust.studioName && (
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md inline-block mt-1">
                        {cust.studioName}
                      </span>
                    )}

                    {/* Ghi chú tệp khách vãng lai (CHỈ hiển thị cho duy nhất "Tổng hợp Freelance Doanh số ít" và "Khách Lẻ") */}
                    {isWalkInPoolCustomer(cust) && (
                      <div className="mt-2 p-2 rounded-xl bg-amber-50/70 border border-amber-200/90 text-[11px] text-amber-950">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <Users className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Tệp khách vãng lai (không tạo khách mới)</span>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">
                          💡 Mỗi đơn ghi tên riêng từng người (VD: Anh Tuấn, Chị Mai). Sổ nợ & hóa đơn nội bộ hiện rõ tên riêng, khi chụp gửi khách tự động ẩn 2 từ "{cust.customerType}".
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Nợ hiện tại</span>
                    <span className={`font-mono text-sm font-extrabold ${
                      cust.currentDebt > 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}>
                      {formatCurrency(cust.currentDebt)}
                    </span>
                  </div>
                </div>

                {/* TRƯỜNG THÔNG TIN: TỔNG DOANH THU NĂM (cỡ chữ tương đương các trường bên cạnh, chữ màu vàng, nền hài hòa không bôi đen) */}
                <div className="mt-2.5 p-2.5 bg-amber-50/50 rounded-xl border border-amber-200/70 text-xs">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="font-semibold text-slate-700">Tổng doanh thu năm {selectedYear}:</span>
                      {isMvp && (
                        <span className="px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          👑 MVP
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Số tiền màu vàng (amber-600), font-mono, cỡ chữ tương đương trường nợ */}
                      <span className="font-mono text-xs sm:text-sm font-bold text-amber-600">
                        {formatCurrency(cust.yearlyRevenue)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenQuickRevenue(cust)}
                        className="p-1 rounded-md text-slate-400 hover:text-amber-700 hover:bg-amber-100/60 transition cursor-pointer"
                        title="Nhập / Điều chỉnh doanh thu ban đầu (trước khi dùng app)"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Chi tiết phụ: doanh thu đầu kỳ nhập tay + doanh thu từ hóa đơn */}
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500 pt-1 border-t border-amber-100">
                    <span className="truncate">
                      {cust.manualBaseline > 0 ? (
                        <span>
                          Đầu kỳ: <strong className="text-slate-700 font-mono">{formatCurrency(cust.manualBaseline)}</strong> + Hóa đơn: <strong className="text-slate-700 font-mono">{formatCurrency(cust.appOrdersRevenue)}</strong>
                        </span>
                      ) : (
                        <span>
                          {cust.yearlyOrdersCount > 0 ? `${cust.yearlyOrdersCount} hóa đơn phát sinh` : 'Chưa có hóa đơn trên app'}
                        </span>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenQuickRevenue(cust)}
                      className="text-[10px] text-amber-700 hover:underline font-semibold shrink-0 ml-1 cursor-pointer"
                    >
                      {cust.manualBaseline > 0 ? 'Sửa DT đầu kỳ' : '+ Nhập DT đầu kỳ'}
                    </button>
                  </div>
                </div>

                {/* Contact info & Total All-Time Orders */}
                <div className="space-y-1 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                  <p className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono">{cust.phone || 'Chưa có SĐT'}</span>
                  </p>
                  {cust.address && (
                    <p className="flex items-center gap-1.5 text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{cust.address}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                    <span>
                      Tổng tất cả thời gian: <strong className="text-slate-700">{cust.ordersCount} đơn</strong>
                    </span>
                    <span>
                      Tổng chi tiêu:{' '}
                      <strong className="text-slate-800 font-mono">{formatCurrency(cust.totalSpent)}</strong>
                    </span>
                  </p>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(cust)}
                    className="text-xs text-slate-500 hover:text-slate-900 font-semibold cursor-pointer"
                  >
                    Sửa thông tin
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    onClick={() => setViewingOrdersCustomer(cust)}
                    className="text-xs text-amber-700 hover:text-amber-800 font-semibold cursor-pointer flex items-center gap-1"
                    title="Xem chi tiết các đơn hàng của khách này"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem đơn ({cust.ordersCount})</span>
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => setCustomerToDelete(cust)}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold cursor-pointer flex items-center gap-1"
                    title="Xóa khách hàng này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa</span>
                  </button>
                </div>

                {cust.currentDebt > 0 ? (
                  <button
                    onClick={() => handleOpenPayDebt(cust)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    Thu nợ
                  </button>
                ) : (
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Không có nợ
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredCustomers.length === 0 && (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-700">Không tìm thấy khách hàng nào phù hợp bộ lọc.</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setDebtFilter('all');
              setCategoryFilter('all');
            }}
            className="mt-2 text-xs text-amber-600 font-bold hover:underline cursor-pointer"
          >
            Xóa bộ lọc tìm kiếm
          </button>
        </div>
      )}

        </>
      )}

      {/* Pay Debt Modal */}
      {payModalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-300" />
                Thu Nợ Khách Hàng
              </h3>
              <button onClick={() => setPayModalCustomer(null)} className="text-emerald-200 hover:text-white">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs text-slate-500">Khách hàng / Studio:</p>
                <p className="font-bold text-sm text-slate-900">{payModalCustomer.name}</p>
              </div>
              <div className="bg-red-50 p-2.5 rounded-xl border border-red-200 text-xs">
                <span className="text-slate-600">Số tiền nợ cũ hiện tại: </span>
                <span className="font-mono font-bold text-red-700 text-sm">
                  {formatCurrency(calculateCustomerDebt(payModalCustomer.id, orders, customers))}
                </span>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số tiền khách thanh toán (VNĐ) *
                </label>
                <MoneyInput
                  value={paymentAmount}
                  onChange={(val) => setPaymentAmount(val)}
                  placeholder="0"
                  className="px-3 py-2 border border-slate-300 rounded-xl text-base font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 bg-emerald-50/30"
                  showWords={true}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ghi chú thu nợ
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Studio thanh toán qua chuyển khoản / tiền mặt..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setPayModalCustomer(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmPayDebt}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs cursor-pointer"
              >
                Xác Nhận Đã Thu Tiền
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingCust ? 'Cập Nhật Thông Tin Khách Hàng' : 'Thêm Khách Hàng Mới'}
              </h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="p-4 space-y-3">
              {customerError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
                  {customerError}
                </div>
              )}

              {/* Show Yearly Revenue Stats in Edit Modal if editing */}
              {editingCustMetrics && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-800 font-bold flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-amber-500" />
                      Doanh thu năm {selectedYear}:
                    </span>
                    {editingCustMetrics.yearlyRevenue === maxYearlyRevenue && maxYearlyRevenue > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-200 text-amber-950">
                        👑 MVP Năm {selectedYear}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-mono text-sm font-bold text-amber-600">
                      {formatCurrency(editingCustMetrics.yearlyRevenue)}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {editingCustMetrics.yearlyOrdersCount} hóa đơn phát sinh
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Bao gồm {formatCurrency(editingCustMetrics.manualBaseline)} đầu kỳ + {formatCurrency(editingCustMetrics.appOrdersRevenue)} từ đơn hàng
                  </p>
                </div>
              )}

              {/* Toggle Khách Hàng Yêu Thích ⭐ */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-amber-200 bg-amber-50/60 cursor-pointer hover:bg-amber-100/60 transition">
                <input
                  type="checkbox"
                  checked={isFavorite}
                  onChange={(e) => setIsFavorite(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                />
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Star className={`w-4 h-4 ${isFavorite ? "text-amber-500 fill-amber-400" : "text-slate-400"}`} />
                  <span>Đánh dấu là Khách Hàng Yêu Thích ⭐ (Tự động tạo bảng theo dõi công nợ tháng)</span>
                </div>
              </label>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phân loại đối tượng & Bảng giá áp dụng *
                </label>
                <select
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value as ProductCategory)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-amber-50/40 outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  <option value="GIÁ STUDIO">🏢 1. GIÁ STUDIO (Studio áo cưới & Đại lý sỉ)</option>
                  <option value="Freelance">📸 2. Freelance (Thợ chụp ảnh tự do & Quay phim)</option>
                  <option value="Khách Lẻ">👤 3. Khách Lẻ (Khách lẻ in gia đình & Tiệc)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên Khách Hàng *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Studio Áo Cưới Lan Hương"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên Studio / Thương hiệu
                </label>
                <input
                  type="text"
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  placeholder="Lan Huong Wedding"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số Điện Thoại
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0988 123 456"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Địa Chỉ Giao Nhận Ảnh
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Số nhà, đường phố..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số Nợ Ban Đầu (VNĐ)
                </label>
                <MoneyInput
                  value={initialDebt}
                  onChange={(val) => setInitialDebt(val)}
                  placeholder="0"
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500"
                  showWords={true}
                />
              </div>
              <div className="p-3 bg-amber-50/50 border border-amber-200/80 rounded-xl space-y-1">
                <label className="block text-xs font-bold text-amber-950">
                  Doanh Thu Đầu Kỳ Năm {selectedYear} (VNĐ)
                </label>
                <MoneyInput
                  value={initialYearlyRevenue}
                  onChange={(val) => setInitialYearlyRevenue(val)}
                  placeholder="0"
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-amber-700 bg-white focus:ring-2 focus:ring-amber-500"
                  showWords={true}
                />
                <p className="text-[10px] text-slate-500">
                  Dành cho khách đã gắn bó với tiệm trước khi tạo app. Số tiền này sẽ tự động cộng dồn với các hóa đơn mới trong năm {selectedYear}.
                </p>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center gap-2">
              {editingCust ? (
                <button
                  type="button"
                  onClick={() => {
                    const toDel = editingCust;
                    setIsCustomerModalOpen(false);
                    setCustomerToDelete(toDel);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer flex items-center gap-1 border border-red-200 transition"
                  title="Xóa khách hàng này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa khách hàng</span>
                </button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveCustomer}
                  className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs cursor-pointer"
                >
                  Lưu Thông Tin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Baseline Yearly Revenue Modal */}
      {quickRevenueCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in">
            <div className="p-4 bg-amber-500 text-slate-950 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <Award className="w-4 h-4 text-slate-950" />
                <span>Nhập Doanh Thu Đầu Kỳ Năm {selectedYear}</span>
              </h3>
              <button
                type="button"
                onClick={() => setQuickRevenueCustomer(null)}
                className="text-slate-800 hover:text-black font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs text-slate-500">Khách hàng / Studio:</p>
                <p className="font-bold text-sm text-slate-900">{quickRevenueCustomer.name}</p>
                {quickRevenueCustomer.studioName && (
                  <p className="text-xs text-slate-600 font-medium">{quickRevenueCustomer.studioName}</p>
                )}
              </div>

              <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-slate-600">
                <p>
                  💡 Khách đã đồng hành cùng tiệm in trước khi tạo app. Bạn có thể nhập số tiền khách đã in trong năm <strong>{selectedYear}</strong> vào đây.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Doanh thu đầu kỳ trước khi dùng app (VNĐ)
                </label>
                <MoneyInput
                  value={quickRevenueAmount}
                  onChange={(val) => setQuickRevenueAmount(val)}
                  placeholder="0"
                  className="px-3 py-2 border border-slate-300 rounded-xl text-base font-bold text-amber-700 focus:ring-2 focus:ring-amber-500 bg-amber-50/30"
                  showWords={true}
                />
              </div>

              {/* Preview total */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Hóa đơn phát sinh trên app:</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {formatCurrency(
                      orders
                        .filter(o => o.customerId === quickRevenueCustomer.id && o.status !== 'cancelled' && (new Date(o.date).getFullYear() === selectedYear))
                        .reduce((sum, o) => sum + (o.subtotal - (o.discount || 0)), 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-slate-800">
                  <span>Tổng doanh thu năm {selectedYear}:</span>
                  <span className="font-mono text-amber-600 font-bold">
                    {formatCurrency(
                      quickRevenueAmount +
                      orders
                        .filter(o => o.customerId === quickRevenueCustomer.id && o.status !== 'cancelled' && (new Date(o.date).getFullYear() === selectedYear))
                        .reduce((sum, o) => sum + (o.subtotal - (o.discount || 0)), 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuickRevenueCustomer(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveQuickRevenue}
                className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs cursor-pointer"
              >
                Lưu Doanh Thu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xem Danh Sách Đơn Hàng Của Khách Hàng (Đặc biệt cho Khách Lẻ & Freelance) */}
      {viewingOrdersCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between gap-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                  {viewingOrdersCustomer.customerType === 'Freelance' ? <Camera className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-sm sm:text-base">
                      Sổ Đơn & Chi Tiết: {viewingOrdersCustomer.name}
                    </h3>
                    {viewingOrdersCustomer.studioName && (
                      <span className="text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md">
                        {viewingOrdersCustomer.studioName}
                      </span>
                    )}
                    {isWalkInPoolCustomer(viewingOrdersCustomer) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                        👥 Tệp Vãng Lai
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tổng: <strong className="text-slate-200">{viewingCustomerOrders.length} đơn</strong> • Chi tiêu:{' '}
                    <strong className="text-amber-300 font-mono">
                      {formatCurrency(viewingCustomerOrders.reduce((sum, o) => sum + (o.subtotal - (o.discount || 0)), 0))}
                    </strong> • Nợ hiện tại:{' '}
                    <strong className="text-red-400 font-mono">
                      {formatCurrency(calculateCustomerDebt(viewingOrdersCustomer.id, orders, customers))}
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingOrdersCustomer(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Explanatory Notice for Walk-in Categories */}
            {isWalkInPoolCustomer(viewingOrdersCustomer) && (
              <div className="p-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-950 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Cơ chế quản lý khách vãng lai:</strong> Mọi khách lẻ và freelance ghé tiệm 1-2 lần đều được lưu tập trung vào mục này mà không cần tạo khách mới. Khi lập hóa đơn, tên riêng (VD: <em>Anh Tuấn, Chị Mai</em>) được ghi lại: <strong>nội bộ lưu rõ "Khách Lẻ/Freelance - Tên riêng"</strong>, nhưng <strong>khi chụp ảnh gửi khách đã tự động ẩn 2 từ này</strong>.
                </div>
              </div>
            )}

            {/* Orders Table List */}
            <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100">
              {viewingCustomerOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 bg-slate-50 text-[11px] uppercase font-bold">
                        <th className="py-2.5 px-3">Mã đơn & Ngày</th>
                        <th className="py-2.5 px-3">Tên lưu nội bộ</th>
                        <th className="py-2.5 px-3">Tên khi chụp gửi khách</th>
                        <th className="py-2.5 px-3">Sản phẩm</th>
                        <th className="py-2.5 px-3 text-right">Tổng tiền</th>
                        <th className="py-2.5 px-3 text-right">Còn nợ</th>
                        <th className="py-2.5 px-3 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingCustomerOrders.map((ord) => {
                        const facingName = getCustomerFacingName(ord);
                        return (
                          <tr key={ord.id} className="hover:bg-amber-50/40 transition">
                            <td className="py-3 px-3">
                              <span className="font-mono font-bold text-slate-900 block">
                                {ord.orderNumber}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {formatDateVN(ord.date)}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-bold text-slate-900 block">
                                {ord.customerName}
                              </span>
                              {ord.customerPhone && (
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {ord.customerPhone}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs">
                                <span>{facingName}</span>
                              </span>
                              <span className="block text-[10px] text-emerald-600 mt-0.5">
                                (Đã ẩn Khách Lẻ/Freelance)
                              </span>
                            </td>
                            <td className="py-3 px-3 max-w-[200px]">
                              <div className="truncate text-slate-700">
                                {ord.items.map(it => `${it.productCode} (${it.size}) x${it.quantity}`).join(', ')}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(ord.subtotal - (ord.discount || 0))}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold">
                              {ord.totalDue > 0 ? (
                                <span className="text-red-600">{formatCurrency(ord.totalDue)}</span>
                              ) : (
                                <span className="text-emerald-600">Đã xong</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {onPrintOrder && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingOrdersCustomer(null);
                                    onPrintOrder(ord);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] shadow-2xs transition cursor-pointer"
                                  title="Mở cửa sổ in phiếu & chụp ảnh gửi khách"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>In / Chụp ảnh</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Chưa có đơn hàng nào thuộc khách này.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const targetId = viewingOrdersCustomer.id;
                  setViewingOrdersCustomer(null);
                  onViewCustomerOrders(targetId);
                }}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Xem trên Sổ Đơn Hàng</span>
              </button>

              <button
                type="button"
                onClick={() => setViewingOrdersCustomer(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Xóa Khách Hàng */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-red-50 border-b border-red-100 flex items-center gap-3">
              <div className="p-2.5 bg-red-100 text-red-600 rounded-xl shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-red-950">Xác Nhận Xóa Khách Hàng</h3>
                <p className="text-xs text-red-700 mt-0.5">Xóa khách hàng khỏi danh sách</p>
              </div>
            </div>
            <div className="p-4 text-xs text-slate-700 space-y-2">
              <p>Bạn có chắc chắn muốn xóa khách hàng sau không?</p>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <p className="font-bold text-slate-900 text-sm">{customerToDelete.name}</p>
                {customerToDelete.studioName && (
                  <p className="text-slate-500 text-xs">Studio: {customerToDelete.studioName}</p>
                )}
                {customerToDelete.phone && (
                  <p className="text-slate-500 font-mono text-[11px]">SĐT: {customerToDelete.phone}</p>
                )}
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed">
                🛡️ <strong>Bảo lưu doanh thu:</strong> Khi xóa khách hàng này, <strong>toàn bộ Tổng doanh thu năm</strong> đã phát sinh của khách sẽ được hệ thống <strong>bảo lưu vĩnh viễn</strong> trong tổng doanh thu của tiệm.
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer font-semibold transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteCustomer && customerToDelete) {
                    onDeleteCustomer(customerToDelete.id);
                    showToast(`Đã xóa khách hàng "${customerToDelete.name}" thành công`);
                  }
                  setCustomerToDelete(null);
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa Khách Hàng</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
