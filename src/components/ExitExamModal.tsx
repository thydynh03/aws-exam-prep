import React from 'react';
import { LogOut, PauseCircle, Trash2, ArrowLeft } from 'lucide-react';
import { formatTime } from '../core/examEngine';
import { useLanguage } from '../context/useLanguage';

interface ExitExamModalProps {
  isOpen: boolean;
  totalQuestions: number;
  answeredCount: number;
  timeRemaining: number;
  onCancel: () => void;
  onPauseAndExit: () => void;
  onDiscardAndExit: () => void;
}

export const ExitExamModal: React.FC<ExitExamModalProps> = ({
  isOpen,
  totalQuestions,
  answeredCount,
  timeRemaining,
  onCancel,
  onPauseAndExit,
  onDiscardAndExit,
}) => {
  const { language } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity" 
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-modal-title"
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-3.5 mb-4">
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex-shrink-0">
            <LogOut className="w-5 h-5" />
          </div>
          <div>
            <h3 id="exit-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
              {language === 'vi' ? 'Thoát khỏi bài thi thử?' : 'Exit Exam Simulation?'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {language === 'vi' 
                ? 'Bạn có thể tạm dừng để tiếp tục sau, hoặc hủy bỏ hoàn toàn bài thi này.'
                : 'You can pause and resume later, or completely discard this exam attempt.'}
            </p>
          </div>
        </div>

        {/* Current status summary */}
        <div className="mb-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 p-3.5">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-white dark:bg-slate-800 p-2.5 shadow-xs border border-slate-200/60 dark:border-slate-700/50">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                {language === 'vi' ? 'Tiến độ làm bài' : 'Progress'}
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                {answeredCount} / {totalQuestions}
              </span>
            </div>
            <div className="rounded-lg bg-white dark:bg-slate-800 p-2.5 shadow-xs border border-slate-200/60 dark:border-slate-700/50">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                {language === 'vi' ? 'Thời gian còn lại' : 'Time Left'}
              </span>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono">
                {formatTime(timeRemaining)}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2.5">
          {/* Pause & Return to Home */}
          <button
            type="button"
            onClick={onPauseAndExit}
            className="w-full flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#002D62] hover:bg-[#001D40] text-white dark:bg-[#FF9900] dark:hover:bg-[#E58900] dark:text-slate-950 font-bold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation shadow-sm"
          >
            <PauseCircle className="w-4 h-4" />
            <span>{language === 'vi' ? 'Tạm dừng & Lưu tiến độ (Về trang chủ)' : 'Pause & Save Progress (Go Home)'}</span>
          </button>

          {/* Discard Exam */}
          <button
            type="button"
            onClick={onDiscardAndExit}
            className="w-full flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-400 font-semibold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation"
          >
            <Trash2 className="w-4 h-4" />
            <span>{language === 'vi' ? 'Hủy bỏ bài thi này' : 'Discard This Exam'}</span>
          </button>

          {/* Cancel (Stay in exam) */}
          <button
            type="button"
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-xs sm:text-sm transition-all active:scale-95 touch-manipulation mt-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{language === 'vi' ? 'Tiếp tục làm bài' : 'Continue Exam'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
