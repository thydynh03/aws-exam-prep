/**
 * Cohere Rerank Service
 *
 * Re-ranks Top-K retrieved documents down to Top-N highly relevant chunks.
 *
 * SECURITY MANDATE:
 * - Backend ONLY.
 * - Key read from process.env.COHERE_API_KEY.
 * - Never sent to frontend, never returned in API responses, never logged.
 */

import type { RAGCandidateChunk } from './aiRagService.js';

export type RerankMode = 'ALWAYS' | 'WHEN_RELEVANCE_LOW' | 'COMPLEX_QUERY_ONLY' | 'DISABLED';

export interface RerankOptions {
  model?: string;
  topN?: number;
  scoreThreshold?: number;
  timeoutMs?: number;
  mode?: RerankMode;
}

export interface RerankResult {
  rerankedChunks: RAGCandidateChunk[];
  rerankUsed: boolean;
  rerankLatencyMs: number;
  modelUsed: string;
  error?: string;
}

const DEFAULT_COHERE_MODEL = 'rerank-v3.5';
const DEFAULT_TOP_N = 5;
const DEFAULT_SCORE_THRESHOLD = 0.2;
const DEFAULT_TIMEOUT_MS = 2500;

export function getCohereApiKey(): string {
  return (process.env.COHERE_API_KEY || '').trim();
}

export function isCohereConfigured(): boolean {
  return Boolean(getCohereApiKey());
}

/**
 * Check whether reranking should execute based on configured mode
 */
function shouldExecuteRerank(
  mode: RerankMode,
  query: string,
  chunks: RAGCandidateChunk[]
): boolean {
  if (mode === 'DISABLED') return false;
  if (!isCohereConfigured()) return false;
  if (chunks.length <= 2) return false;
  if (mode === 'ALWAYS') return true;

  if (mode === 'WHEN_RELEVANCE_LOW') {
    const topScore = chunks[0]?.retrievalScore || 0;
    return topScore < 0.8;
  }

  if (mode === 'COMPLEX_QUERY_ONLY') {
    const wordCount = query.trim().split(/\s+/).length;
    const isComparison = /so sánh|khác gì|vs|difference|compare/i.test(query);
    const isTroubleshoot = /lỗi|không kết nối|timeout|troubleshoot/i.test(query);
    return wordCount >= 7 || isComparison || isTroubleshoot;
  }

  return true;
}

/**
 * Execute Cohere Rerank on candidate chunks
 */
export async function rerankChunks(
  query: string,
  chunks: RAGCandidateChunk[],
  options: RerankOptions = {}
): Promise<RerankResult> {
  const mode = options.mode || 'ALWAYS';
  const topN = options.topN || DEFAULT_TOP_N;
  const model = options.model || DEFAULT_COHERE_MODEL;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const scoreThreshold = options.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD;

  if (chunks.length === 0) {
    return {
      rerankedChunks: [],
      rerankUsed: false,
      rerankLatencyMs: 0,
      modelUsed: model,
    };
  }

  // If rerank should not be executed or key missing, fallback to top-N retrieval chunks
  if (!shouldExecuteRerank(mode, query, chunks)) {
    return {
      rerankedChunks: chunks.slice(0, topN),
      rerankUsed: false,
      rerankLatencyMs: 0,
      modelUsed: 'local_ranking_fallback',
    };
  }

  const apiKey = getCohereApiKey();
  const startTime = Date.now();

  try {
    // Prepare documents for Cohere API (documents array of strings or objects)
    const documents = chunks.map((c) => `${c.title}\n${c.snippet}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch('https://api.cohere.com/v2/rerank', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model,
        query,
        documents,
        top_n: topN,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`Cohere Rerank API returned HTTP ${response.status}:`, errText.slice(0, 200));
      return {
        rerankedChunks: chunks.slice(0, topN),
        rerankUsed: false,
        rerankLatencyMs: latencyMs,
        modelUsed: model,
        error: `HTTP_${response.status}`,
      };
    }

    const data = (await response.json()) as {
      results?: Array<{ index: number; relevance_score: number }>;
    };

    const results = data.results || [];
    const reranked: RAGCandidateChunk[] = [];

    for (const item of results) {
      const chunk = chunks[item.index];
      if (chunk && (item.relevance_score >= scoreThreshold || reranked.length === 0)) {
        reranked.push({
          ...chunk,
          retrievalScore: item.relevance_score,
        });
      }
    }

    // Ensure we have at least the best chunk
    if (reranked.length === 0 && chunks.length > 0) {
      const first = chunks[0];
      if (first) reranked.push(first);
    }

    return {
      rerankedChunks: reranked.slice(0, topN),
      rerankUsed: true,
      rerankLatencyMs: latencyMs,
      modelUsed: model,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    console.warn('Cohere Rerank request failed, smoothly falling back to retrieval ranking:', err.message || err);

    return {
      rerankedChunks: chunks.slice(0, topN),
      rerankUsed: false,
      rerankLatencyMs: latencyMs,
      modelUsed: model,
      error: err.name === 'AbortError' ? 'TIMEOUT' : 'REQUEST_FAILED',
    };
  }
}
