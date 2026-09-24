import crypto from 'node:crypto';
import { dbQuery, dbQueryOne, dbExecute } from './db.js';

export interface AIFeedbackPayload {
  userId?: string;
  questionId?: number;
  rating: 'up' | 'down';
  reasonTags?: string[];
  comment?: string;
  mode?: string;
  provider?: string;
}

export interface AIQueryPayload {
  id?: string;
  userId?: string | null;
  username?: string;
  ipAddress?: string;
  questionId?: number | null;
  prompt: string;
  response?: string | null;
  mode?: string;
  provider?: string;
  createdAt?: number;
}

export interface AIQueryRecord {
  id: string;
  userId: string | null;
  username: string;
  ipAddress: string | null;
  questionId: number | null;
  prompt: string;
  response?: string | null;
  mode: string | null;
  provider: string | null;
  createdAt: number;
}

export interface AIAnalyticsMetrics {
  totalFeedback: number;
  upCount: number;
  downCount: number;
  satisfactionRate: number; // 0 - 100
  topReasons: Array<{ tag: string; count: number }>;
  topQuestions: Array<{ questionId: number; count: number }>;
  modeBreakdown: Record<string, number>;
  providerBreakdown: Record<string, number>;
  knowledgeCoverage: {
    canonicalQuestions: number;
    indexedServices: number;
    ragEngineStatus: 'READY' | 'OFFLINE';
  };
  recentFeedback: Array<{
    id: string;
    questionId: number | null;
    rating: 'up' | 'down';
    reasonTags: string[];
    comment: string | null;
    mode: string | null;
    provider: string | null;
    createdAt: number;
  }>;
  queriesAnalytics?: {
    totalQueries: number;
    topKeywords: Array<{ keyword: string; count: number }>;
    topQuestionsQueried: Array<{ questionId: number; count: number }>;
    modeBreakdown: Record<string, number>;
    recentQueries: AIQueryRecord[];
  };
}

/**
 * Record anonymous AI Tutor feedback
 * Strictly no prompt content, response text, or API keys are stored.
 */
export async function recordAIFeedback(payload: AIFeedbackPayload) {
  const id = `aifb_${crypto.randomUUID().slice(0, 10)}`;
  const now = Date.now();
  const reasonsJson = payload.reasonTags && payload.reasonTags.length > 0 
    ? JSON.stringify(payload.reasonTags) 
    : '[]';

  await dbExecute(`
    INSERT INTO ai_feedback (
      id, user_id, question_id, rating, reason_tags_json, comment, mode, provider, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    payload.userId || null,
    payload.questionId || null,
    payload.rating,
    reasonsJson,
    payload.comment ? payload.comment.trim().slice(0, 500) : null,
    payload.mode || 'explain',
    payload.provider || 'local_rag',
    now
  ]);

  return { id, success: true };
}

/**
 * Get aggregated anonymous AI Tutor analytics for Admin Dashboard
 */
export async function getAIAnalyticsMetrics(): Promise<AIAnalyticsMetrics> {
  // 1. Total & satisfaction rating
  const totalRow = await dbQueryOne<{ total: number; up_count: number | null; down_count: number | null }>(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN rating = 'up' THEN 1 ELSE 0 END) as up_count,
      SUM(CASE WHEN rating = 'down' THEN 1 ELSE 0 END) as down_count
    FROM ai_feedback
  `);

  const totalFeedback = totalRow?.total ? Number(totalRow.total) : 0;
  const upCount = totalRow?.up_count ? Number(totalRow.up_count) : 0;
  const downCount = totalRow?.down_count ? Number(totalRow.down_count) : 0;
  const satisfactionRate = totalFeedback > 0 ? Math.round((upCount / totalFeedback) * 100) : 100;

  // 2. Reason tags aggregation
  const feedbackRows = await dbQuery<{ reason_tags_json: string; mode: string | null; provider: string | null }>(`
    SELECT reason_tags_json, mode, provider
    FROM ai_feedback
  `);

  const reasonCounts: Record<string, number> = {};
  const modeBreakdown: Record<string, number> = {};
  const providerBreakdown: Record<string, number> = {};

  for (const row of feedbackRows) {
    // Modes
    const m = row.mode || 'explain';
    modeBreakdown[m] = (modeBreakdown[m] || 0) + 1;

    // Providers
    const p = row.provider || 'local_rag';
    providerBreakdown[p] = (providerBreakdown[p] || 0) + 1;

    // Reasons
    if (row.reason_tags_json) {
      try {
        const tags: string[] = JSON.parse(row.reason_tags_json);
        for (const tag of tags) {
          if (tag) {
            reasonCounts[tag] = (reasonCounts[tag] || 0) + 1;
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
  }

  const topReasons = Object.entries(reasonCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // 3. Top questions queried / given feedback
  const topQuestionRows = await dbQuery<{ question_id: number; count: number }>(`
    SELECT question_id, COUNT(*) as count
    FROM ai_feedback
    WHERE question_id IS NOT NULL
    GROUP BY question_id
    ORDER BY count DESC
    LIMIT 6
  `);

  const topQuestions = topQuestionRows.map(r => ({
    questionId: Number(r.question_id),
    count: Number(r.count),
  }));

  // 4. Recent feedback list
  const recentRows = await dbQuery<{
    id: string;
    question_id: number | null;
    rating: 'up' | 'down';
    reason_tags_json: string;
    comment: string | null;
    mode: string | null;
    provider: string | null;
    created_at: number;
  }>(`
    SELECT id, question_id, rating, reason_tags_json, comment, mode, provider, created_at
    FROM ai_feedback
    ORDER BY created_at DESC
    LIMIT 15
  `);

  const recentFeedback = recentRows.map(r => {
    let reasonTags: string[] = [];
    try {
      reasonTags = JSON.parse(r.reason_tags_json || '[]');
    } catch {
      reasonTags = [];
    }
    return {
      id: r.id,
      questionId: r.question_id,
      rating: r.rating,
      reasonTags,
      comment: r.comment,
      mode: r.mode,
      provider: r.provider,
      createdAt: Number(r.created_at),
    };
  });

  const queriesAnalytics = await getAIQueriesAnalytics();

  return {
    totalFeedback,
    upCount,
    downCount,
    satisfactionRate,
    topReasons,
    topQuestions,
    modeBreakdown,
    providerBreakdown,
    knowledgeCoverage: {
      canonicalQuestions: 1019,
      indexedServices: 42,
      ragEngineStatus: 'READY',
    },
    recentFeedback,
    queriesAnalytics,
  };
}

/**
 * Record user question/prompt to AI Tutor for learning pattern analysis
 */
export async function recordAIQuery(payload: AIQueryPayload): Promise<{ id: string; success: boolean; record?: AIQueryRecord }> {
  const id = payload.id || `aiq_${crypto.randomUUID().slice(0, 10)}`;
  const now = payload.createdAt || Date.now();
  const prompt = (payload.prompt || '').trim().slice(0, 4000);
  if (!prompt) {
    return { id, success: false };
  }

  const username = payload.username 
    ? payload.username.trim().slice(0, 80)
    : (payload.userId ? 'Learner' : 'Khách vãng lai');

  const responseText = payload.response ? payload.response.trim().slice(0, 12000) : null;

  await dbExecute(`
    INSERT INTO ai_queries (
      id, user_id, username, ip_address, question_id, prompt, response, mode, provider, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      username = excluded.username,
      ip_address = excluded.ip_address,
      question_id = excluded.question_id,
      prompt = excluded.prompt,
      response = excluded.response,
      mode = excluded.mode,
      provider = excluded.provider,
      created_at = excluded.created_at
  `, [
    id,
    payload.userId || null,
    username,
    payload.ipAddress || null,
    payload.questionId ?? null,
    prompt,
    responseText,
    payload.mode || 'explain',
    payload.provider || 'local_rag',
    now
  ]);

  const record: AIQueryRecord = {
    id,
    userId: payload.userId || null,
    username,
    ipAddress: payload.ipAddress || null,
    questionId: payload.questionId ?? null,
    prompt,
    response: responseText,
    mode: payload.mode || 'explain',
    provider: payload.provider || 'local_rag',
    createdAt: now,
  };

  return { id, success: true, record };
}

/**
 * Batch synchronize user queries / conversations from client localStorage to database
 */
export async function syncBatchAIQueries(queries: AIQueryPayload[]): Promise<{ insertedCount: number; syncedCount: number }> {
  let count = 0;
  for (const q of queries) {
    if (q.prompt) {
      const res = await recordAIQuery(q);
      if (res.success) count++;
    }
  }
  return { insertedCount: count, syncedCount: count };
}

export interface GetAIQueriesOptions {
  limit?: number;
  offset?: number;
  search?: string;
  mode?: string;
}

export async function getAIQueriesList(options: GetAIQueriesOptions = {}): Promise<{
  queries: AIQueryRecord[];
  total: number;
}> {
  const limit = Math.min(Math.max(options.limit || 50, 1), 100);
  const offset = Math.max(options.offset || 0, 0);

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];

  if (options.search && options.search.trim()) {
    whereClause += ' AND (prompt LIKE ? OR username LIKE ? OR ip_address LIKE ? OR COALESCE(response, \'\') LIKE ?)';
    const term = `%${options.search.trim()}%`;
    params.push(term, term, term, term);
  }

  if (options.mode && options.mode !== 'all') {
    whereClause += ' AND mode = ?';
    params.push(options.mode);
  }

  const countRow = await dbQueryOne<{ count: number }>(`SELECT COUNT(*) as count FROM ai_queries ${whereClause}`, params);
  const total = countRow?.count ? Number(countRow.count) : 0;

  const rows = await dbQuery<{
    id: string;
    user_id: string | null;
    username: string;
    ip_address: string | null;
    question_id: number | null;
    prompt: string;
    response: string | null;
    mode: string | null;
    provider: string | null;
    created_at: number;
  }>(`
    SELECT id, user_id, username, ip_address, question_id, prompt, response, mode, provider, created_at
    FROM ai_queries
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  const queries: AIQueryRecord[] = rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    username: r.username,
    ipAddress: r.ip_address,
    questionId: r.question_id !== null ? Number(r.question_id) : null,
    prompt: r.prompt,
    response: r.response,
    mode: r.mode,
    provider: r.provider,
    createdAt: Number(r.created_at),
  }));

  return { queries, total };
}

const TOP_AWS_KEYWORDS = [
  'VPC', 'S3', 'IAM', 'EC2', 'Lambda', 'DynamoDB', 'RDS', 'Aurora',
  'CloudFront', 'Route 53', 'SQS', 'SNS', 'KMS', 'ECS', 'EKS', 'Fargate',
  'CloudWatch', 'CloudTrail', 'Secrets Manager', 'Parameter Store',
  'Direct Connect', 'Transit Gateway', 'Auto Scaling', 'ALB', 'NLB',
  'EFS', 'EBS', 'ElastiCache', 'Redshift', 'Athena', 'Glue', 'Kinesis',
  'Step Functions', 'EventBridge', 'WAF', 'Shield', 'Cognito'
];

export async function getAIQueriesAnalytics() {
  const countRow = await dbQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM ai_queries');
  const totalQueries = countRow?.count ? Number(countRow.count) : 0;

  const recentRows = await dbQuery<{
    id: string;
    user_id: string | null;
    username: string;
    ip_address: string | null;
    question_id: number | null;
    prompt: string;
    response: string | null;
    mode: string | null;
    provider: string | null;
    created_at: number;
  }>(`
    SELECT id, user_id, username, ip_address, question_id, prompt, response, mode, provider, created_at
    FROM ai_queries
    ORDER BY created_at DESC
    LIMIT 25
  `);

  const recentQueries: AIQueryRecord[] = recentRows.map(r => ({
    id: r.id,
    userId: r.user_id,
    username: r.username,
    ipAddress: r.ip_address,
    questionId: r.question_id !== null ? Number(r.question_id) : null,
    prompt: r.prompt,
    response: r.response,
    mode: r.mode,
    provider: r.provider,
    createdAt: Number(r.created_at),
  }));

  // Group by question_id
  const topQuestionRows = await dbQuery<{ question_id: number; count: number }>(`
    SELECT question_id, COUNT(*) as count
    FROM ai_queries
    WHERE question_id IS NOT NULL
    GROUP BY question_id
    ORDER BY count DESC
    LIMIT 8
  `);

  const topQuestionsQueried = topQuestionRows.map(r => ({
    questionId: Number(r.question_id),
    count: Number(r.count),
  }));

  // Mode breakdown
  const modeRows = await dbQuery<{ mode: string; count: number }>(`
    SELECT COALESCE(mode, 'chat') as mode, COUNT(*) as count
    FROM ai_queries
    GROUP BY mode
  `);

  const modeBreakdown: Record<string, number> = {};
  for (const m of modeRows) {
    modeBreakdown[m.mode] = Number(m.count);
  }

  // Top keywords from prompts
  const samplePrompts = await dbQuery<{ prompt: string }>(`
    SELECT prompt FROM ai_queries ORDER BY created_at DESC LIMIT 500
  `);

  const keywordCounts: Record<string, number> = {};
  for (const kw of TOP_AWS_KEYWORDS) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    for (const p of samplePrompts) {
      if (regex.test(p.prompt)) {
        keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
      }
    }
  }

  const topKeywords = Object.entries(keywordCounts)
    .filter(([, count]) => count > 0)
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalQueries,
    topKeywords,
    topQuestionsQueried,
    modeBreakdown,
    recentQueries,
  };
}

