import crypto from 'node:crypto';
import type express from 'express';
import { dbQuery, dbQueryOne, dbExecute } from './db.js';
import { persistLearnerToRegistry } from './learnerRegistry.js';
import { broadcastRealtimeEvent } from './realtimeService.js';

export interface LiveSessionPayload {
  sessionId: string;
  userId?: string | null;
  username?: string;
  device?: {
    deviceType?: string;
    os?: string;
    browser?: string;
    screenResolution?: string;
    userAgent?: string;
    platform?: string;
  };
  currentScreen?: string;
  currentAction?: string;
  questionId?: number;
  questionsAttempted?: number;
  accuracyPercent?: number;
  role?: 'ADMIN' | 'LEARNER' | 'GUEST';
}

export interface LiveSessionRecord {
  sessionId: string;
  userId: string | null;
  username: string;
  role?: 'ADMIN' | 'LEARNER' | 'GUEST';
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
  isOnline?: boolean;
  durationSeconds?: number;
}

// In-memory fast cache of active sessions
const memoryLiveSessions = new Map<string, LiveSessionRecord>();

/**
 * Robustly extract client IP address across reverse proxies, CDNs (Cloudflare, Vercel), and standard sockets
 */
export function extractClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    const first = forwarded.split(',')[0].trim();
    if (first) return normalizeIp(first);
  }

  const cfConnectingIp = req.headers['cf-connecting-ip'];
  if (typeof cfConnectingIp === 'string' && cfConnectingIp.trim().length > 0) {
    return normalizeIp(cfConnectingIp.trim());
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim().length > 0) {
    return normalizeIp(realIp.trim());
  }

  const socketIp = req.socket?.remoteAddress;
  if (socketIp) {
    return normalizeIp(socketIp);
  }

  return '127.0.0.1';
}

function normalizeIp(ip: string): string {
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.1 (Localhost)';
  }
  if (ip.startsWith('::ffff:')) {
    return ip.replace('::ffff:', '');
  }
  return ip;
}

/**
 * Parse client device, OS, and browser from provided hints and User-Agent
 */
export function parseDeviceDetails(
  hints?: LiveSessionPayload['device'],
  rawUserAgent = ''
): {
  deviceType: string;
  os: string;
  browser: string;
  screenResolution: string;
} {
  const ua = (hints?.userAgent || rawUserAgent || '').toLowerCase();
  const plat = (hints?.platform || '').toLowerCase();

  // 1. Device Type
  let deviceType = hints?.deviceType;
  if (!deviceType) {
    if (/mobile|iphone|ipod|android.*mobile|windows phone/.test(ua) || /iphone|android/.test(plat)) {
      deviceType = 'Mobile';
    } else if (/ipad|tablet|android(?!.*mobile)/.test(ua)) {
      deviceType = 'Tablet';
    } else {
      deviceType = 'Desktop';
    }
  }

  // 2. OS
  let os = hints?.os;
  if (!os || os === 'Unknown OS') {
    if (/windows nt 10\.0/.test(ua)) os = 'Windows 10/11';
    else if (/windows|win32|win64/.test(ua) || /win/.test(plat)) os = 'Windows';
    else if (/macintosh|mac os x/.test(ua) || /mac/.test(plat)) os = 'macOS';
    else if (/iphone|ipad|ipod/.test(ua) || /ios/.test(plat)) os = 'iOS';
    else if (/android/.test(ua) || /android/.test(plat)) os = 'Android';
    else if (/cros/.test(ua)) os = 'ChromeOS';
    else if (/linux/.test(ua) || /linux/.test(plat)) os = 'Linux';
    else os = 'Thiết bị khác';
  }

  // 3. Browser
  let browser = hints?.browser;
  if (!browser || browser === 'Unknown Browser') {
    if (/coccoc/.test(ua)) browser = 'Cốc Cốc';
    else if (/edg\//.test(ua)) browser = 'Microsoft Edge';
    else if (/opr\/|opera/.test(ua)) browser = 'Opera';
    else if (/brave/.test(ua)) browser = 'Brave';
    else if (/chrome\//.test(ua) && !/edg\//.test(ua)) browser = 'Google Chrome';
    else if (/safari\//.test(ua) && !/chrome\//.test(ua)) browser = 'Apple Safari';
    else if (/firefox\//.test(ua)) browser = 'Mozilla Firefox';
    else browser = 'Trình duyệt Web';
  }

  const screenResolution = hints?.screenResolution || 'Chưa xác định';

  return { deviceType, os, browser, screenResolution };
}

/**
 * Record or update a live session heartbeat
 */
export async function recordHeartbeat(
  req: express.Request,
  payload: LiveSessionPayload
): Promise<LiveSessionRecord> {
  const now = Date.now();
  const sessionId = payload.sessionId?.trim() || `anon_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const ipAddress = extractClientIp(req);
  const rawUa = req.headers['user-agent'] || '';

  const { deviceType, os, browser, screenResolution } = parseDeviceDetails(payload.device, rawUa);

  // Derive friendly username if not provided or anonymous guest
  let username = (payload.username || '').trim();
  const userId = payload.userId ? String(payload.userId).trim() : null;

  if (!username || username.toLowerCase() === 'guest' || username.toLowerCase() === 'khách') {
    const hash = sessionId.slice(-4).toUpperCase();
    username = `Khách #${hash}`;
  }

  const isAdmin = username.toLowerCase() === 'admin' || payload.role === 'ADMIN';
  const role: 'ADMIN' | 'LEARNER' | 'GUEST' = isAdmin
    ? 'ADMIN'
    : (userId || !username.startsWith('Khách #') ? 'LEARNER' : 'GUEST');

  // When an authenticated user logs in or sends heartbeat, purge any obsolete guest session or older duplicate session from the exact same device & IP
  if (role !== 'GUEST') {
    try {
      await dbExecute(`
        DELETE FROM live_sessions
        WHERE (
          (username LIKE 'Khách #%' AND ip_address = ? AND os = ? AND browser = ?)
          OR (username = ? COLLATE NOCASE AND session_id != ? AND ip_address = ? AND os = ? AND browser = ?)
        )
      `, [ipAddress, os, browser, username, sessionId, ipAddress, os, browser]);

      for (const [memId, memRecord] of memoryLiveSessions.entries()) {
        if (
          memRecord.sessionId !== sessionId &&
          memRecord.ipAddress === ipAddress &&
          memRecord.os === os &&
          memRecord.browser === browser &&
          (memRecord.username.startsWith('Khách #') || memRecord.username.toLowerCase() === username.toLowerCase())
        ) {
          memoryLiveSessions.delete(memId);
        }
      }
    } catch {
      // Ignore cleanup error
    }
  }

  // Ensure user exists in `users` table so stats and relationships align
  let targetUserId: string | null = null;
  let isNewlyCreated = false;
  if (username && !username.startsWith('Khách #')) {
    try {
      const userRow = await dbQueryOne<{ id: string; role: string }>('SELECT id, role FROM users WHERE username = ? COLLATE NOCASE', [username]);
      if (userRow) {
        targetUserId = userRow.id;
        await dbExecute('UPDATE users SET last_active_at = max(last_active_at, ?) WHERE id = ?', [now, targetUserId]);
      } else {
        targetUserId = userId || `usr_${crypto.randomUUID().slice(0, 8)}`;
        const userRole = isAdmin ? 'ADMIN' : 'LEARNER';
        await dbExecute(`
          INSERT INTO users (id, username, role, created_at, last_active_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(username) DO UPDATE SET last_active_at = max(users.last_active_at, excluded.last_active_at)
        `, [targetUserId, username, userRole, now, now]);
        isNewlyCreated = true;
      }

      // Automatically keep registry updated with learner (never add Admin to learner registry)
      if (!isAdmin && targetUserId) {
        persistLearnerToRegistry({
          id: targetUserId,
          username,
          role: 'LEARNER',
          lastActiveAt: now,
          device: { deviceType, os, browser },
        });

        // Track in user_devices
        try {
          const devId = `dev_${crypto.randomUUID().slice(0, 8)}`;
          await dbExecute(`
            INSERT INTO user_devices (id, user_id, device_type, os, browser, session_count, last_active_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            ON CONFLICT(user_id, device_type, os, browser) DO UPDATE SET
              session_count = user_devices.session_count + 1,
              last_active_at = excluded.last_active_at
          `, [devId, targetUserId, deviceType, os, browser, now]);
        } catch {
          // Ignore device constraint error
        }
      }
    } catch (err) {
      console.warn(`Lỗi ghi nhận học viên '${username}' vào users:`, err);
    }
  } else if (userId) {
    targetUserId = userId;
  }

  const currentScreen = payload.currentScreen?.trim() || 'Trang chủ';
  const currentAction = payload.currentAction?.trim() || 'Đang duyệt trang';
  const questionId = typeof payload.questionId === 'number' ? payload.questionId : null;
  // Check existing memory record to maintain `startedAt` and previous counts if omitted
  const existingMem = memoryLiveSessions.get(sessionId);
  const startedAt = existingMem?.startedAt || now;

  const questionsAttempted = typeof payload.questionsAttempted === 'number'
    ? Math.max(0, payload.questionsAttempted)
    : (existingMem?.questionsAttempted || 0);
  const accuracyPercent = typeof payload.accuracyPercent === 'number'
    ? Math.max(0, Math.min(100, payload.accuracyPercent))
    : (existingMem?.accuracyPercent || 0);

  const record: LiveSessionRecord = {
    sessionId,
    userId: targetUserId,
    username,
    role,
    ipAddress,
    deviceType,
    os,
    browser,
    screenResolution,
    currentScreen,
    currentAction,
    questionId,
    questionsAttempted,
    accuracyPercent,
    startedAt,
    lastActiveAt: now,
  };

  memoryLiveSessions.set(sessionId, record);

  // Persist to dual-engine database
  try {
    await dbExecute(`
      INSERT INTO live_sessions (
        session_id, user_id, username, ip_address, device_type, os, browser,
        screen_resolution, current_screen, current_action, question_id,
        questions_attempted, accuracy_percent, started_at, last_active_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        user_id = COALESCE(excluded.user_id, live_sessions.user_id),
        username = excluded.username,
        ip_address = excluded.ip_address,
        device_type = excluded.device_type,
        os = excluded.os,
        browser = excluded.browser,
        screen_resolution = excluded.screen_resolution,
        current_screen = excluded.current_screen,
        current_action = excluded.current_action,
        question_id = excluded.question_id,
        questions_attempted = max(live_sessions.questions_attempted, excluded.questions_attempted),
        accuracy_percent = CASE WHEN excluded.questions_attempted > 0 THEN excluded.accuracy_percent ELSE live_sessions.accuracy_percent END,
        last_active_at = excluded.last_active_at
    `, [
      sessionId,
      targetUserId,
      username,
      ipAddress,
      deviceType,
      os,
      browser,
      screenResolution,
      currentScreen,
      currentAction,
      questionId,
      questionsAttempted,
      accuracyPercent,
      startedAt,
      now
    ]);
  } catch {
    // Gracefully handle constraint / lock errors in serverless
  }

  const finalRecord = {
    ...record,
    isOnline: true,
    durationSeconds: Math.max(1, Math.round((now - startedAt) / 1000)),
  };

  // Broadcast realtime session heartbeat to listening admin dashboards
  try {
    broadcastRealtimeEvent('session_heartbeat', {
      session: finalRecord,
    });
    if (isNewlyCreated && !isAdmin && targetUserId) {
      broadcastRealtimeEvent('learner_registered', {
        learner: {
          id: targetUserId,
          username,
          role: 'LEARNER',
          createdAt: now,
          lastActiveAt: now,
          questionsAttempted,
          correctCount: Math.round(questionsAttempted * accuracyPercent / 100),
          accuracyPercent,
        },
      });
    }
  } catch {
    // Ignore realtime broadcast errors
  }

  return finalRecord;
}

/**
 * Retrieve all live sessions active within the last maxAgeMs (default 15 mins)
 */
export async function getLiveSessions(maxAgeMs = 15 * 60 * 1000): Promise<{
  sessions: LiveSessionRecord[];
  activeCount: number;
  onlineCount: number;
}> {
  const now = Date.now();
  const threshold = now - maxAgeMs;

  let rows: any[] = [];
  try {
    rows = await dbQuery(`
      SELECT
        session_id as "sessionId",
        user_id as "userId",
        username,
        ip_address as "ipAddress",
        device_type as "deviceType",
        os,
        browser,
        screen_resolution as "screenResolution",
        current_screen as "currentScreen",
        current_action as "currentAction",
        question_id as "questionId",
        questions_attempted as "questionsAttempted",
        accuracy_percent as "accuracyPercent",
        started_at as "startedAt",
        last_active_at as "lastActiveAt"
      FROM live_sessions
      WHERE last_active_at >= ?
      ORDER BY last_active_at DESC
      LIMIT 100
    `, [threshold]);
  } catch {
    // If DB fails, fallback to memory
    rows = Array.from(memoryLiveSessions.values()).filter(s => s.lastActiveAt >= threshold);
  }

  // Deduplicate: If an authenticated session exists for a given IP and device, omit any guest session from the exact same client
  const authenticatedClientKeys = new Set<string>();
  for (const r of rows) {
    const isAuth = (r.username && !r.username.startsWith('Khách #')) || Boolean(r.userId);
    if (isAuth) {
      authenticatedClientKeys.add(`${r.ipAddress}_${r.os}_${r.browser}`);
    }
  }

  // Deduplicate:
  // 1. If an authenticated session exists for a given client device, hide any guest session from the exact same client.
  // 2. For any user (admin or learner), keep ONLY the newest session per user on the same client device.
  const seenUserClientKeys = new Set<string>();
  const validRows = rows.filter((r: any) => {
    const clientKey = `${r.ipAddress}_${r.os}_${r.browser}`;
    const isGuest = !r.username || r.username.startsWith('Khách #');

    if (isGuest) {
      if (authenticatedClientKeys.has(clientKey)) {
        return false; // Hide superseded guest session
      }
      return true;
    }

    // Authenticated user (e.g. admin, drgx, etc.)
    const userClientKey = `${r.username.toLowerCase()}_${clientKey}`;
    if (seenUserClientKeys.has(userClientKey)) {
      return false; // Hide older superseded/offline session of the exact same user on the same client
    }
    seenUserClientKeys.add(userClientKey);
    return true;
  });

  const sessions: LiveSessionRecord[] = validRows.map((r: any) => {
    const isOnline = now - r.lastActiveAt <= 60 * 1000; // active in last 60 seconds
    const durationSeconds = Math.max(1, Math.round((r.lastActiveAt - r.startedAt) / 1000));
    const isAdmin = r.username?.toLowerCase() === 'admin' || r.role === 'ADMIN';
    const role: 'ADMIN' | 'LEARNER' | 'GUEST' = isAdmin ? 'ADMIN' : (r.userId ? 'LEARNER' : 'GUEST');
    return {
      ...r,
      role,
      isOnline,
      durationSeconds,
    };
  });

  const onlineCount = sessions.filter(s => s.isOnline).length;

  return {
    sessions,
    activeCount: sessions.length,
    onlineCount,
  };
}

/**
 * Periodic clean-up of obsolete sessions older than 24 hours
 */
export async function cleanupExpiredLiveSessions(maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
  const threshold = Date.now() - maxAgeMs;
  try {
    await dbExecute('DELETE FROM live_sessions WHERE last_active_at < ?', [threshold]);
  } catch {
    // Ignore
  }

  for (const [id, s] of memoryLiveSessions.entries()) {
    if (s.lastActiveAt < threshold) {
      memoryLiveSessions.delete(id);
    }
  }
}

export interface LearnerScreenFrame {
  sessionId: string;
  userId: string | null;
  username: string;
  role?: 'ADMIN' | 'LEARNER' | 'GUEST';
  ipAddress?: string;
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
    xPercent: number;
    yPercent: number;
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
  examState?: {
    timeRemainingSeconds?: number;
    totalQuestions?: number;
    currentQuestionIndex?: number;
  };
  screenImage?: string; // Real screen capture JPEG base64
  recentLogs: Array<{
    id: string;
    timestamp: number;
    text: string;
    badge?: string;
  }>;
  updatedAt: number;
}

// In-memory cache of latest screen frames for live UltraView mirroring
const activeScreenFrames = new Map<string, LearnerScreenFrame>();

export function recordScreenFrame(frame: LearnerScreenFrame): LearnerScreenFrame {
  const existing = activeScreenFrames.get(frame.sessionId) || (frame.username ? activeScreenFrames.get(`user_${frame.username.toLowerCase()}`) : undefined);
  const enriched: LearnerScreenFrame = {
    ...existing,
    ...frame,
    screenImage: frame.screenImage || existing?.screenImage,
    updatedAt: Date.now(),
  };
  activeScreenFrames.set(frame.sessionId, enriched);
  if (frame.username) {
    activeScreenFrames.set(`user_${frame.username.toLowerCase()}`, enriched);
  }

  // Periodic pruning if frame cache exceeds 200 items
  if (activeScreenFrames.size > 200) {
    const expireThreshold = Date.now() - 30 * 60 * 1000;
    for (const [key, f] of activeScreenFrames.entries()) {
      if (f.updatedAt < expireThreshold) {
        activeScreenFrames.delete(key);
      }
    }
  }

  return enriched;
}

export function getScreenFrame(sessionIdOrUsername: string): LearnerScreenFrame | null {
  if (!sessionIdOrUsername) return null;
  const direct = activeScreenFrames.get(sessionIdOrUsername);
  if (direct) return direct;
  return activeScreenFrames.get(`user_${sessionIdOrUsername.toLowerCase()}`) || null;
}

