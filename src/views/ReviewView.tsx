import React, { useState, useMemo, useEffect } from 'react';
import type { Question, StudyProgress } from '../core/types';
import { storage } from '../core/storage';
import { QuestionPrompt } from '../components/QuestionPrompt';
import { OptionsList } from '../components/OptionsList';
import { ExplanationPanel } from '../components/ExplanationPanel';
import { 
  Filter, 
  Search, 
  Bookmark, 
  ChevronLeft, 
  ChevronRight,
  List,
  Layout
} from 'lucide-react';
import { useLanguage } from '../context/useLanguage';

interface ReviewViewProps {
  questions: Question[];
  initialFilter?: 'all' | 'incorrect' | 'bookmarked';
}

export const ReviewView: React.FC<ReviewViewProps> = ({
  questions,
  initialFilter = 'all',
}) => {
  const { t } = useLanguage();
  const [filterType, setFilterType] = useState<'all' | 'incorrect' | 'bookmarked'>(initialFilter);
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'single' | 'list'>('single');
  const [currentIndex, setCurrentIndex] = useState(0);

  const [bookmarks, setBookmarks] = useState<number[]>(() => storage.getBookmarks());
  const [studyProgress] = useState<StudyProgress>(() => storage.getStudyProgress());

  // Extract all unique service tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const q of questions) {
      for (const t of q.serviceTags) set.add(t);
    }
    return ['All', ...Array.from(set).sort()];
  }, [questions]);

  // Filter questions
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      // Type filter
      if (filterType === 'bookmarked' && !bookmarks.includes(q.id)) {
        return false;
      }
      if (filterType === 'incorrect') {
        const item = studyProgress.items[q.id];
        if (!item || !item.isSubmitted || item.isCorrect) {
          return false;
        }
      }

      // Tag filter
      if (selectedTag !== 'All' && !q.serviceTags.includes(selectedTag)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (String(q.id).includes(query)) return true;
        if (q.text.toLowerCase().includes(query)) return true;
        for (const choice of Object.values(q.choices)) {
          if (choice.toLowerCase().includes(query)) return true;
        }
        return false;
      }

      return true;
    });
  }, [questions, filterType, selectedTag, searchQuery, bookmarks, studyProgress]);

  const safeIndex = Math.min(Math.max(0, currentIndex), Math.max(0, filteredQuestions.length - 1));
  const currentQuestion = filteredQuestions[safeIndex];

  // Sync active question state with AI Tutor
  useEffect(() => {
    if (currentQuestion) {
      const item = studyProgress.items[currentQuestion.id];
      window.dispatchEvent(
        new CustomEvent('aws_active_question_changed', {
          detail: {
            question: currentQuestion,
            selectedAnswer: item?.selectedAnswer || '',
            isSubmitted: !!item?.isSubmitted,
            isCorrect: item?.isCorrect ?? false,
            userNotes: storage.getNote(currentQuestion.id)?.noteText || '',
          },
        })
      );
    }
  }, [currentQuestion, studyProgress]);

  const handleToggleBookmark = (id: number) => {
    storage.toggleBookmark(id);
    setBookmarks(storage.getBookmarks());
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header & Controls */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/80 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {t.study.targetedReview}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t.study.targetedReviewDesc}
            </p>
          </div>

          {/* View toggle (Single question vs List) */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-0.5 text-xs">
            <button
              onClick={() => setViewMode('single')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                viewMode === 'single'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>{t.study.stepByStep}</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>{t.study.tableList}</span>
            </button>
          </div>
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* Preset Buttons */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-0.5 text-xs overflow-x-auto no-scrollbar max-w-full shrink-0">
            <button
              onClick={() => { setFilterType('all'); setCurrentIndex(0); }}
              className={`whitespace-nowrap px-3 py-1.5 min-h-[34px] rounded-md font-medium transition-all active:scale-95 touch-manipulation ${
                filterType === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.study.all} ({questions.length})
            </button>
            <button
              onClick={() => { setFilterType('incorrect'); setCurrentIndex(0); }}
              className={`whitespace-nowrap px-3 py-1.5 min-h-[34px] rounded-md font-medium transition-all active:scale-95 touch-manipulation ${
                filterType === 'incorrect'
                  ? 'bg-red-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.study.pastMistakes}
            </button>
            <button
              onClick={() => { setFilterType('bookmarked'); setCurrentIndex(0); }}
              className={`whitespace-nowrap px-3 py-1.5 min-h-[34px] rounded-md font-medium transition-all active:scale-95 touch-manipulation ${
                filterType === 'bookmarked'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.study.bookmarked} ({bookmarks.length})
            </button>
          </div>

          {/* Service Tag Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedTag}
              onChange={(e) => { setSelectedTag(e.target.value); setCurrentIndex(0); }}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900]"
            >
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentIndex(0); }}
              placeholder={t.study.searchPlaceholder}
              className="w-full pl-8 pr-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900]"
            />
          </div>
        </div>
      </div>

      {/* Results Content */}
      {filteredQuestions.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl space-y-3">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            {t.study.noMatch}
          </p>
          <button
            onClick={() => { setFilterType('all'); setSelectedTag('All'); setSearchQuery(''); }}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          >
            {t.study.clearFilters}
          </button>
        </div>
      ) : viewMode === 'single' && currentQuestion ? (
        /* Single Question Step-by-Step View */
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/70 p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 pb-4 border-b border-slate-100 dark:border-slate-800">
            <span>
              {t.study.reviewingCount.replace('{current}', String(safeIndex + 1)).replace('{total}', String(filteredQuestions.length))}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentIndex(Math.max(0, safeIndex - 1))}
                disabled={safeIndex === 0}
                className="flex items-center justify-center min-w-[38px] min-h-[38px] p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 touch-manipulation"
                title={t.exam.previous}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentIndex(Math.min(filteredQuestions.length - 1, safeIndex + 1))}
                disabled={safeIndex === filteredQuestions.length - 1}
                className="flex items-center justify-center min-w-[38px] min-h-[38px] p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 touch-manipulation"
                title={t.exam.next}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <QuestionPrompt
            question={currentQuestion}
            index={safeIndex}
            total={filteredQuestions.length}
            isBookmarked={bookmarks.includes(currentQuestion.id)}
            onToggleBookmark={() => handleToggleBookmark(currentQuestion.id)}
            showMark={false}
          />

          {(() => {
            const currentStudyItem = studyProgress.items[currentQuestion.id];
            const currentSelectedAnswer = currentStudyItem?.selectedAnswer || '';
            const isAnswerSubmitted = !!currentStudyItem?.isSubmitted;
            const isCurrentCorrect = isAnswerSubmitted ? currentStudyItem.isCorrect : undefined;

            return (
              <>
                <OptionsList
                  question={currentQuestion}
                  selectedAnswer={currentSelectedAnswer}
                  onSelectOption={() => {}}
                  isRevealed={true}
                  disabled={true}
                />

                <ExplanationPanel
                  question={currentQuestion}
                  isCorrect={isCurrentCorrect}
                  userAnswer={currentSelectedAnswer}
                />
              </>
            );
          })()}
        </div>
      ) : (
        /* List / Table Scannable View */
        <div className="space-y-3">
          {filteredQuestions.map((q) => {
            const isBookmarked = bookmarks.includes(q.id);
            const studyItem = studyProgress.items[q.id];

            return (
              <div
                key={q.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 transition-colors space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      #{q.id}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="font-mono font-semibold px-2 py-0.5 rounded bg-[#EC7211]/10 text-[#EC7211] dark:bg-[#FF9900]/10 dark:text-[#FF9900] border border-[#FF9900]/20">
                      {t.question.correctAnswer}: {q.answer}
                    </span>

                    {studyItem && studyItem.isSubmitted && (
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        studyItem.isCorrect
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}>
                        {studyItem.isCorrect ? `✓ ${t.study.mastered}` : `✕ ${t.study.missed}`}
                      </span>
                    )}

                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">
                      {q.serviceTags.slice(0, 2).join(', ')}
                    </span>
                  </div>

                  <button
                    onClick={() => handleToggleBookmark(q.id)}
                    className={`flex items-center justify-center min-w-[38px] min-h-[38px] -mr-1 -mt-1 p-2 rounded-lg text-slate-400 hover:text-blue-600 transition-all touch-manipulation active:scale-90 ${
                      isBookmarked ? 'text-blue-600 dark:text-blue-400' : ''
                    }`}
                    title="Toggle Bookmark"
                    aria-label="Toggle Bookmark"
                  >
                    <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
                  {q.text}
                </p>

                {/* Choices preview */}
                <div className="grid sm:grid-cols-2 gap-2 pt-2 text-xs">
                  {q.choiceKeys.map(k => {
                    const isCorrect = q.answer.includes(k);
                    return (
                      <div
                        key={k}
                        className={`p-2 rounded border leading-snug flex items-start gap-2 ${
                          isCorrect
                            ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 font-medium'
                            : 'border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className={`font-mono font-bold ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                          {k}.
                        </span>
                        <span className="flex-1">{q.choices[k]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
