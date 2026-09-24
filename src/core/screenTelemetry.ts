import { getDeviceInfo, getStoredUser } from './api';
import { realtimeManager } from './realtime';
import type { Question } from './types';

export interface ScreenTelemetryFrame {
  sessionId: string;
  userId: string | null;
  username: string;
  role?: 'ADMIN' | 'LEARNER' | 'GUEST';
  device?: {
    deviceType?: string;
    os?: string;
    browser?: string;
    screenResolution?: string;
  };
  viewport: {
    width: number;
    height: number;
  };
  screen: string;
  action: string;
  cursor: {
    xPercent: number; // 0-100%
    yPercent: number; // 0-100%
    lastActiveAt: number;
  };
  click: {
    xPercent: number;
    yPercent: number;
    targetDescription: string;
    timestamp: number;
  } | null;
  scroll: {
    scrollPercent: number;
    scrollY: number;
  };
  screenImage?: string; // Real screen capture JPEG base64 (actual web page of learner)
  isLiveVideo?: boolean;
  activeQuestion?: {
    id: number;
    questionText: string;
    topic?: string;
    service?: string;
    options: Record<string, string>;
    selectedAnswer?: string;
    isSubmitted?: boolean;
    isCorrect?: boolean;
    confidence?: string;
  };
  recentLogs: Array<{
    id: string;
    timestamp: number;
    text: string;
    badge?: string;
  }>;
  updatedAt: number;
}

class ScreenTelemetryManager {
  private sessionId = '';
  private isInitialized = false;
  private currentScreen = 'Trang chủ & Tổng quan';
  private currentAction = 'Đang xem trang chủ';
  private currentQuestion: Question | null = null;
  private selectedAnswer = '';
  private isSubmitted = false;
  private isCorrect = false;

  private cursor = {
    xPercent: 50,
    yPercent: 50,
    lastActiveAt: Date.now(),
  };
  private lastClick: ScreenTelemetryFrame['click'] = null;
  private scroll = {
    scrollPercent: 0,
    scrollY: 0,
  };
  private recentLogs: Array<{ id: string; timestamp: number; text: string; badge?: string }> = [];

  private lastCapturedImage = '';
  private isCapturing = false;
  private lastCaptureTime = 0;
  private captureDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeSnapshotRequest: (() => void) | null = null;
  private unsubscribeViewerActive: (() => void) | null = null;

  private remoteViewerActive = false;
  private remoteViewerExpiresAt = 0;
  private imageDirty = false;

  private streamTimer: ReturnType<typeof setTimeout> | null = null;
  private lastStreamedAt = 0;
  private isDirty = false;

  public isRemoteViewerActive(): boolean {
    return this.remoteViewerActive && Date.now() < this.remoteViewerExpiresAt;
  }

  public init(sessionId: string) {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.sessionId = sessionId;
    this.isInitialized = true;

    // Mouse movement tracker (throttled)
    window.addEventListener('mousemove', this.handleMouseMove, { passive: true });

    // Click tracker
    window.addEventListener('click', this.handleClick, { passive: true });

    // Scroll tracker
    window.addEventListener('scroll', this.handleScroll, { passive: true });

    // Listen to active question changes
    window.addEventListener('aws_active_question_changed', this.handleQuestionChanged);

    // Initial low-priority screen capture once DOM is painted and idle
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        this.triggerCaptureDebounced(1500, true);
      }, { timeout: 3000 });
    } else {
      this.triggerCaptureDebounced(1500, true);
    }

    // Listen to remote viewer presence from UltraView admin
    this.unsubscribeViewerActive = realtimeManager.subscribe('ultraview_session_viewing', (payload: any) => {
      const user = getStoredUser();
      const currentUname = (user?.username || '').toLowerCase();
      if (
        !payload ||
        payload.sessionId === this.sessionId ||
        (payload.username && payload.username.toLowerCase() === currentUname)
      ) {
        if (payload.active) {
          this.remoteViewerActive = true;
          this.remoteViewerExpiresAt = Date.now() + 15000;
          // Capture fresh frame immediately when admin joins viewer
          this.triggerCaptureDebounced(150, true);
        } else {
          this.remoteViewerActive = false;
          this.remoteViewerExpiresAt = 0;
        }
      }
    });

    // Listen to remote snapshot request from admin
    this.unsubscribeSnapshotRequest = realtimeManager.subscribe('request_screen_snapshot', (payload: any) => {
      const user = getStoredUser();
      const currentUname = (user?.username || '').toLowerCase();
      if (
        !payload ||
        payload.sessionId === this.sessionId ||
        (payload.username && payload.username.toLowerCase() === currentUname)
      ) {
        this.remoteViewerActive = true;
        this.remoteViewerExpiresAt = Date.now() + 15000;
        void this.captureScreen(true);
      }
    });

    // Initial log
    this.addLog('Bắt đầu phiên học trên hệ thống', 'Khởi tạo');
  }

  public async captureScreen(force = false): Promise<string | null> {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;

    const user = getStoredUser();
    const isAdmin = user?.role === 'ADMIN' || user?.username?.toLowerCase() === 'admin';
    // If the active user is viewing their Admin Dashboard, skip screen mirroring of the dashboard itself
    if (isAdmin && this.currentScreen.includes('Quản Trị')) {
      return null;
    }

    const now = Date.now();
    // Do not capture if no remote viewer is watching and this is not an explicit forced snapshot
    if (!force && !this.isRemoteViewerActive()) {
      return this.lastCapturedImage || null;
    }

    if (!force && (this.isCapturing || now - this.lastCaptureTime < 2500)) {
      return this.lastCapturedImage || null;
    }

    this.isCapturing = true;
    try {
      const rootNode = document.getElementById('root') || document.body;
      if (!rootNode) return null;

      const isDark = document.documentElement.classList.contains('dark');
      const { toJpeg } = await import('html-to-image');
      const dataUrl = await toJpeg(rootNode, {
        quality: 0.48,
        pixelRatio: 0.6,
        skipAutoScale: true,
        cacheBust: false,
        backgroundColor: isDark ? '#0b0f17' : '#f8fafc',
        filter: (node) => {
          if (node instanceof HTMLElement && node.getAttribute('data-ultraview-modal') === 'true') {
            return false;
          }
          return true;
        },
      });

      if (dataUrl && dataUrl.length > 200) {
        this.lastCapturedImage = dataUrl;
        this.lastCaptureTime = Date.now();
        this.imageDirty = true;
        this.isDirty = true;
        this.scheduleStream(true);
        return dataUrl;
      }
    } catch {
      // Fallback to html2canvas if html-to-image encounters unsupported elements
      try {
        const html2canvasModule = await import('html2canvas');
        const html2canvas = html2canvasModule.default;
        const rootNode = document.getElementById('root') || document.body;
        if (rootNode) {
          const isDark = document.documentElement.classList.contains('dark');
          const canvas = await html2canvas(rootNode, {
            scale: 0.5,
            logging: false,
            useCORS: true,
            backgroundColor: isDark ? '#0b0f17' : '#f8fafc',
          });
          const dataUrl = canvas.toDataURL('image/jpeg', 0.45);
          if (dataUrl && dataUrl.length > 200) {
            this.lastCapturedImage = dataUrl;
            this.lastCaptureTime = Date.now();
            this.imageDirty = true;
            this.isDirty = true;
            this.scheduleStream(true);
            return dataUrl;
          }
        }
      } catch {
        // Silently ignore capture failures
      }
    } finally {
      this.isCapturing = false;
    }

    return this.lastCapturedImage || null;
  }

  public triggerCaptureDebounced(delay = 300, force = false) {
    if (typeof window === 'undefined') return;
    if (!force && !this.isRemoteViewerActive()) return;

    if (this.captureDebounceTimer) {
      clearTimeout(this.captureDebounceTimer);
    }
    this.captureDebounceTimer = setTimeout(() => {
      this.captureDebounceTimer = null;
      void this.captureScreen(force);
    }, delay);
  }

  public setScreen(screenName: string, actionDetail?: string) {
    this.currentScreen = screenName;
    if (actionDetail) {
      this.currentAction = actionDetail;
    }
    this.addLog(`Chuyển sang: ${screenName}`, 'Màn hình');
    if (this.isRemoteViewerActive()) {
      this.scheduleStream(true);
      this.triggerCaptureDebounced(300, false);
    }
  }

  public setAction(actionDetail: string) {
    this.currentAction = actionDetail;
    this.addLog(actionDetail, 'Hành động');
    if (this.isRemoteViewerActive()) {
      this.scheduleStream(true);
    }
  }

  public addLog(text: string, badge?: string) {
    const entry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      text,
      badge,
    };
    this.recentLogs = [entry, ...this.recentLogs.slice(0, 29)];
    this.isDirty = true;
  }

  private handleMouseMove = (e: MouseEvent) => {
    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    const xPercent = Math.max(0, Math.min(100, Math.round((e.clientX / width) * 1000) / 10));
    const yPercent = Math.max(0, Math.min(100, Math.round((e.clientY / height) * 1000) / 10));

    this.cursor = {
      xPercent,
      yPercent,
      lastActiveAt: Date.now(),
    };
    if (this.isRemoteViewerActive()) {
      this.isDirty = true;
      this.scheduleStream(false);
    }
  };

  private handleClick = (e: MouseEvent) => {
    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    const xPercent = Math.max(0, Math.min(100, Math.round((e.clientX / width) * 1000) / 10));
    const yPercent = Math.max(0, Math.min(100, Math.round((e.clientY / height) * 1000) / 10));

    // Try to derive meaningful target description
    let targetDesc = 'Nhấp chuột trên trang';
    const target = e.target as HTMLElement | null;
    if (target) {
      const text = target.innerText?.trim().slice(0, 35);
      const aria = target.getAttribute('aria-label') || target.getAttribute('title');
      if (text) {
        targetDesc = `Bấm vào "${text}"`;
      } else if (aria) {
        targetDesc = `Bấm nút "${aria}"`;
      } else {
        targetDesc = `Bấm thẻ <${target.tagName.toLowerCase()}>`;
      }
    }

    this.lastClick = {
      xPercent,
      yPercent,
      targetDescription: targetDesc,
      timestamp: Date.now(),
    };

    this.addLog(targetDesc, 'Click');
    if (this.isRemoteViewerActive()) {
      this.scheduleStream(true);
      this.triggerCaptureDebounced(400, false);
    }
  };

  private handleScroll = () => {
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const scrollPercent = Math.max(0, Math.min(100, Math.round((scrollY / maxScroll) * 100)));

    this.scroll = {
      scrollPercent,
      scrollY,
    };
    if (this.isRemoteViewerActive()) {
      this.isDirty = true;
      this.scheduleStream(false);
    }
  };

  private handleQuestionChanged = (e: Event) => {
    const customEvent = e as CustomEvent<{
      question?: Question;
      selectedAnswer?: string;
      isSubmitted?: boolean;
      isCorrect?: boolean;
    }>;

    if (customEvent.detail?.question) {
      this.currentQuestion = customEvent.detail.question;
      this.selectedAnswer = customEvent.detail.selectedAnswer || '';
      this.isSubmitted = Boolean(customEvent.detail.isSubmitted);
      this.isCorrect = Boolean(customEvent.detail.isCorrect);

      const q = this.currentQuestion;
      if (this.isSubmitted) {
        this.addLog(
          `${this.isCorrect ? '✅ Trả lời ĐÚNG' : '❌ Trả lời SAI'} câu #${q.id} (Đáp án: ${this.selectedAnswer})`,
          'Nộp bài'
        );
      } else if (this.selectedAnswer) {
        this.addLog(`✍️ Đã chọn đáp án ${this.selectedAnswer} cho câu #${q.id}`, 'Chọn đáp án');
      } else {
        this.addLog(`Mở xem câu hỏi #${q.id} (${q.topic || 'AWS'})`, 'Xem câu hỏi');
      }

      if (this.isRemoteViewerActive()) {
        this.scheduleStream(true);
        this.triggerCaptureDebounced(300, false);
      }
    }
  };

  private scheduleStream(immediate = false) {
    const now = Date.now();
    const minInterval = immediate ? 50 : 120; // 120ms throttle for cursor, 50ms for clicks/state changes

    if (immediate || now - this.lastStreamedAt >= minInterval) {
      if (this.streamTimer) {
        clearTimeout(this.streamTimer);
        this.streamTimer = null;
      }
      this.flushStream();
    } else if (!this.streamTimer) {
      this.streamTimer = setTimeout(() => {
        this.streamTimer = null;
        this.flushStream();
      }, minInterval - (now - this.lastStreamedAt));
    }
  }

  public buildCurrentFrame(): ScreenTelemetryFrame {
    const user = getStoredUser();
    const isAdmin = user?.role === 'ADMIN' || user?.username?.toLowerCase() === 'admin';
    const role = isAdmin ? 'ADMIN' : (user?.id ? 'LEARNER' : 'GUEST');

    let activeQuestion: ScreenTelemetryFrame['activeQuestion'];
    if (this.currentQuestion) {
      const q = this.currentQuestion;
      const options: Record<string, string> = { ...(q.choices || {}) };
      if (Array.isArray((q as any).options)) {
        (q as any).options.forEach((opt: any, idx: number) => {
          const key = String.fromCharCode(65 + idx); // A, B, C, D...
          options[key] = typeof opt === 'string' ? opt : opt?.text || '';
        });
      }

      activeQuestion = {
        id: q.id,
        questionText: q.text || (q as any).question || '',
        topic: q.topic,
        service: q.serviceTags?.[0],
        options,
        selectedAnswer: this.selectedAnswer,
        isSubmitted: this.isSubmitted,
        isCorrect: this.isCorrect,
      };
    }

    const sendImage = (this.imageDirty || !this.lastStreamedAt) && this.lastCapturedImage
      ? this.lastCapturedImage
      : undefined;

    return {
      sessionId: this.sessionId,
      userId: user?.id || null,
      username: user?.username || 'Khách vãng lai',
      role,
      device: getDeviceInfo(),
      viewport: {
        width: typeof window !== 'undefined' ? window.innerWidth : 1280,
        height: typeof window !== 'undefined' ? window.innerHeight : 720,
      },
      screen: this.currentScreen,
      action: this.currentAction,
      cursor: this.cursor,
      click: this.lastClick,
      scroll: this.scroll,
      screenImage: sendImage,
      activeQuestion,
      recentLogs: this.recentLogs,
      updatedAt: Date.now(),
    };
  }

  private flushStream() {
    if (!this.isDirty || typeof window === 'undefined') return;
    this.isDirty = false;
    this.lastStreamedAt = Date.now();

    const frame = this.buildCurrentFrame();
    const hadImage = Boolean(frame.screenImage);
    this.imageDirty = false;

    // 1. Broadcast locally & cross-tab immediately via realtimeManager
    realtimeManager.broadcast('learner_screen_mirror', frame);

    // 2. Stream to server endpoint for cross-network admin viewing (only if viewer active or fresh snapshot)
    if (this.isRemoteViewerActive() || hadImage) {
      try {
        void fetch('/api/tracker/screen-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(frame),
          keepalive: true,
        }).catch(() => {});
      } catch {
        // Ignore network errors
      }
    }
  }

  public destroy() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('click', this.handleClick);
    window.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('aws_active_question_changed', this.handleQuestionChanged);
    if (this.streamTimer) {
      clearTimeout(this.streamTimer);
      this.streamTimer = null;
    }
    if (this.captureDebounceTimer) {
      clearTimeout(this.captureDebounceTimer);
      this.captureDebounceTimer = null;
    }
    if (this.unsubscribeSnapshotRequest) {
      this.unsubscribeSnapshotRequest();
      this.unsubscribeSnapshotRequest = null;
    }
    if (this.unsubscribeViewerActive) {
      this.unsubscribeViewerActive();
      this.unsubscribeViewerActive = null;
    }
    this.isInitialized = false;
  }
}

export const screenTelemetry = new ScreenTelemetryManager();
