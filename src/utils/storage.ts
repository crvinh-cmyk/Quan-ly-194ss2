import { Product, Customer, Order, WorkshopInfo, Material, StockImportReceipt, StudioCombo, OrderStatus } from '../types';
import { isWalkInPoolCustomer, isFreelanceWalkInPool, isRetailWalkInPool } from './formatters';
import {
  DEFAULT_PRODUCTS,
  DEFAULT_CUSTOMERS,
  DEFAULT_ORDERS,
  DEFAULT_WORKSHOP_INFO,
  DEFAULT_MATERIALS,
  DEFAULT_STOCK_IMPORTS,
  DEFAULT_COMBOS
} from '../data/initialData';

const STORAGE_KEYS = {
  PRODUCTS: 'xuongin194_products',
  CUSTOMERS: 'xuongin194_customers',
  ORDERS: 'xuongin194_orders',
  WORKSHOP: 'xuongin194_workshop_info',
  MATERIALS: 'xuongin194_materials',
  STOCK_IMPORTS: 'xuongin194_stock_imports',
  COMBOS: 'xuongin194_combos'
};

/**
 * Kiểm tra và loại bỏ triệt để các mặt hàng người dùng đã yêu cầu xóa vĩnh viễn khỏi hệ thống
 */
export function isBannedMaterial(m: Partial<Material>): boolean {
  const name = (m.name || '').toLowerCase();
  const code = (m.code || '').toLowerCase();
  const id = (m.id || '').toLowerCase();

  // 1. Màng Cán Lụa Mờ Chống Lóa Cuộn 65cm x 40m
  if (name.includes('màng cán lụa') || code.includes('vt-mang-lua') || id === 'mat-11') return true;

  // 2. Keo AB Đổ Ảnh Pha Lê Tráng Gương Trong Suốt
  if (name.includes('keo ab') || code.includes('vt-keo-ab') || id === 'mat-10') return true;

  // 3. Bộ Mực In Phun Epson Chuyên Nghiệp (Set 6 Màu)
  if (name.includes('mực in phun epson') || code.includes('vt-muc-epson') || id === 'mat-09') return true;

  // 4, 5. Khung Composite Bo Viền Ảnh Cổng 50x75, 60x90
  if (name.includes('khung composite') || code.includes('vt-khung-5075') || code.includes('vt-khung-6090') || id === 'mat-07' || id === 'mat-08') return true;

  // 6. Tấm Mica Trong Ép Tráng Gương 50x75
  if ((name.includes('mica') && name.includes('50x75')) || code.includes('vt-mica-5075') || id === 'mat-06') return true;

  // 7-14. Tấm Fomex Siêu Nhẹ (tất cả các kích thước 70x105, 13x18, 15x21, 20x30, 30x45, 40x60, 50x75, 60x90 9li)
  if (name.includes('fomex') || code.includes('fx') || (m.category && m.category.toLowerCase().includes('fomex'))) return true;

  return false;
}

export function isBannedProduct(p: Partial<Product>): boolean {
  const name = (p.name || '').toLowerCase();
  const code = (p.code || '').toLowerCase();
  const size = (p.size || '').toLowerCase();

  // 1. Ảnh Cổng Mica Siêu Sáng Đèn LED Cảm Ứng
  if (name.includes('mica siêu sáng') || name.includes('đèn led') || code.startsWith('mc')) return true;

  // 2. Khung Hộp 3D Viền Nổi Ảnh Cổng
  if (name.includes('khung hộp 3d') || code.startsWith('kh5075') || code.startsWith('kh6090') || (code.startsWith('kh') && !code.startsWith('khach') && !code.startsWith('kl'))) return true;

  // 3. Album Cưới Siêu Sắc Nét Cao Cấp 30 Trang
  if (name.includes('album cưới siêu sắc nét') || (name.includes('siêu sắc nét') && name.includes('30 trang'))) return true;

  // 4, 5. Photobook Bìa Da Mở Phẳng 30 Trang, Photobook Tạp Chí Bìa Cứng 20 Trang
  if (name.includes('photobook')) return true;

  // 6. HDST110*180, HDST10*15, HDST6*9 (và biến thể HDFL, HDKL)
  if (/(hdst|hdfl|hdkl)/i.test(code)) {
    if (size.includes('110') || size.includes('180') || code.includes('110') ||
        size.includes('10*15') || size.includes('10x15') || code.includes('10*15') || code.includes('10x15') ||
        size.includes('6*9') || size.includes('6x9') || code.includes('6*9') || code.includes('6x9')) {
      return true;
    }
  }

  // 7. MKST110*180, MKST10*15, MKST6*9 (và biến thể MKFL, MKKL)
  if (/(mkst|mkfl|mkkl)/i.test(code)) {
    if (size.includes('110') || size.includes('180') || code.includes('110') ||
        size.includes('10*15') || size.includes('10x15') || code.includes('10*15') || code.includes('10x15') ||
        size.includes('6*9') || size.includes('6x9') || code.includes('6*9') || code.includes('6x9')) {
      return true;
    }
  }

  // 8. LVST110*180, LVST13*18, LVST10*15, LVST6*9 (và biến thể LVFL, LVKL)
  if (/(lvst|lvfl|lvkl)/i.test(code)) {
    if (size.includes('110') || size.includes('180') || code.includes('110') ||
        size.includes('13*18') || size.includes('13x18') || code.includes('13*18') || code.includes('13x18') ||
        size.includes('10*15') || size.includes('10x15') || code.includes('10*15') || code.includes('10x15') ||
        size.includes('6*9') || size.includes('6x9') || code.includes('6*9') || code.includes('6x9')) {
      return true;
    }
  }

  // 9. inST80*120, inST6*9 (và biến thể infl, inkl)
  if (/(inst|infl|inkl)/i.test(code)) {
    if (size.includes('80*120') || size.includes('80x120') || code.includes('80*120') || code.includes('80x120') ||
        size.includes('6*9') || size.includes('6x9') || code.includes('6*9') || code.includes('6x9')) {
      return true;
    }
  }

  // Phân loại theo tên & kích thước
  if (name.includes('ảnh hd gương') && (size.includes('110') || size.includes('10*15') || size.includes('6*9'))) return true;
  if (name.includes('ảnh mika') && (size.includes('110') || size.includes('10*15') || size.includes('6*9'))) return true;
  if (name.includes('ảnh lụa viền') && (size.includes('110') || size.includes('13*18') || size.includes('10*15') || size.includes('6*9'))) return true;
  if (name.includes('in ảnh kỹ thuật số') && (size.includes('80*120') || size.includes('6*9'))) return true;

  return false;
}

export function getStoredMaterials(): Material[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MATERIALS);
    // Khi localStorage hoàn toàn trống (lần đầu khởi chạy ứng dụng):
    if (raw === null) {
      const cleanDefaults = DEFAULT_MATERIALS.filter(m => !isBannedMaterial(m));
      localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(cleanDefaults));
      return cleanDefaults;
    }

    // Đã có dữ liệu trong localStorage (kể cả mảng rỗng [] khi người dùng xóa hết):
    // ƯU TIÊN TUYỆT ĐỐI đọc từ localStorage trước!
    // TUYỆT ĐỐI KHÔNG tự động chèn lại DEFAULT_MATERIALS để tôn trọng thao tác xóa của người dùng.
    let parsed: Material[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    // Lọc bỏ các mặt hàng người dùng đã yêu cầu xóa vĩnh viễn (nếu còn sót từ phiên bản cũ)
    const originalLen = parsed.length;
    parsed = parsed.filter(m => !isBannedMaterial(m));
    if (parsed.length !== originalLen) {
      localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(parsed));
    }

    return parsed;
  } catch (e) {
    console.error('Error loading materials from localStorage', e);
    return [];
  }
}

export function saveStoredMaterials(materials: Material[]): void {
  localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials));
}

export function getStoredStockImports(): StockImportReceipt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STOCK_IMPORTS);
    if (!raw) {
      return [];
    }
    const parsed: StockImportReceipt[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.error('Error loading stock imports from localStorage', e);
    return [];
  }
}

export function saveStoredStockImports(imports: StockImportReceipt[]): void {
  localStorage.setItem(STORAGE_KEYS.STOCK_IMPORTS, JSON.stringify(imports));
}

export function getStoredProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    // Khi localStorage hoàn toàn trống (lần đầu khởi chạy ứng dụng):
    if (raw === null) {
      const cleanDefaults = DEFAULT_PRODUCTS.filter(p => !isBannedProduct(p));
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(cleanDefaults));
      return cleanDefaults;
    }

    // Đã có dữ liệu trong localStorage (kể cả mảng rỗng [] khi người dùng đã xóa hết):
    // ƯU TIÊN TUYỆT ĐỐI đọc từ localStorage trước!
    // TUYỆT ĐỐI KHÔNG tự động chèn lại DEFAULT_PRODUCTS đã bị xóa!
    // TUYỆT ĐỐI KHÔNG ghi đè bảng Freelance khi người dùng đã tùy chỉnh!
    let parsed: Product[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    // Lọc bỏ các mặt hàng người dùng đã yêu cầu xóa vĩnh viễn (nếu còn sót từ cache cũ)
    const originalLen = parsed.length;
    parsed = parsed.filter(p => !isBannedProduct(p));
    if (parsed.length !== originalLen) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(parsed));
    }

    return parsed;
  } catch (e) {
    console.error('Error loading products from localStorage', e);
    return [];
  }
}

export function saveStoredProducts(products: Product[]): void {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
}

export function getStoredCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(DEFAULT_CUSTOMERS));
      return DEFAULT_CUSTOMERS;
    }
    let parsed: Customer[] = JSON.parse(raw);
    let updated = false;

    // Migrate existing customers
    parsed = parsed.map(c => {
      // TUYỆT ĐỐI không chạm vào khách Studio (như Son Studio, OH Studio...)
      if (c.customerType === 'GIÁ STUDIO' || c.name.toLowerCase().includes('studio') || (c.studioName && c.studioName.toLowerCase().includes('studio'))) {
        return c;
      }
      if (c.name.toLowerCase() === 'freelance' && (c.studioName?.includes('tự do') || c.studioName?.includes('vãng lai'))) {
        updated = true;
        return {
          ...c,
          name: 'Tổng hợp Freelance Doanh số ít',
          studioName: 'Freelance vãng lai (Doanh số ít)',
          customerType: 'Freelance' as const,
          notes: 'Tệp khách Freelance vãng lai ghé tiệm in 1-2 lần (có thể ghi tên riêng từng người khi lên đơn)'
        };
      }
      if (c.name.toLowerCase() === 'khách lẻ' && (c.studioName?.includes('vãng lai') || !c.studioName)) {
        updated = true;
        return {
          ...c,
          name: 'Khách Lẻ',
          studioName: 'Khách lẻ vãng lai',
          customerType: 'Khách Lẻ' as const,
          notes: 'Tệp khách lẻ in ảnh gia đình, tiệc vãng lai ghé tiệm 1-2 lần (có thể ghi tên riêng từng người khi lên đơn)'
        };
      }
      if (!c.customerType) {
        updated = true;
        if (c.studioName?.includes('Freelance') || c.name.toLowerCase().includes('freelance') || c.name.includes('Thợ')) {
          return { ...c, customerType: 'Freelance' as const };
        }
        if (c.studioName?.includes('Khách Lẻ') || c.name.toLowerCase().includes('khách lẻ')) {
          return { ...c, customerType: 'Khách Lẻ' as const };
        }
        return { ...c, customerType: 'GIÁ STUDIO' as const };
      }
      return c;
    });

    // Ensure dedicated standard walk-in Freelance item exists
    if (!parsed.some(c => c.name.toLowerCase().includes('tổng hợp freelance') || c.id === 'cust-freelance' || c.id === 'c4')) {
      parsed.push({
        id: 'cust-freelance',
        name: 'Tổng hợp Freelance Doanh số ít',
        phone: '',
        studioName: 'Freelance vãng lai (Doanh số ít)',
        address: 'Vãng lai tại tiệm',
        initialDebt: 0,
        customerType: 'Freelance',
        notes: 'Tệp khách Freelance vãng lai ghé tiệm in 1-2 lần (có thể ghi tên riêng từng người khi lên đơn)',
        createdAt: '2026-04-12',
        initialYearlyRevenue: 0
      });
      updated = true;
    }

    // Ensure dedicated standard Khách Lẻ item exists
    if (!parsed.some(c => c.name.toLowerCase() === 'khách lẻ' || c.id === 'c5')) {
      parsed.push({
        id: 'cust-khach-le',
        name: 'Khách Lẻ',
        phone: '',
        studioName: 'Khách lẻ vãng lai',
        address: 'Vãng lai tại tiệm',
        initialDebt: 0,
        customerType: 'Khách Lẻ',
        notes: 'Tệp khách lẻ in ảnh gia đình, tiệc vãng lai ghé tiệm 1-2 lần (có thể ghi tên riêng từng người khi lên đơn)',
        createdAt: '2026-05-20',
        initialYearlyRevenue: 0
      });
      updated = true;
    }

    if (updated) {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(parsed));
    }
    return parsed;
  } catch (e) {
    console.error('Error loading customers from localStorage', e);
    return DEFAULT_CUSTOMERS;
  }
}

export function saveStoredCustomers(customers: Customer[]): void {
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
}

export function getStoredOrders(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(DEFAULT_ORDERS));
      return DEFAULT_ORDERS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading orders from localStorage', e);
    return DEFAULT_ORDERS;
  }
}

export function saveStoredOrders(orders: Order[]): void {
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
}

export function getStoredWorkshopInfo(): WorkshopInfo {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WORKSHOP);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.WORKSHOP, JSON.stringify(DEFAULT_WORKSHOP_INFO));
      return DEFAULT_WORKSHOP_INFO;
    }
    const parsed: WorkshopInfo = JSON.parse(raw);
    if (parsed.name === 'XƯỞNG IN 194' || parsed.name === 'Xưởng In 194') {
      parsed.name = DEFAULT_WORKSHOP_INFO.name;
      parsed.subtitle = DEFAULT_WORKSHOP_INFO.subtitle;
      parsed.bankAccount.accountHolder = DEFAULT_WORKSHOP_INFO.bankAccount.accountHolder;
      localStorage.setItem(STORAGE_KEYS.WORKSHOP, JSON.stringify(parsed));
    }
    return parsed;
  } catch (e) {
    console.error('Error loading workshop info', e);
    return DEFAULT_WORKSHOP_INFO;
  }
}

export function saveStoredWorkshopInfo(info: WorkshopInfo): void {
  localStorage.setItem(STORAGE_KEYS.WORKSHOP, JSON.stringify(info));
}

/**
 * Chuẩn hóa trạng thái nợ của các đơn hàng thuộc 2 tệp khách vãng lai:
 * 'Tổng hợp Freelance Doanh số ít' và 'Khách lẻ'.
 * 
 * 1. Toàn bộ các đơn hàng cũ trước đó ĐÃ ĐƯỢC THANH TOÁN XONG qua các phiếu thu nợ (PT-194).
 *    Bao gồm các đơn của anh Hà 425k, Frelance 113.5k, anh Công Huyên 38.5k, chị Phượng 70k, Quý Khách 40k, v.v.
 *    => Đều được đánh dấu 'Đã thu' (hoàn tất, totalDue = 0, paid = subtotal - discount).
 * 2. Nợ tồn thực tế hiện tại chỉ là:
 *    - 'Tổng hợp Freelance Doanh số ít': Chỉ còn nợ đúng 132.000 ₫ của đơn 194-2026-070 (Minh Hoàng).
 *    - 'Khách lẻ': Chỉ còn nợ đúng 1.080.000 ₫ của đơn mới nhất (194-2026-067 Hà Lê).
 * 3. Tuyệt đối KHÔNG hiển thị số nợ cũ hoặc nút 'Đã thu tiền' ở những đơn đã được đối trừ thanh toán đó nữa.
 */
export function sanitizeWalkInOrders(orders: Order[], customer: Customer): Order[] {
  if (!isWalkInPoolCustomer(customer)) {
    return orders;
  }

  const isFl = isFreelanceWalkInPool(customer);

  const extractOrderSeq = (ordNum?: string): number => {
    if (!ordNum) return 0;
    const match = ordNum.match(/194-\d{4}-(\d+)/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return 0;
  };

  return orders.map(ord => {
    // 1. Phiếu thu nợ PT-194 luôn là đã xong (totalDue = 0)
    if (ord.orderNumber.startsWith('PT-')) {
      return {
        ...ord,
        totalDue: 0,
        status: 'completed' as OrderStatus
      };
    }

    const seq = extractOrderSeq(ord.orderNumber);
    const ordName = (ord.customerName || '').toLowerCase();
    const guestName = (ord.guestName || '').toLowerCase();

    if (isFl) {
      // Tệp: 'Tổng hợp Freelance Doanh số ít'
      const isTargetOrder070 = ord.orderNumber.includes('070') || ordName.includes('minh hoàng') || guestName.includes('minh hoàng');
      
      if (isTargetOrder070) {
        // Đơn 194-2026-070 (Minh Hoàng): nợ thực tế đúng 132.000 ₫ (nếu chưa thu)
        const currentDue = ord.totalDue === 0 ? 0 : 132000;
        const invoiced = ord.subtotal - (ord.discount || 0);
        return {
          ...ord,
          totalDue: currentDue,
          paid: currentDue === 0 ? invoiced : (ord.paid || Math.max(0, invoiced - currentDue)),
          status: (currentDue === 0 ? 'completed' : ord.status) as OrderStatus
        };
      }

      // Đơn mới phát sinh sau đơn 070 (nếu có sau này)
      if (seq > 70) {
        return ord;
      }

      // TOÀN BỘ các đơn cũ trước đó (bao gồm anh Hà 425k, Frelance 113.5k, anh Công Huyên 38.5k...)
      // ĐÃ ĐƯỢC THANH TOÁN XONG qua các phiếu thu nợ (PT-194)
      const invoiced = ord.subtotal - (ord.discount || 0);
      return {
        ...ord,
        paid: invoiced > 0 ? invoiced : (ord.paid || 0),
        totalDue: 0,
        status: 'completed' as OrderStatus
      };
    } else {
      // Tệp: 'Khách lẻ'
      const isTargetOrder067 = ord.orderNumber.includes('067') || ordName.includes('hà lê') || guestName.includes('hà lê');

      if (isTargetOrder067) {
        // Đơn 194-2026-067 (Hà Lê): nợ thực tế đúng 1.080.000 ₫ (nếu chưa thu)
        const currentDue = ord.totalDue === 0 ? 0 : 1080000;
        const invoiced = ord.subtotal - (ord.discount || 0);
        return {
          ...ord,
          totalDue: currentDue,
          paid: currentDue === 0 ? invoiced : (ord.paid || Math.max(0, invoiced - currentDue)),
          status: (currentDue === 0 ? 'completed' : ord.status) as OrderStatus
        };
      }

      // Đơn mới phát sinh sau đơn 067 (nếu có sau này)
      if (seq > 67) {
        return ord;
      }

      // TOÀN BỘ các đơn cũ trước đó (bao gồm chị Phượng 70k, Quý Khách 40k...)
      // ĐÃ ĐƯỢC THANH TOÁN XONG qua các phiếu thu nợ (PT-194)
      const invoiced = ord.subtotal - (ord.discount || 0);
      return {
        ...ord,
        paid: invoiced > 0 ? invoiced : (ord.paid || 0),
        totalDue: 0,
        status: 'completed' as OrderStatus
      };
    }
  });
}

// Calculate the latest unpaid debt for a customer based on historical orders
export function calculateCustomerDebt(customerId: string, allOrders: Order[], allCustomers: Customer[]): number {
  const customer = allCustomers.find(c => c.id === customerId);
  if (!customer) return 0;

  const isFlWalkIn = isFreelanceWalkInPool(customer);
  const isKlWalkIn = isRetailWalkInPool(customer);

  // Find all orders for this customer (including walk-in matching)
  const customerOrders = allOrders
    .filter(o => {
      if (o.status === 'cancelled') return false;
      if (o.customerId === customerId) return true;
      if (isKlWalkIn && (
        o.customerName?.toLowerCase().startsWith('khách lẻ') ||
        o.customerName?.toLowerCase().startsWith('khach le')
      )) return true;
      if (isFlWalkIn && (
        o.customerName?.toLowerCase().startsWith('freelance') ||
        o.customerName?.toLowerCase().startsWith('frelance') ||
        o.customerName?.toLowerCase().startsWith('tổng hợp freelance')
      )) return true;
      return false;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || (b.createdAt || '').localeCompare(a.createdAt || ''));

  if (customerOrders.length > 0) {
    // Với 2 tệp vãng lai ("Khách Lẻ" và "Tổng hợp Freelance Doanh số ít"):
    // Nợ tồn thực tế hiện tại:
    // - Freelance: 132.000 ₫ (đơn 070 Minh Hoàng)
    // - Khách lẻ: 1.080.000 ₫ (đơn 067 Hà Lê)
    if (isWalkInPoolCustomer(customer)) {
      const sanitized = sanitizeWalkInOrders(customerOrders, customer);
      const walkInDebt = sanitized.reduce((sum, o) => sum + (o.totalDue || 0), 0);
      return Math.max(0, (customer.initialDebt || 0) + walkInDebt);
    }

    // The most recent order's totalDue represents their current remaining debt
    return Math.max(0, customerOrders[0].totalDue);
  }

  return customer.initialDebt || 0;
}

export function getStoredCombos(): StudioCombo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COMBOS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.COMBOS, JSON.stringify(DEFAULT_COMBOS));
      return DEFAULT_COMBOS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_COMBOS;
  } catch (e) {
    console.error('Error loading combos from localStorage', e);
    return DEFAULT_COMBOS;
  }
}

export function saveStoredCombos(combos: StudioCombo[]): void {
  localStorage.setItem(STORAGE_KEYS.COMBOS, JSON.stringify(combos));
}

export function resetAllData(): void {
  const cleanProducts = DEFAULT_PRODUCTS.filter(p => !isBannedProduct(p));
  const cleanMaterials = DEFAULT_MATERIALS.filter(m => !isBannedMaterial(m));
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(cleanProducts));
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(DEFAULT_CUSTOMERS));
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(DEFAULT_ORDERS));
  localStorage.setItem(STORAGE_KEYS.WORKSHOP, JSON.stringify(DEFAULT_WORKSHOP_INFO));
  localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(cleanMaterials));
  localStorage.setItem(STORAGE_KEYS.STOCK_IMPORTS, JSON.stringify(DEFAULT_STOCK_IMPORTS));
  localStorage.setItem(STORAGE_KEYS.COMBOS, JSON.stringify(DEFAULT_COMBOS));
}

// Xóa toàn bộ đơn hàng và đặt lại công nợ về 0 (để tiệm bắt đầu bán hàng thực tế)
export function clearAllOrdersAndDebts(): void {
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
  const customers = getStoredCustomers().map(c => ({
    ...c,
    initialDebt: 0
  }));
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
}

// Xóa sạch toàn bộ phần mềm (đơn hàng = 0, khách hàng = 0)
export function wipeAllDataClean(): void {
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify([]));
}

// Xóa sạch toàn bộ vật tư kho và toàn bộ lịch sử phiếu nhập hàng (về 0)
export function clearAllInventoryData(): void {
  localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.STOCK_IMPORTS, JSON.stringify([]));
}

// Xóa sạch toàn bộ lịch sử phiếu nhập kho (đưa chi phí nhập về 0, giữ lại danh mục vật tư)
export function clearAllStockImportsOnly(): void {
  localStorage.setItem(STORAGE_KEYS.STOCK_IMPORTS, JSON.stringify([]));
}

// Đặt lại số lượng tồn kho của toàn bộ vật tư về 0 và xóa lịch sử nhập
export function resetInventoryStockToZero(): void {
  const materials = getStoredMaterials().map(m => ({
    ...m,
    stockQuantity: 0
  }));
  localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials));
  localStorage.setItem(STORAGE_KEYS.STOCK_IMPORTS, JSON.stringify([]));
}

// Nạp lại danh mục vật tư kho mẫu ban đầu của tiệm
export function reloadDefaultMaterials(): void {
  const cleanMaterials = DEFAULT_MATERIALS.filter(m => !isBannedMaterial(m));
  localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(cleanMaterials));
  localStorage.setItem(STORAGE_KEYS.STOCK_IMPORTS, JSON.stringify(DEFAULT_STOCK_IMPORTS));
}

// Nạp lại toàn bộ dữ liệu mẫu (sản phẩm, khách hàng, 9 đơn hàng mẫu và thống kê)
export function loadDemoData(): void {
  resetAllData();
}

export function generateInitialDataTsCode(): string {
  const workshop = getStoredWorkshopInfo();
  const products = getStoredProducts();
  const customers = getStoredCustomers();
  const orders = getStoredOrders();
  const materials = getStoredMaterials();
  const stockImports = getStoredStockImports();
  const combos = getStoredCombos();

  return `import { Product, Customer, Order, WorkshopInfo, Material, StockImportReceipt, StudioCombo } from '../types';

export const DEFAULT_WORKSHOP_INFO: WorkshopInfo = ${JSON.stringify(workshop, null, 2)};

export const DEFAULT_PRODUCTS: Product[] = ${JSON.stringify(products, null, 2)};

export const DEFAULT_CUSTOMERS: Customer[] = ${JSON.stringify(customers, null, 2)};

export const DEFAULT_ORDERS: Order[] = ${JSON.stringify(orders, null, 2)};

export const DEFAULT_MATERIALS: Material[] = ${JSON.stringify(materials, null, 2)};

export const DEFAULT_STOCK_IMPORTS: StockImportReceipt[] = ${JSON.stringify(stockImports, null, 2)};

export const DEFAULT_COMBOS: StudioCombo[] = ${JSON.stringify(combos, null, 2)};
`;
}

export function downloadInitialDataTs(): void {
  const tsContent = generateInitialDataTsCode();
  const blob = new Blob([tsContent], { type: 'text/typescript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'initialData.ts';
  a.click();
  URL.revokeObjectURL(url);
}

export function exportBackupJSON(): string {
  const data = {
    version: '1.2',
    exportedAt: new Date().toISOString(),
    workshop: getStoredWorkshopInfo(),
    products: getStoredProducts(),
    customers: getStoredCustomers(),
    orders: getStoredOrders(),
    materials: getStoredMaterials(),
    stockImports: getStoredStockImports(),
    combos: getStoredCombos()
  };
  return JSON.stringify(data, null, 2);
}

export function downloadBackupJSON(): void {
  const jsonStr = exportBackupJSON();
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tiemin194_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importBackupJSON(jsonStr: string): boolean {
  try {
    const data = JSON.parse(jsonStr);
    if (data.products && Array.isArray(data.products)) {
      saveStoredProducts(data.products);
    }
    if (data.customers && Array.isArray(data.customers)) {
      saveStoredCustomers(data.customers);
    }
    if (data.orders && Array.isArray(data.orders)) {
      saveStoredOrders(data.orders);
    }
    if (data.materials && Array.isArray(data.materials)) {
      saveStoredMaterials(data.materials);
    }
    if (data.stockImports && Array.isArray(data.stockImports)) {
      saveStoredStockImports(data.stockImports);
    }
    if (data.combos && Array.isArray(data.combos)) {
      saveStoredCombos(data.combos);
    }
    if (data.workshop) {
      saveStoredWorkshopInfo(data.workshop);
    }
    return true;
  } catch (e) {
    console.error('Invalid backup format', e);
    return false;
  }
}
