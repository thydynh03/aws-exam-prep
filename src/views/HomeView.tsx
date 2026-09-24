import React, { useMemo } from 'react';
import { 
  Play, 
  BookOpen, 
  History, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  Database,
  Shuffle,
  ShieldCheck,
  Flame,
  AlertOctagon,
  Layers,
  Calendar,
  Sparkles,
  Server,
  Clock,
  Trash2
} from 'lucide-react';

import type { ExamAttemptRecord, StudyProgress, Question, ExamSession } from '../core/types';
import { formatTime } from '../core/examEngine';
import { storage } from '../core/storage';
import { calculateExamReadiness } from '../core/learningEngine';
import { useLanguage } from '../context/useLanguage';

interface HomeViewProps {
  allQuestions: Question[];
  totalBankCount: number;
  standard32Count: number;
  studyProgress: StudyProgress;
  bookmarksCount: number;
  examHistory: ExamAttemptRecord[];
  activeExamSession?: ExamSession | null;
  onResumeExam?: () => void;
  onDiscardActiveExam?: () => void;
  onStartExam: (questionCount: 65 | 32, randomize?: boolean) => void;
  onStartStudy: (filterType?: 'all' | 'incorrect' | 'bookmarked', useStandard32?: boolean) => void;
  onOpenReview: (filterType?: 'all' | 'incorrect' | 'bookmarked') => void;
  onOpenWeakness: () => void;
  onOpenDomains: () => void;
  onOpenFlashcards: () => void;
  onOpenServices: () => void;
  onOpenStudyPlan: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  allQuestions,
  totalBankCount,
  studyProgress,
  bookmarksCount,
  examHistory,
  activeExamSession,
  onResumeExam,
  onDiscardActiveExam,
  onStartExam,
  onStartStudy,
  onOpenReview,
  onOpenWeakness,
  onOpenDomains,
  onOpenFlashcards,
  onOpenServices,
  onOpenStudyPlan,
}) => {
  const { language, t } = useLanguage();
  const profile = useMemo(() => storage.getLearningProfile(), []);
  const readiness = useMemo(
    () => calculateExamReadiness(allQuestions, studyProgress, examHistory),
    [allQuestions, studyProgress, examHistory]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8 sm:px-6">
      {/* Resume Active Exam Banner (if an exam session is in progress or paused) */}
      {activeExamSession && (
        <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/40 dark:via-amber-950/20 dark:to-transparent p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start sm:items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono">
                  {language === 'vi' ? 'Đang dang dở' : 'In Progress'}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {activeExamSession.questionIds.length} {language === 'vi' ? 'câu hỏi' : 'questions'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
                {language === 'vi' ? 'Bạn có một bài thi thử chưa hoàn thành' : 'You have an unfinished exam simulation'}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {language === 'vi'
                  ? `Đã trả lời ${Object.keys(activeExamSession.answers).filter(k => activeExamSession.answers[Number(k)]?.trim()).length}/${activeExamSession.questionIds.length} câu • Thời gian còn lại: ${formatTime(activeExamSession.timeRemainingSeconds)}`
                  : `Answered ${Object.keys(activeExamSession.answers).filter(k => activeExamSession.answers[Number(k)]?.trim()).length}/${activeExamSession.questionIds.length} questions • Time remaining: ${formatTime(activeExamSession.timeRemainingSeconds)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={onResumeExam}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-[#002D62] hover:bg-[#001D40] text-white dark:bg-[#FF9900] dark:hover:bg-[#E58900] dark:text-slate-950 px-5 py-2.5 text-xs font-bold shadow-sm transition-colors"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{language === 'vi' ? 'Tiếp tục làm bài' : 'Resume Exam'}</span>
            </button>
            <button
              type="button"
              onClick={onDiscardActiveExam}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-400 px-3.5 py-2.5 text-xs font-semibold transition-colors"
              title={language === 'vi' ? 'Hủy bỏ bài thi' : 'Discard exam'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{language === 'vi' ? 'Hủy bài thi' : 'Discard'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Title & SAA-C03 Certification Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900/90 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[#002D62] px-2.5 py-0.5 font-mono text-xs font-bold text-white dark:bg-[#FF9900] dark:text-slate-950">
                SAA-C03 • AWS ASSOCIATE
              </span>
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {language === 'vi' ? 'Chuẩn Pearson VUE: 65 Câu • 130 Phút • 4 Content Domains (30%-26%-24%-20%)' : 'Pearson VUE: 65 Questions • 130 Min • 4 SAA-C03 Domains'}
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Database className="h-3.5 w-3.5" />
                {totalBankCount} {language === 'vi' ? 'câu hỏi kho đề' : 'Questions Bank'}
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {language === 'vi' ? 'Hệ Thống Luyện Thi AWS Solutions Architect Associate' : 'AWS Certified Solutions Architect Training Environment'}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t.home.subtitle}
            </p>
          </div>

          {/* Primary Quick Start CTA */}
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onStartExam(65, true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#002D62] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#001D40] dark:bg-[#FF9900] dark:hover:bg-[#E58900] dark:text-slate-950 transition-colors"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>{t.home.heroCtaExam}</span>
            </button>

            <button
              type="button"
              onClick={() => onStartStudy('all', false)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              <span>{language === 'vi' ? 'Học tất cả (1,019 câu)' : 'Study All (1,019)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Exam Readiness & Adaptive Status Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Readiness Score */}
        <div 
          onClick={onOpenWeakness}
          className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Exam Readiness
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              {readiness.passLikelihood}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {readiness.readinessPercent}%
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              (Est. {readiness.estimatedScaledScore} / 1000)
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full ${readiness.readinessPercent >= 72 ? 'bg-emerald-500' : 'bg-blue-600'}`}
              style={{ width: `${readiness.readinessPercent}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-blue-600 group-hover:underline dark:text-blue-400">
            View Weakness Report →
          </p>
        </div>

        {/* Study Streak */}
        <div 
          onClick={onOpenStudyPlan}
          className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-amber-400 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Study Streak
            </span>
            <Flame className="h-4 w-4 fill-amber-500 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-900 dark:text-amber-100">
              {profile.streakDays}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Day{profile.streakDays === 1 ? '' : 's'} Active
            </span>
          </div>
          <p className="mt-3 text-[11px] text-amber-700 group-hover:underline dark:text-amber-400">
            View 30-Day Plan →
          </p>
        </div>

        {/* Dangerous Misconceptions Alert */}
        <div 
          onClick={onOpenWeakness}
          className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-rose-400 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Exam Traps Risk
            </span>
            <AlertOctagon className={`h-4 w-4 ${readiness.dangerousMisconceptionsCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-rose-900 dark:text-rose-200">
              {readiness.dangerousMisconceptionsCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              High-Risk Question{readiness.dangerousMisconceptionsCount === 1 ? '' : 's'}
            </span>
          </div>
          <p className="mt-3 text-[11px] text-rose-600 group-hover:underline dark:text-rose-400">
            Drill Misconceptions →
          </p>
        </div>

        {/* Bookmarked Questions */}
        <div 
          onClick={() => onOpenReview('bookmarked')}
          className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-purple-400 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Bookmarked
            </span>
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 dark:bg-purple-950 dark:text-purple-300">
              Saved
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-900 dark:text-purple-200">
              {bookmarksCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Questions
            </span>
          </div>
          <p className="mt-3 text-[11px] text-purple-600 group-hover:underline dark:text-purple-400">
            Open Saved Questions →
          </p>
        </div>
      </div>

      {/* Adaptive Study Recommendation Alert */}
      {readiness.recommendations.length > 0 && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 shadow-xs dark:border-blue-950 dark:bg-blue-950/30 sm:p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
              Personalized Adaptive Recommendation:
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-blue-950 dark:text-blue-200">
            {readiness.recommendations[0]}
          </p>
        </div>
      )}

      {/* Feature Modules Grid */}
      <div>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {language === 'vi' ? 'Hệ Sinh Thái Ôn Luyện & Mô Phỏng Thi' : 'Learning & Simulation Ecosystem'}
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: 65Q Pearson VUE Simulator */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  65 Qs • 130m
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">
                {language === 'vi' ? 'Mô phỏng Thi thật Pearson VUE' : 'Pearson VUE Simulator'}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {language === 'vi'
                  ? 'Đề thi 65 câu tính giờ 130 phút chuẩn 100% tỷ trọng 4 Domains SAA-C03 (D1: 30%, D2: 26%, D3: 24%, D4: 20%), hiển thị loại đề từng câu và bảng Pearson VUE Review Screen.'
                  : '65-question timed mock exam strictly balanced to official SAA-C03 domain quotas (30% D1, 26% D2, 24% D3, 20% D4) with question domain badges.'}
              </p>
            </div>

            <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onStartExam(65, true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#002D62] py-2 px-3 text-xs font-bold text-white hover:bg-[#001D40] dark:bg-[#FF9900] dark:hover:bg-[#E58900] dark:text-slate-950 transition-colors shadow-xs"
              >
                <Shuffle className="h-3.5 w-3.5" />
                <span>{language === 'vi' ? 'Thi ngẫu nhiên 65 câu' : '65-Q Random Mock'}</span>
              </button>
              <button
                type="button"
                onClick={() => onStartExam(32, false)}
                className="w-full rounded-xl border border-slate-200 py-1.5 px-3 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {language === 'vi' ? 'Thi rút gọn (32 câu • 64p)' : 'Mini Mock (32 Qs • 64m)'}
              </button>
            </div>
          </div>

          {/* Card 2: 4 Domains Practice */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <Layers className="h-5 w-5" />
                </div>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Domains 1–4
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">
                {t.home.cardDomainsTitle}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {t.home.cardDomainsDesc}
              </p>
            </div>

            <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onOpenDomains()}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 px-3 text-xs font-bold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 transition-colors shadow-xs"
              >
                <span>{t.home.cardDomainsBtn}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Card 3: Adaptive Weakness Practice */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-rose-50 p-2 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                  <AlertOctagon className="h-5 w-5" />
                </div>
                <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                  {language === 'vi' ? 'Rủi ro Điểm mù' : 'Confidence Risk'}
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">
                {t.home.cardWeaknessTitle}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {t.home.cardWeaknessDesc}
              </p>
            </div>

            <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onOpenWeakness()}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2 px-3 text-xs font-bold text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 transition-colors shadow-xs"
              >
                <span>{t.home.cardWeaknessBtn} ({readiness.dangerousMisconceptionsCount})</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Card 4: Spaced Repetition Flashcards */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-purple-50 p-2 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                  <BookOpen className="h-5 w-5" />
                </div>
                <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                  Leitner 5-Box
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">
                {t.home.cardFlashcardsTitle}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {t.home.cardFlashcardsDesc}
              </p>
            </div>

            <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onOpenFlashcards()}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-purple-600 py-2 px-3 text-xs font-bold text-white hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 transition-colors shadow-xs"
              >
                <span>{t.home.cardFlashcardsBtn}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Card 5: AWS Services & Comparisons Explorer */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <Server className="h-5 w-5" />
                </div>
                <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  {language === 'vi' ? 'Danh bạ & Bảng so sánh' : 'Directory & Matrices'}
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">
                {t.home.cardArchitectureTitle}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {t.home.cardArchitectureDesc}
              </p>
            </div>

            <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onOpenServices()}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 px-3 text-xs font-bold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors shadow-xs"
              >
                <span>{t.home.cardArchitectureBtn}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Card 6: 30-Day Study Plan */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-amber-50 p-2 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <Calendar className="h-5 w-5" />
                </div>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {language === 'vi' ? 'Lộ trình 4 tuần' : '4-Week Roadmap'}
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">
                {t.home.cardStudyPlanTitle}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {t.home.cardStudyPlanDesc}
              </p>
            </div>

            <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onOpenStudyPlan()}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-600 py-2 px-3 text-xs font-bold text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 transition-colors shadow-xs"
              >
                <span>{t.home.cardStudyPlanBtn}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Exam Attempts History Table */}
      {examHistory.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t.home.recentAttempts}
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              {language === 'vi' ? `${examHistory.length} lần thi gần nhất` : `Last ${examHistory.length} attempt${examHistory.length === 1 ? '' : 's'}`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="bg-slate-50/70 font-semibold text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-4">{language === 'vi' ? 'Ngày thi' : 'Date'}</th>
                  <th className="py-2.5 px-4">{language === 'vi' ? 'Tỉ lệ đúng' : 'Score'}</th>
                  <th className="py-2.5 px-4">{language === 'vi' ? 'Điểm quy đổi (100–1000)' : 'Scaled (100–1000)'}</th>
                  <th className="py-2.5 px-4">{language === 'vi' ? 'Số câu đúng' : 'Correct / Total'}</th>
                  <th className="py-2.5 px-4">{language === 'vi' ? 'Thời gian làm bài' : 'Time Spent'}</th>
                  <th className="py-2.5 px-4">{language === 'vi' ? 'Kết quả' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                {examHistory.slice(0, 5).map((att) => (
                  <tr key={att.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {new Date(att.date).toLocaleDateString()} {new Date(att.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {att.scorePercent}%
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold">
                      {att.scaledScore} / 1000
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {att.correctCount} / {att.totalQuestions}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {formatTime(att.timeUsedSeconds)}
                    </td>
                    <td className="py-3 px-4">
                      {att.passed ? (
                        <span className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> PASS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-400">
                          <XCircle className="h-3 w-3" /> FAIL
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
