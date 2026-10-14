import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Search,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Clock,
  Edit3,
  Check,
  Tag,
  AlertCircle
} from 'lucide-react';
import { AccessoryMaterialItem } from '../types';
import {
  getLocalAccessoryMaterials,
  subscribeAccessoryMaterials,
  saveAccessoryMaterialsToFirestore,
  DEFAULT_ACCESSORY_MATERIALS
} from '../services/firestoreService';

interface AccessoryMaterialPriceTableProps {
  currentUserEmail?: string | null;
}

export const AccessoryMaterialPriceTable: React.FC<AccessoryMaterialPriceTableProps> = ({
  currentUserEmail
}) => {
  const [items, setItems] = useState<AccessoryMaterialItem[]>(() => getLocalAccessoryMaterials());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string>('');

  // New item modal/form state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newCategory, setNewCategory] = useState('Mica');

  // Real-time subscription to Firestore
  useEffect(() => {
    const unsub = subscribeAccessoryMaterials((updated) => {
      setItems(updated);
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

  // Update item price or name
  const handleItemChange = (id: string, field: 'name' | 'price' | 'category' | 'unit', rawVal: string) => {
    const timestamp = getSystemTimestamp();
    const nextItems = items.map(item => {
      if (item.id === id) {
        if (field === 'price') {
          const numPrice = parseNumber(rawVal);
          return { ...item, price: numPrice, updatedAt: timestamp };
        } else if (field === 'name') {
          return { ...item, name: rawVal, updatedAt: timestamp };
        } else if (field === 'category') {
          return { ...item, category: rawVal, updatedAt: timestamp };
        } else if (field === 'unit') {
          return { ...item, unit: rawVal, updatedAt: timestamp };
        }
      }
      return item;
    });

    setItems(nextItems);
    saveAccessoryMaterialsToFirestore(nextItems, { email: currentUserEmail });
    const targetItem = nextItems.find(i => i.id === id);
    showToast(`Đã cập nhật ${targetItem?.name || 'vật tư phụ kiện'}!`);
  };

  // Add new item
  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim();
    if (!cleanName) {
      alert('Vui lòng nhập tên sản phẩm / vật tư phụ kiện!');
      return;
    }

    const newItem: AccessoryMaterialItem = {
      id: `acc-custom-${Date.now()}`,
      name: cleanName,
      unit: newUnit.trim() || undefined,
      price: parseNumber(newPrice),
      updatedAt: getSystemTimestamp(),
      category: newCategory || 'Khác'
    };

    const nextItems = [newItem, ...items];
    setItems(nextItems);
    saveAccessoryMaterialsToFirestore(nextItems, { email: currentUserEmail });
    showToast(`Đã thêm vật tư phụ kiện "${cleanName}" vào danh sách!`);

    setNewName('');
    setNewPrice('');
    setNewUnit('');
    setIsAddingNew(false);
  };

  // Delete item
  const handleDeleteItem = (id: string, name: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa vật tư phụ kiện "${name}" khỏi danh sách?`)) {
      const nextItems = items.filter(i => i.id !== id);
      setItems(nextItems);
      saveAccessoryMaterialsToFirestore(nextItems, { email: currentUserEmail });
      showToast(`Đã xóa "${name}"!`);
    }
  };

  // Reset to default list
  const handleResetDefaults = () => {
    if (confirm('Khôi phục danh sách vật tư phụ kiện về danh mục ban đầu?')) {
      setItems(DEFAULT_ACCESSORY_MATERIALS);
      saveAccessoryMaterialsToFirestore(DEFAULT_ACCESSORY_MATERIALS, { email: currentUserEmail });
      showToast('Đã khôi phục danh mục vật tư phụ kiện về mặc định!');
    }
  };

  // Categories list
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.category) set.add(i.category);
    });
    return ['all', 'Mica', 'Viền', 'Phào', 'Keo & Phụ kiện', ...Array.from(set).filter(c => !['Mica', 'Viền', 'Phào', 'Keo & Phụ kiện'].includes(c))];
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter(i => {
      const matchCat = activeCategoryFilter === 'all' || i.category === activeCategoryFilter;
      const matchQuery = !searchQuery.trim() || i.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) || (i.category && i.category.toLowerCase().includes(searchQuery.toLowerCase().trim()));
      return matchCat && matchQuery;
    });
  }, [items, activeCategoryFilter, searchQuery]);

  return (
    <div className="space-y-4 pt-4 border-t border-slate-200">
      {/* Toast message */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-900 text-indigo-100 border border-indigo-500/50 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-bounce">
          <Sparkles className="w-4 h-4 text-indigo-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Info Banner */}
      <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Bảng Giá Vật Tư Phụ Kiện - Mica, Viền, Phào, Keo...
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                  {items.length} Vật tư
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Quản lý bảng giá các loại vật tư phụ kiện ngành ảnh (Mica nhiệt, mica nguội, viền, phào, keo hạt, keo sữa, chân chống sắt, ke góc...)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsAddingNew(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Phụ Kiện Mới</span>
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              title="Khôi phục danh sách mặc định ban đầu"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Mặc Định</span>
            </button>
          </div>
        </div>

        {/* Modal/Form thêm vật tư phụ kiện mới */}
        {isAddingNew && (
          <form onSubmit={handleAddNewItem} className="mt-4 pt-4 border-t border-indigo-200/80 grid grid-cols-1 sm:grid-cols-5 gap-3 bg-white p-4 rounded-xl border shadow-sm">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Tên Sản Phẩm / Vật Tư <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="VD: Mica nhiệt 80-04, Phào 1502..."
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Phân Loại
              </label>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden font-medium"
              >
                <option value="Mica">Mica</option>
                <option value="Viền">Viền</option>
                <option value="Phào">Phào</option>
                <option value="Keo & Phụ kiện">Keo & Phụ kiện</option>
                <option value="Khác">Khác</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Đơn Vị Tính
              </label>
              <input
                type="text"
                value={newUnit}
                onChange={e => setNewUnit(e.target.value)}
                placeholder="VD: Cuộn, Cây, Hộp, Mét..."
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Đơn Giá (đ)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={newPrice ? formatNumber(parseNumber(newPrice)) : ''}
                onChange={e => setNewPrice(e.target.value)}
                placeholder="VD: 45,000"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition cursor-pointer"
              >
                Xác Nhận Thêm
              </button>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold text-xs transition cursor-pointer"
              >
                Hủy
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
          {categoriesList.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeCategoryFilter === cat
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {cat === 'all' ? `Tất Cả (${items.length})` : cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative shrink-0 sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm tên vật tư phụ kiện..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden font-medium"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black uppercase text-slate-700 tracking-wider">
                <th className="py-3 px-3 text-center w-12 bg-slate-200/60">STT</th>
                <th className="py-3 px-4 min-w-[240px]">Tên Sản Phẩm / Vật Tư Phụ Kiện</th>
                <th className="py-3 px-3 text-center w-36">Nhóm Vật Tư</th>
                <th className="py-3 px-3 text-center w-32">Đơn Vị Tính</th>
                <th className="py-3 px-4 text-right w-44">Đơn Giá (đ)</th>
                <th className="py-3 px-4 text-center w-48">Ngày Sửa Giá Gần Nhất</th>
                <th className="py-3 px-3 text-center w-16">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs font-medium">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-6 h-6 text-slate-300" />
                      <span>Không tìm thấy vật tư phụ kiện phù hợp</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => (
                  <tr
                    key={item.id}
                    className="hover:bg-indigo-50/30 transition-colors group"
                  >
                    {/* STT */}
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono font-medium text-[11px] bg-slate-50/50">
                      {index + 1}
                    </td>

                    {/* Cột 1: Tên sản phẩm / vật tư (Cho phép bấm vào chỉnh sửa trực tiếp) */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => handleItemChange(item.id, 'name', e.target.value)}
                          placeholder="Nhập tên vật tư..."
                          className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-lg font-bold text-slate-900 text-xs focus:ring-1 focus:ring-indigo-500 outline-hidden transition"
                          title="Bấm vào để chỉnh sửa tên vật tư trực tiếp"
                        />
                        <Edit3 className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 shrink-0 pointer-events-none" />
                      </div>
                    </td>

                    {/* Nhóm phân loại */}
                    <td className="py-2.5 px-3 text-center">
                      <select
                        value={item.category || 'Khác'}
                        onChange={e => handleItemChange(item.id, 'category', e.target.value)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-md border border-slate-200 outline-hidden cursor-pointer"
                      >
                        <option value="Mica">Mica</option>
                        <option value="Viền">Viền</option>
                        <option value="Phào">Phào</option>
                        <option value="Keo & Phụ kiện">Keo & Phụ kiện</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </td>

                    {/* Cột: Đơn Vị Tính (Cho phép người dùng tự điền trực tiếp) */}
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="text"
                        value={item.unit || ''}
                        onChange={e => handleItemChange(item.id, 'unit', e.target.value)}
                        placeholder="Tự điền ĐVT..."
                        className="w-full max-w-[120px] mx-auto px-2.5 py-1 text-center font-bold text-xs text-slate-800 bg-white border border-slate-200 rounded-lg hover:border-slate-300 focus:border-indigo-500 focus:bg-indigo-50/20 focus:ring-1 focus:ring-indigo-500 outline-hidden transition shadow-2xs"
                        title="Nhập đơn vị tính cho vật tư này (VD: Cuộn, Cây, Mét, Hộp, Chiếc...)"
                      />
                    </td>

                    {/* Cột 2: Đơn giá (đ) (Cho phép nhập giá tiền thủ công) */}
                    <td className="py-2.5 px-4 text-right">
                      <div className="relative flex items-center justify-end">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={item.price !== undefined && item.price > 0 ? formatNumber(item.price) : ''}
                          onChange={e => handleItemChange(item.id, 'price', e.target.value)}
                          placeholder="0"
                          className="w-full max-w-[160px] px-2.5 py-1 text-right font-mono font-black text-xs text-indigo-950 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-indigo-50/20 focus:ring-1 focus:ring-indigo-500 outline-hidden transition shadow-2xs"
                        />
                        <span className="text-[10px] text-slate-400 font-bold ml-1">đ</span>
                      </div>
                    </td>

                    {/* Cột 3: Ngày sửa giá gần nhất (Tự động ghi nhận ngày giờ hệ thống) */}
                    <td className="py-2.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 border border-slate-200 text-slate-600 font-mono text-[11px] font-semibold">
                        <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span>{item.updatedAt || 'Vừa cập nhật'}</span>
                      </div>
                    </td>

                    {/* Xóa dòng */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 cursor-pointer transition"
                        title={`Xóa "${item.name}" khỏi bảng giá vật tư phụ kiện`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
