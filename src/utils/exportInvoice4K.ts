import { Order, WorkshopInfo } from '../types';
import { formatCurrency, formatDateVN, numberToVietnameseWords, getCustomerFacingName } from './formatters';

// Premium typography with full Vietnamese Unicode charset support
const FONT_SANS = '"Be Vietnam Pro", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

/**
 * Generates an ultra-crisp PORTRAIT (file dọc) image for easy viewing on smartphones.
 * - Width: 2160 px (Ultra-HD resolution).
 * - Height: Dynamically calculated to fit EXACTLY the invoice content (ZERO wasted blank space).
 * - Full Vietnamese typography support (Be Vietnam Pro font) ensuring even, beautiful letters
 *   without fallback font glitches or broken diacritics (Ả, Ệ, Ổ, đ, etc.).
 * - Removed: Top watermark bar and signature section.
 */
export async function generateInvoicePortraitCanvas(order: Order, workshop: WorkshopInfo): Promise<HTMLCanvasElement> {
  // Ensure Vietnamese web fonts are loaded into the browser context
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Graceful fallback
    }
  }

  const canvasWidth = 2160;

  // Layout metrics
  const marginX = 50;
  const cardX = marginX;
  const cardW = canvasWidth - marginX * 2; // 2060 px
  const padX = cardX + 70;
  const padW = cardW - 140; // 1920 px

  // Measure content heights precisely
  const cardPadTop = 60;
  const headerH = 145; // header info
  const dividerSpace = 25; // space above divider line
  const afterDividerSpace = 75; // generous space between divider line and title baseline
  const metaSpace = 50; // space between title baseline and meta date/number
  const beforeCustSpace = 45; // space between meta and customer box
  const custBoxH = order.notes ? 200 : 160;
  const beforeTableSpace = 35; // space before table
  const thH = 80;
  const rowH = 92; // Expanded row height for spacious legibility
  const tableRowsH = order.items.length * rowH;
  const beforeSummarySpace = 35;
  const summaryBoxH = 310;
  const beforeWordsSpace = 25;
  const wordsH = 85;
  const beforeFooterSpace = 35;
  const footerH = 40;
  const cardPadBottom = 55;

  // Exact card and canvas height
  const cardH =
    cardPadTop +
    headerH +
    dividerSpace +
    afterDividerSpace +
    metaSpace +
    beforeCustSpace +
    custBoxH +
    beforeTableSpace +
    thH +
    tableRowsH +
    beforeSummarySpace +
    summaryBoxH +
    beforeWordsSpace +
    wordsH +
    beforeFooterSpace +
    footerH +
    cardPadBottom;

  const canvasMarginY = 50;
  const canvasHeight = cardH + canvasMarginY * 2;
  const cardY = canvasMarginY;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context not supported');
  }

  // 1. Studio Backdrop (Slate 100)
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. White Paper Invoice Card in Center
  const cardRadius = 24;
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.10)';
  ctx.shadowBlur = 45;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.fill();
  ctx.restore();

  // Card border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2.5;
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.stroke();

  let curY = cardY + cardPadTop;

  // 3. HEADER: Workshop Logo & Info
  // Amber Logo Badge
  ctx.fillStyle = '#f59e0b';
  roundRect(ctx, padX, curY, 120, 120, 22);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 68px ${FONT_SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('194', padX + 60, curY + 62);

  // Left: Workshop Name & Subtitle
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 50px ${FONT_SANS}`;
  ctx.fillText(workshop.name.toUpperCase(), padX + 145, curY + 52);

  ctx.fillStyle = '#475569';
  ctx.font = `500 26px ${FONT_SANS}`;
  ctx.fillText('Chuyên In Phóng Ảnh Lớn • Ép Gỗ • Tráng Gương • Pha Lê • Khung Cao Cấp', padX + 145, curY + 98);

  // Right Header Info: Phone, Address, Bank
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 30px ${FONT_SANS}`;
  ctx.fillText(`Hotline / Zalo: ${workshop.phone}`, padX + padW, curY + 36);

  ctx.fillStyle = '#475569';
  ctx.font = `400 25px ${FONT_SANS}`;
  ctx.fillText(workshop.address, padX + padW, curY + 76);

  ctx.fillStyle = '#dc2626';
  ctx.font = `800 27px ${FONT_SANS}`;
  ctx.fillText(
    'Thời gian làm việc từ 8H - 20h Từ thứ 2 đến thứ 7',
    padX + padW,
    curY + 116
  );

  // Move past header and space before divider
  curY += headerH + dividerSpace;

  // DIVIDER LINE: Separates header from Title cleanly
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(padX, curY);
  ctx.lineTo(padX + padW, curY);
  ctx.stroke();

  // Move curY well below the divider line so letters never collide with the line!
  curY += afterDividerSpace; // +75px

  // 4. TITLE: HÓA ĐƠN BÁN HÀNG & GIAO ẢNH
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 54px ${FONT_SANS}`;
  ctx.fillText('HÓA ĐƠN BÁN HÀNG & GIAO ẢNH', padX + padW / 2, curY);

  curY += metaSpace; // +50px
  ctx.fillStyle = '#64748b';
  ctx.font = `600 28px ${FONT_SANS}`;
  ctx.fillText(
    `Mã phiếu: ${order.orderNumber}     •     Ngày lập: ${formatDateVN(order.date)}`,
    padX + padW / 2,
    curY
  );

  curY += beforeCustSpace; // +45px

  // 5. CUSTOMER INFORMATION BOX
  const custBoxY = curY;
  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, padX, custBoxY, padW, custBoxH, 18);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  roundRect(ctx, padX, custBoxY, padW, custBoxH, 18);
  ctx.stroke();

  // Customer Name
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = `600 26px ${FONT_SANS}`;
  ctx.fillText('Khách hàng / Studio đối tác:', padX + 35, custBoxY + 48);
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 38px ${FONT_SANS}`;
  ctx.fillText(getCustomerFacingName(order), padX + 35, custBoxY + 98);

  // Phone
  ctx.fillStyle = '#64748b';
  ctx.font = `600 26px ${FONT_SANS}`;
  ctx.fillText('Số điện thoại:', padX + 900, custBoxY + 48);
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 34px ${FONT_SANS}`;
  ctx.fillText(order.customerPhone || 'Chưa cập nhật', padX + 900, custBoxY + 98);

  // Address
  ctx.fillStyle = '#64748b';
  ctx.font = `600 26px ${FONT_SANS}`;
  ctx.fillText('Địa chỉ nhận ảnh:', padX + 1380, custBoxY + 48);
  ctx.fillStyle = '#1e293b';
  ctx.font = `500 28px ${FONT_SANS}`;
  ctx.fillText(order.customerAddress || 'Nhận tại tiệm', padX + 1380, custBoxY + 98);

  if (order.notes) {
    ctx.fillStyle = '#b45309';
    ctx.font = `italic 500 26px ${FONT_SANS}`;
    ctx.fillText(`* Ghi chú đơn: ${order.notes}`, padX + 35, custBoxY + 155);
  }

  curY += custBoxH + beforeTableSpace;

  // 6. ITEMS TABLE (1920 px width, 92px row height)
  const tableY = curY;
  // 7 cột: STT (90), Ngày (190), Tên hàng hóa & Quy cách (800 - mở rộng tối đa), Khổ (180), SL (130), Đơn giá (260), Thành tiền (270)
  const colWidths = [90, 190, 800, 180, 130, 260, 270];
  const colX = [padX];
  for (let i = 0; i < colWidths.length - 1; i++) {
    colX.push(colX[i] + colWidths[i]);
  }

  // Header row
  ctx.fillStyle = '#f1f5f9';
  roundRect(ctx, padX, tableY, padW, thH, 10);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  roundRect(ctx, padX, tableY, padW, thH, 10);
  ctx.stroke();

  const headers = ['STT', 'Ngày', 'Tên hàng hóa & Quy cách', 'Khổ', 'SL', 'Đơn giá', 'Thành tiền'];
  ctx.font = `700 26px ${FONT_SANS}`;
  ctx.fillStyle = '#0f172a';
  ctx.textBaseline = 'middle';

  // STT
  ctx.textAlign = 'center';
  ctx.fillText(headers[0], colX[0] + colWidths[0] / 2, tableY + thH / 2);
  // Ngày
  ctx.fillText(headers[1], colX[1] + colWidths[1] / 2, tableY + thH / 2);
  // Tên hàng hóa & Quy cách
  ctx.textAlign = 'left';
  ctx.fillText(headers[2], colX[2] + 15, tableY + thH / 2);
  // Khổ
  ctx.textAlign = 'center';
  ctx.fillText(headers[3], colX[3] + colWidths[3] / 2, tableY + thH / 2);
  // SL
  ctx.fillText(headers[4], colX[4] + colWidths[4] / 2, tableY + thH / 2);
  // Đơn giá
  ctx.textAlign = 'right';
  ctx.fillText(headers[5], colX[5] + colWidths[5] - 15, tableY + thH / 2);
  // Thành tiền
  ctx.fillText(headers[6], colX[6] + colWidths[6] - 15, tableY + thH / 2);

  curY += thH;

  // Table Rows
  for (let idx = 0; idx < order.items.length; idx++) {
    const item = order.items[idx];
    const rY = curY + idx * rowH;

    // Alternating row background
    if (idx % 2 === 1) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(padX, rY, padW, rowH);
    }

    // Border line under row
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padX, rY + rowH);
    ctx.lineTo(padX + padW, rY + rowH);
    ctx.stroke();

    ctx.textBaseline = 'middle';
    const textMidY = rY + rowH / 2;

    // STT
    ctx.textAlign = 'center';
    ctx.font = `500 26px ${FONT_SANS}`;
    ctx.fillStyle = '#64748b';
    ctx.fillText((idx + 1).toString(), colX[0] + colWidths[0] / 2, textMidY);

    // Ngày
    ctx.font = `500 25px ${FONT_SANS}`;
    ctx.fillStyle = '#475569';
    ctx.fillText(formatDateVN(item.date || order.date), colX[1] + colWidths[1] / 2, textMidY);

    // Tên SP: Đã bỏ hoàn toàn mã sản phẩm để rộng rãi, không bị rối mắt
    ctx.textAlign = 'left';
    ctx.font = `700 26px ${FONT_SANS}`;
    ctx.fillStyle = '#0f172a';
    let displayTitle = item.productName;
    if (displayTitle.length > 46) displayTitle = displayTitle.substring(0, 44) + '...';

    if (item.note) {
      ctx.fillText(displayTitle, colX[2] + 15, textMidY - 14);
      // Ghi chú của khách/sản phẩm (nếu có)
      ctx.font = `500 20px ${FONT_SANS}`;
      ctx.fillStyle = '#64748b';
      let noteText = `↳ Ghi chú: ${item.note}`;
      if (noteText.length > 55) noteText = noteText.substring(0, 53) + '...';
      ctx.fillText(noteText, colX[2] + 15, textMidY + 18);
    } else {
      ctx.fillText(displayTitle, colX[2] + 15, textMidY);
    }

    // Khổ
    ctx.textAlign = 'center';
    ctx.font = `700 26px ${FONT_SANS}`;
    ctx.fillStyle = '#334155';
    ctx.fillText(item.size, colX[3] + colWidths[3] / 2, textMidY);

    // SL
    ctx.font = `800 30px ${FONT_SANS}`;
    ctx.fillStyle = '#0f172a';
    ctx.fillText(item.quantity.toString(), colX[4] + colWidths[4] / 2, textMidY);

    // Đơn giá
    ctx.textAlign = 'right';
    ctx.font = `600 27px ${FONT_SANS}`;
    ctx.fillStyle = '#475569';
    ctx.fillText(formatCurrency(item.price), colX[5] + colWidths[5] - 15, textMidY);

    // Thành tiền
    ctx.font = `800 29px ${FONT_SANS}`;
    ctx.fillStyle = '#0f172a';
    ctx.fillText(formatCurrency(item.amount), colX[6] + colWidths[6] - 15, textMidY);
  }

  // Outer border of table
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  roundRect(ctx, padX, tableY, padW, thH + tableRowsH, 10);
  ctx.stroke();

  curY += tableRowsH + beforeSummarySpace;

  // 7. BOTTOM SECTION: TOTALS CARD (Right)
  const summaryBoxW = 880;
  const summaryBoxX = padX + padW - summaryBoxW;
  const summaryBoxY = curY;

  // Right Totals Card
  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, summaryBoxX, summaryBoxY, summaryBoxW, summaryBoxH, 18);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  roundRect(ctx, summaryBoxX, summaryBoxY, summaryBoxW, summaryBoxH, 18);
  ctx.stroke();

  const sumLeftX = summaryBoxX + 35;
  const sumRightX = summaryBoxX + summaryBoxW - 35;
  let sY = summaryBoxY + 50;

  // Tiền hàng
  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = `600 28px ${FONT_SANS}`;
  ctx.fillText('Tổng tiền hàng:', sumLeftX, sY);
  ctx.textAlign = 'right';
  ctx.font = `700 30px ${FONT_SANS}`;
  ctx.fillStyle = '#0f172a';
  ctx.fillText(formatCurrency(order.subtotal), sumRightX, sY);

  sY += 48;

  // Chiết khấu (nếu có)
  if (order.discount > 0) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#059669';
    ctx.font = `600 28px ${FONT_SANS}`;
    ctx.fillText('Chiết khấu giảm giá:', sumLeftX, sY);
    ctx.textAlign = 'right';
    ctx.font = `700 30px ${FONT_SANS}`;
    ctx.fillText(`-${formatCurrency(order.discount)}`, sumRightX, sY);
    sY += 48;
  }

  // Nợ cũ
  ctx.textAlign = 'left';
  ctx.fillStyle = '#92400e';
  ctx.font = `600 28px ${FONT_SANS}`;
  ctx.fillText('Nợ cũ trước đơn này:', sumLeftX, sY);
  ctx.textAlign = 'right';
  ctx.font = `700 30px ${FONT_SANS}`;
  ctx.fillText(formatCurrency(order.previousDebt), sumRightX, sY);

  sY += 48;

  // Đã thanh toán / Tạm ứng
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1d4ed8';
  ctx.font = `600 28px ${FONT_SANS}`;
  ctx.fillText('Đã thanh toán / Tạm ứng:', sumLeftX, sY);
  ctx.textAlign = 'right';
  ctx.font = `700 30px ${FONT_SANS}`;
  ctx.fillText(`-${formatCurrency(order.paid)}`, sumRightX, sY);

  sY += 25;

  // Divider inside summary
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sumLeftX, sY);
  ctx.lineTo(sumRightX, sY);
  ctx.stroke();

  sY += 60;

  // CẦN THANH TOÁN
  ctx.textAlign = 'left';
  ctx.fillStyle = '#b45309';
  ctx.font = `800 32px ${FONT_SANS}`;
  ctx.fillText('CẦN THANH TOÁN:', sumLeftX, sY);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#dc2626';
  ctx.font = `800 48px ${FONT_SANS}`;
  ctx.fillText(formatCurrency(order.totalDue), sumRightX, sY);

  curY += summaryBoxH + beforeWordsSpace;

  // 8. AMOUNT IN VIETNAMESE WORDS
  ctx.fillStyle = '#fef3c7'; // Amber 100
  roundRect(ctx, padX, curY, padW, wordsH, 14);
  ctx.fill();
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 2;
  roundRect(ctx, padX, curY, padW, wordsH, 14);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#78350f';
  ctx.font = `700 28px ${FONT_SANS}`;
  ctx.fillText('Số tiền viết bằng chữ: ', padX + 30, curY + 52);

  ctx.fillStyle = '#92400e';
  ctx.font = `italic 600 28px ${FONT_SANS}`;
  ctx.fillText(numberToVietnameseWords(order.totalDue), padX + 350, curY + 52);

  curY += wordsH + beforeFooterSpace;

  // 9. CLEAN FOOTER
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748b';
  ctx.font = `700 24px ${FONT_SANS}`;
  ctx.fillText(
    `CẢM ƠN QUÝ KHÁCH ĐÃ ĐẶT IN TẠI ${workshop.name.toUpperCase()} • HOTLINE: ${workshop.phone}`,
    padX + padW / 2,
    curY + 25
  );

  return canvas;
}

/**
 * Helper to draw rounded rectangle on canvas
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Downloads the canvas as High-Res JPG (Portrait)
 */
export function downloadCanvasAsJPG(canvas: HTMLCanvasElement, filename: string): string {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return dataUrl;
}
