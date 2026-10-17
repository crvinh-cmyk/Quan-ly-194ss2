import { Product, Customer, Order, WorkshopInfo, Material, StockImportReceipt, StudioCombo, InkColorMeta, InkImportRecord } from '../types';
import { cloneStudioProductToFreelance } from '../utils/productHelpers';

export const DEFAULT_WORKSHOP_INFO: WorkshopInfo = {
  name: 'TIỆM IN 194',
  subtitle: 'Tiệm Chuyên In Phóng Ảnh Lớn - Ép Gỗ - Tráng Gương Pha Lê - Album Cưới & Khung Cao Cấp',
  phone: '0988.194.194',
  hotline: '0912.194.194',
  address: 'Số 194 Giải Phóng, Phương Liệt, Thanh Xuân, Hà Nội',
  zalo: '0988194194',
  bankAccount: {
    bankName: 'Techcombank',
    accountNumber: '1903 68194 19401',
    accountHolder: 'TIEM IN ANH 194'
  }
};

// Danh sách 15 kích thước chuẩn xưởng in 194
export const STANDARD_PHOTO_SIZES = [
  '6*9', '10*15', '13*18', '15*21', '20*30',
  '30*45', '35*50', '40*60', '50*75', '60*90',
  '60*120', '70*110', '80*120', '100*150', '110*180'
] as const;

// 5 dòng sản phẩm chủ lực x 15 kích thước x 3 bảng giá
export const PHOTO_PRICING_MATRIX: Record<
  string,
  {
    in: { studio: number; freelance: number; retail: number };
    inep: { studio: number; freelance: number; retail: number };
    lv: { studio: number; freelance: number; retail: number };
    mk: { studio: number; freelance: number; retail: number };
    hd: { studio: number; freelance: number; retail: number };
  }
> = {
  '6*9': {
    in: { studio: 3000, freelance: 5000, retail: 8000 },
    inep: { studio: 6000, freelance: 9000, retail: 15000 },
    lv: { studio: 14000, freelance: 20000, retail: 30000 },
    mk: { studio: 18000, freelance: 25000, retail: 38000 },
    hd: { studio: 25000, freelance: 35000, retail: 50000 }
  },
  '10*15': {
    in: { studio: 5000, freelance: 8000, retail: 12000 },
    inep: { studio: 10000, freelance: 15000, retail: 22000 },
    lv: { studio: 20000, freelance: 28000, retail: 42000 },
    mk: { studio: 28000, freelance: 38000, retail: 55000 },
    hd: { studio: 45000, freelance: 60000, retail: 85000 }
  },
  '13*18': {
    in: { studio: 8000, freelance: 12000, retail: 18000 },
    inep: { studio: 15000, freelance: 22000, retail: 32000 },
    lv: { studio: 28000, freelance: 38000, retail: 58000 },
    mk: { studio: 42000, freelance: 58000, retail: 82000 },
    hd: { studio: 60000, freelance: 80000, retail: 115000 }
  },
  '15*21': {
    in: { studio: 12000, freelance: 18000, retail: 25000 },
    inep: { studio: 22000, freelance: 32000, retail: 48000 },
    lv: { studio: 38000, freelance: 52000, retail: 78000 },
    mk: { studio: 58000, freelance: 78000, retail: 110000 },
    hd: { studio: 80000, freelance: 105000, retail: 150000 }
  },
  '20*30': {
    in: { studio: 22000, freelance: 30000, retail: 45000 },
    inep: { studio: 38000, freelance: 52000, retail: 75000 },
    lv: { studio: 65000, freelance: 88000, retail: 125000 },
    mk: { studio: 95000, freelance: 125000, retail: 175000 },
    hd: { studio: 135000, freelance: 175000, retail: 245000 }
  },
  '30*45': {
    in: { studio: 45000, freelance: 60000, retail: 85000 },
    inep: { studio: 70000, freelance: 95000, retail: 135000 },
    lv: { studio: 120000, freelance: 160000, retail: 225000 },
    mk: { studio: 170000, freelance: 220000, retail: 310000 },
    hd: { studio: 230000, freelance: 295000, retail: 400000 }
  },
  '35*50': {
    in: { studio: 55000, freelance: 75000, retail: 110000 },
    inep: { studio: 90000, freelance: 120000, retail: 170000 },
    lv: { studio: 150000, freelance: 195000, retail: 270000 },
    mk: { studio: 210000, freelance: 270000, retail: 375000 },
    hd: { studio: 280000, freelance: 360000, retail: 485000 }
  },
  '40*60': {
    in: { studio: 75000, freelance: 100000, retail: 140000 },
    inep: { studio: 120000, freelance: 160000, retail: 220000 },
    lv: { studio: 185000, freelance: 245000, retail: 340000 },
    mk: { studio: 260000, freelance: 335000, retail: 460000 },
    hd: { studio: 340000, freelance: 435000, retail: 585000 }
  },
  '50*75': {
    in: { studio: 110000, freelance: 145000, retail: 200000 },
    inep: { studio: 175000, freelance: 230000, retail: 320000 },
    lv: { studio: 270000, freelance: 350000, retail: 480000 },
    mk: { studio: 360000, freelance: 460000, retail: 620000 },
    hd: { studio: 460000, freelance: 580000, retail: 765000 }
  },
  '60*90': {
    in: { studio: 140000, freelance: 185000, retail: 260000 },
    inep: { studio: 230000, freelance: 300000, retail: 420000 },
    lv: { studio: 340000, freelance: 440000, retail: 590000 },
    mk: { studio: 460000, freelance: 580000, retail: 780000 },
    hd: { studio: 560000, freelance: 695000, retail: 910000 }
  },
  '60*120': {
    in: { studio: 185000, freelance: 240000, retail: 340000 },
    inep: { studio: 295000, freelance: 390000, retail: 540000 },
    lv: { studio: 440000, freelance: 560000, retail: 750000 },
    mk: { studio: 580000, freelance: 725000, retail: 960000 },
    hd: { studio: 720000, freelance: 890000, retail: 1150000 }
  },
  '70*110': {
    in: { studio: 200000, freelance: 265000, retail: 370000 },
    inep: { studio: 320000, freelance: 420000, retail: 580000 },
    lv: { studio: 490000, freelance: 620000, retail: 820000 },
    mk: { studio: 640000, freelance: 795000, retail: 1050000 },
    hd: { studio: 790000, freelance: 970000, retail: 1250000 }
  },
  '80*120': {
    in: { studio: 240000, freelance: 320000, retail: 440000 },
    inep: { studio: 390000, freelance: 510000, retail: 700000 },
    lv: { studio: 580000, freelance: 730000, retail: 960000 },
    mk: { studio: 750000, freelance: 930000, retail: 1220000 },
    hd: { studio: 920000, freelance: 1130000, retail: 1450000 }
  },
  '100*150': {
    in: { studio: 360000, freelance: 470000, retail: 650000 },
    inep: { studio: 580000, freelance: 750000, retail: 1020000 },
    lv: { studio: 850000, freelance: 1060000, retail: 1380000 },
    mk: { studio: 1080000, freelance: 1320000, retail: 1720000 },
    hd: { studio: 1320000, freelance: 1590000, retail: 2020000 }
  },
  '110*180': {
    in: { studio: 480000, freelance: 620000, retail: 850000 },
    inep: { studio: 760000, freelance: 980000, retail: 1320000 },
    lv: { studio: 1120000, freelance: 1380000, retail: 1780000 },
    mk: { studio: 1400000, freelance: 1690000, retail: 2180000 },
    hd: { studio: 1700000, freelance: 2030000, retail: 2550000 }
  }
};

function generateStandardProducts(): Product[] {
  const result: Product[] = [];

  const types = [
    {
      key: 'in' as const,
      name: 'In Ảnh Kỹ Thuật Số',
      prefix: { studio: 'inST', freelance: 'INFL', retail: 'INKL' }
    },
    {
      key: 'inep' as const,
      name: 'In Ép Mika',
      prefix: { studio: 'inepST', freelance: 'inepFL', retail: 'inepKL' }
    },
    {
      key: 'lv' as const,
      name: 'Ảnh Lụa Viền Bo Viền',
      prefix: { studio: 'LVST', freelance: 'LVFL', retail: 'LVKL' }
    },
    {
      key: 'mk' as const,
      name: 'Ảnh Mika Phổ Thông Bo Viền',
      prefix: { studio: 'MKST', freelance: 'MKFL', retail: 'MKKL' }
    },
    {
      key: 'hd' as const,
      name: 'Ảnh HD Gương Siêu Bóng Bo Viền',
      prefix: { studio: 'HDST', freelance: 'HDFL', retail: 'HDKL' }
    }
  ];

  const studioProducts: Product[] = [];

  // 1. BẢNG GIÁ STUDIO (ĐÃ CHỐT SỐ LƯỢNG VÀ GIÁ, KHÔNG TỰ Ý THÊM MÃ NÀO VÀO NỮA)
  types.forEach(t => {
    STANDARD_PHOTO_SIZES.forEach(size => {
      // Loại bỏ các kích thước theo yêu cầu của tiệm in
      if (t.key === 'hd' && (size === '110*180' || size === '10*15' || size === '6*9')) return;
      if (t.key === 'mk' && (size === '110*180' || size === '10*15' || size === '6*9')) return;
      if (t.key === 'lv' && (size === '110*180' || size === '13*18' || size === '10*15' || size === '6*9')) return;
      if (t.key === 'in' && (size === '80*120' || size === '6*9')) return;

      const price = PHOTO_PRICING_MATRIX[size][t.key].studio;

      // Cấu hình cốt vật tư cho các sản phẩm kích thước 40*60:
      // - 9li (20.265 đ): LVST (Lụa Viền) & MKST (Mika Phổ Thông)
      // - 12li (26.520 đ): HDST (HD Gương Siêu Bóng)
      // - Không dùng cốt: inST (In kỹ thuật số) & inepST (In ép mika)
      let materialCoreCode: string | undefined = undefined;
      let materialCoreName: string | undefined = undefined;

      if (size === '40*60') {
        if (t.key === 'lv' || t.key === 'mk') {
          materialCoreCode = 'VT-GO-4060-9LI';
          materialCoreName = 'Gỗ MDF 40x60 9li Tiêu Chuẩn (20.265 đ)';
        } else if (t.key === 'hd') {
          materialCoreCode = 'VT-GO-4060';
          materialCoreName = 'Gỗ MDF 40x60 12li Lõi Xanh Chống Ẩm (26.520 đ)';
        } else if (t.key === 'in' || t.key === 'inep') {
          materialCoreCode = 'NONE';
          materialCoreName = 'Không dùng cốt ván';
        }
      }

      studioProducts.push({
        id: `prod-${t.key}-st-${size.replace('*', 'x')}`,
        code: `${t.prefix.studio}${size}`,
        name: t.name,
        size,
        price,
        category: 'GIÁ STUDIO',
        unit: 'tấm',
        materialCoreCode,
        materialCoreName
      });
    });
  });

  // Thêm các sản phẩm Album Mở Phẳng & Khung Gia Cố
  studioProducts.push(
    // 3 Sản phẩm Album Mở Phẳng 10 Tờ (Mục Không Cốt theo yêu cầu Tiệm In 194)
    { id: 'p-abmp-2020-st', code: 'ABMP20x20', name: 'Album Mở Phẳng 20x20 10 Tờ', size: '20x20', price: 290000, category: 'GIÁ STUDIO', unit: 'cuốn' },
    { id: 'p-abmp-2030-st', code: 'ABMP20x30', name: 'Album Mở Phẳng 20x30 10 Tờ', size: '20x30', price: 390000, category: 'GIÁ STUDIO', unit: 'cuốn' },
    { id: 'p-abmp-3030-st', code: 'ABMP30x30', name: 'Album Mở Phẳng 30x30 10 Tờ', size: '30x30', price: 520000, category: 'GIÁ STUDIO', unit: 'cuốn' },
    // 3 Sản phẩm Khung Gia Cố (Mục Không Cốt theo yêu cầu Tiệm In 194)
    { id: 'p-nepst1', code: 'NEPST1', name: 'Khung Gia Cố 80*120', size: '80*120', price: 60000, category: 'GIÁ STUDIO', unit: 'cái' },
    { id: 'p-nepst2', code: 'NEPST2', name: 'Khung Gia Cố 100*150', size: '100*150', price: 90000, category: 'GIÁ STUDIO', unit: 'cái' },
    { id: 'p-nepst3', code: 'NEPST3', name: 'Khung Gia Cố 110*180', size: '110*180', price: 120000, category: 'GIÁ STUDIO', unit: 'cái' }
  );

  // 2. BẢNG GIÁ FREELANCE:
  // Sao chép toàn bộ sản phẩm ở mục "1.studio" sang mục "2. Freelance",
  // giá mỗi sản phẩm tăng thêm 10% so với giá ở "1.studio", đồng thời sửa mã sản phẩm (thay ST thành FL).
  const freelanceProducts: Product[] = studioProducts.map(st => cloneStudioProductToFreelance(st));

  // 3. BẢNG GIÁ KHÁCH LẺ
  const retailProducts: Product[] = [];
  types.forEach(t => {
    STANDARD_PHOTO_SIZES.forEach(size => {
      // Loại bỏ các kích thước theo yêu cầu của tiệm in
      if (t.key === 'hd' && (size === '110*180' || size === '10*15' || size === '6*9')) return;
      if (t.key === 'mk' && (size === '110*180' || size === '10*15' || size === '6*9')) return;
      if (t.key === 'lv' && (size === '110*180' || size === '13*18' || size === '10*15' || size === '6*9')) return;
      if (t.key === 'in' && (size === '80*120' || size === '6*9')) return;

      const price = PHOTO_PRICING_MATRIX[size][t.key].retail;
      retailProducts.push({
        id: `prod-${t.key}-kl-${size.replace('*', 'x')}`,
        code: `${t.prefix.retail}${size}`,
        name: `${t.name} (Khách Lẻ)`,
        size,
        price,
        category: 'Khách Lẻ',
        unit: 'tấm'
      });
    });
  });

  return [...studioProducts, ...freelanceProducts, ...retailProducts];
}

export const DEFAULT_PRODUCTS: Product[] = generateStandardProducts();

export const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: 'c-thuhang',
    name: 'Thu Hằng Studio',
    phone: '0988 776 554',
    studioName: 'Thu Hằng Studio',
    address: '156 Phố Huế, Hai Bà Trưng, Hà Nội',
    initialDebt: 0,
    customerType: 'GIÁ STUDIO',
    notes: 'Studio quen in ảnh cưới VIP, hay đặt Combo ảnh cổng HD + 2 bàn HD + Album',
    createdAt: '2026-01-08',
    initialYearlyRevenue: 28000000
  },
  {
    id: 'c1',
    name: 'Studio Áo Cưới Hoàng Gia',
    phone: '0978 223 114',
    studioName: 'Hoàng Gia Wedding',
    address: '45 Lê Duẩn, Hà Nội',
    initialDebt: 1850000,
    customerType: 'GIÁ STUDIO',
    notes: 'Khách studio ruột, in ảnh cưới số lượng lớn',
    createdAt: '2026-01-10',
    initialYearlyRevenue: 15000000 // Doanh thu tích lũy trước khi dùng phần mềm
  },
  {
    id: 'c2',
    name: 'Minh Tuấn Wedding & Events',
    phone: '0914 556 778',
    studioName: 'Tuấn Minh Studio',
    address: '88 Cầu Giấy, Hà Nội',
    initialDebt: 620000,
    customerType: 'GIÁ STUDIO',
    notes: 'Thanh toán chuyển khoản định kỳ cuối tuần',
    createdAt: '2026-02-15',
    initialYearlyRevenue: 8500000
  },
  {
    id: 'c3',
    name: 'Studio Thảo Nhi Bridal',
    phone: '0983 445 192',
    studioName: 'Thảo Nhi Bridal',
    address: '12 Quang Trung, Hà Đông',
    initialDebt: 0,
    customerType: 'GIÁ STUDIO',
    notes: 'Thanh toán dứt điểm từng đơn khi giao hàng',
    createdAt: '2026-03-01',
    initialYearlyRevenue: 5000000
  },
  {
    id: 'c4',
    name: 'Freelance',
    phone: '',
    studioName: 'Freelance / Thợ tự do',
    address: 'Vãng lai tại tiệm',
    initialDebt: 0,
    customerType: 'Freelance',
    notes: 'Tệp khách Freelance vãng lai ghé tiệm in 1-2 lần (có thể ghi tên riêng từng người khi lên đơn)',
    createdAt: '2026-04-12',
    initialYearlyRevenue: 0
  },
  {
    id: 'c5',
    name: 'Khách Lẻ',
    phone: '',
    studioName: 'Khách lẻ vãng lai',
    address: 'Vãng lai tại tiệm',
    initialDebt: 0,
    customerType: 'Khách Lẻ',
    notes: 'Tệp khách lẻ in ảnh gia đình, tiệc vãng lai ghé tiệm 1-2 lần (có thể ghi tên riêng từng người khi lên đơn)',
    createdAt: '2026-05-20',
    initialYearlyRevenue: 0
  }
];

export const DEFAULT_ORDERS: Order[] = [
  {
    id: 'ord-01',
    orderNumber: '194-2026-001',
    date: '2026-01-15',
    customerId: 'c1',
    customerName: 'Studio Áo Cưới Hoàng Gia',
    customerPhone: '0978 223 114',
    customerAddress: '45 Lê Duẩn, Hà Nội',
    items: [
      { id: 'i1', date: '2026-01-15', productCode: 'TG6090', productName: 'Ảnh Cổng Cưới Tráng Gương Pha Lê Bo Viền', size: '60x90', price: 460000, quantity: 2, amount: 920000, note: 'Bo viền vàng ánh kim' },
      { id: 'i2', date: '2026-01-15', productCode: 'TG2030', productName: 'Ảnh Tráng Gương Bo Viền Vàng Kim', size: '20x30', price: 95000, quantity: 4, amount: 380000, note: 'Để bàn tiệc' },
      { id: 'i3', date: '2026-01-15', productCode: 'ABMP20x30', productName: 'Album Mở Phẳng 20x30 10 Tờ', size: '20x30', price: 390000, quantity: 1, amount: 390000, note: 'Khắc tên CD-CR' }
    ],
    subtotal: 1690000,
    discount: 50000,
    previousDebt: 500000,
    paid: 1000000,
    totalDue: 1140000,
    status: 'delivered',
    notes: 'Giao trước thứ 6 cho khách cưới',
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-01-15T09:00:00Z'
  },
  {
    id: 'ord-02',
    orderNumber: '194-2026-002',
    date: '2026-02-18',
    customerId: 'c2',
    customerName: 'Minh Tuấn Wedding & Events',
    customerPhone: '0914 556 778',
    customerAddress: '88 Cầu Giấy, Hà Nội',
    items: [
      { id: 'i4', date: '2026-02-18', productCode: 'EG6090', productName: 'Ảnh Cổng Cưới Ép Gỗ Bo Viền Vàng', size: '60x90', price: 340000, quantity: 2, amount: 680000 },
      { id: 'i5', date: '2026-02-18', productCode: 'EG1318', productName: 'Ảnh Ép Gỗ Láng Siêu Nét', size: '13x18', price: 28000, quantity: 10, amount: 280000 }
    ],
    subtotal: 960000,
    discount: 0,
    previousDebt: 0,
    paid: 960000,
    totalDue: 0,
    status: 'delivered',
    notes: 'Khách thanh toán đủ qua Techcombank',
    createdAt: '2026-02-18T10:30:00Z',
    updatedAt: '2026-02-18T10:30:00Z'
  },
  {
    id: 'ord-03',
    orderNumber: '194-2026-003',
    date: '2026-03-24',
    customerId: 'c3',
    customerName: 'Studio Thảo Nhi Bridal',
    customerPhone: '0983 445 192',
    customerAddress: '12 Quang Trung, Hà Đông',
    items: [
      { id: 'i6', date: '2026-03-24', productCode: 'PL6090', productName: 'Ảnh Cổng Pha Lê Kim Tuyến Bo Viền', size: '60x90', price: 530000, quantity: 1, amount: 530000 },
      { id: 'i7', date: '2026-03-24', productCode: 'ABMP30x30', productName: 'Album Mở Phẳng 30x30 10 Tờ', size: '30x30', price: 520000, quantity: 1, amount: 520000 },
      { id: 'i8', date: '2026-03-24', productCode: 'NEPST1', productName: 'Khung Gia Cố 80*120', size: '80*120', price: 60000, quantity: 1, amount: 60000 }
    ],
    subtotal: 1110000,
    discount: 10000,
    previousDebt: 0,
    paid: 1100000,
    totalDue: 0,
    status: 'delivered',
    notes: 'Đã hoàn tất thanh toán',
    createdAt: '2026-03-24T14:15:00Z',
    updatedAt: '2026-03-24T14:15:00Z'
  },
  {
    id: 'ord-04',
    orderNumber: '194-2026-004',
    date: '2026-04-10',
    customerId: 'c4',
    customerName: 'Thợ Chụp Tự Do Quốc Dũng',
    customerPhone: '0904 991 322',
    customerAddress: 'Ngõ 205 Giải Phóng, Hà Nội',
    items: [
      { id: 'i9', date: '2026-04-10', productCode: 'EL1318', productName: 'In Ảnh Ép Lụa / Phủ Màng UV', size: '13x18', price: 8000, quantity: 50, amount: 400000 },
      { id: 'i10', date: '2026-04-10', productCode: 'EG2030', productName: 'Ảnh Ép Gỗ Láng Để Bàn', size: '20x30', price: 65000, quantity: 4, amount: 260000 }
    ],
    subtotal: 660000,
    discount: 10000,
    previousDebt: 0,
    paid: 300000,
    totalDue: 350000,
    status: 'delivered',
    notes: 'Còn nợ 350k hẹn trả đơn sau',
    createdAt: '2026-04-10T11:00:00Z',
    updatedAt: '2026-04-10T11:00:00Z'
  },
  {
    id: 'ord-05',
    orderNumber: '194-2026-005',
    date: '2026-05-14',
    customerId: 'c1',
    customerName: 'Studio Áo Cưới Hoàng Gia',
    customerPhone: '0978 223 114',
    customerAddress: '45 Lê Duẩn, Hà Nội',
    items: [
      { id: 'i11', date: '2026-05-14', productCode: 'HDST60*90', productName: 'Ảnh HD Gương Siêu Bóng Bo Viền', size: '60*90', price: 560000, quantity: 1, amount: 560000, note: 'Khách Vip thích bo viền vàng' },
      { id: 'i12', date: '2026-05-14', productCode: 'TG5075', productName: 'Ảnh Cổng Cưới Tráng Gương Pha Lê', size: '50x75', price: 360000, quantity: 2, amount: 720000 },
      { id: 'i13', date: '2026-05-14', productCode: 'TG2030', productName: 'Ảnh Tráng Gương Bo Viền Vàng Kim', size: '20x30', price: 95000, quantity: 5, amount: 475000 }
    ],
    subtotal: 1755000,
    discount: 55000,
    previousDebt: 1140000,
    paid: 1500000,
    totalDue: 1340000,
    status: 'delivered',
    notes: 'Studio chuyển cọc 1tr5',
    createdAt: '2026-05-14T15:20:00Z',
    updatedAt: '2026-05-14T15:20:00Z'
  },
  {
    id: 'ord-06',
    orderNumber: '194-2026-006',
    date: '2026-06-20',
    customerId: 'c5',
    customerName: 'Chị Mai Hương (Khách Lẻ In Ảnh Gia Đình)',
    customerPhone: '0936 128 900',
    customerAddress: 'Khu Đô Thị Linh Đàm, Hoàng Mai, HN',
    items: [
      { id: 'i14', date: '2026-06-20', productCode: 'EG3045', productName: 'Ảnh Ép Gỗ Treo Tường', size: '30x45', price: 120000, quantity: 2, amount: 240000 },
      { id: 'i15', date: '2026-06-20', productCode: 'inST30*45', productName: 'In Ảnh Kỹ Thuật Số', size: '30*45', price: 45000, quantity: 2, amount: 90000 }
    ],
    subtotal: 330000,
    discount: 0,
    previousDebt: 0,
    paid: 330000,
    totalDue: 0,
    status: 'delivered',
    notes: 'Khách đến xưởng lấy ảnh trả tiền mặt',
    createdAt: '2026-06-20T16:00:00Z',
    updatedAt: '2026-06-20T16:00:00Z'
  },
  {
    id: 'ord-07',
    orderNumber: '194-2026-007',
    date: '2026-07-18',
    customerId: 'c2',
    customerName: 'Minh Tuấn Wedding & Events',
    customerPhone: '0914 556 778',
    customerAddress: '88 Cầu Giấy, Hà Nội',
    items: [
      { id: 'i16', date: '2026-07-18', productCode: 'TG6090', productName: 'Ảnh Cổng Cưới Tráng Gương Pha Lê Bo Viền', size: '60x90', price: 460000, quantity: 3, amount: 1380000 },
      { id: 'i17', date: '2026-07-18', productCode: 'ABMP20x20', productName: 'Album Mở Phẳng 20x20 10 Tờ', size: '20x20', price: 290000, quantity: 2, amount: 580000 }
    ],
    subtotal: 1960000,
    discount: 60000,
    previousDebt: 0,
    paid: 1300000,
    totalDue: 600000,
    status: 'delivered',
    notes: 'Còn nợ 600k chuyển khoản sau',
    createdAt: '2026-07-18T10:00:00Z',
    updatedAt: '2026-07-18T10:00:00Z'
  },
  {
    id: 'ord-08',
    orderNumber: '194-2026-008',
    date: '2026-08-25',
    customerId: 'c1',
    customerName: 'Studio Áo Cưới Hoàng Gia',
    customerPhone: '0978 223 114',
    customerAddress: '45 Lê Duẩn, Hà Nội',
    items: [
      { id: 'i18', date: '2026-08-25', productCode: 'PL6090', productName: 'Ảnh Cổng Pha Lê Kim Tuyến Bo Viền', size: '60x90', price: 530000, quantity: 2, amount: 1060000 },
      { id: 'i19', date: '2026-08-25', productCode: 'TG2030', productName: 'Ảnh Tráng Gương Bo Viền Vàng Kim', size: '20x30', price: 95000, quantity: 6, amount: 570000 },
      { id: 'i20', date: '2026-08-25', productCode: 'NEPST2', productName: 'Khung Gia Cố 100*150', size: '100*150', price: 90000, quantity: 2, amount: 180000 }
    ],
    subtotal: 1810000,
    discount: 50000,
    previousDebt: 1340000,
    paid: 1810000,
    totalDue: 1290000,
    status: 'delivered',
    notes: 'Thanh toán tiền đơn hàng, còn nợ cũ 1tr850',
    createdAt: '2026-08-25T11:45:00Z',
    updatedAt: '2026-08-25T11:45:00Z'
  },
  {
    id: 'ord-09',
    orderNumber: '194-2026-009',
    date: '2026-09-28',
    customerId: 'c3',
    customerName: 'Studio Thảo Nhi Bridal',
    customerPhone: '0983 445 192',
    customerAddress: '12 Quang Trung, Hà Đông',
    items: [
      { id: 'i21', date: '2026-09-28', productCode: 'TG6090', productName: 'Ảnh Cổng Cưới Tráng Gương Pha Lê Bo Viền', size: '60x90', price: 460000, quantity: 2, amount: 920000 },
      { id: 'i22', date: '2026-09-28', productCode: 'EL1521', productName: 'In Ảnh Ép Lụa / Phủ Màng UV', size: '15x21', price: 12000, quantity: 30, amount: 360000 },
      { id: 'i23', date: '2026-09-28', productCode: 'EG2030', productName: 'Ảnh Ép Gỗ Láng Để Bàn', size: '20x30', price: 65000, quantity: 3, amount: 195000 }
    ],
    subtotal: 1475000,
    discount: 25000,
    previousDebt: 0,
    paid: 1450000,
    totalDue: 0,
    status: 'completed',
    notes: 'Đã hoàn thiện đóng gói, chờ shiper lấy',
    createdAt: '2026-09-28T09:10:00Z',
    updatedAt: '2026-09-28T14:30:00Z'
  }
];

export const DEFAULT_MATERIALS: Material[] = [
  {
    id: 'mat-01',
    code: '6090 12li',
    name: 'Gỗ MDF 60x90 12li bo góc Lõi Xanh Chống Ẩm',
    category: 'Gỗ MDF',
    unit: 'Tấm',
    costPrice: 45000,
    stockQuantity: 38,
    minStockAlert: 10,
    supplier: 'Xưởng Gỗ Công Nghiệp Phú Mỹ',
    notes: 'Chuyên dùng làm ảnh cổng ép gỗ và tráng gương 12li (Mã VT: 6090 12li)',
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05'
  },
  {
    id: 'mat-01b',
    code: '6090 9li',
    name: 'Gỗ MDF 60x90 9li Tiêu Chuẩn',
    category: 'Gỗ MDF',
    unit: 'Tấm',
    costPrice: 38000,
    stockQuantity: 25,
    minStockAlert: 8,
    supplier: 'Xưởng Gỗ Công Nghiệp Phú Mỹ',
    notes: 'Ván 9li nhẹ dùng cho khung viền mỏng (Mã VT: 6090 9li)',
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05'
  },
  {
    id: 'mat-01c',
    code: '6090 Fomex',
    name: 'Tấm Fomex 60x90 9li Siêu Nhẹ 4K/HD Pro',
    category: 'Fomex siêu nhẹ',
    unit: 'Tấm',
    costPrice: 48000,
    stockQuantity: 20,
    minStockAlert: 5,
    supplier: 'Đại Lý Fomex Hoàng Kim',
    notes: 'Fomex 9li siêu nhẹ không cong vênh (Mã VT: 6090 Fomex)',
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05'
  },
  {
    id: 'mat-02',
    code: '5075 12li',
    name: 'Gỗ MDF 50x75 12li Lõi Xanh Chống Ẩm',
    category: 'Gỗ MDF',
    unit: 'Tấm',
    costPrice: 32000,
    stockQuantity: 18,
    minStockAlert: 8,
    supplier: 'Xưởng Gỗ Công Nghiệp Phú Mỹ',
    notes: 'Kích thước cổng cưới thông dụng (Mã VT: 5075 12li)',
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05'
  },
  {
    id: 'mat-02-9li',
    code: '5075 9li',
    name: 'Gỗ MDF 50x75 9li Tiêu Chuẩn',
    category: 'Gỗ MDF',
    unit: 'Tấm',
    costPrice: 26000,
    stockQuantity: 22,
    minStockAlert: 8,
    supplier: 'Xưởng Gỗ Công Nghiệp Phú Mỹ',
    notes: 'Ván 9li tiêu chuẩn 50x75 (Mã VT: 5075 9li)',
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05'
  },
  {
    id: 'mat-02b',
    code: '4060 12li',
    name: 'Gỗ MDF 40x60 12li Lõi Xanh Chống Ẩm',
    category: 'Gỗ MDF',
    unit: 'Tấm',
    costPrice: 26520,
    stockQuantity: 28,
    minStockAlert: 10,
    supplier: 'Xưởng Gỗ Công Nghiệp Phú Mỹ',
    notes: 'Ván 12li lõi xanh dùng cho ảnh treo tường & ảnh HD gương (Mã VT: 4060 12li)',
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05'
  },
  {
    id: 'mat-02b-9li',
    code: '4060 9li',
    name: 'Gỗ MDF 40x60 9li Tiêu Chuẩn',
    category: 'Gỗ MDF',
    unit: 'Tấm',
    costPrice: 20265,
    stockQuantity: 30,
    minStockAlert: 10,
    supplier: 'Xưởng Gỗ Công Nghiệp Phú Mỹ',
    notes: 'Ván 9li tiêu chuẩn dùng cho ảnh viền bo mỏng Lụa & Mika (Mã VT: 4060 9li)',
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05'
  },
  {
    id: 'mat-02b-fomex',
    code: '4060 Fomex',
    name: 'Tấm Fomex 40x60 9li Siêu Nhẹ',
    category: 'Fomex siêu nhẹ',
    unit: 'Tấm',
    costPrice: 28000,
    stockQuantity: 25,
    minStockAlert: 8,
    supplier: 'Đại Lý Fomex Hoàng Kim',
    notes: 'Fomex 9li siêu nhẹ 40x60 (Mã VT: 4060 Fomex)',
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05'
  },
  {
    id: 'mat-02c',
    code: '3045 12li',
    name: 'Gỗ MDF 30x45 12li Lõi Xanh Chống Ẩm',
    category: 'Gỗ MDF',
    unit: 'Tấm',
    costPrice: 20000,
    stockQuantity: 35,
    minStockAlert: 10,
    supplier: 'Xưởng Gỗ Công Nghiệp Phú Mỹ',
    notes: 'Cỡ ảnh gia đình để bàn hoặc treo phòng ngủ (Mã VT: 3045 12li)',
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05'
  },
  {
    id: 'mat-03',
    code: '2030 9li bo',
    name: 'Gỗ MDF 20x30 9li bo góc',
    category: 'Gỗ MDF',
    unit: 'Tấm',
    costPrice: 14000,
    stockQuantity: 52,
    minStockAlert: 15,
    supplier: 'Xưởng Gỗ Công Nghiệp Phú Mỹ',
    notes: 'Kèm chân chống nhựa để bàn (Mã VT: 2030 9li bo)',
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05'
  },
  {
    id: 'mat-03-hq-2030',
    code: '2030 9li HQ',
    name: 'Gỗ MDF 2030 dày 9 li viền Hàn Quốc',
    category: 'Gỗ MDF',
    unit: 'Tấm',
    costPrice: 20000,
    stockQuantity: 45,
    minStockAlert: 10,
    supplier: 'Xưởng Khung Viền Nhập Khẩu Hàn Quốc',
    notes: 'Khung viền Hàn Quốc cao cấp 20x30 (Mã VT: 2030 9li HQ)',
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05'
  },
  {
    id: 'mat-03b',
    code: '1521 9li bo',
    name: 'Gỗ MDF 15x21 9li bo góc',
    category: 'Gỗ MDF',
    unit: 'Tấm',
    costPrice: 10000,
    stockQuantity: 60,
    minStockAlert: 15,
    supplier: 'Xưởng Gỗ Công Nghiệp Phú Mỹ',
    notes: 'Khổ ảnh bàn tiệc cưới phổ biến (Mã VT: 1521 9li bo)',
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05'
  },
  {
    id: 'mat-03b-hq-1521',
    code: '1521 9li HQ',
    name: 'Gỗ MDF 1521 9li Viền Hàn Quốc',
    category: 'Gỗ MDF',
    unit: 'Tấm',
    costPrice: 15000,
    stockQuantity: 50,
    minStockAlert: 10,
    supplier: 'Xưởng Khung Viền Nhập Khẩu Hàn Quốc',
    notes: 'Khung viền Hàn Quốc cao cấp 15x21 (Mã VT: 1521 9li HQ)',
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05'
  },
  {
    id: 'mat-03c',
    code: '1318 9li bo',
    name: 'Gỗ MDF 13x18 9li bo góc',
    category: 'Gỗ MDF',
    unit: 'Tấm',
    costPrice: 8000,
    stockQuantity: 80,
    minStockAlert: 20,
    supplier: 'Xưởng Gỗ Công Nghiệp Phú Mỹ',
    notes: 'Khổ ảnh nhỏ để bàn làm việc (Mã VT: 1318 9li bo)',
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05'
  },
  {
    id: 'mat-03d',
    code: '70105 12li',
    name: 'Gỗ MDF 70x105 12li Khổ Lớn',
    category: 'Gỗ MDF',
    unit: 'Tấm',
    costPrice: 65000,
    stockQuantity: 15,
    minStockAlert: 5,
    supplier: 'Xưởng Gỗ Công Nghiệp Phú Mỹ',
    notes: 'Ảnh phóng lớn hội nghị, ảnh cưới sang trọng (Mã VT: 70105 12li)',
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05'
  },
  {
    id: 'mat-03e',
    code: '80120 12li',
    name: 'Gỗ MDF 80x120 12li Khổ Lớn',
    category: 'Gỗ MDF',
    unit: 'Tấm',
    costPrice: 85000,
    stockQuantity: 12,
    minStockAlert: 4,
    supplier: 'Xưởng Gỗ Công Nghiệp Phú Mỹ',
    notes: 'Ảnh cổng đại tiệc đại sảnh (Mã VT: 80120 12li)',
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05'
  },
  {
    id: 'mat-04',
    code: 'VT-GIAY-61',
    name: 'Giấy In Ảnh Fujifilm Lụa Cuộn (Khổ 61cm x 30m)',
    category: 'Giấy In Ảnh',
    unit: 'Cuộn',
    costPrice: 580000,
    stockQuantity: 5,
    minStockAlert: 2,
    supplier: 'Công Ty Thiết Bị Ngành Ảnh Minh Khang',
    notes: 'Giấy chính hãng Fuji siêu nét độ bền màu cao',
    createdAt: '2026-01-08',
    updatedAt: '2026-01-08'
  },
  {
    id: 'mat-05',
    code: 'VT-MICA-6090',
    name: 'Tấm Mica Trong Ép Tráng Gương 60x90 (Độ Dày 2mm)',
    category: 'Mica & Pha Lê',
    unit: 'Tấm',
    costPrice: 55000,
    stockQuantity: 3, // SẮP HẾT (< 8)
    minStockAlert: 8,
    supplier: 'Đại Lý Mica Hoàng Kim Hà Nội',
    notes: 'Mica Đài Loan chống ố vàng',
    createdAt: '2026-01-10',
    updatedAt: '2026-01-10'
  }
];

export const DEFAULT_STOCK_IMPORTS: StockImportReceipt[] = [
  {
    id: 'imp-01',
    receiptNumber: 'NK-194-2026-001',
    date: '2026-01-08',
    supplier: 'Xưởng Gỗ Công Nghiệp Phú Mỹ',
    items: [
      { id: 'ii-1', materialId: 'mat-01', materialCode: 'VT-GO-6090', materialName: 'Gỗ MDF Chống Ẩm Lõi Xanh 60x90', unit: 'Tấm', quantity: 30, costPrice: 45000, totalCost: 1350000 },
      { id: 'ii-2', materialId: 'mat-02', materialCode: 'VT-GO-5075', materialName: 'Gỗ MDF Chống Ẩm Lõi Xanh 50x75', unit: 'Tấm', quantity: 20, costPrice: 32000, totalCost: 640000 },
      { id: 'ii-3', materialId: 'mat-03', materialCode: 'VT-GO-2030', materialName: 'Gỗ MDF Chống Ẩm 20x30 Để Bàn', unit: 'Tấm', quantity: 40, costPrice: 14000, totalCost: 560000 }
    ],
    totalAmount: 2550000,
    paid: 2550000,
    notes: 'Nhập gỗ đầu năm phục vụ mùa cưới tháng 1',
    createdAt: '2026-01-08T08:30:00Z'
  },
  {
    id: 'imp-02',
    receiptNumber: 'NK-194-2026-002',
    date: '2026-02-18',
    supplier: 'Công Ty Thiết Bị Ngành Ảnh Minh Khang',
    items: [
      { id: 'ii-4', materialId: 'mat-04', materialCode: 'VT-GIAY-61', materialName: 'Giấy In Ảnh Fujifilm Lụa Cuộn (Khổ 61cm x 30m)', unit: 'Cuộn', quantity: 4, costPrice: 580000, totalCost: 2320000 },
      { id: 'ii-5', materialId: 'mat-01', materialCode: 'VT-GO-6090', materialName: 'Gỗ MDF 60x90 12li Lõi Xanh Chống Ẩm', unit: 'Tấm', quantity: 30, costPrice: 45000, totalCost: 1350000 }
    ],
    totalAmount: 3670000,
    paid: 3670000,
    notes: 'Nhập giấy in và ván gỗ mdf lõi xanh',
    createdAt: '2026-02-18T10:00:00Z'
  },
  {
    id: 'imp-03',
    receiptNumber: 'NK-194-2026-003',
    date: '2026-04-10',
    supplier: 'Đại Lý Mica Hoàng Kim Hà Nội',
    items: [
      { id: 'ii-6', materialId: 'mat-05', materialCode: 'VT-MICA-6090', materialName: 'Tấm Mica Trong Ép Tráng Gương 60x90 (Độ Dày 2mm)', unit: 'Tấm', quantity: 25, costPrice: 55000, totalCost: 1375000 },
      { id: 'ii-7', materialId: 'mat-02', materialCode: 'VT-GO-5075', materialName: 'Gỗ MDF 50x75 12li Lõi Xanh Chống Ẩm', unit: 'Tấm', quantity: 35, costPrice: 32000, totalCost: 1120000 }
    ],
    totalAmount: 2495000,
    paid: 2495000,
    notes: 'Nhập mica tráng gương pha lê và ván gỗ 50x75',
    createdAt: '2026-04-10T14:15:00Z'
  },
  {
    id: 'imp-04',
    receiptNumber: 'NK-194-2026-004',
    date: '2026-06-15',
    supplier: 'Xưởng Gỗ Công Nghiệp Phú Mỹ',
    items: [
      { id: 'ii-8', materialId: 'mat-02b', materialCode: 'VT-GO-4060', materialName: 'Gỗ MDF 40x60 12li Lõi Xanh Chống Ẩm', unit: 'Tấm', quantity: 30, costPrice: 26000, totalCost: 780000 },
      { id: 'ii-9', materialId: 'mat-02c', materialCode: 'VT-GO-3045', materialName: 'Gỗ MDF 30x45 12li Lõi Xanh Chống Ẩm', unit: 'Tấm', quantity: 40, costPrice: 20000, totalCost: 800000 }
    ],
    totalAmount: 1580000,
    paid: 1580000,
    notes: 'Nhập ván gỗ MDF 40x60 và 30x45',
    createdAt: '2026-06-15T09:20:00Z'
  },
  {
    id: 'imp-05',
    receiptNumber: 'NK-194-2026-005',
    date: '2026-08-12',
    supplier: 'Công Ty Thiết Bị Ngành Ảnh Minh Khang',
    items: [
      { id: 'ii-10', materialId: 'mat-04', materialCode: 'VT-GIAY-61', materialName: 'Giấy In Ảnh Fujifilm Lụa Cuộn (Khổ 61cm x 30m)', unit: 'Cuộn', quantity: 3, costPrice: 580000, totalCost: 1740000 },
      { id: 'ii-11', materialId: 'mat-01b', materialCode: 'VT-GO-6090-9LI', materialName: 'Gỗ MDF 60x90 9li Tiêu Chuẩn', unit: 'Tấm', quantity: 25, costPrice: 38000, totalCost: 950000 },
      { id: 'ii-12', materialId: 'mat-03', materialCode: 'VT-GO-2030', materialName: 'Gỗ MDF 20x30 9li Để Bàn', unit: 'Tấm', quantity: 50, costPrice: 14000, totalCost: 700000 }
    ],
    totalAmount: 3390000,
    paid: 3390000,
    notes: 'Nhập giấy in và ván gỗ MDF để bàn mùa thu đông',
    createdAt: '2026-08-12T16:00:00Z'
  }
];

export const DEFAULT_COMBOS: StudioCombo[] = [
  {
    id: 'combo-thuhang-01',
    name: 'Combo Thu Hằng Studio (Ảnh Cổng VIP + 2 Bàn + Album)',
    studioName: 'Thu Hằng Studio',
    description: 'Bộ sản phẩm cưới quen thuộc nhất của Thu Hằng Studio: 1 ảnh cổng HD 60x90, 2 ảnh bàn HD 20x30, 1 Album mở phẳng 20x30',
    items: [
      {
        id: 'ci-1',
        productCode: 'HDST60*90',
        productName: 'Ảnh HD Gương Siêu Bóng Bo Viền',
        size: '60*90',
        quantity: 1,
        note: 'Bo viền vàng ánh kim (Ảnh Cổng Cưới VIP)'
      },
      {
        id: 'ci-2',
        productCode: 'HDST20*30',
        productName: 'Ảnh HD Gương Siêu Bóng Bo Viền',
        size: '20*30',
        quantity: 2,
        note: 'Để bàn trang trí gallery'
      },
      {
        id: 'ci-3',
        productCode: 'ABMP20x30',
        productName: 'Album Mở Phẳng 20x30 10 Tờ',
        size: '20x30',
        quantity: 1,
        note: 'In sắc nét cao cấp'
      }
    ],
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-01-10T08:00:00Z'
  },
  {
    id: 'combo-hoanggia-01',
    name: 'Combo Studio Hoàng Gia (Tráng Gương Pha Lê + Bàn)',
    studioName: 'Studio Áo Cưới Hoàng Gia',
    description: '1 Ảnh Cổng Tráng Gương Pha Lê 60x90 bo viền sang trọng, 2 Ảnh Ép Lụa 15x21 để bàn',
    items: [
      {
        id: 'ci-4',
        productCode: 'TG6090',
        productName: 'Ảnh Cổng Cưới Tráng Gương Pha Lê Bo Viền',
        size: '60x90',
        quantity: 1,
        note: 'Viền vàng champagne'
      },
      {
        id: 'ci-5',
        productCode: 'LVST15*21',
        productName: 'Ảnh Lụa Viền Bo Viền',
        size: '15*21',
        quantity: 2,
        note: 'Ảnh bàn cưới'
      }
    ],
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-01-15T08:00:00Z'
  },
  {
    id: 'combo-wedding-std',
    name: 'Combo Cưới Tiêu Chuẩn (Cổng Gỗ 60x90 + 2 Bàn 13x18)',
    studioName: 'Dùng chung',
    description: 'Combo gói tiệc cưới phổ thông giá xưởng tốt nhất: 1 ảnh ép gỗ 60x90 bo viền và 2 ảnh bàn 13x18',
    items: [
      {
        id: 'ci-6',
        productCode: 'EG6090',
        productName: 'Ảnh Cổng Ép Gỗ Láng Bo Viền',
        size: '60x90',
        quantity: 1,
        note: 'Ảnh cổng tiệc cưới'
      },
      {
        id: 'ci-7',
        productCode: 'inepST13*18',
        productName: 'In Ảnh Kỹ Thuật Số Ép Lụa/Bóng',
        size: '13*18',
        quantity: 2,
        note: 'Kèm chân để bàn'
      }
    ],
    createdAt: '2026-02-01T08:00:00Z',
    updatedAt: '2026-02-01T08:00:00Z'
  },
  {
    id: 'combo-mika-01',
    name: 'Combo Mika Gương Bóng (Cổng 60x90 + 2 Bàn 20x30)',
    studioName: 'Dùng chung',
    description: '1 Ảnh Cổng Mika Phổ Thông Bo Viền 60x90, 2 Ảnh Mika 20x30 để bàn gallery',
    items: [
      {
        id: 'ci-8',
        productCode: 'MKST60*90',
        productName: 'Ảnh Mika Phổ Thông Bo Viền',
        size: '60*90',
        quantity: 1,
        note: 'Cổng mika sáng bóng'
      },
      {
        id: 'ci-9',
        productCode: 'MKST20*30',
        productName: 'Ảnh Mika Phổ Thông Bo Viền',
        size: '20*30',
        quantity: 2,
        note: 'Ảnh bàn'
      }
    ],
    createdAt: '2026-02-10T08:00:00Z',
    updatedAt: '2026-02-10T08:00:00Z'
  }
];

// =================================================================
// 12 MÀU MỰC CHUYÊN DỤNG TIỆM IN 194 (CANON LUCIA PRO)
// PM, R, C, PGY, PBK, MBK, CO, GY, B, Y, M, PC
// =================================================================
export const INK_12_COLORS: InkColorMeta[] = [
  {
    code: 'PM',
    name: 'Mực PM',
    vietnameseName: 'Photo Magenta',
    hex: '#ec4899',
    textColor: '#ffffff',
    badgeBg: 'bg-pink-500 text-white',
    description: 'Tái tạo tông da hồng hào sáng mịn và chi tiết cánh hoa tươi sáng'
  },
  {
    code: 'R',
    name: 'Mực R',
    vietnameseName: 'Red',
    hex: '#ef4444',
    textColor: '#ffffff',
    badgeBg: 'bg-red-600 text-white',
    description: 'Mở rộng dải màu đỏ cờ, váy cưới đỏ, áo dài truyền thống rực rỡ'
  },
  {
    code: 'C',
    name: 'Mực C',
    vietnameseName: 'Cyan',
    hex: '#06b6d4',
    textColor: '#ffffff',
    badgeBg: 'bg-cyan-500 text-white',
    description: 'Màu cơ bản tái tạo bầu trời trong và mặt biển sâu thẳm'
  },
  {
    code: 'PGY',
    name: 'Mực PGY',
    vietnameseName: 'Photo Gray',
    hex: '#94a3b8',
    textColor: '#0f172a',
    badgeBg: 'bg-slate-400 text-slate-900',
    description: 'Khử hạt grain ở vùng sáng highlight, chuyển sắc cực mịn'
  },
  {
    code: 'PBK',
    name: 'Mực PBK',
    vietnameseName: 'Photo Black',
    hex: '#1e293b',
    textColor: '#ffffff',
    badgeBg: 'bg-slate-800 text-white',
    description: 'Tạo độ tương phản sâu trên giấy bóng, tráng gương, pha lê'
  },
  {
    code: 'MBK',
    name: 'Mực MBK',
    vietnameseName: 'Matte Black',
    hex: '#09090b',
    textColor: '#ffffff',
    badgeBg: 'bg-black text-white',
    description: 'Độ đậm Dmax tối đa trên giấy lụa, giấy mỹ thuật và canvas'
  },
  {
    code: 'CO',
    name: 'Mực CO',
    vietnameseName: 'Chroma Optimizer',
    hex: '#8b5cf6',
    textColor: '#ffffff',
    badgeBg: 'bg-purple-600 text-white',
    description: 'Làm phẳng vi mô bề mặt, khử ánh đồng phản chiếu bronzing'
  },
  {
    code: 'GY',
    name: 'Mực GY',
    vietnameseName: 'Gray',
    hex: '#64748b',
    textColor: '#ffffff',
    badgeBg: 'bg-slate-600 text-white',
    description: 'Kiểm soát cân bằng xám trung tính, ảnh đen trắng chuẩn studio'
  },
  {
    code: 'B',
    name: 'Mực B',
    vietnameseName: 'Blue',
    hex: '#2563eb',
    textColor: '#ffffff',
    badgeBg: 'bg-blue-600 text-white',
    description: 'Mở rộng dải màu hoàng hôn, biển đêm và trang phục xanh'
  },
  {
    code: 'Y',
    name: 'Mực Y',
    vietnameseName: 'Yellow',
    hex: '#eab308',
    textColor: '#0f172a',
    badgeBg: 'bg-amber-400 text-slate-950',
    description: 'Tái tạo ánh nắng ấm áp, trang sức vàng và tông màu ấm áp'
  },
  {
    code: 'M',
    name: 'Mực M',
    vietnameseName: 'Magenta',
    hex: '#c026d3',
    textColor: '#ffffff',
    badgeBg: 'bg-fuchsia-600 text-white',
    description: 'Màu cơ bản tái tạo dải màu ấm và chuyển tông tương phản'
  },
  {
    code: 'PC',
    name: 'Mực PC',
    vietnameseName: 'Photo Cyan',
    hex: '#38bdf8',
    textColor: '#0f172a',
    badgeBg: 'bg-sky-400 text-slate-950',
    description: 'Chuyển sắc mượt mà cho bầu trời xanh ngắt và tà áo dài nhẹ nhàng'
  }
];

export const DEFAULT_INK_IMPORTS: InkImportRecord[] = [
  {
    id: 'ink-imp-2025-01',
    receiptNumber: 'NK-MUC-2025-001',
    date: '2025-04-12',
    year: 2025,
    supplier: 'SVP',
    items: {
      PM: 4, R: 3, C: 5, PGY: 6, PBK: 8, MBK: 10,
      CO: 8, GY: 5, B: 3, Y: 6, M: 5, PC: 4
    },
    totalQuantity: 67,
    unit: 'Bình',
    costPricePerBottle: 850000,
    totalCost: 56950000,
    notes: 'Nhập mực đợt 1 năm 2025 nhà cung cấp SVP',
    createdAt: '2025-04-12T09:00:00Z'
  },
  {
    id: 'ink-imp-2025-02',
    receiptNumber: 'NK-MUC-2025-002',
    date: '2025-09-20',
    year: 2025,
    supplier: 'SVP',
    items: {
      PM: 5, R: 4, C: 6, PGY: 7, PBK: 9, MBK: 12,
      CO: 10, GY: 6, B: 4, Y: 7, M: 6, PC: 5
    },
    totalQuantity: 81,
    unit: 'Bình',
    costPricePerBottle: 850000,
    totalCost: 68850000,
    notes: 'Nhập phục vụ cao điểm mùa cưới cuối năm 2025 từ SVP',
    createdAt: '2025-09-20T10:30:00Z'
  },
  {
    id: 'ink-imp-2026-01',
    receiptNumber: 'NK-MUC-2026-001',
    date: '2026-01-15',
    year: 2026,
    supplier: 'SVP',
    items: {
      PM: 6, R: 4, C: 6, PGY: 8, PBK: 10, MBK: 12,
      CO: 10, GY: 6, B: 4, Y: 7, M: 6, PC: 5
    },
    totalQuantity: 84,
    unit: 'Bình',
    costPricePerBottle: 900000,
    totalCost: 73920000,
    notes: 'Nhập trọn bộ 12 màu Lucia Pro đợt đầu năm 2026 từ NCC SVP',
    createdAt: '2026-01-15T08:30:00Z'
  },
  {
    id: 'ink-imp-2026-02',
    receiptNumber: 'NK-MUC-2026-002',
    date: '2026-03-22',
    year: 2026,
    supplier: 'SVP',
    items: {
      PM: 4, R: 3, C: 5, PGY: 6, PBK: 8, MBK: 10,
      CO: 8, GY: 4, B: 3, Y: 5, M: 4, PC: 4
    },
    totalQuantity: 64,
    unit: 'Bình',
    costPricePerBottle: 900000,
    totalCost: 56320000,
    notes: 'Bổ sung mực đen MBK, PBK và phủ bóng CO từ SVP',
    createdAt: '2026-03-22T14:00:00Z'
  }
];


