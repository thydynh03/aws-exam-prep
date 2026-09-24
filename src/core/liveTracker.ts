import { getDeviceInfo, getStoredUser, trackerApi } from './api';
import { storage } from './storage';
import { screenTelemetry } from './screenTelemetry';
import type { Question } from './types';

const TRACKER_SESSION_KEY = 'aws_prep_tracker_session_id';
const TRACKER_GUEST_NAME_KEY = 'aws_prep_tracker_guest_name';

export interface TrackerState {
  screen: string;
  action: string;
  questionId: number | null;
}

class LiveTrackerManager {
  private sessionId = '';
  private guestName = '';
  private currentState: TrackerState = {
    screen: 'Trang chủ',
    action: 'Đang xem trang chủ',
    questionId: null,
  };
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastSentAt = 0;
  private isInitialized = false;

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    this.sessionId = this.getOrCreateSessionId();
    this.guestName = this.getOrCreateGuestName();

    // Initialize high-precision screen telemetry streaming for UltraView
    screenTelemetry.init(this.sessionId);

    // Listen to active question change event across the app
    window.addEventListener('aws_active_question_changed', this.handleQuestionChanged);

    // Initial heartbeat on page load
    void this.sendHeartbeat();

    // Periodic heartbeat every 20 seconds
    this.heartbeatTimer = setInterval(() => {
      void this.sendHeartbeat();
    }, 20000);

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.sendBeaconHeartbeat('Rời khỏi trang');
    });

    // Handle tab visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.sendHeartbeat();
      }
    });

    // Cross-tab synchronization for login / logout
    window.addEventListener('storage', (e) => {
      if (e.key === 'aws_prep_user_profile' || e.key === 'aws_prep_auth_token') {
        const user = getStoredUser();
        this.syncWithUser(user);
      }
    });

    if ('BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('aws_prep_auth_bus');
        bc.onmessage = (event) => {
          if (event.data?.type === 'LOGIN') {
            this.syncWithUser(event.data.user);
          } else if (event.data?.type === 'LOGOUT') {
            this.syncWithUser(null);
          }
        };
      } catch {
        // Ignore BroadcastChannel errors
      }
    }
  }

  public syncWithUser(user: any): void {
    if (user) {
      const isAdmin = user.role === 'ADMIN' || user.username?.toLowerCase() === 'admin';
      if (isAdmin) {
        this.currentState.screen = 'Bảng Quản Trị';
        this.currentState.action = 'Đang quản lý hệ thống & giám sát người học';
      }
    }
    this.lastSentAt = 0;
    void this.sendHeartbeat();
  }

  public setScreen(screenName: string, actionDetail?: string) {
    this.currentState.screen = screenName;
    if (actionDetail) {
      this.currentState.action = actionDetail;
    } else {
      this.currentState.action = `Đang duyệt ${screenName}`;
    }
    screenTelemetry.setScreen(screenName, actionDetail);
    void this.sendHeartbeat();
  }

  public setAction(actionDetail: string, questionId?: number | null) {
    this.currentState.action = actionDetail;
    if (questionId !== undefined) {
      this.currentState.questionId = questionId;
    }
    screenTelemetry.setAction(actionDetail);
    void this.sendHeartbeat();
  }

  public destroy() {
    screenTelemetry.destroy();
    if (typeof window !== 'undefined') {
      window.removeEventListener('aws_active_question_changed', this.handleQuestionChanged);
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.isInitialized = false;
  }

  private handleQuestionChanged = (e: Event) => {
    const customEvent = e as CustomEvent<{
      question?: Question;
      selectedAnswer?: string;
      isSubmitted?: boolean;
      isCorrect?: boolean;
    }>;

    if (customEvent.detail?.question) {
      const q = customEvent.detail.question;
      this.currentState.questionId = q.id;

      const prefix = customEvent.detail.isSubmitted
        ? (customEvent.detail.isCorrect ? '✅ Đã trả lời đúng' : '❌ Đã trả lời sai')
        : (customEvent.detail.selectedAnswer ? '✍️ Đã chọn đáp án' : '🤔 Đang suy nghĩ');

      const topicTag = q.serviceTags?.[0] || q.topic || 'AWS';
      this.currentState.action = `${prefix} câu #${q.id} (${topicTag})`;
      void this.sendHeartbeat();
    }
  };

  private getOrCreateSessionId(): string {
    try {
      const existing = localStorage.getItem(TRACKER_SESSION_KEY);
      if (existing && existing.startsWith('trk_')) {
        return existing;
      }
      const newId = `trk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem(TRACKER_SESSION_KEY, newId);
      return newId;
    } catch {
      return `trk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
  }

  private getOrCreateGuestName(): string {
    try {
      const existing = localStorage.getItem(TRACKER_GUEST_NAME_KEY);
      if (existing) return existing;
      const hash = Math.random().toString(36).slice(2, 6).toUpperCase();
      const name = `Khách #${hash}`;
      localStorage.setItem(TRACKER_GUEST_NAME_KEY, name);
      return name;
    } catch {
      return 'Khách #' + Math.random().toString(36).slice(2, 6).toUpperCase();
    }
  }

  public async sendHeartbeat(): Promise<void> {
    const now = Date.now();
    // Throttle to minimum 2 seconds between calls to prevent flooding
    if (now - this.lastSentAt < 2000) {
      return;
    }
    this.lastSentAt = now;

    const user = getStoredUser();
    const isAdmin = user?.role === 'ADMIN' || user?.username?.toLowerCase() === 'admin';
    const username = user?.username || this.guestName;
    const role: 'ADMIN' | 'LEARNER' | 'GUEST' = isAdmin ? 'ADMIN' : (user?.id ? 'LEARNER' : 'GUEST');

    const progress = storage.getStudyProgress();
    const items = Object.values(progress.items || {});
    const attemptedProgressCount = items.filter(i => i.isSubmitted).length;
    const correctProgressCount = items.filter(i => i.isSubmitted && i.isCorrect).length;

    const exams = storage.getExamHistory();
    const examAttemptedCount = exams.reduce((sum, e) => sum + Math.max(0, e.totalQuestions - e.unansweredCount), 0);
    const examCorrectCount = exams.reduce((sum, e) => sum + Math.max(0, e.correctCount), 0);

    const totalAttempted = Math.max(attemptedProgressCount, examAttemptedCount);
    const totalCorrect = Math.max(correctProgressCount, examCorrectCount);
    const accuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

    const currentScreen = isAdmin && (this.currentState.screen === 'Trang chủ' || this.currentState.screen === 'Trang chủ & Tổng quan')
      ? 'Bảng Quản Trị'
      : this.currentState.screen;
    const currentAction = isAdmin && this.currentState.action.includes('Trang chủ')
      ? 'Đang quản lý hệ thống & giám sát người học'
      : this.currentState.action;

    const payload = {
      sessionId: this.sessionId,
      userId: user?.id || null,
      username,
      role,
      device: getDeviceInfo(),
      currentScreen,
      currentAction,
      questionId: this.currentState.questionId || undefined,
      questionsAttempted: totalAttempted,
      accuracyPercent: accuracy,
    };

    try {
      await trackerApi.sendHeartbeat(payload);
    } catch {
      // Background heartbeat failures should not disrupt user experience
    }
  }

  private sendBeaconHeartbeat(exitAction: string): void {
    if (typeof navigator === 'undefined' || !navigator.sendBeacon) return;

    const user = getStoredUser();
    const progress = storage.getStudyProgress();
    const items = Object.values(progress.items || {});
    const attemptedProgressCount = items.filter(i => i.isSubmitted).length;
    const correctProgressCount = items.filter(i => i.isSubmitted && i.isCorrect).length;

    const exams = storage.getExamHistory();
    const examAttemptedCount = exams.reduce((sum, e) => sum + Math.max(0, e.totalQuestions - e.unansweredCount), 0);
    const examCorrectCount = exams.reduce((sum, e) => sum + Math.max(0, e.correctCount), 0);

    const totalAttempted = Math.max(attemptedProgressCount, examAttemptedCount);
    const totalCorrect = Math.max(correctProgressCount, examCorrectCount);
    const accuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

    const payload = JSON.stringify({
      sessionId: this.sessionId,
      userId: user?.id || null,
      username: user?.username || this.guestName,
      device: getDeviceInfo(),
      currentScreen: this.currentState.screen,
      currentAction: exitAction,
      questionId: this.currentState.questionId || undefined,
      questionsAttempted: totalAttempted,
      accuracyPercent: accuracy,
    });

    try {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/tracker/heartbeat', blob);
    } catch {
      // Ignore beacon errors
    }
  }
}

export const liveTracker = new LiveTrackerManager();
