export interface ProductRecipeItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  quantityPerProduct: number;
}

export type ProductCategory = 'GIÁ STUDIO' | 'Freelance' | 'Khách Lẻ';

export interface Product {
  id: string;
  code: string; // e.g. 'EG1015', 'TG6090'
  name: string; // e.g. 'Ảnh ép gỗ láng'
  size: string; // e.g. '10x15', '60x90'
  price: number; // VND
  costPrice?: number;
  category: ProductCategory | string;
  unit: string; // 'tấm', 'cái', 'cuốn', 'bộ'
  description?: string;
  recipe?: ProductRecipeItem[]; // Danh sách vật tư kho cấu thành tấm ảnh này
  materialCoreCode?: string; // Mã vật tư kho tương thích (VD: 'VT-GO-6090', 'VT-FOMEX-6090' hoặc 'NONE')
  materialCoreName?: string; // Tên cốt vật tư tương thích (VD: 'Gỗ MDF 60x90 12li Lõi Xanh Chống Ẩm')
  materialCoreId?: string; // ID vật tư kho tương ứng (nếu có)
  userId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FavoriteMonthlySettlement {
  discount?: number;          // Chiết khấu Thanh Toán nhập thủ công hoặc tính theo %
  previousDebt?: number;      // Nợ cũ mang sang tháng này (nhập thủ công hoặc chốt kết chuyển)
  manualMonthTotal?: number;  // Ghi đè tổng tiền tháng nếu cần
  note?: string;              // Ghi chú nếu có
  isSettled?: boolean;        // Đánh dấu đã chốt tháng
  settledAt?: string;         // Thời gian chốt tháng
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  studioName?: string;
  address?: string;
  initialDebt: number; // Nợ ban đầu
  customerType?: ProductCategory; // 'GIÁ STUDIO' | 'Freelance' | 'Khách Lẻ'
  notes?: string;
  createdAt: string;
  yearlyRevenue?: number; // Tổng doanh thu từ 01/01 đến 31/12 hàng năm (cộng dồn sau mỗi hóa đơn)
  initialYearlyRevenue?: number; // Doanh thu ban đầu trước khi dùng phần mềm (cho năm hiện tại hoặc mặc định)
  initialYearlyRevenues?: Record<number, number>; // Doanh thu ban đầu theo từng năm { 2026: 25000000, 2025: ... }
  isFavorite?: boolean;       // Khách hàng yêu thích (⭐)
  favoriteSettlements?: Record<string, FavoriteMonthlySettlement>; // Theo dõi công nợ theo tháng "YYYY-MM"
  userId?: string;
  createdBy?: string;
}

export interface OrderItem {
  id: string;
  date: string; // YYYY-MM-DD
  productCode: string;
  productName: string;
  size: string;
  price: number;
  quantity: number;
  amount: number; // quantity * price
  note?: string;
  customMaterials?: MaterialDeduction[]; // Danh sách vật tư tùy chỉnh cho dòng ảnh này
  materialCoreCode?: string; // Mã cốt vật tư tương thích tự động nhập theo sản phẩm (hoặc nhập thủ công)
  materialCoreName?: string; // Tên cốt vật tư tương thích
  materialCoreId?: string; // ID vật tư kho tương ứng
}

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'delivered' | 'cancelled';

export interface MaterialDeduction {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  quantity: number;
  date?: string; // YYYY-MM-DD - Ngày thực tế trừ kho vật tư
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. 'XI194-2026-0042'
  date: string; // YYYY-MM-DD
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  items: OrderItem[];
  subtotal: number; // Tổng tiền hàng
  discount: number; // Giảm giá
  previousDebt: number; // Nợ cũ của khách
  paid: number; // Đã thanh toán / Tạm ứng
  totalDue: number; // Cần thanh toán = subtotal - discount + previousDebt - paid
  status: OrderStatus;
  materialsDeducted?: MaterialDeduction[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  createdBy?: string;
}

export interface DebtPayment {
  id: string;
  customerId: string;
  date: string;
  amount: number;
  paymentMethod: 'cash' | 'transfer';
  note?: string;
  userId?: string;
}

export interface WorkshopInfo {
  name: string;
  subtitle: string;
  phone: string;
  hotline: string;
  address: string;
  zalo: string;
  bankAccount: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
  userId?: string;
  updatedAt?: string;
}

export type MaterialCategory =
  | 'Gỗ MDF'
  | 'Fomex siêu nhẹ'
  | 'Giấy In Ảnh'
  | 'Mica & Pha Lê'
  | 'Khung Ảnh'
  | 'Mực In'
  | 'Keo & Màng Lụa';

export interface Material {
  id: string;
  code: string; // e.g. 'VT-GO-6090'
  name: string; // e.g. 'Gỗ MDF 60x90 chống ẩm'
  category: MaterialCategory;
  unit: string; // 'Tấm', 'Cuộn', 'Cái', 'Bộ', 'Can'
  costPrice: number; // Giá nhập mỗi đơn vị (VNĐ)
  stockQuantity: number; // Số lượng tồn kho hiện có
  minStockAlert: number; // Ngưỡng cảnh báo sắp hết (ví dụ: < 5)
  supplier?: string; // Nhà cung cấp
  notes?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  createdBy?: string;
}

export interface StockImportItem {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  quantity: number; // Nhập bao nhiêu cái/tấm mỗi loại
  costPrice: number; // Đơn giá nhập
  totalCost: number; // Tổng giá nhập = quantity * costPrice
  note?: string; // Ghi chú mặt hàng
}

export interface StockImportReceipt {
  id: string;
  receiptNumber: string; // e.g. 'NK-194-2026-001'
  date: string; // YYYY-MM-DD
  orderDate?: string; // Ngày lên đơn thực tế
  supplier: string; // Tên nhà cung cấp / Nguồn nhập
  items: StockImportItem[];
  totalAmount: number; // Tổng giá nhập đợt này
  paid: number; // Số tiền đã thanh toán cho nhà cung cấp
  status?: 'pending' | 'ordered' | 'completed'; // Trạng thái: Chờ xử lý -> Đã lên đơn -> Hàng đã nhập kho
  isSynced?: boolean; // Đánh dấu đã cộng tồn kho & đồng bộ giá hay chưa
  syncedAt?: string;
  notes?: string;
  createdAt: string;
  userId?: string;
  createdBy?: string;
}

export interface ComboItem {
  id: string;
  productCode: string;
  productName: string;
  size: string;
  quantity: number;
  note?: string;
  defaultPrice?: number;
}

export interface StudioCombo {
  id: string;
  name: string; // Tên combo ví dụ: "Combo Thu Hằng Studio - Cưới VIP"
  studioName?: string; // Tên Studio gán (ví dụ: "Thu Hằng Studio", "Studio Hoàng Gia", hoặc "Dùng chung")
  customerId?: string; // ID khách hàng nếu gắn với khách cụ thể
  description?: string;
  items: ComboItem[];
  createdAt: string;
  updatedAt: string;
  userId?: string;
  createdBy?: string;
}

/**
 * Định mức chi phí giá vốn cấu thành 1 sản phẩm in ảnh (theo mẫu thống kê tiệm in 194):
 * - Mực: Chi phí mực in
 * - Giấy: Chi phí giấy in ảnh
 * - Ván/Fomex: Chi phí cốt ván MDF hoặc Fomex 9li
 * - Màng Ép: Chi phí màng ép bóng / lụa
 * - Khung/Viền: Chi phí khung phào / viền bo / nẹp
 * - Khác: Chi phí keo, màng PE, băng keo, phụ kiện...
 */
export interface ProductCostItem {
  ink?: number;       // Mực
  paper?: number;     // Giấy
  board?: number;     // Ván/Fomex
  film?: number;      // Màng Ép
  frame?: number;     // Khung/Viền
  other?: number;     // Khác
  manualStudioPrice?: number; // Giá bán Studio (nếu muốn nhập/sửa thủ công khi bảng giá chưa có)
  importCost?: number;        // Giá Vốn Nhập / Chi Phí Thành Phẩm (VNĐ)
}

export type ProductCostMap = Record<string, ProductCostItem>;

// =================================================================
// BẢNG GIÁ CỐT VẬT TƯ (VÁN MDF 9LI, VÁN MDF 12LI, FOMEX 9LI)
// =================================================================
export type CoreBoardCategory = 'mdf_9li' | 'mdf_12li' | 'fomex_9li' | 'mdf_9li_hq_1521' | 'mdf_9li_hq_2030' | 'none';

export interface BoardCorePriceRow {
  size: string;             // Ví dụ: '13x18', '15x21', '1521 9li HQ', '20x30', '2030 9li HQ', '40x60'...
  code?: string;            // Mã VT kho (e.g. '1521 9li HQ', '2030 9li HQ')
  name?: string;            // Tên VT kho (e.g. 'Gỗ MDF 1521 9li Viền Hàn Quốc')
  mdf9li: number;           // Đơn giá Ván MDF 9li (đ/tấm)
  mdf12li: number;          // Đơn giá Ván MDF 12li (đ/tấm)
  fomex9li: number;         // Đơn giá Fomex 9li (đ/tấm)
  updatedAt: string;        // Ngày sửa giá gần nhất (Tự động lưu ngày giờ hệ thống)
  isKoreanBorder?: boolean; // Đánh dấu vật tư Viền Hàn Quốc
}

export type BoardCorePriceMap = Record<string, BoardCorePriceRow>;

// =================================================================
// BẢNG GIÁ VẬT TƯ PHỤ KIỆN (MICA, VIỀN, PHÀO, KEO...)
// =================================================================
export interface AccessoryMaterialItem {
  id: string;               // ID duy nhất (ví dụ: 'acc-1', 'acc-mica-62-03')
  name: string;             // Tên sản phẩm / vật tư phụ kiện
  unit?: string;            // Đơn vị tính (VD: Cuộn, Mét, Cây, Hộp, Chai, Chiếc, Bộ...)
  price: number;            // Đơn giá (đ)
  updatedAt: string;        // Ngày sửa giá gần nhất (ngày giờ hệ thống)
  category?: string;        // Nhóm phân loại (Mica, Viền, Phào, Keo & Phụ kiện)
}

export type AccessoryMaterialMap = Record<string, AccessoryMaterialItem>;

// =================================================================
// BẢNG GIÁ DANH MỤC GIẤY IN (GIẤY RC BÓNG, GIẤY PP KHỔ 51->111)
// =================================================================
export interface PaperMaterialItem {
  id: string;               // e.g. 'G-RC-51'
  sku: string;              // e.g. 'G-RC-51'
  name: string;             // e.g. 'Giấy RC bóng khổ 51'
  paperType: 'Giấy RC bóng' | 'Giấy PP';
  widthSize: number;        // 51, 61, 76, 91, 111
  unit: string;             // 'Cuộn' hoặc 'roll'
  price: number;            // Đơn giá VNĐ theo cuộn
  updatedAt: string;        // Ngày sửa giá gần nhất
  supplier?: string;        // 'SVP' hoặc 'Toản HN'
}

export type PaperMaterialMap = Record<string, PaperMaterialItem>;


// =================================================================
// ĐỊNH NGHĨA HỆ MỰC IN 12 MÀU CHUYÊN NGHIỆP (CANON LUCIA PRO / IMAGEPROGRAF)
// PM, R, C, PGY, PBK, MBK, CO, GY, B, Y, M, PC
// =================================================================
export type InkColorCode =
  | 'PM'
  | 'R'
  | 'C'
  | 'PGY'
  | 'PBK'
  | 'MBK'
  | 'CO'
  | 'GY'
  | 'B'
  | 'Y'
  | 'M'
  | 'PC';

export interface InkColorMeta {
  code: InkColorCode;
  name: string;
  vietnameseName: string;
  hex: string;
  textColor: string;
  badgeBg: string;
  description: string;
}

export interface InkImportRecord {
  id: string;
  receiptNumber: string; // VD: NK-MUC-2026-001
  date: string; // YYYY-MM-DD
  year: number; // 2026, 2025...
  supplier: string; // Mặc định 'SVP'
  items: Record<InkColorCode, number>; // Số lượng bình nhập theo từng màu { PM: 2, R: 1, ... }
  totalQuantity: number; // Tổng số bình nhập đợt này
  unit: string; // 'Bình' | 'Hộp' | 'Chai'
  costPricePerBottle?: number; // Đơn giá nhập tham khảo (nếu có)
  totalCost?: number; // Tổng giá trị nhập (nếu có)
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  userId?: string;
  createdBy?: string;
}

/**
 * Khấu trừ doanh thu thủ công theo từng tháng hoặc năm
 * Key: "${year}-${month}" (VD: "2026-1", "2026-2", "2026-initial"...)
 * Value: Số tiền khấu trừ (VNĐ)
 */
export type MonthlyRevenueDeductions = Record<string, number>;

/**
 * Chỉnh sửa hoặc bổ sung doanh thu thủ công trên Sổ theo dõi doanh thu mẫu S1a
 */
export interface S1aDayOverride {
  explanation?: string; // Diễn giải tùy chỉnh
  amount?: number;      // Số tiền ghi đè (VNĐ)
  isEdited?: boolean;
}

export interface S1aManualEntry {
  id: string;
  date: string;         // YYYY-MM-DD
  explanation: string;  // Diễn giải (VD: In ảnh và đóng khung ảnh...)
  amount: number;       // Số tiền (VNĐ)
  createdAt: string;
  notes?: string;
  userId?: string;
  createdBy?: string;
}



