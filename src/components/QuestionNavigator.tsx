import React, { useMemo, useCallback } from 'react';
import { Check, X } from 'lucide-react';
import type { Question } from '../core/types';
import { getDomainMeta } from '../core/domainMeta';

export interface QuestionNavigatorProps {
  questionIds: number[];
  currentIndex: number;
  answers: Record<number, string>;
  markedForReview: Record<number, boolean>;
  onSelectQuestion: (index: number) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  resultsMap?: Record<number, boolean>; // if in review/result mode
  questions?: Question[];
}

interface QuestionNavButtonProps {
  id: number;
  idx: number;
  isCurrent: boolean;
  isAnswered: boolean;
  isMarked: boolean;
  hasResult: boolean;
  isResultCorrect: boolean | undefined;
  domainMeta: ReturnType<typeof getDomainMeta> | undefined;
  onSelect: (index: number) => void;
}

const QuestionNavButton = React.memo<QuestionNavButtonProps>(({
  idx,
  isCurrent,
  isAnswered,
  isMarked,
  hasResult,
  isResultCorrect,
  domainMeta,
  onSelect,
}) => {
  let bgClass = 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

  if (hasResult) {
    if (isResultCorrect) {
      bgClass = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400';
    } else {
      bgClass = 'bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-400';
    }
  } else if (isAnswered) {
    bgClass = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400';
  }

  const tooltipTitle = `Question ${idx + 1}${domainMeta ? ` • ${domainMeta.code}: ${domainMeta.shortTitle}` : ''}${isAnswered ? ' (Answered)' : ''}${isMarked ? ' (Marked for review)' : ''}`;

  return (
    <button
      onClick={() => onSelect(idx)}
      title={tooltipTitle}
      aria-label={`Jump to question ${idx + 1}`}
      className={`relative flex flex-col items-center justify-center min-h-[44px] h-11 rounded-lg border font-mono text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900] active:scale-95 ${bgClass} ${
        isCurrent ? 'ring-2 ring-[#FF9900] border-transparent font-bold shadow-xs' : ''
      }`}
    >
      {/* Domain Color Dot */}
      {domainMeta && (
        <span
          className={`absolute top-1 left-1.5 w-1.5 h-1.5 rounded-full ${domainMeta.dotColor}`}
          title={`${domainMeta.code}: ${domainMeta.shortTitle}`}
        />
      )}

      <span>{String(idx + 1).padStart(2, '0')}</span>

      {/* Status Indicator Icon */}
      <span className="absolute top-0.5 right-0.5 flex items-center">
        {isMarked && (
          <span className="text-[10px] text-amber-500 leading-none">⚑</span>
        )}
        {hasResult ? (
          isResultCorrect ? (
            <Check className="w-2.5 h-2.5 text-emerald-500" />
          ) : (
            <span className="text-[9px] text-red-500 leading-none font-bold">✕</span>
          )
        ) : (
          isAnswered && !isMarked && (
            <span className="text-[9px] text-emerald-500 leading-none">✓</span>
          )
        )}
      </span>
    </button>
  );
});

QuestionNavButton.displayName = 'QuestionNavButton';

export const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({
  questionIds,
  currentIndex,
  answers,
  markedForReview,
  onSelectQuestion,
  isOpenMobile,
  onCloseMobile,
  resultsMap,
  questions,
}) => {
  const total = questionIds.length;
  let answeredCount = 0;
  let markedCount = 0;

  const questionMap = useMemo(() => {
    if (!questions) return new Map<number, Question>();
    return new Map(questions.map(q => [q.id, q]));
  }, [questions]);

  for (const id of questionIds) {
    if (answers[id] && answers[id].trim().length > 0) {
      answeredCount++;
    }
    if (markedForReview[id]) {
      markedCount++;
    }
  }

  const unansweredCount = total - answeredCount;

  const handleNextUnanswered = () => {
    // find next unanswered index starting from current + 1, looping around
    for (let i = 1; i < total; i++) {
      const idx = (currentIndex + i) % total;
      const id = questionIds[idx];
      if (!answers[id] || answers[id].trim().length === 0) {
        onSelectQuestion(idx);
        if (isOpenMobile) onCloseMobile();
        return;
      }
    }
  };

  const handleNextMarked = () => {
    for (let i = 1; i < total; i++) {
      const idx = (currentIndex + i) % total;
      const id = questionIds[idx];
      if (markedForReview[id]) {
        onSelectQuestion(idx);
        if (isOpenMobile) onCloseMobile();
        return;
      }
    }
  };

  const handleSelect = useCallback((idx: number) => {
    onSelectQuestion(idx);
    if (isOpenMobile) onCloseMobile();
  }, [onSelectQuestion, isOpenMobile, onCloseMobile]);

  const renderContent = () => (
    <div className="flex flex-col h-full">
      {/* Header & Stats */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Question Navigator
          </h3>
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close question navigator"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
              ✓
            </span>
            <span>Answered: <strong className="font-mono">{answeredCount}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-[9px] text-slate-400 font-bold">
              —
            </span>
            <span>Unanswered: <strong className="font-mono">{unansweredCount}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-3 h-3 rounded-sm bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[9px] text-amber-600 dark:text-amber-400 font-bold">
              ⚑
            </span>
            <span>Marked: <strong className="font-mono">{markedCount}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-3 h-3 rounded-sm border-2 border-[#FF9900]" />
            <span>Current</span>
          </div>
        </div>

        {/* Domain Color Dot Legend */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
            Domains
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>D1 Security</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>D2 Resilient</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span>D3 Perf</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>D4 Cost</span>
            </span>
          </div>
        </div>

        {/* Fast jump buttons */}
        <div className="mt-3 flex items-center gap-2">
          {unansweredCount > 0 && (
            <button
              onClick={handleNextUnanswered}
              className="flex-1 text-[11px] font-semibold py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-center min-h-[38px] flex items-center justify-center"
            >
              Next Unanswered
            </button>
          )}
          {markedCount > 0 && (
            <button
              onClick={handleNextMarked}
              className="flex-1 text-[11px] font-semibold py-2 px-2.5 rounded-lg border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors text-center min-h-[38px] flex items-center justify-center"
            >
              Next Marked
            </button>
          )}
        </div>
      </div>

      {/* Grid of questions */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 sm:gap-2">
          {questionIds.map((id, idx) => {
            const isCurrent = idx === currentIndex;
            const isAnswered = Boolean(answers[id] && answers[id].trim().length > 0);
            const isMarked = Boolean(markedForReview[id]);
            const hasResult = resultsMap !== undefined && resultsMap[id] !== undefined;
            const isResultCorrect = hasResult ? resultsMap[id] : undefined;
            const q = questionMap.get(id);
            const domainMeta = q ? getDomainMeta(q.domain) : undefined;

            return (
              <QuestionNavButton
                key={id}
                id={id}
                idx={idx}
                isCurrent={isCurrent}
                isAnswered={isAnswered}
                isMarked={isMarked}
                hasResult={hasResult}
                isResultCorrect={isResultCorrect}
                domainMeta={domainMeta}
                onSelect={handleSelect}
              />
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar Panel */}
      <aside className="hidden lg:flex flex-col w-72 h-full border-l border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex-shrink-0 overflow-hidden">
        {renderContent()}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Slide-in panel */}
          <div className="relative ml-auto w-80 max-w-[85vw] h-full bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {renderContent()}
          </div>
        </div>
      )}
    </>
  );
};
