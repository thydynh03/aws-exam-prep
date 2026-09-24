import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { questionRepository } from './core/questionRepository';
import { storage } from './core/storage';
import { questionsApi, syncLocalProgressToServer } from './core/api';
import type { 
  AppMode, 
  ExamSession, 
  ExamResult, 
  Question, 
  AWSDomain 
} from './core/types';
import { isTypingInInput } from './core/noteFormatter';
import { liveTracker } from './core/liveTracker';
import { Home, BookOpen, Layers, AlertOctagon, Bot, Network } from 'lucide-react';
import { Header } from './components/Header';
import { HomeView } from './views/HomeView';
import { LoginModal } from './components/LoginModal';
import { AITutorChatbox } from './components/ai/AITutorChatbox';
import { FloatingDiagramLauncher } from './components/diagram/FloatingDiagramLauncher';
import { AIChatWindowView } from './views/AIChatWindowView';
import { isChatPopoutWindow, writePopoutContext } from './core/chatWindow';

// Code-split heavy views and modals for sub-second load times
const StudyView = React.lazy(() => import('./views/StudyView').then(m => ({ default: m.StudyView })));
const ExamView = React.lazy(() => import('./views/ExamView').then(m => ({ default: m.ExamView })));
const ResultView = React.lazy(() => import('./views/ResultView').then(m => ({ default: m.ResultView })));
const ReviewView = React.lazy(() => import('./views/ReviewView').then(m => ({ default: m.ReviewView })));
const FlashcardsView = React.lazy(() => import('./views/FlashcardsView').then(m => ({ default: m.FlashcardsView })));
const ServiceExplorerView = React.lazy(() => import('./views/ServiceExplorerView').then(m => ({ default: m.ServiceExplorerView })));
const WeaknessPracticeView = React.lazy(() => import('./views/WeaknessPracticeView').then(m => ({ default: m.WeaknessPracticeView })));
const DomainPracticeView = React.lazy(() => import('./views/DomainPracticeView').then(m => ({ default: m.DomainPracticeView })));
const StudyPlanView = React.lazy(() => import('./views/StudyPlanView').then(m => ({ default: m.StudyPlanView })));
const AdminDashboardView = React.lazy(() => import('./views/AdminDashboardView').then(m => ({ default: m.AdminDashboardView })));

const GlobalSearchModal = React.lazy(() => import('./components/GlobalSearchModal').then(m => ({ default: m.GlobalSearchModal })));
const KeyboardShortcutsModal = React.lazy(() => import('./components/KeyboardShortcutsModal').then(m => ({ default: m.KeyboardShortcutsModal })));
const FeedbackModal = React.lazy(() => import('./components/FeedbackModal').then(m => ({ default: m.FeedbackModal })));
const QuestionSubmitModal = React.lazy(() => import('./components/QuestionSubmitModal').then(m => ({ default: m.QuestionSubmitModal })));
const DiagramWorkspaceModal = React.lazy(() => import('./components/diagram/DiagramWorkspaceModal').then(m => ({ default: m.DiagramWorkspaceModal })));

export const ViewLoadingFallback: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-8 text-center text-slate-500 dark:text-slate-400">
    <div className="w-10 h-10 border-3 border-[#FF9900]/20 border-t-[#FF9900] rounded-full animate-spin mb-4" />
    <p className="text-xs font-mono uppercase tracking-wider font-semibold">Đang tải dữ liệu mô-đun...</p>
  </div>
);

export const MainApp: React.FC = () => {
  const { user, isAuthenticated, isLoading: isAuthLoading, isAdmin } = useAuth();

  const [mode, setMode] = useState<AppMode>(() => {
    try {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'exam' && storage.getActiveExam()) {
        return 'exam';
      }
      if (['study', 'review', 'flashcards', 'services', 'weakness', 'domain', 'studyplan'].includes(hash)) {
        return hash as AppMode;
      }
    } catch {
      // Fallback
    }
    // Default to 'home' on reload or initial visit so users are never trapped in an exam!
    return 'home';
  });
  const [questions, setQuestions] = useState<Question[]>(() => questionRepository.getAllQuestions());
  const [standard32] = useState<Question[]>(() => questionRepository.getStandard32Questions());
  
  // Active session and results
  const [activeExamSession, setActiveExamSession] = useState<ExamSession | null>(() => storage.getActiveExam());
  const [activeResult, setActiveResult] = useState<ExamResult | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(() => {
    const savedExam = storage.getActiveExam();
    if (savedExam && savedExam.status === 'running') {
      return questionRepository.getQuestionsByIds(savedExam.questionIds);
    }
    return questionRepository.getStandard32Questions();
  });
  const [examDuration, setExamDuration] = useState<number>(() => {
    const savedExam = storage.getActiveExam();
    return savedExam?.durationSeconds || 64 * 60;
  });
  const [timeRemaining, setTimeRemaining] = useState<number>(() => {
    const savedExam = storage.getActiveExam();
    return savedExam?.timeRemainingSeconds || 64 * 60;
  });
  const [isTimerPaused, setIsTimerPaused] = useState(false);

  // Modals & triggers
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isQuestionSubmitOpen, setIsQuestionSubmitOpen] = useState(false);
  const [isAITutorOpen, setIsAITutorOpen] = useState(false);
  const [isDiagramOpen, setIsDiagramOpen] = useState(false);
  const [isDiagramMinimized, setIsDiagramMinimized] = useState(false);
  const [activeQuestionContext, setActiveQuestionContext] = useState<{
    question?: Question;
    selectedAnswer?: string;
    isSubmitted?: boolean;
    isCorrect?: boolean;
    userNotes?: string;
  }>({});
  const [adminDismissed, setAdminDismissed] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginModalAdminMode, setLoginModalAdminMode] = useState(false);

  // Đẩy ngữ cảnh câu hỏi hiện tại sang cửa sổ chat rời (/ai-chat)
  useEffect(() => {
    writePopoutContext({
      questionId: activeQuestionContext.question?.id,
      selectedAnswer: activeQuestionContext.selectedAnswer,
      isSubmitted: activeQuestionContext.isSubmitted,
      isCorrect: activeQuestionContext.isCorrect,
      userNotes: activeQuestionContext.userNotes,
      currentMode: mode,
    });
  }, [activeQuestionContext, mode]);

  // Sync open-diagram-workspace custom event
  useEffect(() => {
    const handleOpenDiagram = () => {
      setIsDiagramOpen(true);
      setIsDiagramMinimized(false);
    };
    window.addEventListener('open-diagram-workspace', handleOpenDiagram);
    return () => window.removeEventListener('open-diagram-workspace', handleOpenDiagram);
  }, []);

  // Sync active question context with AI Tutor assistant
  useEffect(() => {
    const handleActiveQuestionChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{
        question?: Question;
        selectedAnswer?: string;
        isSubmitted?: boolean;
        isCorrect?: boolean;
        userNotes?: string;
      }>;
      if (customEvent.detail) {
        setActiveQuestionContext({
          question: customEvent.detail.question,
          selectedAnswer: customEvent.detail.selectedAnswer,
          isSubmitted: customEvent.detail.isSubmitted,
          isCorrect: customEvent.detail.isCorrect,
          userNotes: customEvent.detail.userNotes,
        });
      }
    };
    const handleOpenAITutor = (e: Event) => {
      const customEvent = e as CustomEvent<{
        question?: Question;
        selectedAnswer?: string;
        isSubmitted?: boolean;
        isCorrect?: boolean;
        userNotes?: string;
      }>;
      if (customEvent.detail?.question) {
        setActiveQuestionContext({
          question: customEvent.detail.question,
          selectedAnswer: customEvent.detail.selectedAnswer,
          isSubmitted: customEvent.detail.isSubmitted,
          isCorrect: customEvent.detail.isCorrect,
          userNotes: customEvent.detail.userNotes,
        });
      }
      setIsAITutorOpen(true);
    };

    window.addEventListener('aws_active_question_changed', handleActiveQuestionChanged);
    window.addEventListener('aws_open_ai_tutor', handleOpenAITutor);
    return () => {
      window.removeEventListener('aws_active_question_changed', handleActiveQuestionChanged);
      window.removeEventListener('aws_open_ai_tutor', handleOpenAITutor);
    };
  }, []);

  // Initialize Realtime Learner & Guest Tracker
  useEffect(() => {
    liveTracker.init();
    return () => {
      liveTracker.destroy();
    };
  }, []);

  // Synchronize local progress, notes, bookmarks, and exam attempts to server when logged in
  useEffect(() => {
    if (isAuthenticated) {
      void syncLocalProgressToServer();
    }
  }, [isAuthenticated]);

  // Admin portal is active whenever user is Admin unless explicitly dismissed to view app
  const isAdminPortalOpen = isAdmin && !adminDismissed;

  // Sync mode & screen changes with Realtime Tracker
  useEffect(() => {
    if (isAdminPortalOpen) {
      liveTracker.setScreen('Bảng Quản Trị', 'Đang quản lý hệ thống & giám sát người học');
      return;
    }
    const screenNames: Record<AppMode, string> = {
      home: 'Trang chủ & Tổng quan',
      study: 'Chế độ Luyện tập 1019 câu',
      exam: 'Thi mô phỏng Pearson VUE',
      review: 'Xem lại & Thẻ ghi nhớ',
      flashcards: 'Học Leitner Flashcards',
      services: 'Khám phá dịch vụ AWS',
      weakness: 'Luyện tập câu điểm yếu',
      domain: 'Luyện theo Domain',
      studyplan: 'Kế hoạch ôn thi 14 ngày',
      result: 'Kết quả bài thi Pearson VUE',
    };
    const screenName = screenNames[mode] || 'Ứng dụng AWS Prep';
    const action = isAITutorOpen ? `Đang chat với AI Tutor tại ${screenName}` : `Đang học ở ${screenName}`;
    liveTracker.setScreen(screenName, action);
  }, [mode, isAdminPortalOpen, isAITutorOpen]);
  const [reviewInitialFilter, setReviewInitialFilter] = useState<'all' | 'incorrect' | 'bookmarked'>('all');
  const [flashcardsInitialDeck, setFlashcardsInitialDeck] = useState<string | undefined>(undefined);
  const [servicesInitialId, setServicesInitialId] = useState<string | undefined>(undefined);

  // Fetch and merge custom questions from server
  const loadCustomQuestions = useCallback(async () => {
    try {
      const res = await questionsApi.getCustomQuestions();
      const customList = res.customQuestions || res.questions || [];
      if (customList.length > 0) {
        const canonical = questionRepository.getAllQuestions();
        const existingIds = new Set(canonical.map(q => q.id));
        const newCustom = customList.filter((q: Question) => !existingIds.has(q.id));
        setQuestions([...canonical, ...newCustom]);
      }
    } catch (err) {
      console.warn('Lỗi nạp câu hỏi tùy chỉnh:', err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (isAuthenticated) {
      const load = async () => {
        try {
          const res = await questionsApi.getCustomQuestions();
          const customList = res.customQuestions || res.questions || [];
          if (active && customList.length > 0) {
            const canonical = questionRepository.getAllQuestions();
            const existingIds = new Set(canonical.map(q => q.id));
            const newCustom = customList.filter((q: Question) => !existingIds.has(q.id));
            setQuestions([...canonical, ...newCustom]);
          }
        } catch (err) {
          console.warn('Lỗi nạp câu hỏi tùy chỉnh:', err);
        }
      };
      void load();
    }
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  // Global key listener for Ctrl+K and '?'
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
        return;
      }

      if (isTypingInInput(e.target)) return;

      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsShortcutsOpen(false);
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Listen to storage update events (login, logout, data hydration) to refresh view layer
  const [storageVersion, setStorageVersion] = useState(0);
  useEffect(() => {
    const handleStorageUpdated = () => {
      setStorageVersion((prev) => prev + 1);
      setActiveExamSession(storage.getActiveExam());
    };
    window.addEventListener('aws_storage_updated', handleStorageUpdated);
    return () => window.removeEventListener('aws_storage_updated', handleStorageUpdated);
  }, []);

  // Start Exam Simulation
  const handleStartExam = (questionCount: 65 | 32 = 65, randomize = true) => {
    const examQs = questionCount === 65
      ? questionRepository.get65AssociateQuestions(randomize)
      : questionRepository.get32AssociateQuestions(randomize);
    const duration = questionCount === 65 ? 130 * 60 : 64 * 60; // 130m for 65, 64m for 32

    setActiveQuestions(examQs);
    setExamDuration(duration);
    setTimeRemaining(duration);
    setIsTimerPaused(false);
    setActiveExamSession(null);
    setMode('exam');
    window.location.hash = 'exam';
  };

  // Resume in-progress exam
  const handleResumeExam = () => {
    const saved = storage.getActiveExam();
    if (saved) {
      setActiveExamSession(saved);
      setActiveQuestions(questionRepository.getQuestionsByIds(saved.questionIds));
      setExamDuration(saved.durationSeconds);
      setTimeRemaining(saved.timeRemainingSeconds);
      setIsTimerPaused(false);
      setMode('exam');
      window.location.hash = 'exam';
    }
  };

  // Discard active exam session
  const handleDiscardActiveExam = () => {
    storage.clearActiveExam();
    setActiveExamSession(null);
    if (window.location.hash === '#exam') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  // Start Study Mode
  const handleStartStudy = (_filterType: unknown = 'all', useStandard32 = false) => {
    const isStandard = typeof useStandard32 === 'boolean' ? useStandard32 : false;
    const pool = isStandard ? standard32 : questions;
    setActiveQuestions(pool);
    setMode('study');
  };

  // Open Review Mode
  const handleOpenReview = (filterType: unknown = 'all') => {
    const safeFilter = (typeof filterType === 'string' && ['all', 'incorrect', 'bookmarked'].includes(filterType))
      ? (filterType as 'all' | 'incorrect' | 'bookmarked')
      : 'all';
    setActiveQuestions(questions);
    setReviewInitialFilter(safeFilter);
    setMode('review');
  };

  // Open Feature Modes
  const handleOpenWeakness = () => {
    setMode('weakness');
  };

  const handleOpenDomains = () => {
    setMode('domain');
  };

  const handleOpenFlashcards = (deckId?: unknown) => {
    setFlashcardsInitialDeck(typeof deckId === 'string' ? deckId : undefined);
    setMode('flashcards');
  };

  const handleOpenServices = (serviceId?: unknown) => {
    setServicesInitialId(typeof serviceId === 'string' ? serviceId : undefined);
    setMode('services');
  };

  const handleOpenStudyPlan = () => {
    setMode('studyplan');
  };

  // Domain Practice Launcher
  const handleStartDomainPractice = (domain: AWSDomain, count: number) => {
    const matched = questions.filter((q) => q.domain === domain);
    const selected = matched.slice(0, count);
    setActiveQuestions(selected.length > 0 ? selected : standard32);
    setMode('study');
  };

  // Targeted Weakness Drill Launcher
  const handleStartTargetedDrill = (questionIds: number[], _title: string) => {
    const targetQs = questionRepository.getQuestionsByIds(questionIds);
    setActiveQuestions(targetQs.length > 0 ? targetQs : standard32);
    setMode('study');
  };

  // Service filter drill from Service Explorer
  const handleSelectServiceToStudy = (serviceTag: string) => {
    const filtered = questions.filter((q) =>
      q.serviceTags.some((t) => t.toUpperCase() === serviceTag.toUpperCase())
    );
    setActiveQuestions(filtered.length > 0 ? filtered : questions);
    setMode('study');
  };

  // Exam submitted
  const handleExamSubmitted = (result: ExamResult, _session: ExamSession) => {
    setActiveResult(result);
    setActiveExamSession(null);
    setMode('result');
    window.location.hash = 'result';
  };

  // Retake exam
  const handleRetakeExam = () => {
    handleStartExam(activeQuestions.length <= 32 ? 32 : 65, true);
  };

  // Practice incorrect questions from result
  const handlePracticeIncorrect = (incorrectIds: number[]) => {
    const missedQuestions = questionRepository.getQuestionsByIds(incorrectIds);
    setActiveQuestions(missedQuestions.length > 0 ? missedQuestions : standard32);
    setMode('study');
  };

  // Go Home
  const handleGoHome = () => {
    if (mode === 'exam') {
      const saved = storage.getActiveExam();
      if (saved) {
        storage.saveActiveExam({
          ...saved,
          status: 'paused',
          timeRemainingSeconds: timeRemaining,
        });
      }
    }
    setActiveExamSession(storage.getActiveExam());
    setMode('home');
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  // Header quick navigation
  const handleNavigateMode = (targetMode: AppMode) => {
    if (mode === 'exam') {
      const saved = storage.getActiveExam();
      if (saved) {
        storage.saveActiveExam({
          ...saved,
          status: 'paused',
          timeRemainingSeconds: timeRemaining,
        });
      }
      setActiveExamSession(storage.getActiveExam());
    }
    if (targetMode === 'study') {
      handleStartStudy('all', false);
    } else {
      setMode(targetMode);
    }
    if (targetMode === 'home') {
      window.history.replaceState(null, '', window.location.pathname);
    } else {
      window.location.hash = targetMode;
    }
  };

  const currentQuestionIndex = activeExamSession ? activeExamSession.currentIndex : 0;

  if (isAdminPortalOpen && isAdmin) {
    return (
      <React.Suspense fallback={<ViewLoadingFallback />}>
        <AdminDashboardView onBackToApp={() => setAdminDismissed(true)} />
      </React.Suspense>
    );
  }

  return (
    <div
      className={`${
        mode === 'exam' ? 'h-screen overflow-hidden' : 'min-h-screen'
      } flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-[#FF9900]/20 transition-colors`}
    >
      <Header
        mode={mode}
        currentIndex={currentQuestionIndex}
        totalQuestions={activeQuestions.length || standard32.length}
        timeRemaining={mode === 'exam' ? timeRemaining : undefined}
        isPaused={isTimerPaused}
        onTogglePause={() => setIsTimerPaused((prev) => !prev)}
        onGoHome={handleGoHome}
        onNavigateMode={handleNavigateMode}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
        onOpenQuestionSubmit={() => setIsQuestionSubmitOpen(true)}
        onOpenAdminPortal={() => setAdminDismissed(false)}
        onOpenAdminLogin={() => {
          setLoginModalAdminMode(true);
          setIsLoginModalOpen(true);
        }}
        onOpenLogin={() => {
          setLoginModalAdminMode(false);
          setIsLoginModalOpen(true);
        }}
        onToggleAITutor={() => setIsAITutorOpen((prev) => !prev)}
        isAITutorOpen={isAITutorOpen}
      />

      <div
        className={`flex-1 flex flex-col ${
          mode === 'exam' ? 'overflow-hidden min-h-0' : 'pb-24 sm:pb-20 md:pb-0'
        }`}
        key={storageVersion}
      >
        <React.Suspense fallback={<ViewLoadingFallback />}>
          {mode === 'home' && (
            <HomeView
              allQuestions={questions}
              totalBankCount={questions.length}
              standard32Count={standard32.length}
              studyProgress={storage.getStudyProgress()}
              bookmarksCount={storage.getBookmarks().length}
              examHistory={storage.getExamHistory()}
              activeExamSession={activeExamSession}
              onResumeExam={handleResumeExam}
              onDiscardActiveExam={handleDiscardActiveExam}
              onStartExam={handleStartExam}
              onStartStudy={handleStartStudy}
              onOpenReview={handleOpenReview}
              onOpenWeakness={handleOpenWeakness}
              onOpenDomains={handleOpenDomains}
              onOpenFlashcards={handleOpenFlashcards}
              onOpenServices={handleOpenServices}
              onOpenStudyPlan={handleOpenStudyPlan}
            />
          )}

          {mode === 'exam' && (
            <ExamView
              questions={activeQuestions}
              initialSession={activeExamSession}
              totalDurationSeconds={examDuration}
              onExamSubmitted={handleExamSubmitted}
              onExitExam={handleGoHome}
              isPaused={isTimerPaused}
              timeRemaining={timeRemaining}
              setTimeRemaining={setTimeRemaining}
            />
          )}

          {mode === 'study' && (
            <StudyView
              questions={activeQuestions.length > 0 ? activeQuestions : standard32}
              onExit={handleGoHome}
            />
          )}

          {mode === 'result' && activeResult && (
            <ResultView
              result={activeResult}
              questions={activeQuestions}
              onRetakeExam={handleRetakeExam}
              onPracticeIncorrect={handlePracticeIncorrect}
              onGoHome={handleGoHome}
            />
          )}

          {mode === 'review' && (
            <ReviewView
              questions={questions}
              initialFilter={reviewInitialFilter}
            />
          )}

          {mode === 'flashcards' && (
            <FlashcardsView
              onBackToHome={handleGoHome}
              initialDeckId={flashcardsInitialDeck}
            />
          )}

          {mode === 'services' && (
            <ServiceExplorerView
              onBackToHome={handleGoHome}
              onSelectServiceToStudy={handleSelectServiceToStudy}
              initialServiceId={servicesInitialId}
            />
          )}

          {mode === 'weakness' && (
            <WeaknessPracticeView
              allQuestions={questions}
              onBackToHome={handleGoHome}
              onStartTargetedDrill={handleStartTargetedDrill}
            />
          )}

          {mode === 'domain' && (
            <DomainPracticeView
              allQuestions={questions}
              onBackToHome={handleGoHome}
              onStartDomainPractice={handleStartDomainPractice}
            />
          )}

          {mode === 'studyplan' && (
            <StudyPlanView
              onBackToHome={handleGoHome}
              onLaunchDayPractice={handleStartDomainPractice}
            />
          )}
        </React.Suspense>
      </div>

      {isShortcutsOpen && (
        <React.Suspense fallback={null}>
          <KeyboardShortcutsModal
            isOpen={isShortcutsOpen}
            onClose={() => setIsShortcutsOpen(false)}
          />
        </React.Suspense>
      )}

      {isSearchOpen && (
        <React.Suspense fallback={null}>
          <GlobalSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            questions={questions}
            onNavigateToQuestion={(qId) => {
              const target = questions.filter((q) => q.id === qId);
              if (target.length > 0) {
                setActiveQuestions(target);
                setMode('study');
              }
            }}
            onNavigateToServices={(serviceId) => {
              setServicesInitialId(serviceId);
              setMode('services');
            }}
            onNavigateToFlashcards={(deckId) => {
              setFlashcardsInitialDeck(deckId);
              setMode('flashcards');
            }}
          />
        </React.Suspense>
      )}

      {isFeedbackOpen && (
        <React.Suspense fallback={null}>
          <FeedbackModal
            isOpen={isFeedbackOpen}
            onClose={() => setIsFeedbackOpen(false)}
          />
        </React.Suspense>
      )}

      {isQuestionSubmitOpen && (
        <React.Suspense fallback={null}>
          <QuestionSubmitModal
            isOpen={isQuestionSubmitOpen}
            onClose={() => setIsQuestionSubmitOpen(false)}
            onQuestionSubmitted={loadCustomQuestions}
          />
        </React.Suspense>
      )}

      {/* Mandatory Login Modal for Learner access, or manual admin/account switch */}
      <LoginModal
        key={`${isLoginModalOpen}_${loginModalAdminMode}_${isAuthenticated}`}
        isOpen={(!isAuthLoading && !isAuthenticated) || isLoginModalOpen}
        canDismiss={isAuthenticated}
        initialAdminMode={loginModalAdminMode}
        onClose={() => setIsLoginModalOpen(false)}
      />

      {/* Floating AWS AI Tutor Assistant */}
      <AITutorChatbox
        userId={user?.id || 'guest_learner'}
        currentQuestion={activeQuestionContext.question || activeQuestions[0] || questions[0]}
        selectedAnswer={activeQuestionContext.selectedAnswer}
        isSubmitted={activeQuestionContext.isSubmitted}
        isCorrect={activeQuestionContext.isCorrect}
        userNotes={
          activeQuestionContext.userNotes ||
          (activeQuestionContext.question
            ? storage.getNote(activeQuestionContext.question.id)?.noteText
            : undefined)
        }
        isOpen={isAITutorOpen}
        onToggleOpen={() => setIsAITutorOpen((prev) => !prev)}
        currentMode={mode}
      />

      {/* Floating AI Diagram Workspace Launcher (Desktop always, and Mobile during Exam mode) */}
      <div className={mode !== 'exam' ? 'hidden md:block' : 'block'}>
        <FloatingDiagramLauncher
          isOpen={isDiagramOpen}
          isMinimized={isDiagramMinimized}
          onOpen={() => {
            setIsDiagramOpen(true);
            setIsDiagramMinimized(false);
          }}
        />
      </div>

      {/* Interactive AI Diagram & Brainstorming Workspace Modal */}
      {isDiagramOpen && !isDiagramMinimized && (
        <React.Suspense fallback={null}>
          <DiagramWorkspaceModal
            isOpen={isDiagramOpen && !isDiagramMinimized}
            onClose={() => setIsDiagramOpen(false)}
            onMinimize={() => setIsDiagramMinimized(true)}
          />
        </React.Suspense>
      )}

      {/* Ergonomic Mobile Bottom Navigation Bar (Active in all non-exam modes on phones/tablets) */}
      {mode !== 'exam' && (
        <nav
          aria-label="Mobile Bottom Navigation"
          className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden items-center justify-around border-t border-slate-200 bg-white/95 backdrop-blur-md px-1 py-1.5 dark:border-slate-800 dark:bg-slate-900/95 safe-pb-bottom shadow-lg"
        >
          <button
            type="button"
            onClick={handleGoHome}
            className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors min-h-[44px] ${
              mode === 'home'
                ? 'text-blue-600 font-bold dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <Home className="h-4 w-4" />
            <span className="text-[10px] mt-0.5">Trang chủ</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigateMode('study')}
            className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors min-h-[44px] ${
              mode === 'study'
                ? 'text-blue-600 font-bold dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span className="text-[10px] mt-0.5">Học đề</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigateMode('flashcards')}
            className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors min-h-[44px] ${
              mode === 'flashcards'
                ? 'text-purple-600 font-bold dark:text-purple-400'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span className="text-[10px] mt-0.5">Flashcards</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsDiagramOpen(true);
              setIsDiagramMinimized(false);
            }}
            className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors min-h-[44px] ${
              isDiagramOpen && !isDiagramMinimized
                ? 'text-purple-600 font-bold dark:text-purple-400'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <div className="relative">
              <Network className="h-4 w-4 text-purple-500 dark:text-purple-400" />
              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
            </div>
            <span className="text-[10px] mt-0.5 font-semibold">Diagram</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigateMode('weakness')}
            className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors min-h-[44px] ${
              mode === 'weakness' || mode === 'domain'
                ? 'text-rose-600 font-bold dark:text-rose-400'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <AlertOctagon className="h-4 w-4" />
            <span className="text-[10px] mt-0.5">Điểm mù</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAITutorOpen((prev) => !prev)}
            className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors min-h-[44px] ${
              isAITutorOpen
                ? 'text-indigo-600 font-bold dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <div className="relative">
              <Bot className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            </div>
            <span className="text-[10px] mt-0.5 font-semibold">AI Tutor</span>
          </button>
        </nav>
      )}
    </div>
  );
};

export default function App() {
  // /ai-chat là cửa sổ chat rời: chỉ render chatbox, không render cả app
  const isPopout = isChatPopoutWindow();

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          {isPopout ? <AIChatWindowView /> : <MainApp />}
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
