import React, { useState } from 'react';
import { WorkshopInfo } from '../types';
import {
  ShoppingCart, FileText, BarChart3, Tag, Users, Settings, Database, Boxes,
  Cloud, CloudCheck, RefreshCw, LogOut, UserCircle2, User, FileSpreadsheet
} from 'lucide-react';
import { isPartnerMode } from '../utils/partnerConfig';

export type ActiveTab = 'pos' | 's1a' | 'orders' | 'inventory' | 'analytics' | 'products' | 'customers';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  workshop: WorkshopInfo;
  onOpenSettings: () => void;
  onOpenDataManagement: () => void;
  ordersCount: number;
  lowStockCount?: number;
  firestoreStatus?: 'connected' | 'syncing' | 'offline';
  currentUserEmail?: string | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  workshop,
  onOpenSettings,
  onOpenDataManagement,
  ordersCount,
  lowStockCount = 0,
  firestoreStatus = 'connected',
  currentUserEmail,
  onLogout
}) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isPartner = isPartnerMode();

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    if (onLogout) onLogout();
  };
  return (
    <header className="bg-slate-900 text-white sticky top-0 z-40 shadow-lg border-b border-slate-800 no-print">
      <div className="w-full px-3 sm:px-5 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Brand & Logo */}
          <div className="flex items-center gap-3">
            <div
              onClick={() => setActiveTab('pos')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 flex items-center justify-center text-slate-950 font-black text-xl shadow-md group-hover:scale-105 transition-transform">
                194
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-base tracking-tight text-white uppercase group-hover:text-amber-400 transition-colors">
                    {workshop.name}
                  </h1>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Cloud className="w-3 h-3 text-emerald-400 animate-pulse" />
                    Cloud Firestore
                  </span>
                </div>
                <p className="hidden md:block text-[11px] text-slate-400 font-medium">
                  Hệ thống quản lý bán hàng & in ảnh đồng bộ trực tuyến
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {/* Tab 1: POS / Bán Hàng */}
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === 'pos'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Bán Hàng</span>
            </button>

            {/* Tab Phụ: Theo dõi doanh thu mẫu S1a (Chỉ hiển thị khi ở chế độ Partner View) */}
            {isPartnerMode() && (
              <button
                onClick={() => setActiveTab('s1a')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  activeTab === 's1a'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-amber-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Sổ theo dõi doanh thu mẫu S1a chuẩn Thông tư số 152/2025/TT-BTC"
              >
                <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                <span>Theo dõi doanh thu mẫu s1a</span>
              </button>
            )}

            {/* Tab 2: Danh Sách Đơn (ẨN HOÀN TOÀN Ở BẢN ĐỐI TÁC) */}
            {!isPartnerMode() && (
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  activeTab === 'orders'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Đơn Hàng</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === 'orders' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'
                }`}>
                  {ordersCount}
                </span>
              </button>
            )}

            {/* Tab 3: Kho & Nhập Liệu (Ẩn ở bản đối tác) */}
            {!isPartner && (
              <button
                onClick={() => setActiveTab('inventory')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 relative ${
                  activeTab === 'inventory'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Boxes className="w-4 h-4" />
                <span>Kho Vật Tư</span>
                {lowStockCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-rose-500 text-white animate-pulse">
                    {lowStockCount}
                  </span>
                )}
              </button>
            )}

            {/* Tab 4: Thống Kê Lời Lãi */}
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === 'analytics'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Thống Kê & Lời Lãi</span>
            </button>

            {/* Tab 5: Bảng Giá & Mã SP */}
            <button
              onClick={() => setActiveTab('products')}
              className={`${isPartner ? 'flex' : 'hidden md:flex'} items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === 'products'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>Bảng Giá Mã SP</span>
            </button>

            {/* Tab 6: Khách Hàng & Sổ Nợ (Hiển thị cả bản gốc và bản đối tác - loại trừ khách đã khóa) */}
            <button
              onClick={() => setActiveTab('customers')}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === 'customers'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Khách & Sổ Nợ</span>
            </button>
          </nav>

          {/* Right Tools: User info + Data Management + Settings + Logout */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* User Account / Email Badge */}
            {currentUserEmail && (
              <div
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs text-slate-300 max-w-[170px]"
                title={`Tài khoản đang đăng nhập: ${currentUserEmail}`}
              >
                <div className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                  {currentUserEmail.charAt(0).toUpperCase()}
                </div>
                <span className="truncate font-medium text-[11px] text-slate-200">
                  {currentUserEmail.split('@')[0]}
                </span>
              </div>
            )}

            {/* Clear / Seed Data Management Button (Ẩn ở bản đối tác) */}
            {!isPartner && (
              <button
                onClick={onOpenDataManagement}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer"
                title="Đồng bộ đám mây, sao lưu hoặc nạp dữ liệu"
              >
                <Database className="w-4 h-4 text-amber-400" />
                <span className="hidden lg:inline text-[11px]">Đồng Bộ</span>
              </button>
            )}

            {/* Workshop Settings Modal (Ẩn ở bản đối tác) */}
            {!isPartner && (
              <button
                onClick={onOpenSettings}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                title="Cài đặt tiệm in & Sao lưu dữ liệu"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}

            {/* Logout Button */}
            {onLogout && (
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                title="Đăng xuất khỏi tài khoản"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal Overlay */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto ring-4 ring-rose-500/20">
              <LogOut className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                Xác nhận Đăng xuất?
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Bạn có chắc chắn muốn đăng xuất tài khoản <strong className="text-amber-400 font-mono">{currentUserEmail || 'này'}</strong> không? Giao diện sẽ được khóa lại.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition cursor-pointer"
              >
                Đăng xuất ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
