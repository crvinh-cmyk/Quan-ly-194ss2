import React, { useState, useRef, useEffect } from 'react';
import { Order, WorkshopInfo } from '../types';
import { formatCurrency, formatDateVN, numberToVietnameseWords } from '../utils/formatters';
import {
  Printer, X, Download, Copy, Phone, MapPin,
  Building2, Image, FileText, CheckCircle2, Loader2, Sparkles, ExternalLink, Clock
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { generateInvoicePortraitCanvas, downloadCanvasAsJPG } from '../utils/exportInvoice4K';

export type PaperSize = 'a4' | 'a5-portrait' | 'a5-landscape';

/**
 * Chuyển đổi mã màu oklch(...) sang mã màu RGB hoặc HEX an toàn
 * để html2canvas không bị crash (do html2canvas chưa hỗ trợ hàm màu oklch của CSS Color Module 4).
 */
function convertOklchToRgb(colorStr: string): string {
  if (!colorStr || typeof colorStr !== 'string') return colorStr;
  if (!colorStr.includes('oklch') && !colorStr.includes('lab') && !colorStr.includes('color(')) {
    return colorStr;
  }

  // 1. Dùng canvas 2d context để trình duyệt tự giải mã và chuẩn hóa oklch thành rgba/hex
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillStyle = colorStr;
      const res = ctx.fillStyle;
      if (res && !res.includes('oklch') && !res.includes('lab')) {
        return res;
      }
    }
  } catch {
    // tiếp tục fallback nếu canvas context bận hoặc không giải mã được
  }

  // 2. Tra cứu bảng mã màu tương đương theo bảng màu Tailwind v4 chuẩn
  const lower = colorStr.toLowerCase();
  if (lower.includes('slate-950') || lower.includes('0.129')) return '#020617';
  if (lower.includes('slate-900') || lower.includes('0.208')) return '#0f172a';
  if (lower.includes('slate-800') || lower.includes('0.278')) return '#1e293b';
  if (lower.includes('slate-700') || lower.includes('0.372')) return '#334155';
  if (lower.includes('slate-600') || lower.includes('0.446')) return '#475569';
  if (lower.includes('slate-500') || lower.includes('0.552')) return '#64748b';
  if (lower.includes('slate-400') || lower.includes('0.704')) return '#94a3b8';
  if (lower.includes('slate-300') || lower.includes('0.869')) return '#cbd5e1';
  if (lower.includes('slate-200') || lower.includes('0.928')) return '#e2e8f0';
  if (lower.includes('slate-100') || lower.includes('0.967')) return '#f1f5f9';
  if (lower.includes('slate-50')  || lower.includes('0.984')) return '#f8fafc';
  if (lower.includes('amber-500') || lower.includes('0.769')) return '#f59e0b';
  if (lower.includes('amber-600') || lower.includes('0.666')) return '#d97706';
  if (lower.includes('amber-700') || lower.includes('0.553')) return '#b45309';
  if (lower.includes('amber-800') || lower.includes('0.47'))  return '#92400e';
  if (lower.includes('amber-950') || lower.includes('0.28'))  return '#451a03';
  if (lower.includes('amber-50')  || lower.includes('0.987')) return '#fffbeb';
  if (lower.includes('amber-100') || lower.includes('0.962')) return '#fef3c7';
  if (lower.includes('amber-200') || lower.includes('0.924')) return '#fde68a';
  if (lower.includes('emerald-600') || lower.includes('0.596')) return '#059669';
  if (lower.includes('emerald-700') || lower.includes('0.508')) return '#047857';
  if (lower.includes('blue-600')  || lower.includes('0.546')) return '#2563eb';
  if (lower.includes('blue-700')  || lower.includes('0.488')) return '#1d4ed8';
  if (lower.includes('red-600')   || lower.includes('0.577')) return '#dc2626';

  // 3. Fallback bóc tách kênh độ sáng L trong cú pháp oklch(L C H ...)
  const m = colorStr.match(/oklch\(\s*([\d.]+)/);
  if (m && m[1]) {
    const l = parseFloat(m[1]);
    if (l >= 0.95) return '#ffffff';
    if (l >= 0.85) return '#e2e8f0';
    if (l >= 0.65) return '#94a3b8';
    if (l >= 0.45) return '#475569';
    if (l >= 0.25) return '#1e293b';
    return '#0f172a';
  }

  return '#0f172a';
}

/**
 * Duyệt qua toàn bộ bản clone DOM của html2canvas để ép toàn bộ thuộc tính màu oklch
 * sang mã HEX / RGB an toàn mà html2canvas hỗ trợ 100%.
 */
function sanitizeDocumentOklchColors(clonedDoc: Document, clonedEl: HTMLElement) {
  // 1. Thay thế mọi chuỗi oklch(...) trong các thẻ <style> của clonedDoc
  try {
    const styleTags = clonedDoc.querySelectorAll('style');
    styleTags.forEach((styleTag) => {
      if (styleTag.textContent && (styleTag.textContent.includes('oklch') || styleTag.textContent.includes('lab('))) {
        styleTag.textContent = styleTag.textContent.replace(/oklch\([^)]+\)/gi, (match) => {
          return convertOklchToRgb(match);
        });
      }
    });
  } catch {
    // bỏ qua
  }

  // 2. Duyệt qua toàn bộ phần tử trong clonedEl và các thẻ con
  try {
    const allElements = [clonedEl, ...Array.from(clonedEl.getElementsByTagName('*'))] as HTMLElement[];
    const colorProps = [
      'color',
      'background-color',
      'border-color',
      'border-top-color',
      'border-right-color',
      'border-bottom-color',
      'border-left-color',
      'outline-color',
      'text-decoration-color',
      'fill',
      'stroke'
    ];

    allElements.forEach((el) => {
      if (!el || !el.style) return;
      try {
        const computed = window.getComputedStyle(el);
        colorProps.forEach((prop) => {
          const val = computed.getPropertyValue(prop);
          if (val && (val.includes('oklch') || val.includes('lab') || val.includes('color('))) {
            const safe = convertOklchToRgb(val);
            el.style.setProperty(prop, safe, 'important');
          }
        });

        // Xử lý box-shadow nếu chứa oklch
        const shadow = computed.getPropertyValue('box-shadow');
        if (shadow && shadow.includes('oklch')) {
          const safeShadow = shadow.replace(/oklch\([^)]+\)/gi, (m) => convertOklchToRgb(m));
          el.style.setProperty('box-shadow', safeShadow, 'important');
        }
      } catch {
        // bỏ qua
      }
    });
  } catch {
    // bỏ qua
  }

  // 3. Chèn thêm style cưỡng chế mã màu HEX an toàn vào clonedDoc.head
  try {
    const override = clonedDoc.createElement('style');
    override.id = 'html2canvas-safe-colors-override';
    override.textContent = `
      *, *::before, *::after {
        --tw-border-opacity: 1 !important;
      }
      .printable-area {
        background-color: #ffffff !important;
        color: #0f172a !important;
        border-color: #e2e8f0 !important;
      }
    `;
    clonedDoc.head.appendChild(override);
  } catch {
    // bỏ qua
  }
}

interface PrintInvoiceModalProps {
  order: Order | null;
  workshop: WorkshopInfo;
  onClose: () => void;
}

export const PrintInvoiceModal: React.FC<PrintInvoiceModalProps> = ({ order, workshop, onClose }) => {
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [isExportingJPG, setIsExportingJPG] = useState(false);
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const [copyToast, setCopyToast] = useState('');
  const [exportSuccessMsg, setExportSuccessMsg] = useState('');
  const [exportedJpgUrl, setExportedJpgUrl] = useState<string>('');
  const [exportedFilename, setExportedFilename] = useState<string>('');
  
  // State for Instant Preview & Synchronous Clipboard Copy Modal
  const [copyPreviewModal, setCopyPreviewModal] = useState<{
    isOpen: boolean;
    imageUrl: string;
    blob: Blob | null;
  }>({
    isOpen: false,
    imageUrl: '',
    blob: null
  });
  const [directCopySuccess, setDirectCopySuccess] = useState(false);
  const [directCopyError, setDirectCopyError] = useState(false);
  const [directCopyMsg, setDirectCopyMsg] = useState('');
  const invoiceRef = useRef<HTMLDivElement>(null);

  // Dynamically update print @page style based on chosen paper size
  useEffect(() => {
    let styleTag = document.getElementById('dynamic-invoice-print-style') as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'dynamic-invoice-print-style';
      document.head.appendChild(styleTag);
    }

    let pageCss = '';
    if (paperSize === 'a4') {
      pageCss = `
        @page {
          size: A4 portrait;
          margin: 8mm 6mm;
        }
      `;
    } else if (paperSize === 'a5-portrait') {
      pageCss = `
        @page {
          size: A5 portrait;
          margin: 4mm 4mm;
        }
      `;
    } else if (paperSize === 'a5-landscape') {
      pageCss = `
        @page {
          size: A5 landscape;
          margin: 4mm 4mm;
        }
      `;
    }

    styleTag.innerHTML = pageCss;

    return () => {
      const el = document.getElementById('dynamic-invoice-print-style');
      if (el) el.remove();
    };
  }, [paperSize]);

  if (!order) return null;

  const cleanCustomerPhone = (order.customerPhone || '').replace(/[^0-9]/g, '');

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // 1. Khi người dùng bấm nút "Sao chép ảnh hóa đơn (Gửi Zalo)":
  // Render khung hóa đơn thành thẻ canvas & Blob (khử hoàn toàn lỗi oklch), sau đó NGAY LẬP TỨC mở Modal xem trước
  const handleCopyInvoiceImage = async () => {
    if (!invoiceRef.current) return;
    setIsCopyingImage(true);
    setCopyToast('');
    setDirectCopySuccess(false);
    setDirectCopyError(false);
    setDirectCopyMsg('');

    try {
      if (typeof document !== 'undefined' && document.fonts) {
        try {
          await document.fonts.ready;
        } catch {
          // ignore font loading
        }
      }

      let canvas: HTMLCanvasElement | null = null;
      let renderEngineUsed = 'html2canvas';

      // BƯỚC 1: Thử render bằng html2canvas kèm cấu hình onclone xử lý triệt để mã màu oklch
      try {
        canvas = await html2canvas(invoiceRef.current, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          onclone: (clonedDoc, clonedEl) => {
            // Tự động thay thế hoặc ép các thuộc tính màu dạng oklch(...) sang định dạng màu an toàn tương đương (mã HEX / rgb)
            sanitizeDocumentOklchColors(clonedDoc, clonedEl);
          },
          ignoreElements: (element) => {
            // Bỏ qua các phần tử không in như nút bấm, thanh điều khiển, no-print
            return element.classList?.contains('no-print') || element.getAttribute('data-no-print') === 'true';
          }
        });
      } catch (h2cError: any) {
        console.warn('html2canvas gặp sự cố (sẽ tự động kích hoạt bộ vẽ 2D Canvas Engine):', h2cError);
        renderEngineUsed = '2d-canvas';
      }

      // BƯỚC 2: DỰ PHÒNG SIÊU BỀN - Nếu html2canvas gặp lỗi môi trường CSS, dùng Pure 2D Canvas Engine
      if (!canvas) {
        try {
          canvas = await generateInvoicePortraitCanvas(order, workshop);
        } catch (canvas2dErr: any) {
          throw new Error(`Không thể vẽ ảnh hóa đơn: ${canvas2dErr?.message || 'Lỗi render'}`);
        }
      }

      if (!canvas) {
        throw new Error('Không thể tạo canvas hóa đơn');
      }

      // Lưu canvas vào DOM với ID chuẩn 'invoice-canvas-id' theo đúng yêu cầu kỹ thuật
      let existingCanvas = document.getElementById('invoice-canvas-id') as HTMLCanvasElement | null;
      if (!existingCanvas) {
        existingCanvas = document.createElement('canvas');
        existingCanvas.id = 'invoice-canvas-id';
        existingCanvas.style.display = 'none';
        document.body.appendChild(existingCanvas);
      }
      existingCanvas.width = canvas.width;
      existingCanvas.height = canvas.height;
      const ctx = existingCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, 0);
      }

      // Convert canvas to PNG blob
      const blob: Blob | null = await new Promise((resolve) => {
        canvas!.toBlob((b) => resolve(b), 'image/png', 0.95);
      });

      const dataUrl = canvas.toDataURL('image/png');

      // Ngay lập tức mở Modal (Cửa sổ nổi) hiển thị trực quan bức ảnh hóa đơn vừa vẽ xong
      // kèm nút bấm to rõ: "📋 SAO CHÉP ẢNH VÀO BỘ NHỚ TẠM"
      setCopyPreviewModal({
        isOpen: true,
        imageUrl: dataUrl,
        blob: blob
      });
    } catch (err: any) {
      console.error('Lỗi khi chụp ảnh hóa đơn:', err);
      const errMsg = err?.message || 'Không thể tạo ảnh hóa đơn';
      setCopyToast(`⚠️ Không thể chụp ảnh tự động: ${errMsg}`);
      setDirectCopyError(true);
      setDirectCopyMsg(`Chi tiết lỗi: ${errMsg}`);
    } finally {
      setIsCopyingImage(false);
    }
  };

  // 2. Kỹ thuật Clipboard đồng bộ theo thao tác Click trực tiếp trong Modal:
  // Nút "📋 SAO CHÉP ẢNH VÀO BỘ NHỚ TẠM" gắn thẳng sự kiện onClick trực tiếp của người dùng
  const handleDirectClipboardCopy = async () => {
    try {
      let blob: Blob | null = copyPreviewModal.blob;

      if (!blob) {
        const canvas = document.getElementById('invoice-canvas-id') as HTMLCanvasElement | null;
        if (canvas) {
          blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
        }
      }

      // Fallback lấy blob từ dataURL nếu chưa có
      if (!blob && copyPreviewModal.imageUrl) {
        try {
          const resp = await fetch(copyPreviewModal.imageUrl);
          blob = await resp.blob();
        } catch {
          // ignore
        }
      }

      if (!blob) {
        throw new Error('Chưa tìm thấy dữ liệu ảnh để sao chép');
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        setDirectCopySuccess(true);
        setDirectCopyError(false);
        setDirectCopyMsg('Đã copy ảnh hóa đơn thành công! Hãy mở Zalo và ấn Ctrl + V để dán gửi khách.');
      } else {
        throw new Error('Trình duyệt chưa hỗ trợ ClipboardItem');
      }
    } catch (err: any) {
      console.error('Lỗi sao chép ảnh:', err);
      // Fallback: Hướng dẫn người dùng click chuột phải vào ảnh
      setDirectCopyError(true);
      setDirectCopySuccess(false);
      setDirectCopyMsg(`Trình duyệt hạn chế ghi trực tiếp (${err?.message || 'Chặn quyền'}). Bạn hãy click chuột phải vào ảnh bên dưới chọn "Sao chép hình ảnh" (Copy image) để dán Zalo!`);
    }
  };

  // Export Portrait JPG for easy mobile viewing
  const handleExportJPGPortrait = async () => {
    setIsExportingJPG(true);
    setExportSuccessMsg('');

    try {
      if (typeof document !== 'undefined' && document.fonts) {
        await document.fonts.ready;
      }
      const canvas = await generateInvoicePortraitCanvas(order, workshop);
      const cleanCustomer = (order.customerName || 'Khach').replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_');
      const filename = `Phieu_194_${order.orderNumber}_${cleanCustomer}_Doc.jpg`;
      const dataUrl = downloadCanvasAsJPG(canvas, filename);

      setExportedJpgUrl(dataUrl);
      setExportedFilename(filename);
      setExportSuccessMsg(`Đã xuất phiếu hóa đơn thành công! (${filename})`);
    } catch (err: any) {
      console.error('Lỗi khi xuất ảnh dọc:', err);
      setExportSuccessMsg(`⚠️ Không thể tạo ảnh: ${err?.message || 'Vui lòng thử lại'}`);
    } finally {
      setIsExportingJPG(false);
    }
  };

  // Determine container styling based on selected paper size
  const isA5 = paperSize === 'a5-portrait' || paperSize === 'a5-landscape';
  const isLandscape = paperSize === 'a5-landscape';

  return (
    <div className="printable-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      {/* Modal Card */}
      <div className="printable-modal-card bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Top Control Bar (Hidden when printing) */}
        <div className="no-print p-3 sm:p-4 bg-slate-900 text-white flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-slate-800">
          
          {/* Left Info & Title */}
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <Printer className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base">In & Xuất Phiếu Giao Hàng</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500 text-slate-950">
                  {order.orderNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">
                Khách: <strong className="text-slate-200">{order.customerName}</strong>
              </p>
            </div>
          </div>

          {/* Center: Paper Size Selector (A4 vs A5) */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700 self-start md:self-auto">
            <span className="text-[11px] font-bold text-slate-400 px-2 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              Khổ in:
            </span>
            <button
              type="button"
              onClick={() => setPaperSize('a4')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                paperSize === 'a4'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Khổ A4 (Dọc)
            </button>
            <button
              type="button"
              onClick={() => setPaperSize('a5-portrait')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                paperSize === 'a5-portrait'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Khổ A5 (Dọc)
            </button>
            <button
              type="button"
              onClick={() => setPaperSize('a5-landscape')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                paperSize === 'a5-landscape'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Khổ A5 (Ngang)
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap justify-end">
            {/* Mở Zalo khách (nếu có số điện thoại) */}
            {cleanCustomerPhone && (
              <a
                href={`https://zalo.me/${cleanCustomerPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition cursor-pointer"
                title={`Mở Zalo số ${cleanCustomerPhone} để gửi ảnh`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Mở Zalo khách</span>
              </a>
            )}

            {/* Nút Sao chép ảnh hóa đơn (Gửi Zalo) */}
            <button
              type="button"
              disabled={isCopyingImage}
              onClick={handleCopyInvoiceImage}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/25 transition cursor-pointer disabled:opacity-50"
              title="Vẽ ảnh hóa đơn và mở xem trước để sao chép trực tiếp vào bộ nhớ tạm gửi Zalo"
            >
              {isCopyingImage ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang vẽ ảnh...</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Sao chép ảnh hóa đơn (Gửi Zalo)</span>
                </>
              )}
            </button>

            {/* Xuất phiếu tải về máy (JPG) */}
            <button
              type="button"
              disabled={isExportingJPG}
              onClick={handleExportJPGPortrait}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer disabled:opacity-50"
              title="Tải ảnh hóa đơn về máy"
            >
              {isExportingJPG ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang tải...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Tải ảnh</span>
                </>
              )}
            </button>

            {/* Print Button (A4 / A5) */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md shadow-amber-500/20 transition cursor-pointer"
              title={`In phiếu khổ ${paperSize === 'a4' ? 'A4' : 'A5'}`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In Phiếu ({paperSize === 'a4' ? 'A4' : paperSize === 'a5-portrait' ? 'A5 Dọc' : 'A5 Ngang'})</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast thông báo đã sao chép ảnh hóa đơn thành công */}
        {copyToast && (
          <div className="no-print bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white px-4 py-2.5 text-xs sm:text-sm font-extrabold flex items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-top-2 border-b border-emerald-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
              <span>{copyToast}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {cleanCustomerPhone && (
                <a
                  href={`https://zalo.me/${cleanCustomerPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-white text-emerald-950 rounded-lg text-xs font-black shadow-xs hover:bg-emerald-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  <span>Mở Zalo dán ngay (Ctrl+V)</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setCopyToast('')}
                className="text-emerald-100 hover:text-white p-1 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Success Export Notification & Direct Download Button */}
        {exportSuccessMsg && (
          <div className="no-print bg-emerald-50 border-b border-emerald-300 px-4 py-2.5 text-xs font-bold text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{exportSuccessMsg}</span>
            </div>
            <div className="flex items-center gap-2">
              {exportedJpgUrl && (
                <a
                  href={exportedJpgUrl}
                  download={exportedFilename}
                  className="flex items-center gap-1.5 px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Bấm để tải lại phiếu hóa đơn</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setExportSuccessMsg('');
                  setExportedJpgUrl('');
                }}
                className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* MODAL TRỰC QUAN: XEM TRƯỚC ẢNH HÓA ĐƠN & SAO CHÉP ĐỒNG BỘ VÀO BỘ NHỚ TẠM */}
        {copyPreviewModal.isOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
              {/* Header Modal */}
              <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                    <Image className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm sm:text-base">Xem Trước & Sao Chép Ảnh Hóa Đơn (Gửi Zalo)</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500 text-slate-950">
                        {order.orderNumber}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Khách hàng: <strong className="text-slate-200">{order.customerName}</strong>
                      {cleanCustomerPhone && <span className="ml-2 font-mono text-slate-300">({cleanCustomerPhone})</span>}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCopyPreviewModal({ isOpen: false, imageUrl: '', blob: null });
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Thông báo trạng thái sao chép (Alert Banner) */}
              {directCopySuccess ? (
                <div className="p-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs sm:text-sm font-bold flex items-center justify-between gap-3 shadow-inner animate-in slide-in-from-top-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
                    <span>{directCopyMsg || 'Đã copy ảnh hóa đơn thành công! Hãy mở Zalo và ấn Ctrl + V để dán gửi khách.'}</span>
                  </div>
                  {cleanCustomerPhone && (
                    <a
                      href={`https://zalo.me/${cleanCustomerPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-white text-emerald-950 rounded-lg text-xs font-black shadow-xs hover:bg-emerald-50 flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                      <span>Mở Zalo dán ngay (Ctrl+V)</span>
                    </a>
                  )}
                </div>
              ) : directCopyError ? (
                <div className="p-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <strong className="block font-bold mb-0.5">Thông báo trạng thái:</strong>
                    <p className="font-semibold text-amber-900 mb-1">{directCopyMsg || 'Trình duyệt hạn chế sao chép ảnh tự động vào bộ nhớ tạm.'}</p>
                    <p className="text-[11px] text-amber-800">
                      👉 <strong>Cách xử lý nhanh:</strong> Click <strong>chuột phải vào ảnh hóa đơn bên dưới</strong> (hoặc nhấn giữ trên điện thoại) và chọn <strong>"Sao chép hình ảnh" (Copy image)</strong>, sau đó mở Zalo và ấn <strong>Ctrl + V</strong> để gửi khách! Hoặc bấm nút <strong>"Tải ảnh PNG"</strong> để gửi file.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Bấm nút xanh dưới đây để sao chép ảnh vào bộ nhớ tạm, sau đó mở Zalo ấn <strong>Ctrl + V</strong> để gửi khách trực tiếp mà không tốn bộ nhớ máy.
                  </span>
                </div>
              )}

              {/* KHUNG NÚT BẤM CHÍNH - GẮN TRỰC TIẾP ONCLICK CỦA NGƯỜI DÙNG */}
              <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                {/* NÚT BẤM TO RÕ THEO YÊU CẦU: 📋 SAO CHÉP ẢNH VÀO BỘ NHỚ TẠM */}
                <button
                  type="button"
                  id="btn-direct-copy-invoice-image"
                  onClick={handleDirectClipboardCopy}
                  className={`flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 rounded-xl text-white font-black text-xs sm:text-sm shadow-md transition transform active:scale-98 cursor-pointer flex-1 sm:flex-initial ${
                    directCopySuccess
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-700 ring-2 ring-emerald-300'
                      : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-700/30'
                  }`}
                  title="Click trực tiếp để sao chép ảnh hóa đơn vào Clipboard máy tính/điện thoại"
                >
                  <Copy className="w-4 h-4" />
                  <span>
                    {directCopySuccess
                      ? '✅ ĐÃ COPY THÀNH CÔNG! (MỞ ZALO DÁN CTRL+V)'
                      : '📋 SAO CHÉP ẢNH VÀO BỘ NHỚ TẠM'}
                  </span>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Nút Mở Zalo khách */}
                  {cleanCustomerPhone && (
                    <a
                      href={`https://zalo.me/${cleanCustomerPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                      title={`Mở Zalo số ${cleanCustomerPhone}`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Mở Zalo khách</span>
                    </a>
                  )}

                  {/* Nút Tải ảnh về máy (Dự phòng) */}
                  <a
                    href={copyPreviewModal.imageUrl}
                    download={`Hoa_don_${order.orderNumber}.png`}
                    className="flex items-center gap-1 px-3 py-2 sm:py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                    title="Tải ảnh hóa đơn về máy"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải ảnh PNG</span>
                  </a>
                </div>
              </div>

              {/* Vùng hiển thị trực quan bức ảnh hóa đơn */}
              <div className="p-4 flex-1 overflow-y-auto bg-slate-200/80 flex items-center justify-center">
                <div className="max-w-full text-center">
                  <img
                    id="invoice-rendered-preview-img"
                    src={copyPreviewModal.imageUrl}
                    alt="Hóa đơn xem trước"
                    className="max-h-[56vh] max-w-full object-contain rounded-lg shadow-xl border border-slate-300 bg-white inline-block"
                  />
                  <p className="mt-2 text-[11px] text-slate-500">
                    💡 Chuột phải vào ảnh để chọn <strong>"Sao chép hình ảnh"</strong> bất cứ lúc nào
                  </p>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span>Khổ in hiện tại: <strong>{paperSize === 'a4' ? 'A4' : paperSize === 'a5-portrait' ? 'A5 Dọc' : 'A5 Ngang'}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    setCopyPreviewModal({ isOpen: false, imageUrl: '', blob: null });
                  }}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold cursor-pointer transition"
                >
                  Đóng cửa sổ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Printable Invoice Container */}
        <div className="overflow-y-auto flex-1 bg-slate-100/60 p-3 sm:p-6 flex justify-center">
          <div
            ref={invoiceRef}
            style={{
              backgroundColor: '#ffffff',
              color: '#0f172a',
              borderColor: '#e2e8f0'
            }}
            className={`printable-area bg-white text-slate-900 shadow-lg border border-slate-200 transition-all ${
              paperSize === 'a4'
                ? 'w-full max-w-[800px] p-6 sm:p-8 rounded-xl'
                : paperSize === 'a5-portrait'
                ? 'w-full max-w-[580px] p-4 sm:p-5 rounded-lg text-xs'
                : 'w-full max-w-[840px] p-4 sm:p-5 rounded-lg text-xs'
            }`}
          >
            {/* Header Lab Info */}
            <div className={`border-b-2 border-slate-900 ${isA5 ? 'pb-2.5 mb-3' : 'pb-4 mb-4'}`}>
              <div className="flex flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`${isA5 ? 'w-8 h-8 text-base' : 'w-10 h-10 text-xl'} rounded-lg bg-amber-500 flex items-center justify-center font-black text-slate-950 tracking-tighter shrink-0 shadow-xs`}>
                    194
                  </div>
                  <div>
                    <h1 className={`${isA5 ? 'text-base' : 'text-lg sm:text-xl'} font-extrabold tracking-tight text-slate-900 uppercase`}>
                      {workshop.name}
                    </h1>
                    <p className={`${isA5 ? 'text-[11px]' : 'text-xs'} font-medium text-slate-600`}>
                      {workshop.subtitle}
                    </p>
                  </div>
                </div>
                <div className={`text-right ${isA5 ? 'text-[11px] space-y-0.5' : 'text-xs space-y-0.5'} text-slate-600`}>
                  <p className="flex items-center justify-end gap-1 font-bold text-slate-900">
                    <Phone className="w-3.5 h-3.5 text-amber-600" />
                    <span>Hotline / Zalo: {workshop.phone}</span>
                  </p>
                  <p className="flex items-center justify-end gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{workshop.address}</span>
                  </p>
                  <p className="flex items-center justify-end gap-1 font-black text-red-600 text-[11px] sm:text-xs tracking-tight pt-0.5" style={{ color: '#dc2626' }}>
                    <Clock className="w-3.5 h-3.5 text-red-600 shrink-0" style={{ color: '#dc2626' }} />
                    <span className="font-black text-red-600" style={{ color: '#dc2626' }}>
                      Thời gian làm việc từ 8H - 20h Từ thứ 2 đến thứ 7
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Invoice Title & Meta */}
            <div className={`text-center ${isA5 ? 'my-2.5' : 'my-4'}`}>
              <h2 className={`${isA5 ? 'text-base font-extrabold' : 'text-lg sm:text-xl font-black'} uppercase tracking-wider text-slate-900`}>
                HÓA ĐƠN BÁN HÀNG & PHIẾU XUẤT KHO
              </h2>
              <div className={`flex items-center justify-center gap-4 ${isA5 ? 'text-[11px]' : 'text-xs'} text-slate-600 mt-0.5 font-mono`}>
                <span>Mã số phiếu: <strong className="text-slate-950">{order.orderNumber}</strong></span>
                <span>•</span>
                <span>Ngày lập: <strong className="text-slate-950">{formatDateVN(order.date)}</strong></span>
                <span>•</span>
                <span className="text-amber-800 font-bold">Khổ: {paperSize === 'a4' ? 'A4' : 'A5'}</span>
              </div>
            </div>

            {/* Customer Info Box */}
            <div className={`bg-slate-50 ${isA5 ? 'p-2.5 mb-3 gap-1.5 text-xs' : 'p-3.5 mb-4 gap-2 text-xs'} rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2`}>
              <div>
                <p className="text-slate-500 text-[11px]">Khách hàng / Studio đối tác:</p>
                <p className="font-bold text-slate-950 text-xs sm:text-sm">{order.customerName}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[11px]">Số điện thoại liên hệ:</p>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <p className="font-bold text-slate-950 font-mono text-xs sm:text-sm">{order.customerPhone || 'Chưa cập nhật'}</p>
                  {cleanCustomerPhone && (
                    <a
                      href={`https://zalo.me/${cleanCustomerPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="no-print inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold transition shadow-2xs cursor-pointer"
                      title={`Mở Zalo khách hàng (${cleanCustomerPhone})`}
                    >
                      <ExternalLink className="w-3 h-3 text-blue-600" />
                      <span>Mở Zalo khách</span>
                    </a>
                  )}
                </div>
              </div>
              {order.customerAddress && (
                <div className="sm:col-span-2">
                  <p className="text-slate-500 text-[11px]">Địa chỉ giao nhận ảnh:</p>
                  <p className="font-medium text-slate-800">{order.customerAddress}</p>
                </div>
              )}
              {order.notes && (
                <div className="sm:col-span-2 border-t border-slate-200/80 pt-1 mt-0.5">
                  <span className="text-slate-500 text-[11px]">Ghi chú đơn: </span>
                  <span className="font-medium text-amber-700 italic">{order.notes}</span>
                </div>
              )}
            </div>

            {/* Table Items */}
            <div className={`border border-slate-300 rounded-lg overflow-hidden ${isA5 ? 'mb-3' : 'mb-4'}`}>
              <table className={`w-full text-left border-collapse ${isA5 ? 'text-[11px]' : 'text-xs'}`}>
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                    <th className={`${isA5 ? 'py-1.5 px-1.5' : 'py-2 px-2'} text-center w-8`}>STT</th>
                    <th className={`${isA5 ? 'py-1.5 px-2' : 'py-2 px-2.5'} text-center w-20`}>Ngày</th>
                    <th className={`${isA5 ? 'py-1.5 px-2' : 'py-2 px-3'}`}>Tên hàng hóa & Quy cách</th>
                    <th className={`${isA5 ? 'py-1.5 px-2' : 'py-2 px-2.5'} text-center w-20`}>Khổ</th>
                    <th className={`${isA5 ? 'py-1.5 px-1.5' : 'py-2 px-2'} text-center w-12`}>SL</th>
                    <th className={`${isA5 ? 'py-1.5 px-2' : 'py-2 px-2.5'} text-right w-24`}>Đơn giá</th>
                    <th className={`${isA5 ? 'py-1.5 px-2' : 'py-2 px-3'} text-right w-28`}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {order.items.map((item, idx) => {
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50">
                        {/* STT */}
                        <td className={`${isA5 ? 'py-1.5 px-1.5' : 'py-2 px-2'} text-center text-slate-500 font-mono`}>{idx + 1}</td>

                        {/* Ngày */}
                        <td className={`${isA5 ? 'py-1.5 px-2 text-[10px]' : 'py-2 px-2.5 text-[11px]'} text-center font-mono text-slate-600`}>
                          {formatDateVN(item.date || order.date)}
                        </td>

                        {/* Tên hàng hóa & Quy cách (Đã bỏ mã sản phẩm để tăng không gian rộng rãi cho tên hàng) */}
                        <td className={`${isA5 ? 'py-1.5 px-2' : 'py-2 px-3'} text-slate-900`}>
                          {/* Tên sản phẩm: In đậm, cỡ chữ dễ đọc, ngắt dòng tự nhiên */}
                          <div className={`font-bold text-slate-950 ${isA5 ? 'text-xs' : 'text-[13px]'} break-words leading-snug`}>
                            {item.productName}
                          </div>

                          {/* Ghi chú riêng của sản phẩm (nếu có) */}
                          {item.note && (
                            <div className="mt-0.5 text-[10px] text-gray-500 italic">
                              ↳ Ghi chú: {item.note}
                            </div>
                          )}
                        </td>

                        {/* Khổ */}
                        <td className={`${isA5 ? 'py-1.5 px-2' : 'py-2 px-2.5'} text-center font-bold text-slate-700 bg-slate-50/50`}>
                          {item.size}
                        </td>

                        {/* SL */}
                        <td className={`${isA5 ? 'py-1.5 px-1.5' : 'py-2 px-2'} text-center font-black text-slate-950 text-sm`}>
                          {item.quantity}
                        </td>

                        {/* Đơn giá */}
                        <td className={`${isA5 ? 'py-1.5 px-2' : 'py-2 px-2.5'} text-right font-mono text-slate-700`}>
                          {formatCurrency(item.price)}
                        </td>

                        {/* Thành tiền */}
                        <td className={`${isA5 ? 'py-1.5 px-2' : 'py-2 px-3'} text-right font-mono font-black text-slate-950 text-sm`}>
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Calculations */}
            <div className={`flex justify-end items-start ${isA5 ? 'mb-3' : 'mb-5'}`}>
              {/* Right Totals Box */}
              <div className={`w-full sm:w-80 bg-slate-50 border border-slate-300 rounded-lg ${isA5 ? 'p-2 space-y-1 text-xs' : 'p-3 space-y-1.5 text-xs'}`}>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Tổng tiền hàng:</span>
                  <span className="font-mono font-bold">{formatCurrency(order.subtotal)}</span>
                </div>

                {order.discount > 0 && (
                  <div className="flex justify-between items-center text-emerald-600 font-medium">
                    <span>Chiết khấu / Giảm trừ:</span>
                    <span className="font-mono font-bold">-{formatCurrency(order.discount)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-amber-800 font-medium border-t border-slate-200 pt-1">
                  <span>Nợ cũ:</span>
                  <span className="font-mono font-bold">{formatCurrency(order.previousDebt)}</span>
                </div>

                {order.paid > 0 && (
                  <div className="flex justify-between items-center text-blue-700">
                    <span>Đã thanh toán / Tạm ứng:</span>
                    <span className="font-mono font-bold">-{formatCurrency(order.paid)}</span>
                  </div>
                )}

                <div className={`flex justify-between items-center text-slate-950 font-extrabold border-t-2 border-slate-900 ${isA5 ? 'pt-1.5' : 'pt-2'}`}>
                  <span className="uppercase text-amber-800 font-bold">CẦN THANH TOÁN:</span>
                  <span className={`font-mono text-red-600 ${isA5 ? 'text-sm font-black' : 'text-base font-black'}`}>
                    {formatCurrency(order.totalDue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Amount in Vietnamese Words */}
            <div className={`bg-amber-50/80 border border-amber-200/90 rounded-lg ${isA5 ? 'p-2 text-[11px] mb-4' : 'p-2.5 text-xs mb-6'} text-amber-950`}>
              <span className="font-bold">Số tiền viết bằng chữ: </span>
              <span className="font-medium italic">{numberToVietnameseWords(order.totalDue)}</span>
            </div>

            {/* Signatures */}
            <div className={`grid grid-cols-3 text-center ${isA5 ? 'text-[11px] pt-1' : 'text-xs pt-2'}`}>
              <div>
                <p className="font-bold text-slate-800 uppercase">Khách hàng</p>
                <p className="text-[10px] text-slate-400 italic mb-10 sm:mb-12">(Ký, ghi rõ họ tên)</p>
                <p className="font-bold text-slate-700">{order.customerName}</p>
              </div>
              <div>
                <p className="font-bold text-slate-800 uppercase">Người giao nhận</p>
                <p className="text-[10px] text-slate-400 italic mb-10 sm:mb-12">(Ký, ghi rõ họ tên)</p>
                <p className="text-slate-400">..............................</p>
              </div>
              <div>
                <p className="font-bold text-slate-800 uppercase">Người lập phiếu</p>
                <p className="text-[10px] text-slate-400 italic mb-10 sm:mb-12">(Ký, đóng dấu tiệm)</p>
                <p className="font-extrabold text-slate-900">{workshop.name}</p>
              </div>
            </div>

            {/* Footer Watermark */}
            <div className="mt-4 pt-2 border-t border-slate-100 text-center text-[10px] text-slate-400">
              Phần mềm quản lý bán hàng & công nợ chuyên dụng Tiệm In 194 • Hotline: {workshop.phone}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
