import React, { useMemo } from 'react';
import type { Question } from '../core/types';
import { storage } from '../core/storage';
import { calculateExamReadiness, analyzeLearningRisks } from '../core/learningEngine';
import { 
  AlertOctagon, 
  HelpCircle, 
  TrendingDown, 
  Play, 
  ArrowLeft, 
  CheckCircle2, 
  Zap,
  Target
} from 'lucide-react';
import { useLanguage } from '../context/useLanguage';

interface WeaknessPracticeViewProps {
  allQuestions: Question[];
  onBackToHome: () => void;
  onStartTargetedDrill: (questionIds: number[], title: string) => void;
}

export const WeaknessPracticeView: React.FC<WeaknessPracticeViewProps> = ({
  allQuestions,
  onBackToHome,
  onStartTargetedDrill,
}) => {
  const { t } = useLanguage();
  const studyProgress = useMemo(() => storage.getStudyProgress(), []);
  const examHistory = useMemo(() => storage.getExamHistory(), []);

  const readiness = useMemo(
    () => calculateExamReadiness(allQuestions, studyProgress, examHistory),
    [allQuestions, studyProgress, examHistory]
  );

  const risks = useMemo(
    () => analyzeLearningRisks(allQuestions, studyProgress),
    [allQuestions, studyProgress]
  );

  const dangerousMisconceptions = useMemo(
    () => risks.filter((r) => r.riskType === 'dangerous_misconception'),
    [risks]
  );

  const fragileKnowledge = useMemo(
    () => risks.filter((r) => r.riskType === 'fragile_knowledge'),
    [risks]
  );

  const handleDrillDangerous = () => {
    if (dangerousMisconceptions.length === 0) return;
    onStartTargetedDrill(
      dangerousMisconceptions.map((r) => r.questionId),
      `Targeted Drill: ${dangerousMisconceptions.length} Dangerous Misconceptions`
    );
  };

  const handleDrillFragile = () => {
    if (fragileKnowledge.length === 0) return;
    onStartTargetedDrill(
      fragileKnowledge.map((r) => r.questionId),
      `Targeted Drill: ${fragileKnowledge.length} Fragile Knowledge Questions`
    );
  };

  const handleDrillService = (serviceTag: string) => {
    const qIds = allQuestions
      .filter((q) => q.serviceTags.some((t) => t.toUpperCase() === serviceTag.toUpperCase()))
      .map((q) => q.id)
      .slice(0, 20);

    onStartTargetedDrill(qIds, `Targeted Drill: ${serviceTag} (${qIds.length} Questions)`);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHome}
            className="flex items-center justify-center gap-1.5 min-h-[38px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all active:scale-95 touch-manipulation"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.nav.dashboard}</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {t.weakness.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.weakness.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Top Readiness & Stats Bar */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Readiness Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.weakness.examReadiness}
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              {readiness.passLikelihood}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-slate-100">
              {readiness.readinessPercent}%
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              (Est. {readiness.estimatedScaledScore} / 1000)
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full transition-all duration-500 ${
                readiness.readinessPercent >= 72
                  ? 'bg-emerald-500'
                  : readiness.readinessPercent >= 50
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${readiness.readinessPercent}%` }}
            />
          </div>
        </div>

        {/* Dangerous Misconceptions Card */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm dark:border-rose-950 dark:bg-rose-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-900 dark:text-rose-300">
              {t.weakness.dangerousTitle}
            </span>
            <AlertOctagon className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-900 dark:text-rose-100">
              {dangerousMisconceptions.length}
            </span>
            <span className="text-xs font-medium text-rose-700 dark:text-rose-300">
              {t.weakness.confidentWrong}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-rose-800 dark:text-rose-300">
            {t.weakness.dangerousDesc}
          </p>
        </div>

        {/* Fragile Knowledge Card */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm dark:border-amber-950 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
              {t.weakness.fragileTitle}
            </span>
            <HelpCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-900 dark:text-amber-100">
              {fragileKnowledge.length}
            </span>
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
              {t.weakness.guessedCorrect}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-300">
            {t.weakness.fragileDesc}
          </p>
        </div>
      </div>

      {/* Main Sections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Dangerous Misconceptions Drills */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t.weakness.dangerousTitle}
              </h2>
            </div>
            {dangerousMisconceptions.length > 0 && (
              <button
                type="button"
                onClick={handleDrillDangerous}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{t.weakness.drillDangerous.replace('{count}', String(dangerousMisconceptions.length))}</span>
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {dangerousMisconceptions.length === 0 ? (
              <div className="py-8 text-center text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                <p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.weakness.zeroDangerous}
                </p>
                <p className="mt-1 text-[11px]">
                  {t.weakness.zeroDangerousDesc}
                </p>
              </div>
            ) : (
              dangerousMisconceptions.map((item) => (
                <div
                  key={item.questionId}
                  className="rounded-xl border border-rose-100 bg-rose-50/50 p-3.5 text-left dark:border-rose-950 dark:bg-rose-950/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-900 dark:text-rose-200">
                      Question #{item.questionId}
                    </span>
                    <span className="rounded bg-rose-200/80 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-900 dark:bg-rose-900/80 dark:text-rose-200">
                      {t.weakness.confidence} {item.confidence}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs text-slate-700 dark:text-slate-300">
                    {item.question.text}
                  </p>
                  <p className="mt-2 text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                    {item.reason}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Weakest Service Topics Drills */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t.weakness.weakestServices}
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t.weakness.rankedByError}
            </span>
          </div>

          <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {readiness.topWeakServices.length === 0 ? (
              <div className="py-8 text-center text-slate-500 dark:text-slate-400">
                <Target className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.weakness.notEnoughData}
                </p>
                <p className="mt-1 text-[11px]">
                  {t.weakness.notEnoughDataDesc}
                </p>
              </div>
            ) : (
              readiness.topWeakServices.map((ws) => (
                <div
                  key={ws.serviceTag}
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {ws.serviceTag}
                      </span>
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                        {ws.errorRate}% {t.weakness.errorRate}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {ws.incorrectAnswers} incorrect out of {ws.attemptedQuestions} attempted ({ws.totalQuestions} in bank)
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDrillService(ws.serviceTag)}
                    className="flex items-center justify-center gap-1.5 min-h-[38px] rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:border-slate-800 dark:text-blue-400 dark:hover:bg-slate-800 transition-all active:scale-95 touch-manipulation"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>{t.weakness.drill}</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Fragile Knowledge Section */}
      {fragileKnowledge.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/30 p-6 shadow-sm dark:border-amber-950 dark:bg-amber-950/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-base font-bold text-amber-950 dark:text-amber-100">
                  {t.weakness.fragileTitle} ({fragileKnowledge.length} Qs)
                </h3>
              </div>
              <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
                {t.weakness.fragileDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDrillFragile}
              className="flex items-center justify-center gap-1.5 min-h-[44px] rounded-lg bg-amber-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 transition-all active:scale-95 touch-manipulation"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{t.weakness.drillFragile.replace('{count}', String(fragileKnowledge.length))}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
