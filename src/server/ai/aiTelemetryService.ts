/**
 * AI Telemetry & Observability Service
 *
 * Tracks:
 * 1. Security events (injections, jailbreaks, PII, secret leaks, XSS).
 * 2. Quality metrics (latency, cache hits, rerank usage, confidence distribution).
 * 3. Cost metrics (token consumption, API calls, cost estimation).
 * 4. Pipeline execution traces for AI Response Debugger.
 */

import crypto from 'node:crypto';
import { dbQuery, dbQueryOne, dbExecute } from '../db.js';

export interface TelemetryLogPayload {
  requestId?: string;
  tenantId?: string;
  userId?: string | null;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  retrievalLatencyMs?: number;
  rerankLatencyMs?: number;
  generationLatencyMs?: number;
  totalLatencyMs?: number;
  cacheHit?: boolean;
  memoryHit?: boolean;
  rerankUsed?: boolean;
  securityBlocked?: boolean;
  costEstimateUsd?: number;
}

export interface SecurityDashboardMetrics {
  totalSecurityEvents: number;
  promptInjectionsBlocked: number;
  jailbreakAttempts: number;
  secretLeaksPrevented: number;
  piiDetections: number;
  xssAttemptsBlocked: number;
  outOfScopeRequests: number;
  rateLimitViolations: number;
  recentSecurityEvents: Array<{
    id: string;
    eventType: string;
    severity: string;
    attackType: string;
    payloadSnippet: string;
    blocked: boolean;
    actionTaken: string;
    createdAt: number;
  }>;
}

export interface QualityDashboardMetrics {
  totalQuestions: number;
  cacheHitRate: number; // percent 0-100
  memoryHitRate: number; // percent 0-100
  rerankUsageRate: number; // percent 0-100
  avgTotalLatencyMs: number;
  avgRetrievalLatencyMs: number;
  avgRerankLatencyMs: number;
  avgGenerationLatencyMs: number;
  satisfactionRate: number;
  totalVerifiedKnowledge: number;
  totalCorrections: number;
}

export interface CostDashboardMetrics {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  estimatedSavingsUsd: number; // savings from cache hits
  rerankRequestsCount: number;
}

/**
 * Record usage telemetry to database
 */
export async function logUsageTelemetry(payload: TelemetryLogPayload): Promise<string> {
  const requestId = payload.requestId || `req_${crypto.randomUUID().slice(0, 12)}`;
  const now = Date.now();

  try {
    await dbExecute(`
      INSERT INTO ai_usage_telemetry (
        request_id, tenant_id, user_id, model, input_tokens, output_tokens,
        retrieval_latency_ms, rerank_latency_ms, generation_latency_ms, total_latency_ms,
        cache_hit, memory_hit, rerank_used, security_blocked, cost_estimate_usd, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      requestId,
      payload.tenantId || 'default',
      payload.userId || null,
      payload.model,
      payload.inputTokens || 0,
      payload.outputTokens || 0,
      payload.retrievalLatencyMs || 0,
      payload.rerankLatencyMs || 0,
      payload.generationLatencyMs || 0,
      payload.totalLatencyMs || 0,
      payload.cacheHit ? 1 : 0,
      payload.memoryHit ? 1 : 0,
      payload.rerankUsed ? 1 : 0,
      payload.securityBlocked ? 1 : 0,
      payload.costEstimateUsd || 0,
      now,
    ]);
  } catch (err) {
    console.warn('Could not log AI usage telemetry:', err);
  }

  return requestId;
}

/**
 * Get Security Dashboard Metrics
 */
export async function getSecurityDashboardMetrics(tenantId = 'default'): Promise<SecurityDashboardMetrics> {
  const countRows = await dbQuery<{ event_type: string; count: number }>(`
    SELECT event_type, COUNT(*) as count
    FROM ai_security_events
    WHERE tenant_id = ?
    GROUP BY event_type
  `, [tenantId]);

  let totalSecurityEvents = 0;
  let promptInjectionsBlocked = 0;
  let jailbreakAttempts = 0;
  let secretLeaksPrevented = 0;
  let piiDetections = 0;
  let xssAttemptsBlocked = 0;
  let outOfScopeRequests = 0;
  let rateLimitViolations = 0;

  for (const r of countRows) {
    const c = Number(r.count);
    totalSecurityEvents += c;
    if (r.event_type.includes('INJECTION')) promptInjectionsBlocked += c;
    if (r.event_type.includes('JAILBREAK')) jailbreakAttempts += c;
    if (r.event_type.includes('SECRET')) secretLeaksPrevented += c;
    if (r.event_type.includes('PII')) piiDetections += c;
    if (r.event_type.includes('XSS')) xssAttemptsBlocked += c;
    if (r.event_type.includes('OUT_OF_SCOPE')) outOfScopeRequests += c;
    if (r.event_type.includes('RATE_LIMIT')) rateLimitViolations += c;
  }

  const recentRows = await dbQuery<{
    id: string;
    event_type: string;
    severity: string;
    attack_type: string;
    payload_snippet: string;
    blocked: number;
    action_taken: string;
    created_at: number;
  }>(`
    SELECT id, event_type, severity, attack_type, payload_snippet, blocked, action_taken, created_at
    FROM ai_security_events
    WHERE tenant_id = ?
    ORDER BY created_at DESC
    LIMIT 25
  `, [tenantId]);

  return {
    totalSecurityEvents,
    promptInjectionsBlocked,
    jailbreakAttempts,
    secretLeaksPrevented,
    piiDetections,
    xssAttemptsBlocked,
    outOfScopeRequests,
    rateLimitViolations,
    recentSecurityEvents: recentRows.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      severity: r.severity,
      attackType: r.attack_type,
      payloadSnippet: r.payload_snippet,
      blocked: Boolean(r.blocked),
      actionTaken: r.action_taken,
      createdAt: Number(r.created_at),
    })),
  };
}

/**
 * Get Quality Dashboard Metrics
 */
export async function getQualityDashboardMetrics(tenantId = 'default'): Promise<QualityDashboardMetrics> {
  const telemetryRow = await dbQueryOne<{
    total: number;
    cache_hits: number;
    memory_hits: number;
    rerank_count: number;
    avg_total_lat: number;
    avg_ret_lat: number;
    avg_rerank_lat: number;
    avg_gen_lat: number;
  }>(`
    SELECT
      COUNT(*) as total,
      SUM(cache_hit) as cache_hits,
      SUM(memory_hit) as memory_hits,
      SUM(rerank_used) as rerank_count,
      AVG(total_latency_ms) as avg_total_lat,
      AVG(retrieval_latency_ms) as avg_ret_lat,
      AVG(rerank_latency_ms) as avg_rerank_lat,
      AVG(generation_latency_ms) as avg_gen_lat
    FROM ai_usage_telemetry
    WHERE tenant_id = ?
  `, [tenantId]);

  const total = Number(telemetryRow?.total || 0);
  const cacheHits = Number(telemetryRow?.cache_hits || 0);
  const memoryHits = Number(telemetryRow?.memory_hits || 0);
  const rerankCount = Number(telemetryRow?.rerank_count || 0);

  // Verified knowledge and corrections counts
  const vkRow = await dbQueryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM ai_verified_knowledge WHERE tenant_id = ? AND verification_status = \'VERIFIED\'',
    [tenantId]
  );
  const corrRow = await dbQueryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM ai_corrections WHERE tenant_id = ?',
    [tenantId]
  );

  // Feedback satisfaction
  const fbRow = await dbQueryOne<{ total: number; up: number }>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN rating = 'up' THEN 1 ELSE 0 END) as up
    FROM ai_feedback
  `);
  const fbTotal = Number(fbRow?.total || 0);
  const fbUp = Number(fbRow?.up || 0);
  const satisfactionRate = fbTotal > 0 ? Math.round((fbUp / fbTotal) * 100) : 100;

  return {
    totalQuestions: total,
    cacheHitRate: total > 0 ? Math.round((cacheHits / total) * 100) : 0,
    memoryHitRate: total > 0 ? Math.round((memoryHits / total) * 100) : 0,
    rerankUsageRate: total > 0 ? Math.round((rerankCount / total) * 100) : 0,
    avgTotalLatencyMs: Math.round(Number(telemetryRow?.avg_total_lat || 0)),
    avgRetrievalLatencyMs: Math.round(Number(telemetryRow?.avg_ret_lat || 0)),
    avgRerankLatencyMs: Math.round(Number(telemetryRow?.avg_rerank_lat || 0)),
    avgGenerationLatencyMs: Math.round(Number(telemetryRow?.avg_gen_lat || 0)),
    satisfactionRate,
    totalVerifiedKnowledge: Number(vkRow?.count || 0),
    totalCorrections: Number(corrRow?.count || 0),
  };
}

/**
 * Get Cost / Usage Dashboard Metrics
 */
export async function getCostDashboardMetrics(tenantId = 'default'): Promise<CostDashboardMetrics> {
  const row = await dbQueryOne<{
    total: number;
    in_tokens: number;
    out_tokens: number;
    cache_hits: number;
    rerank_calls: number;
    cost: number;
  }>(`
    SELECT
      COUNT(*) as total,
      SUM(input_tokens) as in_tokens,
      SUM(output_tokens) as out_tokens,
      SUM(cache_hit) as cache_hits,
      SUM(rerank_used) as rerank_calls,
      SUM(cost_estimate_usd) as cost
    FROM ai_usage_telemetry
    WHERE tenant_id = ?
  `, [tenantId]);

  const totalRequests = Number(row?.total || 0);
  const totalInputTokens = Number(row?.in_tokens || 0);
  const totalOutputTokens = Number(row?.out_tokens || 0);
  const totalTokens = totalInputTokens + totalOutputTokens;
  const estimatedCostUsd = Number(row?.cost || 0);
  const cacheHits = Number(row?.cache_hits || 0);

  // Estimate savings: each cache hit saves ~1500 tokens = ~$0.0015
  const estimatedSavingsUsd = cacheHits * 0.0015;

  return {
    totalRequests,
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    estimatedCostUsd: Math.round(estimatedCostUsd * 10000) / 10000,
    estimatedSavingsUsd: Math.round(estimatedSavingsUsd * 10000) / 10000,
    rerankRequestsCount: Number(row?.rerank_calls || 0),
  };
}
