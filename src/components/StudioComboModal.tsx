import React, { useState, useMemo } from 'react';
import { StudioCombo, ComboItem, Product, Customer, ProductCategory } from '../types';
import { formatCurrency } from '../utils/formatters';
import {
  Sparkles, Plus, Trash2, Edit3, Check, X, Search, Star,
  Layers, ChevronRight, Tag, Building2, AlertCircle, ShoppingBag, ArrowRight, Save
} from 'lucide-react';

interface StudioComboModalProps {
  combos: StudioCombo[];
  products: Product[];
  customers: Customer[];
  currentCustomerName?: string;
  currentCustomerId?: string;
  onSelectCombo: (combo: StudioCombo) => void;
  onSaveCombo: (combo: StudioCombo) => void;
  onDeleteCombo: (comboId: string) => void;
  onClose: () => void;
  initialCreateForStudio?: string;
  initialRowsFromOrder?: {
    productCode: string;
    productName: string;
    size: string;
    quantity: number;
    note?: string;
  }[];
}

export const StudioComboModal: React.FC<StudioComboModalProps> = ({
  combos,
  products,
  customers,
  currentCustomerName = '',
  currentCustomerId = '',
  onSelectCombo,
  onSaveCombo,
  onDeleteCombo,
  onClose,
  initialCreateForStudio,
  initialRowsFromOrder
}) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'create'>('browse');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStudio, setFilterStudio] = useState<string>('all');

  // Editing state
  const [editingComboId, setEditingComboId] = useState<string | null>(null);
  const [comboName, setComboName] = useState('');
  const [assignedStudio, setAssignedStudio] = useState<string>(initialCreateForStudio || currentCustomerName || 'Dùng chung');
  const [description, setDescription] = useState('');
  const [comboItems, setComboItems] = useState<ComboItem[]>([]);
  const [formError, setFormError] = useState('');

  // Initial populate if creating from current order
  React.useEffect(() => {
    if (initialRowsFromOrder && initialRowsFromOrder.length > 0) {
      setActiveTab('create');
      const studio = currentCustomerName || initialCreateForStudio || 'Dùng chung';
      setAssignedStudio(studio);
      setComboName(studio !== 'Dùng chung' ? `Combo ${studio}` : 'Combo Cưới Mới');
      setComboItems(initialRowsFromOrder.map((r, idx) => ({
        id: `ci-${Date.now()}-${idx}`,
        productCode: r.productCode || '',
        productName: r.productName || '',
        size: r.size || '',
        quantity: r.quantity > 0 ? r.quantity : 1,
        note: r.note || ''
      })));
    }
  }, [initialRowsFromOrder, currentCustomerName, initialCreateForStudio]);

  // Unique studios from customer list and combos
  const availableStudioNames = useMemo(() => {
    const set = new Set<string>();
    set.add('Dùng chung');
    customers.forEach(c => {
      if (c.studioName && c.studioName.trim()) set.add(c.studioName.trim());
      else if (c.name && c.name.trim()) set.add(c.name.trim());
    });
    combos.forEach(cb => {
      if (cb.studioName && cb.studioName.trim()) set.add(cb.studioName.trim());
    });
    return Array.from(set);
  }, [customers, combos]);

  // Filtered combos
  const filteredCombos = useMemo(() => {
    return combos.filter(c => {
      // Filter by studio
      if (filterStudio !== 'all') {
        if (filterStudio === 'suggested' && currentCustomerName) {
          const matchName = (c.studioName || '').toLowerCase().includes(currentCustomerName.toLowerCase()) ||
            currentCustomerName.toLowerCase().includes((c.studioName || '').toLowerCase()) ||
            c.name.toLowerCase().includes(currentCustomerName.toLowerCase());
          if (!matchName && c.studioName !== 'Dùng chung') return false;
        } else if (c.studioName !== filterStudio) {
          return false;
        }
      }

      // Search term
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.studioName && c.studioName.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        c.items.some(it => it.productCode.toLowerCase().includes(q) || it.productName.toLowerCase().includes(q))
      );
    });
  }, [combos, filterStudio, searchTerm, currentCustomerName]);

  // Handle open create new
  const handleOpenCreate = () => {
    setEditingComboId(null);
    setComboName(currentCustomerName ? `Combo ${currentCustomerName}` : '');
    setAssignedStudio(currentCustomerName || 'Dùng chung');
    setDescription('');
    setComboItems([
      {
        id: `ci-${Date.now()}-1`,
        productCode: '',
        productName: '',
        size: '',
        quantity: 1,
        note: ''
      }
    ]);
    setFormError('');
    setActiveTab('create');
  };

  // Handle open edit
  const handleOpenEdit = (combo: StudioCombo) => {
    setEditingComboId(combo.id);
    setComboName(combo.name);
    setAssignedStudio(combo.studioName || 'Dùng chung');
    setDescription(combo.description || '');
    setComboItems(combo.items && combo.items.length > 0 ? [...combo.items] : [
      {
        id: `ci-${Date.now()}-1`,
        productCode: '',
        productName: '',
        size: '',
        quantity: 1,
        note: ''
      }
    ]);
    setFormError('');
    setActiveTab('create');
  };

  // Row item changes
  const handleItemChange = (idx: number, field: keyof ComboItem, val: any) => {
    setComboItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleSelectProductForComboItem = (idx: number, productCode: string) => {
    const prod = products.find(p => p.code.toLowerCase() === productCode.toLowerCase());
    if (prod) {
      setComboItems(prev => {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          productCode: prod.code,
          productName: prod.name,
          size: prod.size,
          defaultPrice: prod.price
        };
        return next;
      });
    }
  };

  const handleAddRow = () => {
    setComboItems(prev => [
      ...prev,
      {
        id: `ci-${Date.now()}-${prev.length + 1}`,
        productCode: '',
        productName: '',
        size: '',
        quantity: 1,
        note: ''
      }
    ]);
  };

  const handleRemoveRow = (idx: number) => {
    setComboItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comboName.trim()) {
      setFormError('Vui lòng nhập tên Combo');
      return;
    }

    const validItems = comboItems.filter(it => it.productCode.trim() || it.productName.trim());
    if (validItems.length === 0) {
      setFormError('Vui lòng thêm ít nhất 1 sản phẩm vào Combo');
      return;
    }

    const matchingCustomer = customers.find(c =>
      c.name.toLowerCase() === assignedStudio.toLowerCase() ||
      (c.studioName && c.studioName.toLowerCase() === assignedStudio.toLowerCase())
    );

    const savedCombo: StudioCombo = {
      id: editingComboId || `combo-${Date.now()}`,
      name: comboName.trim(),
      studioName: assignedStudio.trim(),
      customerId: matchingCustomer ? matchingCustomer.id : undefined,
      description: description.trim(),
      items: validItems.map((it, idx) => ({
        ...it,
        id: it.id || `ci-${Date.now()}-${idx}`
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSaveCombo(savedCombo);
    setActiveTab('browse');
    setEditingComboId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-850 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shadow-md font-black">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base uppercase tracking-tight text-white">
                  Gói Combo Sản Phẩm Theo Studio
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Chọn Siêu Nhanh
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Đưa các sản phẩm quen thuộc mà Studio hay mua nhất vào 1 chạm để lên đơn trong 2 giây
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'browse'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Danh Sách Combo ({combos.length})</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'create'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{editingComboId ? 'Chỉnh Sửa Combo' : '+ Tạo Combo Mới'}</span>
            </button>
          </div>

          {currentCustomerName && (
            <span className="text-xs text-amber-900 bg-amber-100/70 border border-amber-300 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-amber-700" />
              Đang chọn: <strong>{currentCustomerName}</strong>
            </span>
          )}
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'browse' ? (
            <div className="space-y-4">
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm tên combo, studio, mã sản phẩm trong combo..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <select
                  value={filterStudio}
                  onChange={(e) => setFilterStudio(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer w-full sm:w-auto"
                >
                  <option value="all">📁 Tất cả Studio & Gói</option>
                  {currentCustomerName && (
                    <option value="suggested">⭐ Đề xuất riêng cho: {currentCustomerName}</option>
                  )}
                  {availableStudioNames.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Combo Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredCombos.map(combo => {
                  const isSuggestedForCurrent = currentCustomerName && (
                    (combo.studioName || '').toLowerCase().includes(currentCustomerName.toLowerCase()) ||
                    currentCustomerName.toLowerCase().includes((combo.studioName || '').toLowerCase()) ||
                    combo.name.toLowerCase().includes(currentCustomerName.toLowerCase())
                  );

                  return (
                    <div
                      key={combo.id}
                      className={`p-4 rounded-2xl border transition flex flex-col justify-between gap-3 relative ${
                        isSuggestedForCurrent
                          ? 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white border-amber-400 shadow-md ring-2 ring-amber-400/30'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-sm'
                      }`}
                    >
                      <div>
                        {/* Top Badge & Actions */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                              combo.studioName === 'Dùng chung'
                                ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                : 'bg-blue-100 text-blue-900 border border-blue-200'
                            }`}>
                              🏢 {combo.studioName || 'Dùng chung'}
                            </span>

                            {isSuggestedForCurrent && (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-amber-500 text-slate-950 flex items-center gap-1 shadow-2xs">
                                <Star className="w-3 h-3 fill-slate-950" />
                                Đề Xuất Phù Hợp
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(combo)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Chỉnh sửa combo"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Bạn có chắc chắn muốn xóa "${combo.name}"?`)) {
                                  onDeleteCombo(combo.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Xóa combo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <h4 className="font-extrabold text-sm text-slate-900 leading-snug">
                          {combo.name}
                        </h4>
                        {combo.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                            {combo.description}
                          </p>
                        )}

                        {/* Items in combo list */}
                        <div className="mt-3 space-y-1.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Sản phẩm trong combo ({combo.items.length}):
                          </p>
                          {combo.items.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-slate-700">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[11px] bg-white border border-slate-200 text-amber-900 shrink-0">
                                  {it.quantity}x
                                </span>
                                <span className="font-bold text-slate-900 truncate">
                                  {it.productCode}
                                </span>
                                <span className="text-slate-500 text-[11px] truncate">
                                  - {it.productName} ({it.size})
                                </span>
                              </div>
                              {it.note && (
                                <span className="text-[10px] text-amber-700 bg-amber-50 px-1 rounded shrink-0 ml-1">
                                  {it.note}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Apply Button */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCombo(combo);
                          onClose();
                        }}
                        className={`w-full py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-xs ${
                          isSuggestedForCurrent
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-amber-500/20'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Áp Dụng Combo Này Vào Hóa Đơn Ngay ⚡</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {filteredCombos.length === 0 && (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Không tìm thấy combo nào phù hợp.</p>
                  <button
                    type="button"
                    onClick={handleOpenCreate}
                    className="mt-3 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    + Tạo Combo Ngay
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* CREATE / EDIT FORM */
            <form onSubmit={handleSaveForm} className="space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên Gói Combo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={comboName}
                    onChange={(e) => setComboName(e.target.value)}
                    placeholder="Ví dụ: Combo Thu Hằng Studio (Cưới VIP)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Gán Dành Riêng Cho Studio / Khách Hàng
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      list="studio-name-list"
                      value={assignedStudio}
                      onChange={(e) => setAssignedStudio(e.target.value)}
                      placeholder="Chọn hoặc nhập tên Studio (VD: Thu Hằng Studio)"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    <datalist id="studio-name-list">
                      {availableStudioNames.map(s => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                    <button
                      type="button"
                      onClick={() => setAssignedStudio('Dùng chung')}
                      className="px-2.5 py-1 text-[11px] bg-slate-200 hover:bg-slate-300 rounded-xl text-slate-700 font-semibold shrink-0 cursor-pointer"
                    >
                      Dùng chung
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mô Tả / Ghi Chú Gói Combo
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ví dụ: Gồm 1 ảnh cổng HD 60x90 bo viền vàng, 2 ảnh bàn HD 20x30, 1 album mở phẳng 20x30..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Items List in Combo */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-600" />
                    Danh Sách Sản Phẩm Trong Combo ({comboItems.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm Dòng Sản Phẩm
                  </button>
                </div>

                <div className="space-y-2 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="py-2 px-2.5 w-10 text-center">#</th>
                        <th className="py-2 px-2.5 w-36">Mã Sản Phẩm</th>
                        <th className="py-2 px-2.5">Tên Sản Phẩm</th>
                        <th className="py-2 px-2.5 w-24">Kích Thước</th>
                        <th className="py-2 px-2.5 w-20 text-center">Số Lượng</th>
                        <th className="py-2 px-2.5">Ghi Chú Bo Viền / Yêu Cầu</th>
                        <th className="py-2 px-2 w-10 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comboItems.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50">
                          <td className="py-2 px-2.5 text-center text-slate-400 font-mono font-bold">
                            {idx + 1}
                          </td>

                          {/* Product code with quick auto-complete datalist */}
                          <td className="py-1.5 px-2">
                            <input
                              type="text"
                              list={`product-code-list-${idx}`}
                              value={item.productCode}
                              onChange={(e) => {
                                handleItemChange(idx, 'productCode', e.target.value);
                                handleSelectProductForComboItem(idx, e.target.value);
                              }}
                              placeholder="HDST60*90"
                              className="w-full px-2 py-1.5 font-mono font-bold text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                            <datalist id={`product-code-list-${idx}`}>
                              {products.map(p => (
                                <option key={p.id} value={p.code}>
                                  {p.name} ({p.size})
                                </option>
                              ))}
                            </datalist>
                          </td>

                          {/* Product name */}
                          <td className="py-1.5 px-2">
                            <input
                              type="text"
                              value={item.productName}
                              onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                              placeholder="Tên sản phẩm in..."
                              className="w-full px-2 py-1.5 text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                          </td>

                          {/* Size */}
                          <td className="py-1.5 px-2">
                            <input
                              type="text"
                              value={item.size}
                              onChange={(e) => handleItemChange(idx, 'size', e.target.value)}
                              placeholder="60x90"
                              className="w-full px-2 py-1.5 font-mono text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                          </td>

                          {/* Quantity */}
                          <td className="py-1.5 px-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-16 px-2 py-1.5 font-mono font-bold text-center border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                          </td>

                          {/* Note */}
                          <td className="py-1.5 px-2">
                            <input
                              type="text"
                              value={item.note || ''}
                              onChange={(e) => handleItemChange(idx, 'note', e.target.value)}
                              placeholder="Bo viền vàng ánh kim, để bàn..."
                              className="w-full px-2 py-1.5 text-slate-700 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                          </td>

                          {/* Delete Row */}
                          <td className="py-1.5 px-2 text-center">
                            {comboItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('browse')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingComboId ? 'Cập Nhật Combo' : 'Lưu Combo Mới'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
