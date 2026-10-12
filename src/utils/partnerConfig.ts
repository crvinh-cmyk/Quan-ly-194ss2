/**
 * Cấu hình chế độ Dành Cho Đối Tác / Cộng Tác Viên (Partner / Collaborator View)
 * 
 * 1. BẢO VỆ DỰ ÁN VÀ LINK GỐC:
 *    - Tuyệt đối KHÔNG làm thay đổi, ảnh hưởng hay làm biến mất bất kỳ tính năng,
 *      giao diện hay dữ liệu nào của ứng dụng gốc "quan-ly-194".
 *    - Khi không có biến môi trường VITE_IS_PARTNER_VIEW='true' (hoặc NEXT_PUBLIC_IS_PARTNER_VIEW),
 *      ứng dụng hoạt động 100% nguyên vẹn ban đầu với hệ số nhân doanh thu 1.0.
 * 
 * 2. TÙY BIẾN GIAO DIỆN BẢN RÚT GỌN (SECONDARY DEPLOYMENT / PARTNER VIEW):
 *    - Ẩn hoàn toàn: Tab "Đơn Hàng", Tab "Khách & Sổ Nợ" (Khách hàng & Công nợ), Quản lý dữ liệu đám mây.
 *    - Chỉ giữ lại các tab phục vụ bán hàng/báo giá cơ bản: "Bán Hàng", "Kho Vật Tư", "Thống Kê & Lời Lãi", "Bảng Giá Mã SP".
 * 
 * 3. TỰ ĐỘNG GIẢM 20% DOANH THU & GIÁ BÁN:
 *    - Hệ số nhân doanh thu: VITE_REVENUE_MULTIPLIER (mặc định 0.8 khi ở bản đối tác = trừ 20% tự động, hoặc 1.0 ở trang gốc).
 *    - Hàm helper `getDisplayPrice(amount)` tự động nhân hệ số MULTIPLIER vào tất cả các vị trí hiển thị:
 *      bảng giá sản phẩm, báo giá khách hàng, tổng doanh thu năm, báo cáo thống kê.
 * 
 * 4. ĐỒNG BỘ DỮ LIỆU TỰ ĐỘNG:
 *    - Tận dụng kết nối Firestore thời gian thực của hệ thống chính.
 *    - Dữ liệu phát sinh từ hệ thống chính tự động hiển thị trên bản đối tác sau khi đã nhân hệ số chiết khấu.
 */

// 1. Kiểm tra xem ứng dụng có đang chạy ở chế độ đối tác / cộng tác viên không
export function isPartnerMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // TRONG MÔI TRƯỜNG PHÁT TRIỂN / XEM TRƯỚC (PREVIEW) CỦA AI STUDIO:
  // Luôn luôn trả về false (bất kể tham số URL hay biến môi trường nào),
  // đảm bảo màn hình preview luôn luôn hiển thị bản chính gốc 100% và KHÔNG BAO GIỜ hiện tab "Theo dõi doanh thu mẫu s1a".
  const hostname = window.location.hostname.toLowerCase();
  if (
    hostname.includes('run.app') ||
    hostname.includes('localhost') ||
    hostname.includes('127.0.0.1') ||
    hostname.includes('aistudio') ||
    hostname.includes('google') ||
    hostname.includes('webcontainer')
  ) {
    return false;
  }

  // Ở môi trường triển khai độc lập (Vercel / Netlify / Domain riêng cho bản phụ):
  // Chỉ bật khi biến môi trường VITE_IS_PARTNER_VIEW hoặc NEXT_PUBLIC_IS_PARTNER_VIEW được cấu hình là 'true'.
  let envVitePartner: any = undefined;
  let envNextPartner: any = undefined;

  try {
    envVitePartner = import.meta.env?.VITE_IS_PARTNER_VIEW;
    envNextPartner = (import.meta.env as any)?.NEXT_PUBLIC_IS_PARTNER_VIEW;
  } catch {
    // Tránh lỗi truy cập biến môi trường
  }

  try {
    if (typeof process !== 'undefined' && process?.env) {
      if (!envVitePartner) envVitePartner = process.env.VITE_IS_PARTNER_VIEW;
      if (!envNextPartner) envNextPartner = process.env.NEXT_PUBLIC_IS_PARTNER_VIEW;
    }
  } catch {
    // Tránh lỗi node process
  }

  if (
    envVitePartner === 'true' ||
    envVitePartner === true ||
    envNextPartner === 'true' ||
    envNextPartner === true
  ) {
    return true;
  }

  return false;
}

/**
 * Lấy hệ số nhân doanh thu:
 * - Nếu ở trang gốc (không phải đối tác): Trả về 1.0 (nguyên vẹn 100% giá và doanh thu).
 * - Nếu ở bản đối tác: Đọc `VITE_REVENUE_MULTIPLIER` (hoặc `NEXT_PUBLIC_REVENUE_MARKUP`), mặc định là 0.8 (giảm 20%).
 */
export function getRevenueMultiplier(): number {
  if (!isPartnerMode()) {
    return 1.0; // Dự án gốc: 100% nguyên vẹn
  }

  let envMarkup: any = undefined;
  try {
    envMarkup =
      import.meta.env?.VITE_REVENUE_MULTIPLIER ||
      import.meta.env?.VITE_REVENUE_MARKUP ||
      (import.meta.env as any)?.NEXT_PUBLIC_REVENUE_MULTIPLIER ||
      (import.meta.env as any)?.NEXT_PUBLIC_REVENUE_MARKUP;
  } catch {
    // ignore
  }

  try {
    if (!envMarkup && typeof process !== 'undefined' && process?.env) {
      envMarkup =
        process.env.VITE_REVENUE_MULTIPLIER ||
        process.env.VITE_REVENUE_MARKUP ||
        process.env.NEXT_PUBLIC_REVENUE_MULTIPLIER ||
        process.env.NEXT_PUBLIC_REVENUE_MARKUP;
    }
  } catch {
    // ignore
  }

  if (envMarkup !== undefined && envMarkup !== null && envMarkup !== '') {
    const parsed = parseFloat(String(envMarkup));
    if (!isNaN(parsed) && parsed > 0 && parsed <= 5) {
      return parsed;
    }
  }

  // Mặc định giảm 20% doanh thu (nhân với 0.8) cho bản đối tác
  return 0.8;
}

/**
 * Hàm helper tính toán giá tiền hiển thị:
 * getDisplayPrice(amount) = amount * MULTIPLIER (mặc định 0.8 ở bản đối tác, 1.0 ở bản gốc)
 */
export function getDisplayPrice(amount: number): number {
  if (!amount || amount <= 0 || isNaN(amount)) return 0;
  const mult = getRevenueMultiplier();
  return Math.round(amount * mult);
}

/**
 * Alias cho getDisplayPrice để tương thích ngược
 */
export const applyPartnerDiscount = getDisplayPrice;

/**
 * Chuyển đổi dữ liệu đơn hàng cho bản xem của đối tác:
 * - subtotal, discount, paid, totalDue được nhân với MULTIPLIER (0.8)
 * - previousDebt được đặt về 0 để bảo mật công nợ
 * - Từng item trong đơn hàng đơn giá và thành tiền cũng được nhân với MULTIPLIER (0.8)
 */
export function transformOrderForPartner(order: any): any {
  if (!isPartnerMode() || !order) {
    return order;
  }

  const mult = getRevenueMultiplier();
  return {
    ...order,
    subtotal: Math.round((order.subtotal || 0) * mult),
    discount: Math.round((order.discount || 0) * mult),
    paid: Math.round((order.paid || 0) * mult),
    totalDue: Math.round((order.totalDue || 0) * mult),
    previousDebt: 0, // Tuyệt đối không để lộ sổ nợ khách hàng cho đối tác
    items: Array.isArray(order.items)
      ? order.items.map((item: any) => ({
          ...item,
          price: Math.round((item.price || 0) * mult),
          amount: Math.round((item.amount || 0) * mult)
        }))
      : order.items
  };
}
