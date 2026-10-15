import React, { useState, useMemo } from "react";
import { Customer, Order } from "../types";
import { formatCurrency } from "../utils/formatters";
import {
  Star,
  Calendar,
  RotateCcw,
  Camera,
  Copy,
  Edit3,
  Check,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Phone,
  Building2,
  DollarSign,
  CheckCircle2,
  X,
  Image,
  Download,
  ExternalLink
} from "lucide-react";
import { MoneyInput } from "./MoneyInput";
import {
  downloadFavoriteCustomerTableJPG,
  generateFavoriteCustomerCanvas
} from "../utils/exportFavoriteCustomerTableCanvas";

interface FavoriteCustomersSectionProps {
  customers: Customer[];
  orders: Order[];
  onUpdateCustomer: (customer: Customer) => void;
  onViewCustomerOrders: (customerId: string) => void;
  onSwitchToAllCustomers: () => void;
  workshopName?: string;
}

export const FavoriteCustomersSection: React.FC<FavoriteCustomersSectionProps> = ({
  customers,
  orders,
  onUpdateCustomer,
  onViewCustomerOrders,
  onSwitchToAllCustomers,
  workshopName = "Tiệm In 194"
}) => {
  // Current month default: "YYYY-MM"
  const now = new Date();
  const currentMonthDefault = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthDefault);

  // Modals & toast state
  const [toastMessage, setToastMessage] = useState<string>("");
  const [isResetMonthModalOpen, setIsResetMonthModalOpen] = useState(false);
  const [editingSettlementCustomer, setEditingSettlementCustomer] = useState<Customer | null>(null);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editPreviousDebt, setEditPreviousDebt] = useState<number>(0);
  const [editManualTotal, setEditManualTotal] = useState<number>(0);
  const [useManualTotal, setUseManualTotal] = useState<boolean>(false);

  // Copy image modal & clipboard state
  const [copyImageModal, setCopyImageModal] = useState<{
    isOpen: boolean;
    customerName: string;
    phone?: string;
    imageUrl: string;
    blob: Blob | null;
  }>({
    isOpen: false,
    customerName: "",
    imageUrl: "",
    blob: null
  });
  const [directCopySuccess, setDirectCopySuccess] = useState(false);
  const [directCopyError, setDirectCopyError] = useState(false);
  const [directCopyMsg, setDirectCopyMsg] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Filter only favorite customers
  const favoriteCustomers = useMemo(() => {
    return customers.filter(c => c.isFavorite);
  }, [customers]);

  // Month navigation helpers
  const getNextMonth = (cur: string): string => {
    const [y, m] = cur.split("-").map(Number);
    const d = new Date(y, m, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const getPrevMonth = (cur: string): string => {
    const [y, m] = cur.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const formatMonthVN = (cur: string): string => {
    const [y, m] = cur.split("-");
    return `Tháng ${m}/${y}`;
  };

  // Compute table data for a given customer in the selected month
  const getCustomerMonthData = (cust: Customer, monthStr: string) => {
    const monthOrders = orders.filter(
      o =>
        o.customerId === cust.id &&
        o.status !== "cancelled" &&
        o.date &&
        o.date.startsWith(monthStr)
    );

    const computedMonthTotal = monthOrders.reduce(
      (sum, o) => sum + (o.subtotal - (o.discount || 0)),
      0
    );

    const settlement = cust.favoriteSettlements?.[monthStr];
    const monthTotal =
      settlement?.manualMonthTotal !== undefined
        ? settlement.manualMonthTotal
        : computedMonthTotal;

    const discount = settlement?.discount || 0;
    const remaining = Math.max(0, monthTotal - discount);

    let previousDebt = 0;
    if (settlement?.previousDebt !== undefined) {
      previousDebt = settlement.previousDebt;
    } else {
      // Auto calculate debt of orders before this month
      const prevOrders = orders.filter(
        o =>
          o.customerId === cust.id &&
          o.status !== "cancelled" &&
          o.date &&
          o.date < `${monthStr}-01`
      );
      const prevSpent = prevOrders.reduce(
        (sum, o) => sum + (o.subtotal - (o.discount || 0)),
        0
      );
      const prevPaid = prevOrders.reduce(
        (sum, o) => sum + (o.paid || 0),
        0
      );
      previousDebt = Math.max(0, (cust.initialDebt || 0) + prevSpent - prevPaid);
    }

    const dueTotal = remaining + previousDebt;

    return {
      monthOrders,
      computedMonthTotal,
      monthTotal,
      discount,
      remaining,
      previousDebt,
      dueTotal,
      settlement
    };
  };

  // Toggle favorite on/off
  const handleToggleFavorite = (cust: Customer) => {
    const updated: Customer = {
      ...cust,
      isFavorite: !cust.isFavorite
    };
    onUpdateCustomer(updated);
    showToast(
      updated.isFavorite
        ? `⭐ Đã gắn sao khách hàng "${cust.name}"!`
        : `Đã bỏ gắn sao "${cust.name}" khỏi danh sách yêu thích`
    );
  };

  // Apply quick percentage discount (1% - 10%)
  const handleApplyPercentDiscount = (cust: Customer, percent: number) => {
    const data = getCustomerMonthData(cust, selectedMonth);
    const calculatedDiscount = Math.round((data.monthTotal * percent) / 100);
    const existing = cust.favoriteSettlements || {};
    const updated = {
      ...existing,
      [selectedMonth]: {
        ...(existing[selectedMonth] || {}),
        discount: calculatedDiscount
      }
    };
    onUpdateCustomer({
      ...cust,
      favoriteSettlements: updated
    });
    showToast(`⚡ Đã tính chiết khấu ${percent}% = ${formatCurrency(calculatedDiscount)} cho ${cust.name}!`);
  };

  // Open edit settlement modal
  const handleOpenEditSettlement = (cust: Customer) => {
    const data = getCustomerMonthData(cust, selectedMonth);
    setEditingSettlementCustomer(cust);
    setEditDiscount(data.discount);
    setEditPreviousDebt(data.previousDebt);
    setEditManualTotal(data.monthTotal);
    setUseManualTotal(data.settlement?.manualMonthTotal !== undefined);
  };

  // Save edit settlement
  const handleSaveEditSettlement = () => {
    if (!editingSettlementCustomer) return;
    const existing = editingSettlementCustomer.favoriteSettlements || {};
    const updated = {
      ...existing,
      [selectedMonth]: {
        ...(existing[selectedMonth] || {}),
        discount: Number(editDiscount) || 0,
        previousDebt: Number(editPreviousDebt) || 0,
        manualMonthTotal: useManualTotal ? Number(editManualTotal) || 0 : undefined
      }
    };
    onUpdateCustomer({
      ...editingSettlementCustomer,
      favoriteSettlements: updated
    });
    setEditingSettlementCustomer(null);
    showToast(`Đã cập nhật bảng công nợ cho "${editingSettlementCustomer.name}"!`);
  };

  // Reset month & advance to next month
  const handleConfirmResetMonth = () => {
    const nextMonth = getNextMonth(selectedMonth);
    favoriteCustomers.forEach(cust => {
      const curData = getCustomerMonthData(cust, selectedMonth);
      const existing = cust.favoriteSettlements || {};
      const updated = {
        ...existing,
        [selectedMonth]: {
          ...(existing[selectedMonth] || {}),
          discount: curData.discount,
          previousDebt: curData.previousDebt,
          manualMonthTotal: curData.monthTotal,
          isSettled: true,
          settledAt: new Date().toISOString()
        },
        [nextMonth]: {
          ...(existing[nextMonth] || {}),
          previousDebt: curData.dueTotal, // Chuyển số cần thanh toán thành nợ cũ của tháng mới
          discount: 0,
          isSettled: false
        }
      };
      onUpdateCustomer({
        ...cust,
        favoriteSettlements: updated
      });
    });

    setSelectedMonth(nextMonth);
    setIsResetMonthModalOpen(false);
    showToast(`✅ Đã kết chuyển thành công sang ${formatMonthVN(nextMonth)}!`);
  };

  // Export JPG
  const handleDownloadJPG = async (cust: Customer) => {
    const data = getCustomerMonthData(cust, selectedMonth);
    const [y, m] = selectedMonth.split("-");
    try {
      await downloadFavoriteCustomerTableJPG({
        customerName: cust.name,
        studioName: cust.studioName,
        phone: cust.phone,
        monthStr: `${m}/${y}`,
        monthTotal: data.monthTotal,
        discount: data.discount,
        remaining: data.remaining,
        previousDebt: data.previousDebt,
        dueTotal: data.dueTotal,
        workshopName
      });
      showToast(`📷 Đã xuất ảnh bảng công nợ "${cust.name}"!`);
    } catch (e) {
      console.error("Export JPG error:", e);
      alert("Có lỗi khi tạo ảnh bảng công nợ.");
    }
  };

  // Copy image modal trigger
  const handleOpenCopyImageModal = async (cust: Customer) => {
    const data = getCustomerMonthData(cust, selectedMonth);
    const [y, m] = selectedMonth.split("-");
    try {
      const canvas = await generateFavoriteCustomerCanvas({
        customerName: cust.name,
        studioName: cust.studioName,
        phone: cust.phone,
        monthStr: `${m}/${y}`,
        monthTotal: data.monthTotal,
        discount: data.discount,
        remaining: data.remaining,
        previousDebt: data.previousDebt,
        dueTotal: data.dueTotal,
        workshopName
      });

      const imageUrl = canvas.toDataURL("image/png");
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 0.95)
      );

      setCopyImageModal({
        isOpen: true,
        customerName: cust.name,
        phone: cust.phone,
        imageUrl,
        blob
      });
      setDirectCopySuccess(false);
      setDirectCopyError(false);
      setDirectCopyMsg("");

      // Attempt immediate direct clipboard write
      if (blob && typeof navigator !== "undefined" && navigator.clipboard && typeof ClipboardItem !== "undefined") {
        try {
          const item = new ClipboardItem({ "image/png": blob });
          await navigator.clipboard.write([item]);
          setDirectCopySuccess(true);
          setDirectCopyMsg("Đã copy ảnh bảng công nợ thành công! Hãy mở Zalo và ấn Ctrl + V để dán gửi khách.");
          showToast(`📋 Đã sao chép HÌNH ẢNH bảng công nợ "${cust.name}"! Mở Zalo dán (Ctrl+V).`);
        } catch {
          setDirectCopyError(true);
          setDirectCopyMsg("Bấm nút 'SAO CHÉP ẢNH VÀO BỘ NHỚ TẠM' dưới đây hoặc click chuột phải vào ảnh để sao chép.");
        }
      }
    } catch (e) {
      console.error("Open copy image modal error:", e);
      showToast("Có lỗi khi tạo hình ảnh bảng công nợ.");
    }
  };

  // Direct clipboard copy handler inside modal
  const handleDirectClipboardCopy = async () => {
    let blob = copyImageModal.blob;
    if (!blob && copyImageModal.imageUrl) {
      try {
        const resp = await fetch(copyImageModal.imageUrl);
        blob = await resp.blob();
      } catch {
        // ignore
      }
    }

    if (!blob) {
      alert("Chưa tìm thấy dữ liệu ảnh để sao chép");
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && typeof ClipboardItem !== "undefined") {
        const item = new ClipboardItem({ "image/png": blob });
        await navigator.clipboard.write([item]);
        setDirectCopySuccess(true);
        setDirectCopyError(false);
        setDirectCopyMsg("Đã sao chép ảnh bảng công nợ thành công! Hãy mở Zalo và ấn Ctrl + V để dán gửi khách.");
        showToast("📋 Đã sao chép HÌNH ẢNH bảng công nợ! Mở Zalo dán (Ctrl+V).");
      } else {
        throw new Error("Trình duyệt chưa hỗ trợ ClipboardItem");
      }
    } catch (err: any) {
      setDirectCopyError(true);
      setDirectCopySuccess(false);
      setDirectCopyMsg("Trình duyệt hạn chế sao chép ảnh trực tiếp. Bạn hãy click chuột phải vào ảnh bên dưới chọn 'Sao chép hình ảnh' (Copy image) để dán Zalo!");
    }
  };

  // Summary across all favorite customers for selected month
  const totalSummary = useMemo(() => {
    return favoriteCustomers.reduce(
      (acc, c) => {
        const d = getCustomerMonthData(c, selectedMonth);
        acc.monthTotal += d.monthTotal;
        acc.discount += d.discount;
        acc.remaining += d.remaining;
        acc.previousDebt += d.previousDebt;
        acc.dueTotal += d.dueTotal;
        return acc;
      },
      { monthTotal: 0, discount: 0, remaining: 0, previousDebt: 0, dueTotal: 0 }
    );
  }, [favoriteCustomers, selectedMonth, orders]);

  return (
    <div className="space-y-5">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-amber-300 border border-amber-400 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Month Control Bar */}
      <div className="bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-slate-50 border border-amber-300 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl shadow-md">
              <Star className="w-6 h-6 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                  Mục Khách Hàng Yêu Thích ⭐
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-200 text-amber-950 border border-amber-300">
                  {favoriteCustomers.length} Khách
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Theo dõi bảng công nợ & quyết toán chiết khấu hàng tháng cho các Studio & khách ruột thân thiết
              </p>
            </div>
          </div>

          {/* Month Selector & Settlement Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Month Navigator */}
            <div className="flex items-center bg-white border border-amber-300 rounded-2xl p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setSelectedMonth(getPrevMonth(selectedMonth))}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                title="Tháng trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 px-3">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-black text-slate-900 whitespace-nowrap">
                  {formatMonthVN(selectedMonth)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMonth(getNextMonth(selectedMonth))}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                title="Tháng sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick jump to current month */}
            {selectedMonth !== currentMonthDefault && (
              <button
                type="button"
                onClick={() => setSelectedMonth(currentMonthDefault)}
                className="px-3 py-2 bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              >
                Về Tháng Hiện Tại
              </button>
            )}

            {/* Reset / Chuyển tháng mới Button */}
            {favoriteCustomers.length > 0 && (
              <button
                type="button"
                onClick={() => setIsResetMonthModalOpen(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-amber-600/20 transition cursor-pointer"
                title="Chốt số cuối tháng & chuyển tiền Cần Thanh Toán thành Nợ Cũ của tháng tiếp theo"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Chuyển Sang Tháng Mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Aggregate Summary Pills for Selected Month */}
        {favoriteCustomers.length > 0 && (
          <div className="pt-3 border-t border-amber-200/80 grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-mono">
            <div className="p-2.5 bg-white/90 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-sans block">Tổng phát sinh tháng:</span>
              <span className="text-sm font-extrabold text-slate-900">{formatCurrency(totalSummary.monthTotal)}</span>
            </div>
            <div className="p-2.5 bg-white/90 rounded-xl border border-amber-200">
              <span className="text-[11px] text-amber-800 font-sans block">Tổng chiết khấu:</span>
              <span className="text-sm font-extrabold text-amber-700">{formatCurrency(totalSummary.discount)}</span>
            </div>
            <div className="p-2.5 bg-white/90 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-sans block">Còn lại sau CK:</span>
              <span className="text-sm font-extrabold text-slate-900">{formatCurrency(totalSummary.remaining)}</span>
            </div>
            <div className="p-2.5 bg-white/90 rounded-xl border border-rose-200">
              <span className="text-[11px] text-rose-700 font-sans block">Tổng nợ cũ tồn:</span>
              <span className="text-sm font-extrabold text-rose-700">{formatCurrency(totalSummary.previousDebt)}</span>
            </div>
            <div className="col-span-2 sm:col-span-1 p-2.5 bg-yellow-200 rounded-xl border border-yellow-400">
              <span className="text-[11px] text-yellow-950 font-sans font-bold block">Tổng Cần Thu Tháng:</span>
              <span className="text-base font-black text-yellow-950">{formatCurrency(totalSummary.dueTotal)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content: List of Tables */}
      {favoriteCustomers.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <Star className="w-8 h-8 fill-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Chưa Có Khách Hàng Yêu Thích Nào
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Bấm vào biểu tượng <strong>ngôi sao ⭐</strong> ở bất kỳ khách hàng nào trong tab <strong>"Tất Cả Khách & Sổ Nợ"</strong> để tự động tạo bảng theo dõi công nợ mẫu!
            </p>
          </div>
          <button
            type="button"
            onClick={onSwitchToAllCustomers}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-2"
          >
            <span>Đến Danh Sách Khách Hàng</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {favoriteCustomers.map((cust) => {
            const data = getCustomerMonthData(cust, selectedMonth);

            return (
              <div
                key={cust.id}
                className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-4"
              >
                {/* Customer Header Info & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(cust)}
                      className="p-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-600 transition cursor-pointer"
                      title="Bỏ gắn sao khách này"
                    >
                      <Star className="w-5 h-5 fill-amber-400" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-black text-slate-900">
                          {cust.name}
                        </h3>
                        {cust.studioName && (
                          <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {cust.studioName}
                          </span>
                        )}
                        {cust.phone && (
                          <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {cust.phone}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {data.settlement?.isSettled ? (
                          <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Đã chốt kết chuyển tháng {selectedMonth}
                          </span>
                        ) : (
                          <span>Đang theo dõi tự động theo hóa đơn {formatMonthVN(selectedMonth)}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Actions for this Customer Table */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleOpenEditSettlement(cust)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                      title="Chỉnh sửa Chiết khấu hoặc Nợ cũ của tháng này"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Sửa Số Liệu</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenCopyImageModal(cust)}
                      className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                      title="Sao chép hình ảnh bảng công nợ để gửi tin nhắn Zalo"
                    >
                      <Copy className="w-3.5 h-3.5 text-amber-700" />
                      <span>Sao Chép Tin Nhắn (Ảnh)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadJPG(cust)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                      title="Tải ảnh JPG bảng công nợ để gửi cho khách"
                    >
                      <Camera className="w-3.5 h-3.5 text-white" />
                      <span>Tải Ảnh (JPG)</span>
                    </button>
                  </div>
                </div>

                {/* THE 6-COLUMN TABLE (EXACT MODEL FROM USER IMAGE, SOFT & ELEGANT STYLING) */}
                <div className="border border-slate-300 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-slate-100/90 text-slate-800 font-bold border-b border-slate-300">
                          <th className="py-3 px-3 border-r border-slate-300 min-w-[140px] text-center font-bold">
                            khách hàng
                          </th>
                          <th className="py-3 px-3 border-r border-slate-300 min-w-[160px] text-center font-bold">
                            Tổng tiền trong tháng
                          </th>
                          <th className="py-3 px-3 border-r border-slate-300 min-w-[210px] text-center font-bold">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <span>Chiết khấu Thanh Toán</span>
                              <select
                                value=""
                                onChange={(e) => {
                                  const pct = Number(e.target.value);
                                  if (!isNaN(pct) && pct >= 0) handleApplyPercentDiscount(cust, pct);
                                }}
                                className="px-2 py-0.5 text-[11px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg border border-amber-600 shadow-2xs cursor-pointer outline-hidden transition shrink-0"
                                title="Chọn nhanh % chiết khấu (0% đến 10%)"
                              >
                                <option value="" disabled className="bg-white text-slate-900 font-bold">% CK</option>
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(pct => (
                                  <option key={pct} value={pct} className="bg-white text-slate-900 font-semibold">
                                    {pct}%
                                  </option>
                                ))}
                              </select>
                            </div>
                          </th>
                          <th className="py-3 px-3 border-r border-slate-300 min-w-[140px] text-center font-bold">
                            Còn lại
                          </th>
                          <th className="py-3 px-3 border-r border-slate-300 min-w-[140px] text-center font-bold">
                            Nợ cũ
                          </th>
                          <th className="py-3 px-3 min-w-[160px] text-center font-black bg-yellow-200/80 text-yellow-950">
                            Cần Thanh Toán
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white hover:bg-slate-50/60 transition">
                          {/* 1. khách hàng */}
                          <td className="py-4 px-3 border-r border-slate-300 font-bold text-slate-900">
                            <div>{cust.name}</div>
                            {cust.studioName && (
                              <div className="text-[11px] text-slate-500 font-normal">
                                {cust.studioName}
                              </div>
                            )}
                          </td>

                          {/* 2. Tổng tiền trong tháng */}
                          <td className="py-4 px-3 border-r border-slate-300 font-mono font-bold text-slate-900">
                            <div>{formatCurrency(data.monthTotal)}</div>
                            <div className="text-[10px] text-slate-400 font-sans font-normal">
                              ({data.monthOrders.length} đơn hàng)
                            </div>
                          </td>

                          {/* 3. Chiết khấu Thanh Toán */}
                          <td className="py-4 px-3 border-r border-slate-300 font-mono font-bold">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <span
                                onClick={() => handleOpenEditSettlement(cust)}
                                className="cursor-pointer hover:underline text-amber-700"
                                title="Nhấp vào để sửa thủ công chiết khấu"
                              >
                                {formatCurrency(data.discount)}
                              </span>
                            </div>
                          </td>

                          {/* 4. Còn lại */}
                          <td className="py-4 px-3 border-r border-slate-300 font-mono font-bold text-slate-900">
                            {formatCurrency(data.remaining)}
                          </td>

                          {/* 5. Nợ cũ */}
                          <td className="py-4 px-3 border-r border-slate-300 font-mono font-bold">
                            <span
                              onClick={() => handleOpenEditSettlement(cust)}
                              className="cursor-pointer hover:underline text-rose-700"
                              title="Nhấp vào để sửa nợ cũ"
                            >
                              {formatCurrency(data.previousDebt)}
                            </span>
                          </td>

                          {/* 6. Cần Thanh Toán - HIGHLIGHTED IN BRIGHT YELLOW AS IN USER IMAGE */}
                          <td className="py-4 px-3 bg-yellow-300 text-slate-950 font-mono font-black text-base sm:text-lg shadow-inner">
                            {formatCurrency(data.dueTotal)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* FOOTER NOTICE (EXACT WORDS FROM USER IMAGE) */}
                <div className="pt-2 text-center space-y-1">
                  <p className="text-xs sm:text-sm text-slate-700 font-medium">
                    Quý Khách Vui lòng thanh toán trước ngày m2 tháng kế tiếp để nhận ưu đãi chiết khấu. Quá hạn khoản chiết khấu sẽ được cộng ngược lại công nợ.
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-slate-900">
                    Trân Trọng!
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: RESET / KẾT CHUYỂN SANG THÁNG MỚI */}
      {isResetMonthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in">
            <div className="p-5 bg-amber-500 text-slate-950 flex items-center justify-between">
              <h3 className="font-black text-base flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-slate-950" />
                <span>Kết Chuyển Sổ Nợ Sang Tháng Mới</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsResetMonthModalOpen(false)}
                className="text-slate-800 hover:text-black font-bold p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-slate-700 space-y-1.5">
                <p className="font-bold text-amber-950 text-sm">
                  🔄 Chu kỳ kết chuyển từ {formatMonthVN(selectedMonth)} ➔ {formatMonthVN(getNextMonth(selectedMonth))}
                </p>
                <p>
                  Khi bấm xác nhận, hệ thống sẽ tự động thực hiện:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li>Lưu trữ toàn bộ số liệu công nợ tháng <strong>{formatMonthVN(selectedMonth)}</strong> vào lịch sử.</li>
                  <li>Chuyển số tiền <strong>"Cần Thanh Toán"</strong> tháng này thành <strong>"Nợ cũ"</strong> của tháng tiếp theo (<strong>{formatMonthVN(getNextMonth(selectedMonth))}</strong>).</li>
                  <li>Làm mới (reset) chiết khấu về 0đ cho tháng mới để sẵn sàng lên đơn đợt tiếp theo.</li>
                </ul>
              </div>

              {/* Preview table of carried over debts */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2 px-3 text-left">Khách Hàng</th>
                      <th className="py-2 px-3 text-right">Cần Thanh Toán ({selectedMonth})</th>
                      <th className="py-2 px-3 text-right text-amber-800 font-bold">➔ Nợ Cũ ({getNextMonth(selectedMonth)})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {favoriteCustomers.map((c) => {
                      const d = getCustomerMonthData(c, selectedMonth);
                      return (
                        <tr key={c.id}>
                          <td className="py-2 px-3 font-bold text-slate-800">{c.name}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatCurrency(d.dueTotal)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-amber-800">{formatCurrency(d.dueTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsResetMonthModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmResetMonth}
                className="px-5 py-2 text-xs font-black text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Xác Nhận Kết Chuyển & Sang Tháng Mới</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: QUICK EDIT DISCOUNT & PREVIOUS DEBT */}
      {editingSettlementCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Điều Chỉnh {formatMonthVN(selectedMonth)}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingSettlementCustomer(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-slate-500">Khách hàng yêu thích:</p>
                <p className="font-black text-sm text-slate-900">{editingSettlementCustomer.name}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Chiết khấu Thanh Toán (VNĐ)
                  </label>
                  <span className="text-[10px] text-amber-800 font-bold">Tính nhanh %:</span>
                </div>
                {/* 0% to 10% buttons */}
                <div className="grid grid-cols-6 gap-1 mb-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(pct => {
                    const currentData = getCustomerMonthData(editingSettlementCustomer, selectedMonth);
                    const calculated = Math.round((currentData.monthTotal * pct) / 100);
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setEditDiscount(calculated)}
                        className={`py-1 px-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          editDiscount === calculated
                            ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                        }`}
                        title={`${pct}% của ${formatCurrency(currentData.monthTotal)} = ${formatCurrency(calculated)}`}
                      >
                        {pct}%
                      </button>
                    );
                  })}
                </div>
                <MoneyInput
                  value={editDiscount}
                  onChange={(val) => setEditDiscount(val)}
                  placeholder="0"
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-amber-800 bg-amber-50/40 focus:ring-2 focus:ring-amber-500"
                  showWords={true}
                />
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Khoản ưu đãi trừ vào tổng tiền tháng này khi khách trả đúng hạn.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nợ cũ mang sang (VNĐ)
                </label>
                <MoneyInput
                  value={editPreviousDebt}
                  onChange={(val) => setEditPreviousDebt(val)}
                  placeholder="0"
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-rose-700 bg-rose-50/40 focus:ring-2 focus:ring-rose-500"
                  showWords={true}
                />
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Số tiền nợ từ các tháng trước chưa thanh toán.
                </p>
              </div>

              {/* Optional manual override for month total */}
              <div className="pt-2 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 mb-1.5">
                  <input
                    type="checkbox"
                    checked={useManualTotal}
                    onChange={(e) => setUseManualTotal(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-amber-500"
                  />
                  <span>Tự điền ghi đè "Tổng tiền trong tháng"</span>
                </label>
                {useManualTotal && (
                  <MoneyInput
                    value={editManualTotal}
                    onChange={(val) => setEditManualTotal(val)}
                    placeholder="0"
                    className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900"
                    showWords={true}
                  />
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingSettlementCustomer(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEditSettlement}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-xs cursor-pointer"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PREVIEW & COPY IMAGE FOR ZALO */}
      {copyImageModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
            {/* Header Modal */}
            <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                  <Image className="w-5 h-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-sm sm:text-base">
                      Xem Trước & Sao Chép Ảnh Công Nợ (Gửi Zalo)
                    </h4>
                  </div>
                  <p className="text-xs text-slate-400">
                    Khách hàng: <strong className="text-slate-200">{copyImageModal.customerName}</strong>
                    {copyImageModal.phone && (
                      <span className="ml-2 font-mono text-slate-300">({copyImageModal.phone})</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCopyImageModal({ isOpen: false, customerName: "", imageUrl: "", blob: null })}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Alert Status Banner */}
            {directCopySuccess ? (
              <div className="p-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs sm:text-sm font-bold flex items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
                  <span>{directCopyMsg || 'Đã copy ảnh bảng công nợ thành công! Hãy mở Zalo và ấn Ctrl + V để dán gửi khách.'}</span>
                </div>
                {copyImageModal.phone && (
                  <a
                    href={`https://zalo.me/${copyImageModal.phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-white text-emerald-950 rounded-lg text-xs font-black shadow-xs hover:bg-emerald-50 flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                    <span>Mở Zalo dán (Ctrl+V)</span>
                  </a>
                )}
              </div>
            ) : directCopyError ? (
              <div className="p-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong className="block font-bold mb-0.5">Trạng thái sao chép:</strong>
                  <p className="font-semibold text-amber-900 mb-1">{directCopyMsg}</p>
                  <p className="text-[11px] text-amber-800">
                    👉 <strong>Cách xử lý:</strong> Click <strong>chuột phải vào ảnh bên dưới</strong> (hoặc nhấn giữ trên điện thoại) và chọn <strong>"Sao chép hình ảnh" (Copy image)</strong>, sau đó mở Zalo và ấn <strong>Ctrl + V</strong> để gửi khách!
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Bấm nút vàng dưới đây để sao chép ảnh công nợ vào bộ nhớ tạm, sau đó mở Zalo ấn <strong>Ctrl + V</strong> để gửi khách.
                </span>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={handleDirectClipboardCopy}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 rounded-xl font-black text-xs sm:text-sm shadow-md transition transform active:scale-98 cursor-pointer flex-1 sm:flex-initial ${
                  directCopySuccess
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-300'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                }`}
              >
                <Copy className="w-4 h-4" />
                <span>
                  {directCopySuccess
                    ? '✅ ĐÃ COPY ẢNH THÀNH CÔNG! (MỞ ZALO DÁN CTRL+V)'
                    : '📋 SAO CHÉP ẢNH VÀO BỘ NHỚ TẠM'}
                </span>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                {copyImageModal.phone && (
                  <a
                    href={`https://zalo.me/${copyImageModal.phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở Zalo khách</span>
                  </a>
                )}

                <a
                  href={copyImageModal.imageUrl}
                  download={`Bang_Cong_No_${copyImageModal.customerName.replace(/\s+/g, '_')}.png`}
                  className="flex items-center gap-1 px-3 py-2 sm:py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải ảnh PNG</span>
                </a>
              </div>
            </div>

            {/* Rendered Canvas Image Preview */}
            <div className="p-4 flex-1 overflow-y-auto bg-slate-200/80 flex items-center justify-center">
              <div className="max-w-full text-center">
                <img
                  src={copyImageModal.imageUrl}
                  alt="Bảng công nợ xem trước"
                  className="max-h-[56vh] max-w-full object-contain rounded-xl shadow-xl border border-slate-300 bg-white inline-block"
                />
                <p className="mt-2 text-[11px] text-slate-500">
                  💡 Bạn có thể chuột phải vào ảnh chọn <strong>"Sao chép hình ảnh"</strong> bất cứ lúc nào
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
