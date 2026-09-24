import type { Request, Response, NextFunction } from 'express';
import { validateSession, type UserRecord } from './authService.js';

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
