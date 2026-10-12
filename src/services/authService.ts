import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  User,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth } from '../firebase/config';

// Ensure persistence is set to browser local storage so user remains logged in across reloads
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Could not set auth persistence:', err);
});

/**
 * Đăng nhập bằng Email & Mật khẩu
 */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const cleanEmail = email.trim();
  const res = await signInWithEmailAndPassword(auth, cleanEmail, password);
  return res.user;
}

/**
 * Đăng ký tài khoản mới bằng Email & Mật khẩu
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<User> {
  const cleanEmail = email.trim();
  const res = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  if (displayName && displayName.trim()) {
    try {
      await updateProfile(res.user, { displayName: displayName.trim() });
    } catch (e) {
      console.warn('Could not update profile name', e);
    }
  }
  return res.user;
}

/**
 * Gửi email khôi phục mật khẩu
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim();
  await sendPasswordResetEmail(auth, cleanEmail);
}

/**
 * Đăng xuất tài khoản
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Lắng nghe thay đổi trạng thái xác thực (Real-time Auth State Listener)
 */
export function subscribeAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
}

/**
 * Lấy người dùng đang đăng nhập hiện tại
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Chuyển đổi mã lỗi Firebase Auth sang tiếng Việt thân thiện
 */
export function translateAuthError(error: any): string {
  if (!error) return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
  const code = error.code || (typeof error === 'string' ? error : '');

  switch (code) {
    case 'auth/invalid-email':
      return 'Địa chỉ Email không đúng định dạng. Vui lòng kiểm tra lại.';
    case 'auth/user-not-found':
      return 'Tài khoản không tồn tại trên hệ thống. Vui lòng kiểm tra email hoặc đăng ký mới.';
    case 'auth/wrong-password':
      return 'Mật khẩu không chính xác. Vui lòng thử lại hoặc chọn Quên mật khẩu.';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.';
    case 'auth/email-already-in-use':
      return 'Địa chỉ Email này đã được đăng ký tài khoản trước đó. Hãy chọn Đăng nhập.';
    case 'auth/weak-password':
      return 'Mật khẩu quá ngắn. Vui lòng đặt mật khẩu ít nhất 6 ký tự.';
    case 'auth/missing-password':
      return 'Vui lòng nhập mật khẩu.';
    case 'auth/missing-email':
      return 'Vui lòng nhập địa chỉ Email.';
    case 'auth/too-many-requests':
      return 'Quá nhiều lần thử không thành công. Hệ thống tạm khóa trong ít phút vì lý do bảo mật. Vui lòng thử lại sau.';
    case 'auth/network-request-failed':
      return 'Không thể kết nối máy chủ xác thực. Vui lòng kiểm tra kết nối mạng Internet.';
    case 'auth/user-disabled':
      return 'Tài khoản này đã bị tạm khóa bởi quản trị viên.';
    case 'auth/operation-not-allowed':
      return 'Tính năng đăng nhập Email & Mật khẩu chưa được bật trên Firebase Console (Authentication > Sign-in method > Email/Password).';
    default:
      return error.message || 'Xác thực thất bại. Vui lòng thử lại.';
  }
}
