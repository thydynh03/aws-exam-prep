import React from 'react';
import { AlertTriangle, CheckCircle2, Flag, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../context/useLanguage';

interface ConfirmSubmitModalProps {
  isOpen: boolean;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  markedCount: number;
  timeRemaining?: number;
  onCancel: () => void;
  onConfirmSubmit: () => void;
}

export const ConfirmSubmitModal: React.FC<ConfirmSubmitModalProps> = ({
  isOpen,
  totalQuestions,
  answeredCount,
  unansweredCount,
  markedCount,
  onCancel,
  onConfirmSubmit,
}) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const hasUnanswered = unansweredCount > 0;

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
        aria-labelledby="submit-modal-title"
        className="relative w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-3.5 mb-4">
          <div className={`p-2.5 rounded-lg flex-shrink-0 ${hasUnanswered ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
            {hasUnanswered ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <div>
            <h3 id="submit-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
              {hasUnanswered ? t.exam.unansweredRemaining : t.exam.confirmSubmitTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t.exam.submitGradeDesc}
            </p>
          </div>
        </div>

        {/* Stats Summary Table */}
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 p-3.5 mb-5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
            <span>{t.exam.totalQuestions}</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{totalQuestions}</span>
          </div>
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
            <span>{t.exam.answered}:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{answeredCount}</span>
          </div>
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
            <span>{t.exam.unanswered}:</span>
            <span className={`font-mono font-bold ${hasUnanswered ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
              {unansweredCount}
            </span>
          </div>
          {markedCount > 0 && (
            <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1">
                <Flag className="w-3 h-3 text-amber-500" />
                {t.exam.flagged}:
              </span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{markedCount}</span>
            </div>
          )}
        </div>

        {hasUnanswered && (
          <div className="mb-5 p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            {t.exam.unansweredWarning.replace('{count}', String(unansweredCount))}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.exam.returnToExam}</span>
          </button>

          <button
            onClick={onConfirmSubmit}
            className="flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold bg-[#EC7211] hover:bg-[#D96509] text-white dark:bg-[#FF9900] dark:hover:bg-[#E58900] dark:text-slate-950 transition-all active:scale-95 touch-manipulation shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900] focus-visible:ring-offset-2"
          >
            {t.exam.submitAndGrade}
          </button>
        </div>
      </div>
    </div>
  );
};
