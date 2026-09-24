import crypto from 'node:crypto';
import { dbQuery, dbQueryOne, dbExecute } from './db.js';

export interface FeedbackItem {
  id: string;
  userId: string;
  username?: string;
  type: 'bug' | 'question_error' | 'ui_ux' | 'feature_request' | 'general';
  title: string;
  content: string;
  status: 'NEW' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  adminResponse?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Submit new feedback from a Learner
 */
export async function createFeedback(userId: string, data: {
  type: string;
  title: string;
  content: string;
  priority?: string;
}): Promise<FeedbackItem> {
  const title = (data.title || '').trim();
  const content = (data.content || '').trim();

  if (!title) throw new Error('Tiêu đề phản hồi (title) không được để trống.');
  if (!content) throw new Error('Nội dung phản hồi (content) không được để trống.');

  const id = `fb_${crypto.randomUUID().slice(0, 8)}`;
  
  const rawType = (data.type || 'general').toLowerCase();
  const validTypes = ['bug', 'question_error', 'ui_ux', 'feature_request', 'general'];
  const type = (validTypes.includes(rawType) ? rawType : 'general') as any;

  const rawPriority = (data.priority || 'MEDIUM').toUpperCase();
  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const priority = (validPriorities.includes(rawPriority) ? rawPriority : 'MEDIUM') as any;

  const status = 'NEW';
  const now = Date.now();

  await dbExecute(`
    INSERT INTO feedback (id, user_id, type, title, content, status, priority, admin_response, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, null, ?, ?)
  `, [id, userId, type, title, content, status, priority, now, now]);

  return {
    id,
    userId,
    type,
    title,
    content,
    status,
    priority,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get feedback submitted by a specific learner
 */
export async function getLearnerFeedbacks(userId: string): Promise<FeedbackItem[]> {
  const rows = await dbQuery<FeedbackItem>(`
    SELECT id, user_id as "userId", type, title, content, status, priority,
           admin_response as "adminResponse", created_at as "createdAt", updated_at as "updatedAt"
    FROM feedback
    WHERE user_id = ?
    ORDER BY created_at DESC
  `, [userId]);

  return rows;
}

/**
 * Admin: Get all feedback with filtering and pagination
 */
export async function getAllFeedbacks(options: {
  status?: string;
  priority?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: FeedbackItem[]; total: number; page: number; totalPages: number }> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = ['1=1'];
  const params: (string | number)[] = [];

  if (options.status && options.status !== 'ALL') {
    conditions.push('f.status = ?');
    params.push(options.status);
  }

  if (options.priority && options.priority !== 'ALL') {
    conditions.push('f.priority = ?');
    params.push(options.priority);
  }

  if (options.search && options.search.trim()) {
    conditions.push('(f.title LIKE ? OR f.content LIKE ? OR u.username LIKE ?)');
    const term = `%${options.search.trim()}%`;
    params.push(term, term, term);
  }

  const whereClause = conditions.join(' AND ');

  const countRow = await dbQueryOne<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM feedback f
    JOIN users u ON f.user_id = u.id
    WHERE ${whereClause}
  `, params);

  const total = countRow ? Number(countRow.count) : 0;

  const rows = await dbQuery<FeedbackItem>(`
    SELECT f.id, f.user_id as "userId", u.username, f.type, f.title, f.content,
           f.status, f.priority, f.admin_response as "adminResponse",
           f.created_at as "createdAt", f.updated_at as "updatedAt"
    FROM feedback f
    JOIN users u ON f.user_id = u.id
    WHERE ${whereClause}
    ORDER BY f.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  return {
    items: rows,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Admin: Respond to and update feedback status
 */
export async function updateFeedbackStatus(
  feedbackId: string,
  adminId: string,
  update: {
    status?: 'NEW' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
    adminResponse?: string;
  }
) {
  const existing = await dbQueryOne('SELECT id, status FROM feedback WHERE id = ?', [feedbackId]);
  if (!existing) throw new Error('Không tìm thấy bản ghi phản hồi.');

  const now = Date.now();
  const sets: string[] = ['updated_at = ?'];
  const params: (string | number)[] = [now];

  if (update.status) {
    sets.push('status = ?');
    params.push(update.status);
  }

  if (update.adminResponse !== undefined) {
    sets.push('admin_response = ?');
    params.push(update.adminResponse.trim());
  }

  params.push(feedbackId);
  await dbExecute(`UPDATE feedback SET ${sets.join(', ')} WHERE id = ?`, params);

  // Log admin action
  await dbExecute(`
    INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, metadata_json, created_at)
    VALUES (?, ?, 'FEEDBACK_UPDATED', 'FEEDBACK', ?, ?, ?)
  `, [
    crypto.randomUUID(),
    adminId,
    feedbackId,
    JSON.stringify(update),
    now
  ]);

  return { success: true };
}
