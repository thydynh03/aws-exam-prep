import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/useTheme';
import { useLanguage } from '../context/useLanguage';
import { useAuth } from '../context/useAuth';

import type { AppMode } from '../core/types';
import { formatTime } from '../core/examEngine';
import { 
  Sun, 
  Moon, 
  Clock, 
  Pause, 
  Play, 
  HelpCircle,
  ShieldCheck,
  BookOpen,
  Eye,
  AlertOctagon,
  Layers,
  Calendar,
  Server,
  Search,
  Globe,
  MessageSquare,
  PlusCircle,
  Shield,
  LogOut,
  User,
  ChevronDown,
  Bot,
  Menu,
  X,
  Home
} from 'lucide-react';

interface HeaderProps {
  mode: AppMode;
  currentIndex?: number;
  totalQuestions?: number;
  timeRemaining?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
  onGoHome: () => void;
  onNavigateMode?: (targetMode: AppMode) => void;
  onOpenShortcuts: () => void;
  onOpenSearch?: () => void;
  onOpenFeedback?: () => void;
  onOpenQuestionSubmit?: () => void;
  onOpenAdminPortal?: () => void;
  onOpenLogin?: () => void;
  onOpenAdminLogin?: () => void;
  onToggleAITutor?: () => void;
  isAITutorOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  currentIndex = 0,
  totalQuestions = 32,
  timeRemaining,
  isPaused = false,
  onTogglePause,
  onGoHome,
  onNavigateMode,
  onOpenShortcuts,
  onOpenSearch,
  onOpenFeedback,
  onOpenQuestionSubmit,
  onOpenAdminPortal,
  onOpenLogin,
  onOpenAdminLogin,
  onToggleAITutor,
  isAITutorOpen = false,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const { user, isAdmin, logout } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  // Lock body scroll and close mobile drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileNavOpen) {
        setIsMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileNavOpen]);

  // Low time warnings (< 5 min: amber, < 1 min: red)
  const isTimeCritical = timeRemaining !== undefined && timeRemaining < 60;
  const isTimeWarning = timeRemaining !== undefined && timeRemaining < 300 && !isTimeCritical;

  const getModeBadge = () => {
    switch (mode) {
      case 'exam':
        return (
          <span className="inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t.badges.examSimulation}
          </span>
        );
      case 'study':
        return (
          <span className="inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <BookOpen className="h-3.5 w-3.5" />
            {t.badges.studyMode}
          </span>
        );
      case 'review':
        return (
          <span className="inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Eye className="h-3.5 w-3.5" />
            {t.badges.reviewMode}
          </span>
        );
      case 'result':
        return (
          <span className="inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {t.badges.examReport}
          </span>
        );
      case 'weakness':
        return (
          <span className="inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertOctagon className="h-3.5 w-3.5" />
            {t.badges.weaknessDrills}
          </span>
        );
      case 'domain':
        return (
          <span className="inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Layers className="h-3.5 w-3.5" />
            {t.badges.domainPractice}
          </span>
        );
      case 'flashcards':
        return (
          <span className="inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <BookOpen className="h-3.5 w-3.5" />
            {t.badges.flashcards}
          </span>
        );
      case 'services':
        return (
          <span className="inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Server className="h-3.5 w-3.5" />
            {t.badges.awsDirectory}
          </span>
        );
      case 'studyplan':
        return (
          <span className="inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Calendar className="h-3.5 w-3.5" />
            {t.badges.studyPlan30Day}
          </span>
        );
      default:
        return null;
    }
  };

  const navTabs: { id: AppMode; label: string }[] = [
    { id: 'study', label: t.nav.study },
    { id: 'domain', label: t.nav.domains },
    { id: 'weakness', label: t.nav.weakness },
    { id: 'flashcards', label: t.nav.flashcards },
    { id: 'services', label: t.nav.architecture },
    { id: 'studyplan', label: t.nav.studyPlan },
  ];

  return (
    <header className={`sticky top-0 z-30 w-full border-b transition-colors flex-shrink-0 ${
      mode === 'exam'
        ? 'bg-[#002D62] text-white border-[#001D40] dark:bg-[#07111E] dark:border-slate-800'
        : 'border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm'
    }`}>
      <div className="mx-auto flex h-14 w-full max-w-[1920px] items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6">
        {/* Left: Brand & Mode */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
          <button
            type="button"
            onClick={onGoHome}
            title="Return to Dashboard"
            className={`flex items-center gap-2 font-bold tracking-tight hover:opacity-85 transition-opacity focus-visible:outline-none min-w-0 shrink ${
              mode === 'exam' ? 'text-white' : 'text-slate-900 dark:text-white'
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#FF9900] text-xs font-black text-slate-950">
              AWS
            </span>
            <span className="truncate text-xs font-semibold tracking-wide sm:text-sm whitespace-nowrap min-w-0">
              {mode === 'exam' ? (
                <>
                  <span className="hidden xl:inline">AWS Certified Solutions Architect - Associate</span>
                  <span className="hidden sm:inline xl:hidden">AWS Solutions Architect</span>
                  <span className="sm:hidden">AWS SAA-C03</span>
                </>
              ) : 'EXAM PREP'}
            </span>
          </button>

          {mode !== 'exam' && (
            <>
              <div className="hidden h-4 w-px bg-slate-200 dark:bg-slate-800 sm:block shrink-0" />
              <div className="hidden md:block shrink-0">
                {getModeBadge()}
              </div>
            </>
          )}
        </div>

        {/* Center: Navigation Links in non-exam mode, or Question & Timer in Exam */}
        {mode !== 'exam' ? (
          <nav className="hidden lg:flex items-center gap-1 shrink-0">
            {navTabs.map((tab) => {
              const isActive = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onNavigateMode?.(tab.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-100 text-blue-600 font-semibold dark:bg-slate-800 dark:text-blue-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        ) : (
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 mx-1 sm:mx-3">
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-xs sm:text-sm font-mono whitespace-nowrap shrink-0 shadow-xs">
              <span className="text-white/80">Question</span>
              <span className="font-bold text-white text-xs sm:text-sm">{currentIndex + 1}</span>
              <span className="text-white/50">/</span>
              <span className="text-white/90">{totalQuestions}</span>
            </div>

            {timeRemaining !== undefined && (
              <div
                className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1 font-mono text-xs font-bold tracking-wider sm:text-sm transition-colors whitespace-nowrap shrink-0 ${
                  isTimeCritical
                    ? 'animate-pulse border border-red-400 bg-red-500 text-white shadow-lg shadow-red-500/30'
                    : isTimeWarning
                    ? 'border border-amber-400/40 bg-amber-500/20 text-amber-300'
                    : 'border border-white/20 bg-black/30 text-white dark:border-slate-700 dark:bg-slate-800'
                }`}
                title="Time remaining"
              >
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>{formatTime(timeRemaining)}</span>
                {onTogglePause && (
                  <button
                    type="button"
                    onClick={onTogglePause}
                    aria-label={isPaused ? 'Resume exam timer' : 'Pause exam timer'}
                    title={isPaused ? 'Resume' : 'Pause'}
                    className="ml-1 rounded p-0.5 text-white/80 transition-colors hover:text-white shrink-0"
                  >
                    {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Right: Search, Shortcuts, Theme Toggle */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Global Search Button (Only in non-exam mode) */}
          {mode !== 'exam' && onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              title="Universal Search (Ctrl+K)"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors whitespace-nowrap border border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 shrink-0"
            >
              <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="hidden sm:inline font-medium">Search</span>
              <kbd className="hidden sm:inline rounded bg-slate-200/80 px-1 py-0.2 font-mono text-[10px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                Ctrl+K
              </kbd>
            </button>
          )}

          {/* Language Switcher Button */}
          <button
            type="button"
            onClick={toggleLanguage}
            title={language === 'vi' ? 'Switch to English (EN)' : 'Chuyển sang Tiếng Việt (VI)'}
            aria-label="Toggle language between English and Vietnamese"
            className={`flex items-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-2.5 py-1 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
              mode === 'exam'
                ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className={language === 'en' ? 'text-blue-600 dark:text-blue-400 font-extrabold' : 'text-slate-400 dark:text-slate-500'}>EN</span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className={language === 'vi' ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-slate-400 dark:text-slate-500'}>VI</span>
          </button>

          {/* Keyboard Shortcuts - hidden in exam mode */}
          {mode !== 'exam' && (
            <button
              type="button"
              onClick={onOpenShortcuts}
              title={t.nav.shortcuts}
              aria-label={t.nav.shortcuts}
              className="hidden md:inline-flex rounded-lg p-1.5 transition-colors text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white shrink-0"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          )}

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? t.nav.themeLight : t.nav.themeDark}
            aria-label={theme === 'dark' ? t.nav.themeLight : t.nav.themeDark}
            className={`rounded-lg p-1.5 transition-colors shrink-0 ${
              mode === 'exam'
                ? 'text-white/80 hover:bg-white/10 hover:text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
            }`}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Feedback Modal Trigger - hidden in exam mode */}
          {mode !== 'exam' && onOpenFeedback && (
            <button
              type="button"
              onClick={onOpenFeedback}
              title="Góp ý & Báo lỗi"
              className="hidden md:inline-flex rounded-lg p-1.5 transition-colors text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white shrink-0"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          )}

          {/* Question Submit Trigger - hidden in exam mode */}
          {mode !== 'exam' && onOpenQuestionSubmit && (
            <button
              type="button"
              onClick={onOpenQuestionSubmit}
              title="Đóng góp câu hỏi mới"
              className="hidden lg:inline-flex rounded-lg p-1.5 transition-colors text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white shrink-0"
            >
              <PlusCircle className="h-4 w-4" />
            </button>
          )}

          {/* AI Tutor Toggle */}
          {onToggleAITutor && (
            <button
              type="button"
              onClick={onToggleAITutor}
              title={isAITutorOpen ? 'Thu nhỏ AI Tutor' : 'Mở AWS AI Tutor'}
              aria-label="AWS AI Tutor"
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1 text-xs font-bold transition-all shadow-xs whitespace-nowrap shrink-0 ${
                isAITutorOpen
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-purple-500/25 ring-2 ring-purple-400/40'
                  : mode === 'exam'
                    ? 'bg-white/10 text-white hover:bg-white/20'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60 dark:hover:bg-purple-900/50'
              }`}
            >
              <Bot className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">AI Tutor</span>
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            </button>
          )}

          {/* Admin Portal Switch (Only for ADMIN on desktop when NOT in exam mode) */}
          {mode !== 'exam' && isAdmin && onOpenAdminPortal && (
            <button
              type="button"
              onClick={onOpenAdminPortal}
              title="Mở Bảng Quản Trị Hệ Thống"
              className="hidden lg:inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-500/30 hover:bg-amber-500/25 dark:text-amber-300 dark:hover:bg-amber-500/25 transition-all shadow-xs whitespace-nowrap shrink-0"
            >
              <Shield className="h-3.5 w-3.5 shrink-0" />
              <span>Admin Dashboard</span>
            </button>
          )}

          {/* Mobile Navigation Drawer Toggle */}
          {mode !== 'exam' && (
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              title="Mở menu điều hướng"
              aria-label="Mở menu điều hướng"
              className="lg:hidden flex items-center justify-center rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors min-w-[36px] min-h-[36px] shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          {/* Quick Exit Exam Button (Only in exam mode) */}
          {mode === 'exam' && (
            <button
              type="button"
              onClick={onGoHome}
              title={language === 'vi' ? 'Thoát bài thi' : 'Exit Exam'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span>{language === 'vi' ? 'Thoát' : 'Exit'}</span>
            </button>
          )}

          {/* User Profile & Auth Badge with interactive menu */}
          {user ? (
            <div className="relative flex items-center gap-1 sm:gap-1.5 pl-1 shrink-0" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 rounded-xl px-2 py-1 text-xs font-semibold transition-all cursor-pointer hover:ring-2 hover:ring-blue-400/30 whitespace-nowrap shrink-0 ${
                  mode === 'exam'
                    ? 'bg-white/10 text-white hover:bg-white/20'
                    : 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
                title="Bấm để xem thông tin tài khoản hoặc chuyển sang Quản Trị (Admin)"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white uppercase shadow-xs shrink-0">
                  {user.username[0]}
                </div>
                <span className="hidden md:inline max-w-[90px] truncate">{user.username}</span>
                {user.role === 'ADMIN' ? (
                  <span className="rounded bg-amber-500 px-1 py-0.2 text-[9px] font-black text-slate-950 shrink-0">
                    AD
                  </span>
                ) : (
                  <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
                )}
              </button>

              <button
                type="button"
                onClick={() => logout()}
                title="Đăng xuất"
                aria-label="Đăng xuất"
                className={`rounded-lg p-1.5 transition-colors shrink-0 ${
                  mode === 'exam'
                    ? 'text-white/70 hover:bg-white/10 hover:text-white'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800 dark:hover:text-red-400'
                }`}
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>

              {/* Profile Dropdown Popup */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-900 z-50 text-xs animate-fadeIn">
                  <div className="flex items-center gap-2.5 border-b border-slate-100 pb-2.5 dark:border-slate-800">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-bold text-white uppercase text-sm shadow-sm">
                      {user.username[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">{user.username}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {user.role === 'ADMIN' ? '🛡️ Quản trị viên (Admin)' : '🎓 Học viên (Learner)'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 space-y-1">
                    {user.role === 'ADMIN' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          if (onOpenAdminPortal) onOpenAdminPortal();
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40 transition-colors"
                      >
                        <Shield className="h-4 w-4" />
                        <span>Mở Bảng Quản Trị (Admin)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          if (onOpenAdminLogin) {
                            onOpenAdminLogin();
                          }
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40 transition-colors"
                      >
                        <ShieldCheck className="h-4 w-4 text-amber-500" />
                        <span>Đăng nhập Quản Trị (Admin)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Đăng xuất tài khoản</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            onOpenLogin && (
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
              >
                <User className="h-3.5 w-3.5" />
                <span>Đăng nhập</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Mobile Slide-Over Navigation Drawer */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
            onClick={() => setIsMobileNavOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative ml-auto w-80 max-w-[85vw] h-full bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-[#FF9900] text-xs font-black text-slate-950">
                  AWS
                </span>
                <span className="text-sm font-bold tracking-tight">EXAM PREP</span>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Đóng menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User Profile Card inside Mobile Drawer */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40">
              {user ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 font-bold text-white uppercase text-sm shadow-sm">
                      {user.username[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate text-xs">
                        {user.username}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {user.role === 'ADMIN' ? 'Quản trị viên (Admin)' : 'Học viên (Learner)'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileNavOpen(false);
                      logout();
                    }}
                    title="Đăng xuất"
                    className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                onOpenLogin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileNavOpen(false);
                      onOpenLogin();
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
                  >
                    <User className="h-4 w-4" />
                    <span>Đăng nhập tài khoản</span>
                  </button>
                )
              )}
            </div>

            {/* Scrollable Navigation Items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
              {/* Primary Learning Tabs */}
              <div>
                <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {language === 'vi' ? 'Hệ Sinh Thái Ôn Thi' : 'Study Navigation'}
                </span>
                <div className="mt-1 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileNavOpen(false);
                      onGoHome();
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 font-semibold transition-colors ${
                      mode === 'home'
                        ? 'bg-blue-50 text-blue-600 font-bold dark:bg-blue-950/60 dark:text-blue-400'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Home className="h-4 w-4 text-blue-500" />
                    <span>{language === 'vi' ? 'Bảng điều khiển (Trang chủ)' : 'Dashboard (Home)'}</span>
                  </button>

                  {navTabs.map((tab) => {
                    const isActive = mode === tab.id;
                    let TabIcon = BookOpen;
                    if (tab.id === 'domain') TabIcon = Layers;
                    else if (tab.id === 'weakness') TabIcon = AlertOctagon;
                    else if (tab.id === 'flashcards') TabIcon = BookOpen;
                    else if (tab.id === 'services') TabIcon = Server;
                    else if (tab.id === 'studyplan') TabIcon = Calendar;

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setIsMobileNavOpen(false);
                          onNavigateMode?.(tab.id);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 font-semibold transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-600 font-bold dark:bg-blue-950/60 dark:text-blue-400'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        <TabIcon className={`h-4 w-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tools & Utilities */}
              <div>
                <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {language === 'vi' ? 'Công Cụ & Hỗ Trợ' : 'Tools & Quick Access'}
                </span>
                <div className="mt-1 space-y-1">
                  {onOpenSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileNavOpen(false);
                        onOpenSearch();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Search className="h-4 w-4 text-slate-400" />
                      <span>{language === 'vi' ? 'Tìm kiếm đề thi & dịch vụ (Ctrl+K)' : 'Universal Search (Ctrl+K)'}</span>
                    </button>
                  )}

                  {onToggleAITutor && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileNavOpen(false);
                        onToggleAITutor();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/40 transition-colors font-semibold"
                    >
                      <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span>AWS AI Tutor (Trợ lý thông minh)</span>
                    </button>
                  )}

                  {onOpenFeedback && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileNavOpen(false);
                        onOpenFeedback();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                    >
                      <MessageSquare className="h-4 w-4 text-slate-400" />
                      <span>{language === 'vi' ? 'Góp ý & Báo lỗi câu hỏi' : 'Feedback & Bug Report'}</span>
                    </button>
                  )}

                  {onOpenQuestionSubmit && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileNavOpen(false);
                        onOpenQuestionSubmit();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                    >
                      <PlusCircle className="h-4 w-4 text-slate-400" />
                      <span>{language === 'vi' ? 'Đóng góp câu hỏi mới' : 'Submit Question'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileNavOpen(false);
                      onOpenShortcuts();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                  >
                    <HelpCircle className="h-4 w-4 text-slate-400" />
                    <span>{t.nav.shortcuts}</span>
                  </button>

                  {isAdmin && onOpenAdminPortal && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileNavOpen(false);
                        onOpenAdminPortal();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 font-bold text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40 transition-colors"
                    >
                      <Shield className="h-4 w-4 text-amber-500" />
                      <span>Bảng Quản Trị (Admin Portal)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Drawer Footer: Theme & Language */}
            <div className="border-t border-slate-200 dark:border-slate-800 p-3 bg-slate-50/90 dark:bg-slate-900/90 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-slate-500" />}
                  <span>{theme === 'dark' ? t.nav.themeLight : t.nav.themeDark}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Globe className="h-3.5 w-3.5 text-slate-400" />
                <span className={language === 'en' ? 'text-blue-600 dark:text-blue-400 font-extrabold' : 'text-slate-400'}>EN</span>
                <span>/</span>
                <span className={language === 'vi' ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-slate-400'}>VI</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
