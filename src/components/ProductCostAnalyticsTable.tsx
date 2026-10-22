import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, ProductCostItem, ProductCostMap, BoardCorePriceMap, CoreBoardCategory, RetailProductCostItem, RetailProductCostMap } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { isPartnerMode } from '../utils/partnerConfig';
import { convertProductCodeForTier } from '../utils/productHelpers';
import {
  DollarSign, TrendingUp, Calculator, Save, Printer, Download,
  Search, FileText, Sparkles, CheckCircle2, Layers, PieChart,
  RefreshCw, Check, Percent, ArrowUpRight, ArrowDownRight, Info,
  Filter, Eye, Table2, Plus, Trash2, Pencil, X, User, Clipboard, ClipboardPaste
} from 'lucide-react';
import {
  subscribeProductCosts,
  saveProductCostsToFirestore,
  getLocalProductCosts,
  saveLocalProductCosts,
  subscribeBoardCorePrices,
  getLocalBoardCorePrices,
  DEFAULT_BOARD_CORE_PRICES,
  subscribeRetailProductCosts,
  saveRetailProductCostsToFirestore,
  getLocalRetailProductCosts
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

/**
 * 1. Hàm tính điểm số kích thước để sắp xếp từ nhỏ đến lớn:
 * Bắt đầu từ 13x18, 15x21, 20x30,... và các kích thước lớn hơn.
 * Các kích thước nhỏ hơn 13x18 (như 6x9, 10x15) được sắp xếp phía sau.
 */
/**
 * Tìm kiếm hoặc suy luận thông tin sản phẩm từ danh mục sản phẩm.
 */
export function resolveProductForCode(code: string, products: Product[] = []) {
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
  } else if (cleanCode.includes('6096') || cleanCode.includes('6090')) {
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
}
export function parsePhotoSizeScore(sizeStr: string): number {
  if (!sizeStr) return 999999;
  const norm = sizeStr.replace('*', 'x').toLowerCase().trim();
  const m = norm.match(/(\d+)[x](\d+)/);
  if (!m) return 999999;
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  const min = Math.min(w, h);
  const max = Math.max(w, h);
  const score = min * 1000 + max;

  // Bắt đầu từ 13x18 (min=13, max=18 -> score = 13018).
  // Nếu nhỏ hơn 13x18 (ví dụ 6x9=6009, 10x15=10015), cộng thêm 1.000.000 để xếp sau các kích thước chính.
  if (score < 13018) {
    return 1000000 + score;
  }
  return score;
}

/**
 * 2. Hàm phân loại thứ tự chất liệu theo đúng chuẩn yêu cầu:
 * 1. Lụa
 * 2. Mika phổ thông
 * 3. HD gương
 * 4. HD pro
 * 5. 4K
 * Các chất liệu khác (In ép, in ảnh, album, khung nẹp...) xếp phía sau.
 */
export function getPhotoMaterialRank(code: string, name: string): number {
  const c = code.toUpperCase();
  const n = (name || '').toLowerCase();

  // 1. Lụa
  if (c.startsWith('LVST') || n.includes('lụa viền') || n.includes('lụa')) return 1;

  // 2. Mika phổ thông (trừ in ép mika)
  if (c.startsWith('MKST') || n.includes('mika phổ thông') || (n.includes('mika') && !n.includes('in ép') && !c.startsWith('INEP'))) return 2;

  // 3. HD gương (HD tráng gương / siêu bóng)
  if (c.startsWith('HDST') || n.includes('hd gương') || n.includes('tráng gương')) return 3;

  // 4. HD pro
  if (c.startsWith('HDPROST') || n.includes('hd pro')) return 4;

  // 5. 4K
  if (c.startsWith('4KST') || n.includes('4k')) return 5;

  // 6. In Ép Mika
  if (c.startsWith('INEPST') || n.includes('in ép')) return 6;

  // 7. In ảnh kỹ thuật số
  if (c.startsWith('INST') || n.includes('in ảnh')) return 7;

  // 8. Album
  if (c.startsWith('ABMP') || n.includes('album')) return 8;

  // 9. Nẹp / Khung gia cố
  if (c.startsWith('NEP') || n.includes('gia cố')) return 9;

  return 10;
}

/**
 * Phân nhóm 5 chất liệu màng ép chuẩn theo yêu cầu:
 * 1. Lụa (LVST, LKST, tên chứa 'lụa', 'lua')
 * 2. Mika (MKST, tên chứa 'mika', 'mica')
 * 3. HD Gương (HDST, tên chứa 'hd gương', 'tráng gương', 'pha lê', 'siêu bóng')
 * 4. HD Pro (HDPROST, tên chứa 'hd pro', 'hdpro')
 * 5. 4K (4KST, tên chứa '4k')
 *
 * Nguyên tắc: Giá màng ép CHỈ PHỤ THUỘC VÀO 2 YẾU TỐ:
 * 1) Kích thước ảnh (20x30, 40x60, 50x75...)
 * 2) Chất liệu (1 trong 5 loại: Lụa, Mika, HD Gương, HD Pro, 4K).
 * Loại khung (K0-K3, Titan...) hay kiểu bo viền HOÀN TOÀN KHÔNG ảnh hưởng đến giá màng ép.
 */
export type FilmMaterialType = 'lua' | 'mika' | 'hd_guong' | 'hd_pro' | '4k' | 'unknown';

export interface FilmMaterialInfo {
  type: FilmMaterialType;
  label: string;
}

export function detectFilmMaterial(code: string, name?: string): FilmMaterialInfo {
  const c = (code || '').toUpperCase().trim();
  const n = (name || '').toLowerCase().trim();
  const fullText = `${c} ${n}`;

  // 1. Phân loại 4K
  if (
    c.startsWith('4KST') ||
    c.startsWith('4K') ||
    n.includes('4k') ||
    fullText.includes('4K')
  ) {
    return { type: '4k', label: '4K' };
  }

  // 2. Phân loại HD Pro (phải kiểm tra trước HD Gương để tránh nhầm)
  if (
    c.startsWith('HDPROST') ||
    c.startsWith('HDPRO') ||
    n.includes('hd pro') ||
    n.includes('hdpro') ||
    fullText.includes('HD PRO') ||
    fullText.includes('HDPRO')
  ) {
    return { type: 'hd_pro', label: 'HD Pro' };
  }

  // 3. Phân loại HD Gương (HD tráng gương / siêu bóng / pha lê)
  if (
    c.startsWith('HDST') ||
    (c.startsWith('HD') && !c.startsWith('HDPRO')) ||
    n.includes('hd gương') ||
    n.includes('hd guong') ||
    n.includes('tráng gương') ||
    n.includes('trang guong') ||
    n.includes('pha lê') ||
    n.includes('pha le') ||
    n.includes('siêu bóng') ||
    n.includes('sieu bong') ||
    (n.includes('gương') && !n.includes('mika')) ||
    n.includes('ảnh hd')
  ) {
    return { type: 'hd_guong', label: 'HD Gương' };
  }

  // 4. Phân loại Mika
  if (
    c.startsWith('MKST') ||
    c.startsWith('MK') ||
    n.includes('mika') ||
    n.includes('mica') ||
    fullText.includes('MKST')
  ) {
    return { type: 'mika', label: 'Mika' };
  }

  // 5. Phân loại Lụa
  if (
    c.startsWith('LVST') ||
    c.startsWith('LKST') ||
    c.startsWith('LV') ||
    c.startsWith('LK') ||
    n.includes('lụa') ||
    n.includes('lua') ||
    fullText.includes('LVST') ||
    fullText.includes('LKST')
  ) {
    return { type: 'lua', label: 'Lụa' };
  }

  return { type: 'unknown', label: '' };
}

/**
 * Đơn giá chuẩn cốt ván MDF cho kích thước 40*60:
 * - Ván 9li (9mm): 20.265 VNĐ
 * - Ván 12li (12mm): 26.520 VNĐ
 */
export const MDF_PRICE_4060_9LI = 20265;
export const MDF_PRICE_4060_12LI = 26520;

/**
 * Định mức chi phí chuẩn tham chiếu Mực & Giấy theo kích thước ảnh:
 * Tự động áp dụng đồng nhất cho tất cả các sản phẩm cùng kích thước
 */
export const DEFAULT_SIZE_INK_PAPER: Record<string, { ink: number; paper: number }> = {
  '13x18': { ink: 1000, paper: 1000 },
  '15x21': { ink: 1500, paper: 1500 },
  '20x30': { ink: 2500, paper: 2500 },
  '30x45': { ink: 5000, paper: 5000 },
  '40x60': { ink: 8000, paper: 8000 },
  '50x75': { ink: 12500, paper: 12500 },
  '60x90': { ink: 18000, paper: 18000 },
  '70x110': { ink: 26000, paper: 26000 },
  '80x120': { ink: 32000, paper: 32000 },
  '100x150': { ink: 50000, paper: 50000 },
  '110x180': { ink: 65000, paper: 65000 },
};

export function getDefaultInkPaperForSize(sizeKey: string): { ink: number; paper: number } {
  if (DEFAULT_SIZE_INK_PAPER[sizeKey]) {
    return DEFAULT_SIZE_INK_PAPER[sizeKey];
  }
  const m = sizeKey.match(/(\d+)[xX*](\d+)/);
  if (m) {
    const w = parseInt(m[1], 10);
    const h = parseInt(m[2], 10);
    const areaM2 = (w * h) / 10000;
    const est = Math.max(500, Math.round((areaM2 * 34000) / 100) * 100);
    return { ink: est, paper: est };
  }
  return { ink: 5000, paper: 5000 };
}

/**
 * Kiểm tra xem sản phẩm có kích thước 40*60 (hoặc 40x60) không
 */
export function isSize4060(size?: string, code?: string, name?: string): boolean {
  const norm = `${size || ''} ${code || ''} ${name || ''}`.toLowerCase().replace(/\s+/g, '');
  return (
    norm.includes('40*60') ||
    norm.includes('40x60') ||
    norm.includes('40_60') ||
    norm.includes('40-60') ||
    /(?:^|[^0-9])4060(?:[^0-9]|$)/.test(norm) ||
    /st40\*?60/i.test(code || '')
  );
}

/**
 * PHẦN 2: PHÂN LOẠI CỐT VẬT TƯ CHO TOÀN BỘ 325 MÃ SẢN PHẨM:
 * Dựa trên tên/mã sản phẩm và thông tin cấu hình, tự động nhận diện loại cốt vật tư mà sản phẩm đó sử dụng:
 * 1. 'fomex_9li' (Fomex 9li): Ảnh 4K (4KST...), Ảnh HD Pro (HDPROST...), hoặc có từ khóa Fomex/Foam
 * 2. 'mdf_12li' (MDF 12li): Ảnh HD Gương Siêu Bóng / Tráng Gương (HDST...), Ảnh Mika (MKST...) khung nặng Titan/K10/K11, hoặc có từ khóa 12li/12mm
 * 3. 'mdf_9li' (MDF 9li): Ảnh Lụa Viền (LVST), Lụa Khung (LKST), Mika phổ thông bo viền/K0-K9, hoặc mặc định các loại ảnh ván gỗ khác
 * 4. 'none' (Không cốt): In ảnh kỹ thuật số (INST...), In ép (INEPST...), Nẹp gia cố (NEP...), Album Photobook (ABMP...)
 */
export function detectProductCoreBoardCategory(
  code: string,
  matchedProd?: Product,
  name?: string,
  sizeKeyInput?: string
): {
  category: CoreBoardCategory;
  label: string; // 'MDF 9li' | 'MDF 12li' | 'Fomex 9li' | 'MDF 9li HQ' | 'Không cốt'
  materialCode?: string;
  isKoreanBorder?: boolean;
} {
  const cleanCode = (code || '').toUpperCase().trim();
  const prodName = (name || matchedProd?.name || '').toLowerCase().trim();
  const coreCode = (matchedProd?.materialCoreCode || '').toUpperCase().trim();
  const coreName = (matchedProd?.materialCoreName || '').toLowerCase().trim();
  const prodDesc = (matchedProd?.description || '').toLowerCase().trim();
  const fullText = `${cleanCode} ${prodName} ${coreCode} ${coreName} ${prodDesc}`;

  // Kiểm tra viền Hàn Quốc (15x21 & 20x30)
  const isHQ =
    fullText.includes('HQ') ||
    fullText.includes('HÀN QUỐC') ||
    fullText.includes('HAN QUOC') ||
    fullText.includes('VIỀN HÀN') ||
    fullText.includes('VIEN HAN') ||
    fullText.includes('KHUNG HÀN') ||
    fullText.includes('KHUNG HAN');

  const normSize = sizeKeyInput || normalizePhotoSizeKey(undefined, cleanCode, prodName);

  if (isHQ && (normSize === '15x21' || normSize === '15*21' || cleanCode.includes('1521') || cleanCode.includes('15*21'))) {
    return {
      category: 'mdf_9li_hq_1521',
      label: 'MDF 9li HQ',
      materialCode: '1521 9li HQ',
      isKoreanBorder: true
    };
  }

  if (isHQ && (normSize === '20x30' || normSize === '20*30' || cleanCode.includes('2030') || cleanCode.includes('20*30'))) {
    return {
      category: 'mdf_9li_hq_2030',
      label: 'MDF 9li HQ',
      materialCode: '2030 9li HQ',
      isKoreanBorder: true
    };
  }

  // 1. Dòng in kỹ thuật số / in ảnh / in ép / album photobook / nẹp gia cố -> Không dùng cốt ván
  if (
    cleanCode.startsWith('INST') ||
    cleanCode.startsWith('INEPST') ||
    cleanCode.startsWith('NEP') ||
    cleanCode.startsWith('ABMP') ||
    cleanCode.startsWith('AB') ||
    coreCode === 'NONE' ||
    coreCode === 'KHONG' ||
    coreCode === '0' ||
    prodName.includes('không cốt')
  ) {
    return { category: 'none', label: 'Không cốt' };
  }

  // 2. Fomex 9li:
  // - Cốt cấu hình explicit Fomex (materialCoreCode, materialCoreName, description)
  // - DUY NHẤT dành cho Ảnh 4K (4KST...) và Ảnh HD Pro (HDPROST...)
  // - Hoặc tên/mã có chữ fomex, foam
  const isExplicitFomex =
    coreCode.includes('FOMEX') ||
    coreName.includes('fomex') ||
    prodDesc.includes('fomex') ||
    prodName.includes('fomex') ||
    prodName.includes('foam');

  const is4K = cleanCode.startsWith('4KST') || prodName.includes('4k');
  const isHDPro = cleanCode.startsWith('HDPROST') || prodName.includes('hd pro') || prodName.includes('hdpro');

  if (isExplicitFomex || is4K || isHDPro) {
    return { category: 'fomex_9li', label: 'Fomex 9li' };
  }

  // 3. Ván MDF 12li (lõi xanh chống ẩm):
  // - Explicit 12li / 12mm
  // - Ảnh HD Gương Siêu Bóng / Tráng Gương / Pha Lê (HDST...)
  // - Ảnh Mika Phổ Thông (MKST...) gắn khung nặng: Titan TT1, TT2 hoặc khung K10, K11
  const isExplicit12li =
    coreCode.includes('12LI') ||
    coreCode.includes('12MM') ||
    coreName.includes('12li') ||
    coreName.includes('12mm') ||
    prodDesc.includes('12li') ||
    prodDesc.includes('12mm');

  const isHDGuong =
    cleanCode.startsWith('HDST') ||
    prodName.includes('hd gương') ||
    prodName.includes('tráng gương') ||
    prodName.includes('pha lê');

  const isMikaHeavyFrame =
    (cleanCode.startsWith('MKST') || prodName.includes('mika')) &&
    (cleanCode.includes('TT1') || cleanCode.includes('TT2') || cleanCode.includes('K10') || cleanCode.includes('K11') ||
     prodName.includes('titan') || prodName.includes('k10') || prodName.includes('k11'));

  if (isExplicit12li || isHDGuong || isMikaHeavyFrame) {
    return { category: 'mdf_12li', label: 'MDF 12li' };
  }

  // 4. Ván MDF 9li:
  // - Ảnh Lụa Viền (LVST), Lụa Khung (LKST), tên chứa 'lụa'
  // - Ảnh Mika Phổ Thông (MKST) bo viền hoặc khung K0-K9
  // - Mặc định cho các dòng ảnh còn lại
  return { category: 'mdf_9li', label: 'MDF 9li' };
}

export function resolveBoardDetails4060(
  code: string,
  matchedProd?: Product,
  userBoard?: number
): {
  boardCost: number;
  thickness: '9li' | '12li' | 'none';
  label: string;
} {
  const cat = detectProductCoreBoardCategory(code, matchedProd);
  if (cat.category === 'none') {
    return { boardCost: 0, thickness: 'none', label: 'Không cốt' };
  }
  const defaultCost = cat.category === 'mdf_12li' ? MDF_PRICE_4060_12LI : MDF_PRICE_4060_9LI;
  return {
    boardCost: userBoard !== undefined && userBoard > 0 ? userBoard : defaultCost,
    thickness: cat.category === 'mdf_12li' ? '12li' : '9li',
    label: cat.label
  };
}

/**
 * Chuẩn hóa kích thước ảnh thành khóa duy nhất để nhóm (ví dụ: '60x90', '40x60', '80x120'...)
 */
export function normalizePhotoSizeKey(sizeStr?: string, code?: string, name?: string): string {
  const text = `${sizeStr || ''} ${code || ''} ${name || ''}`.toLowerCase();
  
  // Xử lý các mã dính liền đặc thù trước khi regex tách
  if (text.includes('6096') || text.includes('60*96')) return '60x90'; // Ghép 6096 với 60x90 theo chuẩn khổ Tiệm In 194
  if (text.includes('6090')) return '60x90';
  if (text.includes('70110')) return '70x110';
  if (text.includes('80120')) return '80x120';
  if (text.includes('100150')) return '100x150';
  if (text.includes('110180')) return '110x180';

  const m = text.match(/(\d{1,3})\s*[*xX_\-]\s*(\d{1,3})/);
  if (m) {
    const d1 = parseInt(m[1], 10);
    const d2 = parseInt(m[2], 10);
    return `${Math.min(d1, d2)}x${Math.max(d1, d2)}`;
  }
  return (sizeStr || 'default').replace('*', 'x').toLowerCase().trim();
}

/**
 * Phân loại chính xác 7 NHÓM KHUNG / VIỀN (dựa trên từ khóa trong tên sản phẩm / mã sản phẩm):
 * - Bỏ qua các tiền tố chất liệu phía trước (như lụa, mika, hd gương, 4k...). Chỉ xét từ khóa khung/viền phía sau:
 * 1. 'bovien': Nhóm 1 (Bo viền / Viền) - Tên có chứa từ "bo viền" hoặc "viền" (Ảnh có viền nhựa mỏng)
 * 2. 'k0_3': Nhóm 2 (Khung K0 đến K3) - Tên/mã chứa "K0", "K1", "K2", "K3"
 * 3. 'k4_9': Nhóm 3 (Khung K4 đến K9) - Tên/mã chứa "K4", "K5", "K6", "K7", "K8", "K9" (dùng chung 1 mức giá)
 * 4. 'k10': Nhóm 4 (Khung K10) - Tên/mã chứa "K10"
 * 5. 'k11': Nhóm 5 (Khung K11) - Tên/mã chứa "K11"
 * 6. 'tt1': Nhóm 6 (Khung Titan 1) - Tên/mã chứa "titan 1" (hoặc TT1)
 * 7. 'tt2': Nhóm 7 (Khung Titan 2) - Tên/mã chứa "titan 2" (hoặc TT2)
 * - 'none': Không dùng khung viền (In kỹ thuật số INST, in ép INEPST, album ABMP, khung nẹp gia cố NEP)
 */
export type FrameCategory = 'bovien' | 'k0_3' | 'k4_9' | 'k10' | 'k11' | 'tt1' | 'tt2' | 'none';

export function detectFrameCategory(code: string, name?: string): FrameCategory {
  const c = code.toUpperCase().trim();
  const n = (name || '').toLowerCase().trim();

  // 0. Bỏ qua các sản phẩm thuần in ảnh kỹ thuật số, in ép mika, album mở phẳng hoặc nẹp gia cố
  if (
    c.startsWith('INST') ||
    c.startsWith('INEPST') ||
    c.startsWith('ABMP') ||
    c.startsWith('NEP') ||
    n.includes('in ảnh kỹ thuật số') ||
    n.includes('in ép mika') ||
    n.includes('album mở phẳng') ||
    n.includes('khung gia cố')
  ) {
    return 'none';
  }

  // 1. Nhóm Titan 1: Tên chứa từ khóa "titan 1" (phân biệt rõ với titan 2) hoặc mã chứa TT1 / TITAN1
  const isTitan2 = n.includes('titan 2') || n.includes('titan2') || c.includes('TT2') || c.includes('TITAN2');
  const isTitan1 = !isTitan2 && (n.includes('titan 1') || n.includes('titan1') || c.includes('TT1') || c.includes('TITAN1'));

  if (isTitan1) {
    return 'tt1';
  }

  // 2. Nhóm Titan 2: Tên chứa từ khóa "titan 2" hoặc mã chứa TT2 / TITAN2
  if (isTitan2) {
    return 'tt2';
  }

  // 3. Nhóm K11: Tên hoặc mã chứa từ khóa "k11"
  if (n.includes('k11') || c.includes('K11')) {
    return 'k11';
  }

  // 4. Nhóm K10: Tên hoặc mã chứa từ khóa "k10"
  if (n.includes('k10') || c.includes('K10')) {
    return 'k10';
  }

  // 5. Nhóm K0-K3: Tên hoặc mã chứa các từ khóa riêng biệt "k0", "k1", "k2", "k3" HOẶC chuỗi "k0123", "k0k1k2k3", "k0 k1 k2 k3"
  // (Ưu tiên kiểm tra trước K4-K9 để NGHIÊM CẤM gán nhầm sang K4-K9)
  const isK0toK3 =
    c.includes('K0123') ||
    c.includes('K0K1K2K3') ||
    n.includes('k0123') ||
    n.includes('k0k1k2k3') ||
    n.includes('k0 k1 k2 k3') ||
    n.includes('k0, k1, k2, k3') ||
    n.includes('k0,k1,k2,k3') ||
    n.includes('k0-k3') ||
    n.includes('k0 - k3') ||
    /(?:^|[^0-9a-z])k[0-3](?:[^0-9a-z]|$)/i.test(n) ||
    /(?:^|[^0-9a-z])k[0-3](?:[^0-9a-z]|$)/i.test(c) ||
    /(?:k[0-3])(?!\d)/i.test(c);

  if (isK0toK3) {
    return 'k0_3';
  }

  // 6. Nhóm K4-K9: Tên hoặc mã chứa các từ khóa riêng biệt "k4", "k5", "k6", "k7", "k8", "k9"
  // HOẶC chuỗi "k456", "k789", "k4k5k6", "k4 k5 k6"
  // (TUYỆT ĐỐI KHÔNG dùng c.startsWith('LKST') chung chung để tránh nhận lầm K0-K3)
  const isK4toK9 =
    c.includes('K456') ||
    c.includes('K45') ||
    c.includes('K789') ||
    n.includes('k456') ||
    n.includes('k45') ||
    n.includes('k789') ||
    n.includes('k4k5k6') ||
    n.includes('k4 k5 k6') ||
    n.includes('k4, k5, k6') ||
    n.includes('k4,k5,k6') ||
    n.includes('k7k8k9') ||
    n.includes('k7 k8 k9') ||
    n.includes('k4-k9') ||
    n.includes('k4 - k9') ||
    /(?:^|[^0-9a-z])k[4-9](?:[^0-9a-z]|$)/i.test(n) ||
    /(?:^|[^0-9a-z])k[4-9](?:[^0-9a-z]|$)/i.test(c) ||
    /(?:k[4-9])(?!\d)/i.test(c);

  if (isK4toK9) {
    return 'k4_9';
  }

  // 7. Nhóm Bo viền / Viền: Tên có chứa từ "bo viền" hoặc "viền"
  // hoặc các mã hoàn thiện tiêu chuẩn (LVST, MKST, HDST, 4KST, HDPROST không gắn khung)
  const isBoVien =
    n.includes('bo viền') ||
    n.includes('bo vien') ||
    n.includes('viền') ||
    n.includes('vien') ||
    c.startsWith('LVST') ||
    c.startsWith('MKST') ||
    c.startsWith('HDST') ||
    c.startsWith('4KST') ||
    c.startsWith('HDPROST');

  if (isBoVien) {
    return 'bovien';
  }

  return 'none';
}

export function getFrameCategoryLabel(cat: FrameCategory): string {
  switch (cat) {
    case 'bovien':
      return 'Bo viền / Viền';
    case 'k0_3':
      return 'Khung K0-K3';
    case 'k4_9':
      return 'Khung K4-K9';
    case 'k10':
      return 'Khung K10';
    case 'k11':
      return 'Khung K11';
    case 'tt1':
      return 'Khung Titan 1';
    case 'tt2':
      return 'Khung Titan 2';
    default:
      return '';
  }
}


/**
 * Kiểm tra mã sản phẩm thuộc Danh mục "Sản Phẩm Nhập Thành Phẩm & Định Mức Tùy Chỉnh"
 * (Tách khỏi bảng bóc tách chi tiết vật tư Mực, Giấy, Ván, Màng, Khung)
 */
export function isImportedCustomProduct(code: string, productName?: string, customCodesSet?: Set<string>): boolean {
  if (!code && !productName) return false;
  const cleanCode = (code || '').toUpperCase().trim();
  const cleanName = (productName || '').toLowerCase().trim();

  if (customCodesSet && customCodesSet.has(cleanCode)) {
    return true;
  }

  // 1. Mã sản phẩm đặc thù
  if (
    cleanCode === 'ABAT' ||
    cleanCode.startsWith('ABAT') ||
    cleanCode === 'ABMP30X30ST' ||
    cleanCode === 'ABMP30X30' ||
    cleanCode === 'ABMP20X30ST' ||
    cleanCode === 'ABMP20X30' ||
    cleanCode === 'ABMP20X20' ||
    cleanCode === 'ABMP20X20ST' ||
    cleanCode === 'NEPST1' ||
    cleanCode === 'NEPST2' ||
    cleanCode === 'NEPST3'
  ) {
    return true;
  }

  // 2. Tên sản phẩm đặc thù
  if (
    cleanName.includes('abat') ||
    cleanName.includes('album mở phẳng 20x20') ||
    cleanName.includes('album mở phẳng 20x30') ||
    cleanName.includes('album mở phẳng 30x30') ||
    cleanName.includes('khung gia cố 80*120') ||
    cleanName.includes('khung gia cố 100*150') ||
    cleanName.includes('khung gia cố 110*180') ||
    cleanName.includes('khung gia cố')
  ) {
    return true;
  }

  return false;
}

/**
 * Tính toán đơn giá vốn (Tổng giá vốn 1 sản phẩm) cho tất cả các mã sản phẩm
 * dựa trên Bảng giá sản phẩm, costMap và Bảng giá cốt vật tư.
 */
export function computeProductCostLookupMap(
  costMap: ProductCostMap,
  boardCorePrices: BoardCorePriceMap,
  products: Product[] = []
): Record<string, number> {
  const result: Record<string, number> = {};

  const codeSet = new Set<string>();
  PDF_STATS_PRODUCT_CODES.forEach(c => codeSet.add(c));
  products.forEach(p => {
    if (p.code) codeSet.add(p.code);
  });
  Object.keys(costMap || {}).forEach(c => {
    if (c) codeSet.add(c);
  });

  const allCodes = Array.from(codeSet);

  const codeMetaMap: Record<string, {
    sizeKey: string;
    frameCat: FrameCategory;
    is4060: boolean;
    filmMaterial: FilmMaterialInfo;
    prodInfo: ReturnType<typeof resolveProductForCode>;
  }> = {};

  allCodes.forEach(code => {
    const prodInfo = resolveProductForCode(code, products);
    const sizeKey = normalizePhotoSizeKey(prodInfo.size, code, prodInfo.name);
    const frameCat = detectFrameCategory(code, prodInfo.name);
    const is4060 = isSize4060(prodInfo.size, code, prodInfo.name);
    const filmMaterial = detectFilmMaterial(code, prodInfo.name);

    codeMetaMap[code] = {
      sizeKey,
      frameCat,
      is4060,
      filmMaterial,
      prodInfo
    };
  });

  const inkMap: Record<string, number> = {};
  const paperMap: Record<string, number> = {};
  const frameMap: Record<string, number> = {};
  const otherMap: Record<string, number> = {};
  const filmMap: Record<string, number> = {};

  for (const [code, cost] of Object.entries(costMap || {})) {
    if (!cost) continue;
    const meta = codeMetaMap[code] || {
      sizeKey: normalizePhotoSizeKey(undefined, code),
      frameCat: detectFrameCategory(code),
      is4060: isSize4060(undefined, code),
      filmMaterial: detectFilmMaterial(code),
      prodInfo: resolveProductForCode(code, products)
    };

    if (cost.ink !== undefined && cost.ink > 0 && inkMap[meta.sizeKey] === undefined) {
      inkMap[meta.sizeKey] = cost.ink;
    }
    if (cost.paper !== undefined && cost.paper > 0 && paperMap[meta.sizeKey] === undefined) {
      paperMap[meta.sizeKey] = cost.paper;
    }
    if (meta.frameCat !== 'none' && cost.frame !== undefined && cost.frame > 0) {
      const groupKey = `${meta.sizeKey}_${meta.frameCat}`;
      if (frameMap[groupKey] === undefined) frameMap[groupKey] = cost.frame;
    }
    if (cost.film !== undefined && cost.film > 0 && meta.filmMaterial && meta.filmMaterial.type !== 'unknown') {
      const filmKey = `${meta.sizeKey}_${meta.filmMaterial.type}`;
      if (filmMap[filmKey] === undefined) filmMap[filmKey] = cost.film;
    }
    if (cost.other !== undefined && cost.other > 0) {
      if (otherMap[meta.sizeKey] === undefined) otherMap[meta.sizeKey] = cost.other;
    }
  }

  allCodes.forEach(code => {
    const meta = codeMetaMap[code];
    const sizeKey = meta?.sizeKey;
    if (sizeKey) {
      if (inkMap[sizeKey] === undefined || paperMap[sizeKey] === undefined) {
        const defaults = getDefaultInkPaperForSize(sizeKey);
        if (inkMap[sizeKey] === undefined) inkMap[sizeKey] = defaults.ink;
        if (paperMap[sizeKey] === undefined) paperMap[sizeKey] = defaults.paper;
      }
    }
  });

  allCodes.forEach(code => {
    const meta = codeMetaMap[code];
    if (!meta) return;
    const sizeKey = meta.sizeKey;
    const prodInfo = meta.prodInfo;
    const userCosts = (costMap || {})[code] || {};

    // Nếu sản phẩm thuộc Danh mục Nhập Thành Phẩm / Giá vốn tùy chỉnh
    if (isImportedCustomProduct(code, prodInfo.name) || userCosts.importCost !== undefined) {
      const customCost = userCosts.importCost !== undefined
        ? userCosts.importCost
        : (userCosts.other !== undefined ? userCosts.other : 0);
      result[code.toUpperCase()] = customCost;
      return;
    }

    const refInk = inkMap[sizeKey];
    const resolvedInk = (userCosts.ink !== undefined && userCosts.ink > 0) ? userCosts.ink : (refInk || 0);

    const refPaper = paperMap[sizeKey];
    const resolvedPaper = (userCosts.paper !== undefined && userCosts.paper > 0) ? userCosts.paper : (refPaper || 0);

    const coreBoardInfo = detectProductCoreBoardCategory(code, prodInfo.matchedProduct, prodInfo.name, sizeKey);
    let standardBoardPrice = 0;
    if (coreBoardInfo.category !== 'none') {
      if (coreBoardInfo.category === 'mdf_9li_hq_1521') {
        standardBoardPrice = boardCorePrices['1521 9li HQ']?.mdf9li || DEFAULT_BOARD_CORE_PRICES['1521 9li HQ']?.mdf9li || boardCorePrices['15x21']?.mdf9li || 15000;
      } else if (coreBoardInfo.category === 'mdf_9li_hq_2030') {
        standardBoardPrice = boardCorePrices['2030 9li HQ']?.mdf9li || DEFAULT_BOARD_CORE_PRICES['2030 9li HQ']?.mdf9li || boardCorePrices['20x30']?.mdf9li || 20000;
      } else {
        const boardRow = boardCorePrices[sizeKey] || DEFAULT_BOARD_CORE_PRICES[sizeKey];
        if (boardRow) {
          if (coreBoardInfo.category === 'mdf_9li') standardBoardPrice = boardRow.mdf9li || 0;
          else if (coreBoardInfo.category === 'mdf_12li') standardBoardPrice = boardRow.mdf12li || 0;
          else if (coreBoardInfo.category === 'fomex_9li') standardBoardPrice = boardRow.fomex9li || 0;
        }
      }
    }

    let resolvedBoard = 0;
    if (coreBoardInfo.category === 'none') {
      resolvedBoard = 0;
    } else if (standardBoardPrice > 0) {
      resolvedBoard = standardBoardPrice;
    } else if (userCosts.board !== undefined && userCosts.board > 0) {
      resolvedBoard = userCosts.board;
    }

    const filmMaterial = meta.filmMaterial;
    const filmGroupKey = filmMaterial.type !== 'unknown' ? `${sizeKey}_${filmMaterial.type}` : '';
    const refFilm = filmGroupKey ? filmMap[filmGroupKey] : undefined;
    let resolvedFilm = 0;
    if (userCosts.film !== undefined && userCosts.film > 0) {
      resolvedFilm = userCosts.film;
    } else if (filmMaterial.type !== 'unknown' && refFilm !== undefined && refFilm > 0) {
      resolvedFilm = refFilm;
    }

    const frameGroupKey = meta.frameCat !== 'none' ? `${sizeKey}_${meta.frameCat}` : '';
    const refFrame = frameGroupKey ? frameMap[frameGroupKey] : undefined;
    let resolvedFrame = 0;
    if (userCosts.frame !== undefined && userCosts.frame > 0) {
      resolvedFrame = userCosts.frame;
    } else if (meta.frameCat !== 'none' && refFrame !== undefined && refFrame > 0) {
      resolvedFrame = refFrame;
    }

    const refOther = otherMap[sizeKey];
    let resolvedOther = 0;
    if (userCosts.other !== undefined && userCosts.other > 0) {
      resolvedOther = userCosts.other;
    } else if (refOther !== undefined && refOther > 0) {
      resolvedOther = refOther;
    }

    const totalCost =
      Number(resolvedInk || 0) +
      Number(resolvedPaper || 0) +
      Number(resolvedBoard || 0) +
      Number(resolvedFilm || 0) +
      Number(resolvedFrame || 0) +
      Number(resolvedOther || 0);

    const mainKey = code.toUpperCase();
    result[mainKey] = totalCost;

    // Tự động map thêm mã Freelance tương ứng (vì sản phẩm Studio và Freelance dùng chung vật tư & giá vốn)
    const flCode = convertProductCodeForTier(code, 'Freelance').toUpperCase();
    result[flCode] = totalCost;

    // Map thêm định dạng bỏ dấu '*' (ví dụ LVST6090 <-> LVST60*90, LVFL6090 <-> LVFL60*90)
    const cleanMainKey = mainKey.replace('*', '');
    result[cleanMainKey] = totalCost;

    const cleanFlCode = flCode.replace('*', '');
    result[cleanFlCode] = totalCost;
  });

  return result;
}

export function getMarginBadge(margin: number, hasPrice: boolean): string {
  if (!hasPrice) return 'bg-slate-100 text-slate-400 border-slate-200';
  if (margin >= 40) return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
  if (margin >= 20) return 'bg-amber-50 text-amber-900 border-amber-300 font-bold';
  if (margin > 0) return 'bg-yellow-50 text-yellow-900 border-yellow-300 font-bold';
  return 'bg-rose-50 text-rose-800 border-rose-300 font-bold';
}

interface ProductCostAnalyticsTableProps {
  products: Product[];
  currentUserEmail?: string | null;
}

export const ProductCostAnalyticsTable: React.FC<ProductCostAnalyticsTableProps> = ({
  products,
  currentUserEmail
}) => {
  const [costMap, setCostMap] = useState<ProductCostMap>(() => getLocalProductCosts());
  const [boardCorePrices, setBoardCorePrices] = useState<BoardCorePriceMap>(() => getLocalBoardCorePrices());
  const [activeCostTab, setActiveCostTab] = useState<'dissected' | 'imported' | 'retail'>('dissected');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'filled' | 'empty'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Bảng Giá Vốn Nguyên Vật Liệu Cho Các Sản Phẩm Khách Lẻ
  const [retailCostMap, setRetailCostMap] = useState<RetailProductCostMap>(() => getLocalRetailProductCosts());
  const [retailPasteText, setRetailPasteText] = useState('');
  const [retailSearchQuery, setRetailSearchQuery] = useState('');
  const [retailFilterStatus, setRetailFilterStatus] = useState<'all' | 'priced' | 'unpriced'>('all');

  // Quản lý sản phẩm nhập thành phẩm tự định nghĩa (Thêm/Sửa/Xóa)
  const [customImportedItems, setCustomImportedItems] = useState<Array<{
    code: string;
    name: string;
    size: string;
    defaultPrice?: number;
    importCost?: number;
  }>>(() => {
    try {
      const saved = localStorage.getItem('custom_imported_products_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading custom imported products:', e);
    }
    return [];
  });

  const [deletedImportedCodes, setDeletedImportedCodes] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('deleted_imported_codes_v2');
      if (saved) return new Set(JSON.parse(saved));
    } catch (e) {
      console.error('Error loading deleted imported codes:', e);
    }
    return new Set();
  });

  // Modal Thêm / Sửa Sản phẩm Nhập Thành Phẩm
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItemCode, setEditingItemCode] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    code: '',
    name: '',
    size: '',
    importCost: '',
    studioPrice: ''
  });

  useEffect(() => {
    try {
      localStorage.setItem('custom_imported_products_v2', JSON.stringify(customImportedItems));
    } catch (e) {
      console.error('Failed to save custom imported products:', e);
    }
  }, [customImportedItems]);

  useEffect(() => {
    try {
      localStorage.setItem('deleted_imported_codes_v2', JSON.stringify(Array.from(deletedImportedCodes)));
    } catch (e) {
      console.error('Failed to save deleted imported codes:', e);
    }
  }, [deletedImportedCodes]);

  const customCodesSet = useMemo(() => {
    const set = new Set<string>();
    customImportedItems.forEach(item => set.add(item.code.toUpperCase().trim()));
    return set;
  }, [customImportedItems]);

  const handleOpenAddModal = () => {
    setEditingItemCode(null);
    setProductForm({ code: '', name: '', size: '', importCost: '', studioPrice: '' });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (item: { code: string; name: string; size: string; importCost: number; studioPrice: number }) => {
    setEditingItemCode(item.code);
    setProductForm({
      code: item.code,
      name: item.name,
      size: item.size || '',
      importCost: item.importCost > 0 ? String(item.importCost) : '',
      studioPrice: item.studioPrice > 0 ? String(item.studioPrice) : ''
    });
    setIsAddModalOpen(true);
  };

  const handleDeleteImportedProduct = (code: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${name}" (${code}) khỏi Danh mục Sản Phẩm Nhập Thành Phẩm?`)) {
      return;
    }
    const codeUpper = code.toUpperCase().trim();
    setDeletedImportedCodes(prev => {
      const next = new Set(prev);
      next.add(codeUpper);
      return next;
    });
    setCustomImportedItems(prev => prev.filter(i => i.code.toUpperCase().trim() !== codeUpper));
    setToastMessage(`Đã xóa sản phẩm ${code} khỏi danh mục.`);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleSaveProductForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = productForm.code.trim();
    const cleanName = productForm.name.trim();
    const cleanSize = productForm.size.trim();

    if (!cleanCode || !cleanName) {
      alert('Vui lòng nhập đầy đủ Mã sản phẩm và Tên sản phẩm!');
      return;
    }

    const numImportCost = parseFloat(productForm.importCost.replace(/\D/g, '')) || 0;
    const numStudioPrice = parseFloat(productForm.studioPrice.replace(/\D/g, '')) || 0;
    const codeUpper = cleanCode.toUpperCase();

    if (editingItemCode) {
      const editUpper = editingItemCode.toUpperCase();
      setCustomImportedItems(prev => {
        const exists = prev.some(item => item.code.toUpperCase() === editUpper);
        if (exists) {
          return prev.map(item => item.code.toUpperCase() === editUpper ? {
            code: cleanCode,
            name: cleanName,
            size: cleanSize,
            defaultPrice: numStudioPrice,
            importCost: numImportCost
          } : item);
        } else {
          return [...prev, {
            code: cleanCode,
            name: cleanName,
            size: cleanSize,
            defaultPrice: numStudioPrice,
            importCost: numImportCost
          }];
        }
      });
    } else {
      setCustomImportedItems(prev => [
        ...prev.filter(i => i.code.toUpperCase() !== codeUpper),
        {
          code: cleanCode,
          name: cleanName,
          size: cleanSize,
          defaultPrice: numStudioPrice,
          importCost: numImportCost
        }
      ]);
    }

    setDeletedImportedCodes(prev => {
      const next = new Set(prev);
      next.delete(codeUpper);
      return next;
    });

    const updatedCostMap = {
      ...costMap,
      [cleanCode]: {
        ...(costMap[cleanCode] || {}),
        importCost: numImportCost,
        manualStudioPrice: numStudioPrice,
        isImportedCustom: true
      }
    };
    setCostMap(updatedCostMap);
    saveLocalProductCosts(updatedCostMap);
    saveProductCostsToFirestore(updatedCostMap);

    setIsAddModalOpen(false);
    setToastMessage(editingItemCode ? 'Đã cập nhật sản phẩm thành công!' : 'Đã thêm sản phẩm mới thành công!');
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Subscribe to real-time updates from Firestore for Product Costs
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

  // Subscribe to real-time updates from Firestore for Board Core Prices
  useEffect(() => {
    const unsubscribeBoard = subscribeBoardCorePrices(
      (newBoardPrices) => {
        setBoardCorePrices(newBoardPrices);
      },
      (error) => {
        console.error('Error subscribing to board core prices in analytics table:', error);
      }
    );
    return () => unsubscribeBoard();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Subscribe to real-time updates from Firestore for Retail Product Costs
  useEffect(() => {
    const unsubscribeRetail = subscribeRetailProductCosts(
      (newRetailCosts) => {
        setRetailCostMap(newRetailCosts || {});
      },
      (error) => {
        console.error('Error subscribing to retail product costs:', error);
      }
    );
    return () => unsubscribeRetail();
  }, []);

  // Đọc nội dung từ Clipboard hoặc fallback LocalStorage
  const handlePasteFromClipboard = async () => {
    try {
      let text = '';
      if (navigator?.clipboard?.readText) {
        text = await navigator.clipboard.readText();
      }
      if (!text) {
        text = localStorage.getItem('copied_retail_products_text') ||
               localStorage.getItem('tiem_in_194_copied_retail_products_text') || '';
      }
      if (text && text.trim()) {
        setRetailPasteText(text.trim());
        showToast('Đã dán dữ liệu vào ô! Bấm "✅ Thêm / Cập Nhật Vào Danh Sách" để lưu.');
      } else {
        alert('Bộ nhớ tạm hiện đang trống. Hãy qua tab "Bảng giá mã sản phẩm" -> "Khách Lẻ" rồi bấm nút "Copy Mã, Tên & Kích thước Khách Lẻ" trước nhé!');
      }
    } catch (e) {
      const fallback = localStorage.getItem('copied_retail_products_text') ||
                       localStorage.getItem('tiem_in_194_copied_retail_products_text') || '';
      if (fallback && fallback.trim()) {
        setRetailPasteText(fallback.trim());
        showToast('Đã nạp dữ liệu đã sao chép từ bộ nhớ!');
      } else {
        alert('Vui lòng nhấn phím Ctrl+V (hoặc Command+V) trực tiếp vào ô dán để dán dữ liệu.');
      }
    }
  };

  // Nạp 1-click toàn bộ mã Khách Lẻ từ Bảng Giá Sản Phẩm
  const handleAutoPopulateFromRetailCatalog = async () => {
    if (isPartnerMode()) return;
    const retailProducts = products.filter(p => p.category === 'Khách Lẻ' || p.code.toUpperCase().includes('KL'));
    if (retailProducts.length === 0) {
      alert('Không tìm thấy sản phẩm nào thuộc bảng Khách Lẻ trong Bảng Giá Sản Phẩm!');
      return;
    }

    const nextMap = { ...retailCostMap };
    let addedCount = 0;
    let updatedCount = 0;

    retailProducts.forEach(p => {
      const codeKey = p.code.toUpperCase().trim();
      const existing = nextMap[codeKey];
      if (existing) {
        nextMap[codeKey] = {
          ...existing,
          name: p.name || existing.name,
          size: p.size || existing.size,
          unitPrice: p.price > 0 ? p.price : existing.unitPrice,
          updatedAt: new Date().toISOString()
        };
        updatedCount++;
      } else {
        nextMap[codeKey] = {
          code: p.code,
          name: p.name,
          size: p.size || '',
          unitPrice: p.price || 0,
          materialCost: 0,
          updatedAt: new Date().toISOString()
        };
        addedCount++;
      }
    });

    setRetailCostMap(nextMap);
    await saveRetailProductCostsToFirestore(nextMap, { email: currentUserEmail });
    showToast(`Đã nạp ${retailProducts.length} mã Khách Lẻ (+${addedCount} mã mới, đồng bộ ${updatedCount} mã)!`);
  };

  // Phân tích và lưu dữ liệu dán vào bảng giá vốn Khách Lẻ
  const handleParseAndImportRetailText = async () => {
    if (isPartnerMode()) return;
    if (!retailPasteText.trim()) {
      alert('Vui lòng dán nội dung vào ô trước khi bấm "Thêm / Cập Nhật"!');
      return;
    }

    const lines = retailPasteText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      alert('Không tìm thấy dòng dữ liệu nào hợp lệ!');
      return;
    }

    const nextMap = { ...retailCostMap };
    let importedCount = 0;

    lines.forEach(line => {
      let parts = line.split('\t');
      if (parts.length === 1 && line.includes(',')) {
        parts = line.split(',');
      } else if (parts.length === 1 && line.includes('|')) {
        parts = line.split('|');
      }

      const rawCode = (parts[0] || '').trim();
      if (!rawCode) return;
      const codeKey = rawCode.toUpperCase();
      const existing = nextMap[codeKey];

      const rawName = (parts[1] || '').trim();
      const rawSize = (parts[2] || '').trim();
      const rawNum = parts[3] ? Number(parts[3].replace(/[^\d.-]/g, '')) || 0 : 0;

      const matchedProd = products.find(p => p.code.toUpperCase() === codeKey);
      const name = rawName || existing?.name || matchedProd?.name || rawCode;
      const size = rawSize || existing?.size || matchedProd?.size || '';
      const unitPrice = (matchedProd?.price && matchedProd.price > 0)
        ? matchedProd.price
        : (existing?.unitPrice && existing.unitPrice > 0)
          ? existing.unitPrice
          : rawNum > 0 ? rawNum : 0;

      nextMap[codeKey] = {
        code: rawCode,
        name,
        size,
        unitPrice,
        materialCost: existing?.materialCost !== undefined ? existing.materialCost : 0,
        updatedAt: new Date().toISOString()
      };
      importedCount++;
    });

    setRetailCostMap(nextMap);
    await saveRetailProductCostsToFirestore(nextMap, { email: currentUserEmail });
    setRetailPasteText('');
    showToast(`Đã thêm thành công ${importedCount} mã Khách Lẻ vào bảng! Hãy nhập 'Giá Nguyên Vật Liệu' tương ứng.`);
  };

  // Cập nhật từng ô Giá nguyên vật liệu cho sản phẩm Khách Lẻ
  const handleUpdateRetailCostItem = (codeKey: string, field: 'materialCost' | 'unitPrice' | 'notes', rawVal: any) => {
    if (isPartnerMode()) return;
    const key = codeKey.toUpperCase().trim();
    const existing = retailCostMap[key] || {
      code: codeKey,
      name: '',
      size: '',
      materialCost: 0
    };

    let updatedValue: any = rawVal;
    if (field === 'materialCost' || field === 'unitPrice') {
      const num = typeof rawVal === 'string' ? Number(rawVal.replace(/[^\d]/g, '')) || 0 : Number(rawVal) || 0;
      updatedValue = Math.max(0, num);
    }

    const updatedItem: RetailProductCostItem = {
      ...existing,
      [field]: updatedValue,
      updatedAt: new Date().toISOString()
    };

    const nextMap: RetailProductCostMap = {
      ...retailCostMap,
      [key]: updatedItem
    };

    setRetailCostMap(nextMap);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveRetailProductCostsToFirestore(nextMap, { email: currentUserEmail }).catch(console.error);
    }, 700);
  };

  // Xóa mã sản phẩm khỏi Bảng Giá Vốn Khách Lẻ
  const handleDeleteRetailItem = (codeKey: string, name: string) => {
    if (isPartnerMode()) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa mã "${codeKey}" (${name}) khỏi Bảng Giá Vốn Khách Lẻ?`)) {
      return;
    }
    const key = codeKey.toUpperCase().trim();
    const nextMap = { ...retailCostMap };
    delete nextMap[key];
    setRetailCostMap(nextMap);
    saveRetailProductCostsToFirestore(nextMap, { email: currentUserEmail }).catch(console.error);
    showToast(`Đã xóa mã "${codeKey}" khỏi bảng Giá Vốn Khách Lẻ.`);
  };

  // Nút Lưu Toàn Bộ Bảng Khách Lẻ Lên Cloud
  const handleSaveAllRetailCosts = async () => {
    if (isPartnerMode()) return;
    setIsSaving(true);
    try {
      await saveRetailProductCostsToFirestore(retailCostMap, { email: currentUserEmail });
      showToast('Đã lưu thành công toàn bộ Bảng Giá Vốn Khách Lẻ lên Cloud Firestore!');
    } catch (e) {
      console.error('Error saving retail costs:', e);
      showToast('Lỗi khi lưu bảng giá vốn khách lẻ!');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to find or infer product info from the catalog
  const resolveProduct = (code: string) => resolveProductForCode(code, products);

  // Danh sách toàn bộ mã cần thống kê: 63 mã PDF gốc + các mã GIÁ STUDIO còn lại từ Bảng giá
  const allCodeItems = useMemo(() => {
    const seenCodes = new Set<string>();
    const seenNorms = new Set<string>();
    const items: { code: string; isPreExisting: boolean }[] = [];

    // 1. Quét bổ sung 63 mã PDF gốc
    PDF_STATS_PRODUCT_CODES.forEach(code => {
      const c = (code || '').trim();
      if (!c) return;
      const codeUpper = c.toUpperCase();
      const norm = codeUpper.replace(/[*xX_\-]/g, '');

      if (!seenCodes.has(codeUpper) && !seenNorms.has(norm)) {
        seenCodes.add(codeUpper);
        seenNorms.add(norm);
        items.push({ code: c, isPreExisting: true });
      }
    });

    // 2. Quét bổ sung danh mục sản phẩm "GIÁ STUDIO" chưa có trong danh sách
    const studioCatalogProducts = (products || []).filter(
      p => p && p.category === 'GIÁ STUDIO'
    );

    studioCatalogProducts.forEach(p => {
      const c = (p.code || '').trim();
      if (!c) return;
      const codeUpper = c.toUpperCase();
      const norm = codeUpper.replace(/[*xX_\-]/g, '');

      if (!seenCodes.has(codeUpper) && !seenNorms.has(norm)) {
        seenCodes.add(codeUpper);
        seenNorms.add(norm);
        items.push({ code: c, isPreExisting: false });
      }
    });

    return items;
  }, [products]);

  const allCodes = useMemo(() => {
    return allCodeItems.map(item => item.code);
  }, [allCodeItems]);

  // Bộ nhớ đệm phân loại kích thước, loại khung và quy chuẩn của từng mã sản phẩm
  const codeMetaMap = useMemo(() => {
    const map: Record<string, {
      sizeKey: string;
      frameCat: FrameCategory;
      is4060: boolean;
      filmMaterial: FilmMaterialInfo;
      prodInfo: ReturnType<typeof resolveProductForCode>;
    }> = {};

    allCodes.forEach(code => {
      const prodInfo = resolveProductForCode(code, products);
      map[code] = {
        sizeKey: normalizePhotoSizeKey(prodInfo.size, code, prodInfo.name),
        frameCat: detectFrameCategory(code, prodInfo.name),
        is4060: isSize4060(prodInfo.size, code, prodInfo.name),
        filmMaterial: detectFilmMaterial(code, prodInfo.name),
        prodInfo
      };
    });

    return map;
  }, [allCodes, products]);

  // Tập hợp toàn bộ mã sản phẩm kích thước 40*60
  const all4060Codes = useMemo(() => {
    return allCodes.filter(c => codeMetaMap[c]?.is4060);
  }, [allCodes, codeMetaMap]);

  // 1, 2, 3, 4. TỰ ĐỘNG THAM CHIẾU VÀ ĐỒNG NHẤT CHI PHÍ:
  // - Quy tắc 1 & 2: Phân loại 7 nhóm khung/viền (Bo viền, K0-K3, K4-K9, K10, K11, Titan 1, Titan 2).
  //   Giá khung chỉ phụ thuộc vào KÍCH THƯỚC và NHÓM KHUNG, không phân biệt chất liệu. Lấy giá đã điền làm chuẩn tham chiếu.
  // - Quy tắc 3: Mục "Khác" và "Mực, Giấy" áp dụng đồng nhất cho TẤT CẢ kích thước ảnh (không phân biệt chất liệu/khung).
  // - Quy tắc 4: MÀNG ÉP chỉ phụ thuộc vào KÍCH THƯỚC và 5 CHẤT LIỆU (Lụa, Mika, HD Gương, HD Pro, 4K).
  //   Không phụ thuộc vào khung hay viền. Lấy giá đã có làm chuẩn tham chiếu; nhóm chưa có thì để trống (0), tuyệt đối không đoán giá.
  const { refFrameMap, refOtherMap, refInkMap, refPaperMap, refFilmMap } = useMemo(() => {
    const frameMap: Record<string, number> = {};
    const otherMap: Record<string, number> = {};
    const inkMap: Record<string, number> = {};
    const paperMap: Record<string, number> = {};
    const filmMap: Record<string, number> = {};

    // 1. Quét tìm các giá chuẩn đã nhập trong costMap
    for (const [code, cost] of Object.entries(costMap)) {
      if (!cost) continue;
      const meta = codeMetaMap[code] || {
        sizeKey: normalizePhotoSizeKey(undefined, code),
        frameCat: detectFrameCategory(code),
        is4060: isSize4060(undefined, code),
        filmMaterial: detectFilmMaterial(code),
        prodInfo: resolveProductForCode(code, products)
      };

      // Tham chiếu Mực & Giấy theo kích thước (áp dụng cho tất cả các kích thước)
      if (cost.ink !== undefined && cost.ink > 0 && inkMap[meta.sizeKey] === undefined) {
        inkMap[meta.sizeKey] = cost.ink;
      }
      if (cost.paper !== undefined && cost.paper > 0 && paperMap[meta.sizeKey] === undefined) {
        paperMap[meta.sizeKey] = cost.paper;
      }

      // Tham chiếu Khung / Viền (theo sizeKey + frameCat cho cả 7 nhóm)
      // Lấy giá đã có sẵn hoặc đã điền thủ công làm chuẩn tham chiếu
      if (meta.frameCat !== 'none' && cost.frame !== undefined && cost.frame > 0) {
        const groupKey = `${meta.sizeKey}_${meta.frameCat}`;
        if (frameMap[groupKey] === undefined) {
          frameMap[groupKey] = cost.frame;
        }
      }

      // Tham chiếu Màng Ép: CHỈ phụ thuộc vào [Kích thước] và [Chất liệu] (1 trong 5 loại)
      // Ưu tiên sử dụng chính các mức giá đã điền sẵn này làm giá chuẩn (tham chiếu)
      if (cost.film !== undefined && cost.film > 0 && meta.filmMaterial && meta.filmMaterial.type !== 'unknown') {
        const filmKey = `${meta.sizeKey}_${meta.filmMaterial.type}`;
        if (filmMap[filmKey] === undefined) {
          filmMap[filmKey] = cost.film;
        }
      }

      // Tham chiếu mục "Khác" (theo sizeKey)
      if (cost.other !== undefined && cost.other > 0) {
        if (otherMap[meta.sizeKey] === undefined) {
          otherMap[meta.sizeKey] = cost.other;
        }
      }
    }

    // 2. Điền giá trị chuẩn định mức cho các kích thước chưa có sản phẩm nào nhập thủ công (Mực & Giấy)
    allCodes.forEach(code => {
      const meta = codeMetaMap[code];
      const sizeKey = meta?.sizeKey;
      if (sizeKey) {
        if (inkMap[sizeKey] === undefined || paperMap[sizeKey] === undefined) {
          const defaults = getDefaultInkPaperForSize(sizeKey);
          if (inkMap[sizeKey] === undefined) inkMap[sizeKey] = defaults.ink;
          if (paperMap[sizeKey] === undefined) paperMap[sizeKey] = defaults.paper;
        }
      }
    });

    return {
      refFrameMap: frameMap,
      refOtherMap: otherMap,
      refInkMap: inkMap,
      refPaperMap: paperMap,
      refFilmMap: filmMap
    };
  }, [costMap, codeMetaMap, allCodes]);

  // Compile and sort table rows:
  // 1. Lọc toàn bộ danh sách mã sản phẩm từ Bảng giá sản phẩm (chỉ lấy GIÁ STUDIO)
  // 2. Kết hợp với các sản phẩm đã có trong PDF (định mức trước đó) và bổ sung các sản phẩm còn lại
  // 3. Sắp xếp thứ tự: kích thước từ nhỏ đến lớn (13x18, 15x21, 20x30,...), trong cùng kích thước: Lụa -> Mika phổ thông -> HD gương -> HD pro -> 4K
  const compiledRows = useMemo(() => {
    // Tạo chi tiết cho từng dòng và sắp xếp chuẩn quy tắc
    const mappedRows = allCodeItems.map(({ code }) => {
      const meta = codeMetaMap[code];
      const prodInfo = meta?.prodInfo || resolveProductForCode(code, products);
      const sizeKey = meta?.sizeKey || normalizePhotoSizeKey(prodInfo.size, code, prodInfo.name);
      const frameCat = meta?.frameCat || detectFrameCategory(code, prodInfo.name);
      const is4060 = meta?.is4060 || isSize4060(prodInfo.size, code, prodInfo.name);
      const frameCatLabel = getFrameCategoryLabel(frameCat);
      const userCosts = costMap[code] || {};

      // 1. QUY TẮC MỤC "MỰC, GIẤY" (ĐỒNG NHẤT CHO TẤT CẢ CÁC KÍCH THƯỚC):
      // Dùng chung mức chi phí mực & giấy theo kích thước ảnh, lấy từ mã đã có sẵn / nhập thủ công trong cùng kích thước
      const refInk = refInkMap[sizeKey];
      let resolvedInk = 0;
      let isInkAutoFilled = false;
      if (userCosts.ink !== undefined && userCosts.ink > 0) {
        resolvedInk = userCosts.ink;
        isInkAutoFilled = false;
      } else if (refInk !== undefined && refInk > 0) {
        resolvedInk = refInk;
        isInkAutoFilled = true;
      }

      const refPaper = refPaperMap[sizeKey];
      let resolvedPaper = 0;
      let isPaperAutoFilled = false;
      if (userCosts.paper !== undefined && userCosts.paper > 0) {
        resolvedPaper = userCosts.paper;
        isPaperAutoFilled = false;
      } else if (refPaper !== undefined && refPaper > 0) {
        resolvedPaper = refPaper;
        isPaperAutoFilled = true;
      }

      // 2. CỐT VẬT TƯ (VÁN MDF 9LI, VÁN MDF 12LI, FOMEX 9LI, MDF 9LI HQ):
      // - Phân loại cốt vật tư cho toàn bộ sản phẩm: MDF 9li, MDF 12li, Fomex 9li, MDF 9li HQ (1521/2030) hoặc Không cốt
      // - Tự động đồng bộ giá trực tiếp từ "Bảng Giá Cốt Vật Tư" dựa trên [Loại cốt vật tư] x [Kích thước ảnh]
      const coreBoardInfo = detectProductCoreBoardCategory(code, prodInfo.matchedProduct, prodInfo.name, sizeKey);

      let standardBoardPrice = 0;
      if (coreBoardInfo.category !== 'none') {
        if (coreBoardInfo.category === 'mdf_9li_hq_1521') {
          standardBoardPrice = boardCorePrices['1521 9li HQ']?.mdf9li || DEFAULT_BOARD_CORE_PRICES['1521 9li HQ']?.mdf9li || boardCorePrices['15x21']?.mdf9li || 15000;
        } else if (coreBoardInfo.category === 'mdf_9li_hq_2030') {
          standardBoardPrice = boardCorePrices['2030 9li HQ']?.mdf9li || DEFAULT_BOARD_CORE_PRICES['2030 9li HQ']?.mdf9li || boardCorePrices['20x30']?.mdf9li || 20000;
        } else {
          const boardRow = boardCorePrices[sizeKey] || DEFAULT_BOARD_CORE_PRICES[sizeKey];
          if (boardRow) {
            if (coreBoardInfo.category === 'mdf_9li') standardBoardPrice = boardRow.mdf9li || 0;
            else if (coreBoardInfo.category === 'mdf_12li') standardBoardPrice = boardRow.mdf12li || 0;
            else if (coreBoardInfo.category === 'fomex_9li') standardBoardPrice = boardRow.fomex9li || 0;
          }
        }
      }

      let resolvedBoard = 0;
      let isBoardAutoFilled = false;
      if (coreBoardInfo.category === 'none') {
        resolvedBoard = 0;
        isBoardAutoFilled = false;
      } else if (standardBoardPrice > 0) {
        resolvedBoard = standardBoardPrice;
        isBoardAutoFilled = true;
      } else if (userCosts.board !== undefined && userCosts.board > 0) {
        resolvedBoard = userCosts.board;
        isBoardAutoFilled = false;
      }

      const boardDetails = coreBoardInfo.category !== 'none'
        ? {
            thickness: coreBoardInfo.category === 'mdf_12li' ? ('12li' as const) : ('9li' as const),
            label: coreBoardInfo.label
          }
        : { thickness: 'none' as const, label: 'Không cốt' };

      // 3. MÀNG ÉP (QUY TẮC TỰ ĐỘNG THAM CHIẾU 5 CHẤT LIỆU MÀNG ÉP):
      // - Giá màng ép CHỈ PHỤ THUỘC VÀO 2 YẾU TỐ:
      //   1) Kích thước ảnh (20x30, 40x60, 50x75...)
      //   2) Chất liệu (1 trong 5 loại: Lụa, Mika, HD Gương, HD Pro, 4K).
      // - Loại khung hay kiểu bo viền HOÀN TOÀN KHÔNG ẢNH HƯỞNG đến giá màng ép.
      // - Ưu tiên sử dụng giá đã điền sẵn trong bảng làm giá chuẩn (tham chiếu) để tự động điền cho các mã cùng kích thước & chất liệu.
      // - Với những nhóm [Kích thước + Chất liệu] chưa có giá tham chiếu nào: Để trống (0), TUYỆT ĐỐI KHÔNG tự đoán giá.
      const filmMaterial = meta?.filmMaterial || detectFilmMaterial(code, prodInfo.name);
      const filmGroupKey = filmMaterial.type !== 'unknown' ? `${sizeKey}_${filmMaterial.type}` : '';
      const refFilm = filmGroupKey ? refFilmMap[filmGroupKey] : undefined;

      let resolvedFilm = 0;
      let isFilmAutoFilled = false;

      // Ưu tiên 1: Giá do người dùng nhập thủ công cho chính mã này
      if (userCosts.film !== undefined && userCosts.film > 0) {
        resolvedFilm = userCosts.film;
        isFilmAutoFilled = false;
      }
      // Ưu tiên 2: Tự động điền theo giá tham chiếu của cùng Kích thước + Chất liệu
      else if (filmMaterial.type !== 'unknown' && refFilm !== undefined && refFilm > 0) {
        resolvedFilm = refFilm;
        isFilmAutoFilled = true;
      }
      // Chưa có giá tham chiếu: Để trống (resolvedFilm = 0)

      // 4. NGUYÊN TẮC GIÁ KHUNG / VIỀN (ÁP DỤNG CHO CẢ 7 NHÓM KHUNG/VIỀN - STRICT REFERENCE):
      // - Chỉ được lấy giá tham chiếu của ĐÚNG CÙNG KÍCH THƯỚC + ĐÚNG CÙNG NHÓM KHUNG.
      // - TUYỆT ĐỐI KHÔNG LẤY GIÁ CỦA NHÓM K4-K9 ĐIỀN CHO K0-K3 (và ngược lại).
      // - Nếu một ô thuộc nhóm K0-K3 mà chưa có giá nhập thủ công của đúng nhóm K0-K3 trong kích thước đó, hãy ĐỂ TRỐNG (0).
      const frameGroupKey = frameCat !== 'none' ? `${sizeKey}_${frameCat}` : '';
      const refFrame = frameGroupKey ? refFrameMap[frameGroupKey] : undefined;

      let resolvedFrame = 0;
      let isFrameAutoFilled = false;

      // Ưu tiên 1: Giá do người dùng nhập thủ công cho mã này (kể cả bất kỳ mã nào)
      if (userCosts.frame !== undefined && userCosts.frame > 0) {
        resolvedFrame = userCosts.frame;
        isFrameAutoFilled = false;
      }
      // Ưu tiên 2: Nếu chưa nhập thủ công, lấy theo chuẩn tham chiếu của ĐÚNG nhóm khung trong cùng kích thước
      else if (frameCat !== 'none' && refFrame !== undefined && refFrame > 0) {
        resolvedFrame = refFrame;
        isFrameAutoFilled = true;
      }
      // Nếu chưa có mã nào trong đúng nhóm đó điền giá: để trống (resolvedFrame = 0)

      // 5. QUY TẮC MỤC "KHÁC" (CHI PHÍ KHÁC):
      // - Áp dụng đồng nhất cho TẤT CẢ các kích thước ảnh.
      // - Cùng một kích thước ảnh thì TẤT CẢ các sản phẩm dùng CHUNG 1 mức giá duy nhất cho mục "Khác".
      const refOther = refOtherMap[sizeKey];
      let resolvedOther = 0;
      let isOtherAutoFilled = false;

      if (userCosts.other !== undefined && userCosts.other > 0) {
        resolvedOther = userCosts.other;
        isOtherAutoFilled = false;
      } else if (refOther !== undefined && refOther > 0) {
        resolvedOther = refOther;
        isOtherAutoFilled = true;
      }

      // =====================================================================
      // CÔNG THỨC CHUẨN TỔNG GIÁ VỐN = TỔNG TẤT CẢ 6 THÀNH PHẦN CHI PHÍ CỘNG LẠI:
      // Tổng Giá Vốn = (Mực) + (Giấy) + (Ván/Fomex) + (Màng Ép) + (Khung/Viền) + (Khác)
      // =====================================================================
      const totalCost =
        Number(resolvedInk || 0) +
        Number(resolvedPaper || 0) +
        Number(resolvedBoard || 0) +
        Number(resolvedFilm || 0) +
        Number(resolvedFrame || 0) +
        Number(resolvedOther || 0);

      const studioPrice = (userCosts.manualStudioPrice !== undefined && userCosts.manualStudioPrice > 0)
        ? userCosts.manualStudioPrice
        : prodInfo.studioPrice;
      const grossProfit = studioPrice > 0 ? studioPrice - totalCost : 0;
      const marginOnPrice = studioPrice > 0 ? (grossProfit / studioPrice) * 100 : 0;
      const hasCostData = totalCost > 0;

      return {
        code,
        name: prodInfo.name,
        size: prodInfo.size,
        sizeKey,
        frameCat,
        frameCatLabel,
        isFrameAutoFilled,
        isOtherAutoFilled,
        isInkAutoFilled,
        isPaperAutoFilled,
        isBoardAutoFilled,
        filmMaterial,
        filmMaterialLabel: filmMaterial.label,
        isFilmAutoFilled,
        coreBoardInfo,
        fullTitle: prodInfo.fullTitle,
        studioPrice,
        matchedProduct: prodInfo.matchedProduct,
        is4060,
        boardDetails,
        ink: resolvedInk > 0 ? resolvedInk : userCosts.ink,
        paper: resolvedPaper > 0 ? resolvedPaper : userCosts.paper,
        board: resolvedBoard > 0 ? resolvedBoard : userCosts.board,
        film: resolvedFilm > 0 ? resolvedFilm : userCosts.film,
        frame: resolvedFrame > 0 ? resolvedFrame : userCosts.frame,
        other: resolvedOther > 0 ? resolvedOther : userCosts.other,
        totalCost,
        grossProfit,
        marginOnPrice,
        hasCostData
      };
    });

    // QUY TẮC SẮP XẾP:
    // - Sắp xếp thứ tự các kích thước từ nhỏ đến lớn (bắt đầu từ 13x18, 15x21, 20x30,... và các kích thước lớn hơn)
    // - Trong cùng một mức kích thước, sắp xếp thứ tự các chất liệu từ trên xuống theo đúng chuẩn:
    //   1. Lụa
    //   2. Mika phổ thông
    //   3. HD gương
    //   4. HD pro
    //   5. 4K
    mappedRows.sort((a, b) => {
      const scoreA = parsePhotoSizeScore(a.size);
      const scoreB = parsePhotoSizeScore(b.size);
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }

      const rankA = getPhotoMaterialRank(a.code, a.name);
      const rankB = getPhotoMaterialRank(b.code, b.name);
      if (rankA !== rankB) {
        return rankA - rankB;
      }

      return a.code.localeCompare(b.code);
    });

    // Đánh số thứ tự STT sau khi sắp xếp
    return mappedRows.map((row, idx) => ({
      ...row,
      stt: idx + 1
    }));
  }, [costMap, allCodeItems, codeMetaMap, refFrameMap, refOtherMap, refInkMap, refPaperMap, refFilmMap]);

  // 1. Bảng bóc tách chi tiết vật tư
  const dissectedRows = useMemo(() => {
    return compiledRows
      .filter(r => !deletedImportedCodes.has(r.code.toUpperCase()))
      .filter(r => !isImportedCustomProduct(r.code, r.name, customCodesSet))
      .map((r, idx) => ({ ...r, stt: idx + 1 }));
  }, [compiledRows, deletedImportedCodes, customCodesSet]);

  // 2. Bảng Sản Phẩm Nhập Thành Phẩm & Định Mức Tùy Chỉnh
  const importedCustomRows = useMemo(() => {
    const DEFAULT_TARGET_ITEMS = [
      { code: 'Abat', name: 'Sản Phẩm Abat', size: '', defaultPrice: 0 },
      { code: 'ABMP30x30ST', name: 'Album Mở Phẳng 30x30 10 Tờ', size: '30x30', defaultPrice: 520000 },
      { code: 'ABMP20x30ST', name: 'Album Mở Phẳng 20x30 10 Tờ', size: '20x30', defaultPrice: 390000 },
      { code: 'ABMP20x20', name: 'Album Mở Phẳng 20x20 10 Tờ', size: '20x20', defaultPrice: 290000 },
      { code: 'NEPST1', name: 'Khung Gia Cố 80*120', size: '80*120', defaultPrice: 60000 },
      { code: 'NEPST2', name: 'Khung Gia Cố 100*150', size: '100*150', defaultPrice: 90000 },
      { code: 'NEPST3', name: 'Khung Gia Cố 110*180', size: '110*180', defaultPrice: 120000 }
    ];

    const seenCodes = new Set<string>();
    const list: Array<{
      stt: number;
      code: string;
      name: string;
      size: string;
      importCost: number;
      studioPrice: number;
      grossProfit: number;
      marginOnPrice: number;
    }> = [];

    // Gộp sản phẩm mặc định + sản phẩm người dùng tự thêm
    const allImportedItems = [
      ...DEFAULT_TARGET_ITEMS,
      ...customImportedItems.map(item => ({
        code: item.code,
        name: item.name,
        size: item.size,
        defaultPrice: item.defaultPrice || 0
      }))
    ];

    allImportedItems.forEach(def => {
      const codeUpper = def.code.toUpperCase().trim();
      if (deletedImportedCodes.has(codeUpper)) return;
      if (seenCodes.has(codeUpper)) return;
      seenCodes.add(codeUpper);

      const userCosts = costMap[def.code] || costMap[codeUpper] || {};
      const prodInfo = resolveProductForCode(def.code, products);

      const name = prodInfo.matchedProduct?.name || (prodInfo.name && prodInfo.name !== def.code ? prodInfo.name : def.name);
      const size = prodInfo.size || def.size;
      const studioPrice = (userCosts.manualStudioPrice !== undefined && userCosts.manualStudioPrice > 0)
        ? userCosts.manualStudioPrice
        : (prodInfo.studioPrice || def.defaultPrice);
      const importCost = userCosts.importCost !== undefined
        ? userCosts.importCost
        : (userCosts.other || 0);
      const grossProfit = studioPrice - importCost;
      const marginOnPrice = studioPrice > 0 ? Math.round(((grossProfit / studioPrice) * 100) * 10) / 10 : 0;

      list.push({
        stt: 0,
        code: def.code,
        name,
        size,
        importCost,
        studioPrice,
        grossProfit,
        marginOnPrice
      });
    });

    // Bổ sung các mã sản phẩm đặc thù khác
    compiledRows.forEach(r => {
      const codeUpper = r.code.toUpperCase().trim();
      if (deletedImportedCodes.has(codeUpper)) return;
      if (isImportedCustomProduct(r.code, r.name, customCodesSet) && !seenCodes.has(codeUpper)) {
        seenCodes.add(codeUpper);
        const userCosts = costMap[r.code] || costMap[codeUpper] || {};
        const importCost = userCosts.importCost !== undefined ? userCosts.importCost : (userCosts.other || 0);
        const studioPrice = r.studioPrice;
        const grossProfit = studioPrice - importCost;
        const marginOnPrice = studioPrice > 0 ? Math.round(((grossProfit / studioPrice) * 100) * 10) / 10 : 0;

        list.push({
          stt: 0,
          code: r.code,
          name: r.name,
          size: r.size,
          importCost,
          studioPrice,
          grossProfit,
          marginOnPrice
        });
      }
    });

    return list.map((item, idx) => ({ ...item, stt: idx + 1 }));
  }, [compiledRows, costMap, products, customImportedItems, deletedImportedCodes, customCodesSet]);

  // Lọc danh sách Bảng Bóc Tách
  const filteredDissectedRows = useMemo(() => {
    return dissectedRows.filter(r => {
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
  }, [dissectedRows, searchQuery, filterStatus]);

  // Lọc danh sách Bảng Nhập Thành Phẩm
  const filteredImportedRows = useMemo(() => {
    return importedCustomRows.filter(r => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.size.toLowerCase().includes(q)
      );
    });
  }, [importedCustomRows, searchQuery]);

  // Compatibility alias for filtering
  const filteredRows = filteredDissectedRows;

  // Summary statistics across dissected items
  const statsSummary = useMemo(() => {
    const totalItems = dissectedRows.length;
    const filledItems = dissectedRows.filter(r => r.hasCostData).length;
    const filledRowsList = dissectedRows.filter(r => r.hasCostData && r.studioPrice > 0);

    const totalStudioValue = dissectedRows.reduce((sum, r) => sum + r.studioPrice, 0);
    const totalCostValue = dissectedRows.reduce((sum, r) => sum + r.totalCost, 0);

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
  }, [dissectedRows]);

  // 3. Bảng Giá Vốn Nguyên Vật Liệu Cho Các Sản Phẩm Khách Lẻ
  const retailRows = useMemo(() => {
    const list = Object.values(retailCostMap).map(item => {
      const matched = products.find(p => p.code.toUpperCase() === item.code.toUpperCase());
      const unitPrice = (item.unitPrice !== undefined && item.unitPrice > 0)
        ? item.unitPrice
        : (matched?.price || 0);
      const materialCost = item.materialCost || 0;
      const grossProfit = unitPrice > 0 ? unitPrice - materialCost : 0;
      const marginOnPrice = unitPrice > 0 ? Math.round(((grossProfit / unitPrice) * 100) * 10) / 10 : 0;
      const isPriced = materialCost > 0;

      return {
        ...item,
        unitPrice,
        materialCost,
        grossProfit,
        marginOnPrice,
        isPriced
      };
    });

    return list.filter(r => {
      const query = (retailSearchQuery || searchQuery).toLowerCase().trim();
      if (query) {
        const matchCode = r.code.toLowerCase().includes(query);
        const matchName = r.name.toLowerCase().includes(query);
        const matchSize = (r.size || '').toLowerCase().includes(query);
        if (!matchCode && !matchName && !matchSize) return false;
      }
      if (retailFilterStatus === 'priced' && !r.isPriced) return false;
      if (retailFilterStatus === 'unpriced' && r.isPriced) return false;
      return true;
    }).sort((a, b) => {
      const scoreA = parsePhotoSizeScore(a.size);
      const scoreB = parsePhotoSizeScore(b.size);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return a.code.localeCompare(b.code);
    }).map((item, idx) => ({ ...item, stt: idx + 1 }));
  }, [retailCostMap, products, retailSearchQuery, searchQuery, retailFilterStatus]);

  const retailStats = useMemo(() => {
    const all = Object.values(retailCostMap);
    const total = all.length;
    const priced = all.filter(r => (r.materialCost || 0) > 0).length;
    const unpriced = total - priced;
    const pricedWithSale = all.filter(r => {
      const matched = products.find(p => p.code.toUpperCase() === r.code.toUpperCase());
      const p = (r.unitPrice !== undefined && r.unitPrice > 0) ? r.unitPrice : (matched?.price || 0);
      return p > 0 && (r.materialCost || 0) > 0;
    });
    const avgMargin = pricedWithSale.length > 0
      ? pricedWithSale.reduce((sum, r) => {
          const matched = products.find(p => p.code.toUpperCase() === r.code.toUpperCase());
          const p = (r.unitPrice !== undefined && r.unitPrice > 0) ? r.unitPrice : (matched?.price || 0);
          const gp = p - (r.materialCost || 0);
          return sum + ((gp / p) * 100);
        }, 0) / pricedWithSale.length
      : 0;

    return { total, priced, unpriced, avgMargin: Math.round(avgMargin * 10) / 10 };
  }, [retailCostMap, products]);

  // Handle cell input change with auto-fill & synchronization according to rules
  const handleCostChange = (code: string, field: keyof ProductCostItem, rawVal: string) => {
    if (isPartnerMode()) return; // Chế độ đối tác chỉ xem báo cáo giá thành & lời lãi, không sửa giá vốn gốc
    const val = rawVal === '' ? undefined : Math.max(0, Number(rawVal.replace(/[^0-9]/g, '')) || 0);

    setCostMap(prev => {
      const current = prev[code] || {};
      const updatedItem: ProductCostItem = {
        ...current,
        [field]: val
      };

      const nextMap: ProductCostMap = {
        ...prev,
        [code]: updatedItem
      };

      const meta = codeMetaMap[code] || {
        sizeKey: normalizePhotoSizeKey(undefined, code),
        frameCat: detectFrameCategory(code),
        is4060: isSize4060(undefined, code),
        prodInfo: resolveProductForCode(code, products)
      };

      // 1 & 2. NGUYÊN TẮC GIÁ KHUNG / VIỀN (ÁP DỤNG CHO CẢ 7 NHÓM KHUNG/VIỀN):
      // - Giá khung/viền chỉ phụ thuộc vào KÍCH THƯỚC ẢNH và NHÓM LOẠI KHUNG tương ứng.
      // - HOÀN TOÀN KHÔNG PHÂN BIỆT chất liệu ảnh bên trong (Lụa, Mika, HD Gương, HD Pro, 4K).
      // - Miễn là cùng kích thước và cùng nhóm khung/viền thì giá tiền bằng nhau tuyệt đối.
      // - Tự động lấy giá vừa điền để điền đồng loạt cho tất cả các mã khác cùng kích thước thuộc cùng nhóm khung đó.
      if (field === 'frame' && meta.frameCat !== 'none') {
        allCodes.forEach(otherCode => {
          if (otherCode !== code) {
            const oMeta = codeMetaMap[otherCode];
            if (oMeta && oMeta.sizeKey === meta.sizeKey && oMeta.frameCat === meta.frameCat) {
              nextMap[otherCode] = {
                ...(nextMap[otherCode] || prev[otherCode] || {}),
                frame: val
              };
            }
          }
        });
      }

      // 3. QUY TẮC MỤC "KHÁC" (CHI PHÍ KHÁC):
      // - Áp dụng đồng nhất cho TẤT CẢ các kích thước ảnh.
      // - Cùng một kích thước ảnh thì TẤT CẢ các sản phẩm (không phân biệt chất liệu, loại khung hay viền)
      //   dùng CHUNG 1 mức giá duy nhất cho mục "Khác".
      // - Tự động lấy giá đã nhập thủ công ở bất kỳ sản phẩm nào để áp dụng đồng loạt cho toàn bộ sản phẩm còn lại cùng kích thước.
      if (field === 'other') {
        allCodes.forEach(otherCode => {
          if (otherCode !== code) {
            const oMeta = codeMetaMap[otherCode];
            if (oMeta && oMeta.sizeKey === meta.sizeKey) {
              nextMap[otherCode] = {
                ...(nextMap[otherCode] || prev[otherCode] || {}),
                other: val
              };
            }
          }
        });
      }

      // 4. QUY TẮC MỤC "MỰC, GIẤY" (ĐỒNG NHẤT CHO TẤT CẢ CÁC KÍCH THƯỚC):
      // - Với mỗi kích thước ảnh cụ thể, tất cả các sản phẩm thuộc kích thước đó
      //   (không phân biệt Lụa, Mika, HD Gương, HD Pro, 4K...) sẽ có CHUNG 1 mức chi phí "Mực, Giấy".
      // - Khi nhập giá mực hoặc giấy ở bất kỳ mã nào, tự động điền đồng loạt cho toàn bộ các sản phẩm còn lại cùng kích thước.
      if (field === 'ink' || field === 'paper') {
        allCodes.forEach(otherCode => {
          if (otherCode !== code) {
            const oMeta = codeMetaMap[otherCode];
            if (oMeta && oMeta.sizeKey === meta.sizeKey) {
              nextMap[otherCode] = {
                ...(nextMap[otherCode] || prev[otherCode] || {}),
                [field]: val
              };
            }
          }
        });
      }

      // 5. QUY TẮC MÀNG ÉP (ÁP DỤNG CHO 5 CHẤT LIỆU MÀNG ÉP: LỤA, MIKA, HD GƯƠNG, HD PRO, 4K):
      // - Giá màng ép CHỈ phụ thuộc vào: 1) Kích thước ảnh, 2) Chất liệu. Không phụ thuộc vào khung hay viền.
      // - Khi nhập hoặc sửa giá màng ép cho bất kỳ mã nào, tự động điền đồng loạt cho các mã còn lại CÙNG KÍCH THƯỚC và CÙNG CHẤT LIỆU.
      if (field === 'film' && meta.filmMaterial && meta.filmMaterial.type !== 'unknown') {
        allCodes.forEach(otherCode => {
          if (otherCode !== code) {
            const oMeta = codeMetaMap[otherCode];
            if (
              oMeta &&
              oMeta.sizeKey === meta.sizeKey &&
              oMeta.filmMaterial &&
              oMeta.filmMaterial.type === meta.filmMaterial.type
            ) {
              nextMap[otherCode] = {
                ...(nextMap[otherCode] || prev[otherCode] || {}),
                film: val
              };
            }
          }
        });
      }

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

  // Hàm rà soát toàn bộ bảng từ 13x18 đến 110x180, phát hiện và xóa bỏ mọi giá trị bị điền sai nhóm khung trước đó
  const handleSanitizeMismatchedFrameCosts = (targetCostMap = costMap): { cleanedMap: ProductCostMap; count: number } => {
    const cleanedMap: ProductCostMap = { ...targetCostMap };
    let count = 0;

    // 1. Tìm các mức giá của nhóm K4-K9 theo từng kích thước
    const k49PricesBySize: Record<string, number> = {};
    allCodes.forEach(code => {
      const meta = codeMetaMap[code];
      const cCost = targetCostMap[code];
      if (meta && meta.frameCat === 'k4_9' && cCost?.frame && cCost.frame > 0) {
        if (!k49PricesBySize[meta.sizeKey]) {
          k49PricesBySize[meta.sizeKey] = cCost.frame;
        }
      }
    });

    // 2. Rà soát các mã thuộc nhóm K0-K3: Nếu giá khung của K0-K3 bị gán bằng đúng giá K4-K9 của kích thước đó
    // (do lỗi tự động điền lầm trước đây), xóa bỏ giá sai để ô trở về trạng thái để trống (0)
    allCodes.forEach(code => {
      const meta = codeMetaMap[code];
      const cCost = cleanedMap[code];
      if (!meta || !cCost || !cCost.frame) return;

      if (meta.frameCat === 'k0_3') {
        const k49Price = k49PricesBySize[meta.sizeKey];
        if (k49Price && cCost.frame === k49Price) {
          cleanedMap[code] = {
            ...cCost,
            frame: undefined
          };
          count++;
        }
      }
    });

    return { cleanedMap, count };
  };

  // Tự động rà soát khi khởi chạy để xóa bỏ bất kỳ giá trị K0-K3 nào bị gán nhầm từ K4-K9 trong cơ sở dữ liệu cũ
  useEffect(() => {
    if (Object.keys(costMap).length === 0 || allCodes.length === 0) return;
    const { cleanedMap, count } = handleSanitizeMismatchedFrameCosts(costMap);
    if (count > 0) {
      setCostMap(cleanedMap);
      saveProductCostsToFirestore(cleanedMap).catch(err => {
        console.error('Error auto-cleaning mismatched frame costs:', err);
      });
      showToast(`Đã tự động rà soát & làm sạch ${count} mã bị gán nhầm nhóm khung K0-K3!`);
    }
  }, [allCodes, codeMetaMap]);

  // Nút Áp dụng Tự Động Điền & Lưu Toàn Bộ Ô Trống lên Cloud Firestore
  const handleApplyAutoFillAndSave = async () => {
    if (isPartnerMode()) return;
    setIsSaving(true);
    try {
      const fullMap: ProductCostMap = { ...costMap };
      let updatedCount = 0;

      compiledRows.forEach(r => {
        const existing = fullMap[r.code] || {};
        let changed = false;
        const item: ProductCostItem = { ...existing };

        if (r.frame !== undefined && r.frame > 0 && (existing.frame === undefined || existing.frame === 0 || existing.frame !== r.frame)) {
          item.frame = r.frame;
          changed = true;
        }
        if (r.film !== undefined && r.film > 0 && (existing.film === undefined || existing.film === 0 || existing.film !== r.film)) {
          item.film = r.film;
          changed = true;
        }
        if (r.other !== undefined && r.other > 0 && (existing.other === undefined || existing.other === 0 || existing.other !== r.other)) {
          item.other = r.other;
          changed = true;
        }
        if (r.ink !== undefined && r.ink > 0 && (existing.ink === undefined || existing.ink === 0 || existing.ink !== r.ink)) {
          item.ink = r.ink;
          changed = true;
        }
        if (r.paper !== undefined && r.paper > 0 && (existing.paper === undefined || existing.paper === 0 || existing.paper !== r.paper)) {
          item.paper = r.paper;
          changed = true;
        }
        if (r.board !== undefined && r.board > 0 && (existing.board === undefined || existing.board === 0 || existing.board !== r.board)) {
          item.board = r.board;
          changed = true;
        }
        if (r.studioPrice > 0 && (!existing.manualStudioPrice || existing.manualStudioPrice === 0)) {
          item.manualStudioPrice = r.studioPrice;
          changed = true;
        }

        if (changed) {
          fullMap[r.code] = item;
          updatedCount++;
        }
      });

      await saveProductCostsToFirestore(fullMap);
      setCostMap(fullMap);
      showToast(`Đã tự động điền & đồng bộ thành công ${updatedCount} mã sản phẩm lên Cloud!`);
    } catch (e) {
      console.error('Error applying auto-fill:', e);
      showToast('Lỗi khi tự động điền và lưu dữ liệu giá vốn!');
    } finally {
      setIsSaving(false);
    }
  };

  // Manual explicit save button
  const handleManualSave = async () => {
    if (isPartnerMode()) return;
    setIsSaving(true);
    try {
      // Đảm bảo toàn bộ giá trị đã tính & tự động điền tham chiếu được lưu trọn vẹn lên Firestore
      const fullMap: ProductCostMap = { ...costMap };
      compiledRows.forEach(r => {
        fullMap[r.code] = {
          ...(fullMap[r.code] || {}),
          ink: r.ink,
          paper: r.paper,
          board: r.board,
          film: r.film,
          frame: r.frame,
          other: r.other,
          manualStudioPrice: r.studioPrice
        };
      });

      await saveProductCostsToFirestore(fullMap);
      setCostMap(fullMap);
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

      {/* SUB-TABLE TAB NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveCostTab('dissected')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 ${
            activeCostTab === 'dissected'
              ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Table2 className="w-4 h-4" />
          <span>Bảng 1: Định Mức Bóc Tách Vật Tư ({dissectedRows.length} mã)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCostTab('imported')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 ${
            activeCostTab === 'imported'
              ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Bảng 2: Sản Phẩm Nhập Thành Phẩm & Định Mức Tùy Chỉnh ({importedCustomRows.length} mã)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCostTab('retail')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 ${
            activeCostTab === 'retail'
              ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <User className="w-4 h-4 text-emerald-300" />
          <span>Bảng 3: Giá Vốn Nguyên Vật Liệu Cho Các Sản Phẩm Khách Lẻ ({retailStats.total} mã)</span>
        </button>
      </div>

      {/* TOP HEADER & CONTROL PANEL */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`p-2 rounded-xl ${activeCostTab === 'retail' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>
                {activeCostTab === 'retail' ? <User className="w-5 h-5" /> : <Table2 className="w-5 h-5" />}
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  {activeCostTab === 'retail'
                    ? 'Bảng Giá Vốn Nguyên Vật Liệu Cho Các Sản Phẩm Khách Lẻ'
                    : activeCostTab === 'dissected'
                    ? 'Bảng Thống Kê Định Mức Giá Vốn & Tỷ Suất Lợi Nhuận Gộp'
                    : 'Bảng Sản Phẩm Nhập Thành Phẩm & Định Mức Tùy Chỉnh'}
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full font-mono ${
                    activeCostTab === 'retail'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}>
                    {activeCostTab === 'retail'
                      ? `${retailStats.total} Mã Khách Lẻ`
                      : activeCostTab === 'dissected'
                      ? `${dissectedRows.length} Mã Bóc Tách`
                      : `${importedCustomRows.length} Mã Nhập Thành Phẩm`}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeCostTab === 'retail'
                    ? 'Dán danh sách mã SP Khách Lẻ (từ Bảng Giá Mã Sản Phẩm mục Khách Lẻ) và nhập "Giá Nguyên Vật Liệu". Mỗi khi xuất hiện hóa đơn bán hàng Khách Lẻ, hệ thống sẽ tự động tra cứu vào bảng này để lấy giá vốn.'
                    : activeCostTab === 'dissected'
                    ? 'Tự động liên kết Tên hàng & Giá bán Studio từ Bảng Giá Sản Phẩm. Bóc tách 6 thành phần chi phí (Mực, Giấy, Ván, Màng, Khung, Khác).'
                    : 'Dành riêng cho các mã sản phẩm mua nguyên chiếc, nhập thành phẩm hoặc định mức tùy chỉnh (Abat, Album mở phẳng, Khung nẹp gia cố...). Cho phép tự nhập Giá vốn nhập thủ công.'}
                </p>
                {activeCostTab === 'dissected' && (
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-950 border border-emerald-300 font-semibold shadow-2xs">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span><strong>7 Nhóm Khung / Viền:</strong> Bo viền, K0-K3, K4-K9, K10, K11, Titan 1, Titan 2</span>
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-950 border border-indigo-300 font-semibold shadow-2xs">
                      <Sparkles className="w-3 h-3 text-indigo-600" />
                      <span><strong>Mực, Giấy & Khác:</strong> Đồng nhất theo kích thước ảnh</span>
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-teal-50 text-teal-950 border border-teal-300 font-semibold shadow-2xs">
                      <Sparkles className="w-3 h-3 text-teal-600" />
                      <span><strong>Cốt Vật Tư:</strong> Đồng bộ từ Bảng Giá Cốt</span>
                    </span>
                  </div>
                )}
                {activeCostTab === 'retail' && (
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-950 border border-emerald-300 font-semibold shadow-2xs">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span><strong>Tự Động Liên Kết Doanh Số:</strong> Hóa đơn Khách Lẻ tự động trích xuất Giá vốn NVL tại bảng này</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {activeCostTab === 'retail' && (
              <button
                type="button"
                onClick={handleAutoPopulateFromRetailCatalog}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-bold transition cursor-pointer shadow-2xs disabled:opacity-50"
                title="Đồng bộ danh sách sản phẩm từ bảng giá Khách Lẻ"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Nạp Từ Bảng Giá Khách Lẻ</span>
              </button>
            )}

            {activeCostTab === 'dissected' && (
              <>
                <button
                  type="button"
                  onClick={handleApplyAutoFillAndSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 text-xs font-bold transition cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Tự động áp dụng tất cả các giá chuẩn tham chiếu cho các ô còn trống"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Điền Tự Động & Đồng Bộ</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const { cleanedMap, count } = handleSanitizeMismatchedFrameCosts(costMap);
                    setCostMap(cleanedMap);
                    saveProductCostsToFirestore(cleanedMap).catch(err => console.error(err));
                    showToast(count > 0
                      ? `Đã rà soát & xóa bỏ ${count} mã bị gán nhầm nhóm khung!`
                      : 'Toàn bộ bảng đã chuẩn xác, không có mã nào bị gán nhầm nhóm khung!');
                  }}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-bold transition cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Rà soát toàn bộ bảng xóa bỏ các giá trị bị tự động điền sai nhóm khung"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                  <span>Rà Soát Nhóm Khung</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              title="Xuất file Excel / CSV đầy đủ bảng thống kê"
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
              onClick={activeCostTab === 'retail' ? handleSaveAllRetailCosts : handleManualSave}
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
            <span className="text-[11px] text-slate-500 font-bold block">Tổng số mã đang theo dõi</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-mono text-xl sm:text-2xl font-black text-slate-900">
                {activeCostTab === 'retail'
                  ? `${retailStats.total} mã`
                  : activeCostTab === 'dissected'
                  ? `${statsSummary.totalItems} mã`
                  : `${importedCustomRows.length} mã`}
              </span>
              {activeCostTab === 'retail' && (
                <span className="text-[11px] font-semibold text-emerald-700">
                  (Đã có giá NVL: {retailStats.priced}/{retailStats.total} - Chờ điền: {retailStats.unpriced})
                </span>
              )}
              {activeCostTab === 'dissected' && (
                <span className="text-[11px] font-semibold text-emerald-700">
                  (Đã nhập: {statsSummary.filledItems}/{statsSummary.totalItems})
                </span>
              )}
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
            <span className="text-[11px] text-amber-800 font-bold block">Tỷ Suất LNG / Giá Bán TB</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-mono text-xl sm:text-2xl font-black text-amber-950">
                {activeCostTab === 'retail'
                  ? (retailStats.avgMargin > 0 ? `${retailStats.avgMargin}%` : '—')
                  : activeCostTab === 'dissected'
                  ? (statsSummary.avgMarginOnPrice > 0 ? `${statsSummary.avgMarginOnPrice}%` : '—')
                  : (() => {
                      const filled = importedCustomRows.filter(r => r.studioPrice > 0);
                      if (filled.length === 0) return '—';
                      const avg = filled.reduce((s, r) => s + r.marginOnPrice, 0) / filled.length;
                      return `${Math.round(avg * 10) / 10}%`;
                    })()}
              </span>
              <span className="text-[10px] text-amber-700">
                (Biên lợi nhuận gộp)
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
              placeholder="Tìm theo mã hàng (VD: INKL, LVKL, MKKL, HDKL...) hoặc tên sản phẩm..."
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

          {activeCostTab === 'retail' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-500 font-medium">Lọc:</span>
              {[
                { id: 'all' as const, label: `Tất cả (${retailStats.total})` },
                { id: 'priced' as const, label: `Đã có giá NVL (${retailStats.priced})` },
                { id: 'unpriced' as const, label: `Chờ nhập giá NVL (${retailStats.unpriced})` }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRetailFilterStatus(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    retailFilterStatus === tab.id
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {activeCostTab === 'dissected' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-500 font-medium">Lọc:</span>
              {[
                { id: 'all' as const, label: `Tất cả (${dissectedRows.length})` },
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
          )}
        </div>
      </div>

      {/* SPREADSHEET TABLE: TAB 3 - GIÁ VỐN NGUYÊN VẬT LIỆU CHO CÁC SẢN PHẨM KHÁCH LẺ */}
      {activeCostTab === 'retail' ? (
        <div className="space-y-4">
          {/* Ô DÁN THÔNG TIN ĐÃ COPY TỪ BẢNG GIÁ MÃ SẢN PHẨM MỤC KHÁCH LẺ */}
          <div className="bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-white rounded-2xl border-2 border-dashed border-emerald-300 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                  <ClipboardPaste className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="font-black text-sm sm:text-base text-emerald-950 flex items-center gap-2">
                    Ô Dán Thông Tin Mã Sản Phẩm Khách Lẻ
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-400">
                      Sao Chép & Dán
                    </span>
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Dán nội dung gồm <strong>Mã Sản Phẩm, Tên Hàng Hóa, Kích Thước</strong> (đã copy bên Bảng Giá Mã Sản Phẩm mục Khách Lẻ) vào ô bên dưới, sau đó nhập <strong>Giá Nguyên Vật Liệu</strong> tương ứng.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleAutoPopulateFromRetailCatalog}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs transition cursor-pointer"
                  title="Tự động đồng bộ toàn bộ mã Khách Lẻ từ danh mục sản phẩm vào bảng (không làm mất giá NVL đã nhập)"
                >
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>⚡ Nạp Tự Động Từ Bảng Giá Khách Lẻ (1-Click)</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <textarea
                rows={4}
                value={retailPasteText}
                onChange={(e) => setRetailPasteText(e.target.value)}
                placeholder="Dán các thông tin đã copy bên mục Khách Lẻ vào đây (hỗ trợ nhiều dòng, mỗi dòng gồm Mã Sản Phẩm [Tab] Tên Hàng Hóa [Tab] Kích Thước [Tab] Đơn Giá)...&#10;Ví dụ:&#10;INKL1015	In Ảnh Lụa Khách Lẻ 10x15	10x15	15000&#10;LVKL6090	Ảnh Lụa Viền Khách Lẻ 60x90	60x90	280000"
                className="w-full p-3 bg-white border border-emerald-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden resize-y shadow-inner"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-200/60">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                  title="Dán nhanh nội dung từ bộ nhớ tạm hoặc bộ nhớ đệm đã lưu khi copy"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  <span>Dán Từ Bộ Nhớ Tạm</span>
                </button>

                {retailPasteText.trim() && (
                  <button
                    type="button"
                    onClick={() => setRetailPasteText('')}
                    className="px-3 py-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Xóa Ô Dán
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleParseAndImportRetailText}
                disabled={!retailPasteText.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                <span>✅ Thêm / Cập Nhật Vào Bảng Giá Vốn</span>
              </button>
            </div>
          </div>

          {/* SPREADSHEET TABLE CHO SẢN PHẨM KHÁCH LẺ */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                <span className="font-extrabold text-sm text-emerald-300">
                  DANH SÁCH GIÁ VỐN NGUYÊN VẬT LIỆU KHÁCH LẺ ({retailRows.length} SẢN PHẨM)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Tự động áp dụng giá vốn cho mọi hóa đơn bán hàng Khách Lẻ có mã tương ứng</span>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-900 text-white font-bold border-b border-slate-800 shadow-xs">
                  <tr>
                    <th className="py-3 px-2 w-10 text-center bg-slate-950 font-mono text-[11px]">STT</th>
                    <th className="py-3 px-3 w-36 text-emerald-300 font-mono text-xs">Mã Sản Phẩm</th>
                    <th className="py-3 px-3 min-w-[220px]">Tên Hàng Hóa Khách Lẻ</th>
                    <th className="py-3 px-2 w-24 text-center bg-slate-800 font-mono">Kích Thước</th>
                    <th className="py-3 px-3 w-32 text-right bg-slate-800/90 text-indigo-200">Đơn Giá Bán (đ)</th>
                    <th className="py-3 px-3 w-44 text-right bg-emerald-950 text-emerald-300 font-black border-l border-emerald-800">
                      Giá Nguyên Vật Liệu (đ)
                      <span className="block text-[9px] text-emerald-400 font-normal">Cột nhập giá vốn NVL</span>
                    </th>
                    <th className="py-3 px-3 w-32 text-right bg-slate-800/80 text-emerald-300">Lợi Nhuận Gộp (đ)</th>
                    <th className="py-3 px-2 w-28 text-center bg-slate-800/80 text-amber-300">Tỷ Suất LNG (%)</th>
                    <th className="py-3 px-2 w-16 text-center bg-slate-950">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {retailRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <ClipboardPaste className="w-8 h-8 text-slate-300" />
                          <p className="font-semibold text-sm">Chưa có sản phẩm khách lẻ nào trong bảng</p>
                          <p className="text-xs text-slate-400 max-w-md">
                            Hãy copy mã sản phẩm từ tab "Bảng giá mã sản phẩm (Mục Khách Lẻ)" rồi dán vào ô bên trên, hoặc bấm nút <strong>"⚡ Nạp Tự Động Từ Bảng Giá Khách Lẻ"</strong> để nạp ngay lập tức!
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    retailRows.map((row) => (
                      <tr key={row.code} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="py-2.5 px-2 text-center font-mono text-slate-400 text-[11px] bg-slate-50/50">
                          {row.stt}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-950">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-900 inline-block">
                            {row.code}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {row.name}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600 bg-slate-50/50">
                          {row.size || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-950">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={row.unitPrice > 0 ? formatNumber(row.unitPrice) : ''}
                            onChange={(e) => handleUpdateRetailCostItem(row.code, 'unitPrice', e.target.value)}
                            placeholder="0"
                            className="w-28 px-2 py-1 bg-white border border-indigo-200 rounded-lg text-right font-mono font-bold text-indigo-950 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden shadow-2xs"
                          />
                        </td>
                        {/* CỘT GIÁ NGUYÊN VẬT LIỆU - CHO PHÉP NHẬP VÀ LƯU TRỰC TIẾP */}
                        <td className="py-2.5 px-3 text-right bg-emerald-50/40 border-l border-emerald-200">
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={row.materialCost > 0 ? formatNumber(row.materialCost) : ''}
                              onChange={(e) => handleUpdateRetailCostItem(row.code, 'materialCost', e.target.value)}
                              placeholder="Nhập giá NVL..."
                              className={`w-36 px-2.5 py-1.5 rounded-lg text-right font-mono font-bold text-xs outline-hidden shadow-2xs transition ${
                                row.materialCost > 0
                                  ? 'bg-emerald-50 border border-emerald-400 text-emerald-950 focus:ring-2 focus:ring-emerald-500'
                                  : 'bg-amber-50/80 border border-amber-300 text-amber-900 placeholder:text-amber-400 focus:ring-2 focus:ring-amber-500'
                              }`}
                            />
                          </div>
                        </td>
                        {/* LỢI NHUẬN GỘP */}
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-xs">
                          {row.unitPrice > 0 ? (
                            <span className={row.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                              {formatCurrency(row.grossProfit)}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>
                        {/* TỶ SUẤT LNG (%) */}
                        <td className="py-2.5 px-2 text-center">
                          {row.unitPrice > 0 ? (
                            <span className={`inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${getMarginBadge(row.marginOnPrice, true)}`}>
                              {row.marginOnPrice >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              <span>{row.marginOnPrice.toFixed(1)}%</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>
                        {/* THAO TÁC XÓA */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRetailItem(row.code, row.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Xóa mã này khỏi bảng giá vốn khách lẻ"
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

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Quy tắc tính giá vốn Khách Lẻ:</strong> Khi xuất hiện đơn hàng của Khách Lẻ có mã sản phẩm trong bảng này, hệ thống sẽ tự động lấy đơn giá từ cột <em>"Giá Nguyên Vật Liệu"</em> nhân với số lượng bán để tính vào chi phí vật tư và lợi nhuận thuần.
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : activeCostTab === 'imported' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
          <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800">
            <div>
              <h4 className="font-extrabold text-sm sm:text-base text-amber-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                DANH MỤC SẢN PHẨM NHẬP THÀNH PHẨM & ĐỊNH MỨC TÙY CHỈNH
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Bảng dành riêng cho các mã sản phẩm mua nguyên chiếc / nhập thành phẩm hoặc giá vốn tùy chỉnh (Abat, Album mở phẳng, Khung nẹp gia cố...). KHÔNG bóc tách chi tiết vật tư Mực, Giấy, Ván, Màng, Khung.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Sản Phẩm Mới</span>
              </button>
              <div className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-xl font-bold font-mono">
                Hiển thị {filteredImportedRows.length} Sản phẩm
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-slate-800 text-white font-bold border-b border-slate-700 shadow-xs">
                <tr>
                  <th className="py-3.5 px-3 w-12 text-center bg-slate-950 font-mono text-[11px]">STT</th>
                  <th className="py-3.5 px-4 w-44 text-amber-300 font-mono text-xs">Mã Sản Phẩm</th>
                  <th className="py-3.5 px-4 min-w-[220px]">Tên & Kích Thước Sản Phẩm</th>
                  <th className="py-3.5 px-4 w-52 text-right bg-slate-900 text-amber-300 border-l border-slate-700">
                    Giá Vốn Nhập / Chi Phí Thành Phẩm (VNĐ)
                    <span className="block text-[9px] text-amber-200 font-normal">Cho phép tự nhập thủ công</span>
                  </th>
                  <th className="py-3.5 px-4 w-48 text-right bg-slate-900 text-indigo-300 border-l border-slate-700">
                    Giá Bán Sỉ/Studio (VNĐ)
                    <span className="block text-[9px] text-indigo-200 font-normal">Liên kết Bảng giá SP</span>
                  </th>
                  <th className="py-3.5 px-4 w-48 text-right bg-emerald-950 text-emerald-300 border-l border-slate-700">
                    Lợi Nhuận Gộp (VNĐ)
                    <span className="block text-[9px] text-emerald-200 font-normal">[Giá Bán Sỉ] - [Giá Vốn Nhập]</span>
                  </th>
                  <th className="py-3.5 px-4 w-40 text-center bg-amber-950 text-amber-200 border-l border-slate-700">
                    Tỷ Suất LNG (%)
                    <span className="block text-[9px] text-amber-300 font-normal">([LNG] / [Giá Bán Sỉ]) * 100</span>
                  </th>
                  <th className="py-3.5 px-3 w-28 text-center bg-slate-950 text-slate-300 border-l border-slate-700">
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredImportedRows.map((row) => {
                  const getMarginBadge = (margin: number, hasPrice: boolean) => {
                    if (!hasPrice) return 'bg-slate-100 text-slate-400 border-slate-200';
                    if (margin >= 50) return 'bg-emerald-100 text-emerald-950 border-emerald-300 font-extrabold';
                    if (margin >= 30) return 'bg-sky-100 text-sky-950 border-sky-300 font-bold';
                    if (margin > 0) return 'bg-amber-100 text-amber-950 border-amber-300 font-bold';
                    return 'bg-rose-100 text-rose-950 border-rose-300 font-black';
                  };

                  return (
                    <tr key={row.code} className="hover:bg-amber-50/40 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono font-medium text-[11px] bg-slate-50/50">
                        {row.stt}
                      </td>

                      {/* Mã Sản Phẩm */}
                      <td className="py-3 px-4 font-mono font-black text-amber-950 bg-amber-50/40 text-xs">
                        <span className="px-2 py-0.5 rounded bg-amber-100/80 border border-amber-300">
                          {row.code}
                        </span>
                      </td>

                      {/* Tên & Kích Thước Sản Phẩm */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-xs">
                          {row.name}
                        </div>
                        {row.size && (
                          <span className="inline-block mt-0.5 font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                            Khổ: {row.size}
                          </span>
                        )}
                      </td>

                      {/* Giá Vốn Nhập / Chi Phí Thành Phẩm (VNĐ) - Cho phép tự nhập thủ công */}
                      <td className="py-2 px-4 text-right bg-amber-50/20 border-l border-slate-200">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.importCost > 0 ? formatNumber(row.importCost) : ''}
                          onChange={(e) => handleCostChange(row.code, 'importCost', e.target.value)}
                          placeholder="Nhập giá vốn thủ công..."
                          title="Giá vốn nhập / chi phí thành phẩm cho 1 sản phẩm. Tự động liên kết vào báo cáo Lợi Nhuận Gộp hàng ngày."
                          className="w-40 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-right font-mono font-bold text-amber-950 text-xs focus:ring-2 focus:ring-amber-500 focus:bg-amber-50/50 outline-hidden shadow-2xs"
                        />
                      </td>

                      {/* Giá Bán Sỉ/Studio (VNĐ) */}
                      <td className="py-2 px-4 text-right bg-indigo-50/20 border-l border-slate-200">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.studioPrice > 0 ? formatNumber(row.studioPrice) : ''}
                          onChange={(e) => handleCostChange(row.code, 'manualStudioPrice', e.target.value)}
                          placeholder="Nhập giá studio..."
                          title="Giá bán sỉ / Studio từ Bảng giá sản phẩm, có thể nhập điều chỉnh"
                          className="w-36 px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-right font-mono font-bold text-indigo-950 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden shadow-2xs"
                        />
                      </td>

                      {/* Lợi Nhuận Gộp (VNĐ) = [Giá Bán Sỉ] - [Giá Vốn Nhập] */}
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-700 bg-emerald-50/30 border-l border-slate-200 text-xs">
                        {row.studioPrice > 0 ? (
                          <span className={row.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600 font-black'}>
                            {row.grossProfit < 0 ? '-' : ''}{formatCurrency(Math.abs(row.grossProfit))}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Tỷ Suất Lợi Nhuận Gộp (%) */}
                      <td className="py-3 px-4 text-center border-l border-slate-200">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono border shadow-2xs ${getMarginBadge(row.marginOnPrice, row.studioPrice > 0)}`}>
                          {row.studioPrice > 0 ? (
                            <>
                              {row.marginOnPrice >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              <span>{row.marginOnPrice.toFixed(1)}%</span>
                            </>
                          ) : (
                            <span>—</span>
                          )}
                        </span>
                      </td>

                      {/* Thao tác Sửa / Xóa */}
                      <td className="py-3 px-3 text-center border-l border-slate-200">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(row)}
                            title="Sửa thông tin tên, khổ, giá"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteImportedProduct(row.code, row.name)}
                            title="Xóa sản phẩm này khỏi bảng"
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Tính liên kết hệ thống:</strong> Khi bán các sản phẩm trong bảng này, hệ thống sẽ tự động lấy [Giá Vốn Nhập] ở đây để tính vào cột "Chi Phí Nguyên Vật Liệu" & "Lợi Nhuận Gộp Ước Tính" trong báo cáo doanh số phát sinh hàng ngày và 12 tháng.
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* SPREADSHEET TABLE: TAB 1 - BÓC TÁCH CHI TIẾT VẬT TƯ */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto max-h-[75vh]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-slate-900 text-white font-bold border-b border-slate-800 shadow-xs">
                <tr>
                  <th className="py-3 px-2 w-10 text-center bg-slate-950 font-mono text-[11px]">STT</th>
                  <th className="py-3 px-3 w-36 text-amber-300 font-mono text-xs">Mã Sản Phẩm</th>
                  <th className="py-3 px-3 min-w-[200px]">Tên và Kích Thước Sản Phẩm</th>
                  <th className="py-3 px-2 w-24 text-center bg-slate-800/80" title="Quy tắc 3: Dùng chung 1 mức giá Mực cho toàn bộ sản phẩm cùng kích thước. Tự động lấy giá đã có hoặc đã điền thủ công.">
                    Mực (đ)
                    <span className="block text-[9px] text-amber-300 font-normal">Đồng nhất khổ</span>
                  </th>
                  <th className="py-3 px-2 w-24 text-center bg-slate-800/80" title="Quy tắc 3: Dùng chung 1 mức giá Giấy cho toàn bộ sản phẩm cùng kích thước. Tự động lấy giá đã có hoặc đã điền thủ công.">
                    Giấy (đ)
                    <span className="block text-[9px] text-amber-300 font-normal">Đồng nhất khổ</span>
                  </th>
                  <th
                    className="py-3 px-2 w-28 text-center bg-slate-800/80"
                    title="Tự động đồng bộ từ Bảng Giá Cốt Vật Tư theo [Loại cốt vật tư] x [Kích thước ảnh]"
                  >
                    Ván/Fomex (đ)
                    <span className="block text-[9px] text-emerald-300 font-normal">Đồng bộ giá cốt</span>
                  </th>
                  <th
                    className="py-3 px-2 w-28 text-center bg-slate-800/80"
                    title="Quy tắc màng ép: Giá chỉ phụ thuộc vào Kích thước ảnh và 5 chất liệu (Lụa, Mika, HD Gương, HD Pro, 4K). Không phụ thuộc vào loại khung hay bo viền."
                  >
                    Màng Ép (đ)
                    <span className="block text-[9px] text-emerald-300 font-normal">5 chất liệu chuẩn</span>
                  </th>
                  <th className="py-3 px-2 w-28 text-center bg-slate-800/80" title="Quy tắc 1 & 2: Phân loại 7 nhóm (Bo viền, K0-K3, K4-K9, K10, K11, Titan 1, Titan 2). Giá bằng nhau tuyệt đối theo kích thước và nhóm khung, không phân biệt chất liệu.">
                    Khung/Viền (đ)
                    <span className="block text-[9px] text-amber-300 font-normal">7 nhóm chuẩn</span>
                  </th>
                  <th className="py-3 px-2 w-24 text-center bg-slate-800/80" title="Quy tắc 3: Dùng chung 1 mức giá Khác cho toàn bộ sản phẩm cùng kích thước. Tự động lấy giá đã có hoặc đã điền thủ công.">
                    Khác (đ)
                    <span className="block text-[9px] text-amber-300 font-normal">Đồng nhất khổ</span>
                  </th>
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
                {filteredDissectedRows.map((row) => {
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
                    <tr key={`${row.code}_${row.stt}`} className="hover:bg-amber-50/30 transition-colors group">
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
                          value={row.ink !== undefined && row.ink > 0 ? formatNumber(row.ink) : ''}
                          onChange={(e) => handleCostChange(row.code, 'ink', e.target.value)}
                          placeholder="0"
                          title={
                            row.isInkAutoFilled
                              ? `Tự động điền theo chuẩn chi phí mực khổ ${row.size}`
                              : `Chi phí mực in khổ ${row.size} (tự động đồng nhất theo kích thước)`
                          }
                          className={`w-full px-2 py-1 bg-white border rounded-lg text-right font-mono text-xs focus:bg-amber-50/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden ${
                            row.isInkAutoFilled
                              ? 'border-emerald-400 bg-emerald-50/40 text-emerald-950 font-bold'
                              : row.ink && row.ink > 0
                              ? 'border-slate-300 text-slate-900 font-semibold'
                              : 'border-slate-200'
                          }`}
                        />
                        {row.isInkAutoFilled ? (
                          <div
                            className="text-[9px] text-emerald-700 font-bold mt-0.5 text-right flex items-center justify-end gap-0.5"
                            title={`Tự động lấy theo chuẩn chi phí mực khổ ${row.size}`}
                          >
                            <Sparkles className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                            <span>Tự điền ({row.size})</span>
                          </div>
                        ) : (
                          <div className="text-[9px] text-slate-500 font-medium mt-0.5 text-right px-0.5">
                            Khổ {row.size}
                          </div>
                        )}
                      </td>

                      {/* 2. Giấy */}
                      <td className="py-1.5 px-1.5 text-center bg-slate-50/30">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.paper !== undefined && row.paper > 0 ? formatNumber(row.paper) : ''}
                          onChange={(e) => handleCostChange(row.code, 'paper', e.target.value)}
                          placeholder="0"
                          title={
                            row.isPaperAutoFilled
                              ? `Tự động điền theo chuẩn chi phí giấy khổ ${row.size}`
                              : `Chi phí giấy in khổ ${row.size} (tự động đồng nhất theo kích thước)`
                          }
                          className={`w-full px-2 py-1 bg-white border rounded-lg text-right font-mono text-xs focus:bg-amber-50/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden ${
                            row.isPaperAutoFilled
                              ? 'border-emerald-400 bg-emerald-50/40 text-emerald-950 font-bold'
                              : row.paper && row.paper > 0
                              ? 'border-slate-300 text-slate-900 font-semibold'
                              : 'border-slate-200'
                          }`}
                        />
                        {row.isPaperAutoFilled ? (
                          <div
                            className="text-[9px] text-emerald-700 font-bold mt-0.5 text-right flex items-center justify-end gap-0.5"
                            title={`Tự động lấy theo chuẩn chi phí giấy khổ ${row.size}`}
                          >
                            <Sparkles className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                            <span>Tự điền ({row.size})</span>
                          </div>
                        ) : (
                          <div className="text-[9px] text-slate-500 font-medium mt-0.5 text-right px-0.5">
                            Khổ {row.size}
                          </div>
                        )}
                      </td>

                      {/* 3. Ván / Fomex */}
                      <td className="py-1.5 px-1.5 text-center bg-slate-50/30">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.board !== undefined && row.board > 0 ? formatNumber(row.board) : ''}
                          onChange={(e) => handleCostChange(row.code, 'board', e.target.value)}
                          placeholder="0"
                          title={
                            row.coreBoardInfo && row.coreBoardInfo.category !== 'none'
                              ? `Cốt vật tư: ${row.coreBoardInfo.label} (${row.sizeKey}) - Tự động đồng bộ từ Bảng Giá Cốt Vật Tư: ${formatCurrency(row.board || 0)}`
                              : 'Không dùng cốt ván'
                          }
                          className={`w-full px-2 py-1 bg-white border rounded-lg text-right font-mono text-xs focus:bg-amber-50/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden ${
                            row.isBoardAutoFilled
                              ? 'border-teal-400 bg-teal-50/40 text-teal-950 font-bold'
                              : row.board && row.board > 0
                              ? 'border-slate-300 text-slate-900 font-semibold'
                              : 'border-slate-200'
                          }`}
                        />
                        {row.coreBoardInfo && row.coreBoardInfo.category !== 'none' ? (
                          <div
                            className="text-[9px] text-teal-800 font-bold mt-0.5 text-right flex items-center justify-end gap-0.5"
                            title={`Đồng bộ từ Bảng giá cốt: ${row.coreBoardInfo.label}`}
                          >
                            <Sparkles className="w-2.5 h-2.5 text-teal-600 shrink-0" />
                            <span>{row.boardDetails.label}</span>
                          </div>
                        ) : (
                          <div className="text-[9px] text-slate-400 italic mt-0.5 text-right px-0.5">
                            Không cốt
                          </div>
                        )}
                      </td>

                      {/* 4. Màng Ép */}
                      <td className="py-1.5 px-1.5 text-center bg-slate-50/30">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.film !== undefined && row.film > 0 ? formatNumber(row.film) : ''}
                          onChange={(e) => handleCostChange(row.code, 'film', e.target.value)}
                          placeholder="0"
                          title={
                            row.isFilmAutoFilled
                              ? `Tự động tham chiếu màng ép [Khổ ${row.size}] x [Chất liệu ${row.filmMaterialLabel}]`
                              : `Chi phí màng ép [Khổ ${row.size}] x [Chất liệu ${row.filmMaterialLabel}]`
                          }
                          className={`w-full px-2 py-1 bg-white border rounded-lg text-right font-mono text-xs focus:bg-amber-50/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden ${
                            row.isFilmAutoFilled
                              ? 'border-emerald-400 bg-emerald-50/40 text-emerald-950 font-bold'
                              : row.film && row.film > 0
                              ? 'border-slate-300 text-slate-900 font-semibold'
                              : 'border-slate-200'
                          }`}
                        />
                        {row.isFilmAutoFilled ? (
                          <div
                            className="text-[9px] text-emerald-700 font-bold mt-0.5 text-right flex items-center justify-end gap-0.5"
                            title={`Tự động tham chiếu theo [Khổ ${row.size}] x [Chất liệu ${row.filmMaterialLabel}]`}
                          >
                            <Sparkles className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                            <span>{row.filmMaterialLabel} ({row.size})</span>
                          </div>
                        ) : (
                          <div className="text-[9px] text-slate-500 font-medium mt-0.5 text-right px-0.5">
                            {row.filmMaterialLabel} ({row.size})
                          </div>
                        )}
                      </td>

                      {/* 5. Khung / Viền */}
                      <td className="py-1.5 px-1.5 text-center bg-slate-50/30">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.frame !== undefined && row.frame > 0 ? formatNumber(row.frame) : ''}
                          onChange={(e) => handleCostChange(row.code, 'frame', e.target.value)}
                          placeholder="0"
                          title={
                            row.isFrameAutoFilled
                              ? `Tự động điền theo nhóm khung ${row.frameCatLabel} (${row.size})`
                              : `Chi phí khung / viền cho mã ${row.code}`
                          }
                          className={`w-full px-2 py-1 bg-white border rounded-lg text-right font-mono text-xs focus:bg-amber-50/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden ${
                            row.isFrameAutoFilled
                              ? 'border-amber-400 bg-amber-50/40 text-amber-950 font-bold'
                              : row.frame && row.frame > 0
                              ? 'border-slate-300 text-slate-900 font-semibold'
                              : 'border-slate-200'
                          }`}
                        />
                        {row.isFrameAutoFilled ? (
                          <div
                            className="text-[9px] text-amber-800 font-bold mt-0.5 text-right flex items-center justify-end gap-0.5"
                            title={`Tự động đồng nhất theo nhóm khung ${row.frameCatLabel}`}
                          >
                            <Sparkles className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                            <span>{row.frameCatLabel}</span>
                          </div>
                        ) : (
                          <div className="text-[9px] text-slate-500 font-medium mt-0.5 text-right px-0.5">
                            {row.frameCatLabel}
                          </div>
                        )}
                      </td>

                      {/* 6. Khác */}
                      <td className="py-1.5 px-1.5 text-center bg-slate-50/30">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.other !== undefined && row.other > 0 ? formatNumber(row.other) : ''}
                          onChange={(e) => handleCostChange(row.code, 'other', e.target.value)}
                          placeholder="0"
                          title={
                            row.isOtherAutoFilled
                              ? `Tự động điền theo chuẩn chi phí khác khổ ${row.size}`
                              : `Chi phí khác (dùng chung cho toàn bộ sản phẩm khổ ${row.size})`
                          }
                          className={`w-full px-2 py-1 bg-white border rounded-lg text-right font-mono text-xs focus:bg-amber-50/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden ${
                            row.isOtherAutoFilled
                              ? 'border-emerald-400 bg-emerald-50/40 text-emerald-950 font-bold'
                              : row.other && row.other > 0
                              ? 'border-slate-300 text-slate-900 font-semibold'
                              : 'border-slate-200'
                          }`}
                        />
                        {row.isOtherAutoFilled ? (
                          <div
                            className="text-[9px] text-emerald-700 font-bold mt-0.5 text-right flex items-center justify-end gap-0.5"
                            title={`Tự động lấy theo chuẩn chi phí khác khổ ${row.size}`}
                          >
                            <Sparkles className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                            <span>Tự điền theo khổ</span>
                          </div>
                        ) : (
                          <div className="text-[9px] text-slate-500 font-medium mt-0.5 text-right px-0.5">
                            Khổ {row.size}
                          </div>
                        )}
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

                      {/* GIÁ BÁN SỈ / STUDIO */}
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

                      {/* LỢI NHUẬN GỘP ƯỚC TÍNH */}
                      <td className="py-2.5 px-3 text-right font-mono font-black border-l border-slate-200 text-xs bg-emerald-50/20">
                        {row.hasCostData && row.studioPrice > 0 ? (
                          <span className={row.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                            {row.grossProfit < 0 ? '-' : ''}{formatCurrency(Math.abs(row.grossProfit))}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* TỶ SUẤT LNG / GIÁ BÁN (%) */}
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
      )}

      {/* MODAL THÊM / SỬA SẢN PHẨM NHẬP THÀNH PHẨM */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-sm flex items-center gap-2 text-amber-300">
                <Sparkles className="w-4 h-4 text-amber-400" />
                {editingItemCode ? 'SỬA SẢN PHẨM NHẬP THÀNH PHẨM' : 'THÊM SẢN PHẨM NHẬP THÀNH PHẨM MỚI'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProductForm} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mã Sản Phẩm <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={productForm.code}
                  onChange={(e) => setProductForm({ ...productForm, code: e.target.value })}
                  placeholder="VD: ABMP20x30ST hoặc ALBUM_VIP_3040"
                  disabled={!!editingItemCode}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên Sản Phẩm <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="VD: Album Mở Phẳng 20x30 10 Tờ"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kích Thước / Khổ
                </label>
                <input
                  type="text"
                  value={productForm.size}
                  onChange={(e) => setProductForm({ ...productForm, size: e.target.value })}
                  placeholder="VD: 20x30"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-bold text-amber-900 mb-1">
                    Giá Vốn Nhập (VNĐ)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={productForm.importCost ? formatNumber(parseFloat(productForm.importCost.replace(/\D/g, '')) || 0) : ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setProductForm({ ...productForm, importCost: val });
                    }}
                    placeholder="VD: 250,000"
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg font-mono font-bold text-amber-950 text-right focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-indigo-900 mb-1">
                    Giá Bán Sỉ/Studio (VNĐ)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={productForm.studioPrice ? formatNumber(parseFloat(productForm.studioPrice.replace(/\D/g, '')) || 0) : ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setProductForm({ ...productForm, studioPrice: val });
                    }}
                    placeholder="VD: 390,000"
                    className="w-full px-3 py-2 border border-indigo-300 rounded-lg font-mono font-bold text-indigo-950 text-right focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu Sản Phẩm</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
