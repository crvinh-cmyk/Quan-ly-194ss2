import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  Search,
  Plus,
  RotateCcw,
  Sparkles,
  Check,
  Calendar,
  AlertCircle,
  Clock,
  Trash2,
  FileSpreadsheet,
  ArrowUpDown
} from 'lucide-react';
import { BoardCorePriceMap, BoardCorePriceRow } from '../types';
import {
  getLocalBoardCorePrices,
  subscribeBoardCorePrices,
  saveBoardCorePricesToFirestore,
  DEFAULT_BOARD_CORE_PRICES
} from '../services/firestoreService';
import { parsePhotoSizeScore } from './ProductCostAnalyticsTable';
import { AccessoryMaterialPriceTable } from './AccessoryMaterialPriceTable';

interface BoardCorePriceTableProps {
  currentUserEmail?: string | null;
}

export const BoardCorePriceTable: React.FC<BoardCorePriceTableProps> = ({
  currentUserEmail
}) => {
  const [prices, setPrices] = useState<BoardCorePriceMap>(() => getLocalBoardCorePrices());
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string>('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newSize, setNewSize] = useState('');
  const [newMdf9li, setNewMdf9li] = useState('');
  const [newMdf12li, setNewMdf12li] = useState('');
  const [newFomex9li, setNewFomex9li] = useState('');

  // Subscribe to real-time updates
  useEffect(() => {
    const unsub = subscribeBoardCorePrices((updated) => {
      setPrices(updated);
    });
    return () => unsub();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const formatNumber = (num?: number): string => {
    if (num === undefined || num === null || isNaN(num)) return '';
    return num.toLocaleString('vi-VN');
  };

  const parseNumber = (val: string): number => {
    const clean = val.replace(/\D/g, '');
    return clean ? parseInt(clean, 10) : 0;
  };

  const getSystemTimestamp = (): string => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${min}`;
  };

  // Handle direct cell edit
  const handleCellChange = (
    sizeKey: string,
    field: 'mdf9li' | 'mdf12li' | 'fomex9li',
    rawVal: string
  ) => {
    const numericVal = parseNumber(rawVal);
    const existingRow = prices[sizeKey] || {
      size: sizeKey,
      mdf9li: 0,
      mdf12li: 0,
      fomex9li: 0,
      updatedAt: getSystemTimestamp()
    };

    const updatedRow: BoardCorePriceRow = {
      ...existingRow,
      [field]: numericVal,
      updatedAt: getSystemTimestamp()
    };

    const nextMap = {
      ...prices,
      [sizeKey]: updatedRow
    };

    setPrices(nextMap);
    saveBoardCorePricesToFirestore(nextMap, { email: currentUserEmail });
    showToast(`Đã lưu giá ${field === 'mdf9li' ? 'MDF 9li' : field === 'mdf12li' ? 'MDF 12li' : 'Fomex 9li'} khổ ${sizeKey}: ${formatNumber(numericVal)} đ`);
  };

  // Handle adding a new size
  const handleAddNewSize = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSize = newSize.toLowerCase().replace(/\s+/g, '').replace('*', 'x').trim();
    if (!cleanSize) {
      alert('Vui lòng nhập kích thước ảnh hợp lệ (VD: 60x120, 90x150)');
      return;
    }

    if (prices[cleanSize]) {
      alert(`Khổ ảnh "${cleanSize}" đã có trong danh sách!`);
      return;
    }

    const newRow: BoardCorePriceRow = {
      size: cleanSize,
      mdf9li: parseNumber(newMdf9li),
      mdf12li: parseNumber(newMdf12li),
      fomex9li: parseNumber(newFomex9li),
      updatedAt: getSystemTimestamp()
    };

    const nextMap = {
      ...prices,
      [cleanSize]: newRow
    };

    setPrices(nextMap);
    saveBoardCorePricesToFirestore(nextMap, { email: currentUserEmail });
    showToast(`Đã thêm khổ ảnh ${cleanSize} vào bảng giá cốt vật tư!`);

    setNewSize('');
    setNewMdf9li('');
    setNewMdf12li('');
    setNewFomex9li('');
    setIsAddingNew(false);
  };

  // Handle delete size
  const handleDeleteSize = (sizeKey: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa khổ "${sizeKey}" khỏi bảng giá cốt vật tư?`)) {
      const nextMap = { ...prices };
      delete nextMap[sizeKey];
      setPrices(nextMap);
      saveBoardCorePricesToFirestore(nextMap, { email: currentUserEmail });
      showToast(`Đã xóa khổ ${sizeKey}!`);
    }
  };

  // Reset to default
  const handleResetDefaults = () => {
    if (confirm('Khôi phục toàn bộ bảng giá cốt vật tư về định mức chuẩn ban đầu của Tiệm In 194?')) {
      setPrices(DEFAULT_BOARD_CORE_PRICES);
      saveBoardCorePricesToFirestore(DEFAULT_BOARD_CORE_PRICES, { email: currentUserEmail });
      showToast('Đã khôi phục bảng giá cốt vật tư về mặc định thành công!');
    }
  };

  // Sorted and filtered list (loại bỏ 20x20 và 30x30 theo yêu cầu)
  const sortedRows = useMemo(() => {
    const list = Object.values(prices).filter(
      r => r.size !== '20x20' && r.size !== '30x30' && r.size !== '20*20' && r.size !== '30*30'
    );

    list.sort((a, b) => {
      const scoreA = parsePhotoSizeScore(a.size);
      const scoreB = parsePhotoSizeScore(b.size);
      if (scoreA === scoreB) {
        if (a.isKoreanBorder) return 1;
        if (b.isKoreanBorder) return -1;
        return (a.code || a.size).localeCompare(b.code || b.size);
      }
      return scoreA - scoreB;
    });

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(r =>
      r.size.toLowerCase().includes(q) ||
      (r.code && r.code.toLowerCase().includes(q)) ||
      (r.name && r.name.toLowerCase().includes(q))
    );
  }, [prices, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Toast message */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-900 text-emerald-100 border border-emerald-500/50 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-bounce">
          <Sparkles className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Info Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/60 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shadow-sm shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-slate-900">
                  Bảng Giá Cốt Vật Tư (Ván MDF & Fomex)
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  <Sparkles className="w-3 h-3 text-amber-700" />
                  Tự động đồng bộ 325 mã sản phẩm
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                Đơn giá tại bảng này tự động cấp nguồn cho cột <strong className="text-slate-900">"Ván/Fomex (đ)"</strong> trên{' '}
                <strong className="text-amber-800">Bảng Thống Kê Định Mức Giá Vốn</strong> theo quy tắc{' '}
                <span className="font-mono font-bold text-amber-900 bg-amber-100/70 px-1 py-0.5 rounded">[Loại cốt vật tư] x [Kích thước ảnh]</span>.{' '}
                Đã được cấu hình liên kết chuẩn cho các loại ván MDF 9li, 12li, Fomex 9li và vật tư <strong className="text-emerald-800">Viền Hàn Quốc (1521 9li HQ & 2030 9li HQ)</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <button
              type="button"
              onClick={() => setIsAddingNew(!isAddingNew)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Khổ Ảnh Mới</span>
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              title="Khôi phục lại định mức giá cốt chuẩn ban đầu"
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Giá Chuẩn</span>
            </button>
          </div>
        </div>

        {/* Form thêm khổ mới */}
        {isAddingNew && (
          <form
            onSubmit={handleAddNewSize}
            className="mt-4 pt-4 border-t border-amber-200/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-amber-50/60 p-4 rounded-xl"
          >
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Kích thước ảnh (VD: 60x120):
              </label>
              <input
                type="text"
                value={newSize}
                onChange={(e) => setNewSize(e.target.value)}
                placeholder="60x120"
                required
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Đơn giá Ván MDF 9li (đ):
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={newMdf9li}
                onChange={(e) => setNewMdf9li(formatNumber(parseNumber(e.target.value)))}
                placeholder="0"
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-right text-slate-900 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Đơn giá Ván MDF 12li (đ):
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={newMdf12li}
                onChange={(e) => setNewMdf12li(formatNumber(parseNumber(e.target.value)))}
                placeholder="0"
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-right text-slate-900 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Đơn giá Fomex 9li (đ):
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={newFomex9li}
                onChange={(e) => setNewFomex9li(formatNumber(parseNumber(e.target.value)))}
                placeholder="0"
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-right text-slate-900 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition"
              >
                Lưu Khổ Mới
              </button>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition"
              >
                Hủy
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Filter and stats row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo kích thước hoặc mã vật tư (1521 9li HQ, 2030 9li HQ)..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-600 w-full sm:w-auto justify-between sm:justify-end">
          <span className="font-semibold">
            Đang hiển thị: <strong className="text-amber-700 font-mono">{sortedRows.length}</strong> mục vật tư
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Tự động lưu ngày giờ sửa
          </span>
        </div>
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-white sticky top-0 z-20 select-none shadow-xs">
              <tr>
                <th className="py-3 px-3 w-12 text-center bg-slate-950 font-mono text-[11px]">STT</th>
                <th className="py-3 px-4 w-52 text-amber-300 font-bold">
                  Cột 1: Kích Thước & Mã VT Kho
                </th>
                <th className="py-3 px-3 w-48 text-center bg-slate-800/80">
                  <span className="block font-bold">Cột 2: Ván MDF 9li</span>
                  <span className="block text-[10px] text-amber-300 font-normal">đ / tấm</span>
                </th>
                <th className="py-3 px-3 w-48 text-center bg-slate-800/80">
                  <span className="block font-bold">Cột 3: Ván MDF 12li</span>
                  <span className="block text-[10px] text-amber-300 font-normal">đ / tấm (lõi xanh)</span>
                </th>
                <th className="py-3 px-3 w-48 text-center bg-slate-800/80">
                  <span className="block font-bold">Cột 4: Fomex 9li</span>
                  <span className="block text-[10px] text-amber-300 font-normal">đ / tấm (siêu nhẹ 4K/HD)</span>
                </th>
                <th className="py-3 px-4 min-w-[180px] text-slate-300">
                  <span className="block font-bold">Cột 5: Ngày Sửa Giá Gần Nhất</span>
                  <span className="block text-[10px] text-slate-400 font-normal">Tự động lưu ngày giờ</span>
                </th>
                <th className="py-3 px-3 w-16 text-center">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                    Không tìm thấy mục vật tư nào phù hợp với từ khóa "{searchQuery}"
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, index) => {
                  const isStandardSize = [
                    '13x18', '15x21', '1521 9li HQ', '20x30', '2030 9li HQ', '25x38', '30x45',
                    '35x50', '40x60', '50x75', '60x90', '70x110', '80x120', '100x150',
                    '110x180', '120x240'
                  ].includes(row.code || row.size);

                  const isHQ = row.isKoreanBorder || row.code?.includes('HQ') || row.name?.includes('Hàn Quốc');

                  return (
                    <tr
                      key={`${row.code || row.size}_${index}`}
                      className={`hover:bg-amber-50/40 transition-colors group ${
                        isHQ ? 'bg-emerald-50/30' : ''
                      }`}
                    >
                      {/* STT */}
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono font-medium text-[11px] bg-slate-50/50">
                        {index + 1}
                      </td>

                      {/* Cột 1: Kích thước ảnh / Mã VT Kho */}
                      <td className="py-2.5 px-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-mono font-black text-sm px-2.5 py-0.5 rounded-lg shadow-2xs ${
                              isHQ
                                ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                                : 'bg-amber-100/70 text-amber-950 border border-amber-300/80'
                            }`}>
                              {row.size}
                            </span>
                            {isHQ && (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                                Viền Hàn Quốc
                              </span>
                            )}
                            {row.size === '40x60' && !isHQ && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                Chuẩn xưởng
                              </span>
                            )}
                            {row.size === '60x90' && !isHQ && (
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                Cổng cưới
                              </span>
                            )}
                          </div>
                          {(row.code || row.name) && (
                            <div className="text-[10px] font-mono text-slate-500 mt-1 flex items-center gap-1">
                              <span className="font-bold text-slate-700">Mã VT: {row.code || row.size}</span>
                              <span>—</span>
                              <span className="text-slate-600 italic truncate max-w-[200px]" title={row.name}>{row.name}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Cột 2: Đơn giá Ván MDF 9li (đ/tấm) */}
                      <td className="py-2 px-3 text-center bg-slate-50/30">
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={row.mdf9li !== undefined && row.mdf9li > 0 ? formatNumber(row.mdf9li) : ''}
                            onChange={(e) => handleCellChange(row.size, 'mdf9li', e.target.value)}
                            placeholder="0"
                            title={`Nhập đơn giá Ván MDF 9li cho khổ ${row.size}`}
                            className={`w-full px-3 py-1.5 bg-white border rounded-lg text-right font-mono text-xs focus:bg-amber-50/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden font-bold ${
                              row.mdf9li > 0
                                ? 'border-amber-300 text-amber-950 bg-amber-50/20'
                                : 'border-slate-200 text-slate-400'
                            }`}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none opacity-0 group-hover:opacity-100">
                            đ
                          </span>
                        </div>
                      </td>

                      {/* Cột 3: Đơn giá Ván MDF 12li (đ/tấm) */}
                      <td className="py-2 px-3 text-center bg-slate-50/30">
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={row.mdf12li !== undefined && row.mdf12li > 0 ? formatNumber(row.mdf12li) : ''}
                            onChange={(e) => handleCellChange(row.size, 'mdf12li', e.target.value)}
                            placeholder="0"
                            title={`Nhập đơn giá Ván MDF 12li (lõi xanh chống ẩm) cho khổ ${row.size}`}
                            className={`w-full px-3 py-1.5 bg-white border rounded-lg text-right font-mono text-xs focus:bg-amber-50/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden font-bold ${
                              row.mdf12li > 0
                                ? 'border-blue-300 text-blue-950 bg-blue-50/20'
                                : 'border-slate-200 text-slate-400'
                            }`}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none opacity-0 group-hover:opacity-100">
                            đ
                          </span>
                        </div>
                      </td>

                      {/* Cột 4: Đơn giá Fomex 9li (đ/tấm) */}
                      <td className="py-2 px-3 text-center bg-slate-50/30">
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={row.fomex9li !== undefined && row.fomex9li > 0 ? formatNumber(row.fomex9li) : ''}
                            onChange={(e) => handleCellChange(row.size, 'fomex9li', e.target.value)}
                            placeholder="0"
                            title={`Nhập đơn giá Fomex 9li siêu nhẹ (Ảnh 4K & HD Pro) cho khổ ${row.size}`}
                            className={`w-full px-3 py-1.5 bg-white border rounded-lg text-right font-mono text-xs focus:bg-amber-50/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden font-bold ${
                              row.fomex9li > 0
                                ? 'border-emerald-300 text-emerald-950 bg-emerald-50/20'
                                : 'border-slate-200 text-slate-400'
                            }`}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none opacity-0 group-hover:opacity-100">
                            đ
                          </span>
                        </div>
                      </td>

                      {/* Cột 5: Ngày sửa giá gần nhất */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-600 font-mono text-xs">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{row.updatedAt || 'Hệ thống thiết lập'}</span>
                        </div>
                      </td>

                      {/* Cột 6: Thao tác xóa */}
                      <td className="py-2.5 px-3 text-center">
                        {!isStandardSize ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteSize(row.size)}
                            title="Xóa khổ tùy chỉnh này"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-300 select-none" title="Khổ tiêu chuẩn cố định">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
              <span>Ván MDF 9li: Dành cho Ảnh Lụa Viền (LVST), Lụa Khung (LKST), Mika phổ thông</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300" />
              <span>Ván MDF 12li: Dành cho Ảnh HD Gương (HDST), Mika Khung Titan/K11</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
              <span>Fomex 9li: Dành cho Ảnh 4K (4KST) & Ảnh HD Pro (HDPROST)</span>
            </span>
          </div>
          <div className="font-bold text-amber-900 bg-amber-100/80 px-2.5 py-1 rounded-lg">
            ⚡ Đồng bộ trực tiếp sang Bảng Thống Kê Định Mức
          </div>
        </div>
      </div>

      {/* BẢNG GIÁ VẬT TƯ PHỤ KIỆN (MICA, VIỀN, PHÀO, KEO...) */}
      <AccessoryMaterialPriceTable currentUserEmail={currentUserEmail} />
    </div>
  );
};
