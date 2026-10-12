import { Product, ProductCategory } from '../types';

export type ProductCoreType = 'mdf' | 'fomex' | 'none';

/**
 * Phân loại cốt vật tư chuẩn theo yêu cầu Tiệm In 194:
 * 1. Bỏ trống cốt (Không dùng cốt): In ảnh kỹ thuật số, In Ép (inep), Khung Gia Cố nẹp (NEP), Album mở phẳng / Photobook / Tạp chí
 * 2. Cốt Fomex 9li siêu nhẹ: DUY NHẤT dành cho "Ảnh 4K" và "Ảnh HD Pro"
 * 3. Cốt Gỗ MDF: Tất cả các loại ảnh khác (Ảnh HD Gương Siêu Bóng bo viền / khung, Lụa Viền LV, Lụa Khung LK, Mika MK, Ép Gỗ EG, Tráng Gương TG, Pha Lê PL...)
 */
export function getProductCoreType(prod: {
  code?: string;
  name?: string;
  note?: string;
  description?: string;
  recipe?: any[];
  materialCoreCode?: string;
  materialCoreName?: string;
}): ProductCoreType {
  // 00. Nếu sản phẩm đã được cấu hình thủ công mã cốt vật tư (materialCoreCode)
  if (prod.materialCoreCode) {
    const mc = prod.materialCoreCode.toUpperCase().trim();
    if (mc === 'NONE' || mc === 'KHONG' || mc === 'KHONG_COT' || mc === '0') return 'none';
    if (mc.includes('FOMEX') || (prod.materialCoreName && prod.materialCoreName.toLowerCase().includes('fomex'))) {
      return 'fomex';
    }
    return 'mdf';
  }

  const code = (prod.code || '').toLowerCase().trim();
  const name = (prod.name || '').toLowerCase().trim();
  const note = (prod.note || '').toLowerCase().trim();
  const desc = (prod.description || '').toLowerCase().trim();
  const fullText = `${code} ${name} ${note} ${desc}`;

  // 0. Nếu sản phẩm có công thức định mức (recipe) riêng
  if (prod.recipe && prod.recipe.length > 0) {
    const hasFomex = prod.recipe.some((r: any) =>
      (r.materialCode && r.materialCode.toLowerCase().includes('fomex')) ||
      (r.materialName && r.materialName.toLowerCase().includes('fomex'))
    );
    if (hasFomex) return 'fomex';

    const hasMdf = prod.recipe.some((r: any) =>
      (r.materialCode && (r.materialCode.toLowerCase().includes('mdf') || r.materialCode.toLowerCase().includes('go'))) ||
      (r.materialName && (r.materialName.toLowerCase().includes('mdf') || r.materialName.toLowerCase().includes('gỗ')))
    );
    if (hasMdf) return 'mdf';

    return 'none';
  }

  // 1. Không dùng cốt (Bỏ trống cốt)
  // - Khung gia cố nẹp (NEPST1/2/3, NEPFL, NEPKL, nẹp...)
  // - Album mở phẳng, Photobook, Tạp chí (ABMP, AB, FL-ABMP, KL-ABMP...)
  // - In ảnh kỹ thuật số (inST, INFL, INKL, in...)
  // - In ảnh ép lụa / ép bóng (inepST, inepFL, inepKL, inep...)
  const isKhungGiaCo =
    code.startsWith('nep') ||
    name.includes('gia cố') ||
    name.includes('nẹp') ||
    fullText.includes('gia cố') ||
    fullText.includes('khung nẹp');

  const isAlbumOrPhotobook =
    code.startsWith('ab') ||
    code.startsWith('fl-ab') ||
    code.startsWith('kl-ab') ||
    name.includes('album') ||
    name.includes('photobook') ||
    name.includes('tạp chí') ||
    name.includes('mở phẳng');

  const isPrintOrPress =
    code.startsWith('inst') ||
    code.startsWith('infl') ||
    code.startsWith('inkl') ||
    code.startsWith('inepst') ||
    code.startsWith('inepfl') ||
    code.startsWith('inepkl') ||
    code.startsWith('inep') ||
    code === 'in' ||
    name.startsWith('in ảnh') ||
    name.startsWith('in ép') ||
    name === 'in';

  if (isPrintOrPress || isAlbumOrPhotobook || isKhungGiaCo) {
    if (!code.startsWith('hd') && !code.startsWith('mk') && !code.startsWith('lv') && !code.startsWith('lk')) {
      return 'none';
    }
  }

  if (fullText.includes('không cốt') || fullText.includes('bỏ trống cốt') || fullText.includes('ko cốt')) {
    return 'none';
  }

  // 2. Cốt Fomex 9li: DUY NHẤT DÀNH CHO "ẢNH 4K" VÀ "ẢNH HD PRO"
  // (Lưu ý: "HD Gương Siêu Bóng" HDST... dùng cốt GỖ MDF, KHÔNG PHẢI Fomex!)
  const is4K = code.includes('4k') || name.includes('4k') || note.includes('4k') || desc.includes('4k');
  const isHDPro =
    code.includes('hdpro') ||
    code.includes('hd-pro') ||
    code.includes('hd_pro') ||
    name.includes('hd pro') ||
    name.includes('hd-pro') ||
    name.includes('hdpro') ||
    note.includes('hd pro') ||
    note.includes('hdpro');

  if (is4K || isHDPro) {
    return 'fomex';
  }

  // 3. Cốt Ván GỖ MDF: Tất cả các dòng ảnh còn lại:
  // - HD Gương Siêu Bóng (HDST, HDFL, HDKL, HD Gương Khung...)
  // - Lụa Viền Bo Viền (LVST, LVFL, LVKL)
  // - Lụa Khung (LKST, LKFL, LKKL)
  // - Mika Phổ Thông Bo Viền / Khung (MKST, MKFL, MKKL)
  // - Ảnh Ép Gỗ (EG), Ảnh Tráng Gương (TG), Ảnh Pha Lê (PL)...
  return 'mdf';
}

/**
 * Chuyển đổi mã sản phẩm chính xác giữa 3 bảng giá:
 * - In: inST -> INFL -> INKL
 * - In ép: inepST -> inepFL -> inepKL
 * - Lụa viền: LVST -> LVFL -> LVKL
 * - Lụa khung: LKST -> LKFL -> LKKL
 * - Mika: MKST -> MKFL -> MKKL
 * - HD: HDST -> HDFL -> HDKL
 * - Khung gia cố: NEPST1/2/3 -> NEPFL1/2/3 -> NEPKL1/2/3
 */
export function convertProductCodeForTier(code: string, targetTier: ProductCategory): string {
  const c = (code || '').trim();

  // 1. inST / INFL / INKL
  const matchIn = c.match(/^(?:in|IN)(?:ST|FL|KL)(.*)$/i);
  if (matchIn) {
    const size = matchIn[1];
    if (targetTier === 'GIÁ STUDIO') return `inST${size}`;
    if (targetTier === 'Freelance') return `INFL${size}`;
    return `INKL${size}`;
  }

  // 2. inepST / inepFL / inepKL
  const matchInep = c.match(/^inep(?:ST|FL|KL)(.*)$/i);
  if (matchInep) {
    const size = matchInep[1];
    if (targetTier === 'GIÁ STUDIO') return `inepST${size}`;
    if (targetTier === 'Freelance') return `inepFL${size}`;
    return `inepKL${size}`;
  }

  // 3. LVST / LVFL / LVKL
  const matchLV = c.match(/^LV(?:ST|FL|KL)(.*)$/i);
  if (matchLV) {
    const size = matchLV[1];
    if (targetTier === 'GIÁ STUDIO') return `LVST${size}`;
    if (targetTier === 'Freelance') return `LVFL${size}`;
    return `LVKL${size}`;
  }

  // 4. LKST / LKFL / LKKL (Lụa Khung)
  const matchLK = c.match(/^LK(?:ST|FL|KL)(.*)$/i);
  if (matchLK) {
    const size = matchLK[1];
    if (targetTier === 'GIÁ STUDIO') return `LKST${size}`;
    if (targetTier === 'Freelance') return `LKFL${size}`;
    return `LKKL${size}`;
  }

  // 5. MKST / MKFL / MKKL (Mika bo viền hoặc Mika khung)
  const matchMK = c.match(/^MK(?:ST|FL|KL)(.*)$/i);
  if (matchMK) {
    const size = matchMK[1];
    if (targetTier === 'GIÁ STUDIO') return `MKST${size}`;
    if (targetTier === 'Freelance') return `MKFL${size}`;
    return `MKKL${size}`;
  }

  // 6. HDST / HDFL / HDKL (HD gương bo viền hoặc HD gương khung)
  const matchHD = c.match(/^HD(?:ST|FL|KL)(.*)$/i);
  if (matchHD) {
    const size = matchHD[1];
    if (targetTier === 'GIÁ STUDIO') return `HDST${size}`;
    if (targetTier === 'Freelance') return `HDFL${size}`;
    return `HDKL${size}`;
  }

  // 7. NEPST / NEPFL / NEPKL (Khung gia cố NEPST1, NEPST2, NEPST3)
  const matchNEP = c.match(/^NEP(?:ST|FL|KL)(.*)$/i);
  if (matchNEP) {
    const num = matchNEP[1];
    if (targetTier === 'GIÁ STUDIO') return `NEPST${num}`;
    if (targetTier === 'Freelance') return `NEPFL${num}`;
    return `NEPKL${num}`;
  }

  // Mã chứa ST -> thay bằng FL khi sang Freelance
  if (targetTier === 'Freelance' && /ST/i.test(c)) {
    return c.replace(/ST/g, 'FL').replace(/st/g, 'fl');
  }

  // Mã tùy chỉnh khác: tiền tố FL- hoặc KL-
  const cleanCode = c.replace(/^(FL-|KL-)/i, '');
  if (targetTier === 'Freelance') return `FL-${cleanCode}`;
  if (targetTier === 'Khách Lẻ') return `KL-${cleanCode}`;
  return cleanCode;
}

/**
 * Sao chép 1 sản phẩm từ mục "1.studio" sang mục "2. Freelance":
 * - Giá tăng thêm 10% so với giá ở Studio (làm tròn nguyên VND)
 * - Sửa mã sản phẩm: thay "ST" thành "FL" (hoặc tiền tố FL-)
 * - Tên sản phẩm gắn nhãn (Freelance)
 */
export function cloneStudioProductToFreelance(stProduct: Product): Product {
  // Giá tăng thêm 10% so với giá ở mục 1.studio
  const newPrice = Math.round(stProduct.price * 1.1);

  // Sửa mã sản phẩm cho phù hợp mục 2.freelance: thay ST thành FL
  const newCode = convertProductCodeForTier(stProduct.code, 'Freelance');

  // Chuẩn hóa tên sản phẩm
  const cleanName = stProduct.name
    .replace(/\((GIÁ STUDIO|Studio|Freelance|Khách Lẻ)\)/gi, '')
    .trim();
  const newName = `${cleanName} (Freelance)`;

  const baseIdPart = stProduct.id
    .replace(/^prod-/, '')
    .replace(/^p-/, '')
    .replace(/-st$/, '')
    .replace(/-studio$/, '');
  const newId = `prod-fl-${baseIdPart}`;

  return {
    ...stProduct,
    id: newId,
    code: newCode,
    name: newName,
    price: newPrice,
    category: 'Freelance',
    size: stProduct.size,
    unit: stProduct.unit
  };
}

/**
 * Đồng bộ hóa toàn bộ danh mục 2. Freelance từ 1. Studio:
 * Lấy toàn bộ sản phẩm ở 1. Studio -> nhân bản sang Freelance với giá +10% và mã đổi ST -> FL
 */
export function syncAllFreelanceFromStudio(products: Product[]): Product[] {
  const studioProducts = products.filter(p => p.category === 'GIÁ STUDIO');
  const nonFreelanceProducts = products.filter(p => p.category !== 'Freelance');
  const clonedFreelanceProducts = studioProducts.map(p => cloneStudioProductToFreelance(p));

  return [...nonFreelanceProducts, ...clonedFreelanceProducts];
}

/**
 * ========================================================
 * DANH MỤC MÃ SẢN PHẨM PHỔ BIẾN NHẤT (TIỆM IN 194)
 * Giúp chọn nhanh khi lập hóa đơn bán hàng, tránh gõ nhầm mã
 * ========================================================
 */
export interface PopularPresetDef {
  key: string;
  name: string;
  size: string;
  categoryTag: 'top' | 'gate' | 'desk' | 'print' | 'special';
  categoryLabel: string;
  baseCode: string; // Mã gốc ở Studio (inST, inepST, LVST, MKST, HDST, LKST, NEPST...)
  badgeColor: string;
  description: string;
}

export const POPULAR_PRODUCT_PRESETS: PopularPresetDef[] = [
  // 1. Ảnh Cổng Cưới / Treo Tường (Bán chạy nhất)
  {
    key: 'hd-6090',
    name: 'HD Gương Siêu Bóng 60*90',
    size: '60*90',
    categoryTag: 'gate',
    categoryLabel: 'Ảnh Cổng Cưới',
    baseCode: 'HDST60*90',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    description: 'Ảnh cổng tiệc cưới siêu bóng cốt MDF bán chạy số 1'
  },
  {
    key: 'mk-6090',
    name: 'Mika Bo Viền 60*90',
    size: '60*90',
    categoryTag: 'gate',
    categoryLabel: 'Ảnh Cổng Cưới',
    baseCode: 'MKST60*90',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    description: 'Ảnh cổng cưới bề mặt mika trong suốt, bền bỉ'
  },
  {
    key: 'lv-6090',
    name: 'Lụa Viền Bo Viền 60*90',
    size: '60*90',
    categoryTag: 'gate',
    categoryLabel: 'Ảnh Cổng Cưới',
    baseCode: 'LVST60*90',
    badgeColor: 'bg-rose-100 text-rose-900 border-rose-300',
    description: 'Ảnh cổng lụa mịn màng chống lóa đèn sân khấu'
  },
  {
    key: 'lk-6090k456',
    name: 'Lụa Khung K456 60*90',
    size: '60*90',
    categoryTag: 'gate',
    categoryLabel: 'Ảnh Cổng Cưới',
    baseCode: 'LKST60*90K456',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    description: 'Ảnh lụa lồng khung K4-K6 phong cách sang trọng'
  },
  {
    key: 'hd-5075',
    name: 'HD Gương Siêu Bóng 50*75',
    size: '50*75',
    categoryTag: 'gate',
    categoryLabel: 'Ảnh Cổng Cưới',
    baseCode: 'HDST50*75',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    description: 'Ảnh cổng cỡ vừa 50*75 tráng gương sắc nét'
  },
  {
    key: 'mk-5075',
    name: 'Mika Bo Viền 50*75',
    size: '50*75',
    categoryTag: 'gate',
    categoryLabel: 'Ảnh Cổng Cưới',
    baseCode: 'MKST50*75',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    description: 'Ảnh mika treo phòng cưới / phòng ngủ cỡ 50*75'
  },
  {
    key: 'hd-60120',
    name: 'HD Gương Siêu Bóng 60*120',
    size: '60*120',
    categoryTag: 'gate',
    categoryLabel: 'Ảnh Cổng Cưới',
    baseCode: 'HDST60*120',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    description: 'Ảnh khổ dài panorama 60*120 cao cấp'
  },

  // 2. Ảnh Để Bàn / Bàn Tiệc Gallery
  {
    key: 'hd-2030',
    name: 'HD Gương Siêu Bóng 20*30',
    size: '20*30',
    categoryTag: 'desk',
    categoryLabel: 'Ảnh Để Bàn',
    baseCode: 'HDST20*30',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    description: 'Ảnh bàn tiệc cưới / bàn làm việc HD gương'
  },
  {
    key: 'mk-2030',
    name: 'Mika Bo Viền 20*30',
    size: '20*30',
    categoryTag: 'desk',
    categoryLabel: 'Ảnh Để Bàn',
    baseCode: 'MKST20*30',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    description: 'Ảnh để bàn mika phổ thông bền đẹp'
  },
  {
    key: 'lv-2030',
    name: 'Lụa Viền Bo Viền 20*30',
    size: '20*30',
    categoryTag: 'desk',
    categoryLabel: 'Ảnh Để Bàn',
    baseCode: 'LVST20*30',
    badgeColor: 'bg-rose-100 text-rose-900 border-rose-300',
    description: 'Ảnh bàn lụa viền chống bám vân tay'
  },
  {
    key: 'inep-2030',
    name: 'In Ép Mika 20*30',
    size: '20*30',
    categoryTag: 'desk',
    categoryLabel: 'Ảnh Để Bàn',
    baseCode: 'inepST20*30',
    badgeColor: 'bg-teal-100 text-teal-900 border-teal-300',
    description: 'Tấm in ép mika bóng 20*30 không cốt'
  },
  {
    key: 'inep-1521',
    name: 'In Ép Mika 15*21',
    size: '15*21',
    categoryTag: 'desk',
    categoryLabel: 'Ảnh Để Bàn',
    baseCode: 'inepST15*21',
    badgeColor: 'bg-teal-100 text-teal-900 border-teal-300',
    description: 'Ảnh bàn 15*21 in ép mika sinh nhật / cưới'
  },
  {
    key: 'in-2030',
    name: 'In Kỹ Thuật Số 20*30',
    size: '20*30',
    categoryTag: 'desk',
    categoryLabel: 'Ảnh Để Bàn',
    baseCode: 'inST20*30',
    badgeColor: 'bg-sky-100 text-sky-900 border-sky-300',
    description: 'Tấm in giấy ảnh 20*30 chuẩn màu Lab'
  },
  {
    key: 'in-1521',
    name: 'In Kỹ Thuật Số 15*21',
    size: '15*21',
    categoryTag: 'desk',
    categoryLabel: 'Ảnh Để Bàn',
    baseCode: 'inST15*21',
    badgeColor: 'bg-sky-100 text-sky-900 border-sky-300',
    description: 'In ảnh tiệc / ảnh bàn phổ thông 15*21'
  },
  {
    key: 'in-1318',
    name: 'In Kỹ Thuật Số 13*18',
    size: '13*18',
    categoryTag: 'desk',
    categoryLabel: 'Ảnh Để Bàn',
    baseCode: 'inST13*18',
    badgeColor: 'bg-sky-100 text-sky-900 border-sky-300',
    description: 'In ảnh tiệc 13*18 nhỏ gọn tiện dụng'
  },

  // 3. In Phóng Lớn (Không Cốt)
  {
    key: 'in-6090',
    name: 'In Kỹ Thuật Số 60*90',
    size: '60*90',
    categoryTag: 'print',
    categoryLabel: 'In Phóng Lớn',
    baseCode: 'inST60*90',
    badgeColor: 'bg-sky-100 text-sky-900 border-sky-300',
    description: 'In phóng ảnh 60*90 không cốt gỗ MDF'
  },
  {
    key: 'inep-6090',
    name: 'In Ép Mika 60*90',
    size: '60*90',
    categoryTag: 'print',
    categoryLabel: 'In Phóng Lớn',
    baseCode: 'inepST60*90',
    badgeColor: 'bg-teal-100 text-teal-900 border-teal-300',
    description: 'In ép mika 60*90 chống ẩm không cốt'
  },
  {
    key: 'in-5075',
    name: 'In Kỹ Thuật Số 50*75',
    size: '50*75',
    categoryTag: 'print',
    categoryLabel: 'In Phóng Lớn',
    baseCode: 'inST50*75',
    badgeColor: 'bg-sky-100 text-sky-900 border-sky-300',
    description: 'In phóng ảnh 50*75 độ sắc nét cao'
  },

  // 4. Khung Gia Cố & Album Mở Phẳng
  {
    key: 'nep-80120',
    name: 'Khung Gia Cố 80*120',
    size: '80*120',
    categoryTag: 'special',
    categoryLabel: 'Khung & Album',
    baseCode: 'NEPST1',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    description: 'Khung nẹp gia cố chống cong vênh ảnh 80*120'
  },
  {
    key: 'nep-100150',
    name: 'Khung Gia Cố 100*150',
    size: '100*150',
    categoryTag: 'special',
    categoryLabel: 'Khung & Album',
    baseCode: 'NEPST2',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    description: 'Khung nẹp gia cố khổ lớn 100*150'
  },
  {
    key: 'nep-110180',
    name: 'Khung Gia Cố 110*180',
    size: '110*180',
    categoryTag: 'special',
    categoryLabel: 'Khung & Album',
    baseCode: 'NEPST3',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    description: 'Khung nẹp gia cố đại 110*180'
  },
  {
    key: 'abmp-2020',
    name: 'Album Mở Phẳng 20x20 10 Tờ',
    size: '20x20',
    categoryTag: 'special',
    categoryLabel: 'Khung & Album',
    baseCode: 'ABMP20x20',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    description: 'Album mở phẳng 10 tờ (20 trang) mini'
  },
  {
    key: 'abmp-2030',
    name: 'Album Mở Phẳng 20x30 10 Tờ',
    size: '20x30',
    categoryTag: 'special',
    categoryLabel: 'Khung & Album',
    baseCode: 'ABMP20x30',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    description: 'Album cưới mở phẳng 20x30 10 tờ tiêu chuẩn'
  },
  {
    key: 'abmp-3030',
    name: 'Album Mở Phẳng 30x30 10 Tờ',
    size: '30x30',
    categoryTag: 'special',
    categoryLabel: 'Khung & Album',
    baseCode: 'ABMP30x30',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    description: 'Album cưới cao cấp 30x30 10 tờ sắc nét'
  },
  {
    key: 'lk-6090k0123',
    name: 'Lụa Khung K0123 60*90',
    size: '60*90',
    categoryTag: 'gate',
    categoryLabel: 'Ảnh Cổng Cưới',
    baseCode: 'LKST60*90K0123',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    description: 'Ảnh lụa lồng khung K0-K3 thanh lịch'
  },
  {
    key: 'hd-70110',
    name: 'HD Gương Siêu Bóng 70*110',
    size: '70*110',
    categoryTag: 'gate',
    categoryLabel: 'Ảnh Cổng Cưới',
    baseCode: 'HDST70*110',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    description: 'Ảnh cổng cỡ lớn 70*110 siêu bóng'
  },
  {
    key: 'hd-80120',
    name: 'HD Gương Siêu Bóng 80*120',
    size: '80*120',
    categoryTag: 'gate',
    categoryLabel: 'Ảnh Cổng Cưới',
    baseCode: 'HDST80*120',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    description: 'Ảnh cổng đại 80*120 HD gương sang trọng'
  }
];

export const DEFAULT_POPULAR_BASE_CODES: string[] = [
  'HDST60*90',
  'MKST60*90',
  'LVST60*90',
  'LKST60*90K456',
  'HDST50*75',
  'MKST50*75',
  'HDST60*120',
  'HDST20*30',
  'MKST20*30',
  'LVST20*30',
  'inepST20*30',
  'inepST15*21',
  'inepST13*18',
  'inST20*30',
  'inST15*21',
  'inST13*18',
  'inST60*90',
  'inepST60*90',
  'NEPST1',
  'NEPST2',
  'NEPST3',
  'ABMP20x20',
  'ABMP20x30',
  'ABMP30x30'
];

/**
 * Tìm kiếm sản phẩm tương ứng trong danh mục theo preset và cấp giá hiện tại
 */
export function resolvePopularProduct(preset: PopularPresetDef, tier: ProductCategory, allProducts: Product[]): Product | undefined {
  const targetCode = convertProductCodeForTier(preset.baseCode, tier);

  // 1. Tìm chính xác theo mã của phân khúc giá
  const exact = allProducts.find(p => p.category === tier && p.code.toUpperCase() === targetCode.toUpperCase());
  if (exact) return exact;

  // 2. Tìm theo mã bất kỳ trong danh mục
  const matchByCode = allProducts.find(p => p.code.toUpperCase() === targetCode.toUpperCase());
  if (matchByCode) return matchByCode;

  // 3. Tìm theo mã cơ sở
  const matchByBaseCode = allProducts.find(p => p.category === tier && p.code.toUpperCase() === preset.baseCode.toUpperCase());
  if (matchByBaseCode) return matchByBaseCode;

  return undefined;
}

/**
 * Tìm kiếm sản phẩm tương ứng cho bất kỳ mã hoặc baseCode nào theo cấp giá
 */
export function resolveProductByCodeOrBase(rawCode: string, tier: ProductCategory, allProducts: Product[]): Product | undefined {
  const clean = (rawCode || '').trim();
  if (!clean) return undefined;

  // 1. Tìm chính xác trong phân khúc giá
  const exactInTier = allProducts.find(p => p.category === tier && p.code.toUpperCase() === clean.toUpperCase());
  if (exactInTier) return exactInTier;

  // 2. Chuyển đổi mã sang phân khúc giá mục tiêu
  const targetCode = convertProductCodeForTier(clean, tier);
  const convertedInTier = allProducts.find(p => p.category === tier && p.code.toUpperCase() === targetCode.toUpperCase());
  if (convertedInTier) return convertedInTier;

  // 3. Tìm mã bất kỳ
  const anyMatch = allProducts.find(p => p.code.toUpperCase() === clean.toUpperCase() || p.code.toUpperCase() === targetCode.toUpperCase());
  if (anyMatch) return anyMatch;

  return undefined;
}

const PINNED_STORAGE_KEY = 'xuongin194_pinned_product_codes';
const CUSTOM_POPULAR_CODES_KEY = 'xuongin194_custom_popular_codes_v2';

export function getStoredCustomPinnedCodes(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveStoredCustomPinnedCodes(codes: string[]): void {
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(codes));
  } catch (e) {
    console.error('Error saving pinned codes', e);
  }
}

/**
 * Lấy danh sách mã phổ biến do người dùng tự chọn (hoặc mặc định nếu chưa lưu)
 */
export function getStoredSelectedPopularCodes(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_POPULAR_CODES_KEY);
    if (!raw) return DEFAULT_POPULAR_BASE_CODES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return DEFAULT_POPULAR_BASE_CODES;
  } catch (e) {
    return DEFAULT_POPULAR_BASE_CODES;
  }
}

/**
 * Lưu danh sách mã phổ biến do người dùng tùy biến
 */
export function saveStoredSelectedPopularCodes(codes: string[]): void {
  try {
    localStorage.setItem(CUSTOM_POPULAR_CODES_KEY, JSON.stringify(codes));
  } catch (e) {
    console.error('Error saving popular codes', e);
  }
}

/**
 * Khôi phục danh sách mã phổ biến mặc định
 */
export function resetStoredSelectedPopularCodes(): string[] {
  try {
    localStorage.setItem(CUSTOM_POPULAR_CODES_KEY, JSON.stringify(DEFAULT_POPULAR_BASE_CODES));
  } catch (e) {
    console.error('Error resetting popular codes', e);
  }
  return DEFAULT_POPULAR_BASE_CODES;
}

