import { INK_12_COLORS } from '../data/initialData';
import { downloadSupplierOrderJPG } from '../utils/exportSupplierOrderCanvas';
import React, { useState, useMemo, useEffect } from 'react';
import { Material, MaterialCategory, StockImportReceipt, StockImportItem, Order, OrderItem, MaterialDeduction, Product, InkImportRecord } from '../types';
import { formatCurrency, formatNumber, formatDateVN } from '../utils/formatters';
import { getMaterialUsageSummary, calculateOrderBOM, createMaterialDeductionRecords } from '../utils/materialBOM';
import {
  Boxes, Plus, Search, AlertTriangle, CheckCircle2, Clock, TrendingDown,
  ArrowDownLeft, FileText, Calendar, DollarSign, PackagePlus,
  Edit, Trash2, SlidersHorizontal, RefreshCw, X, ArrowUpDown, Truck, ChevronRight,
  BookOpen, Sparkles, ShoppingBag, ArrowRight, Building2, Filter, Layers, PieChart,
  Settings, Check, RotateCcw, Package, Droplet, Camera, Star, ChevronDown, ChevronUp
} from 'lucide-react';
import { MoneyInput } from './MoneyInput';
import { InkInventoryTracking } from './InkInventoryTracking';
import { BoardCorePriceTable } from './BoardCorePriceTable';
import {
  subscribeInventoryPresets,
  saveInventoryPresetsToFirestore,
  getLocalInventoryPresets,
  InventoryPresets,
  DEFAULT_PRESET_SUPPLIERS,
  DEFAULT_PRESET_ITEMS,
  getLocalBoardCorePrices,
  getLocalAccessoryMaterials,
  getLocalPaperMaterials
} from '../services/firestoreService';

// Danh sách gợi ý Nhà Cung Cấp & Mặt Hàng (Khởi tạo mặc định)
export const FIXED_SUPPLIERS = DEFAULT_PRESET_SUPPLIERS;
export const FIXED_IMPORT_ITEMS = DEFAULT_PRESET_ITEMS;

interface InventoryManagementViewProps {
  materials: Material[];
  stockImports: StockImportReceipt[];
  orders?: Order[];
  products?: Product[];
  inkImports?: InkImportRecord[];
  onSaveMaterial: (material: Material) => void;
  onDeleteMaterial: (materialId: string) => void;
  onSaveStockImport: (receipt: StockImportReceipt) => void;
  onDeleteStockImport?: (receiptId: string) => void;
  onAdjustStock: (materialId: string, newQuantity: number, reason: string) => void;
  onSaveInkImport?: (record: InkImportRecord) => void;
  onDeleteInkImport?: (recordId: string) => void;
  onResetInkYear?: (year: number) => void;
  onClearAllInventory?: () => void;
  onClearAllStockImports?: () => void;
  onResetStockToZero?: () => void;
  onReloadDefaultMaterials?: () => void;
}


function renderImportStatusBadge(status?: string) {
  switch (status) {
    case 'pending':
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-600" />
          <span>Chờ xử lý</span>
        </span>
      );
    case 'ordered':
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300 inline-flex items-center gap-1">
          <Truck className="w-3 h-3 text-blue-600" />
          <span>Đã lên đơn</span>
        </span>
      );
    case 'completed':
    default:
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Hàng đã nhập kho</span>
        </span>
      );
  }
}


  // Handler xuất ảnh JPG gửi NCC (Đã ẩn SKU & Giá tiền)
  const handleExportSupplierJPG = (receiptData: {
    supplier: string;
    date: string;
    orderDate?: string;
    receiptNumber?: string;
    notes?: string;
    items: Array<{ materialName: string; quantity: number; unit: string; note?: string; notes?: string }>;
  }) => {
    if (!receiptData.supplier || !receiptData.supplier.trim()) {
      alert("Vui lòng chọn hoặc nhập tên Nhà Cung Cấp!");
      return;
    }
    if (!receiptData.items || receiptData.items.length === 0) {
      alert("Vui lòng nhập ít nhất 1 mặt hàng trong phiếu đặt!");
      return;
    }
    downloadSupplierOrderJPG(receiptData).catch(e => {
      console.error("Error exporting supplier order slip JPG:", e);
      alert("Có lỗi khi tạo ảnh phiếu đặt hàng gửi NCC.");
    });
  };

export const InventoryManagementView: React.FC<InventoryManagementViewProps> = ({
  materials,
  stockImports,
  orders = [],
  products = [],
  inkImports = [],
  onSaveMaterial,
  onDeleteMaterial,
  onSaveStockImport,
  onDeleteStockImport,
  onAdjustStock,
  onSaveInkImport,
  onDeleteInkImport,
  onResetInkYear,
  onClearAllInventory,
  onClearAllStockImports,
  onResetStockToZero,
  onReloadDefaultMaterials
}) => {
  // Active Sub-tab: 'inventory' | 'supplier_expenses' | 'ink_tracking' | 'history' | 'board_prices' | 'sales_deductions'
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'supplier_expenses' | 'ink_tracking' | 'history' | 'board_prices' | 'sales_deductions'>('inventory');
  
  // Tab con cho phân hệ xuất vật tư: 'history' (Lịch Sử Khấu Trừ) | 'monthly_summary' (Thống kê ván/fomex đã xuất trong tháng)
  const [deductionsSubTab, setDeductionsSubTab] = useState<'history' | 'monthly_summary'>('history');

  // Filters for Material Inventory
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'instock' | 'out' | 'tracked'>('all');

  // Tracked Materials Watchlist ("Vật tư cần theo dõi" - Đánh dấu thủ công bằng ngôi sao ⭐)
  const [trackedMaterialIds, setTrackedMaterialIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('inventory_tracked_materials');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading inventory_tracked_materials:', e);
    }
    return [];
  });

  // Đồng bộ các vật tư có isTracked === true từ props
  useEffect(() => {
    const fromProps = materials.filter(m => m.isTracked).map(m => m.id);
    if (fromProps.length > 0) {
      setTrackedMaterialIds(prev => {
        const merged = Array.from(new Set([...prev, ...fromProps]));
        if (merged.length !== prev.length) {
          try {
            localStorage.setItem('inventory_tracked_materials', JSON.stringify(merged));
          } catch (e) {}
          return merged;
        }
        return prev;
      });
    }
  }, [materials]);

  const isMaterialTracked = (mat: Material) => {
    return mat.isTracked === true || trackedMaterialIds.includes(mat.id) || trackedMaterialIds.includes(mat.code);
  };

  const handleToggleTrackedMaterial = (mat: Material) => {
    const currentlyTracked = isMaterialTracked(mat);
    const nextTracked = !currentlyTracked;

    setTrackedMaterialIds(prev => {
      let nextList: string[];
      if (nextTracked) {
        nextList = Array.from(new Set([...prev, mat.id, mat.code]));
      } else {
        nextList = prev.filter(id => id !== mat.id && id !== mat.code);
      }
      try {
        localStorage.setItem('inventory_tracked_materials', JSON.stringify(nextList));
      } catch (e) {}
      return nextList;
    });

    if (onSaveMaterial) {
      onSaveMaterial({
        ...mat,
        isTracked: nextTracked
      });
    }
  };

  const trackedMaterials = useMemo(() => {
    return materials.filter(m => isMaterialTracked(m));
  }, [materials, trackedMaterialIds]);

  // Bộ lọc & trạng thái cho Tab 2: Thống kê số lượng ván/fomex đã xuất trong tháng
  const [statsMonth, setStatsMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [statsYear, setStatsYear] = useState<number>(() => new Date().getFullYear());
  const [statsSearchQuery, setStatsSearchQuery] = useState<string>('');
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [showFullYearGrid, setShowFullYearGrid] = useState<boolean>(false);

  // Filters for Supplier Expenses & Inward Values
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(currentYear);
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');

  // Modals for Material
  const [isAddMaterialModalOpen, setIsAddMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingMaterial, setAdjustingMaterial] = useState<Material | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Xuất dùng sản xuất in ảnh');
  const [materialToDelete, setMaterialToDelete] = useState<Material | null>(null);

  // Modals for Manual Inward / Stock Import
  const [isNewImportModalOpen, setIsNewImportModalOpen] = useState(false);
  const [editingImportReceipt, setEditingImportReceipt] = useState<StockImportReceipt | null>(null);
  const [importStatus, setImportStatus] = useState<'pending' | 'ordered' | 'completed'>('pending');
  const [importItemsList, setImportItemsList] = useState<{
    id: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    unit: string;
    quantity: number;
    costPrice: number;
    totalCost: number;
    note?: string;
  }[]>([
    { id: 'ii-0', materialId: '', materialCode: '', materialName: '', unit: 'Tấm', quantity: 1, costPrice: 0, totalCost: 0 }
  ]);

  // Combined SKU list from Warehouse Materials, Board Core Prices, and Accessory Prices
  const availableSKUsList = useMemo(() => {
    const skus: {
      id: string;
      code: string;
      name: string;
      unit: string;
      price: number;
      category: string;
      source: 'inventory' | 'board' | 'accessory';
    }[] = [];

    // 1. Warehouse Materials
    (materials || []).forEach(m => {
      skus.push({
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit || 'Tấm',
        price: m.costPrice || 0,
        category: m.category || 'Vật tư kho',
        source: 'inventory'
      });
    });

    // 2. Board Core Prices (Ván MDF 12li, 9li & Fomex)
    try {
      const boardPrices = getLocalBoardCorePrices();
      Object.entries(boardPrices || {}).forEach(([key, row]) => {
        const sizeDigits = key.replace(/[^0-9]/g, '') || row.size.replace(/[^0-9]/g, '');

        // MDF 12li
        if (row.mdf12li > 0) {
          const code12 = `${sizeDigits} 12li`;
          if (!skus.some(s => s.code.toUpperCase() === code12.toUpperCase())) {
            skus.push({
              id: `board-${key}-12li`,
              code: code12,
              name: row.name ? `${row.name} (12li)` : `Gỗ MDF ${row.size} 12li bo góc`,
              unit: 'Tấm',
              price: row.mdf12li,
              category: 'Bảng giá Cốt Ván',
              source: 'board'
            });
          }
        }

        // MDF 9li
        if (row.mdf9li > 0) {
          const code9 = `${sizeDigits} 9li bo`;
          if (!skus.some(s => s.code.toUpperCase() === code9.toUpperCase() || s.code.toUpperCase() === `${sizeDigits} 9LI`)) {
            skus.push({
              id: `board-${key}-9li`,
              code: code9,
              name: row.name ? `${row.name} (9li bo)` : `Gỗ MDF ${row.size} 9li bo góc`,
              unit: 'Tấm',
              price: row.mdf9li,
              category: 'Bảng giá Cốt Ván',
              source: 'board'
            });
          }
        }

        // Fomex 9li
        if (row.fomex9li > 0) {
          const codeFomex = `${sizeDigits} fomex`;
          if (!skus.some(s => s.code.toUpperCase() === codeFomex.toUpperCase())) {
            skus.push({
              id: `board-${key}-fomex`,
              code: codeFomex,
              name: `Tấm Fomex ${row.size} 9li`,
              unit: 'Tấm',
              price: row.fomex9li,
              category: 'Bảng giá Cốt Ván',
              source: 'board'
            });
          }
        }
      });
    } catch (e) {}

    // 3. Accessory Prices
    try {
      const accItems = getLocalAccessoryMaterials();
      (accItems || []).forEach(acc => {
        const code = (acc.sku || acc.id).toUpperCase();
        if (!skus.some(s => s.id === acc.id || s.code.toUpperCase() === code || s.name.toLowerCase() === acc.name.toLowerCase())) {
          skus.push({
            id: acc.id,
            code: code,
            name: acc.name,
            unit: acc.unit || 'Cái',
            price: acc.price || 0,
            category: acc.category || 'Phụ kiện',
            source: 'accessory'
          });
        }
      });
    } catch (e) {}

    // 4. Paper Materials (Giấy RC Bóng & Giấy PP)
    try {
      const paperItems = getLocalPaperMaterials();
      (paperItems || []).forEach(p => {
        if (!skus.some(s => s.code.toUpperCase() === p.sku.toUpperCase())) {
          skus.push({
            id: p.id,
            code: p.sku,
            name: p.name,
            unit: p.unit || 'Cuộn',
            price: p.price || 0,
            category: `Giấy In (${p.paperType})`,
            source: 'inventory'
          });
        }
      });
    } catch (e) {}

    return skus;
  }, [materials]);

  // Manual Inward Form State
  const [importDate, setImportDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [importOrderDate, setImportOrderDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [importSupplier, setImportSupplier] = useState<string>('');

  // Dynamically filter SKUs based on selected Supplier (SVP vs Non-SVP)
  const filteredSKUsForSupplier = useMemo(() => {
    const supplierUpper = (importSupplier || '').trim().toUpperCase();
    const isSVP = supplierUpper === 'SVP';

    if (isSVP) {
      // SVP Supplier: ONLY show Paper (Giấy in) and Ink (Mực in) items!
      const inkAndPaperSKUs = availableSKUsList.filter(s => {
        const cat = (s.category || '').toLowerCase();
        const name = (s.name || '').toLowerCase();
        const code = (s.code || '').toLowerCase();

        const isPaper = cat.includes('giấy') || name.includes('giấy') || code.startsWith('g-rc-') || code.startsWith('g-pp-');
        const isInk = cat.includes('mực') || name.includes('mực') || name.includes('lucia') || code.includes('muc');

        return isPaper || isInk;
      });

      // Include the 12 Lucia Pro Ink Bottles if not already listed
      INK_12_COLORS.forEach(c => {
        const code = `MUC-LUCIA-${c.code}`;
        if (!inkAndPaperSKUs.some(s => s.code.toUpperCase() === code.toUpperCase() || s.name.includes(`Bình mực ${c.code}`))) {
          inkAndPaperSKUs.push({
            id: `ink-${c.code}`,
            code: code,
            name: `Mực ${c.code}`,
            unit: 'Bình',
            price: 900000,
            category: 'Mực In 12 Màu (SVP)',
            source: 'inventory' as const
          });
        }
      });

      return inkAndPaperSKUs;
    } else {
      // Non-SVP Suppliers (Trang Phóng, Ninh Trang, Toản HN, Xuân Trường HN, Tuấn Tú Vinh, Khác...):
      // ONLY show general warehouse materials (Ván, Fomex, Mica, Phào, Nẹp, Khung, Phụ kiện...)
      // EXCLUDE Paper and Ink!
      return availableSKUsList.filter(s => {
        const cat = (s.category || '').toLowerCase();
        const name = (s.name || '').toLowerCase();
        const code = (s.code || '').toLowerCase();

        const isPaper = cat.includes('giấy') || name.includes('giấy') || code.startsWith('g-rc-') || code.startsWith('g-pp-');
        const isInk = cat.includes('mực') || name.includes('mực') || name.includes('lucia') || code.includes('muc');

        return !isPaper && !isInk;
      });
    }
  }, [importSupplier, availableSKUsList]);

  const [selectedReceiptDetail, setSelectedReceiptDetail] = useState<StockImportReceipt | null>(null);
  const [receiptToDelete, setReceiptToDelete] = useState<StockImportReceipt | null>(null);
  const [isClearInventoryModalOpen, setIsClearInventoryModalOpen] = useState(false);
  const [isClearStockImportsModalOpen, setIsClearStockImportsModalOpen] = useState(false);
  const [isBOMGuideOpen, setIsBOMGuideOpen] = useState(false);

  // Material Form state (Đã bỏ formCostPrice)
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<MaterialCategory>('Gỗ MDF');
  const [formUnit, setFormUnit] = useState('Tấm');
  const [formStockQuantity, setFormStockQuantity] = useState<number>(0);
  const [formMinStockAlert, setFormMinStockAlert] = useState<number>(5);
  const [formSupplier, setFormSupplier] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Manual Inward Form State
  const [importItemName, setImportItemName] = useState<string>('');
  const [importAmount, setImportAmount] = useState<number>(0);
  const [importQuantity, setImportQuantity] = useState<number>(1);
  const [importUnit, setImportUnit] = useState<string>('Lô');
  const [importNotes, setImportNotes] = useState<string>('');
  const [importReceiptCode, setImportReceiptCode] = useState<string>('');

  // Quick Pick Presets (Đồng bộ Realtime Firestore & Local Cache)
  const [inventoryPresets, setInventoryPresets] = useState<InventoryPresets>(() => getLocalInventoryPresets());
  const [isManageSuggestionsOpen, setIsManageSuggestionsOpen] = useState(false);
  const [manageTab, setManageTab] = useState<'suppliers' | 'items'>('suppliers');
  const [newSupplierInput, setNewSupplierInput] = useState('');
  const [newItemInput, setNewItemInput] = useState('');
  const [editingSupplierIdx, setEditingSupplierIdx] = useState<number | null>(null);
  const [editingSupplierText, setEditingSupplierText] = useState('');
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [editingItemText, setEditingItemText] = useState('');
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null);

  // Lắng nghe dữ liệu gợi ý Real-time từ Cloud Firestore
  useEffect(() => {
    const unsub = subscribeInventoryPresets((presets) => {
      setInventoryPresets(presets);
    });
    return () => unsub();
  }, []);

  // Helper bóc tách danh sách các mặt hàng đang có trong ô nhập
  const parseCurrentImportItems = (text: string): string[] => {
    return text
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  };

  // Helper kiểm tra xem mặt hàng gợi ý có đang được chọn không
  const isItemChipSelected = (item: string): boolean => {
    if (!importItemName.trim()) return false;
    const current = parseCurrentImportItems(importItemName);
    const target = item.trim().toLowerCase();
    return current.some(c => {
      const cl = c.toLowerCase();
      return cl === target || cl.startsWith(target + ' ') || cl.startsWith(target + '(');
    });
  };

  // Toggle thêm hoặc bỏ chọn nhiều mặt hàng cùng lúc (Multi-select)
  const handleToggleItemChip = (item: string) => {
    const current = parseCurrentImportItems(importItemName);
    const target = item.trim().toLowerCase();
    const existingIndex = current.findIndex(c => {
      const cl = c.toLowerCase();
      return cl === target || cl.startsWith(target + ' ') || cl.startsWith(target + '(');
    });

    let nextItems: string[];
    if (existingIndex >= 0) {
      // Đã có -> Bỏ chọn
      nextItems = current.filter((_, idx) => idx !== existingIndex);
    } else {
      // Chưa có -> Thêm vào chuỗi mặt hàng
      nextItems = [...current, item.trim()];
    }
    setImportItemName(nextItems.join(', '));
  };

  // Lưu danh sách gợi ý mới lên Firestore
  const handlePersistPresets = async (updated: { suppliers: string[]; items: string[] }) => {
    setInventoryPresets(prev => ({ ...prev, ...updated }));
    try {
      await saveInventoryPresetsToFirestore(updated);
      setPresetFeedback('Đã đồng bộ lên Cloud thành công!');
      setTimeout(() => setPresetFeedback(null), 2500);
    } catch (e) {
      console.error('Failed to save presets to Firestore', e);
    }
  };

  // Thêm Nhà Cung Cấp vào gợi ý
  const handleAddSupplierPreset = () => {
    const trimmed = newSupplierInput.trim();
    if (!trimmed) return;
    if (inventoryPresets.suppliers.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      alert('Nhà cung cấp "' + trimmed + '" đã có trong danh sách gợi ý!');
      return;
    }
    const next = [...inventoryPresets.suppliers, trimmed];
    handlePersistPresets({ suppliers: next, items: inventoryPresets.items });
    setNewSupplierInput('');
  };

  // Sửa tên Nhà Cung Cấp
  const handleSaveEditSupplier = (idx: number) => {
    const trimmed = editingSupplierText.trim();
    if (!trimmed) return;
    const next = [...inventoryPresets.suppliers];
    next[idx] = trimmed;
    handlePersistPresets({ suppliers: next, items: inventoryPresets.items });
    setEditingSupplierIdx(null);
  };

  // Xóa Nhà Cung Cấp
  const handleDeleteSupplierPreset = (idx: number) => {
    if (inventoryPresets.suppliers.length <= 1) {
      alert('Cần giữ lại ít nhất 1 nhà cung cấp trong danh sách gợi ý.');
      return;
    }
    const next = inventoryPresets.suppliers.filter((_, i) => i !== idx);
    handlePersistPresets({ suppliers: next, items: inventoryPresets.items });
  };

  // Khôi phục 7 NCC gốc
  const handleResetSuppliersToDefault = () => {
    if (window.confirm('Khôi phục danh sách về 7 Nhà Cung Cấp chuẩn ban đầu?')) {
      handlePersistPresets({ suppliers: [...DEFAULT_PRESET_SUPPLIERS], items: inventoryPresets.items });
    }
  };

  // Thêm Mặt Hàng vào gợi ý
  const handleAddItemPreset = () => {
    const trimmed = newItemInput.trim();
    if (!trimmed) return;
    if (inventoryPresets.items.some(it => it.toLowerCase() === trimmed.toLowerCase())) {
      alert('Mặt hàng "' + trimmed + '" đã có trong danh sách gợi ý!');
      return;
    }
    const next = [...inventoryPresets.items, trimmed];
    handlePersistPresets({ suppliers: inventoryPresets.suppliers, items: next });
    setNewItemInput('');
  };

  // Sửa tên Mặt Hàng
  const handleSaveEditItem = (idx: number) => {
    const trimmed = editingItemText.trim();
    if (!trimmed) return;
    const next = [...inventoryPresets.items];
    next[idx] = trimmed;
    handlePersistPresets({ suppliers: inventoryPresets.suppliers, items: next });
    setEditingItemIdx(null);
  };

  // Xóa Mặt Hàng
  const handleDeleteItemPreset = (idx: number) => {
    if (inventoryPresets.items.length <= 1) {
      alert('Cần giữ lại ít nhất 1 mặt hàng trong danh sách gợi ý.');
      return;
    }
    const next = inventoryPresets.items.filter((_, i) => i !== idx);
    handlePersistPresets({ suppliers: inventoryPresets.suppliers, items: next });
  };

  // Khôi phục 15 Mặt hàng gốc
  const handleResetItemsToDefault = () => {
    if (window.confirm('Khôi phục danh sách về 15 Mặt Hàng chuẩn ban đầu?')) {
      handlePersistPresets({ suppliers: inventoryPresets.suppliers, items: [...DEFAULT_PRESET_ITEMS] });
    }
  };

  // Available categories
  const categories: MaterialCategory[] = [
    'Gỗ MDF',
    'Fomex siêu nhẹ',
    'Giấy In Ảnh',
    'Mica & Pha Lê',
    'Khung Ảnh',
    'Mực In',
    'Keo & Màng Lụa'
  ];

  // 1. KPI Calculations for Warehouse & Inventory
  const totalMaterialCount = materials.length;
  
  const totalStockQuantity = useMemo(() => {
    return materials.reduce((sum, m) => sum + (m.stockQuantity || 0), 0);
  }, [materials]);

  const lowStockMaterials = useMemo(() => {
    return materials.filter(m => m.stockQuantity > 0 && m.stockQuantity <= m.minStockAlert);
  }, [materials]);

  const outOfStockMaterials = useMemo(() => {
    return materials.filter(m => m.stockQuantity <= 0);
  }, [materials]);

  // Material Usage Calculations (Đồng bộ số lượng đã sử dụng từ toàn bộ đơn bán hàng)
  const materialUsageMap = useMemo(() => {
    return getMaterialUsageSummary(orders, materials, products);
  }, [orders, materials, products]);

  const totalUsedUnits = useMemo(() => {
    return Object.values(materialUsageMap).reduce((sum, item) => sum + item.usedQuantity, 0);
  }, [materialUsageMap]);

  const totalUsedOrdersCount = useMemo(() => {
    return orders.filter(o => o.status !== 'cancelled').length;
  }, [orders]);

  // Filter state for Sub-tab 4: Lịch sử vật tư khấu trừ theo đơn bán hàng
  const [deductionsDateFilter, setDeductionsDateFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | 'custom'>('all');
  const [deductionsCustomDate, setDeductionsCustomDate] = useState<string>('');
  const [deductionsSearchQuery, setDeductionsSearchQuery] = useState<string>('');

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);

  // Danh sách các đợt khấu trừ kho theo đơn hàng và ngày thực tế (hàng bổ sung tách thành đợt riêng theo ngày bổ sung)
  const salesDeductionRecords = useMemo(() => {
    const records: {
      id: string;
      orderId: string;
      orderNumber: string;
      orderDate: string;
      deductionDate: string;
      isSupplement: boolean;
      customerName: string;
      items: OrderItem[];
      deductions: MaterialDeduction[];
      status: string;
    }[] = [];

    const validOrders = orders.filter(o => o.status !== 'cancelled');

    validOrders.forEach(ord => {
      // Tìm tất cả các ngày khác nhau phát sinh trong đơn (từ items hoặc materialsDeducted)
      const dateSet = new Set<string>();
      if (ord.date) dateSet.add(ord.date);

      (ord.items || []).forEach(it => {
        if (it.date) dateSet.add(it.date);
      });

      (ord.materialsDeducted || []).forEach(d => {
        if (d.date) dateSet.add(d.date);
      });

      const dates = Array.from(dateSet).sort();

      if (dates.length <= 1) {
        // Đơn tạo 1 lần trong 1 ngày duy nhất
        const dDate = dates[0] || ord.date || '';
        const deductions = (ord.materialsDeducted && ord.materialsDeducted.length > 0)
          ? ord.materialsDeducted
          : createMaterialDeductionRecords(calculateOrderBOM(ord.items || [], materials, products));

        records.push({
          id: `${ord.id}-${dDate}`,
          orderId: ord.id,
          orderNumber: ord.orderNumber,
          orderDate: ord.date,
          deductionDate: dDate,
          isSupplement: false,
          customerName: ord.customerName,
          items: ord.items || [],
          deductions,
          status: ord.status
        });
      } else {
        // Đơn có các đợt phát sinh ở các ngày khác nhau (ngày tạo đơn gốc vs ngày bổ sung)
        dates.forEach(curDate => {
          const dateItems = (ord.items || []).filter(it => (it.date || ord.date) === curDate);
          if (dateItems.length === 0) return;

          // Vật tư đã trừ ứng với ngày này:
          let dateDeductions = (ord.materialsDeducted || []).filter(d => (d.date || ord.date) === curDate);

          if (dateDeductions.length === 0 && dateItems.length > 0) {
            dateDeductions = createMaterialDeductionRecords(calculateOrderBOM(dateItems, materials, products));
          }

          const isSupp = curDate !== ord.date;

          records.push({
            id: `${ord.id}-${curDate}`,
            orderId: ord.id,
            orderNumber: ord.orderNumber,
            orderDate: ord.date,
            deductionDate: curDate,
            isSupplement: isSupp,
            customerName: ord.customerName,
            items: dateItems,
            deductions: dateDeductions,
            status: ord.status
          });
        });
      }
    });

    // Sắp xếp các đợt trừ kho theo ngày mới nhất lên đầu
    return records.sort((a, b) => b.deductionDate.localeCompare(a.deductionDate));
  }, [orders, materials, products]);

  const filteredDeductionRecords = useMemo(() => {
    return salesDeductionRecords.filter(rec => {
      // 1. Lọc theo ngày
      if (deductionsDateFilter === 'today' && rec.deductionDate !== todayStr) return false;
      if (deductionsDateFilter === 'yesterday' && rec.deductionDate !== yesterdayStr) return false;
      if (deductionsDateFilter === '7days' && rec.deductionDate < sevenDaysAgoStr) return false;
      if (deductionsDateFilter === 'custom' && deductionsCustomDate && rec.deductionDate !== deductionsCustomDate) return false;

      // 2. Tìm kiếm
      if (deductionsSearchQuery.trim()) {
        const q = deductionsSearchQuery.toLowerCase().trim();
        const matchNum = rec.orderNumber.toLowerCase().includes(q);
        const matchCust = rec.customerName.toLowerCase().includes(q);
        const matchItem = rec.items.some(it => it.productName.toLowerCase().includes(q) || it.productCode.toLowerCase().includes(q));
        const matchMat = rec.deductions.some(d => d.materialName.toLowerCase().includes(q) || d.materialCode.toLowerCase().includes(q));
        if (!matchNum && !matchCust && !matchItem && !matchMat) return false;
      }

      return true;
    });
  }, [salesDeductionRecords, deductionsDateFilter, deductionsCustomDate, deductionsSearchQuery, todayStr, yesterdayStr, sevenDaysAgoStr]);

  // Dữ liệu thống kê số lượng ván/fomex đã xuất trong tháng cho danh sách "vật tư cần theo dõi"
  const monthlyStatsData = useMemo(() => {
    const monthStr = `${statsYear}-${String(statsMonth).padStart(2, '0')}`;

    // Lọc các đợt trừ kho phát sinh trong tháng đã chọn
    const monthRecords = salesDeductionRecords.filter(r => r.deductionDate.startsWith(monthStr));

    // Tính toán cho từng vật tư trong danh sách theo dõi
    const items = trackedMaterials.map(mat => {
      let exportedMonthQty = 0;
      const orderOccurrences: {
        orderId: string;
        orderNumber: string;
        customerName: string;
        date: string;
        quantity: number;
        isSupplement: boolean;
      }[] = [];

      monthRecords.forEach(rec => {
        const matchingDeds = rec.deductions.filter(d =>
          d.materialId === mat.id ||
          (d.materialCode && d.materialCode.trim().toUpperCase() === mat.code.trim().toUpperCase()) ||
          (d.materialName && d.materialName.trim().toLowerCase() === mat.name.trim().toLowerCase())
        );

        if (matchingDeds.length > 0) {
          const qty = matchingDeds.reduce((sum, d) => sum + d.quantity, 0);
          exportedMonthQty += qty;
          orderOccurrences.push({
            orderId: rec.orderId,
            orderNumber: rec.orderNumber,
            customerName: rec.customerName,
            date: rec.deductionDate,
            quantity: qty,
            isSupplement: rec.isSupplement
          });
        }
      });

      // Tính tổng 12 tháng của năm đang chọn
      const months12Data: number[] = Array.from({ length: 12 }, (_, mIdx) => {
        const mKey = `${statsYear}-${String(mIdx + 1).padStart(2, '0')}`;
        const recsInM = salesDeductionRecords.filter(r => r.deductionDate.startsWith(mKey));
        let mTotal = 0;
        recsInM.forEach(r => {
          const match = r.deductions.filter(d =>
            d.materialId === mat.id ||
            (d.materialCode && d.materialCode.trim().toUpperCase() === mat.code.trim().toUpperCase()) ||
            (d.materialName && d.materialName.trim().toLowerCase() === mat.name.trim().toLowerCase())
          );
          mTotal += match.reduce((sum, d) => sum + d.quantity, 0);
        });
        return Math.round(mTotal * 100) / 100;
      });

      const yearTotal = months12Data.reduce((sum, q) => sum + q, 0);

      return {
        material: mat,
        exportedMonthQty: Math.round(exportedMonthQty * 100) / 100,
        orderCount: orderOccurrences.length,
        orderOccurrences,
        months12Data,
        yearTotal: Math.round(yearTotal * 100) / 100
      };
    });

    // Lọc theo tìm kiếm trong danh sách theo dõi nếu có
    const filteredItems = items.filter(it => {
      if (!statsSearchQuery.trim()) return true;
      const q = statsSearchQuery.toLowerCase().trim();
      return (
        it.material.name.toLowerCase().includes(q) ||
        it.material.code.toLowerCase().includes(q) ||
        (it.material.category && it.material.category.toLowerCase().includes(q))
      );
    });

    const totalMonthUnits = items.reduce((sum, it) => sum + it.exportedMonthQty, 0);
    const totalOrdersInMonth = new Set(
      items.flatMap(it => it.orderOccurrences.map(o => o.orderNumber))
    ).size;
    const topItem = items.length > 0
      ? [...items].sort((a, b) => b.exportedMonthQty - a.exportedMonthQty)[0]
      : null;

    return {
      items: filteredItems,
      allTrackedItems: items,
      totalMonthUnits: Math.round(totalMonthUnits * 100) / 100,
      totalOrdersInMonth,
      topItem
    };
  }, [trackedMaterials, salesDeductionRecords, statsMonth, statsYear, statsSearchQuery]);

  const handlePrevStatsMonth = () => {
    if (statsMonth === 1) {
      setStatsMonth(12);
      setStatsYear(prev => prev - 1);
    } else {
      setStatsMonth(prev => prev - 1);
    }
  };

  const handleNextStatsMonth = () => {
    if (statsMonth === 12) {
      setStatsMonth(1);
      setStatsYear(prev => prev + 1);
    } else {
      setStatsMonth(prev => prev + 1);
    }
  };

  const handleCurrentStatsMonth = () => {
    setStatsMonth(new Date().getMonth() + 1);
    setStatsYear(new Date().getFullYear());
  };

  // Helper function to check if import receipt is completed or legacy history (<= 03/10/2026)
  const isImportCompletedOrLegacy = (imp: StockImportReceipt): boolean => {
    if ((imp.date || "") <= "2026-10-03") return true;
    if (imp.status === "completed" || (imp.status as any) === "Hàng đã nhập kho") return true;
    if (imp.status === "pending" || imp.status === "ordered" || (imp.status as any) === "Chờ xử lý" || (imp.status as any) === "Đã lên đơn") return false;
    return true;
  };

  // 2. Years available from stock imports
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(currentYear);
    stockImports.forEach(imp => {
      const y = new Date(imp.date).getFullYear();
      if (!isNaN(y)) yearsSet.add(y);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [stockImports, currentYear]);

  // Total Inward Value for Current Year (hoặc năm được chọn)
  const currentYearTotalInward = useMemo(() => {
    return stockImports
      .filter(imp => {
        const y = Number((imp.date || "").slice(0, 4)) || new Date(imp.date).getFullYear();
        return y === currentYear && isImportCompletedOrLegacy(imp);
      })
      .reduce((sum, imp) => sum + (imp.totalAmount || 0), 0);
  }, [stockImports, currentYear]);

  // All Unique Suppliers
  const allSuppliersList = useMemo(() => {
    const suppSet = new Set<string>();
    stockImports.forEach(imp => {
      if (imp.supplier && imp.supplier.trim()) suppSet.add(imp.supplier.trim());
    });
    materials.forEach(m => {
      if (m.supplier && m.supplier.trim()) suppSet.add(m.supplier.trim());
    });
    return Array.from(suppSet).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [stockImports, materials]);

  // 3. Filtered Stock Imports for Selected Year & Supplier
  const filteredStockImportsForExpenseTab = useMemo(() => {
    return stockImports.filter(imp => {
      if (!isImportCompletedOrLegacy(imp)) return false;
      const impYear = Number((imp.date || "").slice(0, 4)) || new Date(imp.date).getFullYear();
      if (selectedYear !== 'all' && impYear !== selectedYear) return false;
      if (selectedSupplierFilter !== 'all' && imp.supplier !== selectedSupplierFilter) return false;

      if (supplierSearchQuery.trim()) {
        const query = supplierSearchQuery.toLowerCase();
        const matchSupplier = imp.supplier.toLowerCase().includes(query);
        const matchReceipt = imp.receiptNumber.toLowerCase().includes(query);
        const matchNote = imp.notes ? imp.notes.toLowerCase().includes(query) : false;
        const matchItem = imp.items.some(it => it.materialName.toLowerCase().includes(query) || it.materialCode.toLowerCase().includes(query));
        if (!matchSupplier && !matchReceipt && !matchNote && !matchItem) return false;
      }

      return true;
    });
  }, [stockImports, selectedYear, selectedSupplierFilter, supplierSearchQuery]);

  // Total amount for the selected filter view
  const selectedViewTotalExpense = useMemo(() => {
    return filteredStockImportsForExpenseTab.reduce((sum, imp) => sum + (imp.totalAmount || 0), 0);
  }, [filteredStockImportsForExpenseTab]);

  // 4. Annual Supplier Summary Aggregation (Tổng cả năm mỗi nhà cung cấp có giá trị bao nhiêu tiền)
  const supplierAnnualSummaries = useMemo(() => {
    // Filter imports by selected year first
    const yearImports = stockImports.filter(imp => {
      if (!isImportCompletedOrLegacy(imp)) return false;
      if (selectedYear === "all") return true;
      const y = Number((imp.date || "").slice(0, 4)) || new Date(imp.date).getFullYear();
      return y === selectedYear;
    });

    const supplierMap: Record<string, {
      supplierName: string;
      totalYearAmount: number;
      batchCount: number;
      itemsList: Set<string>;
      latestDate: string;
    }> = {};

    yearImports.forEach(imp => {
      const supp = imp.supplier?.trim() || 'Nhà Cung Cấp Khác';
      if (!supplierMap[supp]) {
        supplierMap[supp] = {
          supplierName: supp,
          totalYearAmount: 0,
          batchCount: 0,
          itemsList: new Set<string>(),
          latestDate: imp.date
        };
      }

      supplierMap[supp].totalYearAmount += (imp.totalAmount || 0);
      supplierMap[supp].batchCount += 1;
      if (new Date(imp.date).getTime() > new Date(supplierMap[supp].latestDate).getTime()) {
        supplierMap[supp].latestDate = imp.date;
      }

      imp.items.forEach(it => {
        if (it.materialName) supplierMap[supp].itemsList.add(it.materialName);
      });
    });

    const totalAllSuppliersAmount = Object.values(supplierMap).reduce((sum, s) => sum + s.totalYearAmount, 0);

    return Object.values(supplierMap)
      .map(s => ({
        ...s,
        itemsSummary: Array.from(s.itemsList).join(', '),
        percentage: totalAllSuppliersAmount > 0 ? (s.totalYearAmount / totalAllSuppliersAmount) * 100 : 0
      }))
      .sort((a, b) => b.totalYearAmount - a.totalYearAmount);
  }, [stockImports, selectedYear]);

  // 5. Filter materials for Inventory Table
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      // Search
      const matchSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.supplier && m.supplier.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      // Category
      if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;

      // Status
      if (statusFilter === 'tracked') {
        return isMaterialTracked(m);
      }
      if (statusFilter === 'low') {
        return m.stockQuantity > 0 && m.stockQuantity <= m.minStockAlert;
      }
      if (statusFilter === 'out') {
        return m.stockQuantity <= 0;
      }
      if (statusFilter === 'instock') {
        return m.stockQuantity > m.minStockAlert;
      }

      return true;
    });
  }, [materials, searchQuery, selectedCategory, statusFilter, trackedMaterialIds]);

  // Handlers for Material CRUD (Đã bỏ giá nhập)
  const handleOpenAddModal = (mat?: Material) => {
    if (mat) {
      setEditingMaterial(mat);
      setFormCode(mat.code);
      setFormName(mat.name);
      setFormCategory(mat.category);
      setFormUnit(mat.unit);
      setFormStockQuantity(mat.stockQuantity);
      setFormMinStockAlert(mat.minStockAlert);
      setFormSupplier(mat.supplier || '');
      setFormNotes(mat.notes || '');
    } else {
      setEditingMaterial(null);
      setFormCode(`VT-${Date.now().toString().slice(-4)}`);
      setFormName('');
      setFormCategory('Gỗ MDF');
      setFormUnit('Tấm');
      setFormStockQuantity(10);
      setFormMinStockAlert(5);
      setFormSupplier('');
      setFormNotes('');
    }
    setIsAddMaterialModalOpen(true);
  };

  const handleSaveMaterialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Vui lòng nhập tên vật liệu!');
      return;
    }

    const newMat: Material = {
      id: editingMaterial ? editingMaterial.id : `mat-${Date.now()}`,
      code: formCode.trim() || `VT-${Date.now().toString().slice(-4)}`,
      name: formName.trim(),
      category: formCategory,
      unit: formUnit.trim() || 'Cái',
      costPrice: editingMaterial ? (editingMaterial.costPrice || 0) : 0,
      stockQuantity: Number(formStockQuantity) || 0,
      minStockAlert: Number(formMinStockAlert) || 5,
      supplier: formSupplier.trim() || undefined,
      notes: formNotes.trim() || undefined,
      createdAt: editingMaterial ? editingMaterial.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSaveMaterial(newMat);
    setIsAddMaterialModalOpen(false);
  };

    // Open Stock Import Modal (Tạo đơn nhập hàng mới)
  const handleOpenManualInward = (presetSupplier?: string) => {
    setEditingImportReceipt(null);
    setImportDate(new Date().toISOString().slice(0, 10));
    setImportOrderDate(new Date().toISOString().slice(0, 10));
    setImportSupplier(presetSupplier || '');
    setImportStatus('pending');
    setImportNotes('');
    setImportReceiptCode(`NK-194-${new Date().getFullYear()}-${(stockImports.length + 1).toString().padStart(3, '0')}`);
    setImportItemsList([
      {
        id: `ii-${Date.now()}-0`,
        materialId: '',
        materialCode: '',
        materialName: '',
        unit: 'Tấm',
        quantity: 1,
        costPrice: 0,
        totalCost: 0
      }
    ]);
    setIsNewImportModalOpen(true);
  };

  const handleOpenEditImport = (receipt: StockImportReceipt) => {
    setEditingImportReceipt(receipt);
    setImportDate(receipt.date);
    setImportOrderDate(receipt.orderDate || receipt.date || new Date().toISOString().slice(0, 10));
    setImportSupplier(receipt.supplier);
    setImportStatus(receipt.status || 'pending');
    setImportNotes(receipt.notes || '');
    setImportReceiptCode(receipt.receiptNumber);

    if (receipt.items && receipt.items.length > 0) {
      setImportItemsList(receipt.items.map(it => {
        let cp = it.costPrice || 0;
        // Auto-refresh price from 3 tabs if costPrice is 0 or default 2000 placeholder
        if (cp === 0 || cp === 2000) {
          const lRes = lookupPriceFrom3Tabs(it.materialCode || '', it.materialName || '');
          if (lRes.price > 0) {
            cp = lRes.price;
          }
        }
        const qty = it.quantity || 1;
        return {
          id: it.id || `ii-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          materialId: it.materialId || '',
          materialCode: it.materialCode || '',
          materialName: it.materialName || '',
          unit: it.unit || 'Tấm',
          quantity: qty,
          costPrice: cp,
          totalCost: qty * cp,
          note: it.note || ''
        };
      }));
    } else {
      setImportItemsList([
        {
          id: `ii-${Date.now()}-0`,
          materialId: '',
          materialCode: '',
          materialName: '',
          unit: 'Tấm',
          quantity: 1,
          costPrice: 0,
          totalCost: 0
        }
      ]);
    }
    setIsNewImportModalOpen(true);
  };

  // Helper to look up board core prices directly from size & thickness (MDF 12li, 9li, Fomex)
  const lookupBoardCorePrice = (code: string, name: string): { price: number; name?: string } => {
    try {
      const boardPrices = getLocalBoardCorePrices();
      if (!boardPrices) return { price: 0 };

      const fullStr = `${code || ''} ${name || ''}`.toUpperCase().trim();

      // Determine thickness / material type
      let field: 'mdf12li' | 'fomex9li' | 'mdf9li' = 'mdf9li';
      if (fullStr.includes('12LI') || fullStr.includes('12MM') || fullStr.includes('12 LI') || fullStr.includes('LOIXANH') || fullStr.includes('LÕIXANH')) {
        field = 'mdf12li';
      } else if (fullStr.includes('FOMEX') || fullStr.includes('SIÊUNHẸ') || fullStr.includes('SIEUNHE')) {
        field = 'fomex9li';
      } else {
        field = 'mdf9li';
      }

      const codeClean = (code || '').toUpperCase().replace(/\s+/g, '');

      // 1. First try exact match on sizeKey or row.code or row.size in boardPrices
      for (const key of Object.keys(boardPrices)) {
        const row = boardPrices[key];
        const rowSizeClean = (row.size || key).toUpperCase().replace(/\s+/g, '');
        const rowCodeClean = (row.code || '').toUpperCase().replace(/\s+/g, '');

        if (codeClean && (codeClean === rowCodeClean || codeClean === rowSizeClean || key.toUpperCase() === codeClean)) {
          if (row[field] && row[field] > 0) return { price: row[field], name: row.name };
          if (row.mdf9li > 0) return { price: row.mdf9li, name: row.name };
        }
      }

      // 2. Extract digits from code / name to find size (e.g., 6090 -> 60x90, 1521 -> 15x21, 2030 -> 20x30, 5075 -> 50x75)
      const digitsMatch = fullStr.match(/\d+/g) || [];
      const digitsJoined = digitsMatch.join('');

      for (const key of Object.keys(boardPrices)) {
        const row = boardPrices[key];
        const rSize = (row.size || key).toUpperCase().replace(/\s+/g, '');
        const rDigits = rSize.match(/\d+/g) || [];

        if (rDigits.length >= 2 && rDigits[0] && rDigits[1]) {
          const d1 = rDigits[0];
          const d2 = rDigits[1];
          const combo1 = `${d1}${d2}`;
          const combo2 = `${d1}X${d2}`;
          const combo3 = `${d1}*${d2}`;

          if (digitsJoined.includes(combo1) || fullStr.includes(combo2) || fullStr.includes(combo3) || (fullStr.includes(d1) && fullStr.includes(d2))) {
            const p = row[field] > 0 ? row[field] : (row.mdf9li || row.mdf12li || row.fomex9li || 0);
            if (p > 0) {
              return { price: p, name: row.name || `Gỗ MDF ${row.size}` };
            }
          }
        }
      }
    } catch (e) {
      console.error('Error in lookupBoardCorePrice:', e);
    }
    return { price: 0 };
  };

  // Helper to look up current unit price from 3 Tabs: 1. Giấy In, 2. Bảng Giá Cốt, 3. Mực In (Default 900.000 đ) & 4. Phụ kiện
  const lookupPriceFrom3Tabs = (code: string, name: string): { price: number; matchedName?: string; matchedUnit?: string } => {
    const codeClean = (code || '').toUpperCase().trim();
    const nameClean = (name || '').toLowerCase().trim();

    // 1. Check Ink (Mực in - Default 900,000 đ/bình)
    const isInk = codeClean.startsWith('MUC') || codeClean.includes('LUCIA') || nameClean.includes('mực') || nameClean.includes('lucia');
    if (isInk) {
      const matchedMat = materials?.find(m => {
        const mCat = (m.category || '').toLowerCase();
        const mName = m.name.toLowerCase();
        const mCode = m.code.toUpperCase();
        return mCat.includes('mực') || mName.includes('mực') || mCode.startsWith('MUC');
      });
      const price = (matchedMat && matchedMat.costPrice > 0) ? matchedMat.costPrice : 900000;
      return { price, matchedUnit: 'Bình' };
    }

    // 2. Check Board Core Prices (Bảng giá cốt vật tư)
    const boardRes = lookupBoardCorePrice(codeClean, nameClean);
    if (boardRes.price > 0) {
      return {
        price: boardRes.price,
        matchedName: boardRes.name,
        matchedUnit: 'Tấm'
      };
    }

    // 3. Check Accessory Materials (Bảng giá phụ kiện, phào, keo, viền, mica)
    try {
      const accItems = getLocalAccessoryMaterials();
      if (accItems && accItems.length > 0) {
        const matchedAcc = accItems.find(a => {
          const aId = (a.id || '').toUpperCase().trim();
          const aSku = (a.sku || '').toUpperCase().trim();
          const aName = (a.name || '').toLowerCase().trim();
          if (codeClean && (codeClean === aId || codeClean === aSku || codeClean === aId.replace(/-/g, '') || codeClean === aSku.replace(/-/g, ''))) return true;
          if (nameClean && nameClean.length >= 3 && aName && (aName === nameClean || aName.includes(nameClean) || nameClean.includes(aName))) return true;
          return false;
        });
        if (matchedAcc && matchedAcc.price > 0) {
          return {
            price: matchedAcc.price,
            matchedName: matchedAcc.name,
            matchedUnit: matchedAcc.unit || 'Cái'
          };
        }
      }
    } catch (e) {}

    // 4. Check Paper Catalog (Danh mục giấy in) - Do NOT match if material is board/wood/mdf/fomex/ink
    const isBoardOrWood = nameClean.includes('mdf') || nameClean.includes('fomex') || nameClean.includes('ván') || nameClean.includes('gỗ') || nameClean.includes('khung') || nameClean.includes('phào') || codeClean.includes('12LI') || codeClean.includes('9LI') || codeClean.includes('FOMEX');

    if (!isBoardOrWood) {
      try {
        const paperItems = getLocalPaperMaterials();
        if (paperItems && paperItems.length > 0) {
          const matchedPaper = paperItems.find(p => {
            const pSku = (p.sku || '').toUpperCase().trim();
            const pName = p.name.toLowerCase().trim();

            if (codeClean && pSku) {
              const c1 = codeClean.replace(/[-\s]/g, '');
              const c2 = pSku.replace(/[-\s]/g, '');
              if (c1 === c2) return true;
            }
            if (nameClean && nameClean.length >= 3 && pName && (pName === nameClean || (pName.includes(nameClean) && nameClean.length >= 4))) {
              return true;
            }
            return false;
          });
          if (matchedPaper && matchedPaper.price > 0) {
            return {
              price: matchedPaper.price,
              matchedName: matchedPaper.name,
              matchedUnit: matchedPaper.unit || 'Cuộn'
            };
          }
        }
      } catch (e) {}
    }

    // 5. Check General Warehouse Materials (Tồn kho vật tư)
    if (materials && materials.length > 0) {
      const matchedMat = materials.find(m => {
        const mCode = m.code.toUpperCase().trim();
        const mName = m.name.toLowerCase().trim();
        if (codeClean && mCode) {
          const c1 = codeClean.replace(/[-\s]/g, '');
          const c2 = mCode.replace(/[-\s]/g, '');
          if (c1 === c2) return true;
        }
        if (nameClean && nameClean.length >= 3 && mName && mName === nameClean) {
          return true;
        }
        return false;
      });
      if (matchedMat && matchedMat.costPrice > 0) {
        return {
          price: matchedMat.costPrice,
          matchedName: matchedMat.name,
          matchedUnit: matchedMat.unit || 'Tấm'
        };
      }
    }

    return { price: 0 };
  };

  // Helper actions for item list in import modal
  const handleSelectSKUInRow = (idx: number, skuCodeOrId: string) => {
    const sku = filteredSKUsForSupplier.find(s => s.id === skuCodeOrId || s.code.toUpperCase() === skuCodeOrId.toUpperCase()) || availableSKUsList.find(s => s.id === skuCodeOrId || s.code.toUpperCase() === skuCodeOrId.toUpperCase());
    if (!sku) return;

    // Auto-lookup current price across 3 tabs
    const lookupRes = lookupPriceFrom3Tabs(sku.code, sku.name);
    let cp = lookupRes.price > 0 ? lookupRes.price : (sku.price || 0);

    const isInk = sku.code.toUpperCase().includes('MUC') || sku.name.toLowerCase().includes('mực') || (sku.category || '').toLowerCase().includes('mực');
    if (isInk && cp === 0) {
      cp = 900000;
    }

    setImportItemsList(prev => {
      const updated = [...prev];
      const q = updated[idx].quantity || 1;
      updated[idx] = {
        ...updated[idx],
        materialId: sku.id,
        materialCode: sku.code,
        materialName: sku.name || lookupRes.matchedName || sku.code || 'Vật tư', // ALWAYS keep selected SKU's name!
        unit: sku.unit || lookupRes.matchedUnit || (isInk ? 'Bình' : 'Tấm'),
        costPrice: cp,
        totalCost: q * cp
      };
      return updated;
    });
  };

  const handleAddItemRow = () => {
    setImportItemsList(prev => [
      ...prev,
      {
        id: `ii-${Date.now()}-${prev.length}`,
        materialId: '',
        materialCode: '',
        materialName: '',
        unit: 'Tấm',
        quantity: 1,
        costPrice: 0,
        totalCost: 0,
        note: ''
      }
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (importItemsList.length <= 1) return;
    setImportItemsList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateRowField = (idx: number, field: 'quantity' | 'costPrice' | 'materialName' | 'materialCode' | 'unit' | 'note', val: any) => {
    setImportItemsList(prev => {
      const updated = [...prev];
      const cur = { ...updated[idx], [field]: val };

      // When materialCode is typed or edited, try auto-lookup price & name from 3 tabs
      if (field === 'materialCode' && typeof val === 'string' && val.trim().length >= 2) {
        const lookupRes = lookupPriceFrom3Tabs(val.trim(), cur.materialName || '');
        if (lookupRes.price > 0) {
          cur.costPrice = lookupRes.price;
          if (!cur.materialName.trim() && lookupRes.matchedName) {
            cur.materialName = lookupRes.matchedName;
          }
          if (lookupRes.matchedUnit) {
            cur.unit = lookupRes.matchedUnit;
          }
        }
      }

      const q = Number(cur.quantity) || 0;
      const cp = Number(cur.costPrice) || 0;
      cur.totalCost = q * cp;
      updated[idx] = cur;
      return updated;
    });
  };

  const handleQuickUpdateStatus = (receipt: StockImportReceipt, newStatus: 'pending' | 'ordered' | 'completed') => {
    const isOldOrder = (receipt.date || '') <= '2026-10-03';
    if (isOldOrder) {
      alert("Đơn nhập hàng từ 03/10/2026 trở về trước là đơn lịch sử cố định, không thể đổi trạng thái.");
      return;
    }
    const updatedReceipt: StockImportReceipt = {
      ...receipt,
      status: newStatus,
      orderDate: receipt.orderDate || (newStatus === 'ordered' ? new Date().toISOString().slice(0, 10) : undefined)
    };
    onSaveStockImport(updatedReceipt);
  };

  const handleSaveManualInwardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importSupplier.trim()) {
      alert('Vui lòng chọn hoặc nhập tên nhà cung cấp!');
      return;
    }

    const validItems: StockImportItem[] = importItemsList
      .filter(it => it.materialName.trim() || it.materialCode.trim())
      .map((it, idx) => {
        const q = Number(it.quantity) || 1;
        const cp = Number(it.costPrice) || 0;
        const tc = it.totalCost || (q * cp);
        return {
          id: it.id || `ii-${Date.now()}-${idx}`,
          materialId: it.materialId || `mat-${Date.now()}-${idx}`,
          materialCode: it.materialCode.trim() || `VT-${Date.now()}`,
          materialName: it.materialName.trim() || 'Vật tư nhập',
          unit: it.unit.trim() || 'Cái',
          quantity: q,
          costPrice: cp,
          totalCost: tc,
          note: it.note ? it.note.trim() : undefined
        };
      });

    if (validItems.length === 0) {
      alert('Vui lòng chọn hoặc nhập ít nhất 1 sản phẩm/vật tư nhập!');
      return;
    }

    const totalOrderAmount = validItems.reduce((sum, it) => sum + it.totalCost, 0);

    const receiptId = editingImportReceipt ? editingImportReceipt.id : `imp-${Date.now()}`;
    const code = importReceiptCode.trim() || `NK-194-${new Date().getFullYear()}-${(stockImports.length + 1).toString().padStart(3, '0')}`;

    const newReceipt: StockImportReceipt = {
      id: receiptId,
      receiptNumber: code,
      date: importDate,
      orderDate: importOrderDate || importDate,
      supplier: importSupplier.trim(),
      items: validItems,
      totalAmount: totalOrderAmount,
      paid: totalOrderAmount,
      status: importStatus,
      notes: importNotes.trim() || '',
      createdAt: editingImportReceipt ? editingImportReceipt.createdAt : new Date().toISOString()
    };

    onSaveStockImport(newReceipt);
    setIsNewImportModalOpen(false);
  };

  // Adjust stock handler (Kiểm kê thực tế)
  const handleOpenAdjustModal = (mat: Material) => {
    setAdjustingMaterial(mat);
    setAdjustQty(mat.stockQuantity);
    setAdjustReason('Kiểm kê kho thực tế');
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingMaterial) return;
    onAdjustStock(adjustingMaterial.id, Number(adjustQty), adjustReason);
    setIsAdjustModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-5 sm:p-6 text-white shadow-xl border border-slate-700/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500 rounded-xl text-slate-950 shadow-md">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                KHO NHẬP LIỆU & VẬT TƯ TIỆM IN 194
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                Quản lý số lượng tồn kho, cảnh báo sắp hết và theo dõi chi tiết giá trị nhập hàng theo từng nhà cung cấp
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <button
            type="button"
            onClick={() => handleOpenManualInward()}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" />
            <span>+ Nhập Giá Trị Đợt Mới</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm rounded-xl border border-slate-600 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Thêm Vật Liệu</span>
          </button>

          <button
            type="button"
            onClick={() => setIsClearInventoryModalOpen(true)}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-950/70 hover:bg-rose-900 text-rose-300 hover:text-white font-bold text-xs sm:text-sm rounded-xl border border-rose-800/80 transition cursor-pointer"
            title="Xóa trắng dữ liệu kho hoặc đặt lại số lượng tồn kho"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Xóa Dữ Liệu Kho</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (Đã bỏ giá trị tồn kho) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Tổng loại vật tư */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Tổng loại vật tư</span>
            <Boxes className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            {totalMaterialCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Đang theo dõi trong kho</p>
        </div>

        {/* Card 2: Tổng số lượng trong kho */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Tổng số lượng tồn</span>
            <ArrowUpDown className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
            {formatNumber(totalStockQuantity)}
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Tấm / Cuộn / Cái / Lọ</p>
        </div>

        {/* Card 3: ĐÃ XUẤT BÁN (SỬ DỤNG) */}
        <div
          onClick={() => setActiveSubTab('sales_deductions')}
          className="bg-purple-50/70 border border-purple-200 hover:bg-purple-100/70 rounded-xl p-4 shadow-sm transition cursor-pointer"
          title="Bấm để xem lịch sử xuất kho chi tiết theo từng đơn hàng"
        >
          <div className="flex items-center justify-between text-purple-700 mb-1">
            <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1">
              Đã Xuất Bán
            </span>
            <ShoppingBag className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-800 font-mono">
            {formatNumber(Math.round(totalUsedUnits * 10) / 10)}
          </div>
          <p className="text-[11px] text-purple-700 font-semibold mt-1">
            Dùng cho {totalUsedOrdersCount} đơn hàng
          </p>
        </div>

        {/* Card 4: Sắp hết hàng */}
        <div
          onClick={() => {
            setActiveSubTab('inventory');
            setStatusFilter(statusFilter === 'low' ? 'all' : 'low');
          }}
          className={`rounded-xl p-4 shadow-sm border transition cursor-pointer ${
            lowStockMaterials.length > 0
              ? 'bg-rose-50 border-rose-200 hover:bg-rose-100/80 ring-2 ring-rose-400/30'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1">
              {lowStockMaterials.length > 0 && <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />}
              Sắp hết hàng
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-700 font-mono">
            {lowStockMaterials.length} <span className="text-xs font-normal text-rose-600">loại</span>
          </div>
          <p className="text-[11px] text-rose-600 font-bold mt-1">
            {lowStockMaterials.length > 0 ? 'Bấm để lọc xem ngay' : 'Đầy đủ hàng an toàn'}
          </p>
        </div>

        {/* Card 5: Tổng giá trị vật tư nhập trong năm */}
        <div
          onClick={() => setActiveSubTab('supplier_expenses')}
          className="bg-amber-50/70 border border-amber-200 hover:bg-amber-100/70 rounded-xl p-4 shadow-sm transition cursor-pointer"
          title="Bấm để xem chi tiết theo dõi giá trị nhập theo từng nhà cung cấp"
        >
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-xs font-black uppercase tracking-wider">Tổng Nhập Năm {currentYear}</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-800 font-mono truncate" title={formatCurrency(currentYearTotalInward)}>
            {formatCurrency(currentYearTotalInward)}
          </div>
          <p className="text-[11px] text-amber-700 font-medium mt-1">Giá trị vật tư nhập năm nay</p>
        </div>

        {/* Card 6: Số Nhà Cung Cấp */}
        <div
          onClick={() => setActiveSubTab('supplier_expenses')}
          className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 col-span-2 md:col-span-1 cursor-pointer hover:bg-slate-50 transition"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Nhà Cung Cấp</span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-900 font-mono">
            {allSuppliersList.length} <span className="text-xs font-normal text-slate-500">đơn vị</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{stockImports.length} đợt nhập hàng</p>
        </div>

        {/* Card 7: Theo Dõi Mực In 12 Màu */}
        <div
          onClick={() => setActiveSubTab('ink_tracking')}
          className="bg-cyan-50/70 border border-cyan-200 hover:bg-cyan-100/70 rounded-xl p-4 shadow-sm transition cursor-pointer"
          title="Bấm để xem chi tiết theo dõi lượng mực in 12 màu Lucia Pro"
        >
          <div className="flex items-center justify-between text-cyan-800 mb-1">
            <span className="text-xs font-black uppercase tracking-wider">Mực In 12 Màu</span>
            <Droplet className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-cyan-950 font-mono">
            {inkImports.length} <span className="text-xs font-normal text-cyan-700">đợt nhập</span>
          </div>
          <p className="text-[11px] text-cyan-700 font-medium mt-1">Canon Lucia Pro (12 màu)</p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition cursor-pointer shrink-0 ${
            activeSubTab === 'inventory'
              ? 'border-amber-500 text-amber-700 bg-amber-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Danh Sách Vật Tư Tồn Kho ({materials.length})</span>
          {lowStockMaterials.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-500 text-white animate-pulse">
              {lowStockMaterials.length} sắp hết
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('supplier_expenses')}
          className={`flex items-center gap-2 px-4 py-2.5 font-black text-sm border-b-2 transition cursor-pointer shrink-0 ${
            activeSubTab === 'supplier_expenses'
              ? 'border-amber-500 text-amber-800 bg-amber-50/60 shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 text-amber-600" />
          <span>Theo Dõi Giá Trị Nhập Vào & NCC ({allSuppliersList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition cursor-pointer shrink-0 ${
            activeSubTab === 'history'
              ? 'border-amber-500 text-amber-700 bg-amber-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Lịch Sử Các Đợt Nhập ({stockImports.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('board_prices')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition cursor-pointer shrink-0 ${
            activeSubTab === 'board_prices'
              ? 'border-amber-500 text-amber-800 bg-amber-50/60 shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4 text-amber-600" />
          <span>Bảng Giá Cốt Vật Tư</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('sales_deductions');
            setDeductionsSubTab('history');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition cursor-pointer shrink-0 ${
            activeSubTab === 'sales_deductions' && deductionsSubTab === 'history'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Lịch Sử Vật Tư Khấu Trừ Tự Động Theo Đơn Bán Hàng</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('sales_deductions');
            setDeductionsSubTab('monthly_summary');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition cursor-pointer shrink-0 ${
            activeSubTab === 'sales_deductions' && deductionsSubTab === 'monthly_summary'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60 font-black shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Star className={`w-4 h-4 ${trackedMaterials.length > 0 ? 'text-amber-500 fill-amber-400' : 'text-slate-400'}`} />
          <span>Thống kê số lượng ván/fomex đã xuất trong tháng</span>
          {trackedMaterials.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              {trackedMaterials.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('ink_tracking')}
          className={`flex items-center gap-2 px-4 py-2.5 font-black text-sm border-b-2 transition cursor-pointer shrink-0 ${
            activeSubTab === 'ink_tracking'
              ? 'border-cyan-500 text-cyan-800 bg-cyan-50/70 shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Droplet className="w-4 h-4 text-cyan-600" />
          <span>Theo dõi và quản lý Giấy - Mực in</span>
        </button>

        <div className="ml-auto hidden lg:block">
          <button
            type="button"
            onClick={() => setIsBOMGuideOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-700" />
            <span>📘 Định Mức Cốt Ảnh (BOM)</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: INVENTORY LIST (ĐÃ BỎ CỘT GIÁ NHẬP & GIÁ TRỊ TỒN KHO) */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm vật liệu theo tên, mã vật tư, nhà cung cấp..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none"
              >
                <option value="all">Tất cả nhóm vật liệu</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Status Filter Badges */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1.5 rounded-lg transition ${
                    statusFilter === 'all' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất cả ({materials.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('low')}
                  className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 ${
                    statusFilter === 'low' ? 'bg-rose-500 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  <span>Sắp hết</span>
                  <span className="px-1 py-0.2 rounded-full text-[10px] bg-rose-900/40 text-white">
                    {lowStockMaterials.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('instock')}
                  className={`px-2.5 py-1.5 rounded-lg transition ${
                    statusFilter === 'instock' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  Còn hàng
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('out')}
                  className={`px-2.5 py-1.5 rounded-lg transition ${
                    statusFilter === 'out' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Hết hàng ({outOfStockMaterials.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('tracked')}
                  className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 ${
                    statusFilter === 'tracked'
                      ? 'bg-amber-500 text-white shadow-xs font-black'
                      : 'text-amber-800 hover:bg-amber-100/70 font-semibold'
                  }`}
                  title="Chỉ hiển thị các vật tư bạn đã gắn sao ⭐ cần theo dõi"
                >
                  <Star className={`w-3.5 h-3.5 ${statusFilter === 'tracked' ? 'fill-white text-white' : 'fill-amber-400 text-amber-500'}`} />
                  <span>Cần theo dõi ({trackedMaterials.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Materials Table (Không còn cột Giá Nhập & Tổng Giá Trị Tồn) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                    <th className="py-3 px-3 w-12 text-center">STT</th>
                    <th className="py-3 px-3 w-32">Mã Vật Tư</th>
                    <th className="py-3 px-3">Tên Vật Liệu & Quy Cách</th>
                    <th className="py-3 px-3 w-32">Nhóm</th>
                    <th className="py-3 px-2 w-16 text-center">ĐVT</th>
                    <th className="py-3 px-3 w-32 text-center bg-purple-50 text-purple-950 font-black border-x border-purple-200">
                      Đã Xuất Bán
                    </th>
                    <th className="py-3 px-3 w-40 text-center">SL Tồn Kho</th>
                    <th className="py-3 px-3 w-36 text-center">Tình Trạng</th>
                    <th className="py-3 px-3 w-36 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Boxes className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">Không tìm thấy vật liệu nào phù hợp</p>
                        <p className="text-xs text-slate-400 mt-1">Hãy thử xóa bộ lọc hoặc bấm "+ Thêm Vật Liệu"</p>
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map((mat, idx) => {
                      const isLow = mat.stockQuantity > 0 && mat.stockQuantity <= mat.minStockAlert;
                      const isOut = mat.stockQuantity <= 0;
                      const usage = materialUsageMap[mat.id];

                      return (
                        <tr
                          key={mat.id}
                          className={`hover:bg-slate-50/80 transition ${
                            isLow ? 'bg-rose-50/40' : isOut ? 'bg-slate-100/60' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleTrackedMaterial(mat);
                                }}
                                className="p-1 rounded-md hover:bg-amber-100/70 transition cursor-pointer group shrink-0"
                                title={isMaterialTracked(mat) ? "Bỏ khỏi danh sách theo dõi ván/fomex (⭐)" : "Đánh dấu vào danh sách vật tư cần theo dõi (⭐)"}
                              >
                                <Star
                                  className={`w-4 h-4 transition-transform group-hover:scale-125 ${
                                    isMaterialTracked(mat)
                                      ? "text-amber-500 fill-amber-400 drop-shadow-xs"
                                      : "text-slate-300 hover:text-amber-400"
                                  }`}
                                />
                              </button>
                              <span>{mat.code}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 text-sm">{mat.name}</div>
                            {mat.supplier && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <Truck className="w-3 h-3 text-slate-400" />
                                <span>NCC: {mat.supplier}</span>
                              </div>
                            )}
                            {mat.notes && (
                              <div className="text-[11px] text-amber-700 italic mt-0.5">
                                * {mat.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {mat.category}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center font-semibold text-slate-700">{mat.unit}</td>
                          <td className="py-3 px-3 text-center bg-purple-50/30 border-x border-purple-100">
                            {usage && usage.usedQuantity > 0 ? (
                              <div className="flex flex-col items-center">
                                <span className="px-2 py-0.5 rounded-full text-xs font-black font-mono bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs">
                                  {usage.usedQuantity} <span className="text-[10px] font-normal">{mat.unit}</span>
                                </span>
                                <span
                                  className="text-[10px] text-purple-700 font-semibold mt-0.5 cursor-pointer hover:underline"
                                  onClick={() => setActiveSubTab('sales_deductions')}
                                  title={`Đã xuất cho ${usage.orderCount} đơn hàng: ${usage.orderNumbers.join(', ')}`}
                                >
                                  {usage.orderCount} đơn hàng
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">0 {mat.unit}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center">
                              <span className={`text-base font-black font-mono ${
                                isOut ? 'text-slate-400' : isLow ? 'text-rose-600' : 'text-emerald-700'
                              }`}>
                                {formatNumber(mat.stockQuantity)} <span className="text-xs font-normal text-slate-500">{mat.unit}</span>
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Báo hết: &lt;= {mat.minStockAlert}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-200 text-slate-700 border border-slate-300">
                                Hết Hàng
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-500 text-white shadow-xs animate-pulse">
                                🔴 Sắp Hết ({mat.stockQuantity})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                🟢 Còn Hàng
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Adjust / Use stock button */}
                              <button
                                type="button"
                                onClick={() => handleOpenAdjustModal(mat)}
                                className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
                                title="Kiểm kê thực tế hoặc điều chỉnh tồn kho"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenAddModal(mat)}
                                className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                                title="Chỉnh sửa thông tin vật tư"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => setMaterialToDelete(mat)}
                                className="p-1.5 rounded-lg bg-slate-100 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                                title="Xóa vật tư này khỏi kho"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: THEO DÕI GIÁ TRỊ NHẬP VÀO & NHÀ CUNG CẤP (NEW & DEDICATED) */}
      {/* ========================================================================= */}
      {activeSubTab === 'supplier_expenses' && (
        <div className="space-y-6">
          {/* Top Control Bar & Year Selector */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-600" />
                  <span>THEO DÕI GIÁ TRỊ VẬT TƯ NHẬP VÀO & NHÀ CUNG CẤP</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nhập giá trị thủ công từng đợt hàng, tự động tổng hợp chi phí cả năm theo từng nhà cung cấp và từng mặt hàng
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenManualInward()}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-emerald-600/20 transition cursor-pointer shrink-0"
              >
                <PackagePlus className="w-4 h-4" />
                <span>+ Nhập Giá Trị Đợt Mới</span>
              </button>
            </div>

            {/* Filter controls: Year & Supplier & Search */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              {/* Year Filter buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-600 mr-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Năm:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedYear('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                    selectedYear === 'all'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tất cả các năm
                </button>
                {availableYears.map(yr => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setSelectedYear(yr)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                      selectedYear === yr
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Năm {yr}
                  </button>
                ))}
              </div>

              {/* Supplier Filter & Search */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedSupplierFilter}
                  onChange={e => setSelectedSupplierFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none"
                >
                  <option value="all">Tất cả Nhà Cung Cấp ({allSuppliersList.length})</option>
                  {allSuppliersList.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={supplierSearchQuery}
                    onChange={e => setSupplierSearchQuery(e.target.value)}
                    placeholder="Tìm mặt hàng, NCC..."
                    className="pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none w-44"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* KPI Summary for the Selected Year/Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white p-4 rounded-2xl border-2 border-amber-300 shadow-xs">
              <div className="flex items-center justify-between text-amber-800 mb-1">
                <span className="text-xs font-extrabold uppercase tracking-wider">
                  Tổng Chi Phí Nhập {selectedYear === 'all' ? 'Toàn Bộ' : `Năm ${selectedYear}`}
                </span>
                <DollarSign className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-900 font-mono mt-1">
                {formatCurrency(selectedViewTotalExpense)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Tổng giá trị vật tư nhập vào hệ thống
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Số Nhà Cung Cấp</span>
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-1">
                {supplierAnnualSummaries.length} <span className="text-xs font-normal text-slate-500">đơn vị</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Phát sinh đợt nhập trong {selectedYear === 'all' ? 'toàn bộ thời gian' : `năm ${selectedYear}`}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Số Đợt Nhập Hàng</span>
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono mt-1">
                {filteredStockImportsForExpenseTab.length} <span className="text-xs font-normal text-slate-500">đợt</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Đã ghi nhận phiếu nhập thủ công
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Trung Bình Mỗi Đợt</span>
                <PieChart className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-purple-800 font-mono mt-1">
                {formatCurrency(
                  filteredStockImportsForExpenseTab.length > 0
                    ? Math.round(selectedViewTotalExpense / filteredStockImportsForExpenseTab.length)
                    : 0
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Giá trị trung bình 1 lần mua hàng
              </p>
            </div>
          </div>

          {/* TABLE 1: BẢNG TỔNG HỢP CẢ NĂM THEO TỪNG NHÀ CUNG CẤP */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
            <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-500 text-slate-950 rounded-lg">
                  <Building2 className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="font-extrabold text-sm uppercase tracking-wide">
                    BẢNG TỔNG HỢP GIÁ TRỊ NHẬP CẢ NĂM THEO TỪNG NHÀ CUNG CẤP ({selectedYear === 'all' ? 'TẤT CẢ CÁC NĂM' : `NĂM ${selectedYear}`})
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Thống kê chi tiết mặt hàng và tổng số tiền đã nhập của từng nhà cung cấp
                  </p>
                </div>
              </div>
              <div className="text-xs font-bold bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                Tổng cộng: <strong className="text-amber-400 font-mono text-sm ml-1">{formatCurrency(selectedViewTotalExpense)}</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                    <th className="py-3 px-3 w-12 text-center">STT</th>
                    <th className="py-3 px-4 w-60">Tên Nhà Cung Cấp</th>
                    <th className="py-3 px-3">Mặt Hàng Đã Nhập Từ NCC Này</th>
                    <th className="py-3 px-3 w-28 text-center">Số Đợt Nhập</th>
                    <th className="py-3 px-4 w-44 text-right">Tổng Tiền Cả Năm</th>
                    <th className="py-3 px-3 w-32 text-center">Tỷ Trọng (%)</th>
                    <th className="py-3 px-3 w-28 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supplierAnnualSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        Chưa có dữ liệu nhập hàng nào trong {selectedYear === 'all' ? 'hệ thống' : `năm ${selectedYear}`}
                      </td>
                    </tr>
                  ) : (
                    supplierAnnualSummaries.map((s, idx) => (
                      <tr key={s.supplierName} className="hover:bg-amber-50/40 transition">
                        <td className="py-3.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>{s.supplierName}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Lần nhập gần nhất: <span className="font-mono text-slate-600 font-semibold">{formatDateVN(s.latestDate)}</span>
                          </p>
                        </td>
                        <td className="py-3.5 px-3">
                          <p className="text-slate-800 font-medium leading-relaxed">
                            {s.itemsSummary || 'Vật tư tổng hợp'}
                          </p>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-bold font-mono text-xs">
                            {s.batchCount} đợt
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-mono font-black text-base text-rose-700">
                            {formatCurrency(s.totalYearAmount)}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <div className="w-full flex flex-col items-center gap-1">
                            <span className="font-mono font-bold text-slate-700">
                              {s.percentage.toFixed(1)}%
                            </span>
                            <div className="w-20 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-amber-500 h-full rounded-full"
                                style={{ width: `${Math.min(100, Math.max(5, s.percentage))}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSupplierFilter(s.supplierName);
                            }}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Xem đợt nhập
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLE 2: BẢNG KÊ CHI TIẾT TỪNG ĐỢT NHẬP VẬT TƯ THỦ CÔNG */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>DANH SÁCH CHI TIẾT TỪNG ĐỢT NHẬP HÀNG</span>
                  <span className="text-xs font-normal text-slate-500">({filteredStockImportsForExpenseTab.length} phiếu)</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Xem lại, chỉnh sửa số tiền hoặc xóa từng đợt nhập thủ công
                </p>
              </div>

              {selectedSupplierFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedSupplierFilter('all')}
                  className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Bỏ lọc NCC: {selectedSupplierFilter}</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                    <th className="py-3 px-3 w-12 text-center">STT</th>
                    <th className="py-3 px-3 w-32">Mã Phiếu</th>
                    <th className="py-3 px-3 w-28">Ngày Nhập</th>
                    <th className="py-3 px-4 w-52">Nhà Cung Cấp</th>
                    <th className="py-3 px-3">Mặt Hàng Nhập</th>
                    <th className="py-3 px-4 w-36 text-right">Giá Trị Nhập Đợt Này</th>
                    <th className="py-3 px-3 w-36 text-center">Trạng Thái</th>
                    <th className="py-3 px-3 w-28 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStockImportsForExpenseTab.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        Không có đợt nhập hàng nào phù hợp với bộ lọc hiện tại
                      </td>
                    </tr>
                  ) : (
                    filteredStockImportsForExpenseTab.map((imp, idx) => (
                      <tr key={imp.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{imp.receiptNumber}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{formatDateVN(imp.date)}</td>
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-slate-900 text-sm">{imp.supplier}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="space-y-1.5">
                            {imp.items.map((it, iIdx) => (
                              <div key={iIdx} className="text-slate-800 text-xs flex items-center flex-wrap gap-1">
                                <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200" title={`Mã SKU: ${it.materialCode || it.materialId}`}>
                                  {it.materialCode || it.materialId || "SKU"}
                                </span>
                                <strong className="text-slate-900">{it.materialName}</strong>
                                <span className="text-slate-600 font-mono font-semibold">({it.quantity} {it.unit})</span>
                                <span className="text-slate-400 font-mono text-[11px]">@{formatCurrency(it.costPrice)}</span>
                                {it.note && (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 italic">
                                    {it.note}
                                  </span>
                                )}
                              </div>
                            ))}
                            {imp.notes && (
                              <p className="text-[11px] text-amber-700 italic mt-0.5">* Ghi chú: {imp.notes}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-rose-700 text-sm">
                          {formatCurrency(imp.totalAmount)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {(imp.date || '') <= '2026-10-03' ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300 inline-flex items-center gap-1 cursor-default" title="Đơn nhập kho lịch sử trước 03/10/2026 - Không cộng dồn lại kho">
                              <CheckCircle2 className="w-3 h-3 text-slate-500" />
                              <span>Hàng đã nhập kho (Lịch sử)</span>
                            </span>
                          ) : (
                            <select
                              value={imp.status || 'pending'}
                              onChange={(e) => { e.stopPropagation(); handleQuickUpdateStatus(imp, e.target.value as 'pending' | 'ordered' | 'completed'); }}
                              className={`px-2 py-1 rounded-xl text-[11px] font-extrabold border outline-none cursor-pointer transition shadow-2xs ${imp.status === 'completed' ? 'bg-emerald-100 text-emerald-950 border-emerald-300' : imp.status === 'ordered' ? 'bg-blue-100 text-blue-950 border-blue-300' : 'bg-amber-100 text-amber-950 border-amber-300'}`}
                            >
                              <option value="pending">⏳ Chờ xử lý</option>
                              <option value="ordered">🚚 Đã lên đơn</option>
                              <option value="completed">✅ Hàng đã nhập kho</option>
                            </select>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportSupplierJPG({
                                  supplier: imp.supplier,
                                  date: imp.date,
                                  orderDate: imp.orderDate || (imp.status === "ordered" || imp.status === "completed" ? imp.date : new Date().toISOString().slice(0, 10)),
                                  receiptNumber: imp.receiptNumber,
                                  notes: imp.notes,
                                  items: imp.items.map(it => ({
                                    materialName: it.materialName,
                                    quantity: it.quantity,
                                    unit: it.unit,
                                    note: it.note
                                  }))
                                });
                              }}
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition cursor-pointer"
                              title="Tải ảnh JPG gửi NCC (Chỉ tên hàng, SL & ghi chú; Ẩn SKU & Giá)"
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditImport(imp)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                              title="Chỉnh sửa đợt nhập này"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {onDeleteStockImport && (
                              <button
                                type="button"
                                onClick={() => setReceiptToDelete(imp)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                                title="Xóa đợt nhập này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: LỊCH SỬ CÁC ĐỢT NHẬP */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800">Toàn Bộ Lịch Sử Các Đợt Nhập Hàng</h3>
                <p className="text-xs text-slate-500">Toàn bộ chi phí nhập kho được tự động đưa vào báo cáo lời lãi ({stockImports.length} phiếu)</p>
              </div>
              <div className="flex items-center gap-2">
                {stockImports.length > 0 && onClearAllStockImports && (
                  <button
                    type="button"
                    onClick={() => setIsClearStockImportsModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                    title="Xóa hết toàn bộ phiếu nhập kho"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Xóa Hết Lịch Sử Phiếu Nhập</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleOpenManualInward()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nhập Kho Mới</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                    <th className="py-3 px-3 w-10 text-center">STT</th>
                    <th className="py-3 px-3 w-28">Mã Phiếu</th>
                    <th className="py-3 px-3 w-24">Ngày Nhập</th>
                    <th className="py-3 px-3 w-40">Nhà Cung Cấp</th>
                    <th className="py-3 px-3">Chi Tiết Mặt Hàng Nhập</th>
                    <th className="py-3 px-3 w-28 text-right">Tổng Tiền</th>
                    <th className="py-3 px-3 w-32 text-center">Trạng Thái</th>
                    <th className="py-3 px-3 w-36 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockImports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Chưa có phiếu nhập kho nào được ghi nhận
                      </td>
                    </tr>
                  ) : (
                    stockImports.map((imp, idx) => (
                      <tr key={imp.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{imp.receiptNumber}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{formatDateVN(imp.date)}</td>
                        <td className="py-3 px-3 font-bold text-slate-800">{imp.supplier}</td>
                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            {imp.items.map((it, iIdx) => (
                              <div key={iIdx} className="text-[11px] text-slate-700 flex items-center justify-between gap-2 bg-slate-50 px-2 py-0.5 rounded-sm">
                                <span>• <strong>{it.materialName}</strong>:</span>
                                <span className="font-mono text-slate-900 font-semibold">
                                  {it.quantity} {it.unit} x {formatCurrency(it.costPrice)} = <strong>{formatCurrency(it.totalCost)}</strong>
                                </span>
                              </div>
                            ))}
                          </div>
                          {imp.notes && (
                            <p className="text-[10px] text-amber-700 italic mt-1">* Ghi chú: {imp.notes}</p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-rose-700 text-sm">
                          {formatCurrency(imp.totalAmount)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {(imp.date || '') <= '2026-10-03' ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300 inline-flex items-center gap-1 cursor-default" title="Đơn nhập kho lịch sử trước 03/10/2026 - Không cộng dồn lại kho">
                              <CheckCircle2 className="w-3 h-3 text-slate-500" />
                              <span>Hàng đã nhập kho (Lịch sử)</span>
                            </span>
                          ) : (
                            <select
                              value={imp.status || 'pending'}
                              onChange={(e) => handleQuickUpdateStatus(imp, e.target.value as 'pending' | 'ordered' | 'completed')}
                              className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border outline-none cursor-pointer transition shadow-2xs ${(imp.status === 'completed' || (imp.status as any) === 'Hàng đã nhập kho') ? 'bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200' : (imp.status === 'ordered' || (imp.status as any) === 'Đã lên đơn') ? 'bg-blue-100 text-blue-950 border-blue-300 hover:bg-blue-200' : 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200'}`}
                              title="Thay đổi trạng thái đơn nhập hàng"
                            >
                              <option value="pending">⏳ Chờ xử lý</option>
                              <option value="ordered">🚚 Đã lên đơn</option>
                              <option value="completed">✅ Hàng đã nhập kho</option>
                            </select>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {(imp.date || '') > '2026-10-03' && imp.status !== 'completed' && (imp.status as any) !== 'Hàng đã nhập kho' && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleQuickUpdateStatus(imp, 'completed'); }}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold cursor-pointer transition shadow-xs flex items-center gap-1"
                                title="Bấm để chuyển trạng thái sang Hàng đã nhập kho, tự động cộng dồn tồn kho & cập nhật giá"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Nhập kho</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedReceiptDetail(imp)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                              title="Xem chi tiết"
                            >
                              Xem
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditImport(imp)}
                              className="p-1 rounded-lg bg-slate-100 hover:bg-blue-100 text-blue-600 cursor-pointer transition"
                              title="Sửa đơn nhập"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {onDeleteStockImport && (
                              <button
                                type="button"
                                onClick={() => setReceiptToDelete(imp)}
                                className="p-1 rounded-lg bg-slate-100 hover:bg-rose-100 text-rose-600 cursor-pointer transition"
                                title="Xóa phiếu"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: BẢNG GIÁ CỐT VẬT TƯ */}
      {activeSubTab === 'board_prices' && (
        <BoardCorePriceTable currentUserEmail={undefined} materials={materials} />
      )}

      {/* SUB-TAB 4: SALES ORDERS MATERIAL DEDUCTIONS & MONTHLY BOARD STATS */}
      {activeSubTab === 'sales_deductions' && (
        <div className="space-y-4">
          {/* Sub-tab Navigation: Tab 1 (Lịch sử khấu trừ) & Tab 2 (Thống kê ván/fomex đã xuất trong tháng) */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDeductionsSubTab('history')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
                  deductionsSubTab === 'history'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>1. Lịch Sử Vật Tư Khấu Trừ Tự Động Theo Đơn Bán Hàng</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  deductionsSubTab === 'history' ? 'bg-purple-800 text-purple-100' : 'bg-slate-200 text-slate-700'
                }`}>
                  {filteredDeductionRecords.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDeductionsSubTab('monthly_summary')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
                  deductionsSubTab === 'monthly_summary'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Star className="w-4 h-4 text-amber-300 fill-amber-300" />
                <span>2. Thống kê số lượng ván/fomex đã xuất trong tháng</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  deductionsSubTab === 'monthly_summary' ? 'bg-indigo-800 text-indigo-100' : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  ⭐ {trackedMaterials.length} theo dõi
                </span>
              </button>
            </div>

            {deductionsSubTab === 'monthly_summary' && trackedMaterials.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFullYearGrid(prev => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    showFullYearGrid
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <PieChart className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{showFullYearGrid ? 'Thu Gọn Bảng 12 Tháng' : '📊 Đối Chiếu 12 Tháng'}</span>
                </button>
              </div>
            )}
          </div>

          {/* TAB 1: LỊCH SỬ KHẤU TRỪ TỰ ĐỘNG THEO ĐƠN BÁN HÀNG */}
          {deductionsSubTab === 'history' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-slate-800">
                    Lịch Sử Vật Tư Khấu Trừ Tự Động Theo Đơn Bán Hàng
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                    {filteredDeductionRecords.length} đợt trừ kho
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kho tự động khấu trừ ván MDF, Fomex và phụ kiện theo ngày phát sinh thực tế. Hàng bổ sung trừ vào đúng ngày bấm bổ sung.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBOMGuideOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition cursor-pointer self-start md:self-auto shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Xem Công Thức Cấu Thành (BOM)</span>
              </button>
            </div>

            {/* Bộ lọc theo ngày & tìm kiếm đợt xuất kho */}
            <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1 mr-1">
                  <Filter className="w-3.5 h-3.5 text-purple-600" />
                  Lọc ngày trừ kho:
                </span>
                <button
                  type="button"
                  onClick={() => setDeductionsDateFilter('all')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    deductionsDateFilter === 'all'
                      ? 'bg-purple-600 text-white font-bold shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setDeductionsDateFilter('today')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    deductionsDateFilter === 'today'
                      ? 'bg-purple-600 text-white font-bold shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  ⚡ Hôm nay ({formatDateVN(todayStr)})
                </button>
                <button
                  type="button"
                  onClick={() => setDeductionsDateFilter('yesterday')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    deductionsDateFilter === 'yesterday'
                      ? 'bg-purple-600 text-white font-bold shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Hôm qua
                </button>
                <button
                  type="button"
                  onClick={() => setDeductionsDateFilter('7days')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    deductionsDateFilter === '7days'
                      ? 'bg-purple-600 text-white font-bold shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  7 ngày qua
                </button>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={deductionsCustomDate}
                    onChange={(e) => {
                      setDeductionsCustomDate(e.target.value);
                      setDeductionsDateFilter('custom');
                    }}
                    className={`px-2 py-1 text-xs font-mono rounded-lg border transition ${
                      deductionsDateFilter === 'custom'
                        ? 'border-purple-500 bg-purple-50/50 text-purple-900 font-bold'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  />
                  {deductionsDateFilter === 'custom' && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeductionsDateFilter('all');
                        setDeductionsCustomDate('');
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
                      title="Bỏ chọn ngày"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Tìm kiếm */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={deductionsSearchQuery}
                  onChange={(e) => setDeductionsSearchQuery(e.target.value)}
                  placeholder="Tìm mã đơn, tên khách, vật tư..."
                  className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-purple-500 outline-hidden"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                    <th className="py-3 px-3 w-12 text-center">STT</th>
                    <th className="py-3 px-3 w-36">Mã Đơn Hàng</th>
                    <th className="py-3 px-3 w-36 text-center">Ngày Trừ Kho</th>
                    <th className="py-3 px-3 w-40">Khách Hàng / Studio</th>
                    <th className="py-3 px-3">Sản Phẩm Đã Bán (Đợt Này)</th>
                    <th className="py-3 px-3 min-w-[220px]">Nguyên Vật Tư Kho Đã Trừ</th>
                    <th className="py-3 px-3 w-24 text-center">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDeductionRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        {salesDeductionRecords.length === 0
                          ? 'Chưa có đơn hàng nào phát sinh trừ vật tư'
                          : 'Không tìm thấy đợt trừ vật tư nào phù hợp với bộ lọc ngày/tìm kiếm'}
                      </td>
                    </tr>
                  ) : (
                    filteredDeductionRecords.map((rec, idx) => {
                      return (
                        <tr
                          key={rec.id}
                          className={`transition ${
                            rec.isSupplement ? 'bg-blue-50/30 hover:bg-blue-50/60' : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <div className="font-mono font-bold text-slate-900">{rec.orderNumber}</div>
                            {rec.isSupplement ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mt-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                ✨ Bổ sung
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Đơn gốc</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="font-mono font-bold text-slate-800 text-[11px]">
                              {formatDateVN(rec.deductionDate)}
                            </div>
                            {rec.deductionDate === todayStr && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Hôm nay
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-800">{rec.customerName}</td>
                          <td className="py-3 px-3">
                            <div className="space-y-1">
                              {rec.items.map((it, iIdx) => (
                                <div key={iIdx} className="text-[11px] text-slate-700">
                                  • {it.quantity}x <strong>{it.productName || it.productCode}</strong> ({it.size || '-'})
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {rec.deductions.length === 0 ? (
                              <span className="text-[11px] text-slate-400 italic">Không phát sinh trừ vật tư</span>
                            ) : (
                              <div className="space-y-1">
                                {rec.deductions.map((d, dIdx) => (
                                  <div
                                    key={dIdx}
                                    className={`text-[11px] flex items-center justify-between gap-2 px-2 py-0.5 rounded border ${
                                      rec.isSupplement
                                        ? 'bg-blue-50 text-blue-950 border-blue-200'
                                        : 'bg-purple-50 text-purple-950 border-purple-200'
                                    }`}
                                  >
                                    <span className="font-medium">• {d.materialName}:</span>
                                    <span
                                      className={`font-mono font-bold ${
                                        rec.isSupplement ? 'text-blue-700' : 'text-purple-700'
                                      }`}
                                    >
                                      -{d.quantity} {d.unit}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {rec.status === 'completed' ? 'Đã in xong' : rec.status === 'delivered' ? 'Đã giao' : rec.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: THỐNG KÊ SỐ LƯỢNG VÁN / FOMEX ĐÃ XUẤT TRONG THÁNG */}
        {deductionsSubTab === 'monthly_summary' && (
          <div className="space-y-4">
            {/* TRƯỜNG HỢP 1: DANH SÁCH THEO DÕI ĐANG ĐỂ TRỐNG (THEO ĐÚNG YÊU CẦU CỦA USER) */}
            {trackedMaterials.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-12 text-center">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-center mx-auto mb-4 text-amber-500 shadow-sm">
                  <Star className="w-8 h-8 fill-amber-400" />
                </div>
                <h3 className="text-lg font-black text-slate-800 mb-2">
                  Danh Sách Vật Tư Cần Theo Dõi Đang Để Trống
                </h3>
                <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6 leading-relaxed">
                  Bảng thống kê số lượng ván/fomex xuất trong tháng hiện đang để trống chờ bạn tạo danh sách.
                  Hãy sang tab <strong>"Danh Sách Vật Tư Tồn Kho"</strong> và bấm vào biểu tượng ngôi sao <span className="inline-flex items-center text-amber-500 font-bold">⭐</span> bên cạnh <strong>Mã vật tư</strong> của từng loại ván MDF hoặc Fomex bạn muốn theo dõi.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('inventory')}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
                  >
                    <Boxes className="w-4 h-4" />
                    <span>Sang "Danh Sách Vật Tư Tồn Kho" Để Đánh Dấu ⭐</span>
                  </button>
                </div>
              </div>
            ) : (
              /* TRƯỜNG HỢP 2: ĐÃ CÓ CÁC VẬT TƯ ĐƯỢC ĐÁNH DẤU THEO DÕI */
              <div className="space-y-4">
                {/* BỘ ĐIỀU KHIỂN CHỌN THÁNG & NĂM */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                          <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                            <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                          </span>
                          <span>Thống Kê Số Lượng Ván / Fomex Đã Xuất Trong Tháng</span>
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          Tháng {statsMonth}/{statsYear}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Liên kết tự động với Kho vật tư tồn kho: Mỗi khi phát sinh đơn hàng bán ra có trừ ván/fomex, hệ thống tự động tổng hợp số lượng xuất tại đây.
                      </p>
                    </div>

                    {/* Năm & Chuyển tháng */}
                    <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-end">
                      <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={handlePrevStatsMonth}
                          className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-white rounded-lg transition cursor-pointer"
                          title="Tháng trước"
                        >
                          ◀ Tháng trước
                        </button>
                        <button
                          type="button"
                          onClick={handleCurrentStatsMonth}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                            statsMonth === new Date().getMonth() + 1 && statsYear === new Date().getFullYear()
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-indigo-700 hover:bg-white'
                          }`}
                          title="Về tháng hiện tại"
                        >
                          ⚡ Tháng Này
                        </button>
                        <button
                          type="button"
                          onClick={handleNextStatsMonth}
                          className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-white rounded-lg transition cursor-pointer"
                          title="Tháng sau"
                        >
                          Tháng sau ▶
                        </button>
                      </div>

                      {/* Chọn năm */}
                      <select
                        value={statsYear}
                        onChange={(e) => setStatsYear(Number(e.target.value))}
                        className="px-3 py-1.5 text-xs font-bold bg-slate-100 border border-slate-200 rounded-xl text-slate-800 outline-none cursor-pointer"
                      >
                        {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(y => (
                          <option key={y} value={y}>Năm {y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Dải nút bấm nhanh 12 Tháng */}
                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 pt-2 border-t border-slate-100">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                      const isCur = m === statsMonth;
                      const isThisRealMonth = m === new Date().getMonth() + 1 && statsYear === new Date().getFullYear();

                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setStatsMonth(m)}
                          className={`py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex flex-col items-center justify-center relative ${
                            isCur
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                              : 'bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 border border-slate-200'
                          }`}
                        >
                          <span>Thg {m}</span>
                          {isThisRealMonth && (
                            <span className={`w-1 h-1 rounded-full ${isCur ? 'bg-amber-300' : 'bg-indigo-600'}`}></span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4 THẺ CHỈ SỐ NHANH (KPI CARDS) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 border border-amber-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-amber-800 mb-1">
                      <span className="text-xs font-black uppercase tracking-wider">Vật Tư Theo Dõi</span>
                      <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-950 font-mono">
                      {trackedMaterials.length}
                      <span className="text-xs font-normal text-amber-800 ml-1">loại ván/fomex</span>
                    </div>
                    <p className="text-[11px] text-amber-700 font-medium mt-1">
                      Đang được gắn sao theo dõi
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/60 border border-indigo-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-indigo-800 mb-1">
                      <span className="text-xs font-black uppercase tracking-wider">Tổng Đã Xuất (Tháng {statsMonth})</span>
                      <TrendingDown className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-indigo-950 font-mono">
                      {formatNumber(monthlyStatsData.totalMonthUnits)}
                      <span className="text-xs font-normal text-indigo-800 ml-1">Tấm / Cái</span>
                    </div>
                    <p className="text-[11px] text-indigo-700 font-medium mt-1">
                      Tổng khấu trừ do bán hàng
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100/60 border border-purple-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-purple-800 mb-1">
                      <span className="text-xs font-black uppercase tracking-wider">Đơn Bán Hàng Xuất Kho</span>
                      <ShoppingBag className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-purple-950 font-mono">
                      {monthlyStatsData.totalOrdersInMonth}
                      <span className="text-xs font-normal text-purple-800 ml-1">đơn hàng</span>
                    </div>
                    <p className="text-[11px] text-purple-700 font-medium mt-1">
                      Có trừ các vật tư đang theo dõi
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/60 border border-emerald-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-emerald-800 mb-1">
                      <span className="text-xs font-black uppercase tracking-wider">Xuất Nhiều Nhất</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-sm font-black text-emerald-950 truncate" title={monthlyStatsData.topItem ? monthlyStatsData.topItem.material.name : ''}>
                      {monthlyStatsData.topItem && monthlyStatsData.topItem.exportedMonthQty > 0
                        ? monthlyStatsData.topItem.material.name
                        : 'Chưa có đơn xuất'}
                    </div>
                    <p className="text-xs font-black text-emerald-700 font-mono mt-1">
                      {monthlyStatsData.topItem && monthlyStatsData.topItem.exportedMonthQty > 0
                        ? `Đã xuất ${monthlyStatsData.topItem.exportedMonthQty} ${monthlyStatsData.topItem.material.unit}`
                        : 'Trong Tháng ' + statsMonth + '/' + statsYear}
                    </p>
                  </div>
                </div>

                {/* BẢNG ĐỐI CHIẾU 12 THÁNG CẢ NĂM (MỞ RỘNG KHI BẤM XEM) */}
                {showFullYearGrid && (
                  <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden p-4 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PieChart className="w-4 h-4 text-indigo-600" />
                        <h4 className="font-extrabold text-sm text-slate-800">
                          Bảng Đối Chiếu Số Lượng Xuất 12 Tháng Năm {statsYear} (Tất Cả Vật Tư Cần Theo Dõi)
                        </h4>
                      </div>
                      <span className="text-xs text-slate-500">
                        (Cột Tháng {statsMonth} đang chọn được tô màu nổi bật)
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                            <th className="py-2.5 px-3">Mã Vật Tư</th>
                            <th className="py-2.5 px-3">Tên Vật Liệu</th>
                            <th className="py-2.5 px-2 text-center">ĐVT</th>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                              <th
                                key={m}
                                className={`py-2.5 px-2 text-center font-mono ${
                                  m === statsMonth ? 'bg-indigo-100 text-indigo-950 font-black' : ''
                                }`}
                              >
                                T{m}
                              </th>
                            ))}
                            <th className="py-2.5 px-3 text-center bg-amber-50 text-amber-950 font-black">
                              Tổng {statsYear}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {monthlyStatsData.allTrackedItems.map((it) => (
                            <tr key={it.material.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-bold text-slate-900">{it.material.code}</td>
                              <td className="py-2 px-3 font-sans font-semibold text-slate-800 truncate max-w-[200px]" title={it.material.name}>
                                {it.material.name}
                              </td>
                              <td className="py-2 px-2 text-center text-slate-500 font-sans">{it.material.unit}</td>
                              {it.months12Data.map((qty, mIdx) => (
                                <td
                                  key={mIdx}
                                  className={`py-2 px-2 text-center ${
                                    mIdx + 1 === statsMonth ? 'bg-indigo-50/80 font-bold text-indigo-900' : ''
                                  } ${qty > 0 ? 'text-indigo-700 font-bold' : 'text-slate-300'}`}
                                >
                                  {qty > 0 ? qty : '—'}
                                </td>
                              ))}
                              <td className="py-2 px-3 text-center bg-amber-50/50 font-black text-amber-900">
                                {it.yearTotal}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* BẢNG CHÍNH: CHI TIẾT SỐ LƯỢNG XUẤT TRONG THÁNG ĐANG CHỌN */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-800">
                        Bảng Số Lượng Ván / Fomex Đã Xuất Trong Tháng {statsMonth}/{statsYear}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                        {monthlyStatsData.items.length} mặt hàng
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative w-56 sm:w-64">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={statsSearchQuery}
                          onChange={(e) => setStatsSearchQuery(e.target.value)}
                          placeholder="Tìm kiếm trong danh sách theo dõi..."
                          className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs focus:border-indigo-500 outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveSubTab('inventory');
                          setStatusFilter('tracked');
                        }}
                        className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shrink-0"
                        title="Sang danh sách kho để thêm hoặc bớt vật tư cần theo dõi"
                      >
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                        <span>Quản Lý ⭐ ({trackedMaterials.length})</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                          <th className="py-3 px-3 w-12 text-center">STT</th>
                          <th className="py-3 px-3 w-36">Mã Vật Tư</th>
                          <th className="py-3 px-3">Tên Vật Liệu & Quy Cách</th>
                          <th className="py-3 px-3 w-28">Nhóm</th>
                          <th className="py-3 px-2 w-16 text-center">ĐVT</th>
                          <th className="py-3 px-3 w-32 text-center">Tồn Kho Hiện Tại</th>
                          <th className="py-3 px-3 w-44 text-center bg-indigo-50/80 text-indigo-950 font-black border-x border-indigo-200">
                            Đã Xuất Tháng {statsMonth}/{statsYear}
                          </th>
                          <th className="py-3 px-3 w-36 text-center">Số Lượt Đơn</th>
                          <th className="py-3 px-3 w-36 text-center">Chi Tiết Đơn Xuất</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {monthlyStatsData.items.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-slate-400">
                              <Boxes className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                              <p className="font-semibold text-slate-600">Không tìm thấy vật tư phù hợp với từ khóa</p>
                            </td>
                          </tr>
                        ) : (
                          monthlyStatsData.items.map((it, idx) => {
                            const mat = it.material;
                            const isExpanded = expandedMaterialId === mat.id;
                            const isLow = mat.stockQuantity > 0 && mat.stockQuantity <= mat.minStockAlert;
                            const isOut = mat.stockQuantity <= 0;

                            return (
                              <React.Fragment key={mat.id}>
                                <tr className={`hover:bg-slate-50/90 transition ${isExpanded ? 'bg-indigo-50/30' : ''}`}>
                                  <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="py-3 px-3 font-mono font-bold text-slate-900">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleTrackedMaterial(mat)}
                                        className="p-1 rounded-md hover:bg-amber-100/70 transition cursor-pointer group shrink-0"
                                        title="Bấm để bỏ khỏi danh sách cần theo dõi"
                                      >
                                        <Star className="w-4 h-4 text-amber-500 fill-amber-400 drop-shadow-xs transition-transform group-hover:scale-125" />
                                      </button>
                                      <span>{mat.code}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3">
                                    <div className="font-bold text-slate-900 text-sm">{mat.name}</div>
                                    {mat.supplier && (
                                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                        <Truck className="w-3 h-3 text-slate-400" />
                                        <span>NCC: {mat.supplier}</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3 px-3">
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                      {mat.category}
                                    </span>
                                  </td>
                                  <td className="py-3 px-2 text-center font-semibold text-slate-700">{mat.unit}</td>
                                  <td className="py-3 px-3 text-center">
                                    <span className={`font-mono font-bold ${
                                      isOut ? 'text-slate-400' : isLow ? 'text-rose-600' : 'text-emerald-700'
                                    }`}>
                                      {formatNumber(mat.stockQuantity)} {mat.unit}
                                    </span>
                                  </td>
                                  {/* CỘT TỔNG SL ĐÃ XUẤT TRONG THÁNG */}
                                  <td className="py-3 px-3 text-center bg-indigo-50/40 border-x border-indigo-100">
                                    {it.exportedMonthQty > 0 ? (
                                      <div className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-indigo-600 text-white font-mono font-black text-sm shadow-xs">
                                        <span>-{it.exportedMonthQty}</span>
                                        <span className="text-[11px] font-normal opacity-90">{mat.unit}</span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 font-mono text-xs">0 {mat.unit}</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-center font-mono">
                                    {it.orderCount > 0 ? (
                                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200">
                                        {it.orderCount} đơn hàng
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">0 đơn</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    {it.orderCount > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => setExpandedMaterialId(isExpanded ? null : mat.id)}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center gap-1 mx-auto ${
                                          isExpanded
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                            : 'bg-white hover:bg-slate-100 text-indigo-700 border-indigo-200'
                                        }`}
                                      >
                                        <span>{isExpanded ? 'Đóng chi tiết' : 'Xem các đơn'}</span>
                                        {isExpanded ? (
                                          <ChevronUp className="w-3.5 h-3.5" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    ) : (
                                      <span className="text-slate-400 text-[11px]">Chưa phát sinh</span>
                                    )}
                                  </td>
                                </tr>

                                {/* ACCORDION CHI TIẾT TỪNG ĐƠN HÀNG TRONG THÁNG CHO VẬT TƯ NÀY */}
                                {isExpanded && it.orderCount > 0 && (
                                  <tr className="bg-indigo-50/40">
                                    <td colSpan={9} className="p-4 border-b border-indigo-100">
                                      <div className="bg-white rounded-xl border border-indigo-200 p-3 shadow-xs space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="font-extrabold text-xs text-indigo-950 flex items-center gap-1.5">
                                            <ShoppingBag className="w-3.5 h-3.5 text-indigo-600" />
                                            Danh sách {it.orderCount} đơn hàng đã xuất trừ {mat.name} trong Tháng {statsMonth}/{statsYear}:
                                          </span>
                                          <span className="font-mono text-xs font-black text-indigo-700">
                                            Tổng trừ: -{it.exportedMonthQty} {mat.unit}
                                          </span>
                                        </div>

                                        <div className="overflow-x-auto">
                                          <table className="w-full text-xs text-left border-collapse">
                                            <thead>
                                              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                                <th className="py-2 px-2.5">Mã Đơn</th>
                                                <th className="py-2 px-2.5">Khách Hàng / Studio</th>
                                                <th className="py-2 px-2.5 text-center">Ngày Trừ Kho</th>
                                                <th className="py-2 px-2.5 text-center">Đợt Xuất</th>
                                                <th className="py-2 px-2.5 text-right">Số Lượng Trừ</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                              {it.orderOccurrences.map((ord, oIdx) => (
                                                <tr key={oIdx} className="hover:bg-slate-50">
                                                  <td className="py-2 px-2.5 font-mono font-bold text-slate-900">
                                                    {ord.orderNumber}
                                                  </td>
                                                  <td className="py-2 px-2.5 font-semibold text-slate-800">
                                                    {ord.customerName || 'Khách vãng lai'}
                                                  </td>
                                                  <td className="py-2 px-2.5 text-center font-mono text-slate-700">
                                                    {formatDateVN(ord.date)}
                                                  </td>
                                                  <td className="py-2 px-2.5 text-center">
                                                    {ord.isSupplement ? (
                                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                                        ✨ Bổ sung
                                                      </span>
                                                    ) : (
                                                      <span className="text-[10px] text-slate-500">Đơn gốc</span>
                                                    )}
                                                  </td>
                                                  <td className="py-2 px-2.5 text-right font-mono font-black text-indigo-700">
                                                    -{ord.quantity} {mat.unit}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )}

      {/* SUB-TAB 5: THEO DÕI MỰC IN 12 MÀU (CANON LUCIA PRO) */}
      {activeSubTab === 'ink_tracking' && (
        <InkInventoryTracking
          inkImports={inkImports}
          onSaveInkImport={onSaveInkImport || (() => {})}
          onDeleteInkImport={onDeleteInkImport || (() => {})}
          onResetInkYear={onResetInkYear || (() => {})}
        />
      )}

      {/* MODAL 1: ADD / EDIT MATERIAL (Đã bỏ giá nhập) */}
      {isAddMaterialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                <Boxes className="w-5 h-5 text-amber-600" />
                <span>{editingMaterial ? 'Chỉnh Sửa Thông Tin Vật Tư' : 'Thêm Vật Liệu Mới Vào Kho'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddMaterialModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMaterialSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã Vật Tư</label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    placeholder="VD: VT-GO-6090"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-amber-500 font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nhóm Vật Liệu</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as MaterialCategory)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-amber-500 outline-none"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên Vật Liệu / Quy Cách</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="VD: Gỗ MDF Chống Ẩm Lõi Xanh 60x90"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-amber-500 font-bold outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đơn Vị Tính</label>
                  <input
                    type="text"
                    required
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value)}
                    placeholder="Tấm, Cuộn, Cái..."
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số Lượng Tồn Ban Đầu</label>
                  <input
                    type="number"
                    min={0}
                    value={formStockQuantity}
                    onChange={e => setFormStockQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-amber-500 font-mono font-bold text-emerald-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ngưỡng Báo Hết</label>
                  <input
                    type="number"
                    min={1}
                    value={formMinStockAlert}
                    onChange={e => setFormMinStockAlert(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-amber-500 font-mono text-rose-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">Nhà Cung Cấp / Nơi Mua Hàng</label>
                  <span className="text-[11px] text-amber-700 font-medium">7 NCC Chọn Nhanh</span>
                </div>
                <input
                  type="text"
                  value={formSupplier}
                  onChange={e => setFormSupplier(e.target.value)}
                  placeholder="VD: Trang Phóng, SVP, Xuân Trường HN, Toản HN..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-amber-500 outline-none"
                />
                {/* Suppliers Quick Chips */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {inventoryPresets.suppliers.map(s => {
                    const isSelected = formSupplier.trim().toLowerCase() === s.toLowerCase();
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormSupplier(s)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-950 border-slate-200 active:scale-95'
                        }`}
                      >
                        {isSelected ? `✓ ${s}` : `+ ${s}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi Chú Thêm</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Ghi chú về chất lượng, vị trí để trong kho..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddMaterialModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-md transition cursor-pointer"
                >
                  Lưu Vật Liệu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATING & EDITING STOCK IMPORT / PURCHASE ORDER */}
      {isNewImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full p-5 sm:p-7 border border-slate-200 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                  <PackagePlus className="w-5 h-5 text-emerald-600" />
                  <span>{editingImportReceipt ? 'Chỉnh Sửa Đơn Nhập Hàng' : 'Tạo Đơn Nhập Hàng & Đồng Bộ Kho'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Quản lý đơn mua vật tư. Khi chọn <strong className="text-emerald-700">"Hàng đã nhập kho"</strong>, hệ thống sẽ tự động cộng tồn kho & cập nhật bảng giá cốt/phụ kiện!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualInwardSubmit} className="space-y-5">
              {/* Order Info & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngày Lên Đơn (Gửi NCC) <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={importOrderDate}
                    onChange={e => setImportOrderDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-bold font-mono text-emerald-800 outline-none focus:border-emerald-500"
                    title="Thời điểm thực tế chốt đơn gửi NCC (dùng in trên Phiếu gửi NCC)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngày Nhập Kho <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={importDate}
                    onChange={e => setImportDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-bold font-mono outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã Đơn Nhập / Phiếu
                  </label>
                  <input
                    type="text"
                    value={importReceiptCode}
                    onChange={e => setImportReceiptCode(e.target.value)}
                    placeholder="VD: NK-194-2026-001"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono font-bold outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Trạng Thái Đơn Hàng <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={importStatus}
                    onChange={e => setImportStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="pending">⏳ Chờ xử lý (Lên kế hoạch)</option>
                    <option value="ordered">🚚 Đã lên đơn (Chờ NCC giao)</option>
                    <option value="completed">✅ Hàng đã nhập kho (Tự động cộng kho & đồng bộ giá)</option>
                  </select>
                </div>
              </div>

              {/* Status Banner */}
              <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                importStatus === 'completed'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                  : importStatus === 'ordered'
                  ? 'bg-blue-50 border-blue-300 text-blue-900 font-medium'
                  : 'bg-amber-50 border-amber-300 text-amber-900 font-medium'
              }`}>
                <div className="flex items-center gap-2">
                  {importStatus === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  {importStatus === 'ordered' && <Truck className="w-4 h-4 text-blue-600 shrink-0" />}
                  {importStatus === 'pending' && <Clock className="w-4 h-4 text-amber-600 shrink-0" />}
                  <span>
                    {importStatus === 'completed'
                      ? 'Trạng thái "Hàng đã nhập kho": Khi bấm Lưu, tồn kho sẽ tự động cộng dồn & đơn giá mới sẽ đồng bộ vào Bảng Giá Cốt / Phụ Kiện!'
                      : importStatus === 'ordered'
                      ? 'Trạng thái "Đã lên đơn": Đơn hàng lưu lại lịch sử, chưa cộng tồn kho cho tới khi chuyển sang "Hàng đã nhập kho".'
                      : 'Trạng thái "Chờ xử lý": Lưu nháp kế hoạch nhập hàng.'}
                  </span>
                </div>
              </div>

              {/* Supplier Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Tên Nhà Cung Cấp / Nơi Mua <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-amber-700 font-medium">
                      {inventoryPresets.suppliers.length} NCC Gợi Ý
                    </span>
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={importSupplier}
                  onChange={e => setImportSupplier(e.target.value)}
                  placeholder="Chọn gợi ý bên dưới hoặc tự nhập tên NCC..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:border-amber-500 transition"
                />
                {/* Quick Pick Supplier Chips */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {inventoryPresets.suppliers.map(s => {
                    const isSelected = importSupplier.trim().toLowerCase() === s.toLowerCase();
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setImportSupplier(s)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-950 border-slate-200 active:scale-95'
                        }`}
                      >
                        {isSelected ? `✓ ${s}` : `+ ${s}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Item Table Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                      DANH SÁCH SẢN PHẨM / VẬT TƯ NHẬP ({importItemsList.length} mặt hàng)
                    </label>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                      (importSupplier || '').trim().toUpperCase() === 'SVP'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border-amber-300'
                    }`}>
                      {(importSupplier || '').trim().toUpperCase() === 'SVP'
                        ? `📦 NCC SVP: Tự động lọc chỉ hiển thị Giấy In & Mực In (${filteredSKUsForSupplier.length} SKU)`
                        : `📦 NCC ${importSupplier || 'Khác'}: Tự động lọc chỉ hiển thị Ván, Fomex, Mica, Phào, Khung, Phụ kiện (${filteredSKUsForSupplier.length} SKU)`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm Dòng Vật Tư</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 text-xs">
                        <th className="py-2.5 px-2 w-8 text-center">STT</th>
                        <th className="py-2.5 px-2 w-28">Mã SKU</th>
                        <th className="py-2.5 px-3 min-w-[280px]">Tên Mặt Hàng / Vật Tư Nhập</th>
                        <th className="py-2.5 px-2 w-32">Ghi Chú</th>
                        <th className="py-2.5 px-1.5 w-14 text-center">ĐVT</th>
                        <th className="py-2.5 px-1.5 w-16 text-center">SL</th>
                        <th className="py-2.5 px-2 w-28 text-right">Đơn Giá (đ)</th>
                        <th className="py-2.5 px-2 w-28 text-right">Thành Tiền (đ)</th>
                        <th className="py-2.5 px-1 w-8 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importItemsList.map((itemRow, idx) => (
                        <tr key={itemRow.id} className="hover:bg-slate-50/80">
                          <td className="py-2 px-2 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                          <td className="py-2 px-1.5 w-28">
                            <select
                              value={itemRow.materialId || itemRow.materialCode}
                              onChange={e => handleSelectSKUInRow(idx, e.target.value)}
                              className="w-full px-1.5 py-1 text-[11px] bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-blue-900 outline-none focus:bg-white focus:border-amber-500 cursor-pointer truncate"
                              title={itemRow.materialCode ? `SKU: ${itemRow.materialCode}` : "-- Chọn SKU --"}
                            >
                              <option value="">-- Chọn SKU --</option>
                              {filteredSKUsForSupplier.map(sku => (
                                <option key={sku.id} value={sku.id}>
                                  [{sku.code}] {sku.name}
                                </option>
                              ))}
                            </select>
                            {itemRow.materialCode && (
                              <div className="text-[10px] font-mono text-blue-700 bg-blue-50 px-1 py-0.5 rounded border border-blue-200 mt-0.5 truncate text-center font-bold" title={`Mã SKU: ${itemRow.materialCode}`}>
                                {itemRow.materialCode}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 min-w-[280px]">
                            <input
                              type="text"
                              required
                              value={itemRow.materialName}
                              onChange={e => handleUpdateRowField(idx, 'materialName', e.target.value)}
                              placeholder="Nhập tên mặt hàng / quy cách vật tư..."
                              className="w-full px-3 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-400 transition"
                            />
                          </td>
                          <td className="py-2 px-1.5 w-36">
                            <input
                              type="text"
                              value={itemRow.note || ""}
                              onChange={e => handleUpdateRowField(idx, 'note', e.target.value)}
                              placeholder="Ghi chú dòng..."
                              className="w-full px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:bg-white"
                            />
                          </td>
                          <td className="py-2 px-1 w-16">
                            <input
                              type="text"
                              required
                              value={itemRow.unit}
                              onChange={e => handleUpdateRowField(idx, 'unit', e.target.value)}
                              className="w-full px-1 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-center font-bold outline-none"
                            />
                          </td>
                          <td className="py-2 px-1 w-20">
                            <input
                              type="number"
                              min={1}
                              required
                              value={itemRow.quantity}
                              onChange={e => handleUpdateRowField(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full px-1 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-center font-mono font-bold text-emerald-700 outline-none focus:bg-white"
                            />
                          </td>
                          <td className="py-2 px-1.5 w-28">
                            <MoneyInput
                              value={itemRow.costPrice}
                              onChange={val => handleUpdateRowField(idx, 'costPrice', val)}
                              showQuickAdd={false}
                              showWords={false}
                              hideCurrencyTag={true}
                              className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-right font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-amber-500"
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 px-1 text-right font-mono font-black text-rose-700 text-xs w-28">
                            {formatCurrency(itemRow.totalCost)}
                          </td>
                          <td className="py-2 px-1 text-center w-8">
                            {importItemsList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer"
                                title="Xóa dòng này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Order Amount Summary Bar */}
              <div className="p-3.5 bg-amber-50/80 border-2 border-amber-300 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-amber-900">Tổng Số Lượng:</span>{' '}
                  <span className="font-mono font-black text-sm text-slate-900">
                    {importItemsList.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)}
                  </span>{' '}
                  <span className="text-xs text-slate-500">mặt hàng</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-amber-950">
                    TỔNG TIỀN ĐƠN NHẬP (VNĐ):
                  </span>
                  <span className="text-xl font-black font-mono text-rose-700">
                    {formatCurrency(importItemsList.reduce((sum, it) => sum + (it.totalCost || 0), 0))}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi Chú Đơn Nhập</label>
                <input
                  type="text"
                  value={importNotes}
                  onChange={e => setImportNotes(e.target.value)}
                  placeholder="Ghi chú hóa đơn VAT, thời gian giao hàng, hình thức thanh toán..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    handleExportSupplierJPG({
                      supplier: importSupplier,
                      date: importDate,
                      orderDate: importOrderDate || new Date().toISOString().slice(0, 10),
                      receiptNumber: editingImportReceipt ? editingImportReceipt.receiptNumber : `NK-${(importSupplier || "NCC").toUpperCase().slice(0, 3)}-${(importOrderDate || importDate).replace(/-/g, "")}`,
                      notes: importNotes,
                      items: importItemsList.map(it => ({
                        materialName: it.materialName || "Mặt hàng đặt",
                        quantity: Number(it.quantity) || 1,
                        unit: it.unit || "Tấm",
                        note: it.note
                      }))
                    });
                  }}
                  className="px-3.5 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border border-emerald-300 font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                  title="Tải ảnh JPG đơn đặt hàng gửi NCC (Chỉ tên hàng, SL & ghi chú; Ẩn SKU & Giá)"
                >
                  <Camera className="w-4 h-4 text-emerald-700" />
                  <span>📷 Tải Phiếu Gửi NCC (JPG)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewImportModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/20 transition cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingImportReceipt ? 'Cập Nhật Đơn Nhập' : 'Lưu Đơn Nhập Hàng & Đồng Bộ'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}{/* MODAL 3: ADJUST / USE STOCK (Xuất dùng / Kiểm kê) */}
      {isAdjustModalOpen && adjustingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-600" />
                <span>Xuất Dùng / Kiểm Kê Tồn Kho</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500">Vật liệu đang điều chỉnh:</p>
                <p className="font-extrabold text-sm text-slate-900">{adjustingMaterial.name}</p>
                <p className="text-xs text-slate-600 font-mono mt-0.5">
                  Mã: <strong>{adjustingMaterial.code}</strong> • Tồn kho hiện tại: <strong className="text-emerald-700">{adjustingMaterial.stockQuantity} {adjustingMaterial.unit}</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số Lượng Tồn Thực Tế Mới ({adjustingMaterial.unit})
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={adjustQty}
                  onChange={e => setAdjustQty(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-base font-black font-mono text-center bg-slate-50 border border-slate-300 rounded-xl text-blue-700 outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1 text-center">
                  {adjustQty > adjustingMaterial.stockQuantity ? (
                    <span className="text-emerald-600 font-bold">+ Tăng {adjustQty - adjustingMaterial.stockQuantity} {adjustingMaterial.unit}</span>
                  ) : adjustQty < adjustingMaterial.stockQuantity ? (
                    <span className="text-rose-600 font-bold">- Giảm {adjustingMaterial.stockQuantity - adjustQty} {adjustingMaterial.unit}</span>
                  ) : (
                    <span>Không thay đổi số lượng</span>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Lý Do Điều Chỉnh</label>
                <select
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none"
                >
                  <option value="Xuất dùng gia công ảnh cổng / ép gỗ">Xuất dùng gia công ảnh cổng / ép gỗ</option>
                  <option value="Kiểm kê kho thực tế định kỳ">Kiểm kê kho thực tế định kỳ</option>
                  <option value="Hao hụt / bể vỡ / lỗi vật tư">Hao hụt / bể vỡ / lỗi vật tư</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md transition cursor-pointer"
                >
                  Cập Nhật Tồn Kho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE CONFIRMATION MATERIAL */}
      {materialToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-base text-slate-900">Xóa Vật Tư Khỏi Kho?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc chắn muốn xóa vật liệu <strong className="text-slate-800">{materialToDelete.name}</strong> ({materialToDelete.code}) không?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMaterialToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteMaterial(materialToDelete.id);
                  setMaterialToDelete(null);
                }}
                className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md cursor-pointer"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: DELETE CONFIRMATION STOCK IMPORT */}
      {receiptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-base text-slate-900">Xóa Đợt Nhập Hàng Này?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc muốn xóa đợt nhập <strong className="text-slate-800">{receiptToDelete.receiptNumber}</strong> từ <strong className="text-slate-800">{receiptToDelete.supplier}</strong> (trị giá {formatCurrency(receiptToDelete.totalAmount)}) khỏi Cloud Firestore không?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReceiptToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteStockImport) onDeleteStockImport(receiptToDelete.id);
                  setReceiptToDelete(null);
                }}
                className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md cursor-pointer"
              >
                Xóa Phiếu Nhập
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5B: VIEW RECEIPT DETAIL */}
      {selectedReceiptDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">Chi Tiết Phiếu Nhập Kho</h3>
                  <p className="text-xs text-slate-500 font-mono">Mã: {selectedReceiptDetail.receiptNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceiptDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Nhà cung cấp:</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedReceiptDetail.supplier}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Ngày nhập:</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">{formatDateVN(selectedReceiptDetail.date)}</span>
                </div>
              </div>

              {selectedReceiptDetail.notes && (
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
                  <span className="font-bold">Ghi chú:</span> {selectedReceiptDetail.notes}
                </div>
              )}

              <div>
                <h4 className="font-bold text-slate-800 mb-2 uppercase tracking-wider text-[11px]">Danh Sách Mặt Hàng (Bản Quản Lý Nội Bộ)</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="py-2 px-2 text-center w-8">STT</th>
                        <th className="py-2 px-2 w-24">Mã SKU</th>
                        <th className="py-2 px-3">Tên Hàng / Quy Cách</th>
                        <th className="py-2 px-2 text-center w-20">SL</th>
                        <th className="py-2 px-3 text-right w-24">Đơn Giá</th>
                        <th className="py-2 px-3 text-right w-28">Thành Tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedReceiptDetail.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-2">
                            <span className="font-mono text-[10px] font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 block text-center truncate" title={`Mã SKU: ${it.materialCode || it.materialId}`}>
                              {it.materialCode || it.materialId || "SKU"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{it.materialName}</div>
                            {it.note && <div className="text-[11px] text-amber-700 italic">Ghi chú: {it.note}</div>}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-800">
                            {it.quantity} <span className="text-[10px] font-normal text-slate-500">{it.unit}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {formatCurrency(it.costPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(it.totalCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950">
                <span className="font-black text-xs uppercase">Tổng Giá Trị Đợt Nhập:</span>
                <span className="font-black text-base font-mono text-emerald-700">{formatCurrency(selectedReceiptDetail.totalAmount)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  handleExportSupplierJPG({
                    supplier: selectedReceiptDetail.supplier,
                    date: selectedReceiptDetail.date,
                    orderDate: selectedReceiptDetail.orderDate || (selectedReceiptDetail.status === "ordered" || selectedReceiptDetail.status === "completed" ? selectedReceiptDetail.date : new Date().toISOString().slice(0, 10)),
                    receiptNumber: selectedReceiptDetail.receiptNumber,
                    notes: selectedReceiptDetail.notes,
                    items: selectedReceiptDetail.items.map(it => ({
                      materialName: it.materialName,
                      quantity: it.quantity,
                      unit: it.unit,
                      note: it.note
                    }))
                  });
                }}
                className="px-3.5 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border border-emerald-300 font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                title="Tải ảnh JPG gửi Nhà Cung Cấp (Chỉ tên hàng, SL & ghi chú; Ẩn SKU & Giá)"
              >
                <Camera className="w-4 h-4 text-emerald-700" />
                <span>📷 Tải Phiếu Gửi NCC (JPG)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const receipt = selectedReceiptDetail;
                  setSelectedReceiptDetail(null);
                  handleOpenEditImport(receipt);
                }}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Chỉnh Sửa Phiếu</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedReceiptDetail(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5C: CLEAR ALL STOCK IMPORTS CONFIRMATION */}
      {isClearStockImportsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-base text-slate-900">Xóa Hết Lịch Sử Phiếu Nhập?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc chắn muốn xóa toàn bộ ({stockImports.length}) hóa đơn nhập kho trực tiếp trên Cloud Firestore không? Thao tác này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClearStockImportsModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClearAllStockImports) onClearAllStockImports();
                  setIsClearStockImportsModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md cursor-pointer"
              >
                Xác Nhận Xóa Hết
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: CLEAR INVENTORY / RESET OPTIONS */}
      {isClearInventoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-black text-base text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <span>Quản Lý & Đặt Lại Dữ Liệu Kho</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsClearInventoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Hãy chọn thao tác bạn muốn thực hiện. Các thao tác này sẽ cập nhật trực tiếp lên Cloud Firestore:
            </p>

            <div className="space-y-2.5">
              {onResetStockToZero && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Bạn có chắc muốn đưa tất cả số lượng tồn kho về 0?')) {
                      onResetStockToZero();
                      setIsClearInventoryModalOpen(false);
                    }
                  }}
                  className="w-full text-left p-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 transition cursor-pointer"
                >
                  <p className="font-bold text-xs text-amber-900">1. Đưa số lượng tồn kho của tất cả vật liệu về 0</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">Giữ nguyên danh sách các loại vật liệu, chỉ xóa số lượng tồn.</p>
                </button>
              )}

              {onReloadDefaultMaterials && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Nạp lại danh mục vật liệu mặc định chuẩn của Tiệm In 194?')) {
                      onReloadDefaultMaterials();
                      setIsClearInventoryModalOpen(false);
                    }
                  }}
                  className="w-full text-left p-3 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 transition cursor-pointer"
                >
                  <p className="font-bold text-xs text-blue-900">2. Nạp lại danh mục vật liệu mặc định Tiệm In 194</p>
                  <p className="text-[11px] text-blue-700 mt-0.5">Tải lại danh sách chuẩn: Gỗ MDF, Fomex, Mica, Mực in...</p>
                </button>
              )}

              {onClearAllInventory && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('CẢNH BÁO: Xóa sạch toàn bộ danh mục vật liệu và lịch sử nhập kho?')) {
                      onClearAllInventory();
                      setIsClearInventoryModalOpen(false);
                    }
                  }}
                  className="w-full text-left p-3 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 transition cursor-pointer"
                >
                  <p className="font-bold text-xs text-rose-900">3. Xóa sạch hoàn toàn dữ liệu kho (Trắng dữ liệu)</p>
                  <p className="text-[11px] text-rose-700 mt-0.5">Xóa trắng toàn bộ vật tư để bạn tự tạo từ đầu.</p>
                </button>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsClearInventoryModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: BOM GUIDE (Công thức cấu thành) */}
      {isBOMGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-5 sm:p-6 border border-slate-200 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500 rounded-xl text-slate-950">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    Quy Chuẩn Xuất Ván & Cốt Vật Tư Tiệm In 194
                  </h3>
                  <p className="text-xs text-slate-500">Quy tắc tự động bóc tách ván gỗ MDF và ván Fomex siêu nhẹ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBOMGuideOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1 text-xs">
              <div className="p-4 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-50 border border-amber-300 rounded-xl space-y-2">
                <h4 className="font-bold text-amber-950 uppercase tracking-wider text-xs">
                  2 Dòng Cốt Vật Tư Chính Khi Bán Hàng:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 bg-white rounded-xl border-2 border-blue-400/80 shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-blue-950 text-xs flex items-center gap-1">
                        <span>🛡️</span> VÁN FOMEX 9LI
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-900">
                        Ảnh 4K & HD Pro
                      </span>
                    </div>
                    <p className="text-slate-800 font-semibold text-[11px]">
                      Dành riêng cho <strong>Ảnh 4K</strong> và <strong>Ảnh "HD Pro"</strong>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Tấm Fomex trắng 9li siêu nhẹ, phẳng tuyệt đối, chống ẩm mốc, tăng độ thẩm mỹ và sắc nét vượt trội.
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border-2 border-amber-400/80 shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-amber-950 text-xs flex items-center gap-1">
                        <span>🪵</span> VÁN GỖ MDF
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                        Tất Cả Ảnh Khác
                      </span>
                    </div>
                    <p className="text-slate-800 font-semibold text-[11px]">
                      Dành cho <strong>Ảnh HD Gương Siêu Bóng, Ép Gỗ, Lụa Viền, Mika Bo Viền, Ảnh Cổng Cưới...</strong>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Gỗ MDF lõi xanh chống ẩm 12li hoặc 9li đầm chắc, phẳng mịn, bền vững theo năm tháng.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bảng đối chiếu kích thước cụ thể */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center justify-between">
                  <span>Bảng Bóc Tách Tự Động Theo Kích Thước</span>
                  <span className="text-[10px] text-slate-500 font-normal lowercase">(tự động nhận diện khi gõ mã/tên hàng)</span>
                </h4>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  <div className="p-3 bg-slate-50/80 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-4 font-bold text-slate-900">
                      Khổ Ảnh 60x90 (Cổng cưới lớn)
                    </div>
                    <div className="sm:col-span-8 flex flex-col gap-1 font-mono text-[11px]">
                      <div className="flex items-center justify-between bg-blue-50/60 p-1.5 rounded-lg border border-blue-200">
                        <span className="text-blue-900 font-bold font-sans">Ảnh 4K hoặc HD Pro 60x90:</span>
                        <span className="font-bold text-blue-700">Trừ 1 Tấm Fomex 9li 60x90 [VT-FX-6090]</span>
                      </div>
                      <div className="flex items-center justify-between bg-amber-50/60 p-1.5 rounded-lg border border-amber-200">
                        <span className="text-amber-950 font-bold font-sans">Ảnh HD Gương / Ép Gỗ / Lụa:</span>
                        <span className="font-bold text-amber-800">Trừ 1 Tấm Gỗ MDF 60x90 [VT-GO-6090]</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-4 font-bold text-slate-900">
                      Khổ Ảnh 50x75 (Cổng cưới vừa)
                    </div>
                    <div className="sm:col-span-8 flex flex-col gap-1 font-mono text-[11px]">
                      <div className="flex items-center justify-between bg-blue-50/60 p-1.5 rounded-lg border border-blue-200">
                        <span className="text-blue-900 font-bold font-sans">Ảnh 4K hoặc HD Pro 50x75:</span>
                        <span className="font-bold text-blue-700">Trừ 1 Tấm Fomex 9li 50x75 [VT-FX-5075]</span>
                      </div>
                      <div className="flex items-center justify-between bg-amber-50/60 p-1.5 rounded-lg border border-amber-200">
                        <span className="text-amber-950 font-bold font-sans">Ảnh HD Gương / Ép Gỗ / Lụa:</span>
                        <span className="font-bold text-amber-800">Trừ 1 Tấm Gỗ MDF 50x75 [VT-GO-5075]</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50/80 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-4 font-bold text-slate-900">
                      Khổ Ảnh 40x60 & 30x45 (Treo tường)
                    </div>
                    <div className="sm:col-span-8 flex flex-col gap-1 font-mono text-[11px]">
                      <div className="flex items-center justify-between bg-blue-50/60 p-1.5 rounded-lg border border-blue-200">
                        <span className="text-blue-900 font-bold font-sans">Ảnh 4K hoặc HD Pro:</span>
                        <span className="font-bold text-blue-700">Trừ 1 Tấm Fomex 9li 40x60 / 30x45</span>
                      </div>
                      <div className="flex items-center justify-between bg-amber-50/60 p-1.5 rounded-lg border border-amber-200">
                        <span className="text-amber-950 font-bold font-sans">Ảnh HD Gương / Ép Gỗ / Lụa:</span>
                        <span className="font-bold text-amber-800">Trừ 1 Tấm Gỗ MDF 40x60 / 30x45</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-4 font-bold text-slate-900">
                      Khổ Để Bàn (20x30, 15x21, 13x18)
                    </div>
                    <div className="sm:col-span-8 flex flex-col gap-1 font-mono text-[11px]">
                      <div className="flex items-center justify-between bg-blue-50/60 p-1.5 rounded-lg border border-blue-200">
                        <span className="text-blue-900 font-bold font-sans">Ảnh 4K hoặc HD Pro:</span>
                        <span className="font-bold text-blue-700">Trừ 1 Tấm Fomex 9li Để Bàn</span>
                      </div>
                      <div className="flex items-center justify-between bg-amber-50/60 p-1.5 rounded-lg border border-amber-200">
                        <span className="text-amber-950 font-bold font-sans">Ảnh HD Gương / Ép Gỗ / Lụa:</span>
                        <span className="font-bold text-amber-800">Trừ 1 Tấm Gỗ MDF Để Bàn</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950">
                <p className="font-bold text-xs flex items-center gap-1 mb-1 text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Đồng bộ tức thì với Phiếu Xuất Ván & Kho Vật Tư:
                </p>
                <p className="text-[11px] leading-relaxed">
                  Tại màn hình <strong>Bán Hàng</strong>, cửa sổ <strong>Phiếu xuất ván MDF & Fomex</strong> sẽ tự động nhận diện ảnh 4K/HD Pro (dùng Fomex 9li) hay ảnh HD Gương/Lụa viền/Mika (dùng Gỗ MDF) để bóc tách ván tương ứng. Khi bấm <strong>Lưu Đơn Hàng</strong>, kho sẽ tự động trừ ngay mà không cần tính toán thủ công!
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsBOMGuideOpen(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer transition"
              >
                Đã Hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: QUẢN LÝ GỢI Ý CHỌN NHANH (Thêm / Sửa Thủ Công NCC & Mặt Hàng) */}
      {isManageSuggestionsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-5 sm:p-6 border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-900">
                    Quản Lý Danh Sách Gợi Ý Chọn Nhanh
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tùy chỉnh thêm, sửa tên hoặc xóa các nút gợi ý trong phiếu nhập kho
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsManageSuggestionsOpen(false);
                  setEditingSupplierIdx(null);
                  setEditingItemIdx(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TAB SELECTOR: SUPPLIERS VS ITEMS */}
            <div className="flex items-center border-b border-slate-200 mb-4 shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setManageTab('suppliers')}
                className={`flex items-center gap-2 pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer ${
                  manageTab === 'suppliers'
                    ? 'border-amber-600 text-amber-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Building2 className="w-4 h-4 text-amber-600" />
                <span>Nhà Cung Cấp ({inventoryPresets.suppliers.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setManageTab('items')}
                className={`flex items-center gap-2 pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer ${
                  manageTab === 'items'
                    ? 'border-emerald-600 text-emerald-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Package className="w-4 h-4 text-emerald-600" />
                <span>Mặt Hàng / Chủng Loại ({inventoryPresets.items.length})</span>
              </button>
            </div>

            {/* TAB CONTENT: SUPPLIERS */}
            {manageTab === 'suppliers' && (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
                {/* Form thêm mới NCC */}
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                  <label className="block text-xs font-bold text-amber-950">
                    Thêm Nhà Cung Cấp Mới Vào Danh Sách Gợi Ý:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newSupplierInput}
                      onChange={e => setNewSupplierInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSupplierPreset();
                        }
                      }}
                      placeholder="VD: Cty TNHH Phú Mỹ, Nhôm Kính Toàn Thắng..."
                      className="flex-1 px-3 py-2 text-xs bg-white border border-amber-300 rounded-xl font-bold outline-none focus:ring-2 focus:ring-amber-200"
                    />
                    <button
                      type="button"
                      onClick={handleAddSupplierPreset}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1 shrink-0 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm</span>
                    </button>
                  </div>
                </div>

                {/* Danh sách hiện tại */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-500 text-[11px] px-1">
                    <span>Danh sách {inventoryPresets.suppliers.length} nhà cung cấp hiện tại:</span>
                    <span>Bấm bút chì để sửa tên</span>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white max-h-64 overflow-y-auto">
                    {inventoryPresets.suppliers.map((s, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 transition">
                        {editingSupplierIdx === idx ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              value={editingSupplierText}
                              onChange={e => setEditingSupplierText(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveEditSupplier(idx);
                              }}
                              className="flex-1 px-2.5 py-1 text-xs border border-amber-500 rounded-lg font-bold outline-none bg-white"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditSupplier(idx)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer"
                              title="Lưu tên mới"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSupplierIdx(null)}
                              className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg cursor-pointer"
                              title="Hủy"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 font-bold text-slate-800">
                              <span className="w-5 text-center text-slate-400 font-mono text-[11px]">{idx + 1}.</span>
                              <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{s}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSupplierIdx(idx);
                                  setEditingSupplierText(s);
                                }}
                                className="p-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-md transition cursor-pointer"
                                title="Sửa tên NCC"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSupplierPreset(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                                title="Xóa khỏi gợi ý"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleResetSuppliersToDefault}
                    className="text-[11px] text-slate-500 hover:text-amber-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Khôi phục 7 NCC ban đầu</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: ITEMS */}
            {manageTab === 'items' && (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
                {/* Form thêm mới mặt hàng */}
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                  <label className="block text-xs font-bold text-emerald-950">
                    Thêm Mặt Hàng / Chủng Loại Mới Vào Danh Sách Gợi Ý:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newItemInput}
                      onChange={e => setNewItemInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddItemPreset();
                        }
                      }}
                      placeholder="VD: Khung tranh canvas, Đèn LED, Màng nhiệt bóng..."
                      className="flex-1 px-3 py-2 text-xs bg-white border border-emerald-300 rounded-xl font-bold outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                    <button
                      type="button"
                      onClick={handleAddItemPreset}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1 shrink-0 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm</span>
                    </button>
                  </div>
                </div>

                {/* Danh sách hiện tại */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-500 text-[11px] px-1">
                    <span>Danh sách {inventoryPresets.items.length} mặt hàng gợi ý hiện tại:</span>
                    <span>Bấm bút chì để sửa tên</span>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white max-h-64 overflow-y-auto">
                    {inventoryPresets.items.map((it, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 transition">
                        {editingItemIdx === idx ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              value={editingItemText}
                              onChange={e => setEditingItemText(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveEditItem(idx);
                              }}
                              className="flex-1 px-2.5 py-1 text-xs border border-emerald-500 rounded-lg font-bold outline-none bg-white"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditItem(idx)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer"
                              title="Lưu tên mới"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItemIdx(null)}
                              className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg cursor-pointer"
                              title="Hủy"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 font-bold text-slate-800">
                              <span className="w-5 text-center text-slate-400 font-mono text-[11px]">{idx + 1}.</span>
                              <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{it}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItemIdx(idx);
                                  setEditingItemText(it);
                                }}
                                className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition cursor-pointer"
                                title="Sửa tên mặt hàng"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItemPreset(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                                title="Xóa khỏi gợi ý"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleResetItemsToDefault}
                    className="text-[11px] text-slate-500 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Khôi phục 15 Mặt Hàng ban đầu</span>
                  </button>
                </div>
              </div>
            )}

            {/* FEEDBACK STATUS & CLOSE BUTTON */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 mt-4 shrink-0">
              <div className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                {presetFeedback && (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{presetFeedback}</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsManageSuggestionsOpen(false);
                  setEditingSupplierIdx(null);
                  setEditingItemIdx(null);
                }}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Hoàn Tất & Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
