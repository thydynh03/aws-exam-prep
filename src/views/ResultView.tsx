import React, { useState } from 'react';
import type { ExamResult, Question } from '../core/types';
import { formatTime } from '../core/examEngine';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RotateCcw, 
  BookOpen, 
  Home, 
  ChevronDown, 
  ChevronUp,
  Flag,
  Check,
  X
} from 'lucide-react';
import { OptionsList } from '../components/OptionsList';
import { ExplanationPanel } from '../components/ExplanationPanel';
import { useLanguage } from '../context/useLanguage';

interface ResultViewProps {
  result: ExamResult;
  questions: Question[];
  onRetakeExam: () => void;
  onPracticeIncorrect: (incorrectIds: number[]) => void;
  onGoHome: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  result,
  questions,
  onRetakeExam,
  onPracticeIncorrect,
  onGoHome,
}) => {

  const { t } = useLanguage();
  const [filter, setFilter] = useState<'all' | 'incorrect' | 'correct' | 'unanswered' | 'marked'>('all');
  const [expandedQuestionId, setExpandedQuestionId] = useState<number | null>(null);

  const qMap = new Map<number, Question>();
  for (const q of questions) {
    qMap.set(q.id, q);
  }

  // Filter question results
  const filteredResults = result.questionResults.filter(qr => {
    if (filter === 'incorrect') return !qr.isCorrect && qr.userAnswer.length > 0;
    if (filter === 'correct') return qr.isCorrect;
    if (filter === 'unanswered') return qr.userAnswer.length === 0;
    if (filter === 'marked') return qr.wasMarked;
    return true;
  });

  const incorrectIds = result.questionResults
    .filter(qr => !qr.isCorrect)
    .map(qr => qr.questionId);

  const toggleExpand = (qId: number) => {
    setExpandedQuestionId(prev => (prev === qId ? null : qId));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Score Summary Banner */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t.result.reportTitle}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-mono text-slate-500">
                {t.result.passingScore}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <h1 className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                {result.scaledScore} <span className="text-lg font-medium text-slate-500">/ 1000</span>
              </h1>

              {result.passed ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-4 h-4" />
                  {t.result.passed}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30">
                  <XCircle className="w-4 h-4" />
                  {t.result.didNotPass}
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              {result.passed ? t.result.congrats : t.result.tryAgain}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row flex-wrap sm:flex-nowrap gap-2.5 w-full sm:w-auto flex-shrink-0">
            {incorrectIds.length > 0 && (
              <button
                onClick={() => onPracticeIncorrect(incorrectIds)}
                className="flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 w-full sm:w-auto rounded-lg text-xs sm:text-sm font-bold bg-[#EC7211] hover:bg-[#D96509] text-white dark:bg-[#FF9900] dark:hover:bg-[#E58900] dark:text-slate-950 transition-all active:scale-95 touch-manipulation shadow-xs"
              >
                <BookOpen className="w-4 h-4" />
                <span>{t.result.drillIncorrect.replace('{count}', String(incorrectIds.length))}</span>
              </button>
            )}

            <button
              onClick={onRetakeExam}
              className="flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 w-full sm:w-auto rounded-lg text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95 touch-manipulation"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t.result.retakeExam}</span>
            </button>

            <button
              onClick={onGoHome}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2.5 w-full sm:w-auto rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 touch-manipulation"
              title={t.nav.dashboard}
              aria-label={t.nav.dashboard}
            >
              <Home className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400">{t.result.totalQuestions}</span>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5">
              {result.totalQuestions}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
            <span>{t.result.correct}</span>
            <div className="text-lg font-bold font-mono mt-0.5">
              {result.correctCount} ({result.scorePercent}%)
            </div>
          </div>

          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400">
            <span>{t.result.incorrect}</span>
            <div className="text-lg font-bold font-mono mt-0.5">
              {result.incorrectCount}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
            <span>{t.result.unanswered}</span>
            <div className="text-lg font-bold font-mono mt-0.5">
              {result.unansweredCount}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <Clock className="w-3 h-3" /> {t.result.timeUsed}
            </span>
            <div className="text-lg font-bold font-mono mt-0.5">
              {formatTime(result.timeUsedSeconds)}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <Clock className="w-3 h-3" /> {t.result.avgPerQuestion}
            </span>
            <div className="text-lg font-bold font-mono mt-0.5">
              {formatTime(result.totalQuestions > 0 ? Math.round(result.timeUsedSeconds / result.totalQuestions) : 0)}
            </div>
          </div>
        </div>

        {/* Domain Performance Breakdown */}
        {result.domainScores && result.domainScores.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.result.scoreBreakdown}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.domainScores.map((ds) => (
                <div
                  key={ds.domain}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                      {ds.domain}
                    </span>
                    <span className={`font-mono font-bold ${
                      ds.scorePercent >= 72
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : ds.scorePercent >= 50
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {ds.correct}/{ds.total} ({ds.scorePercent}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full ${
                        ds.scorePercent >= 72
                          ? 'bg-emerald-500'
                          : ds.scorePercent >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${ds.scorePercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Question Review Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t.result.breakdownTitle}
          </h2>

          {/* Filter Bar */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5 text-xs overflow-x-auto no-scrollbar max-w-full shrink-0">
            <button
              onClick={() => setFilter('all')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md font-medium transition-all active:scale-95 touch-manipulation min-h-[34px] ${
                filter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.result.filterAll} ({result.totalQuestions})
            </button>
            <button
              onClick={() => setFilter('incorrect')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md font-medium transition-all active:scale-95 touch-manipulation min-h-[34px] ${
                filter === 'incorrect'
                  ? 'bg-red-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.result.filterIncorrect} ({result.incorrectCount})
            </button>
            <button
              onClick={() => setFilter('correct')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md font-medium transition-all active:scale-95 touch-manipulation min-h-[34px] ${
                filter === 'correct'
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.result.filterCorrect} ({result.correctCount})
            </button>
            <button
              onClick={() => setFilter('unanswered')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md font-medium transition-all active:scale-95 touch-manipulation min-h-[34px] ${
                filter === 'unanswered'
                  ? 'bg-slate-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.result.filterUnanswered} ({result.unansweredCount})
            </button>
            <button
              onClick={() => setFilter('marked')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md font-medium transition-all active:scale-95 touch-manipulation min-h-[34px] ${
                filter === 'marked'
                  ? 'bg-amber-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.result.filterMarked}
            </button>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-3">
          {filteredResults.map((qr) => {
            const q = qMap.get(qr.questionId);

            if (!q) return null;
            const isExpanded = expandedQuestionId === q.id;
            const originalIndex = result.questionResults.findIndex(r => r.questionId === q.id);

            return (
              <div
                key={q.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden transition-all"
              >
                {/* Summary Row */}
                <button
                  onClick={() => toggleExpand(q.id)}
                  className="w-full text-left p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Status Badge */}
                    <div className="flex-shrink-0">
                      {qr.isCorrect ? (
                        <span className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        </span>
                      ) : qr.userAnswer.length === 0 ? (
                        <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-mono font-bold">
                          —
                        </span>
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center">
                          <X className="w-4 h-4 stroke-[2.5]" />
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          Q{String(originalIndex + 1).padStart(2, '0')}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500">ID #{q.id}</span>
                        {qr.wasMarked && (
                          <span className="inline-flex items-center gap-0.5 text-amber-500 font-mono text-[11px]">
                            <Flag className="w-3 h-3 fill-current" /> {t.question.marked}
                          </span>
                        )}
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500 truncate max-w-xs sm:max-w-md">
                          {q.serviceTags.slice(0, 2).join(', ')}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate mt-0.5">
                        {q.text}
                      </p>
                    </div>
                  </div>

                  {/* Right comparison: User Answer vs Correct Answer */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
                      <span className="text-slate-500">{t.result.yourAnswer}</span>
                      <span className={`font-bold px-1.5 py-0.5 rounded ${
                        qr.isCorrect 
                          ? 'bg-emerald-500/10 text-emerald-600' 
                          : qr.userAnswer 
                          ? 'bg-red-500/10 text-red-600' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {qr.userAnswer || t.result.noneAnswer}
                      </span>
                      <span className="text-slate-400">/</span>
                      <span className="text-slate-500">{t.result.correctAnswer}</span>
                      <span className="font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
                        {qr.correctAnswer}
                      </span>
                    </div>

                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {/* Expanded Details View */}
                {isExpanded && (
                  <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
                    <div className="text-sm sm:text-base text-slate-900 dark:text-white leading-relaxed whitespace-pre-line font-medium select-text cursor-text selection:bg-amber-400/30 dark:selection:bg-amber-500/30 selection:text-slate-900 dark:selection:text-white">
                      {q.text}
                    </div>

                    <OptionsList
                      question={q}
                      selectedAnswer={qr.userAnswer}
                      onSelectOption={() => {}}
                      isRevealed={true}
                      disabled={true}
                    />

                    <ExplanationPanel
                      question={q}
                      isCorrect={qr.isCorrect}
                      userAnswer={qr.userAnswer}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
