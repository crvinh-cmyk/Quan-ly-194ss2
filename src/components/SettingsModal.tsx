import React, { useState } from 'react';
import { WorkshopInfo } from '../types';
import { Settings, Check, Building2, Phone, MapPin } from 'lucide-react';

interface SettingsModalProps {
  workshop: WorkshopInfo;
  onUpdateWorkshop: (info: WorkshopInfo) => void;
  onReloadAllData?: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  workshop,
  onUpdateWorkshop,
  onClose
}) => {
  const [name, setName] = useState(workshop.name);
  const [subtitle, setSubtitle] = useState(workshop.subtitle);
  const [phone, setPhone] = useState(workshop.phone);
  const [hotline, setHotline] = useState(workshop.hotline);
  const [address, setAddress] = useState(workshop.address);

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveInfo = () => {
    onUpdateWorkshop({
      name: name.trim(),
      subtitle: subtitle.trim(),
      phone: phone.trim(),
      hotline: hotline.trim(),
      address: address.trim(),
      zalo: phone.trim(),
      bankAccount: workshop.bankAccount
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <Settings className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-sm">Cài Đặt Tiệm In 194</h3>
              <p className="text-xs text-slate-400">Thông tin xuất hiện trên hóa đơn và phiếu in</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              Đã cập nhật và lưu thông tin tiệm lên Cloud Firestore thành công!
            </div>
          )}

          {/* Workshop Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-amber-600" />
              Thông Tin Thương Hiệu Tiệm In
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên tiệm in</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">SĐT Hotline / Zalo</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Slogan / Dịch vụ chính</label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Địa chỉ xưởng in</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>
            </div>
            <button
              onClick={handleSaveInfo}
              className="mt-4 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              Lưu Thông Tin Lên Cloud
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
