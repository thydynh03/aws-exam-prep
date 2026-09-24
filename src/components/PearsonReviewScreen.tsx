import React, { useMemo } from 'react';
import type { Question } from '../core/types';
import { formatTime } from '../core/examEngine';
import { useLanguage } from '../context/useLanguage';
import { SAA_DOMAINS } from '../core/domainMeta';
import { ContentDomainBadge } from './ContentDomainBadge';
import { 
  CheckCircle2, 
  AlertCircle, 
  Flag, 
  ArrowLeft, 
  Clock, 
  Send, 
  FileText,
  Layers
} from 'lucide-react';

interface PearsonReviewScreenProps {
  questions: Question[];
  currentIndex: number;
  answers: Record<number, string>;
  markedForReview: Record<number, boolean>;
  timeRemaining: number;
  onSelectQuestion: (index: number) => void;
  onReviewAll: () => void;
  onReviewIncomplete: () => void;
  onReviewMarked: () => void;
  onEndExam: () => void;
  onBackToCurrentQuestion: () => void;
}

export const PearsonReviewScreen: React.FC<PearsonReviewScreenProps> = ({
  questions,
  answers,
  markedForReview,
  timeRemaining,
  onSelectQuestion,
  onReviewAll,
  onReviewIncomplete,
  onReviewMarked,
  onEndExam,
  onBackToCurrentQuestion,
}) => {
  const { t } = useLanguage();
  const total = questions.length;
  let answeredCount = 0;
  let markedCount = 0;

  for (const q of questions) {
    if (answers[q.id] && answers[q.id].trim().length > 0) {
      answeredCount++;
    }
    if (markedForReview[q.id]) {
      markedCount++;
    }
  }

  const incompleteCount = total - answeredCount;

  const domainStats = useMemo(() => {
    const list = Object.values(SAA_DOMAINS);
    return list.map((meta) => {
      const totalInDomain = questions.filter(q => q.domain === meta.domain).length;
      const answeredInDomain = questions.filter(
        q => q.domain === meta.domain && !!answers[q.id] && answers[q.id].trim().length > 0
      ).length;
      return {
        meta,
        total: totalInDomain,
        answered: answeredInDomain,
        percentage: totalInDomain > 0 ? Math.round((answeredInDomain / totalInDomain) * 100) : 0,
      };
    });
  }, [questions, answers]);

  return (
    <div className="flex-1 flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 h-full overflow-y-auto min-h-0">
      {/* Pearson VUE Review Screen Header */}
      <div className="border-b border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-8 py-4 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#FF9900]" />
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                {t.exam.reviewScreen}
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t.exam.confirmSubmitDesc}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{t.exam.timeRemainingLabel} <strong className="text-slate-900 dark:text-white">{formatTime(timeRemaining)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Legend Cards */}
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 py-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-6">
          <div className="p-3.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">{t.exam.totalQuestions}</span>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
              {total}
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t.exam.answered}
            </span>
            <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
              {answeredCount}
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {t.exam.incomplete}
            </span>
            <div className={`text-xl font-bold font-mono mt-1 ${incompleteCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
              {incompleteCount}
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
              <Flag className="w-3.5 h-3.5 text-blue-500" /> {t.exam.flagged}
            </span>
            <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
              {markedCount}
            </div>
          </div>
        </div>

        {/* SAA-C03 Content Domains Breakdown */}
        <div className="mb-6 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                SAA-C03 Content Domains (4 Miền Kiến Thức Chuẩn AWS)
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Định dạng chuẩn tỷ trọng đề thi
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {domainStats.map(({ meta, total: domTotal, answered: domAnswered, percentage }) => (
              <div
                key={meta.id}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex flex-col justify-between gap-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      {meta.code}: {meta.shortTitle}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Tỷ trọng: <strong className="font-mono">{meta.weightLabel}</strong>
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                    {domAnswered}/{domTotal}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${meta.dotColor}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                    <span>Đã làm</span>
                    <span className="font-mono font-semibold">{percentage}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 65 Questions Table / Grid (Pearson VUE Style) */}
        <div className="border border-slate-300 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="bg-slate-200 dark:bg-slate-800/80 px-4 py-2.5 border-b border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
            <span>{t.exam.questionStatusSummary}</span>
            <span className="font-normal text-slate-500 dark:text-slate-400">{t.exam.clickRowToView}</span>
          </div>

          <div className="max-h-[50vh] sm:max-h-[58vh] overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
              {[0, 1, 2].map((colIndex) => {
                const perCol = Math.ceil(total / 3);
                const colQuestions = questions.slice(colIndex * perCol, (colIndex + 1) * perCol);

                return (
                  <div key={colIndex} className="divide-y divide-slate-100 dark:divide-slate-800">
                    {colQuestions.map((q) => {
                      const qIndex = questions.findIndex(item => item.id === q.id);
                      const isAnswered = !!answers[q.id] && answers[q.id].trim().length > 0;
                      const isMarked = !!markedForReview[q.id];

                      return (
                        <button
                          key={q.id}
                          onClick={() => onSelectQuestion(qIndex)}
                          className="w-full text-left px-3.5 py-2.5 min-h-[44px] hover:bg-amber-500/10 dark:hover:bg-slate-800/60 transition-all active:scale-[0.99] touch-manipulation flex items-center justify-between text-xs group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-6 sm:w-7 font-mono font-bold text-slate-700 dark:text-slate-300 group-hover:text-[#EC7211] dark:group-hover:text-[#FF9900] shrink-0">
                              {String(qIndex + 1).padStart(2, '0')}.
                            </span>
                            <ContentDomainBadge domain={q.domain} size="sm" shortText showWeight={false} className="shrink-0 text-[10px] px-1.5 py-0.2" />
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[80px] sm:max-w-[130px]">
                              {q.serviceTags[0] || 'AWS'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isMarked && (
                              <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-bold text-[11px]" title={t.exam.flagged}>
                                <Flag className="w-3 h-3 fill-current" />
                              </span>
                            )}

                            {isAnswered ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                {t.exam.complete}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                {t.exam.incomplete}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Pearson VUE Action Bar Footer */}
      <div className="mt-auto border-t border-slate-300 dark:border-slate-800 bg-slate-200 dark:bg-slate-900 px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Return to Question */}
          <button
            onClick={onBackToCurrentQuestion}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-400 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.exam.returnToCurrentQuestion}</span>
          </button>

          {/* Center / Right: Review Actions */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onReviewAll}
              className="flex-1 sm:flex-none flex items-center justify-center min-h-[44px] px-3.5 py-2.5 rounded-lg border border-slate-400 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation shadow-xs"
            >
              {t.exam.reviewAll.replace('{count}', String(total))}
            </button>

            {incompleteCount > 0 && (
              <button
                onClick={onReviewIncomplete}
                className="flex-1 sm:flex-none flex items-center justify-center min-h-[44px] px-3.5 py-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation shadow-xs"
              >
                {t.exam.reviewIncomplete.replace('{count}', String(incompleteCount))}
              </button>
            )}

            {markedCount > 0 && (
              <button
                onClick={onReviewMarked}
                className="flex-1 sm:flex-none flex items-center justify-center min-h-[44px] px-3.5 py-2.5 rounded-lg border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation shadow-xs"
              >
                {t.exam.reviewMarked.replace('{count}', String(markedCount))}
              </button>
            )}

            <button
              onClick={onEndExam}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 min-h-[44px] px-5 sm:px-6 py-2.5 rounded-lg bg-[#002D62] hover:bg-[#001D40] text-white dark:bg-[#FF9900] dark:hover:bg-[#E58900] dark:text-slate-950 font-bold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation shadow-sm"
            >
              <Send className="w-4 h-4" />
              <span>{t.exam.endExam}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
