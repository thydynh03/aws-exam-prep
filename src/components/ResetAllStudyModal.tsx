import React from 'react';
import { AlertTriangle, RotateCcw, X, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../context/useLanguage';

interface ResetAllStudyModalProps {
  isOpen: boolean;
  totalAnswered: number;
  totalQuestions: number;
  onClose: () => void;
  onConfirm: () => void;
}

export const ResetAllStudyModal: React.FC<ResetAllStudyModalProps> = ({
  isOpen,
  totalAnswered,
  totalQuestions,
  onClose,
  onConfirm,
}) => {
  const { t, language } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-modal-title"
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="reset-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                {t.study.resetAllConfirmTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {t.study.resetAllConfirmDesc}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Impact Box */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 p-4 mb-5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
            <span>{language === 'vi' ? 'Tổng số câu trong kho:' : 'Total questions in bank:'}</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{totalQuestions}</span>
          </div>
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
            <span>{language === 'vi' ? 'Số câu đã làm sẽ được reset:' : 'Answered questions to be reset:'}</span>
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
              {totalAnswered} {language === 'vi' ? 'câu' : 'questions'}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{language === 'vi' ? 'Ghi chú cá nhân và danh sách Bookmark của bạn vẫn được giữ nguyên.' : 'Your personal notes and bookmarks will remain intact.'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {language === 'vi' ? 'Hủy' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Xác nhận Reset Toàn Bộ' : 'Confirm Reset All'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
