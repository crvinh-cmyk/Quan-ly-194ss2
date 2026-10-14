import fs from 'fs';

let code = fs.readFileSync('src/components/InkInventoryTracking.tsx', 'utf8');

// 1. Update imports
if (!code.includes('PaperMaterialItem')) {
  code = code.replace(
    "import { InkImportRecord, InkColorCode } from '../types';",
    "import { InkImportRecord, InkColorCode, PaperMaterialItem } from '../types';"
  );
}

if (!code.includes('getLocalPaperMaterials')) {
  code = code.replace(
    "import { formatCurrency, formatNumber, formatDateVN } from '../utils/formatters';",
    "import { formatCurrency, formatNumber, formatDateVN } from '../utils/formatters';\nimport { getLocalPaperMaterials, subscribePaperMaterials, savePaperMaterialsToFirestore } from '../services/firestoreService';"
  );
}

if (!code.includes('Scroll')) {
  code = code.replace("  Check, X, FileText,", "  Check, X, FileText, Scroll, Save,");
}

// 2. Add state and effect for paper materials in InkInventoryTracking component
const stateTarget = "export const InkInventoryTracking: React.FC<InkInventoryTrackingProps> = ({";
const stateAdditions = `export const InkInventoryTracking: React.FC<InkInventoryTrackingProps> = ({
  inkImports,
  onSaveInkImport,
  onDeleteInkImport,
  onResetInkYear
}) => {
  // Paper Materials State & Subscription
  const [paperMaterials, setPaperMaterials] = React.useState<PaperMaterialItem[]>(() => getLocalPaperMaterials());
  const [editingPaperPrices, setEditingPaperPrices] = React.useState<Record<string, number>>({});
  const [paperSaveSuccess, setPaperSaveSuccess] = React.useState<boolean>(false);

  React.useEffect(() => {
    const unsub = subscribePaperMaterials((updated) => {
      setPaperMaterials(updated || []);
    });
    return () => unsub();
  }, []);

  const handlePaperPriceChange = (id: string, val: number) => {
    setEditingPaperPrices(prev => ({
      ...prev,
      [id]: Math.max(0, val)
    }));
  };

  const handleSavePaperPrices = () => {
    const nextItems = paperMaterials.map(item => {
      if (editingPaperPrices[item.id] !== undefined) {
        return {
          ...item,
          price: editingPaperPrices[item.id],
          updatedAt: new Date().toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          })
        };
      }
      return item;
    });
    savePaperMaterialsToFirestore(nextItems).catch(console.error);
    setEditingPaperPrices({});
    setPaperSaveSuccess(true);
    setTimeout(() => setPaperSaveSuccess(false), 3000);
  };
`;

if (!code.includes('const [paperMaterials, setPaperMaterials]')) {
  code = code.replace(
    `export const InkInventoryTracking: React.FC<InkInventoryTrackingProps> = ({
  inkImports,
  onSaveInkImport,
  onDeleteInkImport,
  onResetInkYear
}) => {`,
    stateAdditions
  );
}

// 3. Rename top banner title
code = code.replace(
  'THEO DÕI LƯỢNG MỰC NHẬP XƯỞNG (CANON LUCIA PRO 12 MÀU)',
  'THEO DÕI VÀ QUẢN LÝ GIẤY - MỰC IN (TIỆM IN 194)'
);

code = code.replace(
  'Báo cáo định mức tiêu thụ bình mực 12 màu cho tất cả các dòng ảnh hoàn thiện',
  'Quản lý danh mục Giấy in RC bóng, Giấy PP & Theo dõi định mức 12 màu mực Canon Lucia Pro'
);

// 4. Inject DANH MỤC GIẤY IN section right after KPI cards banner
const kpiEndTarget = "{/* Sub-Tabs: Biểu Đồ Ma Trận & Danh Sách Phiếu Nhập */}";

const paperSectionJSX = `
      {/* ========================================================================= */}
      {/* BẢNG GIÁ DANH MỤC GIẤY IN (GIẤY RC BÓNG & GIẤY PP KHỔ 51 -> 111) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-0">
        <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-500 text-slate-950 rounded-xl font-bold shadow-xs">
              <Scroll className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wide text-white flex items-center gap-2">
                <span>DANH MỤC GIẤY IN (GIẤY RC BÓNG & GIẤY PP KHỔ 51 - 111)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {paperMaterials.length} Mã SKU
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Đơn giá chuẩn tính theo cuộn (roll). Tự động cập nhật khi chuyển trạng thái "Hàng đã nhập kho" tại đơn nhập hàng.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {paperSaveSuccess && (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                <Check className="w-3.5 h-3.5" />
                Đã lưu giá giấy thành công!
              </span>
            )}
            {Object.keys(editingPaperPrices).length > 0 && (
              <button
                type="button"
                onClick={handleSavePaperPrices}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu Bảng Giá Giấy ({Object.keys(editingPaperPrices).length} mã)</span>
              </button>
            )}
          </div>
        </div>

        {/* Paper Materials Grid / Table */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Group 1: GIẤY RC BÓNG */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-3 bg-emerald-50/80 border-b border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                  <h4 className="font-black text-xs text-emerald-950 uppercase">
                    1. NHÓM GIẤY RC BÓNG (5 Khổ)
                  </h4>
                </div>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                  NCC Chính: SVP
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                      <th className="py-2 px-3 w-20 font-mono">Mã SKU</th>
                      <th className="py-2 px-3">Tên Giấy In</th>
                      <th className="py-2 px-2 text-center w-16">Khổ</th>
                      <th className="py-2 px-3 text-right w-36">Đơn Giá / Cuộn (đ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paperMaterials.filter(p => p.paperType === 'Giấy RC bóng').map(p => {
                      const curPrice = editingPaperPrices[p.id] !== undefined ? editingPaperPrices[p.id] : p.price;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition">
                          <td className="py-2 px-3 font-mono font-bold text-slate-900 bg-slate-50/60">{p.sku}</td>
                          <td className="py-2 px-3 font-bold text-slate-800">{p.name}</td>
                          <td className="py-2 px-2 text-center font-mono text-slate-600">{p.widthSize}cm</td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              step={1000}
                              value={curPrice || ''}
                              onChange={e => handlePaperPriceChange(p.id, Number(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-xs text-right font-mono font-black text-rose-700 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-emerald-500 outline-none"
                              placeholder="0 đ"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Group 2: GIẤY PP */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-3 bg-blue-50/80 border-b border-blue-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  <h4 className="font-black text-xs text-blue-950 uppercase">
                    2. NHÓM GIẤY PP (5 Khổ)
                  </h4>
                </div>
                <span className="text-[11px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">
                  NCC Phụ: Toản HN
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                      <th className="py-2 px-3 w-20 font-mono">Mã SKU</th>
                      <th className="py-2 px-3">Tên Giấy In</th>
                      <th className="py-2 px-2 text-center w-16">Khổ</th>
                      <th className="py-2 px-3 text-right w-36">Đơn Giá / Cuộn (đ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paperMaterials.filter(p => p.paperType === 'Giấy PP').map(p => {
                      const curPrice = editingPaperPrices[p.id] !== undefined ? editingPaperPrices[p.id] : p.price;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition">
                          <td className="py-2 px-3 font-mono font-bold text-slate-900 bg-slate-50/60">{p.sku}</td>
                          <td className="py-2 px-3 font-bold text-slate-800">{p.name}</td>
                          <td className="py-2 px-2 text-center font-mono text-slate-600">{p.widthSize}cm</td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              step={1000}
                              value={curPrice || ''}
                              onChange={e => handlePaperPriceChange(p.id, Number(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-xs text-right font-mono font-black text-rose-700 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-blue-500 outline-none"
                              placeholder="0 đ"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs: Biểu Đồ Ma Trận & Danh Sách Phiếu Nhập */}
`;

if (!code.includes('DANH MỤC GIẤY IN (GIẤY RC BÓNG & GIẤY PP')) {
  code = code.replace(kpiEndTarget, paperSectionJSX);
}

fs.writeFileSync('src/components/InkInventoryTracking.tsx', code, 'utf8');
console.log('Updated InkInventoryTracking.tsx successfully!');
