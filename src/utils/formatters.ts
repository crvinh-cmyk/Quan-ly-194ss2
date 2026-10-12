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
