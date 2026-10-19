import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product, Customer, Order, OrderItem, Material, ProductCategory, StudioCombo } from '../types';
import { formatCurrency, formatNumber, getTodayDateString, formatDateVN, numberToVietnameseWords, isWalkInPoolCustomer } from '../utils/formatters';
import { calculateOrderBOM, calculateItemBOM, createMaterialDeductionRecords, extractEffectiveSize, normalizeSize, resolveProductCoreMaterial } from '../utils/materialBOM';
import {
  Plus, Trash2, Search, Check, Save, Printer, RefreshCw, UserPlus,
  ArrowRight, Sparkles, AlertCircle, Calendar, Hash, FileText, ChevronDown, CheckCircle2, Boxes, Layers,
  Star, Zap, SlidersHorizontal, Tag, Bookmark, Settings, RotateCcw, CheckSquare, Square, X, ShoppingBag, Building2,
  ExternalLink, Copy, Edit3, User, Camera
} from 'lucide-react';
import { MoneyInput } from './MoneyInput';
import { StudioComboModal } from './StudioComboModal';
import {
  POPULAR_PRODUCT_PRESETS,
  PopularPresetDef,
  resolvePopularProduct,
  resolveProductByCodeOrBase,
  getStoredCustomPinnedCodes,
  saveStoredCustomPinnedCodes,
  getStoredSelectedPopularCodes,
  saveStoredSelectedPopularCodes,
  resetStoredSelectedPopularCodes,
  DEFAULT_POPULAR_BASE_CODES,
  convertProductCodeForTier,
  getProductCoreType
} from '../utils/productHelpers';

interface SalesInvoiceFormProps {
  products: Product[];
  customers: Customer[];
  allOrders: Order[];
  materials?: Material[];
  combos?: StudioCombo[];
  onSaveCombo?: (combo: StudioCombo) => void;
  onDeleteCombo?: (comboId: string) => void;
  onSaveOrder: (order: Order, openPrint: boolean) => void;
  onAddNewCustomer: (customer: Customer) => void;
  onAddNewProduct: (product: Product) => void;
  newOrderTrigger?: number;
  editingOrder?: Order | null;
  onCancelEdit?: () => void;
}

export const SalesInvoiceForm: React.FC<SalesInvoiceFormProps> = ({
  products,
  customers,
  allOrders,
  materials = [],
  combos = [],
  onSaveCombo = () => {},
  onDeleteCombo = () => {},
  onSaveOrder,
  onAddNewCustomer,
  onAddNewProduct,
  newOrderTrigger,
  editingOrder,
  onCancelEdit
}) => {
  // Editing state for supplementing/updating an existing invoice
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingOrderNumber, setEditingOrderNumber] = useState<string>('');
  const [editingOrderCreatedAt, setEditingOrderCreatedAt] = useState<string>('');
  const isEditMode = !!editingInvoiceId;

  // Order general info
  const [orderDate, setOrderDate] = useState<string>(getTodayDateString());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [guestName, setGuestName] = useState<string>(''); // Tên riêng của khách lẻ / freelance vãng lai (VD: 'Anh Tuấn', 'Chị Mai'...)
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [orderStatus, setOrderStatus] = useState<Order['status']>('completed');
  const [autoDeductStock, setAutoDeductStock] = useState<boolean>(true);

  // MDF Dispatch Slip state
  const [manualMdfOverrides, setManualMdfOverrides] = useState<Record<string, { materialId: string; quantity?: number }>>({});
  const [manualExtraMdfItems, setManualExtraMdfItems] = useState<{
    id: string;
    materialId: string;
    quantity: number;
    note?: string;
  }[]>([]);
  const [excludedSourceRowIds, setExcludedSourceRowIds] = useState<string[]>([]);
  const [autoDeductMdf, setAutoDeductMdf] = useState<boolean>(true);

  // Customer suggestions dropdown
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Quick Customer Creation state
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustPhone, setNewCustPhone] = useState<string>('');
  const [newCustAddress, setNewCustAddress] = useState<string>('');
  const [newCustType, setNewCustType] = useState<ProductCategory>('GIÁ STUDIO');
  const [newCustInitialDebt, setNewCustInitialDebt] = useState<number>(0);

  // Table rows (Order items)
  const [items, setItems] = useState<OrderItem[]>([
    {
      id: 'row-1',
      date: getTodayDateString(),
      productCode: '',
      productName: '',
      size: '',
      price: 0,
      quantity: 1,
      amount: 0,
      note: ''
    }
  ]);

  // Calculations state
  const [discount, setDiscount] = useState<number>(0);
  const [previousDebt, setPreviousDebt] = useState<number>(0);
  const [paid, setPaid] = useState<number>(0);

  // Active autocomplete suggestion row index
  const [activeCodeRowIdx, setActiveCodeRowIdx] = useState<number | null>(null);
  const [codeQuery, setCodeQuery] = useState<string>('');

  // Browse catalog modal state
  // Modal Chọn Nhanh Từ Bảng Giá Tiệm
  const [showCatalogModal, setShowCatalogModal] = useState<boolean>(false);
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [catalogCategory, setCatalogCategory] = useState<string>('all');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState<boolean>(false);
  const [popularTier, setPopularTier] = useState<ProductCategory>('GIÁ STUDIO');
  const [favoriteCodes, setFavoriteCodes] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('xuongin194_user_favorite_codes_v1');
      if (!raw) return [
        'HDST60*90', 'MKST60*90', 'LVST60*90', 'LKST60*90K456',
        'HDST50*75', 'MKST50*75', 'HDST20*30', 'MKST20*30',
        'inepST20*30', 'inST20*30', 'inST60*90',
        'NEPST1', 'NEPST2', 'NEPST3',
        'ABMP20x20', 'ABMP20x30', 'ABMP30x30'
      ];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [
        'HDST60*90', 'MKST60*90', 'LVST60*90', 'LKST60*90K456',
        'HDST50*75', 'MKST50*75', 'HDST20*30', 'MKST20*30',
        'inepST20*30', 'inST20*30', 'inST60*90',
        'NEPST1', 'NEPST2', 'NEPST3',
        'ABMP20x20', 'ABMP20x30', 'ABMP30x30'
      ];
    } catch (e) {
      return [
        'HDST60*90', 'MKST60*90', 'LVST60*90', 'LKST60*90K456',
        'HDST50*75', 'MKST50*75', 'HDST20*30', 'MKST20*30',
        'inepST20*30', 'inST20*30', 'inST60*90',
        'NEPST1', 'NEPST2', 'NEPST3',
        'ABMP20x20', 'ABMP20x30', 'ABMP30x30'
      ];
    }
  });
  const [quickInsertToast, setQuickInsertToast] = useState<string>('');

  // Studio Combo modal & quick state
  const [showComboModal, setShowComboModal] = useState<boolean>(false);
  const [initialRowsForCombo, setInitialRowsForCombo] = useState<{
    productCode: string;
    productName: string;
    size: string;
    quantity: number;
    note?: string;
  }[] | undefined>(undefined);

  // Success alert state
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [lastSavedOrder, setLastSavedOrder] = useState<Order | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When customer changes, automatically update customer info & previous debt!
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setCustomerAddress(customer.address || '');
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
    if (customer.customerType) {
      setCatalogCategory(customer.customerType);
      setPopularTier(customer.customerType);
    }

    // Nếu chọn khách hàng cố định (như Phước Công, Studio...), xóa guestName cũ
    if (!isWalkInPoolCustomer(customer)) {
      setGuestName('');
    }

    // Compute previous debt of this customer from previous orders
    const pastOrders = allOrders
      .filter(o => o.customerId === customer.id && o.status !== 'cancelled')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.createdAt.localeCompare(a.createdAt));

    if (pastOrders.length > 0) {
      setPreviousDebt(pastOrders[0].totalDue);
    } else {
      setPreviousDebt(customer.initialDebt || 0);
    }
  };

  // Nhận diện CHÍNH XÁC tệp khách vãng lai:
  // CHỈ kích hoạt cho tệp vãng lai gom chung (ID cust-freelance / c4 hoặc tên đúng là Freelance/Frelance).
  // TUYỆT ĐỐI KHÔNG áp dụng cho khách freelance cố định (như "Phước Công", "Thợ ảnh Nam"... có tên và hồ sơ riêng).
  const isFreelance = useMemo(() => {
    if (selectedCustomerId) {
      const cust = customers.find(c => c.id === selectedCustomerId);
      if (cust) {
        if (!isWalkInPoolCustomer(cust)) return false;
        return cust.customerType === 'Freelance' || cust.id === 'cust-freelance' || cust.id === 'c4';
      }
    }
    const norm = (customerName || customerSearch || '').trim().toLowerCase();
    return norm === 'freelance' || norm === 'frelance';
  }, [customerName, customerSearch, selectedCustomerId, customers]);

  // Tương tự, CHỈ kích hoạt cho tệp Khách Lẻ vãng lai gom chung (ID cust-khach-le / c5 hoặc tên đúng là Khách Lẻ).
  const isKhachLe = useMemo(() => {
    if (selectedCustomerId) {
      const cust = customers.find(c => c.id === selectedCustomerId);
      if (cust) {
        if (!isWalkInPoolCustomer(cust)) return false;
        return cust.customerType === 'Khách Lẻ' || cust.id === 'cust-khach-le' || cust.id === 'c5';
      }
    }
    const norm = (customerName || customerSearch || '').trim().toLowerCase();
    return norm === 'khách lẻ' || norm === 'khach le';
  }, [customerName, customerSearch, selectedCustomerId, customers]);

  const isSpecialWalkIn = isKhachLe || isFreelance;

  // Chọn nhanh tệp Khách Lẻ hoặc Freelance chỉ với 1 click (Tệp Vãng Lai)
  const handleQuickSelectWalkIn = (type: 'Khách Lẻ' | 'Freelance') => {
    let matched = customers.find(c => {
      const cName = c.name.trim().toLowerCase();
      if (type === 'Khách Lẻ') {
        return c.id === 'cust-khach-le' || c.id === 'c5' || cName === 'khách lẻ' || cName === 'khach le';
      } else {
        return c.id === 'cust-freelance' || c.id === 'c4' || cName === 'freelance' || cName === 'frelance';
      }
    });

    if (matched) {
      handleSelectCustomer(matched);
    } else {
      setSelectedCustomerId(type === 'Khách Lẻ' ? 'cust-khach-le' : 'cust-freelance');
      setCustomerName(type);
      setCustomerSearch(type);
      setCatalogCategory(type);
      setPopularTier(type);
    }
    setShowCustomerDropdown(false);
  };

  // Find suggested combos matching the currently selected Studio / Customer
  const suggestedCombosForCurrentCustomer = useMemo(() => {
    const rawTarget = (customerName || customerSearch || '').trim();
    if (!rawTarget && !selectedCustomerId) {
      return combos.filter(c => c.studioName === 'Dùng chung');
    }

    const target = rawTarget.toLowerCase();
    const matched = combos.filter(c => {
      if (c.customerId && selectedCustomerId && c.customerId === selectedCustomerId) return true;
      const cStudio = (c.studioName || '').toLowerCase().trim();
      const cName = (c.name || '').toLowerCase().trim();
      if (cStudio && target && (cStudio.includes(target) || target.includes(cStudio))) return true;
      if (cName && target && (cName.includes(target) || target.includes(cName))) return true;
      return false;
    });

    if (matched.length > 0) return matched;
    // Fallback to shared combos if no specific match
    return combos.filter(c => c.studioName === 'Dùng chung');
  }, [combos, customerName, customerSearch, selectedCustomerId]);

  // Apply a Studio Combo into the current invoice table
  const handleApplyComboToOrder = (combo: StudioCombo) => {
    if (!combo.items || combo.items.length === 0) return;

    const newRows: OrderItem[] = combo.items.map((ci, idx) => {
      // Look up product by code
      let matchedProd = products.find(p => p.code.toUpperCase() === ci.productCode.toUpperCase());
      if (!matchedProd && popularTier) {
        const tierCode = convertProductCodeForTier(ci.productCode, popularTier);
        matchedProd = products.find(p => p.code.toUpperCase() === tierCode.toUpperCase());
      }

      const unitPrice = matchedProd ? matchedProd.price : (ci.defaultPrice || 0);
      const size = ci.size || (matchedProd ? matchedProd.size : '');
      const prodName = ci.productName || (matchedProd ? matchedProd.name : ci.productCode);
      const qty = ci.quantity > 0 ? ci.quantity : 1;

      const resolvedCore = resolveProductCoreMaterial(
        matchedProd || { code: ci.productCode, name: prodName, size },
        materials,
        products
      );

      return {
        id: `row-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
        date: isEditMode ? getTodayDateString() : orderDate,
        productCode: matchedProd ? matchedProd.code : ci.productCode,
        productName: prodName,
        size: size,
        price: unitPrice,
        quantity: qty,
        amount: qty * unitPrice,
        note: ci.note || '',
        materialCoreCode: resolvedCore.materialCoreCode,
        materialCoreName: resolvedCore.materialCoreName,
        materialCoreId: resolvedCore.materialCoreId
      };
    });

    setItems(prev => {
      // Check if table currently only has 1 empty row
      const isOnlyOneEmptyRow =
        prev.length === 1 &&
        !prev[0].productCode.trim() &&
        !prev[0].productName.trim() &&
        (!prev[0].price || prev[0].price === 0);

      if (isOnlyOneEmptyRow) {
        return newRows;
      }
      return [...prev, ...newRows];
    });

    setQuickInsertToast(`✨ Đã áp dụng Combo [${combo.name}] (+${newRows.length} sản phẩm) vào đơn hàng!`);
    setTimeout(() => setQuickInsertToast(''), 4000);
  };

  // Auto-fill row when product code matches or is selected (TỰ ĐỘNG ĐIỀN ĐƠN GIÁ VÀ CỐT VẬT TƯ CHÍNH XÁC)
  const applyProductToRow = (rowIdx: number, product: Product) => {
    const resolvedCore = resolveProductCoreMaterial(product, materials, products);
    setItems(prev => {
      const next = [...prev];
      const cur = next[rowIdx];
      const qty = cur.quantity > 0 ? cur.quantity : 1;
      const unitPrice = product.price;
      next[rowIdx] = {
        ...cur,
        productCode: product.code,
        productName: product.name,
        size: product.size,
        price: unitPrice,
        quantity: qty,
        amount: qty * unitPrice,
        materialCoreCode: resolvedCore.materialCoreCode,
        materialCoreName: resolvedCore.materialCoreName,
        materialCoreId: resolvedCore.materialCoreId
      };
      return next;
    });
    setActiveCodeRowIdx(null);
    setCodeQuery('');
  };

  // Quick-insert a popular product into the invoice table
  const handleQuickInsertPopularProduct = (product: Product) => {
    const resolvedCore = resolveProductCoreMaterial(product, materials, products);
    setItems(prev => {
      // Look for the first empty row
      const emptyIdx = prev.findIndex(r => !r.productCode.trim() && !r.productName.trim() && (!r.price || r.price === 0));

      if (emptyIdx !== -1) {
        const next = [...prev];
        const cur = next[emptyIdx];
        const qty = cur.quantity > 0 ? cur.quantity : 1;
        const unitPrice = product.price;
        next[emptyIdx] = {
          ...cur,
          date: isEditMode ? getTodayDateString() : (cur.date || orderDate),
          productCode: product.code,
          productName: product.name,
          size: product.size,
          price: unitPrice,
          quantity: qty,
          amount: qty * unitPrice,
          materialCoreCode: resolvedCore.materialCoreCode,
          materialCoreName: resolvedCore.materialCoreName,
          materialCoreId: resolvedCore.materialCoreId
        };
        return next;
      } else {
        // Append a new row with this product
        const newRow: OrderItem = {
          id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          date: isEditMode ? getTodayDateString() : orderDate,
          productCode: product.code,
          productName: product.name,
          size: product.size,
          price: product.price,
          quantity: 1,
          amount: product.price,
          note: '',
          materialCoreCode: resolvedCore.materialCoreCode,
          materialCoreName: resolvedCore.materialCoreName,
          materialCoreId: resolvedCore.materialCoreId
        };
        return [...prev, newRow];
      }
    });

    setQuickInsertToast(`+ Đã chèn [${product.code}] - ${product.name} (${formatCurrency(product.price)}) [Cốt: ${resolvedCore.materialCoreCode}]`);
    setTimeout(() => setQuickInsertToast(''), 3000);
  };

  // Kiểm tra sản phẩm có được đánh dấu ưa thích (⭐) hay không
  const isProductFavorite = (prod: Product) => {
    if (favoriteCodes.includes(prod.code)) return true;
    const baseCode = convertProductCodeForTier(prod.code, 'GIÁ STUDIO');
    return favoriteCodes.includes(baseCode);
  };

  // Đánh dấu hoặc bỏ đánh dấu sản phẩm ưa thích (⭐) - tự động lưu vào localStorage
  const handleToggleProductFavorite = (prod: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const baseCode = convertProductCodeForTier(prod.code, 'GIÁ STUDIO');
    setFavoriteCodes(prev => {
      const isFav = prev.includes(prod.code) || prev.includes(baseCode);
      const next = isFav
        ? prev.filter(c => c !== prod.code && c !== baseCode)
        : [prod.code, baseCode, ...prev];
      try {
        localStorage.setItem('xuongin194_user_favorite_codes_v1', JSON.stringify(next));
      } catch (err) {
        console.error('Error saving favorites', err);
      }
      return next;
    });
  };

  // Chọn sản phẩm từ modal bảng giá đưa vào hóa đơn bán hàng
  const handleSelectProductFromCatalog = (product: Product) => {
    const resolvedCore = resolveProductCoreMaterial(product, materials, products);
    setItems(prev => {
      // Tìm dòng trống đầu tiên
      const emptyIdx = prev.findIndex(r => !r.productCode.trim() && !r.productName.trim() && (!r.price || r.price === 0));
      if (emptyIdx !== -1) {
        const next = [...prev];
        const cur = next[emptyIdx];
        const qty = cur.quantity > 0 ? cur.quantity : 1;
        next[emptyIdx] = {
          ...cur,
          date: isEditMode ? getTodayDateString() : (cur.date || orderDate),
          productCode: product.code,
          productName: product.name,
          size: product.size,
          price: product.price,
          quantity: qty,
          amount: qty * product.price,
          materialCoreCode: resolvedCore.materialCoreCode,
          materialCoreName: resolvedCore.materialCoreName,
          materialCoreId: resolvedCore.materialCoreId
        };
        return next;
      } else {
        const newRow: OrderItem = {
          id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          date: isEditMode ? getTodayDateString() : orderDate,
          productCode: product.code,
          productName: product.name,
          size: product.size,
          price: product.price,
          quantity: 1,
          amount: product.price,
          note: '',
          materialCoreCode: resolvedCore.materialCoreCode,
          materialCoreName: resolvedCore.materialCoreName,
          materialCoreId: resolvedCore.materialCoreId
        };
        return [...prev, newRow];
      }
    });

    setQuickInsertToast(`+ Đã thêm [${product.code}] - ${product.name} (${formatCurrency(product.price)}) [Cốt: ${resolvedCore.materialCoreCode}] vào đơn hàng`);
    setTimeout(() => setQuickInsertToast(''), 3000);
  };

  // Danh sách sản phẩm trong modal "Chọn nhanh từ bảng giá tiệm":
  // CÁC SẢN PHẨM ĐƯỢC ĐÁNH DẤU ƯA THÍCH (⭐) SẼ TỰ ĐỘNG ĐƯỢC XẾP LÊN HÀNG ĐẦU!
  const sortedCatalogProducts = useMemo(() => {
    return products
      .filter(p => {
        if (catalogCategory !== 'all' && p.category !== catalogCategory) return false;
        if (showOnlyFavorites && !isProductFavorite(p)) return false;
        if (!catalogSearch.trim()) return true;
        const q = catalogSearch.toLowerCase().trim();
        return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.size.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const aFav = isProductFavorite(a);
        const bFav = isProductFavorite(b);
        // Sản phẩm ưa thích xếp lên hàng đầu tiên!
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return 0;
      });
  }, [products, catalogCategory, catalogSearch, showOnlyFavorites, favoriteCodes]);

  // Handle typing inside Mã số hàng (Product code)
  const handleProductCodeChange = (rowIdx: number, val: string) => {
    const upperVal = val.toUpperCase().trim();
    setCodeQuery(val);
    setActiveCodeRowIdx(rowIdx);

    // Update row code immediately
    setItems(prev => {
      const next = [...prev];
      const cur = next[rowIdx];
      next[rowIdx] = { ...cur, productCode: upperVal };
      return next;
    });

    // Check if there is an exact case-insensitive match
    const exactMatch = products.find(p => p.code.toUpperCase() === upperVal);
    if (exactMatch) {
      applyProductToRow(rowIdx, exactMatch);
    } else if (popularTier) {
      // Check if matches converted code for active tier
      const convertedMatch = products.find(p => {
        const tierCode = convertProductCodeForTier(p.code, popularTier);
        return tierCode.toUpperCase() === upperVal;
      });
      if (convertedMatch) {
        applyProductToRow(rowIdx, convertedMatch);
      }
    }
  };

  // Handle row field changes
  const handleRowChange = (rowIdx: number, field: keyof OrderItem, val: any) => {
    setItems(prev => {
      const next = [...prev];
      const row = { ...next[rowIdx], [field]: val };

      // Recalculate amount if price or quantity changed
      if (field === 'price' || field === 'quantity') {
        const p = field === 'price' ? Number(val) || 0 : row.price;
        const q = field === 'quantity' ? Number(val) || 0 : row.quantity;
        row.amount = p * q;
      }

      // If user directly changes or selects materialCoreCode on the row
      if (field === 'materialCoreCode') {
        const upper = (val || '').toUpperCase().trim();
        if (upper === 'NONE' || upper === 'KHONG' || upper === 'KHONG_COT' || upper === '0') {
          row.materialCoreCode = 'NONE';
          row.materialCoreName = 'Không dùng cốt ván';
          row.materialCoreId = undefined;
        } else {
          row.materialCoreCode = upper;
          const matchedMat = materials.find(m => m.code.toUpperCase() === upper);
          if (matchedMat) {
            row.materialCoreName = matchedMat.name;
            row.materialCoreId = matchedMat.id;
          }
        }
      }

      next[rowIdx] = row;
      return next;
    });
  };

  // Add new empty row
  const handleAddRow = () => {
    const today = getTodayDateString();
    const newRow: OrderItem = {
      id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      date: isEditMode ? today : orderDate,
      productCode: '',
      productName: '',
      size: '',
      price: 0,
      quantity: 1,
      amount: 0,
      note: ''
    };
    setItems(prev => [...prev, newRow]);
  };

  // Remove row
  const handleRemoveRow = (rowIdx: number) => {
    if (items.length <= 1) {
      // Keep at least one empty row
      setItems([{
        id: `row-${Date.now()}`,
        date: orderDate,
        productCode: '',
        productName: '',
        size: '',
        price: 0,
        quantity: 1,
        amount: 0,
        note: ''
      }]);
      return;
    }
    setItems(prev => prev.filter((_, idx) => idx !== rowIdx));
  };

  // Reset form to brand new
  const handleResetForm = (showNotice: boolean = true) => {
    setEditingInvoiceId(null);
    setEditingOrderNumber('');
    setEditingOrderCreatedAt('');
    setOrderDate(getTodayDateString());
    setSelectedCustomerId('');
    setCustomerName('');
    setGuestName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerSearch('');
    setOrderNotes('');
    setDiscount(0);
    setPreviousDebt(0);
    setPaid(0);
    setManualMdfOverrides({});
    setManualExtraMdfItems([]);
    setExcludedSourceRowIds([]);
    setItems([{
      id: `row-${Date.now()}`,
      date: getTodayDateString(),
      productCode: '',
      productName: '',
      size: '',
      price: 0,
      quantity: 1,
      amount: 0,
      note: ''
    }]);
    if (showNotice) {
      setSaveSuccessMsg('Đã tạo phiếu đơn hàng mới trắng thành công!');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    }
  };

  // Cancel edit mode and return to new order
  const handleCancelEdit = () => {
    handleResetForm(false);
    if (onCancelEdit) {
      onCancelEdit();
    }
    setSaveSuccessMsg('Đã hủy chế độ sửa, quay về tạo hóa đơn mới.');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  // Watch external newOrderTrigger from header
  useEffect(() => {
    if (newOrderTrigger && newOrderTrigger > 0) {
      handleResetForm(true);
      if (onCancelEdit) {
        onCancelEdit();
      }
    }
  }, [newOrderTrigger]);

  // Load editing order into form when editingOrder changes
  useEffect(() => {
    if (editingOrder) {
      setEditingInvoiceId(editingOrder.id);
      setEditingOrderNumber(editingOrder.orderNumber);
      setEditingOrderCreatedAt(editingOrder.createdAt);
      setOrderDate(editingOrder.date || getTodayDateString());
      setSelectedCustomerId(editingOrder.customerId || '');
      setCustomerName(editingOrder.customerName || '');
      setCustomerPhone(editingOrder.customerPhone || '');
      setCustomerAddress(editingOrder.customerAddress || '');
      setCustomerSearch(editingOrder.customerName || '');
      setOrderNotes(editingOrder.notes || '');

      // Khôi phục tên riêng của khách lẻ / freelance nếu có
      if (editingOrder.guestName) {
        setGuestName(editingOrder.guestName);
      } else if (editingOrder.customerName) {
        const m = editingOrder.customerName.match(/^(?:khách\s*lẻ|khach\s*le|freelance|frelance)\s*[-:–—\s(]+([^)]+)\)?$/i);
        if (m && m[1]) {
          setGuestName(m[1].trim());
        } else {
          setGuestName('');
        }
      } else {
        setGuestName('');
      }

      setOrderStatus(editingOrder.status || 'completed');
      setDiscount(editingOrder.discount || 0);
      setPreviousDebt(editingOrder.previousDebt || 0);
      setPaid(editingOrder.paid || 0);

      // Load items
      if (editingOrder.items && editingOrder.items.length > 0) {
        setItems(editingOrder.items.map((it, idx) => ({
          ...it,
          id: it.id || `row-${idx + 1}-${Date.now()}`
        })));
      } else {
        setItems([{
          id: `row-1-${Date.now()}`,
          date: editingOrder.date || getTodayDateString(),
          productCode: '',
          productName: '',
          size: '',
          price: 0,
          quantity: 1,
          amount: 0,
          note: ''
        }]);
      }

      setSaveSuccessMsg(`📋 Đang ở chế độ bổ sung / cập nhật hóa đơn #${editingOrder.orderNumber}`);
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    }
  }, [editingOrder]);

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalDue = Math.max(0, subtotal - discount + previousDebt - paid);

  // Live calculation of raw materials needed for this order
  const bomRequirements = useMemo(() => {
    const validItems = items.filter(it => it.quantity > 0 && (it.productCode.trim() !== '' || it.productName.trim() !== '' || it.amount > 0));
    return calculateOrderBOM(validItems, materials, products);
  }, [items, materials, products]);

  // All MDF and Fomex materials available in warehouse inventory
  const mdfMaterials = useMemo(() => {
    return materials.filter(m => m.category === 'Gỗ MDF');
  }, [materials]);

  const fomexMaterials = useMemo(() => {
    return materials.filter(m => m.category === 'Fomex siêu nhẹ');
  }, [materials]);

  const allBoardMaterials = useMemo(() => {
    return materials.filter(m => m.category === 'Gỗ MDF' || m.category === 'Fomex siêu nhẹ');
  }, [materials]);

  // Compute live items for "Phiếu xuất ván MDF & Fomex"
  const mdfSlipItems = useMemo(() => {
    const list: {
      id: string;
      sourceRowId?: string;
      sourceItemName: string;
      size: string;
      materialId: string;
      materialCode: string;
      materialName: string;
      materialCategory: string;
      unit: string;
      quantity: number;
      currentStock: number;
      remainingStock: number;
      isManual?: boolean;
      date?: string;
    }[] = [];

    // 1. Scan valid invoice rows and map to required board (Fomex for 4K/HD Pro, MDF for other photos, NONE for in/inep/album/khung)
    items.forEach((row, idx) => {
      if (excludedSourceRowIds.includes(row.id)) return;
      if (!row.quantity || row.quantity <= 0) return;
      if (!row.productCode && !row.productName && !row.size && row.price <= 0) return;

      // 1. ƯU TIÊN SỐ 1: Kiểm tra Cốt Vật Tư Tương Thích (materialCoreCode)
      // Được tự động nhập từ Bảng Giá hoặc chọn thủ công trên dòng hóa đơn
      const matchedProd = products.find(p => p.code.toUpperCase().trim() === row.productCode.toUpperCase().trim());
      const explicitCoreCode = (row.materialCoreCode || matchedProd?.materialCoreCode || '').trim();
      const explicitCoreId = row.materialCoreId || matchedProd?.materialCoreId;

      if (explicitCoreCode) {
        const upperCore = explicitCoreCode.toUpperCase();
        // Nếu là NONE -> Tuyệt đối không trừ bất kỳ cốt ván nào
        if (upperCore === 'NONE' || upperCore === 'KHONG' || upperCore === 'KHONG_COT' || upperCore === '0') {
          return;
        }

        // Tìm chính xác vật tư trong kho theo mã hoặc ID
        const exactMat = materials.find(m => m.code.toUpperCase() === upperCore || (explicitCoreId && m.id === explicitCoreId));
        if (exactMat) {
          const override = manualMdfOverrides[row.id];
          const selectedMat = override?.materialId ? materials.find(m => m.id === override.materialId) || exactMat : exactMat;
          const qty = override?.quantity !== undefined ? override.quantity : row.quantity;
          const currentStock = selectedMat.stockQuantity;
          const remainingStock = Math.round((currentStock - qty) * 100) / 100;
          const displayTitle = row.productName || row.productCode || `Ảnh dòng #${idx + 1}`;

          list.push({
            id: `slip-row-${row.id}`,
            sourceRowId: row.id,
            sourceItemName: displayTitle,
            size: row.size || extractEffectiveSize(row.size, row.productName, row.productCode) || 'Tiêu chuẩn',
            materialId: selectedMat.id,
            materialCode: selectedMat.code,
            materialName: selectedMat.name,
            materialCategory: selectedMat.category,
            unit: selectedMat.unit || 'Tấm',
            quantity: qty,
            currentStock,
            remainingStock,
            isManual: false,
            date: row.date || orderDate
          });
          return;
        }
      }

      // 2. Phân loại cốt vật tư dự phòng (Fallback nếu chưa cấu hình mã cốt cụ thể):
      // - 'none': In ảnh, In ép, Khung gia cố (NEP), Album mở phẳng, Photobook... -> BỎ TRỐNG CỐT, KHÔNG TRỪ VÁN
      // - 'fomex': DUY NHẤT dành cho Ảnh 4K và Ảnh HD Pro -> Cốt Fomex 9li siêu nhẹ
      // - 'mdf': Tất cả các dòng ảnh còn lại (HD Gương Siêu Bóng, Lụa Viền, Mika, Lụa Khung, Ép Gỗ, Tráng Gương, Pha Lê...) -> Cốt Ván Gỗ MDF
      const coreType = getProductCoreType({
        code: row.productCode,
        name: row.productName,
        note: row.note,
        materialCoreCode: explicitCoreCode
      });

      if (coreType === 'none') {
        return;
      }

      const effectiveSize = extractEffectiveSize(row.size, row.productName, row.productCode);
      const normSize = normalizeSize(effectiveSize);

      const targetCategory = coreType === 'fomex' ? 'Fomex siêu nhẹ' : 'Gỗ MDF';
      const candidateMaterials = materials.filter(m => m.category === targetCategory);

      let selectedMat: Material | undefined;
      const override = manualMdfOverrides[row.id];

      if (override?.materialId) {
        selectedMat = materials.find(m => m.id === override.materialId);
      }

      if (!selectedMat) {
        // Auto-match board material by size in candidate category
        selectedMat = candidateMaterials.find(m => {
          const normCode = normalizeSize(m.code);
          const normName = normalizeSize(m.name);
          return normSize && (normCode.includes(normSize) || normName.includes(normSize));
        });
        if (!selectedMat && effectiveSize) {
          selectedMat = candidateMaterials.find(m => m.name.toLowerCase().includes(effectiveSize.toLowerCase()));
        }
        if (!selectedMat && candidateMaterials.length > 0) {
          selectedMat = candidateMaterials[0];
        }
        if (!selectedMat && allBoardMaterials.length > 0) {
          selectedMat = allBoardMaterials[0];
        }
      }

      if (selectedMat) {
        const qty = override?.quantity !== undefined ? override.quantity : row.quantity;
        const currentStock = selectedMat.stockQuantity;
        const remainingStock = Math.round((currentStock - qty) * 100) / 100;
        const displayTitle = row.productName || row.productCode || `Ảnh dòng #${idx + 1}`;

        list.push({
          id: `slip-row-${row.id}`,
          sourceRowId: row.id,
          sourceItemName: displayTitle,
          size: effectiveSize || row.size || 'Tiêu chuẩn',
          materialId: selectedMat.id,
          materialCode: selectedMat.code,
          materialName: selectedMat.name,
          materialCategory: selectedMat.category,
          unit: selectedMat.unit || 'Tấm',
          quantity: qty,
          currentStock,
          remainingStock,
          isManual: false,
          date: row.date || orderDate
        });
      }
    });

    // 2. Add manual extra MDF or Fomex items
    manualExtraMdfItems.forEach((extra, idx) => {
      const mat = materials.find(m => m.id === extra.materialId) || allBoardMaterials[0] || mdfMaterials[0];
      if (mat) {
        const remaining = Math.round((mat.stockQuantity - extra.quantity) * 100) / 100;
        list.push({
          id: extra.id,
          sourceItemName: extra.note || `Ván/Fomex xuất thêm #${idx + 1}`,
          size: extractEffectiveSize('', mat.name, mat.code) || 'Tùy chọn',
          materialId: mat.id,
          materialCode: mat.code,
          materialName: mat.name,
          materialCategory: mat.category,
          unit: mat.unit || 'Tấm',
          quantity: extra.quantity,
          currentStock: mat.stockQuantity,
          remainingStock: remaining,
          isManual: true,
          date: isEditMode ? getTodayDateString() : orderDate
        });
      }
    });

    return list;
  }, [items, materials, mdfMaterials, fomexMaterials, allBoardMaterials, manualMdfOverrides, manualExtraMdfItems, excludedSourceRowIds]);

  const totalMdfBoards = mdfSlipItems.reduce((sum, it) => sum + (it.quantity || 0), 0);

  // MDF slip interaction handlers
  const handleChangeMdfMaterial = (rowKey: string, newMatId: string) => {
    if (rowKey.startsWith('slip-row-')) {
      const sourceRowId = rowKey.replace('slip-row-', '');
      setManualMdfOverrides(prev => ({
        ...prev,
        [sourceRowId]: { ...prev[sourceRowId], materialId: newMatId }
      }));
    } else {
      setManualExtraMdfItems(prev => prev.map(item => item.id === rowKey ? { ...item, materialId: newMatId } : item));
    }
  };

  const handleChangeMdfQuantity = (rowKey: string, newQty: number) => {
    const qty = Math.max(1, newQty);
    if (rowKey.startsWith('slip-row-')) {
      const sourceRowId = rowKey.replace('slip-row-', '');
      setManualMdfOverrides(prev => ({
        ...prev,
        [sourceRowId]: { ...prev[sourceRowId], quantity: qty }
      }));
    } else {
      setManualExtraMdfItems(prev => prev.map(item => item.id === rowKey ? { ...item, quantity: qty } : item));
    }
  };

  const handleRemoveMdfItem = (rowKey: string) => {
    if (rowKey.startsWith('slip-row-')) {
      const sourceRowId = rowKey.replace('slip-row-', '');
      setExcludedSourceRowIds(prev => [...prev, sourceRowId]);
    } else {
      setManualExtraMdfItems(prev => prev.filter(item => item.id !== rowKey));
    }
  };

  const handleAddManualMdfItem = () => {
    const firstMat = mdfMaterials[0];
    if (!firstMat) return;
    const newExtra = {
      id: `manual-mdf-${Date.now()}`,
      materialId: firstMat.id,
      quantity: 1,
      note: 'Ván xuất thêm / cắt dưỡng'
    };
    setManualExtraMdfItems(prev => [...prev, newExtra]);
  };

  const handleResetMdfSlip = () => {
    setManualMdfOverrides({});
    setManualExtraMdfItems([]);
    setExcludedSourceRowIds([]);
  };

  // Save order handler
  const handleSave = (openPrint: boolean) => {
    // Validate
    const validItems = items.filter(it => it.productCode.trim() !== '' || it.productName.trim() !== '' || it.amount > 0);
    if (validItems.length === 0) {
      setSaveSuccessMsg('⚠️ Vui lòng nhập ít nhất 1 sản phẩm có mã hàng hoặc tên hàng trước khi lưu.');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
      return;
    }

    const isEditMode = !!editingInvoiceId;
    const orderNum = editingOrderNumber || `194-${new Date(orderDate).getFullYear()}-${String(allOrders.length + 1).padStart(3, '0')}`;
    const orderId = editingInvoiceId || `ord-${Date.now()}`;
    const orderCreatedAt = editingOrderCreatedAt || new Date().toISOString();
    const freshBOM = calculateOrderBOM(validItems, materials, products);

    // Collect deductions from Phiếu xuất ván MDF
    const mdfDeductions = autoDeductMdf
      ? mdfSlipItems.map(it => ({
          materialId: it.materialId,
          materialCode: it.materialCode,
          materialName: it.materialName,
          unit: it.unit || 'Tấm',
          quantity: it.quantity,
          date: it.date || orderDate
        }))
      : [];

    // Aggregate by materialId AND date so deductions on different dates maintain their actual transaction date!
    const finalDeductions: {
      materialId: string;
      materialCode: string;
      materialName: string;
      unit: string;
      quantity: number;
      date?: string;
    }[] = [];

    mdfDeductions.forEach(item => {
      const itemDate = item.date || orderDate;
      const existing = finalDeductions.find(d => d.materialId === item.materialId && (d.date || orderDate) === itemDate);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        finalDeductions.push({ ...item, date: itemDate });
      }
    });

    // Chuẩn bị tên khách hàng lưu nội bộ và tên riêng chụp gửi khách
    const trimmedGuest = guestName.trim();
    let finalCustomerName = (customerName || customerSearch || '').trim();
    let finalCustomerId = selectedCustomerId;

    if (isKhachLe) {
      finalCustomerName = trimmedGuest ? `Khách Lẻ - ${trimmedGuest}` : 'Khách Lẻ';
      if (!finalCustomerId) {
        const klCust = customers.find(c => c.id === 'cust-khach-le' || c.id === 'c5' || c.name.trim().toLowerCase() === 'khách lẻ');
        finalCustomerId = klCust?.id || 'cust-khach-le';
      }
    } else if (isFreelance) {
      finalCustomerName = trimmedGuest ? `Freelance - ${trimmedGuest}` : 'Freelance';
      if (!finalCustomerId) {
        const flCust = customers.find(c => c.id === 'cust-freelance' || c.id === 'c4' || c.name.trim().toLowerCase() === 'freelance' || c.name.trim().toLowerCase() === 'frelance');
        finalCustomerId = flCust?.id || 'cust-freelance';
      }
    } else {
      // Khách hàng cố định (như Phước Công, Studio Hoàng Gia...)
      // Giữ nguyên ID và tên riêng của khách, TUYỆT ĐỐI KHÔNG gom vào pool vãng lai!
      if (!finalCustomerId) {
        finalCustomerId = `cust-${Date.now()}`;
      }
    }

    const newOrder: Order = {
      id: orderId,
      orderNumber: orderNum,
      date: orderDate,
      customerId: finalCustomerId,
      customerName: finalCustomerName || 'Khách Hàng',
      guestName: isSpecialWalkIn && trimmedGuest ? trimmedGuest : undefined,
      customerPhone: customerPhone.trim() || '',
      customerAddress: customerAddress.trim() || '',
      items: validItems,
      subtotal,
      discount,
      previousDebt,
      paid,
      totalDue,
      status: orderStatus,
      materialsDeducted: finalDeductions,
      notes: orderNotes.trim(),
      createdAt: orderCreatedAt,
      updatedAt: new Date().toISOString()
    };

    onSaveOrder(newOrder, openPrint);
    setLastSavedOrder(newOrder);

    // Dọn dẹp form sau khi lưu / cập nhật và trả về trạng thái bình thường
    handleResetForm(false);
    setEditingInvoiceId(null);
    setEditingOrderNumber('');
    setEditingOrderCreatedAt('');
    if (onCancelEdit) {
      onCancelEdit();
    }

    if (isEditMode) {
      setSaveSuccessMsg(`✅ Đã cập nhật thành công hóa đơn #${orderNum}! Dữ liệu kho vật tư đã được tự động hoàn trả và trừ lại chính xác.`);
    } else {
      setSaveSuccessMsg(`Đã lưu đơn hàng #${orderNum} thành công!${totalMdfBoards > 0 ? ` (Phiếu xuất: đã trừ ${totalMdfBoards} tấm cốt Ván MDF / Fomex trong Kho Vật Tư)` : ''}`);
    }
  };

  // Quick Customer Creation
  const handleSaveQuickCustomer = () => {
    if (!newCustName.trim()) {
      return;
    }
    const newCustomer: Customer = {
      id: `c-${Date.now()}`,
      name: newCustName.trim(),
      phone: newCustPhone.trim(),
      address: newCustAddress.trim(),
      customerType: newCustType,
      initialDebt: newCustInitialDebt || 0,
      createdAt: getTodayDateString()
    };
    onAddNewCustomer(newCustomer);
    handleSelectCustomer(newCustomer);
    setShowQuickCustomerModal(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
    setNewCustType('GIÁ STUDIO');
    setNewCustInitialDebt(0);
  };

  // Filtered products for active code auto-fill popup (ưu tiên phân khúc giá hiện tại & sản phẩm ưa thích ⭐ lên hàng đầu)
  const filteredProducts = useMemo(() => {
    const tierProducts = products.filter(p => p.category === popularTier);
    const pool = tierProducts.length > 0 ? tierProducts : products;

    let results: Product[] = [];
    if (!codeQuery.trim()) {
      results = pool.slice(0, 20);
    } else {
      const q = codeQuery.toLowerCase().trim();
      const matchedInTier = pool.filter(p => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.size.toLowerCase().includes(q));
      if (matchedInTier.length > 0) {
        results = matchedInTier.slice(0, 20);
      } else {
        results = products.filter(p => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.size.toLowerCase().includes(q)).slice(0, 20);
      }
    }

    return results.sort((a, b) => {
      const aFav = isProductFavorite(a);
      const bFav = isProductFavorite(b);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
  }, [products, popularTier, codeQuery, favoriteCodes]);

  // Filtered customer list for customer dropdown
  const filteredCustomers = customers.filter(c => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.studioName && c.studioName.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Feedback */}
      {saveSuccessMsg && (
        <div className="p-3 sm:p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-extrabold text-sm">{saveSuccessMsg}</span>
              <p className="text-xs text-emerald-700">Đơn hàng đã được lưu vào hệ thống dữ liệu tiệm.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {lastSavedOrder && (
              <>
                <button
                  type="button"
                  onClick={() => onSaveOrder(lastSavedOrder, true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-xs cursor-pointer"
                  title="Mở hóa đơn và sao chép ảnh gửi Zalo trực tiếp"
                >
                  <Copy className="w-3.5 h-3.5 text-emerald-200" />
                  Sao chép ảnh gửi Zalo
                </button>
                <button
                  type="button"
                  onClick={() => onSaveOrder(lastSavedOrder, true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In & Xuất Phiếu Hóa Đơn
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                handleResetForm(true);
                setSaveSuccessMsg('');
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-amber-600" />
              Tạo đơn mới
            </button>
            <button
              type="button"
              onClick={() => setSaveSuccessMsg('')}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Edit Mode Notification Banner */}
      {editingInvoiceId && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-4 sm:p-5 border-2 border-blue-400/80 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 rounded-xl border border-blue-400/40 text-blue-300 shrink-0">
              <Edit3 className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-wider font-extrabold text-blue-300">
                  Đang Bổ Sung / Cập Nhật Hóa Đơn
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-amber-400 text-slate-950 shadow-xs">
                  #{editingOrderNumber}
                </span>
                <span className="text-xs text-blue-200 font-medium">
                  (Khách: <strong className="text-white">{customerName || 'Chưa có tên'}</strong>)
                </span>
              </div>
              <p className="text-xs text-blue-100/90 mt-1">
                💡 Bạn có thể thêm hàng hóa mới, sửa số lượng hoặc công nợ. Hàng hóa bổ sung sẽ tự động nhận ngày thực tế bổ sung (<strong>hôm nay</strong>), đảm bảo Doanh thu và Xuất kho vật tư ghi nhận đúng ngày thực tế mà không bị lùi về ngày tạo đơn ban đầu!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelEdit}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            title="Hủy bỏ chỉnh sửa và quay lại màn hình tạo đơn mới"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
            <span>Hủy Sửa (Tạo Mới)</span>
          </button>
        </div>
      )}

      {/* Main Order Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {/* Card Header / Title */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-xl shadow-md">
              194
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  {editingInvoiceId ? (
                    <>
                      <span>BỔ SUNG / CẬP NHẬT HÓA ĐƠN</span>
                      <span className="font-mono text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-400/40 text-sm">
                        #{editingOrderNumber}
                      </span>
                    </>
                  ) : (
                    <span>TẠO ĐƠN HÀNG & PHIẾU BÁN HÀNG</span>
                  )}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {editingInvoiceId ? 'Chế độ chỉnh sửa' : 'Tự động điền theo Mã SP'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {editingInvoiceId
                  ? 'Bổ sung danh sách hàng hóa hoặc sửa số lượng, công nợ trực tiếp cho hóa đơn này.'
                  : 'Nhập mã hàng (VD: EG1015, TG6090, PL2030) hệ thống tự động điền Tên, Kích thước, Đơn giá'}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleResetForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-semibold transition cursor-pointer"
              title="Khởi tạo đơn hàng mới trắng"
            >
              <Plus className="w-3.5 h-3.5" />
              Tạo đơn mới
            </button>
            <button
              type="button"
              onClick={() => {
                setInitialRowsForCombo(undefined);
                setShowComboModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 text-xs font-bold transition shadow-xs cursor-pointer"
              title="Mở danh sách các Gói Combo theo Studio đã tạo sẵn"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Gói Combo Studio ({combos.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedCustomerId) {
                  const cust = customers.find(c => c.id === selectedCustomerId);
                  if (cust?.customerType) setCatalogCategory(cust.customerType);
                }
                setShowCatalogModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition shadow-xs cursor-pointer"
              title="Mở bảng giá tiệm: các sản phẩm ưa thích sẽ luôn xếp ở hàng đầu để chọn nhanh"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950" />
              <span>Chọn nhanh từ bảng giá tiệm</span>
            </button>
          </div>
        </div>

        {/* Customer & General Order Info Form */}
        <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Customer Selector / Search */}
            <div className="md:col-span-5 relative" ref={customerDropdownRef}>
              <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Khách hàng / Studio</span>
                    <span className="text-red-500">*</span>
                  </label>
                  {/* Quick Select Walk-in Categories (Khách Lẻ / Freelance) */}
                  <div className="inline-flex items-center gap-1 ml-1">
                    <button
                      type="button"
                      onClick={() => handleQuickSelectWalkIn('Khách Lẻ')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer border ${
                        isKhachLe
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}
                      title="Chọn nhanh tệp Khách Lẻ vãng lai (không tạo khách mới)"
                    >
                      <User className="w-3 h-3" />
                      <span>Khách Lẻ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSelectWalkIn('Freelance')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer border ${
                        isFreelance
                          ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                      }`}
                      title="Chọn nhanh tệp thợ chụp Freelance vãng lai (không tạo khách mới)"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Freelance</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowQuickCustomerModal(true)}
                  className="text-[11px] text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-0.5 cursor-pointer ml-auto"
                >
                  <UserPlus className="w-3 h-3" />
                  + Khách cố định
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={customerSearch || customerName}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setCustomerName(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder="Gõ tên Studio, thợ ảnh hoặc khách lẻ..."
                  className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden transition shadow-2xs"
                />
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>

              {/* Thông báo phân loại cho khách Freelance cố định (như Phước Công) */}
              {selectedCustomerId && !isSpecialWalkIn && (() => {
                const selectedCust = customers.find(c => c.id === selectedCustomerId);
                if (selectedCust?.customerType === 'Freelance') {
                  return (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 w-fit">
                      <Camera className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Khách Freelance cố định: <strong>{selectedCust.name}</strong> • Đang áp dụng bảng giá Freelance</span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Customer Dropdown */}
              {showCustomerDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map(cust => {
                      const cName = cust.name.trim().toLowerCase();
                      const isWalkInCust = (cust.id === 'cust-freelance' || cust.id === 'c4' || cName === 'freelance' || cName === 'frelance') ||
                                           (cust.id === 'cust-khach-le' || cust.id === 'c5' || cName === 'khách lẻ' || cName === 'khach le');
                      return (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => handleSelectCustomer(cust)}
                          className={`w-full text-left p-2.5 hover:bg-amber-50/60 transition flex items-center justify-between group cursor-pointer ${
                            isWalkInCust ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-semibold text-xs text-slate-900 group-hover:text-amber-700">
                                {cust.name} {cust.studioName ? `(${cust.studioName})` : ''}
                              </p>
                              {isWalkInCust ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                  Tệp vãng lai
                                </span>
                              ) : cust.customerType === 'Freelance' ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                                  Freelance cố định
                                </span>
                              ) : null}
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {isWalkInCust ? '👥 Khách ghé 1-2 lần • Ghi tên riêng khi lên đơn' : `${cust.phone || 'Chưa SĐT'} • ${cust.address || 'Hà Nội'}`}
                            </p>
                          </div>
                          {cust.initialDebt > 0 && (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-semibold">
                              Nợ: {formatCurrency(cust.initialDebt)}
                            </span>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-500">
                      Không tìm thấy. Bạn có thể nhập trực tiếp tên khách này!
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Phone */}
            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Số điện thoại
                </label>
                {customerPhone.trim() && (
                  <a
                    href={`https://zalo.me/${customerPhone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold transition shadow-2xs cursor-pointer"
                    title={`Mở Zalo khách hàng (${customerPhone.replace(/[^0-9]/g, '')})`}
                  >
                    <ExternalLink className="w-3 h-3 text-blue-600" />
                    <span>Mở Zalo khách</span>
                  </a>
                )}
              </div>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0988 123 456"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden transition shadow-2xs font-mono"
              />
            </div>

            {/* Order Date */}
            <div className="md:col-span-4">
              <label className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Ngày lập đơn</span>
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => {
                  setOrderDate(e.target.value);
                  setItems(prev => prev.map(it => ({ ...it, date: e.target.value })));
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden transition shadow-2xs font-mono"
              />
            </div>

            {/* MỤC VIẾT TÊN CHO TỪNG KHÁCH LẺ HOẶC FREELANCE VÃNG LAI */}
            {isSpecialWalkIn && (
              <div className="md:col-span-12 p-3.5 bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-50 border-2 border-amber-300 rounded-2xl shadow-xs animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
                  <label className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                    {isFreelance ? <Camera className="w-4 h-4 text-amber-600" /> : <User className="w-4 h-4 text-emerald-600" />}
                    <span>
                      Nhập tên riêng cho {isFreelance ? 'thợ Freelance' : 'khách lẻ'} này:
                    </span>
                    <span className="text-red-500 font-bold">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 inline-flex items-center gap-1 self-start sm:self-auto">
                    <span>🛡️ Khi chụp ảnh gửi khách:</span>
                    <strong className="underline">Ẩn 2 từ "{isFreelance ? 'Freelance' : 'Khách Lẻ'}"</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-7">
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder={isFreelance ? "VD: Anh Tuấn, Thợ Nam, Studio Mai Long freelance..." : "VD: Chị Mai, Anh Hùng, Chú Ba, Bác Nam..."}
                      className="w-full px-3 py-2 bg-white border border-amber-400 rounded-xl text-xs font-bold text-slate-950 focus:ring-2 focus:ring-amber-500 outline-hidden shadow-2xs placeholder:font-normal placeholder:text-slate-400"
                      autoFocus
                    />
                  </div>
                  <div className="md:col-span-5 text-[11px] space-y-1 text-slate-700 bg-white/80 p-2 rounded-xl border border-amber-200">
                    <div className="truncate">
                      📋 <span className="font-semibold text-slate-600">Sổ nợ & thống kê nội bộ:</span>{' '}
                      <strong className="text-slate-900 font-mono">
                        {isFreelance ? 'Freelance' : 'Khách Lẻ'}{guestName.trim() ? ` - ${guestName.trim()}` : ''}
                      </strong>
                    </div>
                    <div className="truncate">
                      📸 <span className="font-semibold text-slate-600">Trên ảnh gửi khách:</span>{' '}
                      <strong className="text-emerald-700 font-mono font-bold">
                        "{guestName.trim() || 'Quý Khách'}"
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Studio Combo Proposal Banner (TỰ ĐỘNG ĐỀ XUẤT COMBO KHI CHỌN STUDIO) */}
        {suggestedCombosForCurrentCustomer.length > 0 ? (
          <div className="px-4 py-3 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-500/5 border-b border-amber-300/80 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-amber-500 text-slate-950 rounded-xl shadow-xs shrink-0 font-black">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase text-amber-950 tracking-tight flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                    Đề xuất Combo cho {customerName || 'Studio'}:
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-white text-amber-900 border border-amber-300 shadow-2xs">
                    {suggestedCombosForCurrentCustomer[0].name} ({suggestedCombosForCurrentCustomer[0].items.length} món)
                  </span>
                </div>
                <p className="text-[11px] text-amber-900/90 mt-0.5">
                  {suggestedCombosForCurrentCustomer[0].description ||
                    suggestedCombosForCurrentCustomer[0].items.map(it => `${it.quantity}x ${it.productCode} (${it.size})`).join(' • ')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => handleApplyComboToOrder(suggestedCombosForCurrentCustomer[0])}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-xs transition cursor-pointer"
                title="Tự động thêm trọn bộ sản phẩm trong Combo này vào bảng bán hàng"
              >
                <Zap className="w-3.5 h-3.5 fill-slate-950" />
                <span>⚡ Áp dụng Combo này vào đơn (+{suggestedCombosForCurrentCustomer[0].items.length} món)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInitialRowsForCombo(undefined);
                  setShowComboModal(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 text-slate-800 border border-amber-300 text-xs font-bold transition cursor-pointer shadow-2xs"
              >
                <span>Xem / Đổi Combo ({combos.length})</span>
              </button>
            </div>
          </div>
        ) : customerName.trim() ? (
          <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Studio <strong>{customerName}</strong> chưa có gói Combo mẫu riêng.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setInitialRowsForCombo(undefined);
                setShowComboModal(true);
              }}
              className="text-[11px] font-bold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer flex items-center gap-1 self-start sm:self-auto"
            >
              <Plus className="w-3 h-3" />
              + Tạo Combo sản phẩm hay mua cho {customerName}
            </button>
          </div>
        ) : null}

        {/* Quick Insert Toast Message if active */}
        {quickInsertToast && (
          <div className="mx-4 my-2 p-2.5 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{quickInsertToast}</span>
            </div>
            <button onClick={() => setQuickInsertToast('')} className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Sales Table with clean header */}
        <div className="border-t border-slate-200">
          <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                <span>CHI TIẾT HÀNG HÓA TRONG ĐƠN</span>
              </span>
              <span className="text-[11px] text-slate-500 hidden md:inline">
                ({items.filter(it => it.productCode || it.productName).length} mặt hàng)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedCustomerId) {
                    const cust = customers.find(c => c.id === selectedCustomerId);
                    if (cust?.customerType) setCatalogCategory(cust.customerType);
                  }
                  setShowCatalogModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
                title="Mở bảng giá tiệm: các sản phẩm ưa thích bạn đánh dấu sẽ luôn lên hàng đầu"
              >
                <Zap className="w-3.5 h-3.5 fill-slate-950" />
                <span>Chọn nhanh từ bảng giá tiệm</span>
              </button>
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer"
              >
                <Plus className="w-3 h-3 text-amber-600" />
                <span>+ Thêm dòng</span>
              </button>
            </div>
          </div>

        {/* Sales Table with required columns */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-800 font-bold border-b border-slate-200">
                <th className="py-2.5 px-2.5 text-center w-10">STT</th>
                <th className="py-2.5 px-3 text-center w-28">
                  <span className="flex items-center justify-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    Ngày tháng
                  </span>
                </th>
                <th className="py-2.5 px-3 w-36">
                  <span className="flex items-center gap-1 text-amber-700">
                    <Hash className="w-3.5 h-3.5" />
                    Mã số hàng *
                  </span>
                </th>
                <th className="py-2.5 px-3 min-w-[200px]">
                  Tên hàng (Tự động điền)
                </th>
                <th className="py-2.5 px-3 text-center w-28">
                  Kích thước
                </th>
                <th className="py-2.5 px-3 text-center min-w-[145px] text-amber-950">
                  <span className="flex items-center justify-center gap-1">
                    <Boxes className="w-3.5 h-3.5 text-amber-700" />
                    Cốt vật tư (Tự động)
                  </span>
                </th>
                <th className="py-2.5 px-3 text-right w-28">
                  Giá tiền (đ)
                </th>
                <th className="py-2.5 px-2 text-center w-18">
                  Số lượng
                </th>
                <th className="py-2.5 px-3 text-right w-32">
                  Thành tiền
                </th>
                <th className="py-2.5 px-3 min-w-[140px]">
                  Ghi chú yêu cầu
                </th>
                <th className="py-2.5 px-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {items.map((row, idx) => {
                const rowBOM = calculateItemBOM(row, materials, products);
                const codeUpper = (row.productCode || '').toUpperCase().trim();
                const coreUpper = (row.materialCoreCode || '').toUpperCase().trim();
                const isNoCore =
                  coreUpper === 'NONE' ||
                  coreUpper === 'KHONG' ||
                  coreUpper === 'KHONG_COT' ||
                  coreUpper === '0';
                const isFomex =
                  coreUpper.includes('FOMEX') ||
                  (row.materialCoreName && row.materialCoreName.toLowerCase().includes('fomex'));

                return (
                <tr key={row.id} className="hover:bg-amber-50/20 group transition-colors">
                  {/* STT */}
                  <td className="py-2 px-2.5 text-center text-slate-400 font-mono font-medium">
                    {idx + 1}
                  </td>

                  {/* 1. CỘT NGÀY THÁNG */}
                  <td className="py-2 px-2 text-center">
                    <div className="flex flex-col items-center">
                      <input
                        type="date"
                        value={row.date || orderDate}
                        onChange={(e) => handleRowChange(idx, 'date', e.target.value)}
                        className={`w-full px-2 py-1.5 border rounded-lg font-mono text-[11px] focus:bg-white focus:border-amber-500 outline-hidden transition ${
                          isEditMode && row.date && editingOrder?.date && row.date !== editingOrder.date
                            ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-bold shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      />
                      {isEditMode && row.date && editingOrder?.date && row.date !== editingOrder.date && (
                        <span className="text-[9px] font-bold text-blue-700 mt-0.5 whitespace-nowrap">
                          ✨ Bổ sung
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 2. CỘT MÃ SỐ HÀNG (Tự động điền giá, tên hàng, kích thước khi nhập) */}
                  <td className="py-2 px-2 relative">
                    <input
                      type="text"
                      value={row.productCode}
                      onChange={(e) => handleProductCodeChange(idx, e.target.value)}
                      onFocus={() => {
                        setActiveCodeRowIdx(idx);
                        setCodeQuery(row.productCode);
                      }}
                      placeholder="VD: EG1015, HDST60*90..."
                      className="w-full px-2.5 py-1.5 bg-amber-50/40 border border-amber-300 font-mono font-bold text-amber-900 uppercase rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden placeholder:text-slate-400"
                    />

                    {/* Autocomplete Popup when typing product code */}
                    {activeCodeRowIdx === idx && (
                      <div className="absolute left-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl z-40 w-80 max-h-72 overflow-y-auto divide-y divide-slate-100">
                        <div className="p-2 bg-slate-900 text-white text-[10px] font-bold flex items-center justify-between sticky top-0 z-10">
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-400" />
                            GỢI Ý MÃ SẢN PHẨM
                          </span>
                          <span className="text-amber-400 font-mono">{filteredProducts.length} mã</span>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {filteredProducts.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={() => applyProductToRow(idx, p)}
                              className="w-full text-left p-2 hover:bg-amber-100/70 transition flex items-center justify-between cursor-pointer"
                            >
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-xs text-amber-800 bg-amber-100 px-1 rounded">
                                    {p.code}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-800">{p.size}</span>
                                  {isProductFavorite(p) && (
                                    <span className="text-[9px] text-amber-700 bg-amber-100 px-1 rounded font-bold">⭐ Ưa thích</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-600 truncate max-w-[190px]">{p.name}</p>
                              </div>
                              <span className="font-mono font-semibold text-xs text-emerald-700 shrink-0">
                                {formatCurrency(p.price)}
                              </span>
                            </button>
                          ))}
                        </div>

                        {filteredProducts.length === 0 && (
                          <div className="p-3 text-center text-xs text-slate-500">
                            Không có mã khớp. Bạn có thể tự gõ tên và giá trực tiếp!
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* 3. CỘT TÊN HÀNG: In đậm, tách dòng rõ ràng với Mã SP & Cốt vật tư bên dưới */}
                  <td className="py-2 px-2 min-w-[220px]">
                    <input
                      type="text"
                      value={row.productName}
                      onChange={(e) => handleRowChange(idx, 'productName', e.target.value)}
                      placeholder="Tên sản phẩm in ảnh..."
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs sm:text-[13px] font-bold text-slate-900 break-words focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-hidden transition shadow-2xs"
                    />

                    {/* Dòng phân tách riêng phía dưới cho Mã sản phẩm & Cốt vật tư */}
                    {(codeUpper || coreUpper || rowBOM.length > 0) && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                        {/* Tag Mã SP */}
                        {codeUpper && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-mono text-[10px] text-gray-500 bg-gray-100 border border-gray-200 font-semibold">
                            <span>Mã:</span>
                            <strong className="text-gray-700">{codeUpper}</strong>
                          </span>
                        )}

                        {/* Tag Cốt vật tư */}
                        {coreUpper && (
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                            isNoCore
                              ? 'bg-gray-50 text-gray-500 border-gray-200'
                              : isFomex
                              ? 'bg-sky-50 text-sky-800 border-sky-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            <span>{isNoCore ? '🚫' : (isFomex ? '✨' : '🪵')}</span>
                            <span>{isNoCore ? 'Không cốt' : `Cốt: ${coreUpper}`}</span>
                          </span>
                        )}

                        {/* Danh mục vật tư trừ kho nếu có */}
                        {rowBOM.length > 0 && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Boxes className="w-2.5 h-2.5 text-amber-600" />
                            <span>Trừ kho: {rowBOM.map(b => `${b.quantity} ${b.material.unit} ${b.material.name}`).join(', ')}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* 4. CỘT KÍCH THƯỚC */}
                  <td className="py-2 px-2 text-center">
                    <input
                      type="text"
                      value={row.size}
                      onChange={(e) => handleRowChange(idx, 'size', e.target.value)}
                      placeholder="VD: 60x90"
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center text-slate-700 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-hidden"
                    />
                  </td>

                  {/* CỘT CỐT VẬT TƯ (Tự động điền theo sản phẩm hoặc cho phép chọn/sửa thủ công) */}
                  <td className="py-2 px-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {(() => {
                        const codeUpper = (row.materialCoreCode || '').toUpperCase().trim();
                        if (codeUpper === 'NONE' || codeUpper === 'KHONG' || codeUpper === 'KHONG_COT' || codeUpper === '0') {
                          return (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300"
                              title="Dòng này KHÔNG DÙNG CỐT VÁN (Bỏ trống, không trừ kho)"
                            >
                              🚫 Không cốt
                            </span>
                          );
                        }
                        if (codeUpper) {
                          const isFomex = codeUpper.includes('FOMEX') || (row.materialCoreName && row.materialCoreName.toLowerCase().includes('fomex'));
                          const matchedMat = materials.find(m => m.code.toUpperCase() === codeUpper || m.id === row.materialCoreId);
                          return (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-2xs ${
                                isFomex
                                  ? 'bg-sky-50 text-sky-900 border-sky-300'
                                  : 'bg-amber-50 text-amber-900 border-amber-300'
                              }`}
                              title={matchedMat ? `${matchedMat.name} (Tồn kho: ${matchedMat.stockQuantity} ${matchedMat.unit})` : row.materialCoreName || codeUpper}
                            >
                              <span>{isFomex ? '✨' : '🪵'}</span>
                              <span className="font-mono font-bold">{codeUpper}</span>
                            </span>
                          );
                        }

                        // Nếu chưa có trên dòng, hiển thị trạng thái chờ hoặc tự động
                        if (!row.productCode && !row.productName) {
                          return <span className="text-slate-400 text-[10px] italic">—</span>;
                        }

                        return (
                          <span className="text-[10px] text-amber-800 font-medium italic">
                            ⚙️ Tự động
                          </span>
                        );
                      })()}

                      {/* Dropdown / quick selector to change core material if needed for this row */}
                      {materials.length > 0 && (row.productCode || row.productName) && (
                        <select
                          value={row.materialCoreCode?.toUpperCase() === 'NONE' ? 'NONE' : (row.materialCoreCode || '')}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'NONE') {
                              handleRowChange(idx, 'materialCoreCode', 'NONE');
                            } else if (val) {
                              const m = materials.find(mat => mat.code.toUpperCase() === val.toUpperCase());
                              handleRowChange(idx, 'materialCoreCode', val);
                              if (m) {
                                handleRowChange(idx, 'materialCoreName', m.name);
                                handleRowChange(idx, 'materialCoreId', m.id);
                              }
                            } else {
                              handleRowChange(idx, 'materialCoreCode', '');
                            }
                          }}
                          className="w-5 h-6 opacity-60 hover:opacity-100 transition cursor-pointer text-[10px] bg-transparent border-0 outline-hidden text-slate-500"
                          title="Đổi loại cốt vật tư cho dòng này"
                        >
                          <option value="">⚙️ Đổi cốt...</option>
                          <option value="NONE">🚫 Không dùng cốt (Bỏ trống)</option>
                          <optgroup label="🪵 Ván Gỗ MDF">
                            {materials.filter(m => m.category === 'Gỗ MDF').map(m => (
                              <option key={m.id} value={m.code.toUpperCase()}>
                                {m.code} - {m.name} (Còn {m.stockQuantity} {m.unit})
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="✨ Fomex Siêu Nhẹ 9li">
                            {materials.filter(m => m.category === 'Fomex siêu nhẹ').map(m => (
                              <option key={m.id} value={m.code.toUpperCase()}>
                                {m.code} - {m.name} (Còn {m.stockQuantity} {m.unit})
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      )}
                    </div>
                  </td>

                  {/* 5. CỘT GIÁ TIỀN */}
                  <td className="py-2 px-2 text-right">
                    <input
                      type="number"
                      value={row.price || ''}
                      onChange={(e) => handleRowChange(idx, 'price', Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-semibold text-right text-slate-800 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-hidden"
                    />
                  </td>

                  {/* SỐ LƯỢNG */}
                  <td className="py-2 px-1 text-center">
                    <input
                      type="number"
                      min="1"
                      value={row.quantity || ''}
                      onChange={(e) => handleRowChange(idx, 'quantity', Number(e.target.value))}
                      className="w-14 px-1.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden"
                    />
                  </td>

                  {/* 6. CỘT THÀNH TIỀN (Tự động tính) */}
                  <td className="py-2 px-3 text-right">
                    <span className="font-mono font-extrabold text-xs text-slate-900 bg-slate-100 px-2 py-1 rounded-md inline-block">
                      {formatCurrency(row.amount)}
                    </span>
                  </td>

                  {/* GHI CHÚ */}
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={row.note || ''}
                      onChange={(e) => handleRowChange(idx, 'note', e.target.value)}
                      placeholder="Yêu cầu riêng (bo viền, ép mờ...)"
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600 focus:border-amber-500 outline-hidden"
                    />
                  </td>

                  {/* XÓA DÒNG */}
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer"
                      title="Xóa dòng này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>

        {/* Add row actions bar */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAddRow}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              Thêm dòng hàng mới
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedCustomerId) {
                  const cust = customers.find(c => c.id === selectedCustomerId);
                  if (cust?.customerType) setCatalogCategory(cust.customerType);
                }
                setShowCatalogModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950" />
              Chọn nhanh từ bảng giá tiệm
            </button>
            <button
              type="button"
              onClick={() => {
                setInitialRowsForCombo(undefined);
                setShowComboModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs"
              title="Mở bảng chọn Combo Studio"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Gói Combo ({combos.length})
            </button>
            {items.some(r => r.productCode.trim() || r.productName.trim()) && (
              <button
                type="button"
                onClick={() => {
                  const valid = items
                    .filter(r => r.productCode.trim() || r.productName.trim())
                    .map(r => ({
                      productCode: r.productCode,
                      productName: r.productName,
                      size: r.size,
                      quantity: r.quantity || 1,
                      note: r.note || ''
                    }));
                  setInitialRowsForCombo(valid);
                  setShowComboModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                title="Lưu tất cả sản phẩm đang có trong bảng này thành gói Combo mẫu để lần sau chọn nhanh"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>💾 Lưu thành Combo {customerName ? `cho ${customerName}` : ''}</span>
              </button>
            )}
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Số dòng hàng: <strong className="text-slate-800">{items.length}</strong>
          </span>
        </div>

        {/* Bottom Section: Side-by-side balanced cards (Phiếu xuất ván MDF + Tổng kết thanh toán) */}
        <div className="p-4 sm:p-6 bg-slate-50/80 border-t border-slate-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

            {/* CỬA SỔ 1: PHIẾU XUẤT VÁN MDF */}
            <div className="lg:col-span-7 bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between space-y-3.5">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                      <Boxes className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                        <span>Phiếu xuất ván mdf & fomex</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold lowercase">
                          kho vật tư
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Định mức Ván MDF & Fomex siêu nhẹ 9li (Ảnh 4K & HD Pro) • Liên kết trừ kho khi lưu đơn
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-black bg-amber-500 text-slate-950 shadow-xs">
                      Tổng: {totalMdfBoards} tấm
                    </span>
                  </div>
                </div>

                {/* Items in Slip */}
                {mdfSlipItems.length > 0 ? (
                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 [scrollbar-width:thin]">
                    {mdfSlipItems.map((item, idx) => {
                      const isOut = item.remainingStock < 0;
                      const isLow = item.remainingStock >= 0 && item.remainingStock <= 8;

                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-xl border text-xs space-y-2 transition ${
                            isOut
                              ? 'bg-rose-950/40 border-rose-700/60'
                              : isLow
                              ? 'bg-red-950/40 border-red-500 shadow-md shadow-red-950/30 hover:border-red-400'
                              : 'bg-slate-800/80 border-slate-700/80 hover:border-slate-600'
                          }`}
                        >
                          {/* Row context & title */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                                #{idx + 1}
                              </span>
                              <span className="font-bold text-slate-200 truncate max-w-[220px] sm:max-w-xs" title={item.sourceItemName}>
                                {item.sourceItemName}
                              </span>
                              {item.size && (
                                <span className="px-1.5 py-0.2 rounded bg-slate-700/90 text-amber-200 font-mono text-[10px] font-semibold border border-slate-600/60">
                                  Khổ ảnh: {item.size}
                                </span>
                              )}
                              {item.materialCategory === 'Fomex siêu nhẹ' ? (
                                <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold border border-blue-500/40">
                                  🪶 Fomex 9li (4K/HD Pro)
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/40">
                                  🪵 Ván MDF
                                </span>
                              )}
                              {item.isManual && (
                                <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono text-[10px]">
                                  Thủ công
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveMdfItem(item.id)}
                              className="text-slate-400 hover:text-rose-400 p-1 rounded-md hover:bg-slate-700/50 transition cursor-pointer"
                              title="Bỏ dòng xuất ván này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Board selector & Quantity */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                            <div className="sm:col-span-8">
                              <label className="text-[10px] text-slate-400 block mb-0.5">
                                Loại cốt ván MDF / Fomex & Mã vật tư trong kho:
                              </label>
                              <select
                                value={item.materialId}
                                onChange={(e) => handleChangeMdfMaterial(item.id, e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-semibold text-amber-200 focus:border-amber-400 outline-hidden cursor-pointer"
                              >
                                {fomexMaterials.length > 0 && (
                                  <optgroup label="─── TẤM FOMEX SIÊU NHẸ (Ảnh 4K & HD+) ───">
                                    {fomexMaterials.map(mat => (
                                      <option key={mat.id} value={mat.id}>
                                        [{mat.code}] {mat.name} (Tồn: {mat.stockQuantity} {mat.unit})
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {mdfMaterials.length > 0 && (
                                  <optgroup label="─── TẤM VÁN MDF (Ảnh Khác) ───">
                                    {mdfMaterials.map(mat => (
                                      <option key={mat.id} value={mat.id}>
                                        [{mat.code}] {mat.name} (Tồn: {mat.stockQuantity} {mat.unit})
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            </div>

                            <div className="sm:col-span-4">
                              <label className="text-[10px] text-slate-400 block mb-0.5">
                                Số lượng ván dùng:
                              </label>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleChangeMdfQuantity(item.id, item.quantity - 1)}
                                  className="w-7 h-7 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-bold cursor-pointer transition text-xs"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity || ''}
                                  onChange={(e) => handleChangeMdfQuantity(item.id, parseInt(e.target.value, 10) || 1)}
                                  className="w-14 px-1 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-black text-center text-white focus:border-amber-400 outline-hidden"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleChangeMdfQuantity(item.id, item.quantity + 1)}
                                  className="w-7 h-7 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-bold cursor-pointer transition text-xs"
                                >
                                  +
                                </button>
                                <span className="text-xs text-slate-300 font-medium">tấm</span>
                              </div>
                            </div>
                          </div>

                          {/* Inventory Status Bar */}
                          <div className="flex flex-wrap items-center justify-between text-[11px] pt-1.5 border-t border-slate-700/60 font-mono gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">
                                Tồn kho hiện có: <strong className="text-slate-200">{item.currentStock}</strong> tấm
                              </span>
                              <span>➔</span>
                              <span className="text-slate-400">
                                Sau đơn: <strong className={isOut || isLow ? 'text-red-400 font-black' : 'text-emerald-400 font-bold'}>{item.remainingStock}</strong> tấm
                              </span>
                            </div>

                            {isOut ? (
                              <span className="text-[10px] px-2.5 py-0.5 rounded-md bg-rose-600/35 text-rose-200 border border-rose-500 font-sans font-bold flex items-center gap-1 shadow-xs">
                                <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                                <span>Kho không đủ ván</span>
                              </span>
                            ) : isLow ? (
                              <span className="text-[11px] px-3 py-1 rounded-md bg-red-600 text-white border border-red-400 font-sans font-black flex items-center gap-1.5 shadow-md shadow-red-900/60 animate-pulse">
                                <AlertCircle className="w-3.5 h-3.5 text-white shrink-0 fill-red-800" />
                                <span>Cảnh báo sắp hết ván</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-sans flex items-center gap-1 font-semibold">
                                <Check className="w-3.5 h-3.5 text-emerald-400" /> Tồn kho đủ xuất
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 px-4 text-center rounded-xl bg-slate-800/40 border border-dashed border-slate-700/80 text-xs text-slate-400 space-y-2">
                    <Boxes className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="font-semibold text-slate-300">Chưa có dòng ảnh nào cần xuất ván MDF.</p>
                    <p className="text-[11px] text-slate-500">
                      Nhập sản phẩm in ảnh (60x90, 50x75, 20x30...) vào bảng hàng bên trên, hệ thống sẽ tự động bóc tách ván tương ứng!
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Slip Actions */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddManualMdfItem}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      + Thêm ván xuất thủ công
                    </button>
                    {(Object.keys(manualMdfOverrides).length > 0 || manualExtraMdfItems.length > 0 || excludedSourceRowIds.length > 0) && (
                      <button
                        type="button"
                        onClick={handleResetMdfSlip}
                        className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs transition cursor-pointer flex items-center gap-1"
                        title="Nạp lại theo các dòng trong hóa đơn"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Nạp lại
                      </button>
                    )}
                  </div>

                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={autoDeductMdf}
                      onChange={(e) => setAutoDeductMdf(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="font-medium">Tự động trừ số ván trên ở Kho Vật Tư khi lưu</span>
                  </label>
                </div>
              </div>
            </div>

            {/* CỬA SỔ 2: TỔNG KẾT THANH TOÁN ĐƠN HÀNG */}
            <div className="lg:col-span-5 bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between space-y-3">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 pb-1 border-b border-slate-800">
                  TỔNG KẾT THANH TOÁN ĐƠN HÀNG
                </h3>

                {/* 1. TỔNG TIỀN (Hàng hóa) */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 font-medium">1. Tổng tiền hàng:</span>
                  <span className="font-mono text-base font-bold text-white">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                {/* Giảm giá chiết khấu */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Chiết khấu / Giảm giá:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-emerald-400 font-mono">-</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={discount ? discount.toLocaleString('en-US') : (discount === 0 ? '0' : '')}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        setDiscount(digits ? parseInt(digits, 10) : 0);
                      }}
                      onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                      placeholder="0"
                      className="w-28 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-right text-emerald-400 focus:border-amber-500 outline-hidden"
                    />
                    <span className="text-slate-400 font-mono">₫</span>
                  </div>
                </div>

                {/* 2. NỢ CŨ */}
                <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-800">
                  <div>
                    <span className="text-amber-300 font-bold">2. Nợ cũ:</span>
                    <span className="text-[11px] text-slate-400 ml-1.5">(Tự nạp theo khách)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-amber-300 font-mono">+</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={previousDebt ? previousDebt.toLocaleString('en-US') : (previousDebt === 0 ? '0' : '')}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        setPreviousDebt(digits ? parseInt(digits, 10) : 0);
                      }}
                      onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                      placeholder="0"
                      className="w-32 px-2.5 py-1.5 bg-slate-800 border border-amber-500/50 rounded-lg text-sm font-mono font-bold text-right text-amber-300 focus:border-amber-400 outline-hidden"
                    />
                    <span className="text-amber-400 font-mono">₫</span>
                  </div>
                </div>

                {/* Khách đã trả / Tạm ứng */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Khách đã thanh toán / Tạm ứng:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-blue-400 font-mono">-</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={paid ? paid.toLocaleString('en-US') : (paid === 0 ? '0' : '')}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        setPaid(digits ? parseInt(digits, 10) : 0);
                      }}
                      onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                      placeholder="0"
                      className="w-28 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-right text-blue-400 focus:border-amber-500 outline-hidden"
                    />
                    <span className="text-slate-400 font-mono">₫</span>
                  </div>
                </div>

                {/* 3. CẦN THANH TOÁN */}
                <div className="pt-2.5 border-t-2 border-amber-500 flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-transparent p-2 rounded-xl">
                  <div>
                    <p className="text-xs uppercase font-extrabold text-amber-400 tracking-wider">
                      3. CẦN THANH TOÁN
                    </p>
                    <p className="text-[11px] text-slate-400">
                      (= Tổng tiền - Giảm giá + Nợ cũ - Đã trả)
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-2xl font-black text-amber-400 drop-shadow-xs">
                      {formatCurrency(totalDue)}
                    </div>
                  </div>
                </div>

                {/* Bằng chữ tiếng Việt */}
                <div className="text-[11px] text-slate-300 italic bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                  <span className="text-amber-400 font-semibold not-italic">Bằng chữ: </span>
                  {numberToVietnameseWords(totalDue)}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2 border-t border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl ${
                      editingInvoiceId
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25'
                        : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                    } font-extrabold transition cursor-pointer`}
                    title={editingInvoiceId ? `Cập nhật đơn #${editingOrderNumber} và mở cửa sổ in phiếu` : "Lưu đơn và mở cửa sổ in khổ A4/A5 hoặc xuất file ảnh JPG gửi khách"}
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <Printer className="w-4 h-4" />
                      <span>{editingInvoiceId ? 'CẬP NHẬT & IN PHIẾU' : 'LƯU & IN PHIẾU'}</span>
                    </div>
                    <span className="text-[10px] font-semibold opacity-90">
                      {editingInvoiceId ? `(Cập nhật #${editingOrderNumber})` : '(Xuất Phiếu • In A4/A5)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl ${
                      editingInvoiceId
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md'
                    } transition cursor-pointer`}
                    title={editingInvoiceId ? `Cập nhật ghi đè vào hóa đơn #${editingOrderNumber}` : "Lưu đơn hàng vào hệ thống"}
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      {editingInvoiceId ? <RefreshCw className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                      <span>{editingInvoiceId ? 'CẬP NHẬT HÓA ĐƠN' : 'LƯU ĐƠN HÀNG'}</span>
                    </div>
                    <span className="text-[10px] font-normal text-emerald-100">
                      {editingInvoiceId ? `(Ghi đè #${editingOrderNumber})` : '(Lưu vào sổ đơn)'}
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (editingInvoiceId) {
                      handleCancelEdit();
                    } else {
                      handleResetForm(true);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-slate-700 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {editingInvoiceId
                    ? '+ HỦY SỬA & TẠO ĐƠN MỚI (LÀM TRẮNG BẢNG)'
                    : '+ TẠO ĐƠN MỚI (LÀM TRẮNG BẢNG ĐỂ BÁN ĐƠN TIẾP THEO)'}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>

      {/* Modal Chọn Nhanh Từ Bảng Giá Tiệm */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-amber-500 text-slate-950 rounded-xl shadow-xs">
                  <Zap className="w-5 h-5 fill-slate-950" />
                </span>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                    <span>CHỌN NHANH TỪ BẢNG GIÁ TIỆM IN 194</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black">
                      ⭐ {products.filter(p => isProductFavorite(p)).length} mã ưa thích
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Bấm vào sản phẩm để thêm vào hóa đơn • Bấm ngôi sao <strong className="text-amber-400">⭐</strong> để đánh dấu ưa thích (sản phẩm ưa thích sẽ luôn tự động lên hàng đầu)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
                title="Đóng (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Toolbar: Search & Category Tabs */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2.5 shrink-0">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Tìm theo mã sản phẩm (HDST, LK, NEP, in...), tên hoặc kích thước (60x90, 20x30)..."
                    className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                  {catalogSearch && (
                    <button
                      type="button"
                      onClick={() => setCatalogSearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Only Favorites Quick Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowOnlyFavorites(prev => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                    showOnlyFavorites
                      ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-400'
                      : 'bg-white hover:bg-amber-50 text-slate-700 border border-slate-300'
                  }`}
                  title="Chỉ hiển thị các sản phẩm bạn đã bấm sao ⭐ ưa thích"
                >
                  <Star className={`w-3.5 h-3.5 ${showOnlyFavorites ? 'fill-slate-950 text-slate-950' : 'text-amber-500 fill-amber-400'}`} />
                  <span>Chỉ xem mã Ưa thích ({products.filter(p => isProductFavorite(p)).length})</span>
                </button>
              </div>

              {/* Price Tier & Combo Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
                {[
                  { id: 'all', label: `Tất cả (${products.length})` },
                  { id: 'combo', label: `⚡ COMBO STUDIO & GÓI QUEN (${combos.length})` },
                  { id: 'GIÁ STUDIO', label: `🏢 1. GIÁ STUDIO (${products.filter(p => p.category === 'GIÁ STUDIO').length})` },
                  { id: 'Freelance', label: `📸 2. Freelance (${products.filter(p => p.category === 'Freelance').length})` },
                  { id: 'Khách Lẻ', label: `👤 3. Khách Lẻ (${products.filter(p => p.category === 'Khách Lẻ').length})` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCatalogCategory(tab.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                      catalogCategory === tab.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : tab.id === 'combo'
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300'
                        : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-3 sm:p-4 overflow-y-auto max-h-[60vh] flex-1 bg-slate-100/60 space-y-4">
              {/* SPOTLIGHT BANNER: GỢI Ý COMBO CHO STUDIO ĐANG CHỌN */}
              {catalogCategory !== 'combo' && suggestedCombosForCurrentCustomer.length > 0 && !catalogSearch.trim() && (
                <div className="p-3 sm:p-3.5 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-500/10 border-2 border-amber-400 rounded-2xl shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-amber-300/60">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-amber-500 text-slate-950 rounded-lg font-black">
                        <Sparkles className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black uppercase text-amber-950">
                            Đề xuất Combo quen thuộc:
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-xs font-extrabold bg-white text-amber-900 border border-amber-300">
                            {suggestedCombosForCurrentCustomer[0].name}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-900/80">
                          {suggestedCombosForCurrentCustomer[0].description || `Gói sản phẩm thường mua của ${customerName || 'Studio'}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          handleApplyComboToOrder(suggestedCombosForCurrentCustomer[0]);
                          setShowCatalogModal(false);
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 fill-slate-950" />
                        <span>⚡ Thêm trọn bộ Combo này</span>
                      </button>
                    </div>
                  </div>

                  {/* Individual Products inside suggested combo */}
                  <div className="pt-2 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[11px] font-bold text-amber-950/80 mr-1">Các món trong Combo:</span>
                    {suggestedCombosForCurrentCustomer[0].items.map((ci, idx) => {
                      const matchedP = products.find(p => p.code.toUpperCase() === ci.productCode.toUpperCase());
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (matchedP) handleSelectProductFromCatalog(matchedP);
                            else {
                              // insert custom item
                              handleQuickInsertPopularProduct({
                                id: `c-item-${Date.now()}`,
                                code: ci.productCode,
                                name: ci.productName || ci.productCode,
                                size: ci.size || '60x90',
                                price: ci.defaultPrice || 0,
                                category: 'GIÁ STUDIO',
                                unit: 'tấm'
                              });
                            }
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-amber-100/80 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 flex items-center gap-1.5 transition shadow-2xs cursor-pointer group"
                          title="Bấm để thêm 1 món này vào đơn"
                        >
                          <span className="font-mono font-black text-amber-700 group-hover:text-amber-900">{ci.productCode}</span>
                          <span className="text-[11px] text-slate-600 truncate max-w-[120px]">{ci.productName} ({ci.size})</span>
                          <span className="text-amber-600 font-bold group-hover:text-slate-950">+ Thêm</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 1: HIỂN THỊ DANH SÁCH COMBO STUDIO */}
              {catalogCategory === 'combo' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-700">
                      Danh sách {combos.length} gói Combo Studio đã thiết lập sẵn:
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCatalogModal(false);
                        setInitialRowsForCombo(undefined);
                        setShowComboModal(true);
                      }}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      + Tạo / Quản lý Combo
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {combos.map(combo => {
                      const activeCust = customerName || customerSearch || '';
                      const isSuggested = activeCust && (
                        (combo.studioName || '').toLowerCase().includes(activeCust.toLowerCase()) ||
                        activeCust.toLowerCase().includes((combo.studioName || '').toLowerCase()) ||
                        combo.name.toLowerCase().includes(activeCust.toLowerCase())
                      );

                      return (
                        <div
                          key={combo.id}
                          className={`p-3.5 rounded-2xl border transition flex flex-col justify-between gap-2.5 ${
                            isSuggested
                              ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/30 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                                🏢 {combo.studioName || 'Dùng chung'}
                              </span>
                              {isSuggested && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-slate-950">
                                  ⭐ Đề xuất cho {activeCust}
                                </span>
                              )}
                            </div>

                            <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                              {combo.name}
                            </h4>
                            {combo.description && (
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                {combo.description}
                              </p>
                            )}

                            {/* Items preview */}
                            <div className="mt-2.5 space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-100 text-xs">
                              {combo.items.map((ci, idx) => (
                                <div key={idx} className="flex items-center justify-between text-slate-700">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="px-1 py-0.2 rounded font-mono font-bold text-[10px] bg-white border border-slate-200 text-amber-900 shrink-0">
                                      {ci.quantity}x
                                    </span>
                                    <span className="font-bold text-slate-900 truncate">
                                      {ci.productCode}
                                    </span>
                                    <span className="text-slate-500 text-[11px] truncate">
                                      - {ci.productName} ({ci.size})
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => {
                                handleApplyComboToOrder(combo);
                                setShowCatalogModal(false);
                              }}
                              className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Zap className="w-3.5 h-3.5 fill-slate-950" />
                              <span>Thêm trọn bộ Combo này (+{combo.items.length} món)</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : sortedCatalogProducts.length > 0 ? (
                /* TAB 2: HIỂN THỊ LƯỚI SẢN PHẨM BẢNG GIÁ */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {sortedCatalogProducts.map(product => {
                    const isFav = isProductFavorite(product);

                    return (
                      <div
                        key={product.id}
                        onClick={() => handleSelectProductFromCatalog(product)}
                        className={`rounded-xl p-3 border transition flex flex-col justify-between cursor-pointer group relative ${
                          isFav
                            ? 'bg-amber-50/70 border-amber-400 shadow-2xs hover:border-amber-500 hover:shadow-xs hover:bg-amber-100/50'
                            : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-2xs hover:bg-amber-50/20'
                        }`}
                      >
                        {/* Header: Star button & Code & Size */}
                        <div>
                          <div className="flex items-start justify-between gap-1 mb-1.5">
                            <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300">
                              {product.code}
                            </span>

                            <div className="flex items-center gap-1">
                              {isFav && (
                                <span className="text-[10px] font-black text-amber-800 bg-amber-200/70 px-1.5 py-0.2 rounded border border-amber-300">
                                  ⭐ Ưa thích
                                </span>
                              )}
                              {/* Star Toggle Button */}
                              <button
                                type="button"
                                onClick={(e) => handleToggleProductFavorite(product, e)}
                                className="p-1 rounded-md hover:bg-amber-200/60 transition cursor-pointer"
                                title={isFav ? "Bỏ đánh dấu ưa thích" : "Đánh dấu sản phẩm ưa thích (sẽ luôn lên hàng đầu)"}
                              >
                                <Star
                                  className={`w-4 h-4 transition ${
                                    isFav
                                      ? 'text-amber-500 fill-amber-400'
                                      : 'text-slate-300 group-hover:text-amber-400'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Product Name & Dimensions */}
                          <p className="font-bold text-xs text-slate-900 group-hover:text-amber-900 line-clamp-1" title={product.name}>
                            {product.name}
                          </p>

                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                            <span className="bg-slate-100 font-semibold px-1.5 py-0.2 rounded text-slate-700">
                              Khổ: {product.size}
                            </span>
                            <span>•</span>
                            <span className="truncate">
                              {product.category === 'GIÁ STUDIO' ? 'Studio' : product.category === 'Freelance' ? 'Freelance' : 'Khách Lẻ'}
                            </span>
                          </div>
                        </div>

                        {/* Price & Add Button */}
                        <div className="pt-2 mt-2 border-t border-slate-200/80 flex items-center justify-between">
                          <span className="font-mono font-extrabold text-xs text-emerald-700">
                            {formatCurrency(product.price)}
                          </span>

                          <span className="text-[11px] font-bold text-amber-600 group-hover:text-slate-950 group-hover:bg-amber-400 bg-amber-100 px-2 py-0.5 rounded-lg transition shadow-2xs">
                            + Thêm
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Không tìm thấy sản phẩm nào phù hợp bộ lọc.</p>
                  <p className="text-[11px] text-slate-500 mt-1">Hãy thử tìm từ khóa khác hoặc tắt bộ lọc "Chỉ xem mã Ưa thích".</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogSearch('');
                      setShowOnlyFavorites(false);
                      setCatalogCategory('all');
                    }}
                    className="mt-3 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Hiển thị lại tất cả sản phẩm
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>
                  💡 Mẹo: Bấm <strong className="text-amber-600">⚡ COMBO STUDIO</strong> hoặc đánh dấu sao <strong className="text-amber-600">⭐</strong> để chọn nhanh trong 1 chạm.
                </span>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCatalogModal(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
                >
                  Xong & Quay lại đơn hàng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Quản Lý & Thiết Lập Gói Combo Studio */}
      {showComboModal && (
        <StudioComboModal
          combos={combos}
          products={products}
          customers={customers}
          currentCustomerName={customerName || customerSearch || ''}
          currentCustomerId={selectedCustomerId}
          initialCreateForStudio={customerName || customerSearch || ''}
          initialRowsFromOrder={initialRowsForCombo}
          onSelectCombo={(combo) => {
            handleApplyComboToOrder(combo);
            setShowComboModal(false);
          }}
          onSaveCombo={(combo) => {
            onSaveCombo(combo);
            setQuickInsertToast(`Đã lưu Combo "${combo.name}" thành công!`);
            setTimeout(() => setQuickInsertToast(''), 3000);
          }}
          onDeleteCombo={(comboId) => {
            onDeleteCombo(comboId);
          }}
          onClose={() => {
            setShowComboModal(false);
            setInitialRowsForCombo(undefined);
          }}
        />
      )}

      {/* Quick Customer Modal */}
      {showQuickCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-400" />
                Thêm Khách Hàng / Studio Mới
              </h3>
              <button
                onClick={() => setShowQuickCustomerModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bảng giá áp dụng *
                </label>
                <select
                  value={newCustType}
                  onChange={(e) => setNewCustType(e.target.value as ProductCategory)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-amber-50/40 outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  <option value="GIÁ STUDIO">🏢 1. GIÁ STUDIO (Studio cưới & Đại lý sỉ)</option>
                  <option value="Freelance">📸 2. Freelance (Thợ chụp tự do)</option>
                  <option value="Khách Lẻ">👤 3. Khách Lẻ (Khách lẻ in gia đình)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên Khách Hàng / Studio *
                </label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="Ví dụ: Studio Áo Cưới Lan Hương"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số Điện Thoại
                </label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="0988..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Địa Chỉ
                </label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="Địa chỉ giao ảnh..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số Nợ Cũ Ban Đầu (nếu có)
                </label>
                <MoneyInput
                  value={newCustInitialDebt}
                  onChange={(val) => setNewCustInitialDebt(val)}
                  placeholder="0"
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500"
                  showWords={true}
                />
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowQuickCustomerModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveQuickCustomer}
                className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs cursor-pointer"
              >
                Lưu Khách Hàng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
