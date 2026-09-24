import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Question, StudyProgress, ConfidenceLevel } from '../core/types';

import { evaluateAnswer } from '../core/examEngine';
import { storage } from '../core/storage';
import { learnerApi, getStoredToken } from '../core/api';
import { recordStudyAttempt } from '../core/learningEngine';
import { QuestionPrompt } from '../components/QuestionPrompt';
import { OptionsList } from '../components/OptionsList';
import { ExplanationPanel } from '../components/ExplanationPanel';
import { QuestionNavigator } from '../components/QuestionNavigator';
import { ConfidenceSelector } from '../components/ConfidenceSelector';
import { QuestionNotesEditor } from '../components/QuestionNotesEditor';
import { ResetAllStudyModal } from '../components/ResetAllStudyModal';
import { isTypingInInput } from '../core/noteFormatter';
import { 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Check, 
  Grid
} from 'lucide-react';
import { useLanguage } from '../context/useLanguage';

interface StudyViewProps {
  questions: Question[];
  initialIndex?: number;
  onExit: () => void;
}

export const StudyView: React.FC<StudyViewProps> = ({
  questions,
  initialIndex = 0,
}) => {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [studyProgress, setStudyProgress] = useState<StudyProgress>(() => storage.getStudyProgress());
  const [bookmarks, setBookmarks] = useState<number[]>(() => storage.getBookmarks());
  const [markedMap, setMarkedMap] = useState<Record<number, boolean>>({});
  const [isNavOpenMobile, setIsNavOpenMobile] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'incorrect' | 'bookmarked'>('all');
  const [isResetAllModalOpen, setIsResetAllModalOpen] = useState(false);
  const [questionResetVersion, setQuestionResetVersion] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-dismiss toast notification
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Filter questions based on filterMode
  const filteredQuestions = React.useMemo(() => {
    if (filterMode === 'bookmarked') {
      const bSet = new Set(bookmarks);
      return questions.filter(q => bSet.has(q.id));
    }
    if (filterMode === 'incorrect') {
      return questions.filter(q => {
        const item = studyProgress.items[q.id];
        return item && item.isSubmitted && !item.isCorrect;
      });
    }
    return questions;
  }, [questions, filterMode, bookmarks, studyProgress]);

  // Ensure currentIndex stays within bounds
  const activeQuestions = filteredQuestions.length > 0 ? filteredQuestions : questions;
  const safeIndex = Math.min(Math.max(0, currentIndex), activeQuestions.length - 1);
  const currentQuestion = activeQuestions[safeIndex] || questions[0];

  const currentItemProgress = studyProgress.items[currentQuestion.id] || {
    selectedAnswer: '',
    isSubmitted: false,
    isCorrect: false,
    attemptsCount: 0,
    lastAttemptedAt: 0,
  };

  const isRevealed = currentItemProgress.isSubmitted;
  const isBookmarked = bookmarks.includes(currentQuestion.id);
  const isMarked = !!markedMap[currentQuestion.id];

  // Sync active question state with AI Tutor
  useEffect(() => {
    if (currentQuestion) {
      window.dispatchEvent(
        new CustomEvent('aws_active_question_changed', {
          detail: {
            question: currentQuestion,
            selectedAnswer: currentItemProgress.selectedAnswer,
            isSubmitted: currentItemProgress.isSubmitted,
            isCorrect: currentItemProgress.isCorrect,
            userNotes: storage.getNote(currentQuestion.id)?.noteText || '',
          },
        })
      );
    }
  }, [
    currentQuestion,
    currentItemProgress.selectedAnswer,
    currentItemProgress.isSubmitted,
    currentItemProgress.isCorrect,
  ]);

  // Option selection logic
  const handleSelectOption = (choiceKey: string) => {
    if (isRevealed) return;

    let newAnswer = '';
    if (currentQuestion.isMultiSelect) {
      const set = new Set(currentItemProgress.selectedAnswer.split(''));
      if (set.has(choiceKey)) {
        set.delete(choiceKey);
      } else {
        set.add(choiceKey);
      }
      newAnswer = Array.from(set).sort().join('');
    } else {
      newAnswer = choiceKey;
    }

    const updated: StudyProgress = {
      ...studyProgress,
      items: {
        ...studyProgress.items,
        [currentQuestion.id]: {
          ...currentItemProgress,
          selectedAnswer: newAnswer,
        },
      },
    };
    setStudyProgress(updated);
    storage.saveStudyProgress(updated);
  };

  // Confidence level handler
  const handleConfidenceChange = (level: ConfidenceLevel) => {
    const updated: StudyProgress = {
      ...studyProgress,
      items: {
        ...studyProgress.items,
        [currentQuestion.id]: {
          ...currentItemProgress,
          confidence: level,
        },
      },
    };
    setStudyProgress(updated);
    storage.saveStudyProgress(updated);
  };

  // Check / Submit current answer
  const handleSubmitAnswer = () => {
    if (!currentItemProgress.selectedAnswer || isRevealed) return;

    const isCorrect = evaluateAnswer(currentItemProgress.selectedAnswer, currentQuestion.answer);
    const confidence = currentItemProgress.confidence || 'medium';
    recordStudyAttempt(currentQuestion.id, isCorrect, confidence);

    const updated: StudyProgress = {
      ...studyProgress,
      items: {
        ...studyProgress.items,
        [currentQuestion.id]: {
          ...currentItemProgress,
          isSubmitted: true,
          isCorrect,
          confidence,
          attemptsCount: currentItemProgress.attemptsCount + 1,
          lastAttemptedAt: Date.now(),
        },
      },
    };
    setStudyProgress(updated);
    storage.saveStudyProgress(updated);

    // Sync to backend database if logged in
    if (getStoredToken()) {
      learnerApi.saveProgress({
        questionId: currentQuestion.id,
        selectedAnswer: currentItemProgress.selectedAnswer,
        isSubmitted: true,
        isCorrect,
        confidence,
      }).catch(() => {
        setTimeout(() => {
          if (getStoredToken()) {
            learnerApi.saveProgress({
              questionId: currentQuestion.id,
              selectedAnswer: currentItemProgress.selectedAnswer,
              isSubmitted: true,
              isCorrect,
              confidence,
            }).catch(() => {});
          }
        }, 1200);
      });
    }
  };

  // Total answered questions count in study mode
  const totalAnsweredCount = React.useMemo(() => {
    return Object.values(studyProgress.items).filter(
      (it) => it.isSubmitted || Boolean(it.selectedAnswer)
    ).length;
  }, [studyProgress]);

  // Reset current question
  const handleResetQuestion = () => {
    const updated: StudyProgress = {
      ...studyProgress,
      items: {
        ...studyProgress.items,
      },
    };
    delete updated.items[currentQuestion.id];
    setStudyProgress(updated);
    storage.resetQuestionProgress(currentQuestion.id);

    if (getStoredToken()) {
      learnerApi.resetProgress(currentQuestion.id).catch(() => {});
    }

    setQuestionResetVersion((v) => v + 1);
    setToastMessage(`${t.study.resetSuccess} (Câu #${currentQuestion.id})`);
  };

  // Reset all questions in study mode
  const handleResetAllQuestions = () => {
    storage.resetStudyProgress();
    setStudyProgress({ currentIndex: 0, items: {} });

    if (getStoredToken()) {
      learnerApi.resetProgress().catch(() => {});
    }

    setQuestionResetVersion((v) => v + 1);
    setToastMessage(t.study.resetAllSuccess);
  };

  // Toggle bookmark
  const handleToggleBookmark = () => {
    storage.toggleBookmark(currentQuestion.id);
    setBookmarks(storage.getBookmarks());

    if (getStoredToken()) {
      learnerApi.toggleBookmark(currentQuestion.id).catch(() => {});
    }
  };

  // Toggle mark for review
  const handleToggleMark = () => {
    setMarkedMap(prev => ({
      ...prev,
      [currentQuestion.id]: !prev[currentQuestion.id],
    }));
  };

  // Navigation
  const handlePrev = useCallback(() => {
    if (safeIndex > 0) {
      setCurrentIndex(safeIndex - 1);
    }
  }, [safeIndex]);

  const handleNext = useCallback(() => {
    if (safeIndex < activeQuestions.length - 1) {
      setCurrentIndex(safeIndex + 1);
    }
  }, [safeIndex, activeQuestions.length]);

  // Use ref for stable hotkey execution
  const actionsRef = useRef({
    handleSelectOption,
    handleSubmitAnswer,
    handlePrev,
    handleNext,
    handleToggleBookmark,
    handleToggleMark,
    currentQuestion,
    isRevealed,
  });

  useEffect(() => {
    actionsRef.current = {
      handleSelectOption,
      handleSubmitAnswer,
      handlePrev,
      handleNext,
      handleToggleBookmark,
      handleToggleMark,
      currentQuestion,
      isRevealed,
    };
  });

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput(e.target)) return;

      const {
        handleSelectOption: selectOpt,
        handleSubmitAnswer: submitAns,
        handlePrev: prevFn,
        handleNext: nextFn,
        handleToggleBookmark: toggleBm,
        handleToggleMark: toggleMk,
        currentQuestion: curQ,
        isRevealed: revealed,
      } = actionsRef.current;

      const key = e.key.toUpperCase();

      if (['1', '2', '3', '4', '5', '6'].includes(key)) {
        const idx = parseInt(key, 10) - 1;
        if (idx < curQ.choiceKeys.length) {
          selectOpt(curQ.choiceKeys[idx]);
        }
      } else if (['A', 'B', 'C', 'D', 'E', 'F'].includes(key)) {
        if (curQ.choiceKeys.includes(key)) {
          selectOpt(key);
        }
      } else if (e.key === 'ArrowLeft' || key === 'P') {
        prevFn();
      } else if (e.key === 'ArrowRight' || key === 'N') {
        nextFn();
      } else if (key === 'M') {
        toggleMk();
      } else if (key === 'B') {
        toggleBm();
      } else if (e.key === 'Enter') {
        if (!revealed) {
          submitAns();
        } else {
          nextFn();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Build maps for QuestionNavigator
  const navigatorAnswers: Record<number, string> = {};
  const navigatorResults: Record<number, boolean> = {};

  for (const q of activeQuestions) {
    const prog = studyProgress.items[q.id];
    if (prog && prog.selectedAnswer) {
      navigatorAnswers[q.id] = prog.selectedAnswer;
    }
    if (prog && prog.isSubmitted) {
      navigatorResults[q.id] = prog.isCorrect;
    }
  }

  const questionIds = activeQuestions.map(q => q.id);

  return (
    <div className="flex-1 flex w-full">
      {/* Main Study Content Area */}
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col justify-between">
        <div>
          {/* Top Bar: Filter & Navigator Trigger */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 mb-5">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
              <span className="hidden sm:inline text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                {t.study.filter}
              </span>
              <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5 text-xs shrink-0">
                <button
                  onClick={() => { setFilterMode('all'); setCurrentIndex(0); }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filterMode === 'all'
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t.study.all} ({questions.length})
                </button>
                <button
                  onClick={() => { setFilterMode('incorrect'); setCurrentIndex(0); }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filterMode === 'incorrect'
                      ? 'bg-red-600 text-white font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t.study.incorrect}
                </button>
                <button
                  onClick={() => { setFilterMode('bookmarked'); setCurrentIndex(0); }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filterMode === 'bookmarked'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t.study.bookmarked} ({bookmarks.length})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Reset All Questions in Study Mode */}
              <button
                type="button"
                onClick={() => setIsResetAllModalOpen(true)}
                disabled={totalAnsweredCount === 0}
                title={t.study.resetAllQuestions}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[36px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.study.resetAllQuestions}</span>
                {totalAnsweredCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-rose-200/80 dark:bg-rose-900/80 px-1.5 py-0.2 text-[10px] font-bold text-rose-800 dark:text-rose-200">
                    {totalAnsweredCount}
                  </span>
                )}
              </button>

              {/* Mobile Navigator Trigger */}
              <button
                type="button"
                onClick={() => setIsNavOpenMobile(true)}
                className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[36px]"
              >
                <Grid className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>{t.study.navigator}</span>
              </button>
            </div>
          </div>

          {activeQuestions.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl space-y-3">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {t.study.noQuestionsFound}
              </p>
              <button
                onClick={() => setFilterMode('all')}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              >
                {t.study.resetFilter}
              </button>
            </div>
          ) : (
            <>
              {/* Question Prompt */}
              <QuestionPrompt
                question={currentQuestion}
                index={safeIndex}
                total={activeQuestions.length}
                isMarked={isMarked}
                isBookmarked={isBookmarked}
                onToggleMark={handleToggleMark}
                onToggleBookmark={handleToggleBookmark}
                onResetQuestion={handleResetQuestion}
                showReset={true}
              />

              {/* Options */}
              <OptionsList
                key={`${currentQuestion.id}_${questionResetVersion}`}
                question={currentQuestion}
                selectedAnswer={currentItemProgress.selectedAnswer}
                onSelectOption={handleSelectOption}
                isRevealed={isRevealed}
                disabled={isRevealed}
              />

              {/* Confidence Selector before/when checking */}
              {!isRevealed && currentItemProgress.selectedAnswer && (
                <div className="mt-4">
                  <ConfidenceSelector
                    value={currentItemProgress.confidence}
                    onChange={handleConfidenceChange}
                  />
                </div>
              )}

              {/* Explanation & Rationale when Revealed */}
              {isRevealed && (
                <>
                  <ExplanationPanel
                    question={currentQuestion}
                    isCorrect={currentItemProgress.isCorrect}
                    userAnswer={currentItemProgress.selectedAnswer}
                  />
                  {currentItemProgress.confidence && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{t.study.confidenceSelf}</span>
                      <span className="font-bold uppercase text-slate-700 dark:text-slate-300">
                        {currentItemProgress.confidence}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Personal Notes Editor */}
              <QuestionNotesEditor
                key={currentQuestion.id}
                questionId={currentQuestion.id}
              />
            </>
          )}
        </div>

        {/* Bottom Action Footer */}
        {activeQuestions.length > 0 && (
          <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={safeIndex === 0}
                className="flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 touch-manipulation"
                title={t.exam.previous}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{t.exam.previous}</span>
              </button>

              <button
                onClick={handleNext}
                disabled={safeIndex === activeQuestions.length - 1}
                className="flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 touch-manipulation"
                title={t.exam.next}
              >
                <span>{t.exam.next}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {isRevealed ? (
                <button
                  type="button"
                  onClick={handleResetQuestion}
                  className="flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 touch-manipulation"
                  title={t.study.retryQuestion}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{t.study.retryQuestion}</span>
                </button>
              ) : (
                <>
                  {currentItemProgress.selectedAnswer && (
                    <button
                      type="button"
                      onClick={handleResetQuestion}
                      className="flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-all active:scale-95 touch-manipulation"
                      title={t.study.clearSelection}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t.study.clearSelection}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSubmitAnswer}
                    disabled={!currentItemProgress.selectedAnswer}
                    className="flex items-center justify-center gap-1.5 min-h-[44px] px-5 sm:px-6 py-2.5 rounded-lg text-xs sm:text-sm font-bold bg-[#EC7211] hover:bg-[#D96509] text-white dark:bg-[#FF9900] dark:hover:bg-[#E58900] dark:text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 touch-manipulation shadow-xs"
                    title={t.study.checkAnswer}
                  >
                    <Check className="w-4 h-4" />
                    <span>{t.study.checkAnswer}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Desktop Persistent / Mobile Drawer Navigator */}
      <QuestionNavigator
        questionIds={questionIds}
        currentIndex={safeIndex}
        answers={navigatorAnswers}
        markedForReview={markedMap}
        onSelectQuestion={(idx) => setCurrentIndex(idx)}
        isOpenMobile={isNavOpenMobile}
        onCloseMobile={() => setIsNavOpenMobile(false)}
        resultsMap={navigatorResults}
        questions={activeQuestions}
      />

      {/* Reset All Study Progress Confirmation Modal */}
      <ResetAllStudyModal
        isOpen={isResetAllModalOpen}
        totalAnswered={totalAnsweredCount}
        totalQuestions={questions.length}
        onClose={() => setIsResetAllModalOpen(false)}
        onConfirm={handleResetAllQuestions}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-slate-900/95 text-white dark:bg-slate-100 dark:text-slate-900 px-4 py-2.5 text-xs font-semibold shadow-2xl border border-white/10 dark:border-slate-800/10 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <RotateCcw className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
