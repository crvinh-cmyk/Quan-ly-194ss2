import React, { useState } from 'react';
import { Product, Customer, Order, Material, StockImportReceipt, StudioCombo, WorkshopInfo } from '../types';
import {
  saveProductToFirestore,
  saveCustomerToFirestore,
  deleteCustomerFromFirestore,
  saveOrderToFirestore,
  deleteOrderFromFirestore,
  saveMaterialToFirestore,
  deleteMaterialFromFirestore,
  savePurchaseToFirestore,
  clearAllPurchasesFromFirestore,
  saveComboToFirestore,
  saveWorkshopInfoToFirestore,
  AuthUserContext
} from '../services/firestoreService';
import {
  Trash2, Database, Download, AlertTriangle, CheckCircle2,
  X, Upload, Copy, Check, FileCode, Cloud, CheckCircle
} from 'lucide-react';

interface DataManagementModalProps {
  orders: Order[];
  customers: Customer[];
  products: Product[];
  materials: Material[];
  stockImports: StockImportReceipt[];
  combos: StudioCombo[];
  workshop: WorkshopInfo;
  userContext?: AuthUserContext | null;
  onClose: () => void;
}

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  orders,
  customers,
  products,
  materials,
  stockImports,
  combos,
  workshop,
  userContext,
  onClose
}) => {
  const [confirmStep, setConfirmStep] = useState<null | 'clearOrders' | 'clearInventory'>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCopiedCode, setIsCopiedCode] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const [pasteError, setPasteError] = useState('');

  // 1. Xuất file backup JSON từ dữ liệu Cloud hiện tại
  const handleBackup = () => {
    const backupData = {
      version: '2.0-cloud',
      exportedAt: new Date().toISOString(),
      workshop,
      products,
      customers,
      orders,
      materials,
      stockImports,
      combos
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tiemin194_cloud_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSuccessMessage('Đã tải xuống file sao lưu .json thành công!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // 2. Tạo mã nguồn initialData.ts để đồng bộ sang GitHub / Vercel
  const generateCode = (): string => {
    return `import { Product, Customer, Order, WorkshopInfo, Material, StockImportReceipt, StudioCombo } from '../types';

export const DEFAULT_WORKSHOP_INFO: WorkshopInfo = ${JSON.stringify(workshop, null, 2)};

export const DEFAULT_PRODUCTS: Product[] = ${JSON.stringify(products, null, 2)};

export const DEFAULT_CUSTOMERS: Customer[] = ${JSON.stringify(customers, null, 2)};

export const DEFAULT_ORDERS: Order[] = ${JSON.stringify(orders, null, 2)};

export const DEFAULT_MATERIALS: Material[] = ${JSON.stringify(materials, null, 2)};

export const DEFAULT_STOCK_IMPORTS: StockImportReceipt[] = ${JSON.stringify(stockImports, null, 2)};

export const DEFAULT_COMBOS: StudioCombo[] = ${JSON.stringify(combos, null, 2)};
`;
  };

  const handleDownloadInitialData = () => {
    const tsContent = generateCode();
    const blob = new Blob([tsContent], { type: 'text/typescript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'initialData.ts';
    a.click();
    URL.revokeObjectURL(url);
    setSuccessMessage('Đã tải xuống file initialData.ts chứa dữ liệu hiện tại!');
    setTimeout(() => setSuccessMessage(''), 3500);
  };

  const handleCopyInitialDataCode = () => {
    const code = generateCode();
    navigator.clipboard.writeText(code).then(() => {
      setIsCopiedCode(true);
      setSuccessMessage('Đã sao chép toàn bộ mã nguồn initialData.ts vào bộ nhớ tạm!');
      setTimeout(() => setIsCopiedCode(false), 2500);
      setTimeout(() => setSuccessMessage(''), 3500);
    }).catch(() => {
      setErrorMessage('Không thể sao chép, vui lòng dùng nút Tải file.');
    });
  };

  // 3. Khôi phục / Nhập dữ liệu từ file JSON trực tiếp lên Firestore
  const processImportData = async (jsonString: string): Promise<boolean> => {
    try {
      setIsProcessing(true);
      const data = JSON.parse(jsonString);

      if (data.workshop) {
        await saveWorkshopInfoToFirestore(data.workshop, userContext);
      }
      if (Array.isArray(data.products)) {
        for (const p of data.products) {
          await saveProductToFirestore(p, userContext);
        }
      }
      if (Array.isArray(data.customers)) {
        for (const c of data.customers) {
          await saveCustomerToFirestore(c, userContext);
        }
      }
      if (Array.isArray(data.orders)) {
        for (const o of data.orders) {
          await saveOrderToFirestore(o, userContext);
        }
      }
      if (Array.isArray(data.materials)) {
        for (const m of data.materials) {
          await saveMaterialToFirestore(m, userContext);
        }
      }
      if (Array.isArray(data.stockImports)) {
        for (const imp of data.stockImports) {
          await savePurchaseToFirestore(imp, userContext);
        }
      }
      if (Array.isArray(data.combos)) {
        for (const cb of data.combos) {
          await saveComboToFirestore(cb, userContext);
        }
      }

      setSuccessMessage('Đã nhập và đồng bộ trực tiếp lên Cloud Firestore thành công!');
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 1800);
      return true;
    } catch (e: any) {
      console.error('Import error:', e);
      setErrorMessage('Lỗi đọc dữ liệu: Định dạng file sao lưu không hợp lệ!');
      setTimeout(() => setErrorMessage(''), 3500);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        await processImportData(content);
      }
    };
    reader.readAsText(file);
  };

  const handleImportPastedJson = async () => {
    if (!pastedJson.trim()) {
      setPasteError('Vui lòng dán chuỗi JSON dữ liệu vào ô');
      return;
    }
    const ok = await processImportData(pastedJson.trim());
    if (ok) {
      setIsPasteModalOpen(false);
      setPastedJson('');
    } else {
      setPasteError('Lỗi cú pháp: Định dạng JSON không hợp lệ!');
    }
  };

  // 4. Xóa toàn bộ đơn hàng & công nợ TRỰC TIẾP trên Cloud Firestore
  const handleClearOrdersOnly = async () => {
    try {
      setIsProcessing(true);
      for (const o of orders) {
        await deleteOrderFromFirestore(o.id);
      }
      for (const c of customers) {
        if (c.initialDebt !== 0) {
          await saveCustomerToFirestore({ ...c, initialDebt: 0 }, userContext);
        }
      }
      setConfirmStep(null);
      setSuccessMessage('Đã xóa sạch toàn bộ đơn hàng và đưa công nợ về 0đ trên Cloud!');
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 1500);
    } catch (e) {
      console.error(e);
      setErrorMessage('Lỗi khi xóa đơn hàng trên Cloud!');
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Xóa toàn bộ kho vật tư & phiếu nhập TRỰC TIẾP trên Cloud Firestore
  const handleClearInventoryOnly = async () => {
    try {
      setIsProcessing(true);
      for (const m of materials) {
        await deleteMaterialFromFirestore(m.id);
      }
      await clearAllPurchasesFromFirestore();
      setConfirmStep(null);
      setSuccessMessage('Đã xóa sạch toàn bộ vật tư và phiếu nhập trên Cloud Firestore!');
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 1500);
    } catch (e) {
      console.error(e);
      setErrorMessage('Lỗi khi xóa dữ liệu kho trên Cloud!');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <Database className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-sm">Quản Lý & Đồng Bộ Dữ Liệu Cloud Firestore</h3>
              <p className="text-xs text-slate-400">Sao lưu, phục hồi và đồng bộ mã nguồn an toàn</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thông báo trạng thái */}
        {successMessage && (
          <div className="bg-emerald-500 text-white px-4 py-2.5 text-xs font-bold flex items-center gap-2 shadow-inner">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="bg-rose-600 text-white px-4 py-2.5 text-xs font-bold flex items-center gap-2 shadow-inner">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-700">
          {/* SECTION 0: TRẠNG THÁI CLOUD FIRESTORE */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-slate-50 border-2 border-emerald-400/80 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-600 text-white rounded-lg">
                  <Cloud className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="font-black text-sm text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                    <span>Đồng Bộ Trực Tuyến Cloud Firestore</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white animate-pulse">
                      Real-time 100%
                    </span>
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Toàn bộ đơn hàng ({orders.length}), khách ({customers.length}), sản phẩm ({products.length}), vật tư ({materials.length}), phiếu nhập ({stockImports.length}) được lưu trữ trực tiếp trên Cloud.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">Cơ chế thời gian thực chuẩn sản xuất:</p>
                <p className="text-[11px] text-slate-600">
                  Mọi thao tác Thêm, Sửa, Xóa đều tác động trực tiếp lên Firestore qua <code>onSnapshot</code>. Dữ liệu trên mọi thiết bị và trình duyệt khác tự động cập nhật ngay lập tức.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 1: ĐỒNG BỘ SANG GITHUB & VERCEL */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-50 border-2 border-amber-400/80 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-500 text-slate-950 rounded-lg">
                  <FileCode className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="font-black text-sm text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                    <span>Đồng Bộ Sang GitHub & Vercel</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                      Mã Nguồn
                    </span>
                  </h4>
                  <p className="text-xs text-slate-600">
                    Xuất toàn bộ dữ liệu hiện tại thành file mã nguồn initialData.ts để đưa vào GitHub repo khi cần.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDownloadInitialData}
                className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>1. Tải File initialData.ts</span>
              </button>

              <button
                type="button"
                onClick={handleCopyInitialDataCode}
                className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                {isCopiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{isCopiedCode ? 'Đã sao chép code!' : '2. Sao Chép Mã Nguồn'}</span>
              </button>
            </div>
          </div>

          {/* SECTION 2: SAO LƯU & KHÔI PHỤC FILE JSON */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                  Sao Lưu & Khôi Phục JSON
                </h4>
              </div>
              <span className="text-[11px] text-slate-500">Đồng bộ trực tiếp lên Cloud Firestore</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleBackup}
                disabled={isProcessing}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Xuất file .json</span>
              </button>

              <label className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer flex items-center justify-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nhập file .json</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  disabled={isProcessing}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => setIsPasteModalOpen(true)}
                disabled={isProcessing}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <FileCode className="w-3.5 h-3.5 text-amber-600" />
                <span>Dán mã JSON</span>
              </button>
            </div>
          </div>

          {/* SECTION 3: THAO TÁC XÓA DỮ LIỆU */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Quản Trị Dữ Liệu
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col justify-between gap-2">
                <div>
                  <h5 className="font-bold text-xs text-slate-900">Xóa hết đơn hàng & công nợ</h5>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Đưa đơn hàng về 0 để bắt đầu năm mới (giữ nguyên bảng giá & danh bạ khách hàng).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmStep('clearOrders')}
                  disabled={isProcessing || orders.length === 0}
                  className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa đơn hàng ({orders.length})
                </button>
              </div>

              <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/40 flex flex-col justify-between gap-2">
                <div>
                  <h5 className="font-bold text-xs text-slate-900">Xóa hết kho & phiếu nhập</h5>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Xóa toàn bộ vật tư kho và lịch sử phiếu nhập hàng trên Cloud để tạo mới từ đầu.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmStep('clearInventory')}
                  disabled={isProcessing || (materials.length === 0 && stockImports.length === 0)}
                  className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa sạch kho ({materials.length} VT)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Dán JSON */}
        {isPasteModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-3 border border-slate-200 animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-900">Dán Dữ Liệu Sao Lưu JSON Lên Cloud</h4>
                <button
                  type="button"
                  onClick={() => setIsPasteModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Dán chuỗi JSON sao lưu để nhập trực tiếp lên Cloud Firestore:
              </p>
              <textarea
                value={pastedJson}
                onChange={(e) => {
                  setPastedJson(e.target.value);
                  setPasteError('');
                }}
                rows={6}
                placeholder="Dán nội dung JSON vào đây..."
                className="w-full p-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              />
              {pasteError && (
                <p className="text-xs text-rose-600 font-bold">{pasteError}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsPasteModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleImportPastedJson}
                  disabled={isProcessing}
                  className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-xs cursor-pointer"
                >
                  {isProcessing ? 'Đang tải...' : 'Nạp Lên Cloud'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal Overlay */}
        {confirmStep && (
          <div className="p-4 bg-slate-900 text-white border-t border-slate-800 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-xs uppercase tracking-wider text-amber-400">
                  Xác nhận hành động trên Cloud Firestore
                </h5>
                <p className="text-xs text-slate-300 mt-0.5">
                  {confirmStep === 'clearOrders' &&
                    'Bạn có chắc chắn muốn XÓA TOÀN BỘ ĐƠN HÀNG trên Cloud Firestore và đưa số nợ cũ của khách về 0? Hành động này không thể hoàn tác.'}
                  {confirmStep === 'clearInventory' &&
                    'CẢNH BÁO: Bạn có chắc chắn muốn XÓA HẾT TOÀN BỘ VẬT TƯ KHO và lịch sử phiếu nhập hàng trên Cloud Firestore?'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmStep(null)}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Hủy bỏ
              </button>
              {confirmStep === 'clearOrders' && (
                <button
                  type="button"
                  onClick={handleClearOrdersOnly}
                  disabled={isProcessing}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-xs"
                >
                  {isProcessing ? 'Đang xóa...' : 'Đồng ý xóa đơn & nợ'}
                </button>
              )}
              {confirmStep === 'clearInventory' && (
                <button
                  type="button"
                  onClick={handleClearInventoryOnly}
                  disabled={isProcessing}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-xs"
                >
                  {isProcessing ? 'Đang xóa...' : 'Xác nhận xóa hết kho'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
