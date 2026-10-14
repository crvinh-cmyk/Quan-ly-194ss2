import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryManagementView.tsx', 'utf8');

const helperTarget = 'export const InventoryManagementView: React.FC';
const helperFunc = `
function renderImportStatusBadge(status?: string) {
  switch (status) {
    case 'pending':
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-600" />
          <span>Chờ xử lý</span>
        </span>
      );
    case 'ordered':
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300 inline-flex items-center gap-1">
          <Truck className="w-3 h-3 text-blue-600" />
          <span>Đã lên đơn</span>
        </span>
      );
    case 'completed':
    default:
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Hàng đã nhập kho</span>
        </span>
      );
  }
}

export const InventoryManagementView: React.FC`;

if (!code.includes('function renderImportStatusBadge')) {
  code = code.replace(helperTarget, helperFunc);
}

const m2_start = '{/* MODAL 2: MANUAL INWARD EXPENSE (Nhập Giá Trị Vật Tư Thủ Công Theo Đợt & NCC) */}';
const m3_start = '{/* MODAL 3: ADJUST / USE STOCK (Xuất dùng / Kiểm kê) */}';

const s_idx = code.indexOf(m2_start);
const e_idx = code.indexOf(m3_start);

if (s_idx !== -1 && e_idx !== -1) {
  const newModal2 = `{/* MODAL 2: CREATING & EDITING STOCK IMPORT / PURCHASE ORDER */}
      {isNewImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-5 sm:p-6 border border-slate-200 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                  <PackagePlus className="w-5 h-5 text-emerald-600" />
                  <span>{editingImportReceipt ? 'Chỉnh Sửa Đơn Nhập Hàng' : 'Tạo Đơn Nhập Hàng & Đồng Bộ Kho'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Quản lý đơn mua vật tư. Khi chọn <strong className="text-emerald-700">"Hàng đã nhập kho"</strong>, hệ thống sẽ tự động cộng tồn kho & cập nhật bảng giá cốt/phụ kiện!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualInwardSubmit} className="space-y-5">
              {/* Order Info & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngày Nhập Hàng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={importDate}
                    onChange={e => setImportDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-bold font-mono outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã Đơn Nhập / Phiếu
                  </label>
                  <input
                    type="text"
                    value={importReceiptCode}
                    onChange={e => setImportReceiptCode(e.target.value)}
                    placeholder="VD: NK-194-2026-001"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono font-bold outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Trạng Thái Đơn Hàng <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={importStatus}
                    onChange={e => setImportStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="pending">⏳ Chờ xử lý (Lên kế hoạch)</option>
                    <option value="ordered">🚚 Đã lên đơn (Chờ NCC giao)</option>
                    <option value="completed">✅ Hàng đã nhập kho (Tự động cộng kho & đồng bộ giá)</option>
                  </select>
                </div>
              </div>

              {/* Status Banner */}
              <div className={\`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 \${
                importStatus === 'completed'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                  : importStatus === 'ordered'
                  ? 'bg-blue-50 border-blue-300 text-blue-900 font-medium'
                  : 'bg-amber-50 border-amber-300 text-amber-900 font-medium'
              }\`}>
                <div className="flex items-center gap-2">
                  {importStatus === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  {importStatus === 'ordered' && <Truck className="w-4 h-4 text-blue-600 shrink-0" />}
                  {importStatus === 'pending' && <Clock className="w-4 h-4 text-amber-600 shrink-0" />}
                  <span>
                    {importStatus === 'completed'
                      ? 'Trạng thái "Hàng đã nhập kho": Khi bấm Lưu, tồn kho sẽ tự động cộng dồn & đơn giá mới sẽ đồng bộ vào Bảng Giá Cốt / Phụ Kiện!'
                      : importStatus === 'ordered'
                      ? 'Trạng thái "Đã lên đơn": Đơn hàng lưu lại lịch sử, chưa cộng tồn kho cho tới khi chuyển sang "Hàng đã nhập kho".'
                      : 'Trạng thái "Chờ xử lý": Lưu nháp kế hoạch nhập hàng.'}
                  </span>
                </div>
              </div>

              {/* Supplier Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Tên Nhà Cung Cấp / Nơi Mua <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-amber-700 font-medium">
                      {inventoryPresets.suppliers.length} NCC Gợi Ý
                    </span>
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={importSupplier}
                  onChange={e => setImportSupplier(e.target.value)}
                  placeholder="Chọn gợi ý bên dưới hoặc tự nhập tên NCC..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:bg-white focus:border-amber-500 transition"
                />
                {/* Quick Pick Supplier Chips */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {inventoryPresets.suppliers.map(s => {
                    const isSelected = importSupplier.trim().toLowerCase() === s.toLowerCase();
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setImportSupplier(s)}
                        className={\`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border \${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-950 border-slate-200 active:scale-95'
                        }\`}
                      >
                        {isSelected ? \`✓ \${s}\` : \`+ \${s}\`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Item Table Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                    DANH SÁCH SẢN PHẨM / VẬT TƯ NHẬP ({importItemsList.length} mặt hàng)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm Dòng Vật Tư</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                        <th className="py-2.5 px-2 w-10 text-center">STT</th>
                        <th className="py-2.5 px-2">Gợi Ý SKU / Mã Vật Tư Kho</th>
                        <th className="py-2.5 px-2">Tên Vật Tư Nhập</th>
                        <th className="py-2.5 px-2 w-20">ĐVT</th>
                        <th className="py-2.5 px-2 w-24 text-center">SL Nhập</th>
                        <th className="py-2.5 px-2 w-32 text-right">Đơn Giá Mới (đ)</th>
                        <th className="py-2.5 px-2 w-32 text-right">Thành Tiền (đ)</th>
                        <th className="py-2.5 px-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importItemsList.map((itemRow, idx) => (
                        <tr key={itemRow.id} className="hover:bg-slate-50/80">
                          <td className="py-2 px-2 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                          <td className="py-2 px-2 min-w-[160px]">
                            <select
                              value={itemRow.materialId || itemRow.materialCode}
                              onChange={e => handleSelectSKUInRow(idx, e.target.value)}
                              className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono outline-none focus:bg-white focus:border-amber-500 cursor-pointer"
                            >
                              <option value="">-- Chọn SKU có sẵn --</option>
                              {availableSKUsList.map(sku => (
                                <option key={sku.id} value={sku.id}>
                                  [{sku.code}] {sku.name} ({sku.category})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              required
                              value={itemRow.materialName}
                              onChange={e => handleUpdateRowField(idx, 'materialName', e.target.value)}
                              placeholder="Tên vật tư..."
                              className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 outline-none focus:bg-white focus:border-amber-500"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              required
                              value={itemRow.unit}
                              onChange={e => handleUpdateRowField(idx, 'unit', e.target.value)}
                              className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-center font-bold outline-none"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min={1}
                              required
                              value={itemRow.quantity}
                              onChange={e => handleUpdateRowField(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-center font-mono font-bold text-emerald-700 outline-none focus:bg-white"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <MoneyInput
                              value={itemRow.costPrice}
                              onChange={val => handleUpdateRowField(idx, 'costPrice', val)}
                              className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-right font-mono font-bold text-slate-900 outline-none focus:bg-white"
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-black text-rose-700 text-xs">
                            {formatCurrency(itemRow.totalCost)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {importItemsList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer"
                                title="Xóa dòng này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Order Amount Summary Bar */}
              <div className="p-3.5 bg-amber-50/80 border-2 border-amber-300 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-amber-900">Tổng Số Lượng:</span>{' '}
                  <span className="font-mono font-black text-sm text-slate-900">
                    {importItemsList.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)}
                  </span>{' '}
                  <span className="text-xs text-slate-500">mặt hàng</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-amber-950">
                    TỔNG TIỀN ĐƠN NHẬP (VNĐ):
                  </span>
                  <span className="text-xl font-black font-mono text-rose-700">
                    {formatCurrency(importItemsList.reduce((sum, it) => sum + (it.totalCost || 0), 0))}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi Chú Đơn Nhập</label>
                <input
                  type="text"
                  value={importNotes}
                  onChange={e => setImportNotes(e.target.value)}
                  placeholder="Ghi chú hóa đơn VAT, thời gian giao hàng, hình thức thanh toán..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewImportModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/20 transition cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingImportReceipt ? 'Cập Nhật Đơn Nhập' : 'Lưu Đơn Nhập Hàng & Đồng Bộ'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}`;

  code = code.slice(0, s_idx) + newModal2 + code.slice(e_idx);
}

fs.writeFileSync('src/components/InventoryManagementView.tsx', code, 'utf8');
console.log('Update executed successfully!');
