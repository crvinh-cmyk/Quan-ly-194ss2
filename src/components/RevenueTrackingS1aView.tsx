import React, { useState, useMemo, useRef } from 'react';
import { Order, WorkshopInfo } from '../types';
import { formatCurrency, formatDateVN } from '../utils/formatters';
import { getRevenueMultiplier } from '../utils/partnerConfig';
import {
  Printer,
  Download,
  Calendar,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  Sparkles,
  Loader2
} from 'lucide-react';
import html2canvas from 'html2canvas';

interface RevenueTrackingS1aViewProps {
  orders: Order[];
  workshop: WorkshopInfo;
}

export const RevenueTrackingS1aView: React.FC<RevenueTrackingS1aViewProps> = ({
  orders,
  workshop
}) => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1); // 1-12
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Fixed metadata according to specifications & Circular 152/2025/TT-BTC
  const businessName = 'Tiệm in 194';
  const businessAddress = 'Thôn 3 Quỳnh Giang cũ, xã Quỳnh Lưu, Nghệ An';
  const taxCode = ''; // Để trống nếu chưa có
  const currencyUnit = 'VNĐ';

  const multiplier = getRevenueMultiplier(); // Default 0.8 in partner mode

  // Calculate days in selected month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Aggregate daily revenue from main orders
  // - Applies 0.8 multiplier (or configured multiplier)
  // - Handles multiple orders per day
  const dailyData = useMemo(() => {
    // Group orders by day of month (1 to daysInMonth)
    const dailyMap: Record<number, { originalTotal: number; ordersCount: number }> = {};

    orders.forEach(order => {
      if (!order.date) return;
      // Filter out cancelled orders if any
      if (order.status === 'cancelled') return;

      const [yStr, mStr, dStr] = order.date.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const d = parseInt(dStr, 10);

      if (y === selectedYear && m === selectedMonth && d >= 1 && d <= 31) {
        if (!dailyMap[d]) {
          dailyMap[d] = { originalTotal: 0, ordersCount: 0 };
        }
        // subtotal is revenue before discount, or total order revenue (subtotal - discount)
        const orderRev = Math.max(0, (order.subtotal || 0) - (order.discount || 0));
        dailyMap[d].originalTotal += orderRev;
        dailyMap[d].ordersCount += 1;
      }
    });

    const rows = [];
    let monthlyTotal = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dayData = dailyMap[day];
      const hasRevenue = dayData && dayData.originalTotal > 0;
      
      // Calculate discounted revenue: multiply by 0.8 and round
      const discountedAmount = hasRevenue ? Math.round(dayData.originalTotal * multiplier) : 0;
      monthlyTotal += discountedAmount;

      const paddedDay = day.toString().padStart(2, '0');
      const paddedMonth = selectedMonth.toString().padStart(2, '0');
      const dateString = `${paddedDay}/${paddedMonth}/${selectedYear}`;

      rows.push({
        dayNumber: day,
        dateString,
        hasRevenue,
        explanation: hasRevenue ? 'In ảnh và đóng khung ảnh' : 'Nghỉ bán không phát sinh doanh thu',
        amount: discountedAmount,
        originalAmount: hasRevenue ? dayData.originalTotal : 0,
        ordersCount: hasRevenue ? dayData.ordersCount : 0
      });
    }

    return {
      rows,
      monthlyTotal
    };
  }, [orders, selectedYear, selectedMonth, daysInMonth, multiplier]);

  // Handle direct print
  const handlePrint = () => {
    window.print();
  };

  // Handle high quality image export (20x30 cm ratio: 2:3 aspect ratio)
  const handleExportImage = async () => {
    if (!printAreaRef.current) return;
    setIsExporting(true);
    setExportSuccess(false);

    try {
      // Allow browser fonts & layout to be completely ready
      if (document.fonts) {
        await document.fonts.ready;
      }

      // 20x30 cm portrait standard at 150-200 DPI gives ~1600 x 2400 px or scale 2
      const canvas = await html2canvas(printAreaRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1000
      });

      const paddedMonth = selectedMonth.toString().padStart(2, '0');
      const fileName = `So_Theo_Doi_Doanh_Thu_Mauso_S1a_TiemIn194_Thang_${paddedMonth}_${selectedYear}.jpg`;

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err) {
      console.error('Lỗi khi xuất ảnh mẫu S1a:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const currentYearOptions = [selectedYear - 1, selectedYear, selectedYear + 1];

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar (No Print) */}
      <div className="no-print bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                Mẫu S1a-HKD
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Thông tư số 152/2025/TT-BTC
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-1">
              Sổ Theo Dõi Doanh Thu Bán Hàng & Dịch Vụ
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tự động tổng hợp dữ liệu đơn hàng từng ngày từ Firestore, áp dụng hệ số đối tác (-20%) và định dạng chuẩn khổ giấy 20x30 cm
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
              title="In trực tiếp ra giấy khổ 20x30 cm hoặc A4"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>In Sổ S1a</span>
            </button>

            <button
              onClick={handleExportImage}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/20 transition cursor-pointer disabled:opacity-60"
              title="Xuất file ảnh độ phân giải cao tỉ lệ 20x30 cm"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Đang xuất ảnh...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-slate-950" />
                  <span>Xuất ảnh in 20x30 cm</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters: Month & Year Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>Kỳ kê khai:</span>
            </div>

            {/* Month Selector */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m < 10 ? `0${m}` : m}
                </option>
              ))}
            </select>

            {/* Year Selector */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Summary Pill */}
          <div className="flex items-center gap-3">
            {exportSuccess && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Đã tải file ảnh sổ 20x30 cm thành công!
              </span>
            )}
            <div className="text-right">
              <span className="text-[11px] text-slate-400 font-medium block">
                Tổng doanh thu tháng {selectedMonth}/{selectedYear} (-20%):
              </span>
              <span className="text-base font-black text-amber-600 font-mono">
                {formatCurrency(dailyData.monthlyTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Note info banner */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Quy chuẩn mẫu sổ S1a (TT 152/2025/TT-BTC):</strong> Bảng kê chi tiết từng ngày từ ngày 01 đến ngày cuối cùng của tháng. Ngày có đơn hàng tự động diễn giải <em>"In ảnh và đóng khung ảnh"</em> với số tiền đã trừ 20%; ngày không phát sinh tự động ghi <em>"Nghỉ bán không phát sinh doanh thu"</em>. Khung hiển thị bên dưới chuẩn tỉ lệ khổ in 20x30 cm.
          </div>
        </div>
      </div>

      {/* S1A SHEET CONTAINER - STANDARD 20x30 CM CANVAS */}
      <div className="flex justify-center overflow-x-auto pb-10">
        <div
          ref={printAreaRef}
          className="s1a-sheet bg-white text-slate-900 p-8 sm:p-10 shadow-xl border border-slate-300 w-full max-w-[840px] font-sans printable-area transition-all"
          style={{
            minHeight: '1200px', // Standard 20x30 aspect ratio (2:3)
            boxSizing: 'border-box'
          }}
        >
          {/* HEADER SECTION OF S1A FORM */}
          <div className="flex justify-between items-start gap-4 pb-4 border-b border-slate-900/40">
            {/* Left: Business Info */}
            <div className="text-xs space-y-1 max-w-[55%]">
              <p>
                <strong>Hộ, cá nhân kinh doanh:</strong>{' '}
                <span className="font-bold uppercase text-slate-950">{businessName}</span>
              </p>
              <p className="leading-snug">
                <strong>Địa chỉ / Địa điểm kinh doanh:</strong>{' '}
                <span className="text-slate-800">{businessAddress}</span>
              </p>
              <p>
                <strong>Mã số thuế:</strong>{' '}
                <span className="font-mono">{taxCode || '...........................................'}</span>
              </p>
            </div>

            {/* Right: Circular Form Specification Code */}
            <div className="text-right text-xs shrink-0">
              <p className="font-black text-sm tracking-wide text-slate-950">
                Mẫu số: S1a-HKD
              </p>
              <p className="text-[11px] text-slate-700 italic max-w-[260px] text-right mt-0.5 leading-tight">
                (Ban hành kèm theo Thông tư số 152/2025/TT-BTC ngày 31/12/2025 của Bộ Tài chính)
              </p>
            </div>
          </div>

          {/* MAIN TITLE */}
          <div className="text-center my-6 space-y-1">
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-wider text-slate-950">
              SỔ THEO DÕI DOANH THU BÁN HÀNG HOÁ, DỊCH VỤ
            </h1>
            <p className="text-xs font-bold text-slate-800">
              Kỳ kê khai: Tháng {selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth} năm {selectedYear}
            </p>
            <p className="text-[11px] text-slate-600 italic">
              Đơn vị tính: {currencyUnit}
            </p>
          </div>

          {/* S1A TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-900 text-xs">
              <thead>
                <tr className="bg-slate-100/90 text-center font-bold text-slate-950">
                  <th className="border border-slate-900 p-2 w-12">STT</th>
                  <th className="border border-slate-900 p-2 w-32">
                    Ngày, tháng ghi sổ
                  </th>
                  <th className="border border-slate-900 p-2">
                    Diễn giải
                  </th>
                  <th className="border border-slate-900 p-2 w-44 text-right">
                    Số tiền ({currencyUnit})
                  </th>
                </tr>
                <tr className="bg-slate-50 text-center text-[10px] italic text-slate-600 font-medium">
                  <td className="border border-slate-900 py-0.5"></td>
                  <td className="border border-slate-900 py-0.5">A</td>
                  <td className="border border-slate-900 py-0.5">B</td>
                  <td className="border border-slate-900 py-0.5 text-right pr-2">1</td>
                </tr>
              </thead>
              <tbody>
                {dailyData.rows.map((row, idx) => (
                  <tr
                    key={row.dayNumber}
                    className={`hover:bg-slate-50 transition-colors ${
                      row.hasRevenue ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* STT */}
                    <td className="border border-slate-900 p-1.5 text-center text-slate-600 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    {/* Cột A: Ngày tháng */}
                    <td className="border border-slate-900 p-1.5 text-center font-mono font-medium text-slate-800 text-[11px]">
                      {row.dateString}
                    </td>

                    {/* Cột B: Diễn giải */}
                    <td className="border border-slate-900 p-1.5 text-slate-900">
                      <span className={row.hasRevenue ? 'font-bold text-slate-900' : 'text-slate-500 italic'}>
                        {row.explanation}
                      </span>
                    </td>

                    {/* Cột 1: Số tiền */}
                    <td className="border border-slate-900 p-1.5 text-right font-mono font-bold text-slate-950">
                      {row.amount > 0 ? (
                        formatCurrency(row.amount)
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>
                  </tr>
                ))}

                {/* DÒNG TỔNG CỘNG */}
                <tr className="bg-slate-200/90 font-black text-slate-950">
                  <td
                    colSpan={3}
                    className="border border-slate-900 p-2 text-center uppercase tracking-wide text-xs"
                  >
                    Tổng cộng
                  </td>
                  <td className="border border-slate-900 p-2 text-right font-mono text-sm text-slate-950">
                    {formatCurrency(dailyData.monthlyTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* FOOTER & SIGNATURE SECTION */}
          <div className="mt-8 pt-4 flex justify-between items-start text-xs text-slate-900">
            {/* Left side: Date opened */}
            <div className="space-y-1">
              <p className="italic text-[11px] text-slate-700">
                - Sổ này có {dailyData.rows.length} dòng ghi chép tương ứng {dailyData.rows.length} ngày trong tháng.
              </p>
              <p className="italic text-[11px] text-slate-700">
                - Mở sổ ngày 01 tháng {selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth} năm {selectedYear}
              </p>
            </div>

            {/* Right side: Signature block */}
            <div className="text-center w-72 space-y-1">
              <p className="italic text-slate-700 text-[11px]">
                Ngày {daysInMonth} tháng {selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth} năm {selectedYear}
              </p>
              <p className="font-bold uppercase tracking-wider text-slate-950 leading-tight">
                NGƯỜI ĐẠI DIỆN HỘ KINH DOANH / CÁ NHÂN KINH DOANH
              </p>
              <p className="text-[10px] text-slate-600 italic">
                (Ký, ghi rõ họ tên, đóng dấu (nếu có))
              </p>
              
              {/* Generous signature space */}
              <div className="h-24"></div>

              <p className="font-bold text-slate-950 uppercase pt-2">
                {workshop.bankAccount?.accountHolder || 'Tiệm in 194'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
