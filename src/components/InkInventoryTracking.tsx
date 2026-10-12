import React, { useState, useMemo } from 'react';
import { InkImportRecord, InkColorCode } from '../types';
import { INK_12_COLORS } from '../data/initialData';
import { formatCurrency, formatNumber, formatDateVN } from '../utils/formatters';
import {
  Droplet, Plus, Calendar, RotateCcw, AlertTriangle, CheckCircle2,
  Trash2, Edit, Building2, Layers, BarChart3, TrendingUp, Sparkles,
  Check, X, FileText, ChevronRight, Hash, ArrowUpDown, Info
} from 'lucide-react';

interface InkInventoryTrackingProps {
  inkImports: InkImportRecord[];
  onSaveInkImport: (record: InkImportRecord) => void;
  onDeleteInkImport: (recordId: string) => void;
  onResetInkYear: (year: number) => void;
  onReloadDefaultInkImports?: () => void;
}

export const InkInventoryTracking: React.FC<InkInventoryTrackingProps> = ({
  inkImports,
  onSaveInkImport,
  onDeleteInkImport,
  onResetInkYear
}) => {
  // Current calendar year
  const currentCalendarYear = new Date().getFullYear();

  // Selected Year for Single-Year Chart View
  const [selectedYear, setSelectedYear] = useState<number>(currentCalendarYear);

  // View Mode: 'yearly' (Xem theo từng năm) | 'cumulative' (Tổng hợp cộng dồn tất cả các năm)
  const [viewMode, setViewMode] = useState<'yearly' | 'cumulative'>('yearly');

  // Sub-view in this tab: 'charts' (Biểu đồ & Ma trận) | 'receipts' (Danh sách phiếu nhập mực)
  const [activeTab, setActiveTab] = useState<'charts' | 'receipts'>('charts');

  // Modals
  const [isNewImportModalOpen, setIsNewImportModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<InkImportRecord | null>(null);
  const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<InkImportRecord | null>(null);

  // Modal Form State
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [formSupplier, setFormSupplier] = useState<string>('SVP');
  const [formReceiptCode, setFormReceiptCode] = useState<string>('');
  const [formUnit, setFormUnit] = useState<string>('Bình');
  const [formCostPerBottle, setFormCostPerBottle] = useState<number | ''>(880000);
  const [formNotes, setFormNotes] = useState<string>('');
  const [formItems, setFormItems] = useState<Record<InkColorCode, number>>(() => {
    const initial: Record<InkColorCode, number> = {} as any;
    INK_12_COLORS.forEach(c => {
      initial[c.code] = 0;
    });
    return initial;
  });

  // Extract all unique years available in the records, ensuring currentYear is included
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(currentCalendarYear);
    inkImports.forEach(rec => {
      const y = rec.year || new Date(rec.date).getFullYear();
      if (y) yearsSet.add(y);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [inkImports, currentCalendarYear]);

  // Aggregate quantity for each color in the selected year
  const yearlyStats = useMemo(() => {
    const stats: Record<InkColorCode, { count: number; importTimes: number }> = {} as any;
    INK_12_COLORS.forEach(c => {
      stats[c.code] = { count: 0, importTimes: 0 };
    });

    let totalBottles = 0;
    let totalEstimatedCost = 0;
    const yearRecords = inkImports.filter(rec => (rec.year || new Date(rec.date).getFullYear()) === selectedYear);

    yearRecords.forEach(rec => {
      totalEstimatedCost += rec.totalCost || (rec.costPricePerBottle ? rec.costPricePerBottle * rec.totalQuantity : 0);
      INK_12_COLORS.forEach(c => {
        const qty = rec.items?.[c.code] || 0;
        if (qty > 0) {
          stats[c.code].count += qty;
          stats[c.code].importTimes += 1;
          totalBottles += qty;
        }
      });
    });

    // Find top consumed / imported colors
    const sortedColors = [...INK_12_COLORS].sort((a, b) => stats[b.code].count - stats[a.code].count);
    const topColor = sortedColors[0] && stats[sortedColors[0].code].count > 0 ? sortedColors[0] : null;
    const maxBarQty = Math.max(...Object.values(stats).map(s => s.count), 1);

    return {
      stats,
      totalBottles,
      totalEstimatedCost,
      recordCount: yearRecords.length,
      topColor,
      maxBarQty,
      yearRecords
    };
  }, [inkImports, selectedYear]);

  // Aggregate quantity across ALL years (Cumulative / All-time)
  const cumulativeStats = useMemo(() => {
    const stats: Record<InkColorCode, number> = {} as any;
    INK_12_COLORS.forEach(c => {
      stats[c.code] = 0;
    });

    let grandTotalBottles = 0;
    // Map of year -> Record<InkColorCode, number>
    const byYearMatrix: Record<number, Record<InkColorCode, number>> = {};
    availableYears.forEach(y => {
      byYearMatrix[y] = {} as any;
      INK_12_COLORS.forEach(c => {
        byYearMatrix[y][c.code] = 0;
      });
    });

    inkImports.forEach(rec => {
      const y = rec.year || new Date(rec.date).getFullYear();
      if (!byYearMatrix[y]) {
        byYearMatrix[y] = {} as any;
        INK_12_COLORS.forEach(c => {
          byYearMatrix[y][c.code] = 0;
        });
      }

      INK_12_COLORS.forEach(c => {
        const qty = rec.items?.[c.code] || 0;
        if (qty > 0) {
          stats[c.code] += qty;
          byYearMatrix[y][c.code] += qty;
          grandTotalBottles += qty;
        }
      });
    });

    const maxBarQty = Math.max(...Object.values(stats), 1);
    const sortedColors = [...INK_12_COLORS].sort((a, b) => stats[b.code] - stats[a.code]);

    return {
      stats,
      grandTotalBottles,
      byYearMatrix,
      maxBarQty,
      sortedColors
    };
  }, [inkImports, availableYears]);

  // Open Form to add new import
  const handleOpenNewImport = () => {
    setEditingRecord(null);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormSupplier('SVP'); // Mặc định là SVP theo yêu cầu
    const currentYearRecs = inkImports.filter(r => (r.year || new Date(r.date).getFullYear()) === currentCalendarYear);
    setFormReceiptCode(`NK-MUC-${currentCalendarYear}-${(currentYearRecs.length + 1).toString().padStart(3, '0')}`);
    setFormUnit('Bình');
    setFormCostPerBottle(880000);
    setFormNotes('');
    const cleanItems: Record<InkColorCode, number> = {} as any;
    INK_12_COLORS.forEach(c => {
      cleanItems[c.code] = 0;
    });
    setFormItems(cleanItems);
    setIsNewImportModalOpen(true);
  };

  // Open Form to edit existing import
  const handleOpenEdit = (rec: InkImportRecord) => {
    setEditingRecord(rec);
    setFormDate(rec.date);
    setFormSupplier(rec.supplier || 'SVP');
    setFormReceiptCode(rec.receiptNumber);
    setFormUnit(rec.unit || 'Bình');
    setFormCostPerBottle(rec.costPricePerBottle || '');
    setFormNotes(rec.notes || '');
    const cleanItems: Record<InkColorCode, number> = {} as any;
    INK_12_COLORS.forEach(c => {
      cleanItems[c.code] = rec.items?.[c.code] || 0;
    });
    setFormItems(cleanItems);
    setIsNewImportModalOpen(true);
  };

  // Quick adjust single color in the modal
  const handleAdjustColorQty = (code: InkColorCode, delta: number) => {
    setFormItems(prev => {
      const current = prev[code] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [code]: next };
    });
  };

  const handleSetColorQty = (code: InkColorCode, val: number) => {
    setFormItems(prev => ({
      ...prev,
      [code]: Math.max(0, val)
    }));
  };

  // Batch Quick Select Helpers
  const handleSelectFull12Set = (qtyPerColor: number) => {
    setFormItems(prev => {
      const next: Record<InkColorCode, number> = { ...prev };
      INK_12_COLORS.forEach(c => {
        next[c.code] = (next[c.code] || 0) + qtyPerColor;
      });
      return next;
    });
  };

  const handleSelectBlackGraySet = (qtyPerColor: number) => {
    const targetCodes: InkColorCode[] = ['MBK', 'PBK', 'GY', 'PGY', 'CO'];
    setFormItems(prev => {
      const next: Record<InkColorCode, number> = { ...prev };
      targetCodes.forEach(code => {
        next[code] = (next[code] || 0) + qtyPerColor;
      });
      return next;
    });
  };

  const handleClearAllSelected = () => {
    const clean: Record<InkColorCode, number> = {} as any;
    INK_12_COLORS.forEach(c => {
      clean[c.code] = 0;
    });
    setFormItems(clean);
  };

  // Calculate total items in the current form
  const formTotalQuantity = useMemo(() => {
    return Object.values(formItems).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [formItems]);

  // Form Submit
  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupplier.trim()) {
      alert('Vui lòng chọn hoặc nhập tên nhà cung cấp (Mặc định: SVP)');
      return;
    }
    if (formTotalQuantity <= 0) {
      alert('Vui lòng chọn số lượng ít nhất cho 1 màu mực (Sử dụng các nút chọn nhanh 12 màu bên dưới)!');
      return;
    }

    const recYear = new Date(formDate).getFullYear();
    const costPerBottle = typeof formCostPerBottle === 'number' ? formCostPerBottle : undefined;
    const totalCost = costPerBottle ? costPerBottle * formTotalQuantity : undefined;

    const record: InkImportRecord = {
      id: editingRecord ? editingRecord.id : `ink-imp-${Date.now()}`,
      receiptNumber: formReceiptCode.trim() || `NK-MUC-${recYear}-${Date.now().toString().slice(-4)}`,
      date: formDate,
      year: recYear,
      supplier: formSupplier.trim() || 'SVP',
      items: formItems,
      totalQuantity: formTotalQuantity,
      unit: formUnit.trim() || 'Bình',
      costPricePerBottle: costPerBottle,
      totalCost,
      notes: formNotes.trim(),
      createdAt: editingRecord ? editingRecord.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSaveInkImport(record);
    setIsNewImportModalOpen(false);
  };

  // Confirm Reset Year
  const handleConfirmResetYear = () => {
    onResetInkYear(selectedYear);
    setIsResetConfirmModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner for Ink Management */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-xl border border-indigo-900/60 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-fuchsia-600 to-pink-500 rounded-2xl text-white shadow-lg shadow-pink-500/20">
              <Droplet className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  THEO DÕI LƯỢNG MỰC NHẬP XƯỞNG
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-sm">
                  12 MÀU LUCIA PRO
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
                Quản lý chi tiết 12 màu mực Canon chuyên dụng: PM, R, C, PGY, PBK, MBK, CO, GY, B, Y, M, PC - Nhà cung cấp chính: <strong>SVP</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
          <button
            type="button"
            onClick={handleOpenNewImport}
            className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nhập Hàng Thủ Công</span>
          </button>

          {/* Reset Year Button (Chỉ hiển thị khi xem theo năm) */}
          {viewMode === 'yearly' && (
            <button
              type="button"
              onClick={() => setIsResetConfirmModalOpen(true)}
              className="flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 hover:text-white font-bold text-xs sm:text-sm rounded-xl border border-rose-800/80 transition cursor-pointer"
              title={`Reset số lượng mực năm ${selectedYear} để chuẩn bị theo dõi năm tiếp theo`}
            >
              <RotateCcw className="w-4 h-4 text-rose-400" />
              <span>Reset Năm {selectedYear}</span>
            </button>
          )}
        </div>
      </div>

      {/* View Switcher & Year Filter Controls */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Switcher: Yearly vs Cumulative All-time */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode('yearly')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-black text-xs sm:text-sm transition cursor-pointer ${
              viewMode === 'yearly'
                ? 'bg-white text-indigo-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <span>Chi Tiết Từng Năm</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('cumulative')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-black text-xs sm:text-sm transition cursor-pointer ${
              viewMode === 'cumulative'
                ? 'bg-white text-indigo-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>Tổng Hợp Cộng Dồn Tất Cả Các Năm</span>
          </button>
        </div>

        {/* Year Selectors & View Mode Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {viewMode === 'yearly' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">
                Chọn năm:
              </span>
              <div className="flex items-center gap-1 overflow-x-auto">
                {availableYears.map(yr => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setSelectedYear(yr)}
                    className={`px-3 py-1.5 rounded-lg font-mono font-bold text-xs sm:text-sm transition cursor-pointer ${
                      selectedYear === yr
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Năm {yr}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sub-view switcher: Charts vs Receipts */}
          <div className="flex items-center border-l border-slate-200 pl-2 ml-1">
            <button
              type="button"
              onClick={() => setActiveTab('charts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'charts'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Biểu Đồ Cột
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('receipts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                activeTab === 'receipts'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Phiếu Nhập ({inkImports.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'charts' ? (
        <>
          {/* VIEW MODE 1: YEARLY CHART VIEW */}
          {viewMode === 'yearly' && (
            <div className="space-y-6">
              {/* Yearly Summary KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Tổng Mực Năm {selectedYear}</span>
                    <Droplet className="w-4 h-4 text-pink-600" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                    {formatNumber(yearlyStats.totalBottles)}{' '}
                    <span className="text-xs font-normal text-slate-500">bình</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Tổng 12 màu trong cả năm {selectedYear}
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Màu Dùng Nhiều Nhất</span>
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                    {yearlyStats.topColor ? (
                      <>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-black text-white shadow-xs"
                          style={{ backgroundColor: yearlyStats.topColor.hex }}
                        >
                          {yearlyStats.topColor.code}
                        </span>
                        <span className="font-mono text-indigo-700">
                          {yearlyStats.stats[yearlyStats.topColor.code].count} bình
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400 text-sm">Chưa có dữ liệu</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 truncate">
                    {yearlyStats.topColor ? yearlyStats.topColor.vietnameseName : 'Hãy thêm phiếu nhập'}
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Số Đợt Nhập Hàng</span>
                    <Building2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-blue-700 font-mono">
                    {yearlyStats.recordCount} <span className="text-xs font-normal text-slate-500">đợt</span>
                  </div>
                  <p className="text-[11px] text-blue-600 font-semibold mt-1">
                    Nhà cung cấp chính: SVP
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Ước Tính Chi Phí</span>
                    <Calendar className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono truncate" title={formatCurrency(yearlyStats.totalEstimatedCost)}>
                    {yearlyStats.totalEstimatedCost > 0 ? formatCurrency(yearlyStats.totalEstimatedCost) : '---'}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ước tính theo giá nhập xưởng
                  </p>
                </div>
              </div>

              {/* YEARLY COLUMN CHART: 12 INK COLORS */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      <span>BIỂU ĐỒ CỘT LƯỢNG MỰC NHẬP NĂM {selectedYear} (12 MÀU)</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Chiều cao cột biểu thị tổng số bình mực đã nhập cho từng màu trong năm {selectedYear}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Đơn vị: Bình / Hộp</span>
                    <button
                      type="button"
                      onClick={() => setIsResetConfirmModalOpen(true)}
                      className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition cursor-pointer flex items-center gap-1"
                      title="Reset số liệu năm này"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Năm {selectedYear}</span>
                    </button>
                  </div>
                </div>

                {/* THE 12-BAR CHART */}
                <div className="pt-6 pb-2">
                  <div className="grid grid-cols-12 gap-1.5 sm:gap-3 items-end min-h-[300px] sm:min-h-[360px] pb-4 border-b border-slate-200">
                    {INK_12_COLORS.map(color => {
                      const qty = yearlyStats.stats[color.code].count;
                      const percentage = yearlyStats.totalBottles > 0
                        ? Math.round((qty / yearlyStats.totalBottles) * 100)
                        : 0;
                      // Height relative to the max bar
                      const barHeightPercent = yearlyStats.maxBarQty > 0
                        ? Math.max(qty > 0 ? 12 : 3, Math.round((qty / yearlyStats.maxBarQty) * 100))
                        : 3;

                      return (
                        <div
                          key={color.code}
                          className="flex flex-col items-center justify-end h-full group relative"
                        >
                          {/* Hover Tooltip */}
                          <div className="absolute -top-16 opacity-0 group-hover:opacity-100 pointer-events-none transition duration-150 z-20 bg-slate-900 text-white rounded-lg p-2 text-center text-xs shadow-xl whitespace-nowrap min-w-[120px]">
                            <div className="font-black text-amber-300">{color.code} - {color.name}</div>
                            <div className="text-[11px] text-slate-200">{color.vietnameseName}</div>
                            <div className="text-xs font-mono font-bold mt-0.5">
                              {qty} bình ({percentage}%)
                            </div>
                          </div>

                          {/* Top quantity label */}
                          <div className="mb-2 text-center">
                            <span className={`font-mono text-xs sm:text-sm font-black block transition ${
                              qty > 0 ? 'text-slate-900' : 'text-slate-300'
                            }`}>
                              {qty}
                            </span>
                            {qty > 0 && (
                              <span className="text-[10px] text-slate-400 font-semibold hidden md:block">
                                {percentage}%
                              </span>
                            )}
                          </div>

                          {/* The Bar */}
                          <div className="w-full max-w-[48px] bg-slate-100 rounded-t-xl overflow-hidden flex flex-col justify-end transition-all duration-300 h-64 sm:h-72">
                            <div
                              style={{
                                height: `${barHeightPercent}%`,
                                backgroundColor: color.hex
                              }}
                              className="w-full rounded-t-xl transition-all duration-500 shadow-sm relative group-hover:brightness-110 flex items-start justify-center pt-1"
                            >
                              {/* Inner soft highlight */}
                              <div className="w-full h-1 bg-white/40 rounded-t-xl" />
                            </div>
                          </div>

                          {/* Bottom Color Badge & Title */}
                          <div className="mt-3 text-center flex flex-col items-center w-full">
                            <span
                              className="px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-black shadow-xs tracking-wider block"
                              style={{
                                backgroundColor: color.hex,
                                color: color.textColor
                              }}
                            >
                              {color.code}
                            </span>
                            <span
                              className="text-[10px] text-slate-600 font-bold mt-1 line-clamp-1 max-w-[65px] hidden sm:block"
                              title={color.vietnameseName}
                            >
                              {color.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 12 Color Cards Grid Summary */}
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-3">
                    Bảng Thống Kê Chi Tiết 12 Màu Mực Trong Năm {selectedYear}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                    {INK_12_COLORS.map(color => {
                      const qty = yearlyStats.stats[color.code].count;
                      const importTimes = yearlyStats.stats[color.code].importTimes;
                      const pct = yearlyStats.totalBottles > 0
                        ? ((qty / yearlyStats.totalBottles) * 100).toFixed(1)
                        : '0';

                      return (
                        <div
                          key={color.code}
                          className="p-2.5 rounded-xl border border-slate-200/80 hover:border-slate-300 bg-slate-50/50 hover:bg-white transition flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span
                              className="px-2 py-0.5 rounded text-xs font-black shadow-2xs"
                              style={{
                                backgroundColor: color.hex,
                                color: color.textColor
                              }}
                            >
                              {color.code}
                            </span>
                            <span className="font-mono text-xs font-extrabold text-slate-700">
                              {qty} bình
                            </span>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 truncate" title={color.name}>
                              {color.name}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate" title={color.vietnameseName}>
                              {color.vietnameseName}
                            </div>
                          </div>
                          <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                            <span>{importTimes} đợt</span>
                            <span className="font-mono font-bold text-indigo-700">{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: CUMULATIVE ALL-TIME VIEW */}
          {viewMode === 'cumulative' && (
            <div className="space-y-6">
              {/* Cumulative KPI */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-xl p-4 shadow-sm border border-indigo-800">
                  <div className="flex items-center justify-between text-indigo-300 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Tổng Lũy Kế Toàn Bộ Các Năm</span>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">
                    {formatNumber(cumulativeStats.grandTotalBottles)}{' '}
                    <span className="text-xs font-normal text-slate-300">bình</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Cộng dồn từ trước đến nay cho 12 màu mực
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Màu Tiêu Thụ Số 1 (All-time)</span>
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                    {cumulativeStats.sortedColors[0] ? (
                      <>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-black text-white shadow-xs"
                          style={{ backgroundColor: cumulativeStats.sortedColors[0].hex }}
                        >
                          {cumulativeStats.sortedColors[0].code}
                        </span>
                        <span className="font-mono text-indigo-700">
                          {cumulativeStats.stats[cumulativeStats.sortedColors[0].code]} bình
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400 text-sm">Chưa có dữ liệu</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 truncate">
                    {cumulativeStats.sortedColors[0]?.vietnameseName || ''}
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 col-span-2 md:col-span-1">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Số Năm Đang Quản Lý</span>
                    <Calendar className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-blue-700 font-mono">
                    {availableYears.length} <span className="text-xs font-normal text-slate-500">năm</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Từ năm {Math.min(...availableYears)} đến năm {Math.max(...availableYears)}
                  </p>
                </div>
              </div>

              {/* ALL-TIME CUMULATIVE COLUMN CHART */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200">
                <div className="pb-4 border-b border-slate-100">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    <span>BIỂU ĐỒ CỘNG DỒN TẤT CẢ CÁC NĂM (12 MÀU MỰC)</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Tổng số lượng mực từng màu tích lũy qua toàn bộ lịch sử các năm của tiệm in
                  </p>
                </div>

                {/* THE 12 CUMULATIVE BARS */}
                <div className="pt-6 pb-2">
                  <div className="grid grid-cols-12 gap-1.5 sm:gap-3 items-end min-h-[300px] sm:min-h-[360px] pb-4 border-b border-slate-200">
                    {INK_12_COLORS.map(color => {
                      const totalQty = cumulativeStats.stats[color.code];
                      const percentage = cumulativeStats.grandTotalBottles > 0
                        ? Math.round((totalQty / cumulativeStats.grandTotalBottles) * 100)
                        : 0;
                      const barHeightPercent = cumulativeStats.maxBarQty > 0
                        ? Math.max(totalQty > 0 ? 12 : 3, Math.round((totalQty / cumulativeStats.maxBarQty) * 100))
                        : 3;

                      return (
                        <div
                          key={color.code}
                          className="flex flex-col items-center justify-end h-full group relative"
                        >
                          {/* Tooltip */}
                          <div className="absolute -top-16 opacity-0 group-hover:opacity-100 pointer-events-none transition duration-150 z-20 bg-slate-900 text-white rounded-lg p-2 text-center text-xs shadow-xl whitespace-nowrap min-w-[120px]">
                            <div className="font-black text-amber-300">{color.code} - {color.name}</div>
                            <div className="text-[11px] text-slate-200">{color.vietnameseName}</div>
                            <div className="text-xs font-mono font-bold mt-0.5">
                              Tổng: {totalQty} bình ({percentage}%)
                            </div>
                          </div>

                          {/* Top quantity label */}
                          <div className="mb-2 text-center">
                            <span className={`font-mono text-xs sm:text-sm font-black block transition ${
                              totalQty > 0 ? 'text-slate-900' : 'text-slate-300'
                            }`}>
                              {totalQty}
                            </span>
                            {totalQty > 0 && (
                              <span className="text-[10px] text-slate-400 font-semibold hidden md:block">
                                {percentage}%
                              </span>
                            )}
                          </div>

                          {/* The Bar */}
                          <div className="w-full max-w-[48px] bg-slate-100 rounded-t-xl overflow-hidden flex flex-col justify-end transition-all duration-300 h-64 sm:h-72">
                            <div
                              style={{
                                height: `${barHeightPercent}%`,
                                backgroundColor: color.hex
                              }}
                              className="w-full rounded-t-xl transition-all duration-500 shadow-sm relative group-hover:brightness-110 flex items-start justify-center pt-1"
                            >
                              <div className="w-full h-1 bg-white/40 rounded-t-xl" />
                            </div>
                          </div>

                          {/* Bottom Badge */}
                          <div className="mt-3 text-center flex flex-col items-center w-full">
                            <span
                              className="px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-black shadow-xs tracking-wider block"
                              style={{
                                backgroundColor: color.hex,
                                color: color.textColor
                              }}
                            >
                              {color.code}
                            </span>
                            <span
                              className="text-[10px] text-slate-600 font-bold mt-1 line-clamp-1 max-w-[65px] hidden sm:block"
                              title={color.vietnameseName}
                            >
                              {color.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* DETAILED YEAR-BY-YEAR COMPARISON MATRIX TABLE */}
                <div className="mt-8 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-black uppercase text-slate-900 tracking-tight flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>BẢNG MA TRẬN ĐỐI SOÁT LƯỢNG MỰC QUA CÁC NĂM (NĂM x 12 MÀU)</span>
                    </h4>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="py-2.5 px-3">Mã Màu</th>
                          <th className="py-2.5 px-3">Tên Màu & Công Dụng</th>
                          {availableYears.map(yr => (
                            <th key={yr} className="py-2.5 px-3 text-center font-mono font-bold">
                              Năm {yr}
                            </th>
                          ))}
                          <th className="py-2.5 px-3 text-center font-mono font-black text-indigo-900 bg-indigo-50/70 border-l border-indigo-100">
                            TỔNG CỘNG DỒN
                          </th>
                          <th className="py-2.5 px-3 text-center font-bold">Tỷ Lệ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {INK_12_COLORS.map(color => {
                          const total = cumulativeStats.stats[color.code];
                          const pct = cumulativeStats.grandTotalBottles > 0
                            ? ((total / cumulativeStats.grandTotalBottles) * 100).toFixed(1)
                            : '0';

                          return (
                            <tr key={color.code} className="hover:bg-slate-50/80 transition">
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className="px-2.5 py-0.5 rounded text-xs font-black shadow-2xs inline-block"
                                  style={{
                                    backgroundColor: color.hex,
                                    color: color.textColor
                                  }}
                                >
                                  {color.code}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900">{color.name}</div>
                                <div className="text-[11px] text-slate-500">{color.vietnameseName}</div>
                              </td>
                              {availableYears.map(yr => {
                                const qty = cumulativeStats.byYearMatrix[yr]?.[color.code] || 0;
                                return (
                                  <td
                                    key={yr}
                                    className={`py-2.5 px-3 text-center font-mono font-bold ${
                                      qty > 0 ? 'text-slate-900' : 'text-slate-300'
                                    }`}
                                  >
                                    {qty}
                                  </td>
                                );
                              })}
                              <td className="py-2.5 px-3 text-center font-mono font-black text-indigo-900 bg-indigo-50/40 border-l border-indigo-100">
                                {total} bình
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">
                                {pct}%
                              </td>
                            </tr>
                          );
                        })}
                        {/* Summary Total Row */}
                        <tr className="bg-slate-100/90 font-black text-slate-900 border-t-2 border-slate-300">
                          <td className="py-3 px-3" colSpan={2}>
                            TỔNG SỐ BÌNH MỰC TOÀN BỘ 12 MÀU
                          </td>
                          {availableYears.map(yr => {
                            const yearSum = INK_12_COLORS.reduce((acc, c) => {
                              return acc + (cumulativeStats.byYearMatrix[yr]?.[c.code] || 0);
                            }, 0);
                            return (
                              <td key={yr} className="py-3 px-3 text-center font-mono text-sm text-indigo-700">
                                {yearSum}
                              </td>
                            );
                          })}
                          <td className="py-3 px-3 text-center font-mono text-sm text-indigo-950 bg-indigo-100/80 border-l border-indigo-200">
                            {cumulativeStats.grandTotalBottles} bình
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-slate-900">
                            100%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* VIEW 2: RECEIPTS HISTORY LIST (LỊCH SỬ CÁC ĐỢT NHẬP MỰC) */
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <span>DANH SÁCH LỊCH SỬ CÁC ĐỢT NHẬP MỰC</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Theo dõi từng lần nhập hàng từ nhà cung cấp SVP và các đơn vị khác
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenNewImport}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nhập Đợt Mới</span>
            </button>
          </div>

          {inkImports.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Droplet className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-bold text-sm">Chưa có phiếu nhập mực nào</p>
              <p className="text-xs text-slate-400 mt-1">Bấm "+ Nhập Hàng Thủ Công" để thêm đợt mực mới đầu tiên</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3">Mã Phiếu</th>
                    <th className="py-2.5 px-3">Ngày Nhập</th>
                    <th className="py-2.5 px-3">Nhà Cung Cấp</th>
                    <th className="py-2.5 px-3">Chi Tiết 12 Màu Nhập</th>
                    <th className="py-2.5 px-3 text-center">Tổng Số Bình</th>
                    <th className="py-2.5 px-3 text-right">Tổng Tiền</th>
                    <th className="py-2.5 px-3 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {inkImports.map(rec => {
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                          {rec.receiptNumber}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                          {formatDateVN(rec.date)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-black text-xs">
                            {rec.supplier || 'SVP'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1 max-w-[420px]">
                            {INK_12_COLORS.map(c => {
                              const qty = rec.items?.[c.code] || 0;
                              if (qty <= 0) return null;
                              return (
                                <span
                                  key={c.code}
                                  className="px-1.5 py-0.5 rounded text-[11px] font-bold shadow-2xs flex items-center gap-1"
                                  style={{
                                    backgroundColor: c.hex,
                                    color: c.textColor
                                  }}
                                  title={`${c.name}: ${qty} bình`}
                                >
                                  <span>{c.code}:</span>
                                  <span className="font-mono font-black">{qty}</span>
                                </span>
                              );
                            })}
                          </div>
                          {rec.notes && (
                            <div className="text-[11px] text-slate-500 italic mt-1 truncate max-w-[420px]">
                              Ghi chú: {rec.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-sm text-slate-900 whitespace-nowrap">
                          {rec.totalQuantity} {rec.unit || 'bình'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                          {rec.totalCost ? formatCurrency(rec.totalCost) : '---'}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(rec)}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title="Sửa phiếu"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRecordToDelete(rec)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Xóa phiếu"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: NHẬP HÀNG THỦ CÔNG (WITH QUICK-SELECT 12 MÀU MỰC) */}
      {/* ========================================================================= */}
      {isNewImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-gradient-to-tr from-fuchsia-600 to-pink-500 rounded-xl text-white">
                  <Droplet className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    {editingRecord ? 'CẬP NHẬT PHIẾU NHẬP MỰC' : 'NHẬP MỰC IN THỦ CÔNG (HỆ 12 MÀU)'}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Chọn nhanh các màu mực và số lượng bình/hộp cần nhập cho xưởng
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewImportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* Row 1: Thông tin cơ bản (Nhà cung cấp, Ngày, Mã phiếu) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Nhà Cung Cấp (Mặc định SVP) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nhà Cung Cấp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formSupplier}
                    onChange={e => setFormSupplier(e.target.value)}
                    placeholder="VD: SVP"
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                  {/* Quick-chips for Supplier */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[11px] text-slate-400">Gợi ý:</span>
                    {['SVP', 'Canon', 'Minh Khang', 'Tân Phát'].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormSupplier(s)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                          formSupplier === s
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ngày Nhập */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngày Nhập Hàng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* Mã Phiếu Nhập */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã Phiếu Nhập
                  </label>
                  <input
                    type="text"
                    value={formReceiptCode}
                    onChange={e => setFormReceiptCode(e.target.value)}
                    placeholder="Tự động sinh"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-700"
                  />
                </div>
              </div>

              {/* GIAO DIỆN GỢI Ý CHỌN NHANH (QUICK-SELECT) 12 MÀU MỰC */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div>
                    <span className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>GỢI Ý CHỌN NHANH 12 MÀU MỰC (QUICK-SELECT)</span>
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Bấm trực tiếp vào các nút tăng/giảm hoặc chọn trọn bộ 12 màu trong 1 cú click:
                    </p>
                  </div>

                  {/* Batch Action Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleSelectFull12Set(1)}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black transition cursor-pointer shadow-2xs"
                      title="Thêm 1 bình cho cả 12 màu mực"
                    >
                      ⚡ Cả Bộ 12 Màu (+1)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectFull12Set(2)}
                      className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-xs font-black transition cursor-pointer shadow-2xs"
                      title="Thêm 2 bình cho cả 12 màu mực"
                    >
                      ⚡ Cả Bộ 12 Màu (+2)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectBlackGraySet(1)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                      title="Thêm MBK, PBK, GY, PGY, CO"
                    >
                      Bộ Đen & Xám (+1)
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllSelected}
                      className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-[11px] font-bold transition cursor-pointer border border-rose-200"
                    >
                      Về 0
                    </button>
                  </div>
                </div>

                {/* THE 12-COLOR GRID */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                  {INK_12_COLORS.map(color => {
                    const currentQty = formItems[color.code] || 0;
                    const isSelected = currentQty > 0;

                    return (
                      <div
                        key={color.code}
                        className={`p-2.5 rounded-xl border transition flex flex-col justify-between ${
                          isSelected
                            ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500/30'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span
                            className="px-2 py-0.5 rounded text-xs font-black shadow-2xs"
                            style={{
                              backgroundColor: color.hex,
                              color: color.textColor
                            }}
                          >
                            {color.code}
                          </span>
                          <span className={`text-[11px] font-mono font-black ${
                            isSelected ? 'text-indigo-700' : 'text-slate-400'
                          }`}>
                            {currentQty} bình
                          </span>
                        </div>

                        <div>
                          <div className="text-xs font-black text-slate-900 truncate" title={color.name}>
                            {color.name}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate" title={color.vietnameseName}>
                            {color.vietnameseName}
                          </div>
                        </div>

                        {/* Quick adjustment controls */}
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => handleAdjustColorQty(color.code, -1)}
                            disabled={currentQty <= 0}
                            className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          >
                            -
                          </button>

                          <input
                            type="number"
                            min="0"
                            value={currentQty}
                            onChange={e => handleSetColorQty(color.code, parseInt(e.target.value) || 0)}
                            className="w-12 text-center text-xs font-mono font-black py-0.5 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />

                          <button
                            type="button"
                            onClick={() => handleAdjustColorQty(color.code, 1)}
                            className="w-6 h-6 flex items-center justify-center rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Summary Badge */}
                <div className="flex items-center justify-between pt-2 text-xs">
                  <div className="text-slate-600 flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold">Đã chọn:</span>
                    {INK_12_COLORS.filter(c => (formItems[c.code] || 0) > 0).map(c => (
                      <span
                        key={c.code}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{ backgroundColor: c.hex, color: c.textColor }}
                      >
                        {c.code}: {formItems[c.code]}
                      </span>
                    ))}
                    {formTotalQuantity === 0 && (
                      <span className="text-slate-400 italic">Chưa chọn màu nào</span>
                    )}
                  </div>

                  <div className="font-mono font-black text-slate-900 bg-white px-3 py-1 rounded-lg border border-slate-200 shrink-0">
                    Tổng: <span className="text-indigo-600 text-sm">{formTotalQuantity}</span> bình
                  </div>
                </div>
              </div>

              {/* Row 3: Giá nhập & Ghi chú */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Đơn Giá Ước Tính / Bình (VNĐ)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formCostPerBottle}
                    onChange={e => setFormCostPerBottle(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="VD: 880000"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  {typeof formCostPerBottle === 'number' && formCostPerBottle > 0 && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Tổng tiền: <strong>{formatCurrency(formCostPerBottle * formTotalQuantity)}</strong>
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ghi Chú Đợt Nhập Mực
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="VD: Nhập lô mực chính hãng SVP đợt phục vụ mùa cưới"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsNewImportModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-black text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingRecord ? 'Cập Nhật Phiếu' : 'Lưu Phiếu Nhập Mực'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RESET NĂM (XÁC NHẬN AN TOÀN) */}
      {/* ========================================================================= */}
      {isResetConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-3 bg-rose-100 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  RESET DỮ LIỆU MỰC NĂM {selectedYear}?
                </h3>
                <p className="text-xs text-rose-600 font-semibold">
                  Chuẩn bị theo dõi cho chu kỳ năm tiếp theo
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Thao tác này sẽ đặt lại toàn bộ số lượng 12 màu mực của năm <strong>{selectedYear}</strong> về <strong>0</strong> (xóa các phiếu nhập mực thuộc năm {selectedYear}).
              <br /><br />
              Dữ liệu của các năm khác và dữ liệu cộng dồn các năm trước sẽ <strong>không bị ảnh hưởng</strong>. Bạn có chắc chắn muốn tiến hành?
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 mb-5">
              💡 Mẹo: Khi hết năm, bạn bấm Reset để làm sạch bảng theo dõi và bắt đầu ghi nhận mực nhập cho năm mới.
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsResetConfirmModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmResetYear}
                className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xác Nhận Reset Năm {selectedYear}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: XÓA PHIẾU NHẬP MỰC */}
      {/* ========================================================================= */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-5 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-black text-slate-900 mb-2">
              Xóa Phiếu Nhập Mực {recordToDelete.receiptNumber}?
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Bạn có chắc chắn muốn xóa phiếu nhập mực ngày {formatDateVN(recordToDelete.date)} ({recordToDelete.totalQuantity} bình) từ {recordToDelete.supplier}?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteInkImport(recordToDelete.id);
                  setRecordToDelete(null);
                }}
                className="px-3 py-1.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition cursor-pointer"
              >
                Xóa Vĩnh Viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
