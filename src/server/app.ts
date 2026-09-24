import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { dbQuery, dbQueryOne, dbExecute, seedDefaultLearners, initDatabase } from './db.js';
import { loginUser, logoutUser } from './authService.js';
import {
  requireAuth,
  requireRole,
  optionalAuth,
  type AuthenticatedRequest,
} from './middleware.js';
import {
  getUserStudyProgress,
  saveUserStudyProgress,
  resetUserQuestionProgress,
  resetUserAllStudyProgress,
  migrateLocalProgressToDatabase,
  getUserNotes,
  saveUserNote,
  deleteUserNote,
  getUserExamHistory,
  saveUserExamAttempt,
  getUserBookmarks,
  toggleUserBookmark,
} from './learnerService.js';
import {
  submitQuestion,
  getLearnerSubmissions,
  getPendingReviewQuestions,
  approveQuestion,
  rejectQuestion,
  getAccessibleCustomQuestions,
  importQuestionsFromJson,
  getQuestionSources,
} from './questionService.js';
import {
  createFeedback,
  getLearnerFeedbacks,
  getAllFeedbacks,
  updateFeedbackStatus,
} from './feedbackService.js';
import {
  getAdminOverviewMetrics,
  getAdminUsersList,
  getLearnerDetailAnalytics,
  getAdminAuditLogs,
  getLearningBehaviorAnalytics,
} from './adminService.js';
import {
  recordAIFeedback,
  getAIAnalyticsMetrics,
  recordAIQuery,
  getAIQueriesList,
  syncBatchAIQueries,
} from './aiService.js';
import { executeAIPipeline } from './ai/aiGatewayService.js';
import { processAIFeedback } from './ai/aiLearningService.js';
import {
  getActiveAIConfig,
  publishAIConfig,
  rollbackAIConfig,
  getAIConfigVersionHistory,
} from './ai/aiConfigService.js';
import {
  getSecurityDashboardMetrics,
  getQualityDashboardMetrics,
  getCostDashboardMetrics,
} from './ai/aiTelemetryService.js';
import {
  invalidateSemanticCache,
  getSemanticCacheList,
  deleteSemanticCacheEntry,
} from './ai/aiSemanticCache.js';
import {
  getQuestionMemoryList,
  seedCanonicalVerifiedKnowledge,
} from './ai/aiMemoryService.js';
import {
  handleRealtimeSSE,
  broadcastRealtimeEvent,
} from './realtimeService.js';
import {
  recordHeartbeat,
  getLiveSessions,
  extractClientIp,
  recordScreenFrame,
  getScreenFrame,
} from './trackerService.js';
import { persistLearnerToRegistry } from './learnerRegistry.js';

export const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Lazy database readiness middleware for serverless / cold start
let isDatabaseReadyPromise: Promise<void> | null = null;
app.use(async (_req, _res, next) => {
  if (!isDatabaseReadyPromise) {
    isDatabaseReadyPromise = initDatabase().catch((err) => {
      console.warn('Initial database readiness warning:', err);
    });
  }
  try {
    await isDatabaseReadyPromise;
  } catch {
    // Continue gracefully
  }
  next();
});

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

/* ==========================================================================
   1. AUTHENTICATION ENDPOINTS
   ========================================================================== */

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, adminPasscode, device, deviceInfo } = req.body;
    const result = await loginUser(username, adminPasscode, device || deviceInfo);
    res.json(result);
  } catch (err: any) {
    const isAuthError = err.message && (
      err.message.includes('Mật khẩu') ||
      err.message.includes('quản trị') ||
      err.message.includes('bắt buộc')
    );
    res.status(isAuthError ? 401 : 400).json({ error: err.message || 'Đăng nhập thất bại.' });
  }
});

app.get(['/api/auth/session', '/api/auth/me'], requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  if (req.token) {
    logoutUser(req.token);
  }
  res.json({ success: true });
});

app.get('/api/users/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

/* ==========================================================================
   2. LEARNER DATA ENDPOINTS (Strict Isolation)
   ========================================================================== */

app.get('/api/users/me/progress', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await getUserStudyProgress(req.user!.id);
    res.json({ ...result, progress: result.items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/me/progress', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const item = req.body;
    await saveUserStudyProgress(req.user!.id, item);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/me/progress', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await resetUserAllStudyProgress(req.user!.id);
    res.json({ success: true, message: 'Đã reset toàn bộ tiến độ học tập.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/me/progress/:questionId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const qId = parseInt(req.params.questionId as string, 10);
    if (isNaN(qId)) {
      res.status(400).json({ error: 'questionId không hợp lệ.' });
      return;
    }
    await resetUserQuestionProgress(req.user!.id, qId);
    res.json({ success: true, message: `Đã reset câu hỏi #${qId}.` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/users/me/progress/migrate', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { progressItems, notes, bookmarks, exams } = req.body;
    await migrateLocalProgressToDatabase(req.user!.id, progressItems, notes, bookmarks, exams);
    res.json({ success: true, message: 'Đồng bộ dữ liệu thành công.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/users/me/notes', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await getUserNotes(req.user!.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/me/notes', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { questionId, noteText } = req.body;
    if (typeof questionId !== 'number') {
      res.status(400).json({ error: 'questionId không hợp lệ.' });
      return;
    }
    const result = await saveUserNote(req.user!.id, questionId, noteText);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/me/notes/:questionId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const qId = parseInt(req.params.questionId as string, 10);
    if (isNaN(qId)) {
      res.status(400).json({ error: 'questionId không hợp lệ.' });
      return;
    }
    const result = await deleteUserNote(req.user!.id, qId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/users/me/history', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const history = await getUserExamHistory(req.user!.id);
    res.json({ history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/me/history', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await saveUserExamAttempt(req.user!.id, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/users/me/bookmarks', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const bookmarks = await getUserBookmarks(req.user!.id);
    res.json({ bookmarks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/me/bookmarks/toggle', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { questionId } = req.body;
    if (typeof questionId !== 'number') {
      res.status(400).json({ error: 'questionId không hợp lệ.' });
      return;
    }
    const result = await toggleUserBookmark(req.user!.id, questionId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/* ==========================================================================
   3. QUESTION BANK & SUBMISSIONS ENDPOINTS
   ========================================================================== */

// Get accessible custom questions (public approved + own private/pending)
app.get(['/api/questions', '/api/questions/custom'], optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const customQs = await getAccessibleCustomQuestions(req.user?.id);
    res.json({ customQuestions: customQs, questions: customQs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Learner or Admin submits a new question
app.post('/api/questions/submit', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const q = await submitQuestion(req.user!.id, req.user!.role, req.body);
    res.status(201).json({
      success: true,
      question: q,
      message: q.status === 'APPROVED' ? 'Câu hỏi đã được công bố trực tiếp.' : 'Câu hỏi đã được gửi và đang chờ Admin duyệt.',
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Learner views their own question submissions
app.get('/api/questions/my-submissions', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const list = await getLearnerSubmissions(req.user!.id);
    res.json({ submissions: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   4. FEEDBACK ENDPOINTS
   ========================================================================== */

app.post('/api/feedback', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const fb = await createFeedback(req.user!.id, req.body);
    res.status(201).json({ success: true, feedback: fb });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/feedback/my', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const items = await getLearnerFeedbacks(req.user!.id);
    res.json({ items, feedbacks: items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   5. ADMIN PORTAL ENDPOINTS (Strictly requires role === 'ADMIN')
   ========================================================================== */

// Dashboard overview metrics (supports both /api/admin/overview and /api/admin/dashboard)
app.get('/api/admin/overview', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  const metrics = await getAdminOverviewMetrics();
  res.json(metrics);
});

app.get('/api/admin/dashboard', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  const metrics = await getAdminOverviewMetrics();
  res.json(metrics);
});

// User management list
app.get('/api/admin/users', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { search, role, page, limit } = req.query;
  const result = await getAdminUsersList({
    search: search ? String(search) : undefined,
    role: role ? String(role) : undefined,
    page: page ? parseInt(String(page), 10) : 1,
    limit: limit ? parseInt(String(limit), 10) : 20,
  });
  res.json(result);
});

// Detailed learner analytics deep-dive
app.get('/api/admin/users/:id/analytics', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const analytics = await getLearnerDetailAnalytics(req.params.id as string);
    res.json(analytics);
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'Không tìm thấy học viên.' });
  }
});

// Sync client-side registered learners to backend database (recovers learner profiles across serverless restarts)
app.post('/api/admin/sync-learners', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { learners } = req.body;
    let syncedCount = 0;
    const now = Date.now();

    if (Array.isArray(learners)) {
      for (const l of learners) {
        if (!l || !l.username || l.username.toLowerCase() === 'admin') continue;
        const uId = l.id || `usr_${crypto.randomUUID().slice(0, 8)}`;
        await dbExecute(`
          INSERT INTO users (id, username, role, created_at, last_active_at)
          VALUES (?, ?, 'LEARNER', ?, ?)
          ON CONFLICT(username) DO UPDATE SET
            last_active_at = max(users.last_active_at, excluded.last_active_at)
        `, [uId, l.username, l.createdAt || now, l.lastActiveAt || now]);
        syncedCount++;

        // Get actual user id from DB
        const userRow = await dbQueryOne<{ id: string }>('SELECT id FROM users WHERE username = ? COLLATE NOCASE', [l.username]);
        const targetUserId = userRow?.id || uId;

        if (l.device) {
          const devId = `dev_${crypto.randomUUID().slice(0, 8)}`;
          await dbExecute(`
            INSERT INTO user_devices (id, user_id, device_type, os, browser, session_count, last_active_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            ON CONFLICT(user_id, device_type, os, browser) DO UPDATE SET
              session_count = user_devices.session_count + 1,
              last_active_at = excluded.last_active_at
          `, [
            devId,
            targetUserId,
            l.device.deviceType || 'Desktop',
            l.device.os || 'Windows',
            l.device.browser || 'Chrome',
            l.lastActiveAt || now
          ]);
        }

        // Keep persistent registry synchronized
        persistLearnerToRegistry({
          id: targetUserId,
          username: l.username,
          role: 'LEARNER',
          createdAt: l.createdAt || now,
          lastActiveAt: l.lastActiveAt || now,
          device: l.device,
        });
      }
    }

    res.json({ success: true, syncedCount });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Reseed learners endpoint for admin
app.post('/api/admin/seed-learners', requireAuth, requireRole('ADMIN'), (_req, res) => {
  try {
    seedDefaultLearners();
    res.json({ success: true, message: 'Đã hoàn tất kiểm tra và đồng bộ danh sách học viên.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Question moderation queue
app.get('/api/admin/questions/review', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const list = await getPendingReviewQuestions();
    res.json({ pendingQuestions: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Approve question
app.post('/api/admin/questions/:id/approve', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const qId = parseInt(req.params.id as string, 10);
    const result = await approveQuestion(qId, req.user!.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Reject question
app.post('/api/admin/questions/:id/reject', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const qId = parseInt(req.params.id as string, 10);
    const { reason } = req.body;
    const result = await rejectQuestion(qId, req.user!.id, reason);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Import questions from JSON
app.post('/api/admin/questions/import-json', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { sourceName, jsonPayload } = req.body;
    const result = await importQuestionsFromJson(req.user!.id, sourceName, jsonPayload);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get question sources list
app.get('/api/admin/question-sources', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const sources = await getQuestionSources();
    res.json({ sources });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get all feedbacks for admin inbox
app.get('/api/admin/feedback', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { status, priority, search, page, limit } = req.query;
    const result = await getAllFeedbacks({
      status: status ? String(status) : undefined,
      priority: priority ? String(priority) : undefined,
      search: search ? String(search) : undefined,
      page: page ? parseInt(String(page), 10) : 1,
      limit: limit ? parseInt(String(limit), 10) : 20,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update feedback status & reply
app.patch('/api/admin/feedback/:id', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { status, adminResponse } = req.body;
    const result = await updateFeedbackStatus(req.params.id as string, req.user!.id, { status, adminResponse });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Audit logs
app.get('/api/admin/audit-logs', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const logs = await getAdminAuditLogs();
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Tutor anonymous feedback (No API keys or chat conversation stored)
app.post('/api/ai/feedback', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { questionId, rating, reasonTags, comment, mode, provider } = req.body;
    if (!rating || (rating !== 'up' && rating !== 'down')) {
      res.status(400).json({ error: 'rating phải là "up" hoặc "down".' });
      return;
    }
    const result = await recordAIFeedback({
      userId: req.user?.id,
      questionId: typeof questionId === 'number' ? questionId : undefined,
      rating,
      reasonTags: Array.isArray(reasonTags) ? reasonTags : [],
      comment: typeof comment === 'string' ? comment : undefined,
      mode: typeof mode === 'string' ? mode : undefined,
      provider: typeof provider === 'string' ? provider : undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Realtime Server-Sent Events (SSE) stream for live updates (no polling needed)
app.get('/api/realtime/events', (req, res) => {
  handleRealtimeSSE(req, res);
});

// AI Tutor user question / prompt & output logging (supports learners and guest users)
app.post('/api/ai/query', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id, questionId, prompt, response, mode, provider, username, userId } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Nội dung câu hỏi không được để trống.' });
      return;
    }

    const clientIp = extractClientIp(req);
    const effectiveUserId = req.user?.id || (typeof userId === 'string' ? userId : undefined);
    const effectiveUsername = req.user?.username || (typeof username === 'string' ? username : undefined);

    const result = await recordAIQuery({
      id: typeof id === 'string' ? id : undefined,
      userId: effectiveUserId,
      username: effectiveUsername,
      ipAddress: clientIp,
      questionId: typeof questionId === 'number' ? questionId : null,
      prompt,
      response: typeof response === 'string' ? response : undefined,
      mode: typeof mode === 'string' ? mode : undefined,
      provider: typeof provider === 'string' ? provider : undefined,
    });

    if (result.success && result.record) {
      broadcastRealtimeEvent('ai_query', result.record);
    }

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Batch sync queries from local storage
app.post('/api/ai/queries/sync', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { queries } = req.body;
    if (!Array.isArray(queries)) {
      res.status(400).json({ error: 'queries phải là một danh sách mảng.' });
      return;
    }
    const clientIp = extractClientIp(req);
    const prepared = queries.map((q: any) => ({
      ...q,
      ipAddress: q.ipAddress || clientIp,
      userId: q.userId || req.user?.id,
      username: q.username || req.user?.username,
    }));
    const result = await syncBatchAIQueries(prepared);
    broadcastRealtimeEvent('ai_queries_synced', { count: result.insertedCount });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: Get AI user queries log list
app.get('/api/admin/ai/queries', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { limit, offset, search, mode } = req.query;
    const result = await getAIQueriesList({
      limit: limit ? parseInt(String(limit), 10) : 50,
      offset: offset ? parseInt(String(offset), 10) : 0,
      search: search ? String(search) : undefined,
      mode: mode ? String(mode) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: AI analytics & telemetry metrics
app.get('/api/admin/ai-analytics', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const metrics = await getAIAnalyticsMetrics();
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Aggregated or learner-specific learning behavior analytics
app.get('/api/admin/learning-behavior', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const userId = req.query.userId ? String(req.query.userId).trim() : undefined;
    const analytics = await getLearningBehaviorAnalytics(userId);
    res.json(analytics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   5B. ENTERPRISE AI PIPELINE & CONFIGURATION ENDPOINTS
   ========================================================================== */

// 1. Production AI Chat Pipeline
app.post('/api/ai/chat', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const clientIp = extractClientIp(req);
    const userId = req.user?.id || req.body.userId || 'guest';
    const username = req.user?.username || req.body.username || 'Khách vãng lai';

    const result = await executeAIPipeline({
      query: req.body.query || req.body.prompt,
      userId,
      username,
      tenantId: 'default',
      ipAddress: clientIp,
      mode: req.body.mode,
      currentQuestion: req.body.currentQuestion,
      selectedAnswer: req.body.selectedAnswer,
      isSubmitted: req.body.isSubmitted,
      isCorrect: req.body.isCorrect,
      userNotes: req.body.userNotes,
      history: req.body.history,
      clientApiKey: req.body.clientApiKey,
      clientProvider: req.body.clientProvider,
      clientModel: req.body.clientModel,
      attachedImage: req.body.attachedImage,
    });

    // Broadcast for realtime observer
    broadcastRealtimeEvent('ai_query', {
      id: result.telemetry.requestId,
      userId,
      username,
      ipAddress: clientIp,
      questionId: req.body.currentQuestion?.id ?? null,
      prompt: req.body.query || req.body.prompt,
      response: result.content,
      mode: req.body.mode || 'explain',
      provider: result.telemetry.modelUsed,
      createdAt: Date.now(),
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      error: 'AI service is temporarily unavailable.',
      details: err.message,
    });
  }
});

// 2. Learning & Detailed Feedback
app.post('/api/ai/feedback/detailed', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await processAIFeedback({
      tenantId: 'default',
      userId: req.user?.id || req.body.userId,
      queryId: req.body.queryId,
      questionId: req.body.questionId,
      rating: req.body.rating,
      errorType: req.body.errorType,
      userCorrection: req.body.userCorrection,
      comment: req.body.comment,
      reasonTags: req.body.reasonTags,
      originalQuestion: req.body.originalQuestion || '',
      originalAnswer: req.body.originalAnswer || '',
      sources: req.body.sources,
      mode: req.body.mode,
      provider: req.body.provider,
      isAdmin: req.user?.role === 'ADMIN',
    });

    broadcastRealtimeEvent('ai_feedback_recorded', result);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Admin: AI Configuration Center (GET active config)
app.get('/api/admin/ai/config', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const config = await getActiveAIConfig('default');
    res.json({
      config,
      ...config,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Admin: Publish updated AI configuration
app.post('/api/admin/ai/config', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const newConfig = req.body?.config !== undefined ? req.body.config : (req.body || {});
    const changeSummary = req.body?.changeSummary || 'Cập nhật cấu hình AI';
    const publishedBy = req.user?.username || 'admin';
    const result = await publishAIConfig('default', newConfig, publishedBy, changeSummary);
    broadcastRealtimeEvent('ai_config_published', result);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Admin: Rollback AI Configuration
app.post('/api/admin/ai/config/rollback', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { targetVersion } = req.body;
    if (typeof targetVersion !== 'number') {
      res.status(400).json({ error: 'targetVersion phải là một số nguyên.' });
      return;
    }
    const adminUser = req.user?.username || 'admin';
    const result = await rollbackAIConfig('default', targetVersion, adminUser);
    broadcastRealtimeEvent('ai_config_rollback', result);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Admin: AI Configuration Version History
app.get('/api/admin/ai/config/versions', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const history = await getAIConfigVersionHistory('default');
    res.json({ versions: history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Admin: AI Security Dashboard Metrics
app.get('/api/admin/ai/security-dashboard', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const metrics = await getSecurityDashboardMetrics('default');
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Admin: AI Quality Dashboard Metrics
app.get('/api/admin/ai/quality-dashboard', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const metrics = await getQualityDashboardMetrics('default');
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Admin: AI Cost / Usage Dashboard Metrics
app.get('/api/admin/ai/cost-dashboard', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const metrics = await getCostDashboardMetrics('default');
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Admin: AI Memory - Verified & Candidate Knowledge Management
app.get('/api/admin/ai/memory/knowledge', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { status, search, topic } = req.query;
    let sql = 'SELECT * FROM ai_verified_knowledge WHERE tenant_id = ?';
    const params: any[] = ['default'];

    if (status && status !== 'ALL') {
      sql += ' AND verification_status = ?';
      params.push(String(status));
    }
    if (topic && topic !== 'ALL') {
      sql += ' AND topic = ?';
      params.push(String(topic));
    }
    if (search && String(search).trim()) {
      sql += ' AND (question LIKE ? OR answer LIKE ?)';
      params.push(`%${String(search).trim()}%`, `%${String(search).trim()}%`);
    }

    sql += ' ORDER BY updated_at DESC LIMIT 100';
    const rows = await dbQuery(sql, params);

    const items = rows.map((r: any) => ({
      knowledgeId: r.knowledge_id,
      version: Number(r.version),
      question: r.question,
      answer: r.answer,
      intent: r.intent,
      topic: r.topic,
      confidence: r.confidence,
      verificationStatus: r.verification_status,
      verifiedBy: r.verified_by,
      possiblyOutdated: Boolean(r.possibly_outdated),
      usageCount: Number(r.usage_count),
      correctionCount: Number(r.correction_count),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    }));

    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Admin: Update Knowledge Status (Approve / Reject / Mark Outdated)
app.patch('/api/admin/ai/memory/knowledge/:id/status', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const knowledgeId = req.params.id as string;
    const { status, possiblyOutdated } = req.body;
    const now = Date.now();

    if (status) {
      await dbExecute(
        'UPDATE ai_verified_knowledge SET verification_status = ?, verified_by = ?, updated_at = ? WHERE knowledge_id = ?',
        [status, req.user?.username || 'admin', now, knowledgeId]
      );
    }

    if (typeof possiblyOutdated === 'boolean') {
      await dbExecute(
        'UPDATE ai_verified_knowledge SET possibly_outdated = ?, updated_at = ? WHERE knowledge_id = ?',
        [possiblyOutdated ? 1 : 0, now, knowledgeId]
      );
    }

    res.json({ success: true, knowledgeId });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 12. Admin: AI Memory - Corrections List
app.get('/api/admin/ai/memory/corrections', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM ai_corrections WHERE tenant_id = ?';
    const params: any[] = ['default'];

    if (search && String(search).trim()) {
      sql += ' AND (original_question LIKE ? OR original_answer LIKE ? OR corrected_answer LIKE ?)';
      const term = `%${String(search).trim()}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY created_at DESC LIMIT 100';
    const rows = await dbQuery(sql, params);

    const items = rows.map((r: any) => ({
      id: r.id,
      errorType: r.error_type,
      originalQuestion: r.original_question,
      originalAnswer: r.original_answer,
      correctedAnswer: r.corrected_answer,
      userCorrection: r.user_correction,
      reason: r.reason,
      correctSource: r.correct_source,
      status: r.status,
      createdAt: Number(r.created_at),
    }));

    res.json({ corrections: items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Admin: Clear / Invalidate Semantic Cache
app.post('/api/admin/ai/memory/cache/clear', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { topic } = req.body;
    const count = await invalidateSemanticCache({ tenantId: 'default', topic });
    res.json({ success: true, invalidatedCount: count });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 13B. Admin: Get Question Memory list
app.get('/api/admin/ai/memory/questions', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { search } = req.query;
    const questions = await getQuestionMemoryList('default', search ? String(search) : undefined);
    res.json({ questions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 13C. Admin: Get Semantic Cache entries
app.get('/api/admin/ai/memory/cache', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { search } = req.query;
    const cache = await getSemanticCacheList('default', search ? String(search) : undefined);
    res.json({ cache });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 13D. Admin: Delete single Semantic Cache entry
app.delete('/api/admin/ai/memory/cache/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const success = await deleteSemanticCacheEntry(req.params.id as string, 'default');
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 13E. Admin: Seed Canonical AWS Verified Knowledge
app.post('/api/admin/ai/memory/seed', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const seededCount = await seedCanonicalVerifiedKnowledge('default');
    res.json({ success: true, seededCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 14. Admin: AI Playground / Security Test Lab
app.post('/api/admin/ai/playground/test', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const clientIp = extractClientIp(req);
    const result = await executeAIPipeline({
      query: req.body.query,
      userId: req.user?.id || 'admin',
      username: req.user?.username || 'admin',
      tenantId: 'default',
      ipAddress: clientIp,
      mode: req.body.mode || 'explain',
      currentQuestion: req.body.currentQuestion,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   6. REALTIME TRACKER ENDPOINTS (IP, Device & Screen Actions)
   ========================================================================== */

// Client heartbeat (Public - supports both registered learners and guests)
app.post('/api/tracker/heartbeat', async (req, res) => {
  try {
    const session = await recordHeartbeat(req, req.body);
    res.json({ success: true, session });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Lỗi ghi nhận heartbeat' });
  }
});

// Admin: Realtime active sessions tracker
app.get('/api/admin/live-sessions', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const maxAgeMinutes = req.query.maxAge ? parseInt(String(req.query.maxAge), 10) : 15;
    const result = await getLiveSessions(maxAgeMinutes * 60 * 1000);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Live Screen Telemetry Stream (UltraView Web)
app.post('/api/tracker/screen-stream', (req, res) => {
  try {
    const frame = req.body;
    if (!frame || !frame.sessionId) {
      res.status(400).json({ error: 'Thiếu thông tin frame hoặc sessionId' });
      return;
    }
    const ipAddress = extractClientIp(req);
    const recorded = recordScreenFrame({
      ...frame,
      ipAddress,
    });
    broadcastRealtimeEvent('learner_screen_mirror', recorded);
    res.json({ success: true, frame: recorded });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Lỗi stream màn hình' });
  }
});

// Admin: Get latest screen frame snapshot for a session/learner
app.get('/api/tracker/screen-stream/:sessionId', requireAuth, requireRole('ADMIN'), (req, res) => {
  try {
    const frame = getScreenFrame(req.params.sessionId as string);
    res.json({ success: true, frame });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   7. DIAGRAM WORKBOOK ENDPOINTS (Cloud Persistence & Realtime Sync)
   ========================================================================== */

// Load active diagram workbook
app.get('/api/diagrams/workbook', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || null;
    let row: {
      id: string;
      user_id: string | null;
      name: string;
      active_sheet_id: string;
      sheets_json: string;
      created_at: number;
      updated_at: number;
    } | null = null;

    if (userId) {
      row = await dbQueryOne(`
        SELECT id, user_id, name, active_sheet_id, sheets_json, created_at, updated_at
        FROM diagram_workbooks
        WHERE user_id = ?
        ORDER BY updated_at DESC
        LIMIT 1
      `, [userId]);
    }

    if (!row) {
      res.json({ workbook: null });
      return;
    }

    let sheets = [];
    try {
      sheets = JSON.parse(row.sheets_json);
    } catch {
      sheets = [];
    }

    res.json({
      workbook: {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        activeSheetId: row.active_sheet_id,
        sheets,
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save or sync diagram workbook
app.post('/api/diagrams/workbook', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { workbook } = req.body;
    if (!workbook || !workbook.id || !Array.isArray(workbook.sheets)) {
      res.status(400).json({ error: 'Dữ liệu diagram workbook không hợp lệ.' });
      return;
    }

    const userId = req.user?.id || null;
    const now = Date.now();
    const sheetsJson = JSON.stringify(workbook.sheets);

    await dbExecute(`
      INSERT INTO diagram_workbooks (id, user_id, name, active_sheet_id, sheets_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        user_id = COALESCE(excluded.user_id, diagram_workbooks.user_id),
        name = excluded.name,
        active_sheet_id = excluded.active_sheet_id,
        sheets_json = excluded.sheets_json,
        updated_at = excluded.updated_at
    `, [
      workbook.id,
      userId,
      workbook.name || 'AWS Architecture Workspace',
      workbook.activeSheetId || (workbook.sheets[0]?.id || 'sheet_1'),
      sheetsJson,
      workbook.createdAt || now,
      now,
    ]);

    broadcastRealtimeEvent('diagram_saved', {
      id: workbook.id,
      userId,
      updatedAt: now,
    });

    res.json({ success: true, id: workbook.id, updatedAt: now });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Global 404 for unknown /api routes
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint API không tồn tại.' });
});
