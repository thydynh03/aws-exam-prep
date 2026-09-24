import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Question, ExamSession, ExamResult } from '../core/types';
import { calculateExamResult } from '../core/examEngine';
import { storage } from '../core/storage';
import { learnerApi, getStoredToken } from '../core/api';
import { OptionsList } from '../components/OptionsList';
import { ConfirmSubmitModal } from '../components/ConfirmSubmitModal';
import { PearsonReviewScreen } from '../components/PearsonReviewScreen';
import { ExamHelpModal } from '../components/ExamHelpModal';
import { ExitExamModal } from '../components/ExitExamModal';
import { ContentDomainBadge } from '../components/ContentDomainBadge';
import { QuestionNavigator } from '../components/QuestionNavigator';
import { isTypingInInput } from '../core/noteFormatter';
import { 
  ChevronLeft, 
  ChevronRight, 
  Flag, 
  RotateCcw,
  LayoutGrid,
  HelpCircle,
  LogOut
} from 'lucide-react';
import { useLanguage } from '../context/useLanguage';


interface ExamViewProps {
  questions: Question[];
  initialSession?: ExamSession | null;
  totalDurationSeconds?: number;
  onExamSubmitted: (result: ExamResult, session: ExamSession) => void;
  onExitExam: () => void;
  isPaused: boolean;
  timeRemaining: number;
  setTimeRemaining: React.Dispatch<React.SetStateAction<number>>;
}

export const ExamView: React.FC<ExamViewProps> = ({
  questions,
  initialSession,
  totalDurationSeconds = 130 * 60, // 130 minutes for 65 questions (AWS SAA standard)
  onExamSubmitted,
  onExitExam,
  isPaused,
  timeRemaining,
  setTimeRemaining,
}) => {
  const { language, t } = useLanguage();
  // Setup exam session
  const [session, setSession] = useState<ExamSession>(() => {
    if (initialSession && initialSession.status === 'running') {
      return initialSession;
    }
    const newSession: ExamSession = {
      id: `session_${Date.now()}`,
      startedAt: Date.now(),
      durationSeconds: totalDurationSeconds,
      timeRemainingSeconds: totalDurationSeconds,
      status: 'running',
      questionIds: questions.map(q => q.id),
      currentIndex: 0,
      answers: {},
      markedForReview: {},
    };
    storage.saveActiveExam(newSession);
    return newSession;
  });

  const [currentIndex, setCurrentIndex] = useState(session.currentIndex || 0);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isReviewScreenOpen, setIsReviewScreenOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isNavOpenMobile, setIsNavOpenMobile] = useState(false);

  const handlePauseAndExit = useCallback(() => {
    setIsExitModalOpen(false);
    const pausedSession: ExamSession = {
      ...session,
      timeRemainingSeconds: timeRemaining,
      status: 'paused',
    };
    storage.saveActiveExam(pausedSession);
    onExitExam();
  }, [session, timeRemaining, onExitExam]);

  const handleDiscardAndExit = useCallback(() => {
    setIsExitModalOpen(false);
    storage.clearActiveExam();
    onExitExam();
  }, [onExitExam]);

  // Question lookup
  const total = questions.length;
  const currentQuestionId = session.questionIds[currentIndex] || questions[0]?.id;
  const currentQuestion = questions.find(q => q.id === currentQuestionId) || questions[0];

  const currentAnswer = session.answers[currentQuestion.id] || '';
  const isMarked = !!session.markedForReview[currentQuestion.id];

  // Sync active question state with AI Tutor
  useEffect(() => {
    if (currentQuestion) {
      window.dispatchEvent(
        new CustomEvent('aws_active_question_changed', {
          detail: {
            question: currentQuestion,
            selectedAnswer: currentAnswer,
            isSubmitted: false,
            isCorrect: false,
            userNotes: storage.getNote(currentQuestion.id)?.noteText || '',
          },
        })
      );
    }
  }, [currentQuestion, currentAnswer]);

  // Save session updates
  const updateSession = useCallback((updater: (prev: ExamSession) => ExamSession) => {
    setSession(prev => {
      const next = updater(prev);
      storage.saveActiveExam(next);
      return next;
    });
  }, []);

  // Submit Exam
  const handleFinalSubmit = useCallback(() => {
    setIsSubmitModalOpen(false);
    const finalSession: ExamSession = {
      ...session,
      timeRemainingSeconds: timeRemaining,
      status: 'submitted',
      submittedAt: Date.now(),
    };

    const result = calculateExamResult(finalSession, questions, totalDurationSeconds);
    finalSession.result = result;

    // Save to exam history and remove active session
    storage.saveExamAttempt(result);
    storage.clearActiveExam();

    // Also update local study progress with questions answered during exam
    const currentProg = storage.getStudyProgress();
    const updatedItems = { ...currentProg.items };
    for (const qr of result.questionResults) {
      if (qr.userAnswer && qr.userAnswer.trim()) {
        updatedItems[qr.questionId] = {
          selectedAnswer: qr.userAnswer,
          isSubmitted: true,
          isCorrect: qr.isCorrect,
          confidence: 'medium',
          attemptsCount: (updatedItems[qr.questionId]?.attemptsCount || 0) + 1,
          lastAttemptedAt: Date.now(),
        };
      }
    }
    storage.saveStudyProgress({
      ...currentProg,
      items: updatedItems,
    });

    if (getStoredToken()) {
      learnerApi.saveExam(result).catch(() => {});
      learnerApi.migrateLocal(updatedItems, storage.getAllNotes(), storage.getBookmarks(), [result]).catch(() => {});
    }

    onExamSubmitted(result, finalSession);
  }, [session, timeRemaining, questions, totalDurationSeconds, onExamSubmitted]);

  // Actions Ref for stable event handling
  const actionsRef = useRef({
    handleFinalSubmit,
    updateSession,
    setTimeRemaining,
  });

  useEffect(() => {
    actionsRef.current = {
      handleFinalSubmit,
      updateSession,
      setTimeRemaining,
    };
  });

  // Timer countdown hook
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      actionsRef.current.setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          actionsRef.current.handleFinalSubmit();
          return 0;
        }
        const nextTime = prev - 1;
        if (nextTime % 5 === 0) {
          actionsRef.current.updateSession(s => ({ ...s, timeRemainingSeconds: nextTime }));
        }
        return nextTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused]);

  // Option selection
  const handleSelectOption = (choiceKey: string) => {
    let newAnswer = '';
    if (currentQuestion.isMultiSelect) {
      const set = new Set(currentAnswer.split(''));
      if (set.has(choiceKey)) {
        set.delete(choiceKey);
      } else {
        set.add(choiceKey);
      }
      newAnswer = Array.from(set).sort().join('');
    } else {
      newAnswer = choiceKey;
    }

    updateSession(prev => ({
      ...prev,
      answers: {
        ...prev.answers,
        [currentQuestion.id]: newAnswer,
      },
    }));
  };

  // Clear answer for current question
  const handleClearAnswer = () => {
    updateSession(prev => {
      const answers = { ...prev.answers };
      delete answers[currentQuestion.id];
      return {
        ...prev,
        answers,
      };
    });
  };

  // Toggle mark for review
  const handleToggleMark = () => {
    updateSession(prev => ({
      ...prev,
      markedForReview: {
        ...prev.markedForReview,
        [currentQuestion.id]: !prev.markedForReview[currentQuestion.id],
      },
    }));
  };

  // Navigation
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      const nextIdx = currentIndex - 1;
      setCurrentIndex(nextIdx);
      updateSession(s => ({ ...s, currentIndex: nextIdx }));
    }
  }, [currentIndex, updateSession]);

  const handleNext = useCallback(() => {
    if (currentIndex < total - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      updateSession(s => ({ ...s, currentIndex: nextIdx }));
    } else {
      // Reached the end of 65 questions -> take user to Pearson VUE Review Screen
      setIsReviewScreenOpen(true);
    }
  }, [currentIndex, total, updateSession]);

  const handleJumpToQuestion = (index: number) => {
    setCurrentIndex(index);
    updateSession(s => ({ ...s, currentIndex: index }));
    setIsReviewScreenOpen(false);
  };

  // Review Actions
  const handleReviewAll = () => {
    setCurrentIndex(0);
    setIsReviewScreenOpen(false);
  };

  const handleReviewIncomplete = () => {
    for (let i = 0; i < total; i++) {
      const id = questions[i].id;
      if (!session.answers[id] || session.answers[id].trim().length === 0) {
        setCurrentIndex(i);
        setIsReviewScreenOpen(false);
        return;
      }
    }
    // If none incomplete, go to 0
    setCurrentIndex(0);
    setIsReviewScreenOpen(false);
  };

  const handleReviewMarked = () => {
    for (let i = 0; i < total; i++) {
      const id = questions[i].id;
      if (session.markedForReview[id]) {
        setCurrentIndex(i);
        setIsReviewScreenOpen(false);
        return;
      }
    }
    setCurrentIndex(0);
    setIsReviewScreenOpen(false);
  };

  // Keyboard navigation ref
  const keyNavRef = useRef({
    currentQuestion,
    handleSelectOption,
    handlePrev,
    handleNext,
    handleToggleMark,
    isSubmitModalOpen,
    isReviewScreenOpen,
  });

  useEffect(() => {
    keyNavRef.current = {
      currentQuestion,
      handleSelectOption,
      handlePrev,
      handleNext,
      handleToggleMark,
      isSubmitModalOpen,
      isReviewScreenOpen,
    };
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput(e.target)) return;
      if (keyNavRef.current.isSubmitModalOpen) return;

      const {
        currentQuestion: curQ,
        handleSelectOption: selectOpt,
        handlePrev: prevFn,
        handleNext: nextFn,
        handleToggleMark: toggleMk,
        isReviewScreenOpen: isReview,
      } = keyNavRef.current;

      if (isReview) return;

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Stats for submission confirmation
  let answeredCount = 0;
  let markedCount = 0;
  for (const q of questions) {
    if (session.answers[q.id] && session.answers[q.id].trim().length > 0) {
      answeredCount++;
    }
    if (session.markedForReview[q.id]) {
      markedCount++;
    }
  }
  const unansweredCount = total - answeredCount;

  // If user is viewing the Pearson VUE Review Screen
  if (isReviewScreenOpen) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-y-auto min-h-0">
        <PearsonReviewScreen
          questions={questions}
          currentIndex={currentIndex}
          answers={session.answers}
          markedForReview={session.markedForReview}
          timeRemaining={timeRemaining}
          onSelectQuestion={handleJumpToQuestion}
          onReviewAll={handleReviewAll}
          onReviewIncomplete={handleReviewIncomplete}
          onReviewMarked={handleReviewMarked}
          onEndExam={() => setIsSubmitModalOpen(true)}
          onBackToCurrentQuestion={() => setIsReviewScreenOpen(false)}
        />

        <ConfirmSubmitModal
          isOpen={isSubmitModalOpen}
          totalQuestions={total}
          answeredCount={answeredCount}
          unansweredCount={unansweredCount}
          markedCount={markedCount}
          timeRemaining={timeRemaining}
          onCancel={() => setIsSubmitModalOpen(false)}
          onConfirmSubmit={handleFinalSubmit}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F3F4F6] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 h-full overflow-hidden min-h-0">
      {/* Pearson VUE Question Sub-Header / Control Strip */}
      <div className="flex-shrink-0 border-b border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-8 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 shadow-xs z-10">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
            {t.exam.questionOf.replace('{current}', String(currentIndex + 1)).replace('{total}', String(total))}
          </span>
          <span className="hidden xs:inline text-slate-400">•</span>
          <ContentDomainBadge domain={currentQuestion.domain} size="sm" />
          <span className="hidden md:inline text-slate-400">•</span>
          <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-none">
            {currentQuestion.serviceTags.slice(0, 2).join(', ')}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Mobile / Tablet Question Navigator Trigger */}
          <button
            type="button"
            onClick={() => setIsNavOpenMobile(true)}
            className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 min-h-[36px] sm:min-h-[32px] rounded text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 transition-colors active:scale-95 touch-manipulation"
            title={language === 'vi' ? 'Mở bảng câu hỏi' : 'Open Question Navigator'}
          >
            <LayoutGrid className="w-3.5 h-3.5 text-[#002D62] dark:text-[#FF9900]" />
            <span className="hidden xs:inline">{language === 'vi' ? 'Bảng câu hỏi' : 'Questions'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-mono">
              {answeredCount}/{total}
            </span>
          </button>

          {/* Reference / Acronyms Help Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsHelpModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 min-h-[36px] sm:min-h-[32px] rounded text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 transition-colors active:scale-95 touch-manipulation"
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline">{t.exam.helpGlossary}</span>
          </button>

          {/* Pearson VUE Standard: Mark for Review Checkbox */}
          <label 
            htmlFor="mark-for-review-checkbox"
            className="flex items-center gap-1.5 cursor-pointer select-none px-2.5 py-1.5 sm:py-1 min-h-[36px] sm:min-h-[32px] rounded border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors touch-manipulation"
          >
            <input
              id="mark-for-review-checkbox"
              type="checkbox"
              checked={isMarked}
              onChange={handleToggleMark}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-600 dark:bg-slate-800 cursor-pointer"
            />
            <span className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <Flag className={`w-3.5 h-3.5 ${isMarked ? 'text-amber-500 fill-current' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">{t.exam.markForReviewHelp}</span>
            </span>
          </label>

          {/* Exit / Pause Exam Button */}
          <button
            type="button"
            onClick={() => setIsExitModalOpen(true)}
            title={language === 'vi' ? 'Tạm dừng hoặc thoát bài thi' : 'Pause or exit exam'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 min-h-[36px] sm:min-h-[32px] rounded text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 transition-colors active:scale-95 touch-manipulation ml-0.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Thoát' : 'Exit'}</span>
          </button>
        </div>
      </div>

      {/* Main Question Testing Canvas (Pearson VUE Layout) with Right Persistent Question Navigator */}
      <div className="flex-1 flex w-full overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col h-full min-w-0 min-h-0 overflow-hidden">
          {/* Scrollable Question & Options Content */}
          <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 overscroll-contain">
            <div className="max-w-4xl mx-auto space-y-5">
              {/* Question Text Prompt */}
              <div className="border-b border-slate-300 dark:border-slate-800 pb-5">
                <div className="text-sm sm:text-base text-slate-900 dark:text-slate-100 leading-relaxed whitespace-pre-line font-normal tracking-tight">
                  {currentQuestion.text}
                </div>

                {/* Instruction line */}
                <div className="mt-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                  {currentQuestion.isMultiSelect ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                      {currentQuestion.expectedChoicesCount === 2 
                        ? t.exam.selectTwoInstruction 
                        : currentQuestion.expectedChoicesCount === 3 
                        ? t.exam.selectThreeInstruction 
                        : t.exam.selectCountInstruction.replace('{count}', String(currentQuestion.expectedChoicesCount))}
                    </span>
                  ) : (
                    <span className="italic text-slate-600 dark:text-slate-400">
                      {t.exam.selectOneInstruction}
                    </span>
                  )}
                </div>
              </div>

              {/* Answer Options */}
              <OptionsList
                question={currentQuestion}
                selectedAnswer={currentAnswer}
                onSelectOption={handleSelectOption}
                isRevealed={false}
              />
            </div>
          </main>

          {/* Bottom Status & Navigation Footer (Pearson VUE Style) - ALWAYS PINNED AT BOTTOM */}
          <footer className="flex-shrink-0 border-t border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-8 py-2.5 z-10 shadow-xs">
            <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
              {/* Left: Review Screen Button */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setIsReviewScreenOpen(true)}
                  className="flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation shadow-xs"
                >
                  <LayoutGrid className="w-4 h-4 text-[#002D62] dark:text-[#FF9900]" />
                  <span>{t.exam.reviewScreen}</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                    {answeredCount}/{total}
                  </span>
                </button>

                {/* Exit / Pause Exam Button */}
                <button
                  type="button"
                  onClick={() => setIsExitModalOpen(true)}
                  className="flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-semibold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation shadow-xs"
                  title={language === 'vi' ? 'Tạm dừng hoặc thoát bài thi' : 'Pause or exit exam'}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{language === 'vi' ? 'Thoát bài thi' : 'Exit Exam'}</span>
                </button>

                {currentAnswer && (
                  <button
                    onClick={handleClearAnswer}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center gap-1 min-h-[38px] px-2.5 py-1 rounded-lg transition-colors active:scale-95 touch-manipulation"
                    title={t.exam.clearResponse}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t.exam.clearResponse}</span>
                  </button>
                )}
              </div>

              {/* Right: Previous & Next / Review */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="flex items-center justify-center gap-1 min-h-[38px] px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 touch-manipulation shadow-xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{t.exam.previous}</span>
                </button>

                {currentIndex === total - 1 ? (
                  <button
                    onClick={() => setIsReviewScreenOpen(true)}
                    className="flex items-center justify-center gap-1 min-h-[38px] px-5 py-1.5 rounded-lg bg-[#002D62] hover:bg-[#001D40] text-white dark:bg-[#FF9900] dark:hover:bg-[#E58900] dark:text-slate-950 font-bold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation shadow-sm"
                  >
                    <span>{t.exam.goToReviewScreen}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="flex items-center justify-center gap-1 min-h-[38px] px-5 py-1.5 rounded-lg bg-[#002D62] hover:bg-[#001D40] text-white dark:bg-[#FF9900] dark:hover:bg-[#E58900] dark:text-slate-950 font-bold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation shadow-sm"
                  >
                    <span>{t.exam.next}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </footer>
        </div>

        {/* Desktop Persistent Sidebar & Mobile Drawer Navigator */}
        <QuestionNavigator
          questionIds={session.questionIds}
          currentIndex={currentIndex}
          answers={session.answers}
          markedForReview={session.markedForReview}
          onSelectQuestion={handleJumpToQuestion}
          isOpenMobile={isNavOpenMobile}
          onCloseMobile={() => setIsNavOpenMobile(false)}
          questions={questions}
        />
      </div>

      {/* Confirmation Modal */}
      <ConfirmSubmitModal
        isOpen={isSubmitModalOpen}
        totalQuestions={total}
        answeredCount={answeredCount}
        unansweredCount={unansweredCount}
        markedCount={markedCount}
        timeRemaining={timeRemaining}
        onCancel={() => setIsSubmitModalOpen(false)}
        onConfirmSubmit={handleFinalSubmit}
      />

      {/* Help & Acronyms Reference Modal */}
      <ExamHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      {/* Exit Exam Confirmation Modal */}
      <ExitExamModal
        isOpen={isExitModalOpen}
        totalQuestions={total}
        answeredCount={answeredCount}
        timeRemaining={timeRemaining}
        onCancel={() => setIsExitModalOpen(false)}
        onPauseAndExit={handlePauseAndExit}
        onDiscardAndExit={handleDiscardAndExit}
      />
    </div>
  );
};
