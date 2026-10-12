import { WorkshopInfo } from '../types';
import { formatCurrency } from './formatters';

const FONT_SANS = '"Be Vietnam Pro", "Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

export interface S1aExportRow {
  dayNumber: number;
  dateString: string;
  explanation: string;
  amount: number;
  hasRevenue: boolean;
}

export interface S1aExportData {
  businessName: string;
  businessAddress: string;
  taxCode: string;
  selectedMonth: number;
  selectedYear: number;
  currencyUnit: string;
  daysInMonth: number;
  rows: S1aExportRow[];
  monthlyTotal: number;
  workshop: WorkshopInfo;
}

/**
 * Renders the S1a Revenue Ledger directly via HTML5 Canvas 2D API at 300 DPI (2362 x 3543 px - Khổ 20x30 cm).
 * 
 * Ưu điểm vượt trội:
 * 1. KHÔNG phụ thuộc vào html2canvas hay CSS DOM clone -> Triệt tiêu 100% lỗi `unsupported color function "oklch"`
 * 2. Đạt độ nét chuẩn in ấn 300 DPI cho khổ ảnh 20x30 cm (2362 x 3543 pixels)
 * 3. Đầy đủ chữ ký, kẻ bảng, căn lề và định dạng chuẩn Thông tư số 152/2025/TT-BTC
 */
export async function generateS1aCanvas300DPI(data: S1aExportData): Promise<HTMLCanvasElement> {
  // Đảm bảo font chữ đã tải xong
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore
    }
  }

  // Khổ 20x30 cm ở 300 DPI (20cm / 2.54 * 300 = 2362px; 30cm / 2.54 * 300 = 3543px)
  const canvasWidth = 2362;
  const canvasHeight = 3543;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not supported');
  }

  // 1. Nền trắng tinh khiết
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. Canh lề chuẩn (Margins: 110px mỗi bên)
  const marginX = 110;
  const contentW = canvasWidth - marginX * 2; // 2142px
  let curY = 120;

  // 3. Header: Thông tin HKD (bên trái) & Mẫu số S1a-HKD (bên phải)
  ctx.fillStyle = '#0f172a';
  ctx.textBaseline = 'top';

  // Bên trái: Hộ kinh doanh
  ctx.textAlign = 'left';
  ctx.font = `700 32px ${FONT_SANS}`;
  ctx.fillText('Hộ, cá nhân kinh doanh: ', marginX, curY);
  const w1 = ctx.measureText('Hộ, cá nhân kinh doanh: ').width;
  ctx.font = `900 32px ${FONT_SANS}`;
  ctx.fillText(data.businessName.toUpperCase(), marginX + w1, curY);

  ctx.font = `700 28px ${FONT_SANS}`;
  ctx.fillText('Địa chỉ / Địa điểm kinh doanh: ', marginX, curY + 45);
  const w2 = ctx.measureText('Địa chỉ / Địa điểm kinh doanh: ').width;
  ctx.font = `500 28px ${FONT_SANS}`;
  ctx.fillText(data.businessAddress, marginX + w2, curY + 45);

  ctx.font = `700 28px ${FONT_SANS}`;
  ctx.fillText('Mã số thuế: ', marginX, curY + 90);
  const w3 = ctx.measureText('Mã số thuế: ').width;
  ctx.font = `500 28px ${FONT_SANS}`;
  ctx.fillText(data.taxCode || '......................................................', marginX + w3, curY + 90);

  // Bên phải: Mẫu số & Thông tư
  ctx.textAlign = 'right';
  ctx.font = `900 36px ${FONT_SANS}`;
  ctx.fillText('Mẫu số: S1a-HKD', marginX + contentW, curY);

  ctx.font = `italic 500 24px ${FONT_SANS}`;
  ctx.fillStyle = '#334155';
  ctx.fillText('(Ban hành kèm theo Thông tư số 152/2025/TT-BTC', marginX + contentW, curY + 48);
  ctx.fillText('ngày 31/12/2025 của Bộ Tài chính)', marginX + contentW, curY + 80);

  curY += 150;

  // Đường gạch mảnh phân cách header
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(marginX, curY);
  ctx.lineTo(marginX + contentW, curY);
  ctx.stroke();

  curY += 45;

  // 4. TIÊU ĐỀ CHÍNH GIỮA
  ctx.textAlign = 'center';
  ctx.fillStyle = '#020617';
  ctx.font = `900 48px ${FONT_SANS}`;
  ctx.fillText('SỔ THEO DÕI DOANH THU BÁN HÀNG HOÁ, DỊCH VỤ', marginX + contentW / 2, curY);

  const paddedM = String(data.selectedMonth).padStart(2, '0');
  ctx.font = `700 32px ${FONT_SANS}`;
  ctx.fillStyle = '#1e293b';
  ctx.fillText(`Kỳ kê khai: Tháng ${paddedM} năm ${data.selectedYear}`, marginX + contentW / 2, curY + 60);

  ctx.font = `italic 500 26px ${FONT_SANS}`;
  ctx.fillStyle = '#475569';
  ctx.fillText(`Đơn vị tính: ${data.currencyUnit}`, marginX + contentW / 2, curY + 105);

  curY += 165;

  // 5. BẢNG DỮ LIỆU S1A
  const tableX = marginX;
  const colSttW = 120;
  const colDateW = 320;
  const colAmountW = 440;
  const colDescW = contentW - colSttW - colDateW - colAmountW; // 1262px

  const xStt = tableX;
  const xDate = xStt + colSttW;
  const xDesc = xDate + colDateW;
  const xAmount = xDesc + colDescW;

  const headerH1 = 60;
  const headerH2 = 42;

  // Header 1: Tên các cột
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(tableX, curY, contentW, headerH1);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(tableX, curY, contentW, headerH1);

  ctx.fillStyle = '#0f172a';
  ctx.font = `800 26px ${FONT_SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('STT', xStt + colSttW / 2, curY + headerH1 / 2);
  ctx.fillText('Ngày, tháng ghi sổ', xDate + colDateW / 2, curY + headerH1 / 2);
  ctx.fillText('Diễn giải', xDesc + colDescW / 2, curY + headerH1 / 2);
  ctx.fillText(`Số tiền (${data.currencyUnit})`, xAmount + colAmountW / 2, curY + headerH1 / 2);

  // Kẻ vạch dọc header 1
  ctx.beginPath();
  ctx.moveTo(xDate, curY); ctx.lineTo(xDate, curY + headerH1);
  ctx.moveTo(xDesc, curY); ctx.lineTo(xDesc, curY + headerH1);
  ctx.moveTo(xAmount, curY); ctx.lineTo(xAmount, curY + headerH1);
  ctx.stroke();

  curY += headerH1;

  // Header 2: Ký hiệu A, B, 1
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(tableX, curY, contentW, headerH2);
  ctx.strokeRect(tableX, curY, contentW, headerH2);

  ctx.fillStyle = '#64748b';
  ctx.font = `italic 600 22px ${FONT_SANS}`;
  ctx.fillText('A', xDate + colDateW / 2, curY + headerH2 / 2);
  ctx.fillText('B', xDesc + colDescW / 2, curY + headerH2 / 2);
  ctx.fillText('1', xAmount + colAmountW / 2, curY + headerH2 / 2);

  ctx.beginPath();
  ctx.moveTo(xDate, curY); ctx.lineTo(xDate, curY + headerH2);
  ctx.moveTo(xDesc, curY); ctx.lineTo(xDesc, curY + headerH2);
  ctx.moveTo(xAmount, curY); ctx.lineTo(xAmount, curY + headerH2);
  ctx.stroke();

  curY += headerH2;

  // Tính chiều cao từng hàng linh hoạt theo số ngày (tối đa 31 ngày)
  // Tổng khoảng trống dành cho bảng đến trước chữ ký khoảng 1750px -> mỗi hàng ~52px
  const rowH = Math.max(48, Math.min(54, Math.floor(1750 / (data.rows.length + 1))));

  ctx.lineWidth = 1.5;

  data.rows.forEach((row, idx) => {
    const isEven = idx % 2 === 0;
    // Nền hàng
    if (row.hasRevenue) {
      ctx.fillStyle = '#fffbeb'; // Màu sáng ấm nhẹ cho ngày có đơn
    } else {
      ctx.fillStyle = isEven ? '#ffffff' : '#fcfcfd';
    }
    ctx.fillRect(tableX, curY, contentW, rowH);

    // Khung viền hàng
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(tableX, curY, contentW, rowH);

    // Kẻ vạch phân chia cột
    ctx.beginPath();
    ctx.moveTo(xDate, curY); ctx.lineTo(xDate, curY + rowH);
    ctx.moveTo(xDesc, curY); ctx.lineTo(xDesc, curY + rowH);
    ctx.moveTo(xAmount, curY); ctx.lineTo(xAmount, curY + rowH);
    ctx.stroke();

    // 1. STT
    ctx.textAlign = 'center';
    ctx.font = `500 24px ${FONT_SANS}`;
    ctx.fillStyle = '#64748b';
    ctx.fillText(String(idx + 1), xStt + colSttW / 2, curY + rowH / 2);

    // 2. Ngày tháng
    ctx.textAlign = 'center';
    ctx.font = `600 24px ${FONT_SANS}`;
    ctx.fillStyle = '#0f172a';
    ctx.fillText(row.dateString, xDate + colDateW / 2, curY + rowH / 2);

    // 3. Diễn giải
    ctx.textAlign = 'left';
    if (row.hasRevenue) {
      ctx.font = `700 24px ${FONT_SANS}`;
      ctx.fillStyle = '#0f172a';
    } else {
      ctx.font = `italic 500 23px ${FONT_SANS}`;
      ctx.fillStyle = '#64748b';
    }
    ctx.fillText(row.explanation, xDesc + 25, curY + rowH / 2);

    // 4. Số tiền
    ctx.textAlign = 'right';
    if (row.amount > 0) {
      ctx.font = `800 25px ${FONT_SANS}`;
      ctx.fillStyle = '#0f172a';
      ctx.fillText(formatCurrency(row.amount), xAmount + colAmountW - 25, curY + rowH / 2);
    } else {
      ctx.font = `500 24px ${FONT_SANS}`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('-', xAmount + colAmountW - 25, curY + rowH / 2);
    }

    curY += rowH;
  });

  // HÀNG TỔNG CỘNG
  const totalRowH = 65;
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(tableX, curY, contentW, totalRowH);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(tableX, curY, contentW, totalRowH);

  // Kẻ vạch cột tiền tổng cộng
  ctx.beginPath();
  ctx.moveTo(xAmount, curY); ctx.lineTo(xAmount, curY + totalRowH);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = `900 28px ${FONT_SANS}`;
  ctx.fillStyle = '#0f172a';
  ctx.fillText('TỔNG CỘNG', tableX + (colSttW + colDateW + colDescW) / 2, curY + totalRowH / 2);

  ctx.textAlign = 'right';
  ctx.font = `900 32px ${FONT_SANS}`;
  ctx.fillText(formatCurrency(data.monthlyTotal), xAmount + colAmountW - 25, curY + totalRowH / 2);

  curY += totalRowH + 60;

  // 6. PHẦN CUỐI TỜ SỔ & KHỐI CHỮ KÝ
  ctx.textBaseline = 'top';

  // Bên trái: Ghi chú ngày mở sổ & số dòng
  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = `italic 500 25px ${FONT_SANS}`;
  ctx.fillText(`- Sổ này có ${data.rows.length} dòng ghi chép tương ứng ${data.rows.length} ngày trong tháng.`, marginX, curY);
  ctx.fillText(`- Mở sổ ngày 01 tháng ${paddedM} năm ${data.selectedYear}.`, marginX, curY + 40);

  // Bên phải: Khối chữ ký Người đại diện hộ kinh doanh
  const sigCenterX = marginX + contentW - 320;
  ctx.textAlign = 'center';
  ctx.font = `italic 500 26px ${FONT_SANS}`;
  ctx.fillStyle = '#334155';
  ctx.fillText(`Ngày ${data.daysInMonth} tháng ${paddedM} năm ${data.selectedYear}`, sigCenterX, curY);

  ctx.font = `900 28px ${FONT_SANS}`;
  ctx.fillStyle = '#0f172a';
  ctx.fillText('NGƯỜI ĐẠI DIỆN HỘ KINH DOANH', sigCenterX, curY + 45);
  ctx.fillText('/ CÁ NHÂN KINH DOANH', sigCenterX, curY + 80);

  ctx.font = `italic 500 23px ${FONT_SANS}`;
  ctx.fillStyle = '#64748b';
  ctx.fillText('(Ký, ghi rõ họ tên, đóng dấu (nếu có))', sigCenterX, curY + 120);

  // Khoảng cách ký tên
  const signerName = data.workshop.bankAccount?.accountHolder || data.businessName || 'Tiệm in 194';
  ctx.font = `900 30px ${FONT_SANS}`;
  ctx.fillStyle = '#0f172a';
  ctx.fillText(signerName.toUpperCase(), sigCenterX, curY + 310);

  return canvas;
}
