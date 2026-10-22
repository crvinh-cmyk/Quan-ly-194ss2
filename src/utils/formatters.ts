import { Order } from '../types';
export { getDisplayPrice, getRevenueMultiplier, isPartnerMode } from './partnerConfig';

export function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatNumber(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '0';
  return new Intl.NumberFormat('vi-VN').format(amount);
}

export function parseNumber(val: string | number): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  // remove non-numeric chars except minus
  const cleaned = val.toString().replace(/[^\d-]/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatDateVN(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const VIETNAMESE_DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

/**
 * Đọc cụm 3 chữ số (trăm, chục, đơn vị) chuẩn ngữ pháp tiếng Việt:
 * - Khi readZeroHundreds = true (đã có cụm lớn hơn ở trước), nếu h = 0 bắt buộc phải đọc "không trăm".
 * - Khi t = 0 và u > 0, đọc "lẻ" (ví dụ: không trăm lẻ năm, lẻ một).
 * - Sau mươi (t >= 2): u = 1 đọc là "mốt", u = 4 đọc là "bốn", u = 5 đọc là "lăm".
 * - Sau mười (t = 1): u = 1 đọc là "một", u = 5 đọc là "lăm".
 */
function readThreeDigits(h: number, t: number, u: number, readZeroHundreds: boolean): string {
  let result = '';

  // 1. Hàng trăm
  if (h > 0) {
    result += VIETNAMESE_DIGITS[h] + ' trăm';
  } else if (readZeroHundreds) {
    result += 'không trăm';
  }

  // 2. Cả hàng chục và hàng đơn vị đều bằng 0
  if (t === 0 && u === 0) {
    return result;
  }

  // 3. Hàng chục = 0 và hàng đơn vị > 0 (Đọc "lẻ ...")
  if (t === 0 && u > 0) {
    if (result.length > 0) {
      result += ' lẻ ' + VIETNAMESE_DIGITS[u];
    } else {
      result += VIETNAMESE_DIGITS[u];
    }
    return result;
  }

  // 4. Hàng chục = 1 ("mười ...")
  if (t === 1) {
    if (result.length > 0) result += ' ';
    result += 'mười';
    if (u === 1) {
      result += ' một';
    } else if (u === 5) {
      result += ' lăm';
    } else if (u > 0) {
      result += ' ' + VIETNAMESE_DIGITS[u];
    }
    return result;
  }

  // 5. Hàng chục >= 2 ("hai mươi", "ba mươi"...)
  if (t >= 2) {
    if (result.length > 0) result += ' ';
    result += VIETNAMESE_DIGITS[t] + ' mươi';
    if (u === 1) {
      result += ' mốt';
    } else if (u === 4) {
      result += ' bốn';
    } else if (u === 5) {
      result += ' lăm';
    } else if (u > 0) {
      result += ' ' + VIETNAMESE_DIGITS[u];
    }
    return result;
  }

  return result;
}

/**
 * Đọc số tiền tệ tiếng Việt chuẩn xác (dành cho hóa đơn và in ấn):
 * Ví dụ:
 * 3.028.000 -> "Ba triệu không trăm hai mươi tám nghìn đồng chẵn."
 * 3.005.000 -> "Ba triệu không trăm lẻ năm nghìn đồng chẵn."
 * 3.000.000 -> "Ba triệu đồng chẵn."
 * 105.000   -> "Một trăm lẻ năm nghìn đồng chẵn."
 * 28.000    -> "Hai mươi tám nghìn đồng chẵn."
 */
export function numberToVietnameseWords(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Không đồng';
  const num = Math.round(Number(amount));
  if (num === 0) return 'Không đồng';
  if (num < 0) return 'Âm ' + numberToVietnameseWords(Math.abs(num)).toLowerCase();

  const scales = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  let numStr = num.toString();
  const groups: number[] = [];

  while (numStr.length > 0) {
    const chunk = numStr.slice(-3);
    groups.push(parseInt(chunk, 10));
    numStr = numStr.slice(0, -3);
  }

  let words = '';
  let hasHigherGroup = false;

  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    if (group > 0) {
      const h = Math.floor(group / 100);
      const t = Math.floor((group % 100) / 10);
      const u = group % 10;
      const readZeroHundreds = hasHigherGroup;
      const groupWords = readThreeDigits(h, t, u, readZeroHundreds);
      words += ' ' + groupWords + (scales[i] ? ' ' + scales[i] : '');
      hasHigherGroup = true;
    }
  }

  words = words.trim().replace(/\s+/g, ' ');
  if (!words) return 'Không đồng';

  // Viết hoa chữ cái đầu và thêm đuôi "đồng chẵn."
  const formatted = words.charAt(0).toUpperCase() + words.slice(1).toLowerCase() + ' đồng chẵn.';
  return formatted;
}

// Aliases để tương thích với bất kỳ file nào gọi readMoney hoặc numberToWords
export const readMoney = numberToVietnameseWords;
export const numberToWords = numberToVietnameseWords;

/**
 * Nhận diện duy nhất tệp khách Freelance vãng lai (không tạo khách mới):
 * Theo quy định của tiệm: "Tổng hợp Freelance Doanh số ít" là tệp vãng lai DUY NHẤT trong số các khách Freelance.
 * Mọi khách Studio hoặc khách Freelance có tên riêng/studio riêng TUYỆT ĐỐI KHÔNG phải là tệp vãng lai.
 */
export function isFreelanceWalkInPool(cust?: { id?: string; name?: string; studioName?: string; customerType?: string } | null): boolean {
  if (!cust) return false;
  // 1. TUYỆT ĐỐI không áp dụng cho khách Studio
  if (cust.customerType === 'GIÁ STUDIO') return false;
  // 2. Chỉ xét khách có phân loại Freelance
  if (cust.customerType !== 'Freelance') return false;

  const name = (cust.name || '').toLowerCase().trim();
  const studio = (cust.studioName || '').toLowerCase().trim();

  // Khách có tên hoặc studio riêng (như Son Studio, OH Studio, Studio Áo Cưới...) tuyệt đối không phải vãng lai
  if (name.includes('studio') || studio.includes('studio')) {
    return false;
  }

  // CHỈ DUY NHẤT khách có tên chứa "tổng hợp freelance" hoặc "doanh số ít"
  if (name.includes('tổng hợp freelance') || name.includes('doanh số ít') || studio.includes('doanh số ít')) {
    return true;
  }
  if ((name === 'freelance' || name === 'frelance') && (studio.includes('vãng lai') || studio.includes('tự do'))) {
    return true;
  }
  return false;
}

/**
 * Nhận diện tệp Khách Lẻ vãng lai (in ảnh gia đình, tiệc ghé 1-2 lần)
 */
export function isRetailWalkInPool(cust?: { id?: string; name?: string; studioName?: string; customerType?: string } | null): boolean {
  if (!cust) return false;
  // 1. TUYỆT ĐỐI không áp dụng cho khách Studio
  if (cust.customerType === 'GIÁ STUDIO') return false;
  // 2. Chỉ xét khách có phân loại Khách Lẻ
  if (cust.customerType !== 'Khách Lẻ') return false;

  const name = (cust.name || '').toLowerCase().trim();
  const studio = (cust.studioName || '').toLowerCase().trim();

  if (name.includes('studio') || studio.includes('studio')) {
    return false;
  }

  if (name === 'khách lẻ' || name === 'khach le' || name.startsWith('khách lẻ vãng lai')) {
    return true;
  }
  return false;
}

/**
 * Kiểm tra xem khách hàng có phải là 1 trong 2 Tệp Vãng Lai gom chung không
 */
export function isWalkInPoolCustomer(cust?: { id?: string; name?: string; studioName?: string; customerType?: string } | null): boolean {
  if (!cust) return false;
  if (cust.customerType === 'GIÁ STUDIO') return false;
  return isFreelanceWalkInPool(cust) || isRetailWalkInPool(cust);
}

/**
 * Lấy tên hiển thị trang trọng cho khách hàng khi chụp ảnh hóa đơn / xuất hóa đơn gửi khách.
 * Ẩn bỏ hoàn toàn 2 từ "Khách Lẻ" và "Freelance" (hoặc Frelance) theo yêu cầu của tiệm.
 * Nếu có tên khách lẻ / freelance riêng (guestName hoặc được viết sau dấu gạch), chỉ hiện tên riêng đó (VD: 'Anh Tuấn', 'Chị Mai').
 * Nếu không có tên riêng, hiển thị 'Quý Khách' thay vì hiện 'Khách Lẻ' hoặc 'Freelance'.
 */
export function getCustomerFacingName(order?: { customerName?: string; guestName?: string } | null): string {
  if (!order) return 'Quý Khách';

  // 1. Ưu tiên guestName nếu có
  if (order.guestName && order.guestName.trim()) {
    let clean = order.guestName.trim();
    clean = clean
      .replace(/^(?:tổng\s*hợp\s*freelance\s*doanh\s*số\s*ít|tổng\s*hợp\s*freelance|khách\s*lẻ|khach\s*le|freelance|frelance|thợ\s*freelance|vãng\s*lai)\s*[-:–—\s(]*/gi, '')
      .replace(/\s*[-:–—\s)]*(?:tổng\s*hợp\s*freelance\s*doanh\s*số\s*ít|tổng\s*hợp\s*freelance|khách\s*lẻ|khach\s*le|freelance|frelance|thợ\s*freelance|vãng\s*lai)\s*$/gi, '')
      .replace(/[()]/g, '')
      .trim();
    if (clean && !/^(?:tổng\s*hợp\s*freelance\s*doanh\s*số\s*ít|tổng\s*hợp\s*freelance|khách\s*lẻ|khach\s*le|freelance|frelance|thợ\s*freelance|vãng\s*lai)$/i.test(clean)) {
      return clean;
    }
  }

  // 2. Nếu không có guestName hoặc guestName rỗng, xử lý từ customerName
  let rawName = (order.customerName || '').trim();
  if (!rawName) return 'Quý Khách';

  // Nếu là tên tệp vãng lai thuần túy không có tên riêng đính kèm
  if (/^(?:tổng\s*hợp\s*freelance\s*doanh\s*số\s*ít|tổng\s*hợp\s*freelance|khách\s*lẻ|khach\s*le|freelance|frelance)$/i.test(rawName)) {
    return 'Quý Khách';
  }

  // Bóc tách nếu tên lưu dạng "Tổng hợp Freelance Doanh số ít - Anh Tuấn" hoặc "Freelance - Anh Tuấn" hoặc "Khách Lẻ - Anh Tuấn"
  const prefixMatch = rawName.match(/^(?:tổng\s*hợp\s*freelance\s*doanh\s*số\s*ít|tổng\s*hợp\s*freelance|khách\s*lẻ|khach\s*le|freelance|frelance|thợ\s*freelance|khách\s*vãng\s*lai)\s*[-:–—\s(]+([^)]+)\)?$/i);
  if (prefixMatch && prefixMatch[1] && prefixMatch[1].trim()) {
    const extracted = prefixMatch[1].trim();
    if (!/^(?:tổng\s*hợp\s*freelance|khách\s*lẻ|khach\s*le|freelance|frelance|thợ\s*freelance|khách\s*vãng\s*lai)$/i.test(extracted)) {
      return extracted;
    }
  }

  // Bóc tách nếu tên có dạng "Tên (Freelance...)" hoặc "Tên (Khách Lẻ...)" ví dụ: "Anh Duy (Freelance)" -> "Anh Duy"
  const suffixInParens = rawName.match(/^([^(]+)\s*\((?:tổng\s*hợp\s*freelance|khách\s*lẻ|khach\s*le|freelance|frelance)[^)]*\)$/i);
  if (suffixInParens && suffixInParens[1] && suffixInParens[1].trim()) {
    const extracted = suffixInParens[1].trim();
    if (!/^(?:tổng\s*hợp\s*freelance|khách\s*lẻ|khach\s*le|freelance|frelance)$/i.test(extracted)) {
      return extracted;
    }
  }

  // Lọc sạch các từ khóa "tổng hợp freelance", "khách lẻ", "freelance" khỏi tên khách hàng
  let cleanName = rawName
    .replace(/\s*\((?:tổng\s*hợp\s*freelance|khách\s*lẻ|khach\s*le|freelance|frelance)[^)]*\)/gi, '')
    .replace(/^(?:tổng\s*hợp\s*freelance\s*doanh\s*số\s*ít|tổng\s*hợp\s*freelance|khách\s*lẻ|khach\s*le|freelance|frelance)\s*[-:–—\s(]*/gi, '')
    .replace(/\s*[-:–—\s)]*(?:tổng\s*hợp\s*freelance\s*doanh\s*số\s*ít|tổng\s*hợp\s*freelance|khách\s*lẻ|khach\s*le|freelance|frelance)\s*$/gi, '')
    .replace(/[()]/g, '')
    .trim();

  // Nếu chuỗi còn lại rỗng hoặc chỉ còn từ cấm
  if (!cleanName || /^(?:tổng\s*hợp\s*freelance\s*doanh\s*số\s*ít|tổng\s*hợp\s*freelance|khách\s*lẻ|khach\s*le|freelance|frelance)$/i.test(cleanName)) {
    return 'Quý Khách';
  }

  return cleanName;
}

/**
 * Chuẩn hóa số điện thoại: chỉ giữ lại chữ số
 */
export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Chuẩn hóa tên khách hàng phục vụ so sánh (bỏ dấu cách thừa, viết thường)
 */
export function normalizeCustomerName(name?: string | null): string {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Kiểm tra xem một chuỗi tên có phải là tên chung/tên tệp vãng lai hay không (không phải định danh riêng của một cá nhân cụ thể)
 */
export function isGenericPoolName(name?: string | null): boolean {
  if (!name) return true;
  const norm = normalizeCustomerName(name);
  if (!norm) return true;
  return (
    norm === 'khách lẻ' ||
    norm === 'khach le' ||
    norm === 'khách lẻ vãng lai' ||
    norm === 'khach le vang lai' ||
    norm === 'khách vãng lai' ||
    norm === 'khach vang lai' ||
    norm === 'quý khách' ||
    norm === 'quy khach' ||
    norm === 'tổng hợp freelance doanh số ít' ||
    norm === 'tổng hợp freelance' ||
    norm === 'tong hop freelance' ||
    norm === 'freelance' ||
    norm === 'frelance' ||
    norm === 'thợ freelance' ||
    norm === 'tho freelance'
  );
}

export interface WalkInDebtLookupResult {
  previousDebt: number;
  lookupMethod: 'phone' | 'name' | 'none';
  matchedOrderNumber?: string;
  matchedCustomerName?: string;
  matchedDate?: string;
}

/**
 * Tra cứu nợ cũ cho khách hàng thuộc tệp vãng lai ('Khách lẻ' hoặc 'Tổng hợp Freelance Doanh số ít'):
 * 1. TUYỆT ĐỐI KHÔNG dùng ID chung của nhóm này để truy vấn nợ cũ.
 * 2. Tra cứu nợ cũ theo Định danh riêng:
 *    - Nếu có nhập Số điện thoại (>= 8 chữ số): Tra cứu nợ cũ theo Số điện thoại.
 *    - Nếu KHÔNG có Số điện thoại: Tra cứu nợ cũ theo chính Tên khách hàng gõ tay.
 * 3. Nếu cả Tên và SĐT này chưa từng có đơn nợ nào trước đó, nợ cũ tự động bằng 0 ₫, tuyệt đối không cộng dồn nợ của các khách lẻ khác trước đó vào.
 */
export function findWalkInCustomerPreviousDebt(
  phone: string | undefined | null,
  rawName: string | undefined | null,
  allOrders: Order[],
  excludeOrderId?: string | null
): WalkInDebtLookupResult {
  const cleanPhone = normalizePhoneNumber(phone);
  const cleanTargetName = normalizeCustomerName(rawName);

  // 1. NẾU CÓ NHẬP SỐ ĐIỆN THOẠI: Tra cứu nợ cũ theo Số điện thoại (chỉ xét khi có từ 8 số trở lên)
  if (cleanPhone && cleanPhone.length >= 8) {
    const ordersWithMatchingPhone = allOrders
      .filter(o => {
        if (excludeOrderId && o.id === excludeOrderId) return false;
        if (o.status === 'cancelled') return false;
        const oPhone = normalizePhoneNumber(o.customerPhone);
        return oPhone && oPhone === cleanPhone;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || (b.createdAt || '').localeCompare(a.createdAt || ''));

    if (ordersWithMatchingPhone.length > 0) {
      const latestOrder = ordersWithMatchingPhone[0];
      return {
        previousDebt: Math.max(0, latestOrder.totalDue || 0),
        lookupMethod: 'phone',
        matchedOrderNumber: latestOrder.orderNumber,
        matchedCustomerName: latestOrder.customerName,
        matchedDate: latestOrder.date
      };
    }

    // Có SĐT nhưng số này chưa từng có đơn nợ nào trước đó -> nợ cũ tự động bằng 0 ₫
    return {
      previousDebt: 0,
      lookupMethod: 'phone'
    };
  }

  // 2. NẾU KHÔNG CÓ SỐ ĐIỆN THOẠI: Tra cứu nợ cũ theo chính Tên khách hàng gõ tay
  if (cleanTargetName && !isGenericPoolName(cleanTargetName)) {
    const ordersWithMatchingName = allOrders
      .filter(o => {
        if (excludeOrderId && o.id === excludeOrderId) return false;
        if (o.status === 'cancelled') return false;

        // So sánh với guestName (tên riêng gõ tay của đơn trước)
        if (o.guestName && normalizeCustomerName(o.guestName) === cleanTargetName) {
          return true;
        }

        // So sánh với tên hiển thị khách hàng (đã bóc tách tiền tố Khách lẻ / Freelance)
        const facingName = normalizeCustomerName(getCustomerFacingName(o));
        if (facingName && facingName === cleanTargetName && !isGenericPoolName(facingName)) {
          return true;
        }

        // So sánh với customerName
        if (o.customerName) {
          const normCustName = normalizeCustomerName(o.customerName);
          if (normCustName === cleanTargetName) return true;

          if (
            normCustName.startsWith('khách lẻ - ') &&
            normCustName.replace('khách lẻ - ', '').trim() === cleanTargetName
          ) {
            return true;
          }
          if (
            normCustName.startsWith('freelance - ') &&
            normCustName.replace('freelance - ', '').trim() === cleanTargetName
          ) {
            return true;
          }
        }

        return false;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || (b.createdAt || '').localeCompare(a.createdAt || ''));

    if (ordersWithMatchingName.length > 0) {
      const latestOrder = ordersWithMatchingName[0];
      return {
        previousDebt: Math.max(0, latestOrder.totalDue || 0),
        lookupMethod: 'name',
        matchedOrderNumber: latestOrder.orderNumber,
        matchedCustomerName: latestOrder.customerName,
        matchedDate: latestOrder.date
      };
    }

    // Tên gõ tay này chưa từng có đơn nào trước đó -> nợ cũ tự động bằng 0 ₫
    return {
      previousDebt: 0,
      lookupMethod: 'name'
    };
  }

  // 3. Nếu chưa nhập cả SĐT lẫn Tên riêng (hoặc chỉ để 'Khách Lẻ' / 'Tổng hợp Freelance Doanh số ít' chung chung):
  // Nợ cũ tự động bằng 0 ₫, tuyệt đối không cộng dồn nợ của các khách lẻ khác trước đó vào.
  return {
    previousDebt: 0,
    lookupMethod: 'none'
  };
}

