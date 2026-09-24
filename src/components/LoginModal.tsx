import React, { useState, useMemo } from 'react';
import { ShieldCheck, User, Lock, AlertCircle, Laptop, CheckCircle2, History, X } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { getDeviceInfo, getLocalRegisteredLearners } from '../core/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canDismiss?: boolean;
  initialAdminMode?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  canDismiss = false,
  initialAdminMode = false,
}) => {
  const { login } = useAuth();
  const [isAdminMode, setIsAdminMode] = useState(initialAdminMode);
  const [username, setUsername] = useState(initialAdminMode ? 'admin' : '');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const registeredAccounts = useMemo(() => {
    const list = Object.values(getLocalRegisteredLearners());
    return list.map(l => l.username).filter(u => u && u.toLowerCase() !== 'admin');
  }, []);

  const defaultSuggestions = useMemo(() => {
    return Array.from(new Set(registeredAccounts)).slice(0, 6);
  }, [registeredAccounts]);

  if (!isOpen) return null;

  const deviceInfo = getDeviceInfo();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = username.trim();
    if (!trimmed) {
      setError('Vui lòng nhập tên người dùng.');
      return;
    }

    if (isAdminMode && !adminPasscode.trim()) {
      setError('Vui lòng nhập mật khẩu quản trị viên.');
      return;
    }

    setSubmitting(true);
    try {
      await login(trimmed, isAdminMode ? adminPasscode.trim() : undefined);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectPreset = (name: string) => {
    setUsername(name);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl transition-all dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {canDismiss && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="absolute right-3 top-3 z-10 rounded-full bg-black/20 p-1.5 text-white/80 hover:bg-black/40 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {/* Header decoration with secret admin toggle on logo */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500 p-6 text-white text-center">
          <button
            type="button"
            onClick={() => {
              setIsAdminMode(prev => !prev);
              setError(null);
              if (!isAdminMode) {
                setUsername('admin');
              } else {
                setUsername('');
                setAdminPasscode('');
              }
            }}
            title={isAdminMode ? 'Chuyển về đăng nhập Học viên' : 'Đăng nhập Học viên'}
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 active:scale-95 transition-all backdrop-blur-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50 shadow-inner"
          >
            {isAdminMode ? (
              <ShieldCheck className="h-8 w-8 text-amber-300" />
            ) : (
              <User className="h-8 w-8 text-white" />
            )}
          </button>
          <h2 className="text-2xl font-bold tracking-tight">
            {isAdminMode ? 'Cổng Quản Trị Viên (Admin)' : 'Đăng Nhập Học Viên'}
          </h2>
          <p className="mt-1 text-sm text-blue-100 dark:text-blue-200">
            {isAdminMode
              ? 'Đăng nhập để xem báo cáo phân tích, kiểm duyệt câu hỏi & phản hồi'
              : 'Đồng bộ tiến độ học tập, ghi chú, flashcards và lịch sử thi'}
          </p>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Tên tài khoản
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <User className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={isAdminMode ? 'admin' : 'Ví dụ: thi, học viên...'}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-blue-400"
                />
              </div>
            </div>

            {isAdminMode && (
              <div className="animate-fadeIn">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Mật khẩu Quản trị (Admin Passcode)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type="password"
                    value={adminPasscode}
                    onChange={(e) => setAdminPasscode(e.target.value)}
                    placeholder="Nhập mật khẩu quản trị..."
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-amber-400"
                  />
                </div>
              </div>
            )}

            {!isAdminMode && (
              <div className="space-y-3">
                {registeredAccounts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      <History className="h-3.5 w-3.5 text-blue-500" />
                      <span>Tài khoản trên thiết bị này:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {registeredAccounts.map((acc) => (
                        <button
                          key={acc}
                          type="button"
                          onClick={() => handleSelectPreset(acc)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                            username === acc
                              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/60 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                          }`}
                        >
                          {acc}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {defaultSuggestions.filter(s => !registeredAccounts.includes(s)).length > 0 && (
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Gợi ý tài khoản:</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {defaultSuggestions.filter(s => !registeredAccounts.includes(s)).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => handleSelectPreset(suggestion)}
                          className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-blue-400 transition-colors"
                        >
                          +{suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white shadow-md transition-all ${
                isAdminMode
                  ? 'bg-amber-600 hover:bg-amber-700 active:scale-[0.98]'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
              } ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {submitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  <span>{isAdminMode ? 'Đăng nhập Quản Trị' : 'Bắt đầu học ngay'}</span>
                </>
              )}
            </button>

            {isAdminMode && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminMode(false);
                    setError(null);
                    setUsername('');
                    setAdminPasscode('');
                  }}
                  className="text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 font-medium transition-colors"
                >
                  ← Quay lại đăng nhập học viên
                </button>
              </div>
            )}
          </form>

          {/* Device transparency info */}
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300 mb-1">
              <Laptop className="h-3.5 w-3.5" />
              <span>Thiết bị hiện tại:</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span>Màn hình: {deviceInfo.screenResolution || '1920x1080'}</span>
              <span>Nền tảng: {deviceInfo.platform || 'Web'}</span>
            </div>
          </div>

          {canDismiss && onClose && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Đóng tạm thời
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
