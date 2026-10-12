import React, { useState, useMemo } from 'react';
import { Product, ProductCategory, Material } from '../types';
import { formatCurrency } from '../utils/formatters';
import {
  Plus, Search, Edit2, Trash2, Tag, Check, Sparkles,
  AlertCircle, CheckCircle2, X, Building2, Camera, User,
  Printer, Copy, BarChart3, Filter, CheckCircle, Info, Boxes, Settings
} from 'lucide-react';
import { MoneyInput } from './MoneyInput';
import { DEFAULT_WORKSHOP_INFO, STANDARD_PHOTO_SIZES } from '../data/initialData';
import { normalizeSize } from '../utils/materialBOM';

import {
  ProductCoreType,
  getProductCoreType,
  convertProductCodeForTier,
  cloneStudioProductToFreelance,
  syncAllFreelanceFromStudio
} from '../utils/productHelpers';
export { getProductCoreType, convertProductCodeForTier, cloneStudioProductToFreelance, syncAllFreelanceFromStudio };
export type { ProductCoreType };

export type FrameKey = 'k0123' | 'k456' | 'k789' | 'k10' | 'k11' | 'titan1' | 'titan2';
export type FramedMaterialKey = 'lk' | 'mk' | 'hd';

export interface FrameOption {
  key: FrameKey;
  label: string;
  name: string;
  suffix: string;
  desc: string;
}

/**
 * 7 Loại khung viền theo quy chuẩn Tiệm In 194:
 * - k0 k1 k2 k3: hậu tố mã K0123
 * - k4 k5 k6: hậu tố mã K456
 * - k7 k8 k9: hậu tố mã K789
 * - k10: hậu tố mã K10
 * - k11: hậu tố mã K11
 * - titan 1: hậu tố mã TT1
 * - titan 2: hậu tố mã TT2
 */
export const FRAME_OPTIONS: FrameOption[] = [
  { key: 'k0123', label: 'K0 K1 K2 K3', name: 'K0 K1 K2 K3', suffix: 'K0123', desc: 'Khung viền K0, K1, K2, K3' },
  { key: 'k456', label: 'K4 K5 K6', name: 'K4 K5 K6', suffix: 'K456', desc: 'Khung viền K4, K5, K6' },
  { key: 'k789', label: 'K7 K8 K9', name: 'K7 K8 K9', suffix: 'K789', desc: 'Khung viền K7, K8, K9' },
  { key: 'k10', label: 'K10', name: 'K10', suffix: 'K10', desc: 'Khung viền bản K10' },
  { key: 'k11', label: 'K11', name: 'K11', suffix: 'K11', desc: 'Khung viền bản K11' },
  { key: 'titan1', label: 'Titan 1', name: 'Titan 1', suffix: 'TT1', desc: 'Khung hợp kim Titan 1' },
  { key: 'titan2', label: 'Titan 2', name: 'Titan 2', suffix: 'TT2', desc: 'Khung hợp kim Titan 2' },
];

/**
 * 3 Dòng ảnh có khung: Lụa Khung (LK), Mika Khung (MK), HD Gương Khung (HD)
 * Dùng chung 7 loại khung viền trên
 */
export const FRAMED_MATERIALS = [
  {
    key: 'lk' as FramedMaterialKey,
    title: 'Lụa Khung',
    short: 'LK',
    prefix: { 'GIÁ STUDIO': 'LKST', 'Freelance': 'LKFL', 'Khách Lẻ': 'LKKL' },
    baseName: 'Lụa Khung',
    desc: 'Bề mặt lụa cao cấp bo khung viền (Cốt Gỗ MDF)'
  },
  {
    key: 'mk' as FramedMaterialKey,
    title: 'Mika Phổ Thông Khung',
    short: 'MK',
    prefix: { 'GIÁ STUDIO': 'MKST', 'Freelance': 'MKFL', 'Khách Lẻ': 'MKKL' },
    baseName: 'Mika Khung',
    desc: 'Bề mặt mika trong suốt bo khung viền (Cốt Gỗ MDF)'
  },
  {
    key: 'hd' as FramedMaterialKey,
    title: 'HD Gương Siêu Bóng Khung',
    short: 'HD',
    prefix: { 'GIÁ STUDIO': 'HDST', 'Freelance': 'HDFL', 'Khách Lẻ': 'HDKL' },
    baseName: 'HD Gương Khung',
    desc: 'HD tráng gương siêu bóng bo khung viền (Cốt Gỗ MDF)'
  },
];

/**
 * Gợi ý mức giá tham khảo khi tạo nhanh sản phẩm có khung (dựa trên cỡ ảnh và loại khung)
 */
export function getEstimatedFramedPrice(matKey: FramedMaterialKey, frameKey: FrameKey, sizeStr: string, tier: ProductCategory): number {
  let basePrice = 240000;
  if (sizeStr === '6*9') basePrice = 45000;
  else if (sizeStr === '10*15') basePrice = 55000;
  else if (sizeStr === '13*18') basePrice = 65000;
  else if (sizeStr === '15*21') basePrice = 80000;
  else if (sizeStr === '20*30') basePrice = 115000;
  else if (sizeStr === '30*45') basePrice = 165000;
  else if (sizeStr === '35*50') basePrice = 195000;
  else if (sizeStr === '40*60') basePrice = 245000;
  else if (sizeStr === '50*75') basePrice = 340000;
  else if (sizeStr === '60*90') basePrice = 430000;
  else if (sizeStr === '60*120') basePrice = 590000;
  else if (sizeStr === '70*110') basePrice = 690000;
  else if (sizeStr === '80*120') basePrice = 830000;
  else if (sizeStr === '100*150') basePrice = 1260000;
  else if (sizeStr === '110*180') basePrice = 1680000;

  if (matKey === 'mk') basePrice = Math.round((basePrice * 1.15) / 5000) * 5000;
  if (matKey === 'hd') basePrice = Math.round((basePrice * 1.35) / 5000) * 5000;

  if (frameKey === 'k456') basePrice += 20000;
  else if (frameKey === 'k789') basePrice += 35000;
  else if (frameKey === 'k10') basePrice += 55000;
  else if (frameKey === 'k11') basePrice += 75000;
  else if (frameKey === 'titan1') basePrice += 110000;
  else if (frameKey === 'titan2') basePrice += 140000;

  if (tier === 'Freelance') basePrice = Math.round((basePrice * 1.2) / 5000) * 5000;
  else if (tier === 'Khách Lẻ') basePrice = Math.round((basePrice * 1.45) / 5000) * 5000;

  return basePrice;
}

interface ProductCatalogViewProps {
  products: Product[];
  materials?: Material[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onBatchSaveProducts?: (products: Product[]) => void;
}

export const ProductCatalogView: React.FC<ProductCatalogViewProps> = ({
  products,
  materials = [],
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onBatchSaveProducts
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  // Active Tab: 'GIÁ STUDIO' | 'Freelance' | 'Khách Lẻ' | 'compare' | 'all'
  const [activeTab, setActiveTab] = useState<'GIÁ STUDIO' | 'Freelance' | 'Khách Lẻ' | 'compare' | 'all'>('GIÁ STUDIO');
  const [materialFilter, setMaterialFilter] = useState<'all' | 'mdf' | 'fomex' | 'none'>('all');

  // Modal sao chép toàn bộ 1. Studio sang 2. Freelance (+10% giá, thay mã ST -> FL)
  const [isBulkCopyModalOpen, setIsBulkCopyModalOpen] = useState(false);

  // Modal create/edit product state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [modalError, setModalError] = useState('');

  // Clone product modal state
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [sourceProduct, setSourceProduct] = useState<Product | null>(null);
  const [targetCategory, setTargetCategory] = useState<ProductCategory>('Freelance');
  const [targetCode, setTargetCode] = useState('');
  const [targetPrice, setTargetPrice] = useState<number>(0);
  const [targetMarkupPercent, setTargetMarkupPercent] = useState<number>(20);

  // Delete confirmation modal state
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Printable Price Sheet Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printCategory, setPrintCategory] = useState<ProductCategory | 'all'>('GIÁ STUDIO');

  // Quick Core Material Modal state (Chỉnh sửa nhanh mã cốt vật tư tương thích trực tiếp trên bảng giá)
  const [quickCoreProduct, setQuickCoreProduct] = useState<Product | null>(null);
  const [quickCoreCodeInput, setQuickCoreCodeInput] = useState('');
  const [syncCoreAcrossTiers, setSyncCoreAcrossTiers] = useState(true);

  const handleOpenQuickCore = (p: Product) => {
    setQuickCoreProduct(p);
    setQuickCoreCodeInput(p.materialCoreCode || '');
    setSyncCoreAcrossTiers(true);
  };

  const handleSaveQuickCore = () => {
    if (!quickCoreProduct) return;
    const rawCode = quickCoreCodeInput.trim();
    let finalCode: string | undefined = undefined;
    let finalName: string | undefined = undefined;
    let finalId: string | undefined = undefined;

    if (rawCode) {
      const upper = rawCode.toUpperCase();
      if (upper === 'NONE' || upper === 'KHONG' || upper === 'KHONG_COT' || upper === '0') {
        finalCode = 'NONE';
        finalName = 'Không dùng cốt ván';
      } else {
        finalCode = upper;
        const matched = materials.find(m => m.code.toUpperCase() === upper);
        finalName = matched?.name || quickCoreProduct.materialCoreName || upper;
        finalId = matched?.id;
      }
    }

    const updatedTarget: Product = {
      ...quickCoreProduct,
      materialCoreCode: finalCode,
      materialCoreName: finalName,
      materialCoreId: finalId
    };

    if (syncCoreAcrossTiers) {
      const baseCode = convertProductCodeForTier(quickCoreProduct.code, 'GIÁ STUDIO');
      const relatedProducts = products.filter(p => {
        if (p.id === quickCoreProduct.id) return false;
        const pBase = convertProductCodeForTier(p.code, 'GIÁ STUDIO');
        return (
          pBase === baseCode ||
          (p.size === quickCoreProduct.size &&
            p.name.replace(/\((GIÁ STUDIO|Freelance|Khách Lẻ)\)/gi, '').trim() ===
              quickCoreProduct.name.replace(/\((GIÁ STUDIO|Freelance|Khách Lẻ)\)/gi, '').trim())
        );
      });

      const batchUpdates = [
        updatedTarget,
        ...relatedProducts.map(p => ({
          ...p,
          materialCoreCode: finalCode,
          materialCoreName: finalName,
          materialCoreId: finalId
        }))
      ];

      if (onBatchSaveProducts) {
        onBatchSaveProducts(batchUpdates);
      } else {
        batchUpdates.forEach(p => onUpdateProduct(p));
      }
      showToast(`Đã đồng bộ cốt [${finalCode || 'Tự động'}] cho ${batchUpdates.length} mã sản phẩm tương thích!`);
    } else {
      onUpdateProduct(updatedTarget);
      showToast(`Đã cập nhật cốt [${finalCode || 'Tự động'}] cho mã "${quickCoreProduct.code}"!`);
    }

    setQuickCoreProduct(null);
  };

  // Success toast message
  const [toastMessage, setToastMessage] = useState('');

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [size, setSize] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [category, setCategory] = useState<ProductCategory>('GIÁ STUDIO');
  const [unit, setUnit] = useState('tấm');
  const [materialCoreCode, setMaterialCoreCode] = useState('');
  const [materialCoreName, setMaterialCoreName] = useState('');
  const [materialCoreId, setMaterialCoreId] = useState('');

  // Preset selector state in modal (Mới: Hỗ trợ tạo nhanh ảnh có khung và bo viền)
  const [presetTab, setPresetTab] = useState<'framed' | 'unframed'>('framed');
  const [selectedFramedMat, setSelectedFramedMat] = useState<FramedMaterialKey>('lk');
  const [selectedFrame, setSelectedFrame] = useState<FrameKey>('k456');
  const [showAllFramedPresets, setShowAllFramedPresets] = useState<boolean>(true);

  // 3-tier counts
  const studioProducts = useMemo(() => products.filter(p => p.category === 'GIÁ STUDIO'), [products]);
  const freelanceProducts = useMemo(() => products.filter(p => p.category === 'Freelance'), [products]);
  const retailProducts = useMemo(() => products.filter(p => p.category === 'Khách Lẻ'), [products]);

  const studioCount = studioProducts.length;
  const freelanceCount = freelanceProducts.length;
  const retailCount = retailProducts.length;

  // Material core counts
  const mdfCount = useMemo(() => products.filter(p => getProductCoreType(p) === 'mdf').length, [products]);
  const fomexCount = useMemo(() => products.filter(p => getProductCoreType(p) === 'fomex').length, [products]);
  const noneCoreCount = useMemo(() => products.filter(p => getProductCoreType(p) === 'none').length, [products]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleExecuteCopyStudioToFreelance = () => {
    const updatedProducts = syncAllFreelanceFromStudio(products);
    if (onBatchSaveProducts) {
      onBatchSaveProducts(updatedProducts);
    }
    setActiveTab('Freelance');
    setIsBulkCopyModalOpen(false);
    showToast(`Đã sao chép thành công toàn bộ ${studioCount} sản phẩm từ 1. Studio sang 2. Freelance (+10% giá, thay mã ST ➔ FL)!`);
  };

  const handleOpenAdd = (defaultCat?: ProductCategory) => {
    setEditingProduct(null);
    const cat = defaultCat || (activeTab === 'Freelance' || activeTab === 'Khách Lẻ' || activeTab === 'GIÁ STUDIO' ? activeTab : 'GIÁ STUDIO');
    setCategory(cat);
    setCode('');
    setName('');
    setSize('');
    setPrice(0);
    setUnit('tấm');
    setMaterialCoreCode('');
    setMaterialCoreName('');
    setMaterialCoreId('');
    setModalError('');
    setPresetTab('framed');
    setSelectedFramedMat('lk');
    setSelectedFrame('k456');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setCode(p.code);
    setName(p.name);
    setSize(p.size);
    setPrice(p.price);
    setCategory((p.category as ProductCategory) || 'GIÁ STUDIO');
    setUnit(p.unit || 'tấm');
    setMaterialCoreCode(p.materialCoreCode || '');
    setMaterialCoreName(p.materialCoreName || '');
    setMaterialCoreId(p.materialCoreId || '');
    setModalError('');
    setIsModalOpen(true);
  };

  const handleOpenClone = (p: Product) => {
    setSourceProduct(p);
    // If source is Studio -> suggest Freelance or Khách Lẻ
    const targetCat: ProductCategory = p.category === 'GIÁ STUDIO' ? 'Freelance' : p.category === 'Freelance' ? 'Khách Lẻ' : 'GIÁ STUDIO';
    setTargetCategory(targetCat);

    const newCode = convertProductCodeForTier(p.code, targetCat);
    setTargetCode(newCode);

    let markup = 20;
    if (targetCat === 'Khách Lẻ') {
      markup = 40;
    } else if (targetCat === 'GIÁ STUDIO') {
      markup = -20;
    }
    setTargetMarkupPercent(markup);
    const newPrice = Math.round((p.price * (1 + markup / 100)) / 5000) * 5000;
    setTargetPrice(newPrice);
    setCloneModalOpen(true);
  };

  const handleTargetCategoryChange = (cat: ProductCategory) => {
    setTargetCategory(cat);
    if (!sourceProduct) return;

    const newCode = convertProductCodeForTier(sourceProduct.code, cat);
    setTargetCode(newCode);

    let markup = 20;
    if (cat === 'Khách Lẻ') {
      markup = 45;
    } else if (cat === 'GIÁ STUDIO') {
      markup = -15;
    }
    setTargetMarkupPercent(markup);
    const newPrice = Math.round((sourceProduct.price * (1 + markup / 100)) / 5000) * 5000;
    setTargetPrice(newPrice);
  };

  const handleMarkupChange = (pct: number) => {
    setTargetMarkupPercent(pct);
    if (!sourceProduct) return;
    const newPrice = Math.round((sourceProduct.price * (1 + pct / 100)) / 5000) * 5000;
    setTargetPrice(newPrice);
  };

  const handleSaveClone = () => {
    if (!sourceProduct) return;
    const cleanCode = targetCode.trim();
    if (!cleanCode) return;

    // Check duplicate
    const existing = products.find(p => p.code.toLowerCase() === cleanCode.toLowerCase());
    if (existing) {
      alert(`Mã hàng "${cleanCode}" đã tồn tại trong hệ thống! Vui lòng chọn mã khác.`);
      return;
    }

    const cleanName = sourceProduct.name.replace(/\((Freelance|Khách Lẻ|GIÁ STUDIO)\)/gi, '').trim();
    const newName = targetCategory === 'GIÁ STUDIO'
      ? cleanName
      : `${cleanName} (${targetCategory})`;

    onAddProduct({
      id: `prod-${Date.now()}`,
      code: cleanCode,
      name: newName,
      size: sourceProduct.size,
      price: Number(targetPrice) || 0,
      category: targetCategory,
      unit: sourceProduct.unit || 'tấm',
      materialCoreCode: sourceProduct.materialCoreCode,
      materialCoreName: sourceProduct.materialCoreName,
      materialCoreId: sourceProduct.materialCoreId
    });

    setCloneModalOpen(false);
    showToast(`Đã nhân bản "${sourceProduct.code}" sang bảng "${targetCategory}" với mã "${cleanCode}" thành công!`);
  };

  const handleSave = () => {
    setModalError('');
    if (!code.trim() || !name.trim() || !size.trim()) {
      setModalError('Vui lòng điền đủ Mã sản phẩm, Tên hàng và Kích thước!');
      return;
    }

    const cleanCode = code.trim();
    const trimmedCore = materialCoreCode.trim();
    let finalCoreCode: string | undefined = undefined;
    let finalCoreName: string | undefined = undefined;
    let finalCoreId: string | undefined = undefined;

    if (trimmedCore) {
      if (trimmedCore.toUpperCase() === 'NONE' || trimmedCore.toUpperCase() === 'KHONG' || trimmedCore.toUpperCase() === 'KHONG_COT') {
        finalCoreCode = 'NONE';
        finalCoreName = 'Không dùng cốt ván';
      } else {
        finalCoreCode = trimmedCore.toUpperCase();
        const matchedMat = materials.find(m => m.code.toUpperCase() === finalCoreCode || m.id === materialCoreId);
        finalCoreName = matchedMat?.name || materialCoreName.trim() || undefined;
        finalCoreId = matchedMat?.id || materialCoreId || undefined;
      }
    }

    if (editingProduct) {
      onUpdateProduct({
        ...editingProduct,
        code: cleanCode,
        name: name.trim(),
        size: size.trim(),
        price: Number(price) || 0,
        category,
        unit: unit.trim() || 'tấm',
        materialCoreCode: finalCoreCode,
        materialCoreName: finalCoreName,
        materialCoreId: finalCoreId
      });
      showToast(`Đã cập nhật mã sản phẩm "${cleanCode}" (${category}) thành công!`);
    } else {
      // Check duplicate code
      const existing = products.find(p => p.code.toLowerCase() === cleanCode.toLowerCase());
      if (existing) {
        setModalError(`Mã hàng "${cleanCode}" đã tồn tại! Vui lòng chọn mã khác.`);
        return;
      }

      onAddProduct({
        id: `prod-${Date.now()}`,
        code: cleanCode,
        name: name.trim(),
        size: size.trim(),
        price: Number(price) || 0,
        category,
        unit: unit.trim() || 'tấm',
        materialCoreCode: finalCoreCode,
        materialCoreName: finalCoreName,
        materialCoreId: finalCoreId
      });
      showToast(`Đã thêm mới mã sản phẩm "${cleanCode}" vào bảng "${category}" thành công!`);
    }

    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!productToDelete) return;
    const deletedCode = productToDelete.code;
    onDeleteProduct(productToDelete.id);
    setProductToDelete(null);
    showToast(`Đã xóa mã sản phẩm "${deletedCode}" khỏi bảng giá!`);
  };

  // Preset picker helper cho dòng Bo Viền & In Ấn & Album Mở Phẳng (Không khung)
  const applyProductPreset = (typeKey: 'in' | 'inep' | 'lv' | 'mk' | 'hd' | 'abmp') => {
    const presets = {
      in: {
        name: 'In Ảnh Kỹ Thuật Số',
        prefix: { 'GIÁ STUDIO': 'inST', 'Freelance': 'INFL', 'Khách Lẻ': 'INKL' },
        unit: 'tấm'
      },
      inep: {
        name: 'In Ép Mika',
        prefix: { 'GIÁ STUDIO': 'inepST', 'Freelance': 'inepFL', 'Khách Lẻ': 'inepKL' },
        unit: 'tấm'
      },
      lv: {
        name: 'Ảnh Lụa Viền Bo Viền',
        prefix: { 'GIÁ STUDIO': 'LVST', 'Freelance': 'LVFL', 'Khách Lẻ': 'LVKL' },
        unit: 'tấm'
      },
      mk: {
        name: 'Ảnh Mika Phổ Thông Bo Viền',
        prefix: { 'GIÁ STUDIO': 'MKST', 'Freelance': 'MKFL', 'Khách Lẻ': 'MKKL' },
        unit: 'tấm'
      },
      hd: {
        name: 'Ảnh HD Gương Siêu Bóng Bo Viền',
        prefix: { 'GIÁ STUDIO': 'HDST', 'Freelance': 'HDFL', 'Khách Lẻ': 'HDKL' },
        unit: 'tấm'
      },
      abmp: {
        name: 'Album Mở Phẳng 20x20 10 Tờ',
        prefix: { 'GIÁ STUDIO': 'ABMP20x20', 'Freelance': 'FL-ABMP20x20', 'Khách Lẻ': 'KL-ABMP20x20' },
        unit: 'cuốn'
      }
    };

    const targetPreset = presets[typeKey];
    const prefix = targetPreset.prefix[category] || targetPreset.prefix['GIÁ STUDIO'];
    const formattedName = category === 'GIÁ STUDIO'
      ? targetPreset.name
      : `${targetPreset.name} (${category})`;

    setName(formattedName);
    if (typeKey === 'abmp') {
      setSize('20x20');
      setCode(prefix);
      setUnit('cuốn');
      if (price === 0) {
        setPrice(category === 'Freelance' ? 350000 : category === 'Khách Lẻ' ? 440000 : 290000);
      }
    } else {
      setCode(size ? `${prefix}${size}` : prefix);
      setUnit(targetPreset.unit);
    }
  };

  // Preset picker helper cho dòng Ảnh Có Khung:
  // Lụa Khung (LK), Mika Khung (MK), HD Gương Khung (HD)
  // Kết hợp cùng 7 loại khung viền (K0-K3, K4-K6, K7-K9, K10, K11, Titan 1, Titan 2)
  const applyFramedProductPreset = (matKey: FramedMaterialKey, frameKey: FrameKey, targetSize?: string) => {
    setSelectedFramedMat(matKey);
    setSelectedFrame(frameKey);

    const currentSize = targetSize || size || '60*90';
    if (!size) {
      setSize(currentSize);
    }

    const mat = FRAMED_MATERIALS.find(m => m.key === matKey)!;
    const frame = FRAME_OPTIONS.find(f => f.key === frameKey)!;
    const pfx = mat.prefix[category] || mat.prefix['GIÁ STUDIO'];

    // Quy tắc sinh mã Tiệm In 194:
    // LKST60*90K456 (Studio), LKFL60*90K456 (Freelance), LKKL60*90K456 (Khách Lẻ)
    // Tương tự MKST60*90K456, HDST60*90K456, HDST60*90TT1...
    const newCode = `${pfx}${currentSize}${frame.suffix}`;

    // Tên chuẩn: Lụa Khung K4 K5 K6 / Lụa Khung K4 K5 K6 (Freelance)
    const baseName = `${mat.baseName} ${frame.name}`;
    const formattedName = category === 'GIÁ STUDIO' ? baseName : `${baseName} (${category})`;

    setName(formattedName);
    setCode(newCode);
    setUnit('tấm');

    // Tự động gợi ý giá tham khảo nếu đơn giá đang bằng 0
    if (price === 0) {
      setPrice(getEstimatedFramedPrice(matKey, frameKey, currentSize, category));
    }
  };

  const applyFramedMaterialOnly = (matKey: FramedMaterialKey) => {
    setSelectedFramedMat(matKey);
    applyFramedProductPreset(matKey, selectedFrame, size || '60*90');
  };

  const applyFrameOnly = (frameKey: FrameKey) => {
    setSelectedFrame(frameKey);
    applyFramedProductPreset(selectedFramedMat, frameKey, size || '60*90');
  };

  const applySizePreset = (selectedSize: string) => {
    setSize(selectedSize);

    // 1. Nếu đang chọn mẫu có khung ở modal
    if (presetTab === 'framed') {
      const mat = FRAMED_MATERIALS.find(m => m.key === selectedFramedMat) || FRAMED_MATERIALS[0];
      const frame = FRAME_OPTIONS.find(f => f.key === selectedFrame) || FRAME_OPTIONS[1];
      const pfx = mat.prefix[category] || mat.prefix['GIÁ STUDIO'];
      setCode(`${pfx}${selectedSize}${frame.suffix}`);
      if (price === 0) {
        setPrice(getEstimatedFramedPrice(mat.key, frame.key, selectedSize, category));
      }
      return;
    }

    // 2. Nếu mã đang có dạng có khung: LKST[size]K456, MKST[size]TT1, HDST[size]K0123...
    const matchFramed = code.match(/^(LK|MK|HD)(ST|FL|KL)([0-9*xX]+)?(K0123|K456|K789|K10|K11|TT1|TT2)$/i);
    if (matchFramed) {
      const pfxMat = matchFramed[1].toUpperCase();
      const pfxTier = matchFramed[2].toUpperCase();
      const suffix = matchFramed[4].toUpperCase();
      setCode(`${pfxMat}${pfxTier}${selectedSize}${suffix}`);
      return;
    }

    // 3. Nếu mã đang có tiền tố bo viền tiêu chuẩn
    const prefixes = ['inST', 'INFL', 'INKL', 'inepST', 'inepFL', 'inepKL', 'LVST', 'LVFL', 'LVKL', 'MKST', 'MKFL', 'MKKL', 'HDST', 'HDFL', 'HDKL'];
    for (const pfx of prefixes) {
      if (code.startsWith(pfx)) {
        setCode(`${pfx}${selectedSize}`);
        return;
      }
    }

    // 4. Nếu mã đang trống
    if (!code) {
      const defaultPfx = category === 'Freelance' ? 'INFL' : category === 'Khách Lẻ' ? 'INKL' : 'inST';
      setCode(`${defaultPfx}${selectedSize}`);
    }
  };

  // Filter products by active tab & search
  const filtered = useMemo(() => {
    return products.filter(p => {
      if (activeTab !== 'all' && activeTab !== 'compare' && p.category !== activeTab) {
        return false;
      }

      // Filter by core material (MDF vs Fomex vs Không cốt)
      if (materialFilter !== 'all') {
        const cType = getProductCoreType(p);
        if (cType !== materialFilter) return false;
      }

      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.size.toLowerCase().includes(q);
    });
  }, [products, activeTab, materialFilter, searchTerm]);

  // Comparison matrix data: group products by (clean base name + size)
  const comparisonMatrix = useMemo(() => {
    interface MatrixRow {
      key: string;
      baseName: string;
      size: string;
      coreType: ProductCoreType;
      studio?: Product;
      freelance?: Product;
      retail?: Product;
    }

    const map = new Map<string, MatrixRow>();

    // Helper to get base clean name
    const getCleanBase = (p: Product) => {
      let b = p.name
        .replace(/\((Freelance|Khách Lẻ|GIÁ STUDIO)\)/gi, '')
        .replace(/\(Cốt Fomex[^)]*\)/gi, '')
        .replace(/\(Cốt Gỗ MDF[^)]*\)/gi, '')
        .trim();
      return b;
    };

    products.forEach(p => {
      const baseName = getCleanBase(p);
      const key = `${baseName}__${p.size}`.toLowerCase();
      const coreType = getProductCoreType(p);

      if (!map.has(key)) {
        map.set(key, {
          key,
          baseName,
          size: p.size,
          coreType
        });
      }

      const row = map.get(key)!;
      if (p.category === 'GIÁ STUDIO') {
        row.studio = p;
      } else if (p.category === 'Freelance') {
        row.freelance = p;
      } else if (p.category === 'Khách Lẻ') {
        row.retail = p;
      }
    });

    let list = Array.from(map.values());

    if (materialFilter !== 'all') {
      list = list.filter(r => r.coreType === materialFilter);
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(r =>
        r.baseName.toLowerCase().includes(q) ||
        r.size.toLowerCase().includes(q) ||
        r.studio?.code.toLowerCase().includes(q) ||
        r.freelance?.code.toLowerCase().includes(q) ||
        r.retail?.code.toLowerCase().includes(q)
      );
    }

    return list;
  }, [products, materialFilter, searchTerm]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage('')} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-600" />
              Bảng Giá & Danh Mục Mã Sản Phẩm Tiệm In 194
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
              Tổng {products.length} mã
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Hệ thống phân loại thành <strong>3 Bảng Giá</strong> chuẩn cho 3 đối tượng khách chính của tiệm:{' '}
            <span className="text-indigo-700 font-bold">1. GIÁ STUDIO</span> •{' '}
            <span className="text-amber-700 font-bold">2. Freelance</span> •{' '}
            <span className="text-emerald-700 font-bold">3. Khách Lẻ</span>.{' '}
            <span className="text-slate-500 font-medium">
              (5 Dòng hàng: In ảnh, In ép mika, Lụa Viền, Mika Bo Viền, HD Gương Siêu Bóng bo viền).
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setIsBulkCopyModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            title="Sao chép toàn bộ sản phẩm ở 1. Studio sang 2. Freelance (+10% giá, thay mã ST -> FL)"
          >
            <Copy className="w-4 h-4 text-indigo-200" />
            Sao chép 1. Studio ➔ 2. Freelance (+10%)
          </button>

          <button
            onClick={() => {
              setPrintCategory(activeTab === 'Freelance' || activeTab === 'Khách Lẻ' || activeTab === 'GIÁ STUDIO' ? activeTab : 'GIÁ STUDIO');
              setIsPrintModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            title="In / Xuất file bảng giá cho khách hoặc thợ"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            In Bảng Giá
          </button>

          <button
            onClick={() => handleOpenAdd()}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Thêm mã sản phẩm mới
          </button>
        </div>
      </div>

      {/* 3 Price Tiers Tabs + Compare Mode */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {/* Tab 1: GIÁ STUDIO */}
        <button
          type="button"
          onClick={() => setActiveTab('GIÁ STUDIO')}
          className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer relative overflow-hidden ${
            activeTab === 'GIÁ STUDIO'
              ? 'bg-indigo-900 text-white border-indigo-900 shadow-md ring-2 ring-indigo-500/20'
              : 'bg-white hover:bg-indigo-50/40 text-slate-700 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
              activeTab === 'GIÁ STUDIO' ? 'text-indigo-300' : 'text-indigo-700'
            }`}>
              <Building2 className="w-4 h-4" /> 1. GIÁ STUDIO
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
              activeTab === 'GIÁ STUDIO' ? 'bg-indigo-300 text-indigo-950' : 'bg-indigo-100 text-indigo-800'
            }`}>
              {studioCount} mã
            </span>
          </div>
          <p className={`text-[11px] mt-1.5 line-clamp-1 ${activeTab === 'GIÁ STUDIO' ? 'text-indigo-200' : 'text-slate-500'}`}>
            Studio áo cưới & Đại lý sỉ (inST, inepST, LVST...)
          </p>
        </button>

        {/* Tab 2: Freelance */}
        <button
          type="button"
          onClick={() => setActiveTab('Freelance')}
          className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer relative overflow-hidden ${
            activeTab === 'Freelance'
              ? 'bg-amber-900 text-white border-amber-900 shadow-md ring-2 ring-amber-500/20'
              : 'bg-white hover:bg-amber-50/40 text-slate-700 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
              activeTab === 'Freelance' ? 'text-amber-300' : 'text-amber-800'
            }`}>
              <Camera className="w-4 h-4" /> 2. Freelance
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
              activeTab === 'Freelance' ? 'bg-amber-300 text-amber-950' : 'bg-amber-100 text-amber-800'
            }`}>
              {freelanceCount} mã
            </span>
          </div>
          <p className={`text-[11px] mt-1.5 line-clamp-1 ${activeTab === 'Freelance' ? 'text-amber-200' : 'text-slate-500'}`}>
            Thợ chụp tự do (+10% giá Studio, INFL, inepFL...)
          </p>
        </button>

        {/* Tab 3: Khách Lẻ */}
        <button
          type="button"
          onClick={() => setActiveTab('Khách Lẻ')}
          className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer relative overflow-hidden ${
            activeTab === 'Khách Lẻ'
              ? 'bg-emerald-900 text-white border-emerald-900 shadow-md ring-2 ring-emerald-500/20'
              : 'bg-white hover:bg-emerald-50/40 text-slate-700 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
              activeTab === 'Khách Lẻ' ? 'text-emerald-300' : 'text-emerald-800'
            }`}>
              <User className="w-4 h-4" /> 3. Khách Lẻ
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
              activeTab === 'Khách Lẻ' ? 'bg-emerald-300 text-emerald-950' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {retailCount} mã
            </span>
          </div>
          <p className={`text-[11px] mt-1.5 line-clamp-1 ${activeTab === 'Khách Lẻ' ? 'text-emerald-200' : 'text-slate-500'}`}>
            Khách lẻ in gia đình (INKL, inepKL, LVKL...)
          </p>
        </button>

        {/* Tab 4: So Sánh 3 Bảng Giá */}
        <button
          type="button"
          onClick={() => setActiveTab('compare')}
          className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer relative overflow-hidden ${
            activeTab === 'compare'
              ? 'bg-purple-900 text-white border-purple-900 shadow-md ring-2 ring-purple-500/20'
              : 'bg-white hover:bg-purple-50/40 text-slate-700 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
              activeTab === 'compare' ? 'text-purple-300' : 'text-purple-700'
            }`}>
              <BarChart3 className="w-4 h-4" /> So Sánh Giá
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'compare' ? 'bg-purple-300 text-purple-950' : 'bg-purple-100 text-purple-800'
            }`}>
              3 Cấp
            </span>
          </div>
          <p className={`text-[11px] mt-1.5 line-clamp-1 ${activeTab === 'compare' ? 'text-purple-200' : 'text-slate-500'}`}>
            Đối chiếu Studio - FL - Khách Lẻ
          </p>
        </button>

        {/* Tab 5: Tất cả */}
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer relative overflow-hidden ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider">Tất Cả Mã</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
              activeTab === 'all' ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 text-slate-700'
            }`}>
              {products.length}
            </span>
          </div>
          <p className={`text-[11px] mt-1.5 line-clamp-1 ${activeTab === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
            Toàn bộ danh mục kho
          </p>
        </button>
      </div>

      {/* Active Tab Notice & Core Material Note */}
      {activeTab === 'GIÁ STUDIO' && (
        <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-900">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-700 shrink-0" />
            <span>
              <strong>BẢNG GIÁ STUDIO:</strong> Đã chốt số lượng ({studioCount} sản phẩm) và giá niêm yết. Toàn bộ danh mục đã sẵn sàng để sao chép sang <strong>2. Freelance</strong> với giá tăng 10% và mã đổi ST ➔ FL.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsBulkCopyModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-indigo-200" />
              Sao chép sang Freelance (+10%)
            </button>
            <span className="font-mono font-bold text-indigo-800 bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-300">
              {studioCount} mã
            </span>
          </div>
        </div>
      )}

      {activeTab === 'Freelance' && (
        <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>BẢNG GIÁ FREELANCE:</strong> Toàn bộ sản phẩm được sao chép đồng bộ từ 1. Studio với <strong>giá tăng đúng 10%</strong> và mã sản phẩm được chuyển đổi phù hợp (thay thế <strong>ST ➔ FL</strong>).
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsBulkCopyModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-amber-100" />
              Đồng bộ lại từ Studio (+10%)
            </button>
            <span className="font-mono font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300">
              {freelanceCount} mã
            </span>
          </div>
        </div>
      )}

      {activeTab === 'Khách Lẻ' && (
        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              <strong>BẢNG GIÁ KHÁCH LẺ:</strong> Đơn giá in ảnh bán lẻ tiêu chuẩn cho gia đình và sự kiện (Mã chuẩn: INKL, inepKL, LVKL, MKKL, HDKL).
            </span>
          </div>
          <span className="font-mono font-bold text-emerald-900 shrink-0 bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-300">
            {retailCount} sản phẩm áp dụng
          </span>
        </div>
      )}

      {activeTab === 'compare' && (
        <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-purple-900">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-700 shrink-0" />
            <span>
              <strong>MA TRẬN SO SÁNH 3 CẤP GIÁ:</strong> Đối chiếu trực quan đơn giá từng kích thước giữa GIÁ STUDIO, Freelance và Khách Lẻ để quản lý tỉ lệ lợi nhuận.
            </span>
          </div>
          <span className="font-bold text-purple-800 shrink-0 bg-purple-100 px-2 py-0.5 rounded-lg border border-purple-300">
            {comparisonMatrix.length} dòng quy cách
          </span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo mã (inST60*90, inepST, LVST, MKST, HDST...), tên hàng hoặc kích thước (60*90, 20*30)..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        {/* Filter by Material Core: Tất cả vs Cốt Gỗ MDF vs Cốt Fomex vs Không Cốt */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setMaterialFilter('all')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              materialFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả cốt ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setMaterialFilter('mdf')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              materialFilter === 'mdf'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
            title="Dòng ảnh dùng cốt Ván MDF: Lụa Viền, Mika Phổ Thông, Ép Gỗ..."
          >
            🪵 Cốt Gỗ MDF ({mdfCount})
          </button>
          <button
            type="button"
            onClick={() => setMaterialFilter('fomex')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              materialFilter === 'fomex'
                ? 'bg-sky-700 text-white shadow-xs'
                : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
            }`}
            title="Dòng ảnh 4K & HD Pro dùng Cốt Fomex siêu nhẹ dạng 9 li"
          >
            ✨ Cốt Fomex 9li ({fomexCount})
          </button>
          <button
            type="button"
            onClick={() => setMaterialFilter('none')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              materialFilter === 'none'
                ? 'bg-slate-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            title="In và In Ép Mika: Không dùng cốt gỗ MDF (bỏ trống cốt)"
          >
            🚫 Không cốt ({noneCoreCount})
          </button>
        </div>
      </div>

      {/* Quick filter keywords chips */}
      <div className="flex items-center gap-1.5 flex-wrap text-[11px] px-1 -mt-1">
        <span className="text-slate-400 font-medium">Lọc nhanh theo dòng:</span>
        {[
          { label: '🌸 Lụa Khung (LK)', query: 'LK' },
          { label: '🪞 Mika Khung (MK)', query: 'MK' },
          { label: '✨ HD Gương Khung (HD)', query: 'HD' },
          { label: '🖼️ Khung K4 K5 K6', query: 'K456' },
          { label: '🖼️ Khung K0 K1 K2 K3', query: 'K0123' },
          { label: '🖼️ Khung K7 K8 K9', query: 'K789' },
          { label: '🖼️ Khung K10 / K11', query: 'K10' },
          { label: '🛡️ Khung Titan', query: 'TT' },
          { label: '📖 Album Mở Phẳng', query: 'Album Mở Phẳng' },
          { label: '🔩 Khung Gia Cố (NEPST)', query: 'NEPST' },
        ].map(item => (
          <button
            key={item.query}
            type="button"
            onClick={() => setSearchTerm(searchTerm === item.query ? '' : item.query)}
            className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
              searchTerm === item.query
                ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs font-bold'
                : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="text-red-600 hover:underline font-bold text-[11px] ml-1 cursor-pointer"
          >
            ✕ Xóa tìm kiếm
          </button>
        )}
      </div>

      {/* Main Content: Either Comparison Matrix OR Standard Table */}
      {activeTab === 'compare' ? (
        /* ======================================================== */
        /* SO SÁNH 3 BẢNG GIÁ (COMPARISON MATRIX)                   */
        /* ======================================================== */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3 w-12 text-center">STT</th>
                  <th className="py-2.5 px-3">Quy cách ảnh & Tên dòng sản phẩm</th>
                  <th className="py-2.5 px-3 text-center w-28">Kích thước</th>
                  <th className="py-2.5 px-3 text-center w-40">Cốt vật liệu</th>
                  <th className="py-2.5 px-3 text-right w-44 bg-indigo-50/70 text-indigo-900 border-l border-indigo-100">
                    <div className="flex items-center justify-end gap-1">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>1. GIÁ STUDIO</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 text-right w-48 bg-amber-50/70 text-amber-900 border-l border-amber-100">
                    <div className="flex items-center justify-end gap-1">
                      <Camera className="w-3.5 h-3.5 text-amber-600" />
                      <span>2. Freelance</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 text-right w-48 bg-emerald-50/70 text-emerald-900 border-l border-emerald-100">
                    <div className="flex items-center justify-end gap-1">
                      <User className="w-3.5 h-3.5 text-emerald-600" />
                      <span>3. Khách Lẻ</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {comparisonMatrix.map((row, idx) => {
                  const studioPrice = row.studio?.price || 0;
                  const freelancePrice = row.freelance?.price || 0;
                  const retailPrice = row.retail?.price || 0;

                  const freelanceDiff = studioPrice > 0 && freelancePrice > 0
                    ? Math.round(((freelancePrice - studioPrice) / studioPrice) * 100)
                    : null;
                  const retailDiff = studioPrice > 0 && retailPrice > 0
                    ? Math.round(((retailPrice - studioPrice) / studioPrice) * 100)
                    : null;

                  return (
                    <tr key={row.key} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {row.baseName}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700 bg-slate-50">
                        {row.size}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {(() => {
                            const repProd = row.studio || row.freelance || row.retail;
                            const explicitCode = repProd?.materialCoreCode;
                            if (explicitCode) {
                              const upper = explicitCode.toUpperCase().trim();
                              if (upper === 'NONE' || upper === 'KHONG' || upper === 'KHONG_COT') {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                                    🚫 Không cốt (NONE)
                                  </span>
                                );
                              }
                              const isFomex = upper.includes('FOMEX') || (repProd.materialCoreName && repProd.materialCoreName.toLowerCase().includes('fomex'));
                              return (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${isFomex ? 'bg-sky-50 text-sky-800 border-sky-300' : 'bg-amber-50 text-amber-900 border-amber-300'}`}>
                                  <span>{isFomex ? '✨' : '🪵'}</span>
                                  <span className="font-mono font-bold">{explicitCode}</span>
                                </span>
                              );
                            }
                            if (row.coreType === 'none') {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200" title="In & In ép không dùng cốt gỗ MDF (bỏ trống)">
                                  — Không dùng cốt
                                </span>
                              );
                            }
                            if (row.coreType === 'fomex') {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200" title="Chỉ dùng cho Ảnh 4K & HD Pro: Cốt Fomex siêu nhẹ dạng 9 li">
                                  ✨ Fomex 9li (4K/HD)
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200" title="HD gương siêu bóng, lụa viền & mika dùng cốt Gỗ MDF">
                                🪵 Gỗ MDF
                              </span>
                            );
                          })()}
                          {(() => {
                            const repProd = row.studio || row.freelance || row.retail;
                            if (!repProd) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => handleOpenQuickCore(repProd)}
                                className="p-1 text-slate-400 hover:text-amber-800 hover:bg-amber-100 rounded-md transition cursor-pointer"
                                title="Gán / Nhập thủ công mã cốt vật tư tương thích cho dòng sản phẩm này"
                              >
                                <Settings className="w-3.5 h-3.5" />
                              </button>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Giá Studio */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-900 bg-indigo-50/30 border-l border-indigo-100">
                        {row.studio ? (
                          <div>
                            <div>{formatCurrency(row.studio.price)}</div>
                            <span className="text-[10px] font-semibold text-indigo-600 font-mono">[{row.studio.code}]</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Giá Freelance */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-900 bg-amber-50/30 border-l border-amber-100">
                        {row.freelance ? (
                          <div>
                            <div className="flex items-center justify-end gap-1.5">
                              <span>{formatCurrency(row.freelance.price)}</span>
                              {freelanceDiff !== null && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900">
                                  +{freelanceDiff}%
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-semibold text-amber-700 font-mono">[{row.freelance.code}]</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Giá Khách Lẻ */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-900 bg-emerald-50/30 border-l border-emerald-100">
                        {row.retail ? (
                          <div>
                            <div className="flex items-center justify-end gap-1.5">
                              <span>{formatCurrency(row.retail.price)}</span>
                              {retailDiff !== null && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-200/80 text-emerald-900">
                                  +{retailDiff}%
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-700 font-mono">[{row.retail.code}]</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {comparisonMatrix.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                      Không tìm thấy mặt hàng nào phù hợp với điều kiện tìm kiếm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ======================================================== */
        /* BẢNG GIÁ CHI TIẾT THEO PHÂN LOẠI (SINGLE TIER TABLE)     */
        /* ======================================================== */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3 w-12 text-center">STT</th>
                  <th className="py-2.5 px-3 w-36 text-amber-900 font-mono">Mã sản phẩm</th>
                  <th className="py-2.5 px-3">Tên hàng hóa / Quy cách hoàn thiện</th>
                  <th className="py-2.5 px-3 text-center w-28">Kích thước</th>
                  <th className="py-2.5 px-3 text-center w-52 text-amber-950">
                    <span className="flex items-center justify-center gap-1">
                      <Boxes className="w-3.5 h-3.5 text-amber-700" />
                      Cốt vật tư (Kho)
                    </span>
                  </th>
                  <th className="py-2.5 px-3 text-center w-36">Phân loại bảng giá</th>
                  <th className="py-2.5 px-3 text-right w-36">Đơn giá áp dụng</th>
                  <th className="py-2.5 px-3 text-center w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((prod, idx) => {
                  const coreType = getProductCoreType(prod);

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-950 bg-amber-50/40">
                        {prod.code}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {prod.name}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700 bg-slate-50">
                        {prod.size}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {(() => {
                            if (prod.materialCoreCode) {
                              const upper = prod.materialCoreCode.toUpperCase().trim();
                              if (upper === 'NONE' || upper === 'KHONG' || upper === 'KHONG_COT') {
                                return (
                                  <span
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300 shadow-2xs"
                                    title="Sản phẩm này cấu hình KHÔNG DÙNG CỐT VÁN (Bỏ trống cốt, không trừ kho)"
                                  >
                                    🚫 Không cốt (NONE)
                                  </span>
                                );
                              }
                              const matched = materials.find(m => m.code.toUpperCase() === upper || m.id === prod.materialCoreId);
                              const isFomex = upper.includes('FOMEX') || (prod.materialCoreName && prod.materialCoreName.toLowerCase().includes('fomex'));
                              return (
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs ${
                                    isFomex
                                      ? 'bg-sky-50 text-sky-800 border-sky-300'
                                      : 'bg-amber-50 text-amber-900 border-amber-300'
                                  }`}
                                  title={matched ? `${matched.name} (Tồn kho: ${matched.stockQuantity} ${matched.unit})` : prod.materialCoreName || prod.materialCoreCode}
                                >
                                  <span>{isFomex ? '✨' : '🪵'}</span>
                                  <span className="font-mono font-black">{prod.materialCoreCode}</span>
                                  {matched && (
                                    <span className="text-[9px] text-slate-500 font-normal">
                                      ({matched.stockQuantity} {matched.unit})
                                    </span>
                                  )}
                                </span>
                              );
                            }

                            // Chưa cấu hình thủ công -> hiển thị theo quy chuẩn tự động
                            if (coreType === 'none') {
                              return (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200"
                                  title="In và In ép không dùng cốt gỗ MDF (bỏ trống)"
                                >
                                  — Không cốt
                                </span>
                              );
                            }
                            if (coreType === 'fomex') {
                              return (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50/70 text-sky-700 border border-dashed border-sky-300"
                                  title="Tự động bóc tách Fomex 9li theo quy cách"
                                >
                                  ✨ Fomex 9li (Tự động)
                                </span>
                              );
                            }
                            return (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50/70 text-amber-800 border border-dashed border-amber-300"
                                title="Tự động bóc tách Ván MDF theo quy cách"
                              >
                                🪵 Ván MDF (Tự động)
                              </span>
                            );
                          })()}

                          {/* Nút bấm chỉnh sửa/gán nhanh mã cốt vật tư tương thích */}
                          <button
                            type="button"
                            onClick={() => handleOpenQuickCore(prod)}
                            className="p-1 text-slate-400 hover:text-amber-800 hover:bg-amber-100 rounded-md transition cursor-pointer"
                            title="Gán / Nhập thủ công mã cốt vật tư tương thích cho mã này"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {prod.category === 'GIÁ STUDIO' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Building2 className="w-3 h-3 text-indigo-600" /> GIÁ STUDIO
                          </span>
                        ) : prod.category === 'Freelance' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Camera className="w-3 h-3 text-amber-600" /> Freelance
                          </span>
                        ) : prod.category === 'Khách Lẻ' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <User className="w-3 h-3 text-emerald-600" /> Khách Lẻ
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                            {prod.category}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        {formatCurrency(prod.price)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenClone(prod)}
                            className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            title="Nhân bản sang bảng giá khác (Copy & điều chỉnh giá)"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(prod)}
                            className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-100/70 rounded-lg transition cursor-pointer"
                            title="Sửa mã sản phẩm"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductToDelete(prod)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100/70 rounded-lg transition cursor-pointer"
                            title={`Xóa mã sản phẩm ${prod.code}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                      Không tìm thấy mã sản phẩm nào trong phân loại này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PRINTABLE PRICE SHEET MODAL                             */}
      {/* ======================================================== */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm">
                    In Bảng Giá Tiệm In 194
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Bản in chính thức gửi Studio, Thợ chụp Freelance hoặc Khách lẻ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Filter print category selector */}
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 flex-wrap">
              <span className="text-xs font-bold text-slate-700">Chọn bảng giá cần in:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPrintCategory('GIÁ STUDIO')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    printCategory === 'GIÁ STUDIO' ? 'bg-indigo-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  1. GIÁ STUDIO ({studioCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPrintCategory('Freelance')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    printCategory === 'Freelance' ? 'bg-amber-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  2. Freelance ({freelanceCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPrintCategory('Khách Lẻ')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    printCategory === 'Khách Lẻ' ? 'bg-emerald-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  3. Khách Lẻ ({retailCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPrintCategory('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    printCategory === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Tất cả 3 bảng ({products.length})
                </button>
              </div>
            </div>

            {/* Printable Paper View */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 font-sans print:p-0 print:bg-white">
              <div className="max-w-3xl mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-xs border border-slate-200 print:border-none print:shadow-none print:p-0">
                {/* Brand Header */}
                <div className="border-b-2 border-slate-900 pb-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-tight">
                      {DEFAULT_WORKSHOP_INFO.name}
                    </h1>
                    <p className="text-xs font-medium text-slate-600 mt-0.5">
                      {DEFAULT_WORKSHOP_INFO.subtitle}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Địa chỉ: {DEFAULT_WORKSHOP_INFO.address}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Hotline/Zalo: <strong>{DEFAULT_WORKSHOP_INFO.hotline}</strong> • {DEFAULT_WORKSHOP_INFO.phone}
                    </p>
                  </div>

                  <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                    <span className="inline-block px-3 py-1 bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-lg mb-1">
                      BẢNG BÁO GIÁ ÁP DỤNG
                    </span>
                    <h2 className="text-base font-black text-slate-900">
                      {printCategory === 'all' ? 'TỔNG HỢP 3 BẢNG GIÁ TIỆM IN' : `BẢNG ${printCategory.toUpperCase()}`}
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Cập nhật: {new Date().toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>

                {/* Products Table */}
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold">
                      <th className="py-2 px-2.5 w-10 text-center">STT</th>
                      <th className="py-2 px-2.5 w-28 font-mono">Mã số</th>
                      <th className="py-2 px-2.5">Quy cách sản phẩm</th>
                      <th className="py-2 px-2.5 text-center w-24">Khổ ảnh</th>
                      <th className="py-2 px-2.5 text-center w-32">Cốt vật liệu</th>
                      {printCategory === 'all' && (
                        <th className="py-2 px-2.5 text-center w-24">Bảng giá</th>
                      )}
                      <th className="py-2 px-2.5 text-right w-28">Đơn giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {products
                      .filter(p => printCategory === 'all' || p.category === printCategory)
                      .map((p, idx) => {
                        const ct = getProductCoreType(p);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-2 px-2.5 text-center text-slate-500 font-mono">{idx + 1}</td>
                            <td className="py-2 px-2.5 font-mono font-bold text-slate-900">{p.code}</td>
                            <td className="py-2 px-2.5 font-semibold text-slate-800">{p.name}</td>
                            <td className="py-2 px-2.5 text-center font-bold text-slate-700">{p.size}</td>
                            <td className="py-2 px-2.5 text-center text-[11px]">
                              {ct === 'none' ? '— (Không cốt)' : ct === 'fomex' ? 'Fomex 9li (4K/HD Pro)' : 'Ván Gỗ MDF'}
                            </td>
                            {printCategory === 'all' && (
                              <td className="py-2 px-2.5 text-center text-[10px] font-bold">
                                {p.category}
                              </td>
                            )}
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-800">
                              {formatCurrency(p.price)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>

                {/* Footer notes & Bank account */}
                <div className="mt-6 pt-4 border-t-2 border-slate-200 text-xs text-slate-600 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="font-bold text-slate-900 mb-1">Thời gian phục vụ:</p>
                      <p className="font-bold text-red-600">Thời gian làm việc từ 8H - 20h Từ thứ 2 đến thứ 7</p>
                      <p className="text-slate-500 mt-1">Hotline / Zalo hỗ trợ: <strong>{DEFAULT_WORKSHOP_INFO.hotline}</strong></p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="font-bold text-slate-900 mb-1">Chính sách & Cam kết:</p>
                      <p>• In ảnh sắc nét chuẩn màu máy Lab & máy Epson chuyên dụng.</p>
                      <p>• Cốt gỗ MDF lõi xanh chống ẩm / Cốt Fomex 9li siêu nhẹ cao cấp.</p>
                      <p>• Giao nhận tận nơi theo xe khách hoặc dịch vụ chuyển phát nhanh.</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-center text-slate-400 pt-2 italic">
                    Cảm ơn Quý khách hàng & Quý Studio đã luôn đồng hành cùng {DEFAULT_WORKSHOP_INFO.name}!
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                In Bảng Giá Ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CLONE PRODUCT MODAL (NHÂN BẢN SANG BẢNG GIÁ KHÁCH HÀNG)   */}
      {/* ======================================================== */}
      {cloneModalOpen && sourceProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Copy className="w-5 h-5 text-indigo-300" />
                <div>
                  <h3 className="font-bold text-sm">Nhân Bản Sang Bảng Giá Khác</h3>
                  <p className="text-[11px] text-indigo-200">Tạo mã tương ứng cho đối tượng khách mới</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCloneModalOpen(false)}
                className="text-indigo-300 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3.5">
              {/* Source Product Info */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Sản phẩm gốc:</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">
                    {sourceProduct.code}
                  </span>
                  <span className="font-bold text-slate-800">{sourceProduct.name}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Khổ {sourceProduct.size} • Bảng: <strong>{sourceProduct.category}</strong></span>
                  <span className="font-mono font-bold text-emerald-700">{formatCurrency(sourceProduct.price)}</span>
                </div>
              </div>

              {/* Target Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nhân bản sang bảng giá *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTargetCategoryChange('GIÁ STUDIO')}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition cursor-pointer ${
                      targetCategory === 'GIÁ STUDIO'
                        ? 'bg-indigo-900 text-white border-indigo-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    GIÁ STUDIO
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTargetCategoryChange('Freelance')}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition cursor-pointer ${
                      targetCategory === 'Freelance'
                        ? 'bg-amber-900 text-white border-amber-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Freelance
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTargetCategoryChange('Khách Lẻ')}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition cursor-pointer ${
                      targetCategory === 'Khách Lẻ'
                        ? 'bg-emerald-900 text-white border-emerald-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Khách Lẻ
                  </button>
                </div>
              </div>

              {/* Target Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã sản phẩm mới (Tự động chuẩn hóa theo quy tắc) *
                </label>
                <input
                  type="text"
                  value={targetCode}
                  onChange={(e) => setTargetCode(e.target.value)}
                  className="w-full px-3 py-2 font-mono font-bold text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              {/* Quick Markup Helpers */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Tỉ lệ điều chỉnh giá so với gốc (%):
                  </label>
                  <span className="font-mono font-bold text-xs text-indigo-700">
                    {targetMarkupPercent >= 0 ? `+${targetMarkupPercent}%` : `${targetMarkupPercent}%`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[-15, 0, 15, 20, 25, 30, 40, 50].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleMarkupChange(pct)}
                      className={`px-2 py-1 text-[11px] font-bold rounded-lg border cursor-pointer ${
                        targetMarkupPercent === pct
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {pct >= 0 ? `+${pct}%` : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Price */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Đơn giá mới (VNĐ) *
                </label>
                <MoneyInput
                  value={targetPrice}
                  onChange={(val) => setTargetPrice(val)}
                  placeholder="0"
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-amber-500"
                  showWords={true}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCloneModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveClone}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-600 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Tạo Mã Sản Phẩm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DELETE CONFIRMATION MODAL                                */}
      {/* ======================================================== */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-red-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-white/20 rounded-lg">
                  <Trash2 className="w-5 h-5 text-white" />
                </span>
                <h3 className="font-bold text-sm">Xóa Mã Sản Phẩm</h3>
              </div>
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600">
                Bạn có chắc chắn muốn xóa mã sản phẩm này khỏi bảng giá?
              </p>
              <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Mã sản phẩm:</span>
                  <span className="font-mono font-extrabold text-sm text-red-700 bg-red-100 px-2 py-0.5 rounded">
                    {productToDelete.code}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Tên hàng:</span>
                  <span className="font-bold text-slate-900">{productToDelete.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Bảng giá:</span>
                  <span className="font-bold text-slate-800">{productToDelete.category}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Kích thước:</span>
                  <span className="font-bold text-slate-700">{productToDelete.size}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Đơn giá:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatCurrency(productToDelete.price)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ADD / EDIT PRODUCT MODAL */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  {editingProduct ? 'Chỉnh Sửa Mã Sản Phẩm' : 'Thêm Mã Sản Phẩm Mới'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Phân loại theo 3 bảng giá và 5 dòng sản phẩm chủ lực
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Error Message inside modal */}
            {modalError && (
              <div className="mx-4 mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
              {/* Category picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  1. Phân loại bảng giá áp dụng *
                </label>
                <select
                  value={category}
                  onChange={(e) => {
                    const newCat = e.target.value as ProductCategory;
                    setCategory(newCat);
                    if (code) {
                      setCode(convertProductCodeForTier(code, newCat));
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-hidden focus:ring-2 focus:ring-amber-500 bg-amber-50/30"
                >
                  <option value="GIÁ STUDIO">🏢 1. GIÁ STUDIO (Studio áo cưới & Đại lý sỉ)</option>
                  <option value="Freelance">📸 2. Freelance (Thợ chụp ảnh tự do & Quay phim)</option>
                  <option value="Khách Lẻ">👤 3. Khách Lẻ (Khách lẻ in gia đình & Tiệc)</option>
                </select>
              </div>

              {/* Quick Preset Buttons for Framed & Unframed lines */}
              {!editingProduct && (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      Chọn nhanh mẫu sản phẩm & mã quy chuẩn:
                    </span>
                    <div className="flex items-center bg-slate-200 p-0.5 rounded-xl text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setPresetTab('framed')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                          presetTab === 'framed'
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>🖼️ Dòng Có Khung</span>
                        <span className="text-[9px] px-1 py-0.2 bg-slate-950/20 text-slate-900 rounded-full font-bold">Mới</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPresetTab('unframed')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          presetTab === 'unframed'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        📄 Bo Viền & In
                      </button>
                    </div>
                  </div>

                  {/* TAB 1: DÒNG ẢNH CÓ KHUNG (Lụa Khung, Mika Khung, HD Gương Khung) */}
                  {presetTab === 'framed' && (
                    <div className="space-y-3 pt-0.5">
                      {/* Bước A: Chọn chất liệu ảnh */}
                      <div>
                        <div className="text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                          <span>A. Chọn chất liệu mặt ảnh có khung:</span>
                          <span className="text-[10px] text-amber-700 font-semibold">(Cốt Ván Gỗ MDF)</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {FRAMED_MATERIALS.map(m => {
                            const isSelected = selectedFramedMat === m.key;
                            const pfx = m.prefix[category] || m.prefix['GIÁ STUDIO'];
                            return (
                              <button
                                key={m.key}
                                type="button"
                                onClick={() => applyFramedMaterialOnly(m.key)}
                                className={`p-2 rounded-xl border text-left transition cursor-pointer relative ${
                                  isSelected
                                    ? 'bg-amber-50 border-amber-500 shadow-xs ring-2 ring-amber-500/20'
                                    : 'bg-white hover:bg-slate-100 border-slate-300'
                                }`}
                              >
                                <div className="font-black text-xs text-slate-900">{m.title}</div>
                                <div className="text-[10px] font-mono text-amber-700 font-bold mt-0.5">
                                  Mã: {pfx}...
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bước B: Chọn 1 trong 7 loại khung viền dùng chung */}
                      <div>
                        <div className="text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                          <span>B. Chọn loại khung viền (7 loại dùng chung theo yêu cầu):</span>
                          <span className="text-[10px] text-slate-400">Hậu tố mã</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {FRAME_OPTIONS.map(f => {
                            const isSelected = selectedFrame === f.key;
                            return (
                              <button
                                key={f.key}
                                type="button"
                                onClick={() => applyFrameOnly(f.key)}
                                className={`px-2 py-1.5 rounded-xl border text-left transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                    : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                                }`}
                              >
                                <div className="text-[11px] font-bold truncate">{f.label}</div>
                                <div className={`text-[10px] font-mono font-bold ${isSelected ? 'text-amber-400' : 'text-slate-500'}`}>
                                  Đuôi: {f.suffix}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Thẻ xem trước kết quả sinh mã tức thời */}
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] text-amber-800 font-bold block uppercase tracking-wider">
                            Mẫu đang chọn:
                          </span>
                          <span className="font-bold text-slate-900">
                            {name || 'Chưa chọn'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-amber-800 font-bold block uppercase tracking-wider">
                            Mã tự sinh ({category}):
                          </span>
                          <span className="font-mono font-black text-amber-900 text-sm">
                            {code || '---'}
                          </span>
                        </div>
                      </div>

                      {/* Gợi ý 21 mẫu nhanh 1-Click */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAllFramedPresets(!showAllFramedPresets)}
                          className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
                        >
                          <span>{showAllFramedPresets ? '▼ Ẩn danh sách 21 mẫu gợi ý 1-Click' : '▶ Xem nhanh 21 mẫu sản phẩm có khung (Click điền ngay)'}</span>
                        </button>

                        {showAllFramedPresets && (
                          <div className="mt-2 p-2.5 bg-white rounded-xl border border-slate-200 space-y-2 max-h-48 overflow-y-auto">
                            {FRAMED_MATERIALS.map(m => {
                              const pfx = m.prefix[category] || m.prefix['GIÁ STUDIO'];
                              return (
                                <div key={m.key} className="space-y-1">
                                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    {m.title} ({m.short}):
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                                    {FRAME_OPTIONS.map(f => {
                                      const sampleCode = `${pfx}${size || '60*90'}${f.suffix}`;
                                      const isCurrent = selectedFramedMat === m.key && selectedFrame === f.key;
                                      return (
                                        <button
                                          key={f.key}
                                          type="button"
                                          onClick={() => applyFramedProductPreset(m.key, f.key)}
                                          className={`px-2 py-1 text-[10px] rounded-lg border text-left cursor-pointer transition flex items-center justify-between ${
                                            isCurrent
                                              ? 'bg-amber-100 border-amber-500 text-amber-950 font-bold'
                                              : 'bg-slate-50 hover:bg-amber-50/50 border-slate-200 text-slate-700'
                                          }`}
                                          title={`Bấm để chọn nhanh ${m.title} ${f.name}`}
                                        >
                                          <span className="truncate">{m.short} {f.label}</span>
                                          <span className="font-mono text-[9px] text-slate-400 shrink-0 ml-1">
                                            {f.suffix}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: DÒNG BO VIỀN & IN ẤN TIÊU CHUẨN */}
                  {presetTab === 'unframed' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => applyProductPreset('in')}
                        className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-300 bg-white hover:bg-amber-50 hover:border-amber-400 text-slate-800 text-left transition cursor-pointer"
                      >
                        <div>1. In Ảnh</div>
                        <span className="text-[9px] text-slate-400 font-normal">inST / INFL (Không cốt)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyProductPreset('inep')}
                        className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-300 bg-white hover:bg-amber-50 hover:border-amber-400 text-slate-800 text-left transition cursor-pointer"
                      >
                        <div>2. In Ép Mika</div>
                        <span className="text-[9px] text-slate-400 font-normal">inepST / inepFL (Không cốt)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyProductPreset('lv')}
                        className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-300 bg-white hover:bg-amber-50 hover:border-amber-400 text-slate-800 text-left transition cursor-pointer"
                      >
                        <div>3. Lụa Viền</div>
                        <span className="text-[9px] text-amber-700 font-normal">LVST / LVFL (Gỗ MDF)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyProductPreset('mk')}
                        className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-300 bg-white hover:bg-amber-50 hover:border-amber-400 text-slate-800 text-left transition cursor-pointer"
                      >
                        <div>4. Mika Bo Viền</div>
                        <span className="text-[9px] text-amber-700 font-normal">MKST / MKFL (Gỗ MDF)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyProductPreset('hd')}
                        className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-300 bg-white hover:bg-amber-50 hover:border-amber-400 text-slate-800 text-left transition cursor-pointer"
                      >
                        <div>5. HD Siêu Bóng</div>
                        <span className="text-[9px] text-amber-700 font-normal">HDST / HDFL (Gỗ MDF)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyProductPreset('abmp')}
                        className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-300 bg-white hover:bg-amber-50 hover:border-amber-400 text-slate-800 text-left transition cursor-pointer"
                      >
                        <div>6. Album Mở Phẳng</div>
                        <span className="text-[9px] text-slate-400 font-normal">ABMP (Không cốt)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 15 Standard Size Quick Buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  2. Chọn kích thước chuẩn (15 cỡ ảnh xưởng in 194):
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {STANDARD_PHOTO_SIZES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => applySizePreset(s)}
                      className={`px-2 py-1 text-[11px] font-mono font-bold rounded-lg border cursor-pointer transition ${
                        size === s
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                  {/* Cỡ Album mở phẳng nhanh */}
                  {['20x20', '20x30', '30x30'].map(albumSize => (
                    <button
                      key={albumSize}
                      type="button"
                      onClick={() => applySizePreset(albumSize)}
                      className={`px-2 py-1 text-[11px] font-mono font-bold rounded-lg border cursor-pointer transition ${
                        size === albumSize
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                      }`}
                      title={`Kích thước Album mở phẳng ${albumSize}`}
                    >
                      📖 {albumSize}
                    </button>
                  ))}
                </div>
              </div>

              {/* Code & Size */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã sản phẩm *
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="VD: inST60*90, LVST60*90..."
                    className="w-full px-3 py-2 font-mono font-bold border border-slate-300 rounded-xl text-xs outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kích thước *
                  </label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="60*90"
                    className="w-full px-3 py-2 text-center font-bold border border-slate-300 rounded-xl text-xs outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên sản phẩm & Quy cách *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="In Ảnh Kỹ Thuật Số / Ảnh Lụa Viền..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Core Material Configuration (Cốt vật tư tương thích liên kết trừ kho) */}
              <div className="p-3.5 bg-amber-50/60 border border-amber-300 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-amber-700" />
                    <span>Cốt Vật Tư Tương Thích (Liên Kết Trừ Kho)</span>
                  </label>
                  <span className="text-[11px] text-amber-800 font-semibold">
                    {materialCoreCode.toUpperCase() === 'NONE'
                      ? '🚫 Không trừ cốt'
                      : materialCoreCode.trim()
                      ? `🪵 Mã cốt: ${materialCoreCode.toUpperCase()}`
                      : '⚙️ Theo quy chuẩn tự động'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={materialCoreCode}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setMaterialCoreCode(val);
                      const m = materials.find(mat => mat.code.toUpperCase() === val.trim());
                      if (m) {
                        setMaterialCoreName(m.name);
                        setMaterialCoreId(m.id);
                      }
                    }}
                    placeholder="Nhập mã vật tư kho (VD: VT-GO-6090, VT-FOMEX-6090) hoặc NONE..."
                    className="flex-1 px-3 py-2 font-mono font-bold text-xs bg-white border border-amber-300 rounded-xl outline-hidden focus:ring-2 focus:ring-amber-500 uppercase"
                  />
                  {materials.length > 0 && (
                    <select
                      value={materialCoreCode.toUpperCase() === 'NONE' ? 'NONE' : (materials.some(m => m.code.toUpperCase() === materialCoreCode.toUpperCase()) ? materialCoreCode.toUpperCase() : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) {
                          setMaterialCoreCode('');
                          setMaterialCoreName('');
                          setMaterialCoreId('');
                        } else if (val === 'NONE') {
                          setMaterialCoreCode('NONE');
                          setMaterialCoreName('Không dùng cốt ván');
                          setMaterialCoreId('');
                        } else {
                          const m = materials.find(mat => mat.code.toUpperCase() === val);
                          if (m) {
                            setMaterialCoreCode(m.code);
                            setMaterialCoreName(m.name);
                            setMaterialCoreId(m.id);
                          }
                        }
                      }}
                      className="px-2.5 py-2 text-xs font-semibold bg-white border border-amber-300 rounded-xl outline-hidden text-slate-800 shrink-0"
                    >
                      <option value="">-- Chọn từ Kho Vật Tư --</option>
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

                {/* Quick recommendation chips based on size */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-slate-500 font-bold">Gợi ý nhanh theo cỡ:</span>
                  {(() => {
                    const normSize = normalizeSize(size || code || name);
                    const suggestedMdf = materials.find(m => m.category === 'Gỗ MDF' && normSize && normalizeSize(m.code).includes(normSize)) || materials.find(m => m.category === 'Gỗ MDF');
                    const suggestedFomex = materials.find(m => m.category === 'Fomex siêu nhẹ' && normSize && normalizeSize(m.code).includes(normSize)) || materials.find(m => m.category === 'Fomex siêu nhẹ');

                    return (
                      <>
                        {suggestedMdf && (
                          <button
                            type="button"
                            onClick={() => {
                              setMaterialCoreCode(suggestedMdf.code);
                              setMaterialCoreName(suggestedMdf.name);
                              setMaterialCoreId(suggestedMdf.id);
                            }}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                              materialCoreCode.toUpperCase() === suggestedMdf.code.toUpperCase()
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white hover:bg-amber-100 text-amber-900 border-amber-300'
                            }`}
                          >
                            🪵 Gán MDF ({suggestedMdf.code})
                          </button>
                        )}
                        {suggestedFomex && (
                          <button
                            type="button"
                            onClick={() => {
                              setMaterialCoreCode(suggestedFomex.code);
                              setMaterialCoreName(suggestedFomex.name);
                              setMaterialCoreId(suggestedFomex.id);
                            }}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                              materialCoreCode.toUpperCase() === suggestedFomex.code.toUpperCase()
                                ? 'bg-sky-600 text-white border-sky-600'
                                : 'bg-white hover:bg-sky-100 text-sky-900 border-sky-300'
                            }`}
                          >
                            ✨ Gán Fomex ({suggestedFomex.code})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setMaterialCoreCode('NONE');
                            setMaterialCoreName('Không dùng cốt');
                            setMaterialCoreId('');
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                            materialCoreCode.toUpperCase() === 'NONE'
                              ? 'bg-slate-700 text-white border-slate-700'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          🚫 Không cốt (NONE)
                        </button>
                      </>
                    );
                  })()}
                </div>

                {/* Status indicator */}
                {(() => {
                  const upper = materialCoreCode.toUpperCase().trim();
                  if (!upper) {
                    return (
                      <p className="text-[11px] text-slate-500 italic">
                        💡 Nếu để trống, hệ thống sẽ tự động bóc tách cốt ván MDF hoặc Fomex 9li theo tên/mã sản phẩm.
                      </p>
                    );
                  }
                  if (upper === 'NONE' || upper === 'KHONG' || upper === 'KHONG_COT') {
                    return (
                      <p className="text-[11px] text-slate-700 font-medium">
                        🚫 Sản phẩm này sẽ <strong>không trừ bất kỳ cốt ván nào</strong> trong kho khi bán hàng.
                      </p>
                    );
                  }
                  const matched = materials.find(m => m.code.toUpperCase() === upper || m.id === materialCoreId);
                  if (matched) {
                    return (
                      <p className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Khớp vật tư kho: <strong>{matched.name}</strong> • Tồn kho: <span className="font-mono text-emerald-700">{matched.stockQuantity} {matched.unit}</span></span>
                      </p>
                    );
                  }
                  return (
                    <p className="text-[11px] text-amber-800 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Mã cốt tự nhập: <strong>{upper}</strong> (khi bán hàng sẽ trừ vật tư có mã này trong kho)</span>
                    </p>
                  );
                })()}
              </div>

              {/* Unit & Price */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Đơn vị tính
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="tấm"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Đơn giá bán (VNĐ) *
                  </label>
                  <MoneyInput
                    value={price}
                    onChange={(val) => setPrice(val)}
                    placeholder="340,000"
                    className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-amber-500"
                    showWords={true}
                  />
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs cursor-pointer"
              >
                Lưu Mã Hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BULK COPY MODAL: 1. STUDIO ➔ 2. FREELANCE (+10%)         */}
      {/* ======================================================== */}
      {isBulkCopyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="p-4 bg-indigo-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-800 rounded-xl">
                  <Copy className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    Sao Chép Toàn Bộ: 1. Studio ➔ 2. Freelance
                  </h3>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    Chốt số lượng Studio, tăng 10% đơn giá và thay tiền tố ST ➔ FL
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkCopyModalOpen(false)}
                className="text-indigo-300 hover:text-white p-1 rounded-lg hover:bg-indigo-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Summary stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <span className="text-[11px] text-indigo-600 font-medium block">Nguồn sao chép</span>
                  <strong className="text-sm text-indigo-950 block mt-0.5">1. GIÁ STUDIO</strong>
                  <span className="text-[11px] text-indigo-700 font-mono font-bold mt-1 inline-block">
                    {studioCount} sản phẩm (Đã chốt)
                  </span>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-[11px] text-amber-600 font-medium block">Mức tăng đơn giá</span>
                  <strong className="text-sm text-amber-950 block mt-0.5">+10% so với Studio</strong>
                  <span className="text-[11px] text-amber-700 font-bold mt-1 inline-block">
                    Tất cả sản phẩm đồng loạt
                  </span>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[11px] text-emerald-600 font-medium block">Quy tắc sửa mã hàng</span>
                  <strong className="text-sm text-emerald-950 block mt-0.5">Đổi "ST" ➔ "FL"</strong>
                  <span className="text-[11px] text-emerald-700 font-mono font-bold mt-1 inline-block">
                    inST ➔ INFL, inepST ➔ inepFL...
                  </span>
                </div>
              </div>

              {/* Policy explanation */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-slate-700">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Quy trình thực hiện theo đúng yêu cầu Tiệm In 194:
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed text-slate-600">
                  <li>
                    <strong>Giữ nguyên mục 1. Studio:</strong> Toàn bộ {studioCount} sản phẩm và đơn giá ở mục Studio được chốt cố định, tuyệt đối không bị thay đổi hay xóa.
                  </li>
                  <li>
                    <strong>Tăng 10% đơn giá:</strong> Giá mỗi sản phẩm tại mục Freelance = <code>Đơn giá Studio × 1.10</code> (làm tròn số nguyên VNĐ).
                  </li>
                  <li>
                    <strong>Đổi mã sản phẩm cho phù hợp:</strong> Thay thế tiền tố <code>ST</code> thành <code>FL</code> (Ví dụ: <code>inST60*90</code> ➔ <code>INFL60*90</code>, <code>inepST60*90</code> ➔ <code>inepFL60*90</code>, <code>LVST60*90</code> ➔ <code>LVFL60*90</code>, <code>MKST60*90</code> ➔ <code>MKFL60*90</code>, <code>HDST60*90</code> ➔ <code>HDFL60*90</code>, <code>LKST60*90K456</code> ➔ <code>LKFL60*90K456</code>, <code>NEPST1</code> ➔ <code>NEPFL1</code>, <code>ABMP20x20</code> ➔ <code>FL-ABMP20x20</code>...).
                  </li>
                  <li>
                    <strong>Paste ngay vào 2. Freelance:</strong> Hệ thống sẽ lưu tự động vào bộ nhớ và chuyển ngay sang bảng giá Freelance để bạn kiểm tra.
                  </li>
                </ul>
              </div>

              {/* Sample Preview Table */}
              <div>
                <span className="font-bold text-slate-800 text-xs block mb-2">
                  Xem trước mẫu chuyển đổi một số sản phẩm tiêu biểu:
                </span>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="py-2 px-3">Tên sản phẩm</th>
                        <th className="py-2 px-2.5 text-center">Khổ</th>
                        <th className="py-2 px-2.5 font-mono text-indigo-900">Mã Studio</th>
                        <th className="py-2 px-2.5 text-right font-mono text-indigo-900">Giá Studio</th>
                        <th className="py-2 px-2.5 font-mono text-amber-900 bg-amber-50/50">Mã Freelance (Đổi FL)</th>
                        <th className="py-2 px-2.5 text-right font-mono text-amber-900 bg-amber-50/50">Giá FL (+10%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                      {studioProducts.slice(0, 7).map(sp => {
                        const cloned = cloneStudioProductToFreelance(sp);
                        return (
                          <tr key={sp.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-sans font-medium text-slate-900">{sp.name}</td>
                            <td className="py-2 px-2.5 text-center font-bold text-slate-600">{sp.size}</td>
                            <td className="py-2 px-2.5 font-bold text-indigo-700">{sp.code}</td>
                            <td className="py-2 px-2.5 text-right font-bold text-indigo-900">{formatCurrency(sp.price)}</td>
                            <td className="py-2 px-2.5 font-bold text-amber-700 bg-amber-50/30">{cloned.code}</td>
                            <td className="py-2 px-2.5 text-right font-bold text-amber-900 bg-amber-50/30">
                              {formatCurrency(cloned.price)}
                              <span className="text-[10px] text-emerald-600 font-sans ml-1">(+10%)</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 italic">
                  * Và toàn bộ {studioCount - 7} sản phẩm còn lại của Studio (gồm cả Lụa Viền, Mika Bo Viền, HD Gương, Khung Gia Cố, Album...) đều được tự động chuyển đổi tương tự.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <span className="text-xs text-slate-500">
                Sẵn sàng sao chép <strong className="text-slate-800">{studioCount} mã</strong> sang Freelance
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkCopyModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCopyStudioToFreelance}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  Xác Nhận Sao Chép & Paste Sang Freelance (+10%)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* QUICK CORE MATERIAL CONFIGURATION MODAL                  */}
      {/* ======================================================== */}
      {quickCoreProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden border border-amber-300 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-amber-700 via-amber-800 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-600/60 rounded-xl">
                  <Boxes className="w-5 h-5 text-amber-200" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base flex items-center gap-2 text-white">
                    Cấu Hình Cốt Vật Tư Tương Thích
                  </h3>
                  <p className="text-[11px] text-amber-200 mt-0.5">
                    Mã: <strong className="font-mono text-white bg-amber-900/80 px-1.5 py-0.5 rounded">{quickCoreProduct.code}</strong> — {quickCoreProduct.name} ({quickCoreProduct.size})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickCoreProduct(null)}
                className="text-amber-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-950">
                <p className="font-semibold text-[11px] leading-relaxed">
                  💡 <strong>Quy tắc hoạt động:</strong> Khi lập hóa đơn bán hàng, chọn sản phẩm này thì hệ thống sẽ <strong>tự động nhập cốt vật tư tương thích</strong> được cấu hình tại đây, giúp trừ chính xác số ván MDF hoặc Fomex trong kho!
                </p>
              </div>

              {/* Manual Input */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nhập Thủ Công Mã Cốt Vật Tư Kho Tương Thích:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={quickCoreCodeInput}
                    onChange={(e) => setQuickCoreCodeInput(e.target.value.toUpperCase())}
                    placeholder="VD: VT-GO-6090, VT-GO-6090-9LI, VT-FOMEX-6090 hoặc NONE..."
                    className="flex-1 px-3 py-2.5 font-mono font-bold text-sm bg-white border border-amber-300 rounded-xl outline-hidden focus:ring-2 focus:ring-amber-500 uppercase"
                  />
                  {quickCoreCodeInput && (
                    <button
                      type="button"
                      onClick={() => setQuickCoreCodeInput('')}
                      className="px-2.5 py-2 text-xs text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-lg cursor-pointer font-bold"
                      title="Xóa trắng để về quy chuẩn tự động"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Select from Warehouse Materials */}
              {materials.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Hoặc Chọn Nhanh Từ Danh Sách Kho Vật Tư Hiện Có:
                  </label>
                  <select
                    value={quickCoreCodeInput.toUpperCase() === 'NONE' ? 'NONE' : (materials.some(m => m.code.toUpperCase() === quickCoreCodeInput.toUpperCase()) ? quickCoreCodeInput.toUpperCase() : '')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setQuickCoreCodeInput('');
                      } else {
                        setQuickCoreCodeInput(val.toUpperCase());
                      }
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold bg-white border border-amber-300 rounded-xl outline-hidden text-slate-800"
                  >
                    <option value="">-- Bấm chọn mã từ kho vật tư --</option>
                    <option value="NONE">🚫 Không dùng cốt ván (NONE - Bỏ trống, không trừ kho)</option>
                    <optgroup label="🪵 Ván Gỗ MDF Lõi Xanh">
                      {materials.filter(m => m.category === 'Gỗ MDF').map(m => (
                        <option key={m.id} value={m.code.toUpperCase()}>
                          {m.code} — {m.name} (Tồn: {m.stockQuantity} {m.unit})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="✨ Fomex Siêu Nhẹ 9li">
                      {materials.filter(m => m.category === 'Fomex siêu nhẹ').map(m => (
                        <option key={m.id} value={m.code.toUpperCase()}>
                          {m.code} — {m.name} (Tồn: {m.stockQuantity} {m.unit})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              {/* Quick Chips by Size */}
              <div>
                <span className="text-[10px] text-slate-500 font-bold block mb-1">Thẻ gợi ý gán nhanh theo khổ {quickCoreProduct.size}:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(() => {
                    const normSize = normalizeSize(quickCoreProduct.size || quickCoreProduct.code || quickCoreProduct.name);
                    const suggestedMdf = materials.find(m => m.category === 'Gỗ MDF' && normSize && normalizeSize(m.code).includes(normSize)) || materials.find(m => m.category === 'Gỗ MDF');
                    const suggestedMdf9li = materials.find(m => m.category === 'Gỗ MDF' && m.code.includes('9LI') && normSize && normalizeSize(m.code).includes(normSize));
                    const suggestedFomex = materials.find(m => m.category === 'Fomex siêu nhẹ' && normSize && normalizeSize(m.code).includes(normSize)) || materials.find(m => m.category === 'Fomex siêu nhẹ');

                    return (
                      <>
                        {suggestedMdf && (
                          <button
                            type="button"
                            onClick={() => setQuickCoreCodeInput(suggestedMdf.code.toUpperCase())}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                              quickCoreCodeInput.toUpperCase() === suggestedMdf.code.toUpperCase()
                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                : 'bg-white hover:bg-amber-50 text-amber-900 border-amber-300'
                            }`}
                          >
                            🪵 MDF {suggestedMdf.code}
                          </button>
                        )}
                        {suggestedMdf9li && suggestedMdf9li.code !== suggestedMdf?.code && (
                          <button
                            type="button"
                            onClick={() => setQuickCoreCodeInput(suggestedMdf9li.code.toUpperCase())}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                              quickCoreCodeInput.toUpperCase() === suggestedMdf9li.code.toUpperCase()
                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                : 'bg-white hover:bg-amber-50 text-amber-900 border-amber-300'
                            }`}
                          >
                            🪵 MDF 9li ({suggestedMdf9li.code})
                          </button>
                        )}
                        {suggestedFomex && (
                          <button
                            type="button"
                            onClick={() => setQuickCoreCodeInput(suggestedFomex.code.toUpperCase())}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                              quickCoreCodeInput.toUpperCase() === suggestedFomex.code.toUpperCase()
                                ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                                : 'bg-white hover:bg-sky-50 text-sky-900 border-sky-300'
                            }`}
                          >
                            ✨ Fomex ({suggestedFomex.code})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setQuickCoreCodeInput('NONE')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            quickCoreCodeInput.toUpperCase() === 'NONE'
                              ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          🚫 Không cốt (NONE)
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Status preview */}
              {(() => {
                const upper = quickCoreCodeInput.toUpperCase().trim();
                if (!upper) {
                  return (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-[11px]">
                      ⚙️ <strong>Chế độ tự động:</strong> Hệ thống sẽ tự động bóc tách ván MDF hoặc Fomex 9li theo tên/mã sản phẩm.
                    </div>
                  );
                }
                if (upper === 'NONE' || upper === 'KHONG' || upper === 'KHONG_COT' || upper === '0') {
                  return (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-[11px] font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Sản phẩm này sẽ <strong>không trừ bất kỳ tấm cốt ván nào</strong> trong kho vật tư khi bán hàng.</span>
                    </div>
                  );
                }
                const matched = materials.find(m => m.code.toUpperCase() === upper);
                if (matched) {
                  return (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 text-[11px] font-semibold flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Khớp kho: <strong>{matched.name}</strong></span>
                      </div>
                      <span className="font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        Tồn: {matched.stockQuantity} {matched.unit}
                      </span>
                    </div>
                  );
                }
                return (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px]">
                    ⚠️ Mã vật tư <strong>[{upper}]</strong> chưa có trong kho hiện tại (hệ thống vẫn ghi nhận mã này khi trừ kho).
                  </div>
                );
              })()}

              {/* Sync across tiers checkbox */}
              <label className="flex items-center gap-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={syncCoreAcrossTiers}
                  onChange={(e) => setSyncCoreAcrossTiers(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-indigo-950">
                  Đồng bộ mã cốt này cho tất cả bảng giá (Studio, Freelance, Khách Lẻ) của sản phẩm này
                </span>
              </label>
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setQuickCoreProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveQuickCore}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-md transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Lưu Cốt Vào Hệ Thống
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
