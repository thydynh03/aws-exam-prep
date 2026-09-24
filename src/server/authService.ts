import crypto from 'node:crypto';
import { db, dbQueryOne, dbExecute } from './db.js';
import { persistLearnerToRegistry } from './learnerRegistry.js';
import { broadcastRealtimeEvent } from './realtimeService.js';

export interface UserRecord {
  id: string;
  username: string;
  role: 'LEARNER' | 'ADMIN';
  created_at: number;
  last_active_at: number;
}

export interface DeviceInfo {
  deviceType?: string; // 'Desktop' | 'Mobile' | 'Tablet'
  os?: string;
  browser?: string;
  userAgent?: string;
  platform?: string;
  screenResolution?: string;
}

export function getAdminPasscode(): string {
  return (process.env.ADMIN_PASSCODE || 'admin123').trim();
}
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_SECRET = process.env.SESSION_SECRET || 'aws-exam-prep-secret-key-2026-v1';

export interface TokenPayload {
  uid: string;
  u: string;
  r: 'LEARNER' | 'ADMIN';
  exp: number;
}

export function createSignedToken(payload: TokenPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `sess_${data}.${sig}`;
}

export function verifySignedToken(token: string): TokenPayload | null {
  if (!token || !token.startsWith('sess_')) return null;
  const parts = token.slice(5).split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  if (sig !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as TokenPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Validate and sanitize username input
 */
export function validateUsername(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new Error('Tên người dùng (Username) phải là chuỗi ký tự.');
  }
  const trimmed = raw.trim();
  if (trimmed.length < 2) {
    throw new Error('Tên người dùng phải có tối thiểu 2 ký tự.');
  }
  if (trimmed.length > 50) {
    throw new Error('Tên người dùng không được vượt quá 50 ký tự.');
  }
  if (!/^[a-zA-Z0-9_\-. ]+$/.test(trimmed)) {
    throw new Error('Tên người dùng chỉ chứa chữ cái, chữ số, dấu gạch ngang hoặc dấu cách.');
  }
  return trimmed;
}

/**
 * Login or register user by username
 */
export async function loginUser(
  rawUsername: string,
  adminPasscode?: string,
  device?: DeviceInfo
): Promise<{ user: UserRecord; token: string }> {
  const username = validateUsername(rawUsername);
  const now = Date.now();

  // Look up existing user
  const existing = await dbQueryOne<UserRecord>(
    'SELECT id, username, role, created_at, last_active_at FROM users WHERE username = ? COLLATE NOCASE',
    [username]
  );

  let user: UserRecord;

  if (existing) {
    const expectedPasscode = getAdminPasscode();
    // If the account has ADMIN role or is "admin", verify admin passcode
    if (existing.role === 'ADMIN' || existing.username.toLowerCase() === 'admin') {
      if (!adminPasscode || adminPasscode.trim() !== expectedPasscode) {
        throw new Error('Mật mã quản trị viên (Admin Passcode) không chính xác.');
      }
    }

    // Update last active
    await dbExecute('UPDATE users SET last_active_at = ? WHERE id = ?', [now, existing.id]);
    user = { ...existing, last_active_at: now };
  } else {
    // Determine role for new user
    let role: 'LEARNER' | 'ADMIN' = 'LEARNER';
    if (username.toLowerCase() === 'admin') {
      const expectedPasscode = getAdminPasscode();
      if (!adminPasscode || adminPasscode.trim() !== expectedPasscode) {
        throw new Error('Mật mã quản trị viên (Admin Passcode) không chính xác khi tạo tài khoản Admin.');
      }
      role = 'ADMIN';
    }

    const userId = `usr_${crypto.randomUUID().slice(0, 8)}`;
    await dbExecute(
      `INSERT INTO users (id, username, role, created_at, last_active_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET last_active_at = excluded.last_active_at`,
      [userId, username, role, now, now]
    );

    user = {
      id: userId,
      username,
      role,
      created_at: now,
      last_active_at: now,
    };
  }

  // Automatically persist learner to permanent registry and broadcast realtime event
  if (user.role === 'LEARNER') {
    persistLearnerToRegistry({
      id: user.id,
      username: user.username,
      role: 'LEARNER',
      createdAt: user.created_at,
      lastActiveAt: user.last_active_at,
      device,
    });
    try {
      broadcastRealtimeEvent('learner_registered', { learner: user });
    } catch {
      // Ignore broadcast errors
    }
  }

  // Create signed session token
  const expiresAt = now + SESSION_TTL_MS;
  const token = createSignedToken({
    uid: user.id,
    u: user.username,
    r: user.role,
    exp: expiresAt,
  });
  const deviceInfoStr = device ? JSON.stringify(device) : null;

  try {
    await dbExecute(
      `INSERT INTO sessions (token, user_id, created_at, expires_at, device_info)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (token) DO NOTHING`,
      [token, user.id, now, expiresAt, deviceInfoStr]
    );
  } catch {
    // Ignore if session insert fails
  }

  // Track / update device
  if (device) {
    let deviceType = device.deviceType;
    let os = device.os;
    let browser = device.browser;

    const ua = (device.userAgent || '').toLowerCase();
    const plat = (device.platform || '').toLowerCase();

    if (!deviceType) {
      if (/mobile|iphone|ipod|android.*mobile|windows phone/.test(ua) || /iphone|android/.test(plat)) {
        deviceType = 'Mobile';
      } else if (/ipad|tablet|android(?!.*mobile)/.test(ua)) {
        deviceType = 'Tablet';
      } else {
        deviceType = 'Desktop';
      }
    }

    if (!os) {
      if (/windows|win32|win64/.test(ua) || /win/.test(plat)) os = 'Windows';
      else if (/macintosh|mac os x/.test(ua) || /mac/.test(plat)) os = 'macOS';
      else if (/iphone|ipad|ipod/.test(ua) || /ios/.test(plat)) os = 'iOS';
      else if (/android/.test(ua) || /android/.test(plat)) os = 'Android';
      else if (/linux/.test(ua) || /linux/.test(plat)) os = 'Linux';
      else os = 'Unknown OS';
    }

    if (!browser) {
      if (/edg\//.test(ua)) browser = 'Edge';
      else if (/chrome\//.test(ua)) browser = 'Chrome';
      else if (/firefox\//.test(ua)) browser = 'Firefox';
      else if (/safari\//.test(ua)) browser = 'Safari';
      else browser = 'Browser';
    }

    const devId = `dev_${crypto.randomUUID().slice(0, 8)}`;

    try {
      await dbExecute(
        `INSERT INTO user_devices (id, user_id, device_type, os, browser, session_count, last_active_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)
         ON CONFLICT(user_id, device_type, os, browser) DO UPDATE SET
           session_count = user_devices.session_count + 1,
           last_active_at = excluded.last_active_at`,
        [devId, user.id, deviceType, os, browser, now]
      );
    } catch {
      // Ignore device insert errors
    }
  }

  return { user, token };
}

/**
 * Validate session token from Authorization header
 */
export function validateSession(token: string): UserRecord | null {
  if (!token || typeof token !== 'string') return null;

  const now = Date.now();

  // 1. Verify signed token (works reliably across all serverless lambda containers)
  const payload = verifySignedToken(token);
  if (payload) {
    // Touch in background without blocking
    dbExecute(
      `INSERT INTO users (id, username, role, created_at, last_active_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET last_active_at = excluded.last_active_at`,
      [payload.uid, payload.u, payload.r, now, now]
    ).catch(() => {});

    return {
      id: payload.uid,
      username: payload.u,
      role: payload.r,
      created_at: now,
      last_active_at: now,
    };
  }

  // 2. Fallback to local sessions table in SQLite
  try {
    if (db) {
      const session = db
        .prepare(`
          SELECT s.token, s.expires_at, u.id, u.username, u.role, u.created_at, u.last_active_at
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.token = ? AND s.expires_at > ?
        `)
        .get(token, now) as unknown as (UserRecord & { token: string; expires_at: number }) | undefined;

      if (!session) return null;

      return {
        id: session.id,
        username: session.username,
        role: session.role,
        created_at: session.created_at,
        last_active_at: now,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Terminate session
 */
export async function logoutUser(token: string): Promise<void> {
  if (token) {
    await dbExecute('DELETE FROM sessions WHERE token = ?', [token]);
  }
}
