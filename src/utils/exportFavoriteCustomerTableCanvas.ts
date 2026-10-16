import { downloadCanvasAsJPG } from "./exportInvoice4K";
import { formatCurrency } from "./formatters";

export interface FavoriteCustomerExportData {
  customerName: string;
  studioName?: string;
  phone?: string;
  monthStr: string; // e.g. "10/2026"
  monthTotal: number;
  discount: number;
  remaining: number;
  previousDebt: number;
  dueTotal: number;
  workshopName?: string;
  discountLabel?: string;
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

export async function generateFavoriteCustomerCanvas(
  data: FavoriteCustomerExportData
): Promise<HTMLCanvasElement> {
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Graceful fallback
    }
  }

  const canvasWidth = 1600;
  const canvasHeight = 720;
  const marginX = 50;
  const cardX = marginX;
  const cardW = canvasWidth - marginX * 2; // 1500 px

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // 1. Canvas Background
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. White Card Container with subtle shadow
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.06)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, cardX, 40, cardW, canvasHeight - 80, 24);
  ctx.fill();
  ctx.restore();

  // Card Outer Border
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  roundRect(ctx, cardX, 40, cardW, canvasHeight - 80, 24);
  ctx.stroke();

  let curY = 85;
  const innerX = cardX + 45;
  const innerW = cardW - 90; // 1410 px

  // --- HEADER SECTION ---
  // Top Badge
  ctx.fillStyle = "#fef3c7";
  roundRect(ctx, innerX, curY, 360, 36, 18);
  ctx.fill();
  ctx.strokeStyle = "#fde68a";
  ctx.lineWidth = 1;
  roundRect(ctx, innerX, curY, 360, 36, 18);
  ctx.stroke();

  ctx.fillStyle = "#92400e";
  ctx.font = "800 16px " + FONT_SANS;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("⭐ BẢNG CÔNG NỢ THÁNG " + data.monthStr, innerX + 180, curY + 18);

  // Title / Customer Name
  curY += 56;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#0f172a";
  ctx.font = "900 34px " + FONT_SANS;
  const displayTitle = data.studioName ? data.customerName + " (" + data.studioName + ")" : data.customerName;
  ctx.fillText(displayTitle, innerX, curY);

  if (data.phone) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#64748b";
    ctx.font = "600 20px " + FONT_SANS;
    ctx.fillText("SĐT: " + data.phone, innerX + innerW, curY + 10);
  }

  curY += 75;

  // --- 6-COLUMN TABLE (EXACT MODEL FROM USER IMAGE) ---
  const tableX = innerX;
  const tableW = innerW;
  const headerH = 75;
  const rowH = 95;
  const tableH = headerH + rowH;

  const colW = [240, 250, 250, 200, 200, 270];
  const colX = [tableX];
  for (let i = 0; i < colW.length; i++) {
    colX.push(colX[i] + colW[i]);
  }

  // Draw Table Outer Border
  ctx.save();
  roundRect(ctx, tableX, curY, tableW, tableH, 16);
  ctx.clip();

  // 1. Table Header Background & Separators
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(tableX, curY, tableW, headerH);

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tableX, curY + headerH);
  ctx.lineTo(tableX + tableW, curY + headerH);
  ctx.stroke();

  // Column vertical lines in header
  for (let i = 1; i < colX.length - 1; i++) {
    ctx.beginPath();
    ctx.moveTo(colX[i], curY);
    ctx.lineTo(colX[i], curY + tableH);
    ctx.stroke();
  }

  // Header Texts
  ctx.fillStyle = "#1e293b";
  ctx.font = "800 17px " + FONT_SANS;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const discountTitle = data.discountLabel || "Chiết khấu Thanh Toán";

  const renderHeaderCell = (text: string, colIndex: number) => {
    const cx = colX[colIndex] + colW[colIndex] / 2;
    const cy = curY + headerH / 2;

    if (text === "Tổng tiền trong tháng") {
      ctx.fillText("Tổng tiền", cx, cy - 11);
      ctx.fillText("trong tháng", cx, cy + 11);
    } else if (text === "Chiết khấu Thanh Toán") {
      ctx.fillText("Chiết khấu", cx, cy - 11);
      ctx.fillText("Thanh Toán", cx, cy + 11);
    } else if (text === "Hỗ trợ vận chuyển") {
      ctx.fillText("Hỗ trợ", cx, cy - 11);
      ctx.fillText("vận chuyển", cx, cy + 11);
    } else if (text === "Cần Thanh Toán") {
      ctx.fillText("Cần Thanh Toán", cx, cy);
    } else {
      ctx.fillText(text, cx, cy);
    }
  };

  const rawHeaders = [
    "khách hàng",
    "Tổng tiền trong tháng",
    discountTitle,
    "Còn lại",
    "Nợ cũ",
    "Cần Thanh Toán",
  ];

  rawHeaders.forEach((text, i) => renderHeaderCell(text, i));

  // 2. Data Row
  const rowY = curY + headerH;

  // Normal cells background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(tableX, rowY, tableW - colW[5], rowH);

  // Cell 6: "Cần Thanh Toán" Background - BRIGHT YELLOW
  ctx.fillStyle = "#fef08a"; // Tailwind yellow-200 / bright yellow
  ctx.fillRect(colX[5], rowY, colW[5], rowH);

  // Cell 1: Khách hàng
  ctx.textAlign = "center";
  ctx.fillStyle = "#0f172a";
  ctx.font = "800 22px " + FONT_SANS;
  ctx.fillText(data.customerName, colX[0] + colW[0] / 2, rowY + rowH / 2);

  // Cell 2: Tổng tiền trong tháng
  ctx.textAlign = "center";
  ctx.font = "800 22px " + FONT_SANS;
  ctx.fillStyle = "#0f172a";
  ctx.fillText(formatCurrency(data.monthTotal), colX[1] + colW[1] / 2, rowY + rowH / 2);

  // Cell 3: Chiết khấu Thanh Toán
  ctx.textAlign = "center";
  ctx.font = "800 22px " + FONT_SANS;
  ctx.fillStyle = data.discount > 0 ? "#b45309" : "#64748b";
  ctx.fillText(formatCurrency(data.discount), colX[2] + colW[2] / 2, rowY + rowH / 2);

  // Cell 4: Còn lại
  ctx.textAlign = "center";
  ctx.font = "800 22px " + FONT_SANS;
  ctx.fillStyle = "#0f172a";
  ctx.fillText(formatCurrency(data.remaining), colX[3] + colW[3] / 2, rowY + rowH / 2);

  // Cell 5: Nợ cũ
  ctx.textAlign = "center";
  ctx.font = "800 22px " + FONT_SANS;
  ctx.fillStyle = data.previousDebt > 0 ? "#dc2626" : "#64748b";
  ctx.fillText(formatCurrency(data.previousDebt), colX[4] + colW[4] / 2, rowY + rowH / 2);

  // Cell 6: Cần Thanh Toán (Highlight in Bold)
  ctx.textAlign = "center";
  ctx.font = "900 26px " + FONT_SANS;
  ctx.fillStyle = "#854d0e"; // Dark amber-800 on yellow
  ctx.fillText(formatCurrency(data.dueTotal), colX[5] + colW[5] / 2, rowY + rowH / 2);

  ctx.restore();

  // Table Outer Border
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.5;
  roundRect(ctx, tableX, curY, tableW, tableH, 16);
  ctx.stroke();

  curY += tableH + 45;

  // --- FOOTER NOTE (EXACT PHRASE FROM USER IMAGE) ---
  ctx.fillStyle = "#334155";
  ctx.font = "600 20px " + FONT_SANS;
  ctx.textAlign = "center";
  ctx.fillText(
    "Quý Khách Vui lòng thanh toán trước ngày m2 tháng kế tiếp để nhận ưu đãi chiết khấu. Quá hạn khoản chiết khấu sẽ được cộng ngược lại công nợ.",
    canvasWidth / 2,
    curY
  );

  curY += 36;
  ctx.font = "800 22px " + FONT_SANS;
  ctx.fillStyle = "#0f172a";
  ctx.fillText("Trân Trọng!", canvasWidth / 2, curY);

  return canvas;
}

export async function downloadFavoriteCustomerTableJPG(
  data: FavoriteCustomerExportData,
  customFilename?: string
): Promise<string> {
  const canvas = await generateFavoriteCustomerCanvas(data);
  const nameSlug = data.customerName.replace(/\s+/g, "_");
  const monthSlug = data.monthStr.replace(/\//g, "-");
  const defaultFilename = "Bang_Cong_No_" + nameSlug + "_" + monthSlug + ".jpg";
  return downloadCanvasAsJPG(canvas, customFilename || defaultFilename);
}
