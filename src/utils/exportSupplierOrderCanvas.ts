import { downloadCanvasAsJPG } from "./exportInvoice4K";
import { formatDateVN } from "./formatters";

export interface SupplierOrderReceiptExportData {
  supplier: string;
  date: string;
  orderDate?: string;
  receiptNumber?: string;
  notes?: string;
  items: Array<{
    materialName: string;
    quantity: number;
    unit: string;
    note?: string;
    notes?: string;
    [key: string]: any;
  }>;
}

const FONT_SANS =
  '"Be Vietnam Pro", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

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

export async function generateSupplierOrderCanvas(
  receipt: SupplierOrderReceiptExportData
): Promise<HTMLCanvasElement> {
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Graceful fallback
    }
  }

  const canvasWidth = 1600;
  const marginX = 40;
  const cardX = marginX;
  const cardW = canvasWidth - marginX * 2; // 1520 px

  const items = receipt.items || [];
  const rowH = 72;
  const headerRowH = 56;
  const tableH = headerRowH + Math.max(1, items.length) * rowH;

  const topHeaderH = 110;
  const notesText = (receipt.notes || "").trim();
  const notesH = notesText ? 90 : 0;

  // Calculate clean total height without internal summary/watermark bar
  const totalHeight = 40 + topHeaderH + 24 + tableH + (notesH ? 24 + notesH : 0) + 40;

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = Math.max(700, totalHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // 1. Overall Canvas Background (Clean subtle slate)
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvasWidth, canvas.height);

  // 2. White Card Container
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.05)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, cardX, 30, cardW, canvas.height - 60, 20);
  ctx.fill();
  ctx.restore();

  // Card Outer Border
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  roundRect(ctx, cardX, 30, cardW, canvas.height - 60, 20);
  ctx.stroke();

  let curY = 60;
  const innerX = cardX + 36;
  const innerW = cardW - 72; // 1448 px

  // --- TOP HEADER SECTION ---
  // Left: Badge & Supplier Name
  ctx.fillStyle = "#065f46";
  roundRect(ctx, innerX, curY, 340, 32, 8);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 15px ${FONT_SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PHIẾU ĐẶT HÀNG GỬI NHÀ CUNG CẤP", innerX + 170, curY + 16);

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#64748b";
  ctx.font = `600 18px ${FONT_SANS}`;
  ctx.fillText("Nhà Cung Cấp:", innerX, curY + 46);

  ctx.fillStyle = "#0f172a";
  ctx.font = `900 36px ${FONT_SANS}`;
  ctx.fillText((receipt.supplier || "NHÀ CUNG CẤP").toUpperCase(), innerX + 145, curY + 38);

  // Right: Order Date Box (Actual date of ordering)
  const actualDate = receipt.orderDate || receipt.date || new Date().toISOString().slice(0, 10);
  const formattedDate = formatDateVN(actualDate);

  const rightBoxW = 380;
  const rightBoxX = innerX + innerW - rightBoxW;

  ctx.fillStyle = "#ecfdf5";
  roundRect(ctx, rightBoxX, curY + 8, rightBoxW, 54, 12);
  ctx.fill();
  ctx.strokeStyle = "#a7f3d0";
  ctx.lineWidth = 1.5;
  roundRect(ctx, rightBoxX, curY + 8, rightBoxW, 54, 12);
  ctx.stroke();

  ctx.fillStyle = "#065f46";
  ctx.font = `700 18px ${FONT_SANS}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Ngày lên đơn:", rightBoxX + 20, curY + 35);

  ctx.fillStyle = "#047857";
  ctx.font = `900 24px ${FONT_SANS}`;
  ctx.fillText(formattedDate, rightBoxX + 160, curY + 35);

  curY += topHeaderH;

  // --- MODERN TABLE SECTION (EXACT STRUCTURE OF INTERNAL VIEW) ---
  const tableX = innerX;
  const tableW = innerW;

  // Column widths: STT (80), Ghi Chú (320), ĐVT (140), SL (150), Tên Mặt Hàng (758)
  const wStt = 80;
  const wUnit = 140;
  const wQty = 150;
  const wNote = 320;
  const wName = tableW - wStt - wUnit - wQty - wNote; // 758 px

  const colX = [
    tableX,
    tableX + wStt,
    tableX + wStt + wName,
    tableX + wStt + wName + wNote,
    tableX + wStt + wName + wNote + wUnit,
    tableX + tableW,
  ];

  // Outer rounded container for the table
  ctx.save();
  roundRect(ctx, tableX, curY, tableW, tableH, 16);
  ctx.clip();

  // 1. Table Header Row (#f8fafc with slate-700 bold text)
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(tableX, curY, tableW, headerRowH);

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tableX, curY + headerRowH);
  ctx.lineTo(tableX + tableW, curY + headerRowH);
  ctx.stroke();

  ctx.fillStyle = "#334155";
  ctx.font = `800 20px ${FONT_SANS}`;
  ctx.textBaseline = "middle";

  // STT Header
  ctx.textAlign = "center";
  ctx.fillText("STT", colX[0] + wStt / 2, curY + headerRowH / 2);

  // Tên Mặt Hàng / Vật Tư Đặt
  ctx.textAlign = "left";
  ctx.fillText("Tên Mặt Hàng / Vật Tư Đặt", colX[1] + 16, curY + headerRowH / 2);

  // Ghi Chú
  ctx.textAlign = "left";
  ctx.fillText("Ghi Chú", colX[2] + 16, curY + headerRowH / 2);

  // ĐVT
  ctx.textAlign = "center";
  ctx.fillText("ĐVT", colX[3] + wUnit / 2, curY + headerRowH / 2);

  // SL
  ctx.textAlign = "center";
  ctx.fillText("SL", colX[4] + wQty / 2, curY + headerRowH / 2);

  let rowY = curY + headerRowH;

  // 2. Data Rows (Matching internal view's input pill cards)
  items.forEach((it, idx) => {
    // Row background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(tableX, rowY, tableW, rowH);

    // Row bottom separator
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tableX, rowY + rowH);
    ctx.lineTo(tableX + tableW, rowY + rowH);
    ctx.stroke();

    const boxH = 48;
    const boxY = rowY + (rowH - boxH) / 2;

    // --- 1. STT ---
    ctx.fillStyle = "#64748b";
    ctx.font = `800 20px ${FONT_SANS}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${idx + 1}`, colX[0] + wStt / 2, rowY + rowH / 2);

    // --- 2. Tên Mặt Hàng / Vật Tư Đặt (White input box with border #cbd5e1, bold text) ---
    const nameBoxX = colX[1] + 8;
    const nameBoxW = wName - 16;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, nameBoxX, boxY, nameBoxW, boxH, 12);
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    roundRect(ctx, nameBoxX, boxY, nameBoxW, boxH, 12);
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = `800 22px ${FONT_SANS}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(it.materialName || "", nameBoxX + 18, boxY + boxH / 2);

    // --- 3. Ghi Chú (Light slate box with #e2e8f0 border) ---
    const noteBoxX = colX[2] + 8;
    const noteBoxW = wNote - 16;
    ctx.fillStyle = "#f8fafc";
    roundRect(ctx, noteBoxX, boxY, noteBoxW, boxH, 12);
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1.5;
    roundRect(ctx, noteBoxX, boxY, noteBoxW, boxH, 12);
    ctx.stroke();

    const noteVal = (it.note || it.notes || "").trim();
    if (noteVal) {
      ctx.fillStyle = "#334155";
      ctx.font = `600 20px ${FONT_SANS}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(noteVal, noteBoxX + 16, boxY + boxH / 2);
    }

    // --- 4. ĐVT (Pill box with centered bold text) ---
    const unitBoxX = colX[3] + 8;
    const unitBoxW = wUnit - 16;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, unitBoxX, boxY, unitBoxW, boxH, 12);
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    roundRect(ctx, unitBoxX, boxY, unitBoxW, boxH, 12);
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = `800 22px ${FONT_SANS}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(it.unit || "Tấm", unitBoxX + unitBoxW / 2, boxY + boxH / 2);

    // --- 5. SL (Pill box with emerald bold number) ---
    const qtyBoxX = colX[4] + 8;
    const qtyBoxW = wQty - 16;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, qtyBoxX, boxY, qtyBoxW, boxH, 12);
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    roundRect(ctx, qtyBoxX, boxY, qtyBoxW, boxH, 12);
    ctx.stroke();

    ctx.fillStyle = "#047857";
    ctx.font = `900 24px ${FONT_SANS}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${it.quantity}`, qtyBoxX + qtyBoxW / 2, boxY + boxH / 2);

    rowY += rowH;
  });

  ctx.restore();

  // Table Outer Border
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.5;
  roundRect(ctx, tableX, curY, tableW, tableH, 16);
  ctx.stroke();

  curY += tableH;

  // --- GENERAL NOTES SECTION (ONLY IF PROVIDED) ---
  if (notesText) {
    curY += 24;
    ctx.fillStyle = "#fffbeb";
    roundRect(ctx, innerX, curY, innerW, notesH, 16);
    ctx.fill();
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 1.5;
    roundRect(ctx, innerX, curY, innerW, notesH, 16);
    ctx.stroke();

    ctx.fillStyle = "#b45309";
    ctx.font = `800 18px ${FONT_SANS}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("GHI CHÚ ĐƠN ĐẶT HÀNG:", innerX + 24, curY + 18);

    ctx.fillStyle = "#78350f";
    ctx.font = `700 22px ${FONT_SANS}`;
    ctx.fillText(notesText, innerX + 24, curY + 48);

    curY += notesH;
  }

  return canvas;
}

export async function downloadSupplierOrderJPG(
  receipt: SupplierOrderReceiptExportData,
  customFilename?: string
): Promise<string> {
  const canvas = await generateSupplierOrderCanvas(receipt);
  const supplierSlug = (receipt.supplier || "NCC").replace(/\s+/g, "_");
  const actualDate = receipt.orderDate || receipt.date || new Date().toISOString().slice(0, 10);
  const dateSlug = actualDate.replace(/-/g, "");
  const defaultFilename = `Phieu_Gui_NCC_${supplierSlug}_${dateSlug}.jpg`;
  return downloadCanvasAsJPG(canvas, customFilename || defaultFilename);
}
