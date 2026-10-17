import React, { useState, useMemo } from 'react';
import { Order, OrderStatus } from '../types';
import { formatCurrency, formatDateVN } from '../utils/formatters';
import {
  Search, Printer, Trash2, DollarSign, Edit3
} from 'lucide-react';

interface OrderListProps {
  orders: Order[];
  onViewOrder: (order: Order) => void;
  onPrintOrder: (order: Order) => void;
  onEditOrder: (order: Order) => void;
  onDeleteOrder: (orderId: string) => void;
  onUpdateStatus?: (orderId: string, newStatus: OrderStatus) => void;
  onPayDebt: (order: Order) => void;
}

export const OrderList: React.FC<OrderListProps> = ({
  orders,
  onViewOrder,
  onPrintOrder,
  onEditOrder,
  onDeleteOrder,
  onUpdateStatus,
  onPayDebt
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  // Available years from existing orders
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      const y = new Date(o.date).getFullYear();
      if (!isNaN(y)) set.add(y.toString());
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Keyword search
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchNumber = order.orderNumber.toLowerCase().includes(q);
        const matchCustomer = order.customerName.toLowerCase().includes(q) || (order.guestName && order.guestName.toLowerCase().includes(q));
        const matchPhone = order.customerPhone.includes(q);
        const matchItem = order.items.some(it =>
          it.productCode.toLowerCase().includes(q) ||
          it.productName.toLowerCase().includes(q) ||
          it.size.toLowerCase().includes(q)
        );
        if (!matchNumber && !matchCustomer && !matchPhone && !matchItem) return false;
      }

      // Year & Month
      const d = new Date(order.date);
      if (yearFilter !== 'all' && d.getFullYear().toString() !== yearFilter) return false;
      if (monthFilter !== 'all' && (d.getMonth() + 1).toString() !== monthFilter) return false;

      return true;
    });
  }, [orders, searchTerm, yearFilter, monthFilter]);

  // Filtered totals
  const totalSubtotal = filteredOrders.reduce((sum, o) => sum + (o.subtotal - (o.discount || 0)), 0);
  const totalPaid = filteredOrders.reduce((sum, o) => sum + (o.paid || 0), 0);
  const totalDueRemaining = filteredOrders.reduce((sum, o) => sum + (o.totalDue || 0), 0);

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã đơn (194-2026-...), tên Studio, SĐT, mã sản phẩm (EG, TG...)..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          {/* Year Filter */}
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-amber-500 outline-hidden"
          >
            <option value="all">Tất cả các năm</option>
            {availableYears.map(y => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>

          {/* Month Filter */}
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-amber-500 outline-hidden"
          >
            <option value="all">Tất cả các tháng</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={(i + 1).toString()}>Tháng {i + 1}</option>
            ))}
          </select>
        </div>

        {/* Quick summary of filtered results */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
          <div>
            Tìm thấy <strong className="text-slate-900">{filteredOrders.length}</strong> đơn hàng
          </div>
          <div className="flex items-center gap-4">
            <span>Tiền hàng: <strong className="text-slate-900 font-mono">{formatCurrency(totalSubtotal)}</strong></span>
            <span>Đã thu: <strong className="text-emerald-700 font-mono">{formatCurrency(totalPaid)}</strong></span>
            <span>Còn nợ: <strong className="text-red-600 font-mono font-bold">{formatCurrency(totalDueRemaining)}</strong></span>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                <th className="py-3 px-3 w-28">Mã đơn</th>
                <th className="py-3 px-2.5 w-24 text-center">Ngày tạo</th>
                <th className="py-3 px-3">Khách hàng / Studio</th>
                <th className="py-3 px-3 min-w-[200px]">Chi tiết sản phẩm</th>
                <th className="py-3 px-3 text-right w-28">Tiền hàng</th>
                <th className="py-3 px-3 text-right w-24">Nợ cũ</th>
                <th className="py-3 px-3 text-right w-28">Cần TT</th>
                <th className="py-3 px-3 text-right w-44">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredOrders.length > 0 ? (
                filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    {/* Order Number */}
                    <td className="py-3 px-3 font-mono font-bold text-amber-900">
                      {order.orderNumber}
                    </td>

                    {/* Date */}
                    <td className="py-3 px-2.5 text-center font-mono text-[11px] text-slate-600">
                      <div>{formatDateVN(order.date)}</div>
                      {(() => {
                        const suppItems = (order.items || []).filter(it => it.date && it.date !== order.date);
                        if (suppItems.length > 0) {
                          const latestDate = suppItems.map(it => it.date).sort().reverse()[0];
                          return (
                            <span
                              className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200"
                              title={`Có ${suppItems.length} sản phẩm bổ sung ngày ${formatDateVN(latestDate)}`}
                            >
                              + Bổ sung {formatDateVN(latestDate).slice(0, 5)}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </td>

                    {/* Customer */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>{order.customerName}</span>
                      </div>
                      {order.guestName && (
                        <div className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1 mt-0.5">
                          <span>Tên gửi khách:</span>
                          <span className="font-bold underline">{order.guestName}</span>
                        </div>
                      )}
                      <div className="text-[11px] text-slate-500 font-mono">{order.customerPhone || 'Chưa có SĐT'}</div>
                    </td>

                    {/* Items preview */}
                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        {order.items.slice(0, 2).map((item, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-slate-700">
                            <span className="font-mono text-[10px] font-bold px-1 rounded bg-slate-200 text-slate-800">
                              {item.productCode}
                            </span>
                            <span className="truncate max-w-[140px] text-slate-800 font-medium">
                              {item.productName} ({item.size})
                            </span>
                            <span className="text-slate-500 font-bold">x{item.quantity}</span>
                          </div>
                        ))}
                        {order.items.length > 2 && (
                          <span className="text-[10px] text-amber-700 font-semibold">
                            +{order.items.length - 2} sản phẩm khác...
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Subtotal */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                      {formatCurrency(order.subtotal - (order.discount || 0))}
                    </td>

                    {/* Previous Debt */}
                    <td className="py-3 px-3 text-right font-mono text-slate-600">
                      {order.previousDebt > 0 ? (
                        <span className="text-amber-800 font-semibold">{formatCurrency(order.previousDebt)}</span>
                      ) : '-'}
                    </td>

                    {/* Total Due */}
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-red-600">
                      {order.totalDue > 0 ? (
                        <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200">
                          {formatCurrency(order.totalDue)}
                        </span>
                      ) : (
                        <span className="text-emerald-700 text-xs font-semibold">Đã đủ 0đ</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onEditOrder(order)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer shadow-2xs shrink-0"
                          title="Bổ sung / Chỉnh sửa đơn hàng này"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Bổ sung</span>
                        </button>
                        {order.totalDue > 0 && (
                          <button
                            type="button"
                            onClick={() => onPayDebt(order)}
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                            title="Thu nợ nhanh đơn này"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onPrintOrder(order)}
                          className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                          title="In phiếu giao hàng"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrderToDelete(order)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Xóa đơn hàng"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-400">
                    Không tìm thấy đơn hàng nào phù hợp với điều kiện lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Order In-App Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in duration-150">
            <div className="p-4 bg-red-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-white" />
                <h3 className="font-bold text-sm">Xóa Đơn Hàng</h3>
              </div>
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-2 text-xs text-slate-600">
              <p>Bạn có chắc chắn muốn xóa đơn hàng này?</p>
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Mã đơn:</span>
                  <span className="font-mono font-bold text-red-700">{orderToDelete.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Khách hàng:</span>
                  <span className="font-bold text-slate-900">{orderToDelete.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tổng tiền:</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(orderToDelete.subtotal)}</span>
                </div>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteOrder(orderToDelete.id);
                  setOrderToDelete(null);
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
