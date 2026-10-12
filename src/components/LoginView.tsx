import React, { useState } from 'react';
import {
  signInWithEmail,
  signUpWithEmail,
  sendPasswordReset,
  translateAuthError
} from '../services/authService';
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Cloud,
  ArrowRight,
  LogIn,
  UserPlus,
  KeyRound,
  Printer
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess?: () => void;
}

type AuthMode = 'login' | 'register' | 'forgot';

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Xử lý gửi Form xác thực
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Vui lòng nhập địa chỉ Email.');
      return;
    }

    if (mode === 'forgot') {
      try {
        setLoading(true);
        await sendPasswordReset(cleanEmail);
        setSuccessMessage(
          `Đã gửi liên kết khôi phục mật khẩu vào hòm thư ${cleanEmail}. Vui lòng kiểm tra hộp thư đến (hoặc thư rác/spam).`
        );
      } catch (err: any) {
        setErrorMessage(translateAuthError(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu.');
      return;
    }

    if (mode === 'register') {
      if (password.length < 6) {
        setErrorMessage('Mật khẩu phải có độ dài từ 6 ký tự trở lên.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Mật khẩu nhập lại không trùng khớp.');
        return;
      }

      try {
        setLoading(true);
        await signUpWithEmail(cleanEmail, password, displayName);
        setSuccessMessage('Đăng ký tài khoản thành công! Đang chuyển hướng vào hệ thống...');
        if (onLoginSuccess) onLoginSuccess();
      } catch (err: any) {
        setErrorMessage(translateAuthError(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    // Đăng nhập thông thường (Mode = 'login')
    try {
      setLoading(true);
      await signInWithEmail(cleanEmail, password);
      setSuccessMessage('Đăng nhập thành công!');
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      setErrorMessage(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans select-none">
      {/* Dynamic ambient backdrop glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 flex items-center justify-center text-slate-950 font-black text-2xl shadow-xl shadow-amber-500/20 ring-4 ring-slate-800">
              194
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase flex items-center justify-center gap-2">
            <span>TIỆM IN 194</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              V1.2
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Hệ thống Quản lý Bán hàng, Kho vật tư & Doanh số Đồng bộ Trực tuyến
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5">
          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'login'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng Nhập</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'register'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Đăng Ký Mới</span>
            </button>
          </div>

          {/* Title based on mode */}
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              {mode === 'login' && (
                <>
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>Xác thực đăng nhập tài khoản</span>
                </>
              )}
              {mode === 'register' && (
                <>
                  <UserPlus className="w-4 h-4 text-amber-400" />
                  <span>Tạo tài khoản quản trị viên mới</span>
                </>
              )}
              {mode === 'forgot' && (
                <>
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>Khôi phục mật khẩu đăng nhập</span>
                </>
              )}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {mode === 'login' && 'Nhập Email & Mật khẩu được cấp để mở khóa giao diện làm việc.'}
              {mode === 'register' && 'Đăng ký tài khoản đầu tiên để kích hoạt quyền truy cập xưởng in.'}
              {mode === 'forgot' && 'Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu.'}
            </p>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Success Message Alert */}
          {successMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{successMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display Name (Only in Register mode) */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Tên hiển thị / Tên quản lý
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ví dụ: Admin Tiệm In 194"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-medium text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden transition"
                  />
                </div>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Địa chỉ Email <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@xuongin194.com hoặc crvinhquang@gmail.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-medium text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden transition"
                />
              </div>
            </div>

            {/* Password Input (Login & Register) */}
            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    Mật khẩu <span className="text-amber-400">*</span>
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition cursor-pointer"
                    >
                      Quên mật khẩu?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu bí mật..."
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-medium text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden transition font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white p-0.5 cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Password (Only Register) */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Xác nhận lại mật khẩu <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu phía trên..."
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-medium text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden transition font-mono"
                  />
                </div>
              </div>
            )}

            {/* Remember Me Checkbox */}
            {mode === 'login' && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded-md border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer"
                />
                <label
                  htmlFor="rememberMe"
                  className="text-xs text-slate-300 font-medium cursor-pointer"
                >
                  Tự động lưu trạng thái đăng nhập trên thiết bị này
                </label>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Đang xử lý xác thực...</span>
                </>
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>ĐĂNG NHẬP VÀO HỆ THỐNG</span>
                </>
              ) : mode === 'register' ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>TẠO TÀI KHOẢN MỚI</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  <span>GỬI LINK ĐẶT LẠI MẬT KHẨU</span>
                </>
              )}
            </button>
          </form>

          {/* Footer of Card */}
          {mode === 'forgot' && (
            <div className="pt-2 text-center border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 transition cursor-pointer"
              >
                ← Quay lại màn hình Đăng nhập
              </button>
            </div>
          )}
        </div>

        {/* Security / System Footer */}
        <div className="mt-5 text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Xác thực bảo mật qua <strong>Firebase Authentication</strong></span>
          </div>
          <p className="text-[11px] text-slate-500">
            Dữ liệu bán hàng & kho được đồng bộ thời gian thực qua Cloud Firestore: <code className="text-amber-400/80 font-mono">lab-f7f0a</code>
          </p>
        </div>
      </div>
    </div>
  );
};
