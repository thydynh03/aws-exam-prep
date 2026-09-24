/**
 * User-scoped conversation storage for AWS AI Tutor
 * Isolates chat history per learner so conversations remain strictly private.
 */

export interface AICitation {
  id: string;
  title: string;
  snippet?: string;
  url?: string;
  type: 'question' | 'aws_service' | 'user_note' | 'official_doc';
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  currentQuestionId?: number;
  attachedImage?: {
    name: string;
    dataUrl: string;
  };
  citations?: AICitation[];
  confidence?: 'VERIFIED' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceScore?: number;
  fastPathHit?: boolean;
  memoryMatch?: any | null;
  queryId?: string;
  securityFlags?: string[];
  pipelineSteps?: any[];
  telemetry?: {
    modelUsed?: string;
    totalLatencyMs?: number;
    rerankUsed?: boolean;
  };
  feedback?: {
    helpful: boolean;
    reason?: string;
    comment?: string;
    errorType?: string;
    userCorrection?: string;
  };
}

export interface AIChatThread {
  id: string;
  title: string;
  messages: AIChatMessage[];
  createdAt: number;
  updatedAt: number;
  inputDraft?: string;
  attachedImageDraft?: {
    name: string;
    dataUrl: string;
  } | null;
}

const CONV_PREFIX = 'aws_ai_conversation_';
const THREADS_PREFIX = 'aws_ai_threads_';
const ACTIVE_THREAD_PREFIX = 'aws_ai_active_thread_';
const memoryConvStore: Map<string, string> = new Map();

export function getConversationStorageKey(userId: string): string {
  const safeId = (userId || 'guest').trim().toLowerCase();
  return `${CONV_PREFIX}${safeId}`;
}

export function getThreadsStorageKey(userId: string): string {
  const safeId = (userId || 'guest').trim().toLowerCase();
  return `${THREADS_PREFIX}${safeId}`;
}

export function getActiveThreadStorageKey(userId: string): string {
  const safeId = (userId || 'guest').trim().toLowerCase();
  return `${ACTIVE_THREAD_PREFIX}${safeId}`;
}

export function createDefaultThread(title = 'Tiến trình 1', initialMessages: AIChatMessage[] = []): AIChatThread {
  const now = Date.now();
  return {
    id: `thread_${now}_${Math.random().toString(36).slice(2, 7)}`,
    title,
    messages: initialMessages,
    createdAt: now,
    updatedAt: now,
    inputDraft: '',
    attachedImageDraft: null,
  };
}

export function getAIThreads(userId: string): AIChatThread[] {
  const key = getThreadsStorageKey(userId);
  let raw: string | null = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = memoryConvStore.get(key) || null;
    }
  } else {
    raw = memoryConvStore.get(key) || null;
  }

  if (raw) {
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    } catch {
      // Fallback to migration
    }
  }

  // Backward-compatibility: Check if legacy single-conversation exists
  const legacyMessages = getAIConversation(userId);
  const defaultThread = createDefaultThread('Tiến trình 1', legacyMessages);
  saveAIThreads(userId, [defaultThread], defaultThread.id);
  return [defaultThread];
}

export function saveAIThreads(userId: string, threads: AIChatThread[], activeThreadId?: string): void {
  const key = getThreadsStorageKey(userId);
  try {
    // Limit to max 15 threads and max 50 messages per thread to preserve localStorage budget
    const trimmed = threads.slice(0, 15).map((t) => ({
      ...t,
      messages: t.messages.slice(-50),
    }));
    const serialized = JSON.stringify(trimmed);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, serialized);
      } catch {
        memoryConvStore.set(key, serialized);
      }
    } else {
      memoryConvStore.set(key, serialized);
    }

    if (activeThreadId) {
      saveActiveThreadId(userId, activeThreadId);
      // Sync legacy conversation key with the active thread's messages
      const active = trimmed.find((t) => t.id === activeThreadId);
      if (active) {
        saveAIConversation(userId, active.messages);
      }
    }
  } catch {
    // Ignore quota errors
  }
}

export function getActiveThreadId(userId: string): string {
  const key = getActiveThreadStorageKey(userId);
  let threadId: string | null = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      threadId = window.localStorage.getItem(key);
    } catch {
      threadId = memoryConvStore.get(key) || null;
    }
  } else {
    threadId = memoryConvStore.get(key) || null;
  }
  return threadId || '';
}

export function saveActiveThreadId(userId: string, threadId: string): void {
  const key = getActiveThreadStorageKey(userId);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, threadId);
    } catch {
      memoryConvStore.set(key, threadId);
    }
  } else {
    memoryConvStore.set(key, threadId);
  }
}

export function getAIConversation(userId: string): AIChatMessage[] {
  const key = getConversationStorageKey(userId);
  let raw: string | null = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = memoryConvStore.get(key) || null;
    }
  } else {
    raw = memoryConvStore.get(key) || null;
  }

  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveAIConversation(userId: string, messages: AIChatMessage[]): void {
  const key = getConversationStorageKey(userId);
  try {
    // Keep maximum 60 messages to preserve localStorage budget
    const truncated = messages.slice(-60);
    const serialized = JSON.stringify(truncated);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, serialized);
      } catch {
        memoryConvStore.set(key, serialized);
      }
    } else {
      memoryConvStore.set(key, serialized);
    }
  } catch {
    // Ignore quota errors
  }
}

export function clearAIConversation(userId: string): void {
  const key = getConversationStorageKey(userId);
  const threadsKey = getThreadsStorageKey(userId);
  const activeKey = getActiveThreadStorageKey(userId);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
      window.localStorage.removeItem(threadsKey);
      window.localStorage.removeItem(activeKey);
    } catch {
      // Ignore
    }
  }
  memoryConvStore.delete(key);
  memoryConvStore.delete(threadsKey);
  memoryConvStore.delete(activeKey);
}

export interface ExportedAIQuery {
  id: string;
  userId: string;
  username: string;
  ipAddress?: string | null;
  questionId: number | null;
  prompt: string;
  response: string | null;
  createdAt: number;
  mode: string;
  provider: string;
}

export function exportLocalConversationsAsQueries(): ExportedAIQuery[] {
  const results: ExportedAIQuery[] = [];
  if (typeof window === 'undefined' || !window.localStorage) return results;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CONV_PREFIX)) {
        const rawUserId = key.slice(CONV_PREFIX.length);
        const messages = getAIConversation(rawUserId);

        for (let m = 0; m < messages.length; m++) {
          const current = messages[m];
          if (current.role === 'user' && current.content) {
            const next = messages[m + 1];
            const response = next && next.role === 'assistant' ? next.content : null;

            results.push({
              id: `aiq_local_${current.id || current.timestamp}`,
              userId: rawUserId,
              username: rawUserId === 'guest' || rawUserId === 'guest_learner' ? 'Khách vãng lai' : rawUserId,
              ipAddress: null,
              questionId: current.currentQuestionId ?? null,
              prompt: current.content,
              response,
              createdAt: current.timestamp || Date.now(),
              mode: 'explain',
              provider: 'local_rag',
            });
          }
        }
      }
    }
  } catch {
    // Ignore localStorage scan error
  }

  return results.sort((a, b) => b.createdAt - a.createdAt);
}

