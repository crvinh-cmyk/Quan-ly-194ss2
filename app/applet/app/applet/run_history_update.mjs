import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryManagementView.tsx', 'utf8');

const oldHeader = `<tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                    <th className="py-3 px-3 w-12 text-center">STT</th>
                    <th className="py-3 px-3 w-32">Mã Phiếu Nhập</th>
                    <th className="py-3 px-3 w-28">Ngày Nhập</th>
                    <th className="py-3 px-3">Nhà Cung Cấp / Nguồn Hàng</th>
                    <th className="py-3 px-3">Chi Tiết Mặt Hàng Nhập</th>
                    <th className="py-3 px-3 w-32 text-right">Tổng Tiền Nhập</th>
                    <th className="py-3 px-3 w-28 text-center">Thao Tác</th>
                  </tr>`;

const newHeader = `<tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                    <th className="py-3 px-3 w-10 text-center">STT</th>
                    <th className="py-3 px-3 w-28">Mã Phiếu</th>
                    <th className="py-3 px-3 w-24">Ngày Nhập</th>
                    <th className="py-3 px-3 w-40">Nhà Cung Cấp</th>
                    <th className="py-3 px-3">Chi Tiết Mặt Hàng Nhập</th>
                    <th className="py-3 px-3 w-28 text-right">Tổng Tiền</th>
                    <th className="py-3 px-3 w-32 text-center">Trạng Thái</th>
                    <th className="py-3 px-3 w-36 text-center">Thao Tác</th>
                  </tr>`;

if (code.includes(oldHeader)) {
  code = code.replace(oldHeader, newHeader);
}

// Replace row actions in history table to add status column and quick status button
const oldRowAction = `<td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedReceiptDetail(imp)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                              title="Xem chi tiết phiếu nhập"
                            >
                              Xem
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditImport(imp)}
                              className="p-1 rounded-lg bg-slate-100 hover:bg-blue-100 text-blue-600 cursor-pointer transition"
                              title="Chỉnh sửa phiếu nhập này"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {onDeleteStockImport && (
                              <button
                                type="button"
                                onClick={() => setReceiptToDelete(imp)}
                                className="p-1 rounded-lg bg-slate-100 hover:bg-rose-100 text-rose-600 cursor-pointer transition"
                                title="Xóa phiếu nhập này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>`;

const newRowAction = `<td className="py-3 px-3 text-center">
                          {renderImportStatusBadge(imp.status)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {imp.status !== 'completed' && (
                              <button
                                type="button"
                                onClick={() => handleQuickUpdateStatus(imp, 'completed')}
                                className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-[11px] font-bold cursor-pointer transition flex items-center gap-1"
                                title="Bấm để chuyển trạng thái sang Hàng đã nhập kho, tự động cộng tồn kho & cập nhật giá"
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Nhập kho</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedReceiptDetail(imp)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                              title="Xem chi tiết"
                            >
                              Xem
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditImport(imp)}
                              className="p-1 rounded-lg bg-slate-100 hover:bg-blue-100 text-blue-600 cursor-pointer transition"
                              title="Sửa đơn nhập"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {onDeleteStockImport && (
                              <button
                                type="button"
                                onClick={() => setReceiptToDelete(imp)}
                                className="p-1 rounded-lg bg-slate-100 hover:bg-rose-100 text-rose-600 cursor-pointer transition"
                                title="Xóa phiếu"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>`;

if (code.includes(oldRowAction)) {
  code = code.replace(oldRowAction, newRowAction);
}

fs.writeFileSync('src/components/InventoryManagementView.tsx', code, 'utf8');
console.log('History sub-tab table updated successfully!');
