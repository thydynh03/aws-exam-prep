import type { Request, Response, NextFunction } from 'express';
import { validateSession, type UserRecord } from './authService.js';

// ── In-memory rate limiter for login brute-force protection ────────
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5;

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export function loginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (entry && now < entry.resetAt) {
    if (entry.count >= RATE_LIMIT_MAX_ATTEMPTS) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.status(429).json({
        error: `Quá nhiều lần đăng nhập thất bại. Thử lại sau ${retryAfterSec} giây.`,
        retryAfter: retryAfterSec,
      });
      return;
    }
    entry.count++;
  } else {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }

  // Cleanup old entries every 100 requests
  if (loginAttempts.size > 1000) {
    for (const [key, val] of loginAttempts) {
      if (now > val.resetAt) loginAttempts.delete(key);
    }
  }

  next();
}

export function resetLoginAttempts(req: Request) {
  const ip = getClientIp(req);
  loginAttempts.delete(ip);
}

export interface AuthenticatedRequest extends Request {
  user?: UserRecord;
  token?: string;
}


/**
 * Authentication Middleware: enforces valid Bearer session token
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Yêu cầu xác thực. Vui lòng đăng nhập để tiếp tục.' });
    return;
  }

  const token = authHeader.slice(7).trim();
  const user = validateSession(token);

  if (!user) {
    res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' });
    return;
  }

  req.user = user;
  req.token = token;
  next();
}

/**
 * Role-Based Access Control (RBAC) Middleware: enforces required role
 */
export function requireRole(role: 'ADMIN' | 'LEARNER') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Yêu cầu xác thực trước khi kiểm tra quyền.' });
      return;
    }

    if (req.user.role !== role) {
      res.status(403).json({
        error: `Quyền truy cập bị từ chối. Chức năng này yêu cầu quyền ${role}.`,
        currentRole: req.user.role,
        requiredRole: role,
      });
      return;
    }

    next();
  };
}

/**
 * Optional Auth Middleware: attaches user if token is present, but doesn't block if not
 */
export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const user = validateSession(token);
    if (user) {
      req.user = user;
      req.token = token;
    }
  }
  next();
}

/**
 * Data Ownership Middleware (IDOR Prevention):
 * Ensures learner can only access their own user ID, while ADMIN can access any user
 */
export function requireOwnershipOrAdmin(paramName: string = 'id') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa xác thực danh tính.' });
      return;
    }

    const requestedId = req.params[paramName];
    if (req.user.role === 'ADMIN' || req.user.id === requestedId || requestedId === 'me') {
      next();
      return;
    }

    res.status(403).json({
      error: 'Truy cập bị từ chối: Bạn không được phép xem hoặc chỉnh sửa dữ liệu của học viên khác.',
    });
  };
}
