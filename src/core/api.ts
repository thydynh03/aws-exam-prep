import { storage } from './storage';
import type { PersonalNote, StudyProgress, ExamAttemptRecord } from './types';

const TOKEN_STORAGE_KEY = 'aws_prep_auth_token';

export interface UserProfile {
  id: string;
  username: string;
  role: 'LEARNER' | 'ADMIN';
  createdAt?: number;
  lastActiveAt?: number;
}

export interface DeviceInfo {
  deviceType?: string;
  os?: string;
  browser?: string;
  userAgent?: string;
  platform?: string;
  screenResolution?: string;
}

/**
 * Capture current browser and device specifications
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') return {};

  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const screenResolution = `${window.screen.width}x${window.screen.height}`;

  return {
    userAgent: ua,
    platform,
    screenResolution,
  };
}

const USER_STORAGE_KEY = 'aws_prep_user_profile';
export const REGISTERED_LEARNERS_STORAGE_KEY = 'aws_prep_registered_learners';

export interface LocalRegisteredLearner {
  id: string;
  username: string;
  role: 'LEARNER' | 'ADMIN';
  createdAt: number;
  lastActiveAt: number;
  device?: DeviceInfo;
}

export function getLocalRegisteredLearners(): Record<string, LocalRegisteredLearner> {
  try {
    const raw = localStorage.getItem(REGISTERED_LEARNERS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LocalRegisteredLearner>) : {};
  } catch {
    return {};
  }
}

export function saveLocalRegisteredLearner(user: Partial<LocalRegisteredLearner> & { username: string }): void {
  try {
    if (!user.username || user.username.trim().toLowerCase() === 'admin') return;
    const current = getLocalRegisteredLearners();
    const key = user.username.trim().toLowerCase();
    const now = Date.now();
    current[key] = {
      id: user.id || current[key]?.id || `usr_${key}`,
      username: user.username.trim(),
      role: 'LEARNER',
      createdAt: user.createdAt || current[key]?.createdAt || now,
      lastActiveAt: now,
      device: user.device || current[key]?.device || getDeviceInfo(),
    };
    localStorage.setItem(REGISTERED_LEARNERS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Ignore localStorage errors
  }
}

export function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: UserProfile | null): void {
  try {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch {
    // Ignore localStorage errors
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore localStorage errors
  }
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error || `Yêu cầu thất bại (${response.status})`;
    throw new Error(errorMsg);
  }

  return data as T;
}

/* ==========================================================================
   AUTHENTICATION API
   ========================================================================== */

export const authApi = {
  async login(username: string, adminPasscode?: string, device?: DeviceInfo) {
    const payload = {
      username,
      adminPasscode,
      device: device || getDeviceInfo(),
    };
    const res = await apiRequest<{ user: UserProfile; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredToken(res.token);
    setStoredUser(res.user);
    if (res.user && res.user.role === 'LEARNER') {
      saveLocalRegisteredLearner({
        id: res.user.id,
        username: res.user.username,
        role: res.user.role,
        createdAt: res.user.createdAt,
        lastActiveAt: res.user.lastActiveAt || Date.now(),
        device: payload.device,
      });
    }
    void syncLocalProgressToServer();
    return res;
  },

  async getCurrentUser() {
    const res = await apiRequest<{ user: UserProfile }>('/api/auth/me');
    if (res?.user) {
      setStoredUser(res.user);
      if (res.user.role === 'LEARNER') {
        saveLocalRegisteredLearner({
          id: res.user.id,
          username: res.user.username,
          role: res.user.role,
          createdAt: res.user.createdAt,
          lastActiveAt: res.user.lastActiveAt || Date.now(),
        });
      }
    }
    return res;
  },

  async logout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
      setStoredUser(null);
    }
  },
};

/* ==========================================================================
   LEARNER DATA API
   ========================================================================== */

export const learnerApi = {
  async getProgress() {
    return apiRequest<{ progress: Record<number, any>; items: Record<number, any> }>('/api/users/me/progress');
  },

  async saveProgress(item: {
    questionId: number;
    selectedAnswer: string;
    isSubmitted: boolean;
    isCorrect: boolean;
    confidence?: string;
  }) {
    return apiRequest<{ success: boolean }>('/api/users/me/progress', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  async resetProgress(questionId?: number) {
    if (questionId !== undefined) {
      return apiRequest<{ success: boolean; message: string }>(`/api/users/me/progress/${questionId}`, {
        method: 'DELETE',
      });
    }
    return apiRequest<{ success: boolean; message: string }>('/api/users/me/progress', {
      method: 'DELETE',
    });
  },

  async migrateLocal(progressItems: any, notes: any, bookmarks: number[], exams?: any[]) {
    return apiRequest<{ success: boolean; message: string }>('/api/users/me/progress/migrate', {
      method: 'POST',
      body: JSON.stringify({ progressItems, notes, bookmarks, exams }),
    });
  },

  async getNotes() {
    return apiRequest<{ notes: Record<number, { id: string; questionId: number; noteText: string; updatedAt: number }> }>('/api/users/me/notes');
  },

  async saveNote(questionId: number, noteText: string) {
    return apiRequest<{ success: boolean; id: string }>('/api/users/me/notes', {
      method: 'POST',
      body: JSON.stringify({ questionId, noteText }),
    });
  },

  async deleteNote(questionId: number) {
    return apiRequest<{ success: boolean }>('/api/users/me/notes/' + questionId, {
      method: 'DELETE',
    });
  },

  async getHistory() {
    return apiRequest<{ history: any[] }>('/api/users/me/history');
  },

  async saveExam(attempt: any) {
    return apiRequest<{ success: boolean; id: string }>('/api/users/me/history', {
      method: 'POST',
      body: JSON.stringify(attempt),
    });
  },

  async getBookmarks() {
    return apiRequest<{ bookmarks: number[] }>('/api/users/me/bookmarks');
  },

  async toggleBookmark(questionId: number) {
    return apiRequest<{ success: boolean; bookmarked: boolean }>('/api/users/me/bookmarks/toggle', {
      method: 'POST',
      body: JSON.stringify({ questionId }),
    });
  },
};

/* ==========================================================================
   QUESTIONS & MODERATION API
   ========================================================================== */

export const questionsApi = {
  async getCustomQuestions() {
    return apiRequest<{ customQuestions: any[]; questions: any[] }>('/api/questions/custom');
  },

  async submitQuestion(data: {
    text: string;
    choices: Record<string, string>;
    answer: string;
    explanation?: string;
    domain?: string;
    difficulty?: 'Easy' | 'Medium' | 'Hard';
    topic?: string;
    serviceTags?: string[];
  }) {
    return apiRequest<{ success: boolean; question: any; message: string }>('/api/questions/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMySubmissions() {
    return apiRequest<{ submissions: any[] }>('/api/questions/my-submissions');
  },
};

/* ==========================================================================
   FEEDBACK API
   ========================================================================== */

export const feedbackApi = {
  async submitFeedback(data: {
    type: 'bug' | 'question_error' | 'ui_ux' | 'feature_request' | 'general';
    title: string;
    content: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  }) {
    return apiRequest<{ success: boolean; feedback: any }>('/api/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMyFeedbacks() {
    return apiRequest<{ items: any[]; feedbacks: any[] }>('/api/feedback/my');
  },
};

/* ==========================================================================
   ADMIN PORTAL API
   ========================================================================== */

export const adminApi = {
  async getOverview() {
    return apiRequest<any>('/api/admin/overview');
  },

  async getUsers(options: { search?: string; role?: string; page?: number; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.role) params.set('role', options.role);
    if (options.page) params.set('page', String(options.page));
    if (options.limit) params.set('limit', String(options.limit));
    return apiRequest<any>(`/api/admin/users?${params.toString()}`);
  },

  async getUserAnalytics(userId: string) {
    return apiRequest<any>(`/api/admin/users/${userId}/analytics`);
  },

  async getReviewQueue() {
    return apiRequest<{ pendingQuestions: any[] }>('/api/admin/questions/review');
  },

  async approveQuestion(questionId: number) {
    return apiRequest<{ success: boolean; status: string }>(`/api/admin/questions/${questionId}/approve`, {
      method: 'POST',
    });
  },

  async rejectQuestion(questionId: number, reason: string) {
    return apiRequest<{ success: boolean; status: string }>(`/api/admin/questions/${questionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async importQuestions(sourceName: string, jsonPayload: any) {
    return apiRequest<{ success: boolean; importedCount: number; errors: string[] }>('/api/admin/questions/import-json', {
      method: 'POST',
      body: JSON.stringify({ sourceName, jsonPayload }),
    });
  },

  async getSources() {
    return apiRequest<{ sources: any[] }>('/api/admin/sources');
  },

  async getFeedbacks(options: { status?: string; priority?: string; search?: string; page?: number; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.priority) params.set('priority', options.priority);
    if (options.search) params.set('search', options.search);
    if (options.page) params.set('page', String(options.page));
    if (options.limit) params.set('limit', String(options.limit));
    return apiRequest<any>(`/api/admin/feedback?${params.toString()}`);
  },

  async updateFeedback(feedbackId: string, update: { status?: string; adminResponse?: string }) {
    return apiRequest<any>(`/api/admin/feedback/${feedbackId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    });
  },

  async syncLearners(learners: LocalRegisteredLearner[]) {
    return apiRequest<{ success: boolean; syncedCount: number }>('/api/admin/sync-learners', {
      method: 'POST',
      body: JSON.stringify({ learners }),
    });
  },

  async seedLearners() {
    return apiRequest<{ success: boolean; message: string }>('/api/admin/seed-learners', {
      method: 'POST',
    });
  },

  async getAIAnalytics() {
    return apiRequest<any>('/api/admin/ai-analytics');
  },

  async getAuditLogs() {
    return apiRequest<{ logs: any[] }>('/api/admin/audit-logs');
  },

  async getLearningBehavior(userId?: string) {
    const q = userId && userId !== 'ALL' ? `?userId=${encodeURIComponent(userId)}` : '';
    return apiRequest<any>(`/api/admin/learning-behavior${q}`);
  },

  async getAIQueries(options: { limit?: number; offset?: number; search?: string; mode?: string } = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    if (options.search) params.set('search', options.search);
    if (options.mode) params.set('mode', options.mode);
    return apiRequest<{
      queries: Array<{
        id: string;
        userId: string | null;
        username: string;
        ipAddress: string | null;
        questionId: number | null;
        prompt: string;
        response: string | null;
        mode: string | null;
        provider: string | null;
        createdAt: number;
      }>;
      total: number;
    }>(`/api/admin/ai/queries?${params.toString()}`);
  },

  async getLiveSessions(maxAgeMinutes = 15) {
    return apiRequest<{
      sessions: Array<{
        sessionId: string;
        userId: string | null;
        username: string;
        ipAddress: string;
        deviceType: string;
        os: string;
        browser: string;
        screenResolution: string;
        currentScreen: string;
        currentAction: string;
        questionId: number | null;
        questionsAttempted: number;
        accuracyPercent: number;
        startedAt: number;
        lastActiveAt: number;
        isOnline: boolean;
        durationSeconds: number;
      }>;
      activeCount: number;
      onlineCount: number;
    }>(`/api/admin/live-sessions?maxAge=${maxAgeMinutes}`);
  },

  /* Enterprise AI Control Center Methods */
  async getAIConfig() {
    return apiRequest<{ config: any; [key: string]: any }>('/api/admin/ai/config');
  },

  async saveAIConfig(config: any, changeSummary?: string) {
    return apiRequest<{ success: boolean; version: number; config: any }>('/api/admin/ai/config', {
      method: 'POST',
      body: JSON.stringify({ config, changeSummary }),
    });
  },

  async rollbackAIConfig(targetVersion: number) {
    return apiRequest<{ success: boolean; activeVersion: number; rolledBackVersion?: number }>('/api/admin/ai/config/rollback', {
      method: 'POST',
      body: JSON.stringify({ targetVersion }),
    });
  },

  async getAIConfigVersions() {
    return apiRequest<{ versions: any[] }>('/api/admin/ai/config/versions');
  },

  async getAISecurityMetrics() {
    return apiRequest<any>('/api/admin/ai/security-dashboard');
  },

  async getAIQualityMetrics() {
    return apiRequest<any>('/api/admin/ai/quality-dashboard');
  },

  async getAICostMetrics() {
    return apiRequest<any>('/api/admin/ai/cost-dashboard');
  },

  async getAIKnowledge(options: { status?: string; topic?: string; search?: string } = {}) {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.topic) params.set('topic', options.topic);
    if (options.search) params.set('search', options.search);
    return apiRequest<{ items: any[] }>(`/api/admin/ai/memory/knowledge?${params.toString()}`);
  },

  async updateAIKnowledgeStatus(id: string, update: { status?: string; possiblyOutdated?: boolean }) {
    return apiRequest<{ success: boolean; knowledgeId: string }>(`/api/admin/ai/memory/knowledge/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    });
  },

  async getAICorrections(search?: string) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    return apiRequest<{ corrections: any[] }>(`/api/admin/ai/memory/corrections?${params.toString()}`);
  },

  async getAIQuestionMemory(search?: string) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    return apiRequest<{ questions: any[] }>(`/api/admin/ai/memory/questions?${params.toString()}`);
  },

  async getAISemanticCache(search?: string) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    return apiRequest<{ cache: any[] }>(`/api/admin/ai/memory/cache?${params.toString()}`);
  },

  async deleteAICacheItem(id: string) {
    return apiRequest<{ success: boolean }>(`/api/admin/ai/memory/cache/${id}`, {
      method: 'DELETE',
    });
  },

  async seedCanonicalAIKnowledge() {
    return apiRequest<{ success: boolean; seededCount: number }>('/api/admin/ai/memory/seed', {
      method: 'POST',
    });
  },

  async clearAICache(topic?: string) {
    return apiRequest<{ success: boolean; invalidatedCount: number }>('/api/admin/ai/memory/cache/clear', {
      method: 'POST',
      body: JSON.stringify({ topic }),
    });
  },

  async runAITestLab(payload: { query: string; mode?: string; currentQuestion?: any }) {
    return apiRequest<any>('/api/admin/ai/playground/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

/* ==========================================================================
   AI TUTOR API
   ========================================================================== */

export const aiApi = {
  async chat(payload: {
    query: string;
    userId?: string | null;
    username?: string;
    mode?: string;
    currentQuestion?: any;
    selectedAnswer?: string;
    isSubmitted?: boolean;
    isCorrect?: boolean;
    userNotes?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    clientApiKey?: string;
    clientProvider?: string;
    clientModel?: string;
    attachedImage?: {
      name?: string;
      dataUrl: string;
      type?: string;
    };
  }) {
    return apiRequest<{
      content: string;
      citations: Array<{
        id: string;
        title: string;
        snippet: string;
        url?: string;
        type: string;
        authority?: number;
      }>;
      confidence: 'VERIFIED' | 'HIGH' | 'MEDIUM' | 'LOW';
      confidenceScore: number;
      fastPathHit: boolean;
      memoryMatch: any | null;
      securityFlags: string[];
      intent: string;
      topic: string;
      telemetry: {
        requestId: string;
        totalLatencyMs: number;
        retrievalLatencyMs: number;
        rerankLatencyMs: number;
        generationLatencyMs: number;
        modelUsed: string;
        rerankUsed: boolean;
      };
    }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async sendDetailedFeedback(data: {
    queryId?: string;
    questionId?: number | null;
    rating: 'up' | 'down';
    errorType?: string;
    userCorrection?: string;
    comment?: string;
    reasonTags?: string[];
    originalQuestion?: string;
    originalAnswer?: string;
    sources?: any[];
    mode?: string;
    provider?: string;
  }) {
    return apiRequest<{
      success: boolean;
      status: string;
      correctionId?: string;
      knowledgeId?: string;
    }>('/api/ai/feedback/detailed', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async recordQuery(data: {
    id?: string;
    questionId?: number | null;
    prompt: string;
    response?: string | null;
    mode?: string;
    provider?: string;
    username?: string;
    userId?: string;
  }) {
    return apiRequest<{ id: string; success: boolean }>('/api/ai/query', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async syncBatchQueries(queries: Array<{
    id?: string;
    questionId?: number | null;
    prompt: string;
    response?: string | null;
    mode?: string;
    provider?: string;
    username?: string;
    userId?: string;
    createdAt?: number;
  }>) {
    return apiRequest<{ success: boolean; insertedCount: number }>('/api/ai/queries/sync', {
      method: 'POST',
      body: JSON.stringify({ queries }),
    });
  },

  async sendFeedback(data: {
    questionId?: number | null;
    rating: 'up' | 'down';
    reasonTags?: string[];
    comment?: string;
    mode?: string;
    provider?: string;
  }) {
    return apiRequest<{ id: string; success: boolean }>('/api/ai/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

/* ==========================================================================
   REALTIME TELEMETRY TRACKER API
   ========================================================================== */

export const trackerApi = {
  async sendHeartbeat(data: {
    sessionId: string;
    userId?: string | null;
    username?: string;
    device?: DeviceInfo;
    currentScreen?: string;
    currentAction?: string;
    questionId?: number;
    questionsAttempted?: number;
    accuracyPercent?: number;
  }) {
    return apiRequest<{ success: boolean; session: any }>('/api/tracker/heartbeat', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

/**
 * Hydrates learner's complete historical study data (progress, notes, bookmarks, exam attempts)
 * from local backup and backend server into active client state
 */
export async function hydrateLearnerData(userId: string): Promise<void> {
  const userBackupKey = `aws_user_data_${userId}`;
  try {
    let userScopedCache: any = null;
    // 1. Instant hydration from user-scoped localStorage backup if present
    if (typeof window !== 'undefined' && window.localStorage) {
      const cached = localStorage.getItem(userBackupKey);
      if (cached) {
        try {
          userScopedCache = JSON.parse(cached);
          storage.hydrateFromUserData(userScopedCache);
          window.dispatchEvent(new Event('aws_storage_updated'));
        } catch {
          // Ignore cache parse error
        }
      } else {
        // Clear old previous user data so new account never inherits leftover questions
        storage.clearActiveUserData();
      }
    }

    // 2. Fetch fresh source of truth from backend database
    const [progressRes, notesRes, bookmarksRes, historyRes] = await Promise.allSettled([
      learnerApi.getProgress(),
      learnerApi.getNotes(),
      learnerApi.getBookmarks(),
      learnerApi.getHistory(),
    ]);

    let hasServerData = false;
    const hydratedData: {
      progress?: StudyProgress;
      notes?: Record<number, PersonalNote>;
      bookmarks?: number[];
      examHistory?: ExamAttemptRecord[];
    } = {};

    const cachedProgressItems = userScopedCache?.progress?.items || {};

    // Progress
    if (progressRes.status === 'fulfilled' && progressRes.value) {
      const items = progressRes.value.progress || progressRes.value.items || {};
      const serverCount = Object.keys(items).length;

      // Only merge with this user's scoped cache, NEVER with random unauthenticated browser progress
      const mergedItems = { ...cachedProgressItems };

      if (serverCount > 0) {
        hasServerData = true;
        for (const [qIdStr, item] of Object.entries(items)) {
          const qId = Number(qIdStr);
          const existing = mergedItems[qId];
          if (!existing || (!existing.isSubmitted && (item as any).isSubmitted) || ((item as any).lastAttemptedAt || 0) >= (existing.lastAttemptedAt || 0)) {
            mergedItems[qId] = {
              selectedAnswer: (item as any).selectedAnswer || (existing ? existing.selectedAnswer : ''),
              isSubmitted: Boolean((item as any).isSubmitted || (existing && existing.isSubmitted)),
              isCorrect: Boolean((item as any).isCorrect),
              confidence: (item as any).confidence || (existing ? existing.confidence : 'medium'),
              attemptsCount: Math.max((item as any).attemptsCount || 1, existing ? existing.attemptsCount || 1 : 1),
              lastAttemptedAt: Math.max((item as any).lastAttemptedAt || Date.now(), existing ? existing.lastAttemptedAt || 0 : 0),
            };
          }
        }
      }

      hydratedData.progress = {
        currentIndex: userScopedCache?.progress?.currentIndex || 0,
        items: mergedItems,
      };
    }

    // Notes
    const cachedNotes = userScopedCache?.notes || {};
    if (notesRes.status === 'fulfilled' && notesRes.value?.notes) {
      const serverNotes = notesRes.value.notes;
      if (Object.keys(serverNotes).length > 0) {
        hasServerData = true;
        const mergedNotes: Record<number, PersonalNote> = { ...cachedNotes };
        for (const [qIdStr, n] of Object.entries(serverNotes)) {
          const qId = Number(qIdStr);
          mergedNotes[qId] = {
            questionId: qId,
            noteText: (n as any).noteText,
            updatedAt: (n as any).updatedAt || Date.now(),
          };
        }
        hydratedData.notes = mergedNotes;
      }
    }

    // Bookmarks
    const cachedBookmarks = userScopedCache?.bookmarks || [];
    if (bookmarksRes.status === 'fulfilled' && Array.isArray(bookmarksRes.value?.bookmarks)) {
      const serverBookmarks = bookmarksRes.value.bookmarks;
      if (serverBookmarks.length > 0) {
        hasServerData = true;
        hydratedData.bookmarks = Array.from(new Set([...cachedBookmarks, ...serverBookmarks]));
      }
    }

    // Exam History
    if (historyRes.status === 'fulfilled' && Array.isArray(historyRes.value?.history)) {
      const serverHistory = historyRes.value.history;
      if (serverHistory.length > 0) {
        hasServerData = true;
        hydratedData.examHistory = serverHistory.map((h: any) => ({
          id: h.id,
          date: h.date,
          scorePercent: h.scorePercent ?? h.score_percent,
          scaledScore: h.scaledScore ?? h.scaled_score,
          passed: Boolean(h.passed),
          totalQuestions: h.totalQuestions ?? h.total_questions,
          correctCount: h.correctCount ?? h.correct_count,
          incorrectCount: h.incorrectCount ?? h.incorrect_count,
          unansweredCount: h.unansweredCount ?? h.unanswered_count,
          timeUsedSeconds: h.timeUsedSeconds ?? h.time_used_seconds,
          examType: h.examType ?? h.exam_type,
        }));
      }
    }

    if (hasServerData) {
      storage.hydrateFromUserData(hydratedData);
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(userBackupKey, JSON.stringify(storage.exportActiveUserData()));
      }
    } else if (userScopedCache) {
      storage.hydrateFromUserData(userScopedCache);
    } else {
      // Check if user has active local study or exam data in current browser
      const currentProg = storage.getStudyProgress();
      const currentExams = storage.getExamHistory();
      const currentNotes = storage.getAllNotes();
      const currentBookmarks = storage.getBookmarks();
      const hasLocalData =
        (currentProg.items && Object.keys(currentProg.items).length > 0) ||
        (currentExams && currentExams.length > 0) ||
        (currentNotes && Object.keys(currentNotes).length > 0);

      if (hasLocalData) {
        // Automatically sync local data to the server for this account
        learnerApi
          .migrateLocal(
            currentProg.items || {},
            currentNotes || {},
            currentBookmarks || [],
            currentExams || []
          )
          .catch(() => {});
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(userBackupKey, JSON.stringify(storage.exportActiveUserData()));
        }
      } else {
        // Brand new account: start fresh
        const freshData = {
          progress: { currentIndex: 0, items: {} },
          notes: {},
          bookmarks: [],
          examHistory: [],
        };
        storage.hydrateFromUserData(freshData);
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(userBackupKey, JSON.stringify(freshData));
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('aws_storage_updated'));
    }
  } catch (err) {
    console.warn('Lỗi hydrate dữ liệu người dùng:', err);
  }
}

/**
 * Automatically synchronizes all local study progress, exam history, notes, and bookmarks
 * to the backend database (Supabase PostgreSQL / SQLite)
 */
export async function syncLocalProgressToServer(): Promise<void> {
  const token = getStoredToken();
  const user = getStoredUser();
  if (!token || !user) return;

  try {
    const progress = storage.getStudyProgress();
    const notes = storage.getAllNotes();
    const bookmarks = storage.getBookmarks();
    const exams = storage.getExamHistory();

    const hasProgress = progress.items && Object.keys(progress.items).length > 0;
    const hasNotes = notes && Object.keys(notes).length > 0;
    const hasBookmarks = bookmarks && bookmarks.length > 0;
    const hasExams = exams && exams.length > 0;

    if (hasProgress || hasNotes || hasBookmarks || hasExams) {
      await learnerApi.migrateLocal(
        progress.items || {},
        notes || {},
        bookmarks || [],
        exams || []
      );
    }
  } catch (err) {
    console.warn('Lỗi đồng bộ dữ liệu người học lên máy chủ:', err);
  }
}

/**
 * Snapshot active user's study data to their user-scoped backup in localStorage
 */
export function backupLearnerData(userId: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const userBackupKey = `aws_user_data_${userId}`;
      const data = storage.exportActiveUserData();
      localStorage.setItem(userBackupKey, JSON.stringify(data));
    }
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Fetch diagram workbook from cloud (Supabase PostgreSQL)
 */
export async function fetchCloudWorkbook(): Promise<any | null> {
  try {
    const res = await apiRequest<{ workbook: any | null }>('/api/diagrams/workbook');
    return res.workbook;
  } catch (err) {
    console.warn('Lỗi tải diagram workbook từ cloud:', err);
    return null;
  }
}

/**
 * Persist diagram workbook to cloud (Supabase PostgreSQL)
 */
export async function syncCloudWorkbook(workbook: any): Promise<boolean> {
  try {
    const res = await apiRequest<{ success: boolean }>('/api/diagrams/workbook', {
      method: 'POST',
      body: JSON.stringify({ workbook }),
    });
    return Boolean(res.success);
  } catch (err) {
    console.warn('Lỗi lưu diagram workbook lên cloud:', err);
    return false;
  }
}
