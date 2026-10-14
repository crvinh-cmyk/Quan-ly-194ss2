import { INK_12_COLORS } from '../data/initialData';
import React, { useState, useMemo, useEffect } from 'react';
import { Material, MaterialCategory, StockImportReceipt, StockImportItem, Order, OrderItem, MaterialDeduction, Product, InkImportRecord } from '../types';
import { formatCurrency, formatNumber, formatDateVN } from '../utils/formatters';
import { getMaterialUsageSummary, calculateOrderBOM, createMaterialDeductionRecords } from '../utils/materialBOM';
import {
  Boxes, Plus, Search, AlertTriangle, CheckCircle2, Clock, TrendingDown,
  ArrowDownLeft, FileText, Calendar, DollarSign, PackagePlus,
  Edit, Trash2, SlidersHorizontal, RefreshCw, X, ArrowUpDown, Truck, ChevronRight,
  BookOpen, Sparkles, ShoppingBag, ArrowRight, Building2, Filter, Layers, PieChart,
  Settings, Check, RotateCcw, Package, Droplet
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
  
  // Filters for Material Inventory
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'instock' | 'out'>('all');

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

    // 2. Board Core Prices
    try {
      const boardPrices = getLocalBoardCorePrices();
      Object.entries(boardPrices || {}).forEach(([key, row]) => {
        const code = row.code || row.size;
        if (!skus.some(s => s.code.toUpperCase() === code.toUpperCase())) {
          skus.push({
            id: `board-${key}`,
            code: code,
            name: row.name || `Cốt ván MDF ${row.size}`,
            unit: 'Tấm',
            price: row.mdf9li || 0,
            category: 'Bảng giá Cốt Ván',
            source: 'board'
          });
        }
      });
    } catch (e) {}

    // 3. Accessory Prices
    try {
      const accItems = getLocalAccessoryMaterials();
      (accItems || []).forEach(acc => {
        if (!skus.some(s => s.id === acc.id || s.name.toLowerCase() === acc.name.toLowerCase())) {
          skus.push({
            id: acc.id,
            code: acc.id.toUpperCase(),
            name: acc.name,
            unit: 'Cái',
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
            name: `Bình Mực Canon Lucia Pro ${c.code} (${c.vietnameseName})`,
            unit: 'Bình',
            price: 880000,
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
      .filter(imp => new Date(imp.date).getFullYear() === currentYear && imp.status !== "pending" && imp.status !== "ordered")
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
      if (imp.status === "pending" || imp.status === "ordered") return false;
      const impYear = new Date(imp.date).getFullYear();
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
    const yearImports = (selectedYear === 'all'
      ? stockImports
      : stockImports.filter(imp => new Date(imp.date).getFullYear() === selectedYear)).filter(imp => imp.status !== "pending" && imp.status !== "ordered");

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
  }, [materials, searchQuery, selectedCategory, statusFilter]);

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
    setImportSupplier(receipt.supplier);
    setImportStatus(receipt.status || 'pending');
    setImportNotes(receipt.notes || '');
    setImportReceiptCode(receipt.receiptNumber);

    if (receipt.items && receipt.items.length > 0) {
      setImportItemsList(receipt.items.map(it => ({
        id: it.id || `ii-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        materialId: it.materialId || '',
        materialCode: it.materialCode || '',
        materialName: it.materialName || '',
        unit: it.unit || 'Tấm',
        quantity: it.quantity || 1,
        costPrice: it.costPrice || 0,
        totalCost: it.totalCost || ((it.quantity || 1) * (it.costPrice || 0))
      })));
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

  // Helper actions for item list in import modal
  const handleSelectSKUInRow = (idx: number, skuCodeOrId: string) => {
    const sku = filteredSKUsForSupplier.find(s => s.id === skuCodeOrId || s.code.toUpperCase() === skuCodeOrId.toUpperCase()) || availableSKUsList.find(s => s.id === skuCodeOrId || s.code.toUpperCase() === skuCodeOrId.toUpperCase());
    if (!sku) return;

    setImportItemsList(prev => {
      const updated = [...prev];
      const q = updated[idx].quantity || 1;
      const cp = sku.price || updated[idx].costPrice || 0;
      updated[idx] = {
        ...updated[idx],
        materialId: sku.id,
        materialCode: sku.code,
        materialName: sku.name,
        unit: sku.unit || 'Tấm',
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
        totalCost: 0
      }
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (importItemsList.length <= 1) return;
    setImportItemsList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateRowField = (idx: number, field: 'quantity' | 'costPrice' | 'materialName' | 'materialCode' | 'unit', val: any) => {
    setImportItemsList(prev => {
      const updated = [...prev];
      const cur = { ...updated[idx], [field]: val };
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
      status: newStatus
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
          totalCost: tc
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
          onClick={() => setActiveSubTab('sales_deductions')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition cursor-pointer shrink-0 ${
            activeSubTab === 'sales_deductions'
              ? 'border-amber-500 text-amber-700 bg-amber-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Vật Tư Trừ Theo Đơn Bán Hàng</span>
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
                    <th className="py-3 px-3 w-28">Mã Vật Tư</th>
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
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">{mat.code}</td>
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
                          <div className="space-y-1">
                            {imp.items.map((it, iIdx) => (
                              <div key={iIdx} className="text-slate-800 font-medium">
                                • <strong>{it.materialName}</strong>
                                {it.quantity > 1 && (
                                  <span className="text-slate-500 font-mono ml-1">({it.quantity} {it.unit})</span>
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
                              className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border outline-none cursor-pointer transition shadow-2xs ${imp.status === 'completed' ? 'bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200' : imp.status === 'ordered' ? 'bg-blue-100 text-blue-950 border-blue-300 hover:bg-blue-200' : 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200'}`}
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
                            {(imp.date || '') > '2026-10-03' && imp.status !== 'completed' && (
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
        <BoardCorePriceTable currentUserEmail={undefined} />
      )}

      {/* SUB-TAB 4: SALES ORDERS MATERIAL DEDUCTIONS */}
      {activeSubTab === 'sales_deductions' && (
        <div className="space-y-4">
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-5 sm:p-6 border border-slate-200 my-8">
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngày Nhập Hàng <span className="text-rose-500">*</span>
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
                      <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                        <th className="py-2.5 px-2 w-10 text-center">STT</th>
                        <th className="py-2.5 px-2">Gợi Ý SKU / Mã Vật Tư Kho</th>
                        <th className="py-2.5 px-2">Tên Vật Tư Nhập</th>
                        <th className="py-2.5 px-2 w-20">ĐVT</th>
                        <th className="py-2.5 px-2 w-24 text-center">SL Nhập</th>
                        <th className="py-2.5 px-2 w-32 text-right">Đơn Giá Mới (đ)</th>
                        <th className="py-2.5 px-2 w-32 text-right">Thành Tiền (đ)</th>
                        <th className="py-2.5 px-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importItemsList.map((itemRow, idx) => (
                        <tr key={itemRow.id} className="hover:bg-slate-50/80">
                          <td className="py-2 px-2 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                          <td className="py-2 px-2 min-w-[160px]">
                            <select
                              value={itemRow.materialId || itemRow.materialCode}
                              onChange={e => handleSelectSKUInRow(idx, e.target.value)}
                              className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono outline-none focus:bg-white focus:border-amber-500 cursor-pointer"
                            >
                              <option value="">-- Chọn SKU có sẵn --</option>
                              {filteredSKUsForSupplier.map(sku => (
                                <option key={sku.id} value={sku.id}>
                                  [{sku.code}] {sku.name} ({sku.category})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              required
                              value={itemRow.materialName}
                              onChange={e => handleUpdateRowField(idx, 'materialName', e.target.value)}
                              placeholder="Tên vật tư..."
                              className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 outline-none focus:bg-white focus:border-amber-500"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              required
                              value={itemRow.unit}
                              onChange={e => handleUpdateRowField(idx, 'unit', e.target.value)}
                              className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-center font-bold outline-none"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min={1}
                              required
                              value={itemRow.quantity}
                              onChange={e => handleUpdateRowField(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-center font-mono font-bold text-emerald-700 outline-none focus:bg-white"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <MoneyInput
                              value={itemRow.costPrice}
                              onChange={val => handleUpdateRowField(idx, 'costPrice', val)}
                              className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-right font-mono font-bold text-slate-900 outline-none focus:bg-white"
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-black text-rose-700 text-xs">
                            {formatCurrency(itemRow.totalCost)}
                          </td>
                          <td className="py-2 px-2 text-center">
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
                <h4 className="font-bold text-slate-800 mb-2 uppercase tracking-wider text-[11px]">Danh Sách Mặt Hàng</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="py-2 px-3">Tên Hàng</th>
                        <th className="py-2 px-3 text-center">SL</th>
                        <th className="py-2 px-3 text-right">Đơn Giá</th>
                        <th className="py-2 px-3 text-right">Thành Tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedReceiptDetail.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{it.materialName}</td>
                          <td className="py-2.5 px-3 text-center font-mono">{it.quantity} {it.unit}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatCurrency(it.costPrice)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(it.totalCost)}</td>
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
