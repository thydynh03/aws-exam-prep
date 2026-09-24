/**
 * Semantic Cache Service (Fast Path)
 *
 * Checks exact hash & high semantic similarity against previously verified answers.
 * If match >= threshold and not expired -> returns cached verified answer immediately.
 */

import crypto from 'node:crypto';
import { dbQuery, dbQueryOne, dbExecute } from '../db.js';

export interface CacheEntry {
  id: string;
  queryHash: string;
  queryText: string;
  normalizedQuery: string;
  responseContent: string;
  citations: any[];
  confidence: string;
  modelUsed: string;
  intent: string;
  topic: string;
  expiresAt: number;
  hitCount: number;
  createdAt: number;
}

export interface CacheCheckResult {
  isHit: boolean;
  hitType?: 'EXACT' | 'SEMANTIC';
  entry?: CacheEntry;
  similarityScore?: number;
}

const DEFAULT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SEMANTIC_SIMILARITY_THRESHOLD = 0.85;

function hashQuery(text: string): string {
  return crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
}

function tokenize(text: string): Set<string> {
  const words = (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
  return new Set(words);
}

function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

const AWS_CORE_SERVICES = [
  'alb', 'nlb', 'glb', 'elb', 'ec2', 's3', 'ebs', 'efs', 'vpc',
  'rds', 'aurora', 'dynamodb', 'sqs', 'sns', 'lambda', 'fargate',
  'ecs', 'eks', 'route53', 'cloudfront', 'waf', 'shield', 'iam',
  'kms', 'secrets manager', 'cloudwatch', 'cloudtrail', 'redshift',
  'kinesis', 'glue', 'emr', 'athena', 'eventbridge', 'step functions',
  'transit gateway', 'direct connect', 'global accelerator', 'elasticache',
  'textract', 'comprehend', 'comprehend medical', 'rekognition', 'transcribe',
  'polly', 'sagemaker', 'kendra', 'bedrock', 'opensearch', 'neptune',
  'documentdb', 'timestream', 'appsync', 'api gateway', 'ses', 'cognito',
  'app runner', 'batch', 'quicksight', 'lake formation', 'macie',
  'guardduty', 'security hub', 'inspector'
];

/**
 * Validates that cached content is genuinely relevant to the query subject
 * and is NOT an unhelpful refusal or corrupted fallback.
 */
export function isCacheContentRelevant(normalizedQuery: string, responseContent: string): boolean {
  const q = (normalizedQuery || '').toLowerCase();
  const c = (responseContent || '').toLowerCase();

  // 1. Refusal & canned fallback phrases MUST NEVER be considered valid cache content!
  const refusalPhrases = [
    'chưa tìm thấy tài liệu chi tiết',
    'chưa tìm thấy tài liệu',
    'tôi chưa tìm thấy',
    'không tìm thấy tài liệu',
    'chưa có thông tin chi tiết',
    'không thể tìm thấy',
    'rất tiếc',
    'không tìm thấy',
  ];
  if (refusalPhrases.some(phrase => c.includes(phrase))) {
    return false;
  }

  // 2. Reject excessively short responses (< 80 characters) as invalid cache content
  if (responseContent.trim().length < 80) {
    return false;
  }

  // 3. Find any core AWS service tokens mentioned in query
  const queryEntities = AWS_CORE_SERVICES.filter(svc => {
    if (svc.length <= 3) {
      const regex = new RegExp(`\\b${svc}\\b`, 'i');
      return regex.test(q);
    }
    return q.includes(svc);
  });

  if (queryEntities.length > 0) {
    // If the query specifically asked about some AWS entities (e.g. textract, comprehend),
    // the cached response content MUST mention at least one of those entities!
    const matchesAnyEntity = queryEntities.some(svc => {
      if (svc.length <= 3) {
        const regex = new RegExp(`\\b${svc}\\b`, 'i');
        return regex.test(c);
      }
      return c.includes(svc);
    });

    if (!matchesAnyEntity) {
      return false; // Poisoned/mismatched cache entry!
    }
  }

  return true;
}

/**
 * Check Semantic Cache for reusable verified response
 */
export async function checkSemanticCache(
  normalizedQuery: string,
  tenantId = 'default',
  threshold = SEMANTIC_SIMILARITY_THRESHOLD
): Promise<CacheCheckResult> {
  const now = Date.now();
  const queryHash = hashQuery(normalizedQuery);

  // 1. Exact hash lookup (Fastest)
  const exact = await dbQueryOne<{
    id: string;
    query_hash: string;
    query_text: string;
    normalized_query: string;
    response_content: string;
    citations_json: string | null;
    confidence: string;
    model_used: string;
    intent: string;
    topic: string;
    expires_at: number;
    hit_count: number;
    created_at: number;
  }>(`
    SELECT *
    FROM ai_semantic_cache
    WHERE tenant_id = ? AND query_hash = ? AND expires_at > ?
    LIMIT 1
  `, [tenantId, queryHash, now]);

  if (exact) {
    // Sanity check: Ensure cached response content is actually relevant to the query
    if (!isCacheContentRelevant(normalizedQuery, exact.response_content)) {
      // Poisoned / invalid cache entry: purge immediately
      void dbExecute('DELETE FROM ai_semantic_cache WHERE id = ?', [exact.id]);
      return { isHit: false };
    }

    // Increment hit count
    void dbExecute(
      'UPDATE ai_semantic_cache SET hit_count = hit_count + 1, last_accessed_at = ? WHERE id = ?',
      [now, exact.id]
    );

    let citations = [];
    try {
      citations = JSON.parse(exact.citations_json || '[]');
    } catch {
      citations = [];
    }

    return {
      isHit: true,
      hitType: 'EXACT',
      similarityScore: 1.0,
      entry: {
        id: exact.id,
        queryHash: exact.query_hash,
        queryText: exact.query_text,
        normalizedQuery: exact.normalized_query,
        responseContent: exact.response_content,
        citations,
        confidence: exact.confidence,
        modelUsed: exact.model_used,
        intent: exact.intent,
        topic: exact.topic,
        expiresAt: Number(exact.expires_at),
        hitCount: Number(exact.hit_count) + 1,
        createdAt: Number(exact.created_at),
      },
    };
  }

  // 2. Semantic token similarity search among non-expired active entries
  const activeEntries = await dbQuery<{
    id: string;
    query_hash: string;
    query_text: string;
    normalized_query: string;
    response_content: string;
    citations_json: string | null;
    confidence: string;
    model_used: string;
    intent: string;
    topic: string;
    expires_at: number;
    hit_count: number;
    created_at: number;
  }>(`
    SELECT *
    FROM ai_semantic_cache
    WHERE tenant_id = ? AND expires_at > ?
    ORDER BY hit_count DESC, last_accessed_at DESC
    LIMIT 60
  `, [tenantId, now]);

  const queryTokens = tokenize(normalizedQuery);
  let bestEntry: any = null;
  let highestSim = 0;

  for (const entry of activeEntries) {
    const entryTokens = tokenize(entry.normalized_query);
    const sim = calculateJaccardSimilarity(queryTokens, entryTokens);

    if (sim > highestSim && sim >= threshold) {
      highestSim = sim;
      bestEntry = entry;
    }
  }

  if (bestEntry) {
    // Sanity check: Ensure cached response content is actually relevant to the query
    if (!isCacheContentRelevant(normalizedQuery, bestEntry.response_content)) {
      void dbExecute('DELETE FROM ai_semantic_cache WHERE id = ?', [bestEntry.id]);
      return { isHit: false };
    }

    void dbExecute(
      'UPDATE ai_semantic_cache SET hit_count = hit_count + 1, last_accessed_at = ? WHERE id = ?',
      [now, bestEntry.id]
    );

    let citations = [];
    try {
      citations = JSON.parse(bestEntry.citations_json || '[]');
    } catch {
      citations = [];
    }

    return {
      isHit: true,
      hitType: 'SEMANTIC',
      similarityScore: highestSim,
      entry: {
        id: bestEntry.id,
        queryHash: bestEntry.query_hash,
        queryText: bestEntry.query_text,
        normalizedQuery: bestEntry.normalized_query,
        responseContent: bestEntry.response_content,
        citations,
        confidence: bestEntry.confidence,
        modelUsed: bestEntry.model_used,
        intent: bestEntry.intent,
        topic: bestEntry.topic,
        expiresAt: Number(bestEntry.expires_at),
        hitCount: Number(bestEntry.hit_count) + 1,
        createdAt: Number(bestEntry.created_at),
      },
    };
  }

  return { isHit: false };
}

/**
 * Store response in Semantic Cache
 */
export async function storeInSemanticCache(payload: {
  tenantId?: string;
  queryText: string;
  normalizedQuery: string;
  responseContent: string;
  citations?: any[];
  confidence?: string;
  modelUsed: string;
  intent?: string;
  topic?: string;
  ttlMs?: number;
}): Promise<string> {
  // Never cache refusals, empty/short strings, or mismatched content
  if (!isCacheContentRelevant(payload.normalizedQuery, payload.responseContent)) {
    return '';
  }

  const tenantId = payload.tenantId || 'default';
  const id = `cache_${crypto.randomUUID().slice(0, 10)}`;
  const now = Date.now();
  const expiresAt = now + (payload.ttlMs || DEFAULT_CACHE_TTL_MS);
  const queryHash = hashQuery(payload.normalizedQuery);

  await dbExecute(`
    INSERT INTO ai_semantic_cache (
      id, tenant_id, query_hash, query_text, normalized_query, response_content, citations_json, confidence, model_used, intent, topic, expires_at, hit_count, last_accessed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `, [
    id,
    tenantId,
    queryHash,
    payload.queryText,
    payload.normalizedQuery,
    payload.responseContent,
    JSON.stringify(payload.citations || []),
    payload.confidence || 'HIGH',
    payload.modelUsed,
    payload.intent || 'CONCEPT_EXPLANATION',
    payload.topic || 'General',
    expiresAt,
    now,
    now,
  ]);

  return id;
}

/**
 * Invalidate cache by topic, query or tenant
 */
export async function invalidateSemanticCache(options: {
  tenantId?: string;
  topic?: string;
  queryContains?: string;
}): Promise<number> {
  const tenantId = options.tenantId || 'default';
  let sql = 'DELETE FROM ai_semantic_cache WHERE tenant_id = ?';
  const params: any[] = [tenantId];

  if (options.topic) {
    sql += ' AND topic = ?';
    params.push(options.topic);
  }

  if (options.queryContains) {
    sql += ' AND (normalized_query LIKE ? OR query_text LIKE ?)';
    params.push(`%${options.queryContains}%`, `%${options.queryContains}%`);
  }

  const res = await dbExecute(sql, params);
  return res.changes;
}

/**
 * Retrieve list of active Semantic Cache entries
 */
export async function getSemanticCacheList(
  tenantId = 'default',
  search?: string
): Promise<CacheEntry[]> {
  let sql = 'SELECT * FROM ai_semantic_cache WHERE tenant_id = ?';
  const params: any[] = [tenantId];

  if (search && search.trim()) {
    sql += ' AND (query_text LIKE ? OR normalized_query LIKE ? OR response_content LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  sql += ' ORDER BY created_at DESC LIMIT 100';
  const rows = await dbQuery<any>(sql, params);

  return rows.map((r) => {
    let citations = [];
    try {
      citations = JSON.parse(r.citations_json || '[]');
    } catch {
      citations = [];
    }

    return {
      id: r.id,
      queryHash: r.query_hash,
      queryText: r.query_text,
      normalizedQuery: r.normalized_query,
      responseContent: r.response_content,
      citations,
      confidence: r.confidence,
      modelUsed: r.model_used,
      intent: r.intent,
      topic: r.topic,
      expiresAt: Number(r.expires_at),
      hitCount: Number(r.hit_count),
      createdAt: Number(r.created_at),
    };
  });
}

/**
 * Delete a specific entry from Semantic Cache
 */
export async function deleteSemanticCacheEntry(id: string, tenantId = 'default'): Promise<boolean> {
  const res = await dbExecute('DELETE FROM ai_semantic_cache WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  return res.changes > 0;
}

/**
 * Scans and purges any mismatched / poisoned entries in semantic cache
 */
export async function purgePoisonedSemanticCache(tenantId = 'default'): Promise<number> {
  const rows = await dbQuery<{ id: string; normalized_query: string; response_content: string }>(
    'SELECT id, normalized_query, response_content FROM ai_semantic_cache WHERE tenant_id = ?',
    [tenantId]
  );
  let purged = 0;
  for (const r of rows) {
    if (!isCacheContentRelevant(r.normalized_query, r.response_content)) {
      await dbExecute('DELETE FROM ai_semantic_cache WHERE id = ?', [r.id]);
      purged++;
    }
  }
  return purged;
}

