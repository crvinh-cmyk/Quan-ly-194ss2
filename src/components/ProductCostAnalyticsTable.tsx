import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, ProductCostItem, ProductCostMap } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { isPartnerMode } from '../utils/partnerConfig';
import {
  DollarSign, TrendingUp, Calculator, Save, Printer, Download,
  Search, FileText, Sparkles, CheckCircle2, Layers, PieChart,
  RefreshCw, Check, Percent, ArrowUpRight, ArrowDownRight, Info,
  Filter, Eye, Table2
} from 'lucide-react';
import {
  subscribeProductCosts,
  saveProductCostsToFirestore,
  getLocalProductCosts
} from '../services/firestoreService';

/**
 * Danh sách 63 Mã Sản Phẩm chuẩn theo đúng thứ tự gợi ý trong file PDF mẫu của Tiệm In 194
 */
export const PDF_STATS_PRODUCT_CODES: string[] = [
  // Trang 1
  'LVST15*21',
  'MKST15*21',
  'HDST15*21',
  'LVST20*30',
  'MKST20*30',
  'HDST20*30',
  'LVST40*60',
  'MKST40*60',
  'HDST40*60',
  'LVST50*75',
  'MKST50*75',
  'HDST50*75',
  'LVST60*90',
  'MKST60*90',
  'HDST60*90',
  '4KST6096K456',
  '4KST6090TT2',
  'HDPROST60*90K456',
  'HDPROST60*90TT2',
  'HDST60*90K456',
  'HDST60*90K10',
  'HDST60*90TT1',
  'HDST60*90TT2',
  '4KST70*110K456',
  '4KST70*110TT2',
  'HDPROST70*110K456',
  'HDPROST70*110TT2',
  'MKST70*110',
  'HDST70*110',
  'HDST70*110K456',
  'HDST70*110TT1',
  'HDST70*110TT2',
  'MKST80*120',
  'HDST80*120',
  'MKST80*120K456',
  'MKST80*120K11',
  'MKST80*120TT1',
  'MKST80*120TT2',
  'HDST80*120K456',
  'HDST80*120K10',
  'HDST80*120K11',
  'HDST80*120TT1',
  'HDST80*120TT2',
  '4KST80*120K456',
  '4KST80*120TT1',
  'HDPROST80*120K456',
  'HDPROST80*120TT2',
  // Trang 2
  'LVST100*150',
  'MKST100*150K456',
  'MKST100*150K11',
  'HDST100*150K456',
  'HDST100*150K11',
  'HDST100*150TT2',
  '4KST100*150K456',
  '4KST100*150TT2',
  'HDPROST100*150K456',
  'HDPROST100*150TT2',
  'HDPROST110*180TT2',
  'HDPROST110*180K45',
  '4KST110*180K456',
  '4KST110*180TT2',
  'HDST110*180K11',
  'HDST110*180TT2'
];

interface ProductCostAnalyticsTableProps {
  products: Product[];
  currentUserEmail?: string | null;
}

export const ProductCostAnalyticsTable: React.FC<ProductCostAnalyticsTableProps> = ({
  products,
  currentUserEmail
}) => {
  const [costMap, setCostMap] = useState<ProductCostMap>(() => getLocalProductCosts());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'filled' | 'empty'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to real-time updates from Firestore
  useEffect(() => {
    const unsubscribe = subscribeProductCosts(
      (newCosts) => {
        setCostMap(newCosts);
      },
      (error) => {
        console.error('Error subscribing to product costs:', error);
      }
    );
    return () => unsubscribe();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Helper to find or infer product info from the catalog
  const resolveProductForCode = (code: string) => {
    const cleanCode = code.toUpperCase().trim();
    // 1. Try exact match in GIÁ STUDIO
    let matched = products.find(
      p => p.code.toUpperCase().trim() === cleanCode && p.category === 'GIÁ STUDIO'
    );
    // 2. Try exact match in any category
    if (!matched) {
      matched = products.find(p => p.code.toUpperCase().trim() === cleanCode);
    }
    // 3. Try flexible match (ignore *, x, X, _)
    if (!matched) {
      const normInput = cleanCode.replace(/[*xX_\-]/g, '');
      matched = products.find(p => p.code.toUpperCase().replace(/[*xX_\-]/g, '') === normInput);
    }

    // 4. Try base product without framing suffixes (K456, K45, K10, K11, TT1, TT2, etc.)
    let baseMatched: Product | undefined = undefined;
    if (!matched) {
      const stripped = cleanCode.replace(/(K456|K45|K10|K11|TT1|TT2)$/i, '');
      baseMatched = products.find(p => {
        const pNorm = p.code.toUpperCase().replace(/[*xX_\-]/g, '');
        const sNorm = stripped.replace(/[*xX_\-]/g, '');
        return (pNorm === sNorm || p.code.toUpperCase() === stripped) && p.category === 'GIÁ STUDIO';
      });

      if (!baseMatched) {
        // Also try HDST prefix for 4KST or HDPROST
        const hdCode = stripped.replace(/^(4KST|HDPROST)/, 'HDST');
        baseMatched = products.find(p => {
          const pNorm = p.code.toUpperCase().replace(/[*xX_\-]/g, '');
          const sNorm = hdCode.replace(/[*xX_\-]/g, '');
          return (pNorm === sNorm || p.code.toUpperCase() === hdCode) && p.category === 'GIÁ STUDIO';
        });
      }
    }

    if (matched) {
      return {
        matchedProduct: matched,
        name: matched.name,
        size: matched.size,
        fullTitle: `${matched.name} (${matched.size})`,
        studioPrice: matched.price
      };
    }

    if (baseMatched) {
      return {
        matchedProduct: baseMatched,
        name: baseMatched.name,
        size: baseMatched.size,
        fullTitle: `${baseMatched.name} (${baseMatched.size})`,
        studioPrice: baseMatched.price
      };
    }

    // Infer name and size if not found in catalog
    let size = '';
    const sizeMatch = cleanCode.match(/(\d{2,3})[*xX](\d{2,3})/);
    if (sizeMatch) {
      size = `${sizeMatch[1]}*${sizeMatch[2]}`;
    } else if (cleanCode.includes('6096')) {
      size = '60*96';
    } else if (cleanCode.includes('6090')) {
      size = '60*90';
    }

    let baseName = 'Ảnh Hoàn Thiện';
    if (cleanCode.startsWith('LVST')) baseName = 'Ảnh Lụa Viền Bo Viền';
    else if (cleanCode.startsWith('MKST')) {
      baseName = cleanCode.includes('K456') ? 'Ảnh Mika Khung K456'
        : cleanCode.includes('K11') ? 'Ảnh Mika Khung K11'
        : cleanCode.includes('TT1') ? 'Ảnh Mika Khung Titan 1'
        : cleanCode.includes('TT2') ? 'Ảnh Mika Khung Titan 2'
        : 'Ảnh Mika Phổ Thông Bo Viền';
    } else if (cleanCode.startsWith('HDST')) {
      baseName = cleanCode.includes('K456') ? 'Ảnh HD Gương Khung K456'
        : cleanCode.includes('K10') ? 'Ảnh HD Gương Khung K10'
        : cleanCode.includes('K11') ? 'Ảnh HD Gương Khung K11'
        : cleanCode.includes('TT1') ? 'Ảnh HD Gương Khung Titan 1'
        : cleanCode.includes('TT2') ? 'Ảnh HD Gương Khung Titan 2'
        : 'Ảnh HD Gương Siêu Bóng Bo Viền';
    } else if (cleanCode.startsWith('4KST')) {
      baseName = cleanCode.includes('K456') ? 'Ảnh 4K Siêu Nét Khung K456'
        : cleanCode.includes('TT1') ? 'Ảnh 4K Siêu Nét Khung Titan 1'
        : cleanCode.includes('TT2') ? 'Ảnh 4K Siêu Nét Khung Titan 2'
        : 'Ảnh 4K Siêu Nét Bo Viền';
    } else if (cleanCode.startsWith('HDPROST')) {
      baseName = cleanCode.includes('K456') || cleanCode.includes('K45') ? 'Ảnh HD Pro Siêu Nét Khung K456'
        : cleanCode.includes('TT2') ? 'Ảnh HD Pro Siêu Nét Khung Titan 2'
        : 'Ảnh HD Pro Siêu Nét';
    }

    return {
      matchedProduct: undefined,
      name: baseName,
      size: size || 'Tiêu chuẩn',
      fullTitle: `${baseName} ${size ? `(${size})` : ''}`.trim(),
      studioPrice: 0
    };
  };

  // Compile 63 table rows
  const compiledRows = useMemo(() => {
    return PDF_STATS_PRODUCT_CODES.map((code, idx) => {
      const prodInfo = resolveProductForCode(code);
      const userCosts = costMap[code] || {};

      const ink = userCosts.ink || 0;
      const paper = userCosts.paper || 0;
      const board = userCosts.board || 0;
      const film = userCosts.film || 0;
      const frame = userCosts.frame || 0;
      const other = userCosts.other || 0;

      const totalCost = ink + paper + board + film + frame + other;
      const studioPrice = (userCosts.manualStudioPrice !== undefined && userCosts.manualStudioPrice > 0)
        ? userCosts.manualStudioPrice
        : prodInfo.studioPrice;
      const grossProfit = studioPrice > 0 ? studioPrice - totalCost : 0;

      // 1. Tỷ suất Lợi Nhuận Gộp / Giá Bán (%) = (Lợi Nhuận Gộp / Giá Bán) * 100%
      const marginOnPrice = studioPrice > 0 ? (grossProfit / studioPrice) * 100 : 0;

      const hasCostData = totalCost > 0;

      return {
        stt: idx + 1,
        code,
        name: prodInfo.name,
        size: prodInfo.size,
        fullTitle: prodInfo.fullTitle,
        studioPrice,
        matchedProduct: prodInfo.matchedProduct,
        ink: userCosts.ink,
        paper: userCosts.paper,
        board: userCosts.board,
        film: userCosts.film,
        frame: userCosts.frame,
        other: userCosts.other,
        totalCost,
        grossProfit,
        marginOnPrice,
        hasCostData
      };
    });
  }, [costMap, products]);

  // Filter rows
  const filteredRows = useMemo(() => {
    return compiledRows.filter(r => {
      if (filterStatus === 'filled' && !r.hasCostData) return false;
      if (filterStatus === 'empty' && r.hasCostData) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.size.toLowerCase().includes(q) ||
        r.fullTitle.toLowerCase().includes(q)
      );
    });
  }, [compiledRows, searchQuery, filterStatus]);

  // Summary statistics across all 63 items
  const statsSummary = useMemo(() => {
    const totalItems = compiledRows.length;
    const filledItems = compiledRows.filter(r => r.hasCostData).length;
    const filledRowsList = compiledRows.filter(r => r.hasCostData && r.studioPrice > 0);

    const totalStudioValue = compiledRows.reduce((sum, r) => sum + r.studioPrice, 0);
    const totalCostValue = compiledRows.reduce((sum, r) => sum + r.totalCost, 0);

    const avgMarginOnPrice = filledRowsList.length > 0
      ? filledRowsList.reduce((sum, r) => sum + r.marginOnPrice, 0) / filledRowsList.length
      : 0;

    return {
      totalItems,
      filledItems,
      totalStudioValue,
      totalCostValue,
      avgMarginOnPrice: Math.round(avgMarginOnPrice * 10) / 10
    };
  }, [compiledRows]);

  // Handle cell input change
  const handleCostChange = (code: string, field: keyof ProductCostItem, rawVal: string) => {
    if (isPartnerMode()) return; // Chế độ đối tác chỉ xem báo cáo giá thành & lời lãi, không sửa giá vốn gốc
    const val = rawVal === '' ? undefined : Math.max(0, Number(rawVal.replace(/[^0-9]/g, '')) || 0);

    setCostMap(prev => {
      const current = prev[code] || {};
      const updatedItem: ProductCostItem = {
        ...current,
        [field]: val
      };

      const nextMap = {
        ...prev,
        [code]: updatedItem
      };

      // Debounced auto-save to Firestore
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveProductCostsToFirestore(nextMap).catch(err => {
          console.error('Error auto-saving product costs:', err);
        });
      }, 800);

      return nextMap;
    });
  };

  // Manual explicit save button
  const handleManualSave = async () => {
    if (isPartnerMode()) return;
    setIsSaving(true);
    try {
      await saveProductCostsToFirestore(costMap);
      showToast('Đã lưu thành công toàn bộ bảng giá vốn lên Cloud Firestore!');
    } catch (e) {
      console.error('Save error:', e);
      showToast('Lỗi khi lưu bảng giá vốn lên Firestore!');
    } finally {
      setIsSaving(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'STT',
      'Mã Sản Phẩm',
      'Tên và Kích Thước Sản Phẩm',
      'Mực',
      'Giấy',
      'Ván/Fomex',
      'Màng Ép',
      'Khung/Viền',
      'Khác',
      'Tổng Giá Vốn',
      'Giá Bán Sỉ/Studio',
      'Lợi Nhuận Gộp Ước Tính',
      'Tỷ Suất LNG / Giá Bán (%)'
    ];

    const rows = compiledRows.map(r => [
      r.stt,
      `"${r.code}"`,
      `"${r.fullTitle}"`,
      r.ink || 0,
      r.paper || 0,
      r.board || 0,
      r.film || 0,
      r.frame || 0,
      r.other || 0,
      r.totalCost,
      r.studioPrice,
      r.grossProfit,
      `${r.marginOnPrice.toFixed(1)}%`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bang_Dinh_Muc_Gia_Von_LNG_194_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print view
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold border border-amber-500 animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER & CONTROL PANEL */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-amber-500/10 text-amber-700 rounded-xl">
                <Table2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  Bảng Thống Kê Định Mức Giá Vốn & Tỷ Suất Lợi Nhuận Gộp
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-mono">
                    Mẫu Chuẩn Tiệm In 194 (63 Mã)
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tự động liên kết Tên hàng & Giá bán Studio từ <strong>Bảng Giá Sản Phẩm</strong>. Tự động tính <strong>Tổng Giá Vốn</strong>, <strong>Lợi Nhuận Gộp</strong> và <strong>Tỷ Suất LNG / Giá Bán</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              title="Xuất file Excel / CSV đầy đủ 63 dòng"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Xuất Excel / CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              title="In bảng thống kê"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>In Bảng</span>
            </button>

            <button
              type="button"
              onClick={handleManualSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu Lên Cloud</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2 SUMMARY STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] text-slate-500 font-bold block">Tổng số mã theo dõi</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-mono text-xl sm:text-2xl font-black text-slate-900">{statsSummary.totalItems} mã</span>
              <span className="text-[11px] font-semibold text-emerald-700">
                (Đã nhập: {statsSummary.filledItems}/{statsSummary.totalItems})
              </span>
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
            <span className="text-[11px] text-amber-800 font-bold block">Tỷ Suất LNG / Giá Bán TB</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-mono text-xl sm:text-2xl font-black text-amber-950">
                {statsSummary.avgMarginOnPrice > 0 ? `${statsSummary.avgMarginOnPrice}%` : '—'}
              </span>
              <span className="text-[10px] text-amber-700">
                (Biên lãi gộp)
              </span>
            </div>
          </div>
        </div>

        {/* SEARCH AND FILTER BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã hàng (VD: LVST, HDST, 4K, K456, TT2) hoặc kích thước..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-500 font-medium">Lọc:</span>
            {[
              { id: 'all' as const, label: `Tất cả (${compiledRows.length})` },
              { id: 'filled' as const, label: `Đã có giá vốn (${statsSummary.filledItems})` },
              { id: 'empty' as const, label: `Chưa nhập (${statsSummary.totalItems - statsSummary.filledItems})` }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterStatus === tab.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SPREADSHEET TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-900 text-white font-bold border-b border-slate-800 shadow-xs">
              <tr>
                <th className="py-3 px-2 w-10 text-center bg-slate-950 font-mono text-[11px]">STT</th>
                <th className="py-3 px-3 w-36 text-amber-300 font-mono text-xs">Mã Sản Phẩm</th>
                <th className="py-3 px-3 min-w-[200px]">Tên và Kích Thước Sản Phẩm</th>
                <th className="py-3 px-2 w-24 text-center bg-slate-800/80">Mực (đ)</th>
                <th className="py-3 px-2 w-24 text-center bg-slate-800/80">Giấy (đ)</th>
                <th className="py-3 px-2 w-28 text-center bg-slate-800/80">Ván/Fomex (đ)</th>
                <th className="py-3 px-2 w-24 text-center bg-slate-800/80">Màng Ép (đ)</th>
                <th className="py-3 px-2 w-28 text-center bg-slate-800/80">Khung/Viền (đ)</th>
                <th className="py-3 px-2 w-24 text-center bg-slate-800/80">Khác (đ)</th>
                <th className="py-3 px-3 w-32 text-right bg-amber-950/70 text-amber-300 border-l border-amber-900/50">
                  Tổng Giá Vốn
                </th>
                <th className="py-3 px-3 w-32 text-right bg-indigo-950/70 text-indigo-300 border-l border-indigo-900/50">
                  Giá Bán Sỉ/Studio
                </th>
                <th className="py-3 px-3 w-36 text-right bg-emerald-950/70 text-emerald-300 border-l border-emerald-900/50">
                  Lợi Nhuận Gộp
                </th>
                <th className="py-3 px-3 w-32 text-center bg-amber-900/80 text-amber-200 border-l border-amber-800" title="Tỷ suất LNG / Giá bán Studio (%) = (Lợi Nhuận Gộp / Giá Bán Sỉ) * 100%">
                  Tỷ Suất / Giá Bán
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredRows.map((row) => {
                // Color badge for profit margin on price
                const getMarginBadgeClass = (margin: number, hasCost: boolean) => {
                  if (!hasCost) return 'bg-slate-100 text-slate-400';
                  if (margin >= 60) return 'bg-emerald-100 text-emerald-900 font-extrabold border border-emerald-300';
                  if (margin >= 40) return 'bg-sky-100 text-sky-900 font-bold border border-sky-300';
                  if (margin >= 20) return 'bg-amber-100 text-amber-900 font-bold border border-amber-300';
                  if (margin > 0) return 'bg-orange-100 text-orange-900 font-bold border border-orange-300';
                  return 'bg-rose-100 text-rose-900 font-black border border-rose-300';
                };

                return (
                  <tr key={row.code} className="hover:bg-amber-50/30 transition-colors group">
                    {/* STT */}
                    <td className="py-2.5 px-2 text-center text-slate-400 font-mono font-medium text-[11px] bg-slate-50/50">
                      {row.stt}
                    </td>

                    {/* Mã Sản Phẩm */}
                    <td className="py-2.5 px-3 font-mono font-black text-amber-950 bg-amber-50/40 text-xs">
                      {row.code}
                    </td>

                    {/* Tên và Kích Thước Sản Phẩm (Tự động liên kết) */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900 text-xs">
                        {row.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                          Khổ: {row.size}
                        </span>
                        {row.matchedProduct ? (
                          <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-0.5">
                            <Check className="w-3 h-3 text-emerald-600" />
                            Đã khớp bảng giá
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">
                            (Quy chuẩn gợi ý)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 1. Mực */}
                    <td className="py-1.5 px-1.5 text-center bg-slate-50/30">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.ink !== undefined ? formatNumber(row.ink) : ''}
                        onChange={(e) => handleCostChange(row.code, 'ink', e.target.value)}
                        placeholder="0"
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-right font-mono text-xs focus:bg-amber-50/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden"
                      />
                    </td>

                    {/* 2. Giấy */}
                    <td className="py-1.5 px-1.5 text-center bg-slate-50/30">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.paper !== undefined ? formatNumber(row.paper) : ''}
                        onChange={(e) => handleCostChange(row.code, 'paper', e.target.value)}
                        placeholder="0"
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-right font-mono text-xs focus:bg-amber-50/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden"
                      />
                    </td>

                    {/* 3. Ván / Fomex */}
                    <td className="py-1.5 px-1.5 text-center bg-slate-50/30">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.board !== undefined ? formatNumber(row.board) : ''}
                        onChange={(e) => handleCostChange(row.code, 'board', e.target.value)}
                        placeholder="0"
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-right font-mono text-xs focus:bg-amber-50/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden"
                      />
                    </td>

                    {/* 4. Màng Ép */}
                    <td className="py-1.5 px-1.5 text-center bg-slate-50/30">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.film !== undefined ? formatNumber(row.film) : ''}
                        onChange={(e) => handleCostChange(row.code, 'film', e.target.value)}
                        placeholder="0"
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-right font-mono text-xs focus:bg-amber-50/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden"
                      />
                    </td>

                    {/* 5. Khung / Viền */}
                    <td className="py-1.5 px-1.5 text-center bg-slate-50/30">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.frame !== undefined ? formatNumber(row.frame) : ''}
                        onChange={(e) => handleCostChange(row.code, 'frame', e.target.value)}
                        placeholder="0"
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-right font-mono text-xs focus:bg-amber-50/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden"
                      />
                    </td>

                    {/* 6. Khác */}
                    <td className="py-1.5 px-1.5 text-center bg-slate-50/30">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.other !== undefined ? formatNumber(row.other) : ''}
                        onChange={(e) => handleCostChange(row.code, 'other', e.target.value)}
                        placeholder="0"
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-right font-mono text-xs focus:bg-amber-50/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden"
                      />
                    </td>

                    {/* TỔNG GIÁ VỐN (Tự động tính) */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 bg-amber-50/30 border-l border-slate-200 text-xs">
                      {row.hasCostData ? (
                        <span className="text-amber-950 font-black">
                          {formatCurrency(row.totalCost)}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">—</span>
                      )}
                    </td>

                    {/* GIÁ BÁN SỈ / STUDIO (Tự động liên kết từ Bảng Giá SP, có thể sửa trực tiếp) */}
                    <td className="py-1.5 px-2 text-right font-mono font-black text-indigo-900 bg-indigo-50/20 border-l border-slate-200 text-xs">
                      <div className="flex items-center justify-end">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.studioPrice > 0 ? formatNumber(row.studioPrice) : ''}
                          onChange={(e) => handleCostChange(row.code, 'manualStudioPrice', e.target.value)}
                          placeholder="Chưa cài"
                          title="Giá Bán Sỉ / Studio (Tự động liên kết từ Bảng Giá SP, có thể sửa trực tiếp)"
                          className="w-24 px-1.5 py-1 bg-white/70 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg text-right font-mono text-xs font-black text-indigo-950 focus:ring-1 focus:ring-indigo-500 outline-hidden"
                        />
                      </div>
                    </td>

                    {/* LỢI NHUẬN GỘP ƯỚC TÍNH (Giá Bán - Giá Vốn) */}
                    <td className="py-2.5 px-3 text-right font-mono font-black border-l border-slate-200 text-xs bg-emerald-50/20">
                      {row.hasCostData && row.studioPrice > 0 ? (
                        <span className={row.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                          {row.grossProfit < 0 ? '-' : ''}{formatCurrency(Math.abs(row.grossProfit))}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">—</span>
                      )}
                    </td>

                    {/* TỶ SUẤT LNG / GIÁ BÁN (%) (Hàm yêu cầu của người dùng) */}
                    <td className="py-2.5 px-3 text-center border-l border-slate-200">
                      {row.hasCostData && row.studioPrice > 0 ? (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono ${getMarginBadgeClass(row.marginOnPrice, true)}`}>
                          {row.marginOnPrice >= 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          <span>{row.marginOnPrice.toFixed(1)}%</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* TABLE FOOTER / GUIDELINES */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Công thức:</strong> Tổng Giá Vốn = (Mực + Giấy + Ván/Fomex + Màng Ép + Khung/Viền + Khác). Lợi Nhuận Gộp = (Giá Studio - Giá Vốn). Tỷ Suất / Giá Bán = (LNG / Giá Studio) * 100%.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-500 font-medium">
            <span>💾 Dữ liệu tự động đồng bộ thời gian thực lên Firebase Cloud Firestore</span>
          </div>
        </div>
      </div>
    </div>
  );
};
