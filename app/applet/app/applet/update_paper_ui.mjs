import fs from 'fs';

// 1. Update DEFAULT_PAPER_MATERIALS in firestoreService.ts
let serviceCode = fs.readFileSync('src/services/firestoreService.ts', 'utf8');

serviceCode = serviceCode.replace(/supplier:\s*'Toản HN'/g, "supplier: 'SVP'");

fs.writeFileSync('src/services/firestoreService.ts', serviceCode, 'utf8');
console.log('Updated firestoreService.ts suppliers to SVP');

// 2. Update InkInventoryTracking.tsx to place DANH MỤC GIẤY IN right above header / top of return
let inkCode = fs.readFileSync('src/components/InkInventoryTracking.tsx', 'utf8');

const returnTarget = "return (\n    <div className=\"space-y-6\">";

const paperSectionJSX = `return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* SECTION 1: BẢNG DANH MỤC GIẤY IN (GIẤY RC BÓNG & GIẤY PP KHỔ 51 -> 111) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden space-y-0">
        {/* Section Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 rounded-2xl font-bold shadow-md">
              <Scroll className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-lg uppercase tracking-wide text-white">
                  DANH MỤC GIẤY IN (GIẤY RC BÓNG & GIẤY PP)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {paperMaterials.length} MÃ SKU
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-400 text-slate-950">
                  NCC CHÍNH: SVP
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Đơn giá tính theo cuộn (roll). Tự động đồng bộ & làm mới giá khi chuyển trạng thái "Hàng đã nhập kho" tại đơn nhập hàng.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {paperSaveSuccess && (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/80 px-3 py-1.5 rounded-xl border border-emerald-500/40">
                <Check className="w-4 h-4" />
                Đã lưu bảng giá giấy thành công!
              </span>
            )}
            <button
              type="button"
              onClick={handleSavePaperPrices}
              className={\`px-4 py-2 text-xs font-black rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5 \${
                Object.keys(editingPaperPrices).length > 0
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 ring-2 ring-emerald-300 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }\`}
            >
              <Save className="w-4 h-4" />
              <span>
                {Object.keys(editingPaperPrices).length > 0
                  ? \`Lưu Thay Đổi (\${Object.keys(editingPaperPrices).length} mã)\`
                  : 'Lưu Bảng Giá Giấy'}
              </span>
            </button>
          </div>
        </div>

        {/* Paper Tables Grid */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* GROUP 1: GIẤY RC BÓNG */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3.5 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
                  <h4 className="font-black text-xs text-emerald-950 uppercase tracking-wide">
                    1. NHÓM GIẤY RC BÓNG (5 Khổ)
                  </h4>
                </div>
                <span className="text-[11px] font-extrabold text-emerald-900 bg-emerald-100/90 px-2.5 py-0.5 rounded-md border border-emerald-300">
                  NCC Chính: SVP
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                      <th className="py-2.5 px-3 w-24 font-mono">Mã SKU</th>
                      <th className="py-2.5 px-3">Tên Vật Tư Giấy</th>
                      <th className="py-2.5 px-3 text-right w-36">Đơn Giá (đ/roll)</th>
                      <th className="py-2.5 px-3 text-center w-36">Ngày Sửa Giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paperMaterials.filter(p => p.paperType === 'Giấy RC bóng').map(p => {
                      const curPrice = editingPaperPrices[p.id] !== undefined ? editingPaperPrices[p.id] : p.price;
                      const isEdited = editingPaperPrices[p.id] !== undefined;
                      return (
                        <tr key={p.id} className="hover:bg-amber-50/40 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 bg-slate-50/80">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-950 border border-emerald-200">
                              {p.sku}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{p.name}</div>
                            <div className="text-[10px] text-slate-400">Khổ {p.widthSize}cm • ĐVT: roll (Cuộn)</div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              step={1000}
                              value={curPrice || ''}
                              onChange={e => handlePaperPriceChange(p.id, Number(e.target.value) || 0)}
                              className={\`w-full px-2.5 py-1 text-xs text-right font-mono font-black rounded-lg border outline-none transition \${
                                isEdited
                                  ? 'bg-amber-50 border-amber-400 text-amber-950 ring-2 ring-amber-200'
                                  : 'bg-slate-50 border-slate-300 text-rose-700 focus:bg-white focus:border-emerald-500'
                              }\`}
                              placeholder="0 đ"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500">
                            {p.updatedAt || 'Chuẩn Mặc Định'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* GROUP 2: GIẤY PP */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3.5 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                  <h4 className="font-black text-xs text-blue-950 uppercase tracking-wide">
                    2. NHÓM GIẤY PP (5 Khổ)
                  </h4>
                </div>
                <span className="text-[11px] font-extrabold text-blue-900 bg-blue-100/90 px-2.5 py-0.5 rounded-md border border-blue-300">
                  NCC Chính: SVP
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                      <th className="py-2.5 px-3 w-24 font-mono">Mã SKU</th>
                      <th className="py-2.5 px-3">Tên Vật Tư Giấy</th>
                      <th className="py-2.5 px-3 text-right w-36">Đơn Giá (đ/roll)</th>
                      <th className="py-2.5 px-3 text-center w-36">Ngày Sửa Giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paperMaterials.filter(p => p.paperType === 'Giấy PP').map(p => {
                      const curPrice = editingPaperPrices[p.id] !== undefined ? editingPaperPrices[p.id] : p.price;
                      const isEdited = editingPaperPrices[p.id] !== undefined;
                      return (
                        <tr key={p.id} className="hover:bg-amber-50/40 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 bg-slate-50/80">
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-950 border border-blue-200">
                              {p.sku}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{p.name}</div>
                            <div className="text-[10px] text-slate-400">Khổ {p.widthSize}cm • ĐVT: roll (Cuộn)</div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              step={1000}
                              value={curPrice || ''}
                              onChange={e => handlePaperPriceChange(p.id, Number(e.target.value) || 0)}
                              className={\`w-full px-2.5 py-1 text-xs text-right font-mono font-black rounded-lg border outline-none transition \${
                                isEdited
                                  ? 'bg-amber-50 border-amber-400 text-amber-950 ring-2 ring-amber-200'
                                  : 'bg-slate-50 border-slate-300 text-rose-700 focus:bg-white focus:border-blue-500'
                              }\`}
                              placeholder="0 đ"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500">
                            {p.updatedAt || 'Chuẩn Mặc Định'}
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
      </div>`;

if (inkCode.includes(returnTarget)) {
  inkCode = inkCode.replace(returnTarget, paperSectionJSX);
  fs.writeFileSync('src/components/InkInventoryTracking.tsx', inkCode, 'utf8');
  console.log('Updated InkInventoryTracking.tsx with DANH MỤC GIẤY IN table!');
} else {
  console.log('returnTarget not found in InkInventoryTracking.tsx');
}
