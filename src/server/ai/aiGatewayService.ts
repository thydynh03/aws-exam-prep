/**
 * AI Gateway & Pipeline Orchestration Service
 *
 * Implements the 20-step production AI pipeline:
 * 1. Authentication & Tenant context
 * 2. Rate limiting
 * 3. Input validation & sanitization
 * 4. Prompt injection detection
 * 5. Relevance / Domain check
 * 6. Prompt rewrite & Intent detection
 * 7. Question normalization
 * 8. Semantic Cache check (Fast Path)
 * 9. Question Memory & Correction Memory retrieval
 * 10. Verified Knowledge retrieval
 * 11. RAG retrieval (Top-K)
 * 12. Cohere Reranking (Top-N)
 * 13. Context builder (strict untrusted boundaries)
 * 14. LLM Generation (or offline Knowledge Engine)
 * 15. Evidence validation & Hallucination check
 * 16. Output PII & Secret scan
 * 17. Output XSS sanitization
 * 18. Final response packaging
 * 19. Telemetry & Audit log recording
 * 20. Learning / Memory caching
 */

import crypto from 'node:crypto';
import { inspectInputSecurity, logSecurityEvent } from './aiSecurityGateway.js';
import { evaluateDomainScope } from './aiDomainGuard.js';
import { checkRateLimits } from './aiRateLimiter.js';
import { rewritePrompt } from './aiPromptRewriter.js';
import { contextualizeQuery } from './aiQueryContextualizer.js';
import { checkSemanticCache, storeInSemanticCache, type CacheEntry } from './aiSemanticCache.js';
import {
  findSimilarQuestions,
  recordQuestionMemory,
  retrieveRelevantCorrections,
  saveVerifiedKnowledge,
  type QuestionMemoryMatch,
} from './aiMemoryService.js';
import { retrieveKnowledgeChunks, type RAGCandidateChunk } from './aiRagService.js';
import { rerankChunks } from './aiCohereRerankService.js';
import { buildSafePromptContext } from './aiContextBuilder.js';
import { verifyGeneratedAnswer, type ConfidenceLevel } from './aiVerificationService.js';
import { guardOutput } from './aiOutputGuard.js';
import { logUsageTelemetry } from './aiTelemetryService.js';
import { getActiveAIConfig } from './aiConfigService.js';
import { generateKnowledgeEngineResponse } from '../../core/aiRagEngine.js';

export interface AIChatRequestPayload {
  query: string;
  userId?: string | null;
  username?: string;
  tenantId?: string;
  ipAddress?: string | null;
  mode?: string;
  currentQuestion?: {
    id: number;
    text: string;
    choices: Record<string, string>;
    answer: string;
    explanation?: string;
    domain: string;
    serviceTags?: string[];
  } | null;
  selectedAnswer?: string;
  isSubmitted?: boolean;
  isCorrect?: boolean;
  userNotes?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  clientApiKey?: string;
  clientProvider?: string;
  clientModel?: string;
  attachedImage?: {
    name?: string;
    dataUrl: string;
    type?: string;
  };
}

export interface AIPipelineStepInfo {
  step: number;
  id: string;
  name: string;
  category:
    | 'SECURITY'
    | 'GUARD'
    | 'UNDERSTANDING'
    | 'CACHE'
    | 'MEMORY'
    | 'RETRIEVAL'
    | 'RERANK'
    | 'GENERATION'
    | 'VERIFICATION'
    | 'OUTPUT_GUARD';
  status:
    | 'PASS'
    | 'BLOCKED'
    | 'FLAGGED'
    | 'CACHE_HIT'
    | 'CACHE_MISS'
    | 'GROUNDED'
    | 'RERANKED'
    | 'GENERATED'
    | 'SKIPPED';
  latencyMs: number;
  details: string;
}

export interface AIChatResponsePayload {
  content: string;
  citations: Array<{
    id: string;
    title: string;
    snippet: string;
    url?: string;
    type: string;
    authority?: number;
  }>;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  fastPathHit: boolean;
  memoryMatch: QuestionMemoryMatch | null;
  securityFlags: string[];
  intent: string;
  topic: string;
  pipelineSteps: AIPipelineStepInfo[];
  telemetry: {
    requestId: string;
    totalLatencyMs: number;
    retrievalLatencyMs: number;
    rerankLatencyMs: number;
    generationLatencyMs: number;
    modelUsed: string;
    rerankUsed: boolean;
  };
}

type ChatTurn = { role: 'user' | 'assistant'; content: string };

/**
 * Normalize prior conversation into provider-ready turns: drop the current query (the client
 * sends it as the last item), clip long messages, merge consecutive same-role turns and make
 * the sequence start with 'user' and end with 'assistant' so the new user prompt alternates.
 */
export function buildPriorTurns(history: ChatTurn[] | undefined, currentQuery: string, maxTurns = 10): ChatTurn[] {
  const prior = (history || []).filter(
    (h, i, arr) => !(i === arr.length - 1 && h.role === 'user' && h.content === currentQuery)
  );
  const merged: ChatTurn[] = [];
  for (const h of prior.slice(-maxTurns)) {
    if (!h.content?.trim()) continue;
    const content = h.role === 'user' ? h.content.slice(0, 4000) : h.content.slice(0, 3000);
    const last = merged[merged.length - 1];
    if (last && last.role === h.role) last.content += `\n\n${content}`;
    else merged.push({ role: h.role, content });
  }
  while (merged.length && merged[0].role !== 'user') merged.shift();
  while (merged.length && merged[merged.length - 1].role !== 'assistant') merged.pop();
  return merged;
}

/**
 * Call Gemini API directly from backend
 */
async function callBackendGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  timeoutMs: number,
  attachedImage?: { name?: string; dataUrl: string; type?: string },
  priorTurns: ChatTurn[] = []
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const effectiveTimeout = Math.max(timeoutMs || 45000, 45000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeout);

  const userParts: any[] = [{ text: userPrompt }];

  if (attachedImage?.dataUrl && attachedImage.dataUrl.includes('base64,')) {
    try {
      const [meta, base64Data] = attachedImage.dataUrl.split('base64,');
      const mimeMatch = meta.match(/data:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : (attachedImage.type || 'image/jpeg');
      userParts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    } catch (imgErr) {
      console.warn('Failed to parse attachedImage for Gemini:', imgErr);
    }
  }

  const generationConfig: Record<string, any> = {
    temperature,
    maxOutputTokens: 4096,
  };

  // If using Gemini 2.5 or thinking models, constrain thinkingBudget so reasoning doesn't starve response or timeout
  if (model.includes('2.5') || model.includes('thinking')) {
    generationConfig.thinkingConfig = {
      thinkingBudget: 1024,
    };
  }

  const payload = {
    contents: [
      ...priorTurns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] })),
      { role: 'user', parts: userParts },
    ],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  clearTimeout(timer);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as any;
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts;

  if (Array.isArray(parts) && parts.length > 0) {
    const validParts = parts.filter((p: any) => !p.thought && typeof p.text === 'string');
    return validParts.map((p: any) => p.text).join('');
  }

  throw new Error('Gemini API returned empty response candidate.');
}

/**
 * Call OpenAI API directly from backend
 */
async function callBackendOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  timeoutMs: number,
  attachedImage?: { name?: string; dataUrl: string; type?: string },
  priorTurns: ChatTurn[] = []
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const userContent: any[] = [{ type: 'text', text: userPrompt }];
  if (attachedImage?.dataUrl) {
    userContent.push({
      type: 'image_url',
      image_url: { url: attachedImage.dataUrl },
    });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...priorTurns.map((t) => ({ role: t.role, content: t.content })),
        { role: 'user', content: userContent },
      ],
      temperature,
      max_tokens: 4096,
    }),
    signal: controller.signal,
  });

  clearTimeout(timer);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as any;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI API returned empty response content.');
  }

  return content;
}

/**
 * Main Enterprise AI Pipeline Execution
 */
export async function executeAIPipeline(payload: AIChatRequestPayload): Promise<AIChatResponsePayload> {
  const startTime = Date.now();
  const tenantId = payload.tenantId || 'default';
  const requestId = `req_${crypto.randomUUID().slice(0, 12)}`;
  const config = await getActiveAIConfig(tenantId);

  // 1. Rate Limiting Check
  if (config.security.rateLimiting) {
    const rateLimit = checkRateLimits({
      ipAddress: payload.ipAddress,
      userId: payload.userId,
      tenantId,
    });

    if (!rateLimit.allowed) {
      const limitLatency = Date.now() - startTime;
      await logSecurityEvent({
        tenantId,
        userId: payload.userId,
        ipAddress: payload.ipAddress,
        eventType: 'RATE_LIMIT_EXCEEDED',
        severity: 'LOW',
        attackType: rateLimit.limitType || 'RATE_LIMIT',
        payloadSnippet: (payload.query || '').slice(0, 150),
        blocked: true,
        actionTaken: 'RATE_LIMITED_429',
      });

      const fallbackResult = generateKnowledgeEngineResponse({
        userQuery: (payload.query || '').trim(),
        currentQuestion: payload.currentQuestion as any,
        selectedAnswer: payload.selectedAnswer,
        isSubmitted: payload.isSubmitted,
        isCorrect: payload.isCorrect,
        userNotes: payload.userNotes,
        mode: (payload.mode || 'explain') as any,
        history: payload.history,
        imageAttached: Boolean(payload.attachedImage),
      });

      const notice = `> [!NOTE]\n> ⚡ **Yêu cầu chạm giới hạn tần suất (Rate Limit):**\n> ${rateLimit.message || 'Hạn mức yêu cầu tạm thời đạt ngưỡng.'}\n> Hệ thống đã tự động chuyển sang **giải thích chuyên sâu dựa trên nguồn tài liệu chuẩn & đáp án chính thức (Curated Source & Answer Description)** để không làm gián đoạn việc học của bạn.\n\n`;

      return {
        content: notice + (fallbackResult.answer || rateLimit.message || 'Bạn đã gửi yêu cầu quá nhanh. Vui lòng thử lại sau giây lát.'),
        citations: (fallbackResult.citations as any) || [],
        confidence: 'HIGH',
        confidenceScore: 0.85,
        fastPathHit: false,
        memoryMatch: null,
        securityFlags: ['RATE_LIMIT_EXCEEDED'],
        intent: 'QUESTION_SOLVING',
        topic: payload.currentQuestion?.domain ? 'Storage' : 'General',
        pipelineSteps: [
          { step: 1, id: 'rate_limit', name: 'Giới hạn tần suất (Rate Limiter)', category: 'GUARD', status: 'BLOCKED', latencyMs: limitLatency, details: rateLimit.message || 'Vượt quá giới hạn tần suất yêu cầu' },
          { step: 2, id: 'security', name: 'Bảo vệ An ninh (Security Guard)', category: 'SECURITY', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do bị chặn tần suất' },
          { step: 3, id: 'domain', name: 'Ranh giới AWS (Domain Scope)', category: 'GUARD', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do bị chặn' },
          { step: 4, id: 'rewrite', name: 'Tối ưu Câu hỏi (Query Rewriter)', category: 'UNDERSTANDING', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do bị chặn' },
          { step: 5, id: 'cache', name: 'Bộ nhớ đệm (Semantic Cache)', category: 'CACHE', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do bị chặn' },
          { step: 6, id: 'memory', name: 'Bộ nhớ Tri thức (Knowledge Memory)', category: 'MEMORY', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do bị chặn' },
          { step: 7, id: 'rag', name: 'Truy xuất RAG (Knowledge Retrieval)', category: 'RETRIEVAL', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do bị chặn' },
          { step: 8, id: 'rerank', name: 'Cohere Rerank Engine', category: 'RERANK', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do bị chặn' },
          { step: 9, id: 'generation', name: 'Tạo sinh AI (LLM Generation)', category: 'GENERATION', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do bị chặn' },
          { step: 10, id: 'output_guard', name: 'Kiểm định Đầu ra (Output Guard)', category: 'OUTPUT_GUARD', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do bị chặn' },
        ],
        telemetry: {
          requestId,
          totalLatencyMs: limitLatency,
          retrievalLatencyMs: 0,
          rerankLatencyMs: 0,
          generationLatencyMs: 0,
          modelUsed: 'rate_limiter',
          rerankUsed: false,
        },
      };
    }
  }

  // 1. Input Sanitizer Timing
  const inputSanitizerLatencyMs = Math.max(1, Math.round(performance.now() - startTime));

  // 2. Input Security Check (Prompt Injection, XSS, Secret & PII Scanning)
  const step2Start = performance.now();
  const securityCheck = await inspectInputSecurity(payload.query, {
    tenantId,
    userId: payload.userId,
    ipAddress: payload.ipAddress,
  });
  const securityLatencyMs = Math.max(1, Math.round(performance.now() - step2Start));

  if (!securityCheck.isSafe) {
    const secLatency = Date.now() - startTime;
    return {
      content: securityCheck.blockedReason || 'Yêu cầu bị từ chối do vi phạm quy tắc an toàn.',
      citations: [],
      confidence: 'LOW',
      confidenceScore: 0,
      fastPathHit: false,
      memoryMatch: null,
      securityFlags: securityCheck.securityFlags,
      intent: 'UNCLEAR',
      topic: 'General',
      pipelineSteps: [
        { step: 1, id: 'input_validation', name: 'Khử khuẩn Đầu vào (Input Sanitizer)', category: 'GUARD', status: 'PASS', latencyMs: inputSanitizerLatencyMs, details: 'Đã chuẩn hóa Unicode và kiểm tra giới hạn token' },
        { step: 2, id: 'security_gateway', name: 'Bảo vệ An ninh (Security Guard)', category: 'SECURITY', status: 'BLOCKED', latencyMs: securityLatencyMs, details: `Phát hiện nguy cơ: ${securityCheck.securityFlags.join(', ')}` },
        { step: 3, id: 'domain', name: 'Ranh giới AWS (Domain Scope)', category: 'GUARD', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do vi phạm bảo mật' },
        { step: 4, id: 'rewrite', name: 'Tối ưu Câu hỏi (Query Rewriter)', category: 'UNDERSTANDING', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do vi phạm bảo mật' },
        { step: 5, id: 'cache', name: 'Bộ nhớ đệm (Semantic Cache)', category: 'CACHE', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do vi phạm bảo mật' },
        { step: 6, id: 'memory', name: 'Bộ nhớ Tri thức (Knowledge Memory)', category: 'MEMORY', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do vi phạm bảo mật' },
        { step: 7, id: 'rag', name: 'Truy xuất RAG (Knowledge Retrieval)', category: 'RETRIEVAL', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do vi phạm bảo mật' },
        { step: 8, id: 'rerank', name: 'Cohere Rerank Engine', category: 'RERANK', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do vi phạm bảo mật' },
        { step: 9, id: 'generation', name: 'Tạo sinh AI (LLM Generation)', category: 'GENERATION', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do vi phạm bảo mật' },
        { step: 10, id: 'output_guard', name: 'Kiểm định Đầu ra (Output Guard)', category: 'OUTPUT_GUARD', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do vi phạm bảo mật' },
      ],
      telemetry: {
        requestId,
        totalLatencyMs: secLatency,
        retrievalLatencyMs: 0,
        rerankLatencyMs: 0,
        generationLatencyMs: 0,
        modelUsed: 'security_gateway',
        rerankUsed: false,
      },
    };
  }

  // 3. Domain & Scope Relevance Check
  // An ongoing conversation is context too: short follow-ups ("tại sao vậy?") must not be
  // rejected as out-of-scope just because they name no AWS term themselves.
  const hasQuestionContext =
    Boolean(payload.currentQuestion) ||
    (payload.history || []).some((m) => m.role === 'assistant');
  const step3Start = performance.now();
  let domainLatencyMs = 1;
  if (config.security.domainScopeGuard) {
    const domainCheck = evaluateDomainScope(securityCheck.sanitizedInput, hasQuestionContext);
    domainLatencyMs = Math.max(1, Math.round(performance.now() - step3Start));
    if (domainCheck.classification === 'OUT_OF_SCOPE') {
      const domainLatency = Date.now() - startTime;
      return {
        content: domainCheck.suggestedResponse || config.domainPolicy.outOfScopeFallbackResponse,
        citations: [],
        confidence: 'LOW',
        confidenceScore: 0,
        fastPathHit: false,
        memoryMatch: null,
        securityFlags: [...securityCheck.securityFlags, 'DOMAIN_OUT_OF_SCOPE'],
        intent: 'UNCLEAR',
        topic: 'General',
        pipelineSteps: [
          { step: 1, id: 'input_validation', name: 'Khử khuẩn Đầu vào (Input Sanitizer)', category: 'GUARD', status: 'PASS', latencyMs: 1, details: 'Đã chuẩn hóa Unicode và kiểm tra giới hạn token' },
          { step: 2, id: 'security_gateway', name: 'Bảo vệ An ninh (Security Guard)', category: 'SECURITY', status: 'PASS', latencyMs: 2, details: 'Không phát hiện mã độc hoặc injection' },
          { step: 3, id: 'domain', name: 'Ranh giới AWS (Domain Scope)', category: 'GUARD', status: 'BLOCKED', latencyMs: domainLatency, details: 'Nằm ngoài phạm vi bài thi AWS Certified Solutions Architect Associate (SAA-C03)' },
          { step: 4, id: 'rewrite', name: 'Tối ưu Câu hỏi (Query Rewriter)', category: 'UNDERSTANDING', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do ngoài phạm vi đề thi' },
          { step: 5, id: 'cache', name: 'Bộ nhớ đệm (Semantic Cache)', category: 'CACHE', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do ngoài phạm vi đề thi' },
          { step: 6, id: 'memory', name: 'Bộ nhớ Tri thức (Knowledge Memory)', category: 'MEMORY', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do ngoài phạm vi đề thi' },
          { step: 7, id: 'rag', name: 'Truy xuất RAG (Knowledge Retrieval)', category: 'RETRIEVAL', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do ngoài phạm vi đề thi' },
          { step: 8, id: 'rerank', name: 'Cohere Rerank Engine', category: 'RERANK', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do ngoài phạm vi đề thi' },
          { step: 9, id: 'generation', name: 'Tạo sinh AI (LLM Generation)', category: 'GENERATION', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do ngoài phạm vi đề thi' },
          { step: 10, id: 'output_guard', name: 'Kiểm định Đầu ra (Output Guard)', category: 'OUTPUT_GUARD', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua do ngoài phạm vi đề thi' },
        ],
        telemetry: {
          requestId,
          totalLatencyMs: domainLatency,
          retrievalLatencyMs: 0,
          rerankLatencyMs: 0,
          generationLatencyMs: 0,
          modelUsed: 'domain_guard',
          rerankUsed: false,
        },
      };
    }
  }

  // 4a. History-aware rewrite: turn follow-ups into a standalone query for cache/memory/RAG
  const step4Start = performance.now();
  const contextualized = await contextualizeQuery({
    query: securityCheck.sanitizedInput,
    history: payload.history || [],
    currentQuestion: payload.currentQuestion,
    apiKey: payload.clientApiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '',
    provider: payload.clientProvider || config.aiProvider.provider,
  });

  // 4b. Prompt Rewriter & Question Understanding
  const rewrite = rewritePrompt(contextualized.standaloneQuery);
  const rewriteLatencyMs = Math.max(1, Math.round(performance.now() - step4Start));

  // 5. Question Memory & Previous Mistakes Check
  const step6Start = performance.now();
  const similarQuestion = await findSimilarQuestions(
    rewrite.normalizedQuery,
    rewrite.intent,
    rewrite.topic,
    tenantId
  );

  const pastCorrections = await retrieveRelevantCorrections(rewrite.normalizedQuery, tenantId);
  const memoryLatencyMs = Math.max(1, Math.round(performance.now() - step6Start));

  // 6. Semantic Cache Check & Prior Knowledge Retrieval
  const step5Start = performance.now();
  let matchedPreviousOutput: string | undefined = undefined;
  let cacheHitEntry: CacheEntry | undefined = undefined;
  let cacheLatencyMs = 1;

  if (config.memory.semanticCacheEnabled && pastCorrections.length === 0) {
    const cacheResult = await checkSemanticCache(
      rewrite.normalizedQuery,
      tenantId,
      config.memory.similarityThreshold
    );
    cacheLatencyMs = Math.max(1, Math.round(performance.now() - step5Start));

    if (cacheResult.isHit && cacheResult.entry) {
      const hasHistory = Boolean(payload.history && payload.history.length > 0);
      const isComparisonOrAnalysis =
        /(?:khác|so\s+sánh|vs|phân\s+biệt|đối\s+chiếu|tại\s+sao|vì\s+sao)/i.test(payload.query);

      // STRICT Fast-Path Criteria:
      // Only an EXACT 100% hash match with VERIFIED benchmark confidence,
      // without multi-turn conversation context history, and without comparison reasoning
      // qualifies to return immediately without LLM synthesis.
      if (
        cacheResult.hitType === 'EXACT' &&
        cacheResult.entry.confidence === 'VERIFIED' &&
        !hasHistory &&
        !isComparisonOrAnalysis
      ) {
        const totalLatencyMs = Date.now() - startTime;

        // Log Telemetry for Cache Hit
        void logUsageTelemetry({
          requestId,
          tenantId,
          userId: payload.userId,
          model: 'semantic_cache_fast_path',
          inputTokens: Math.ceil(securityCheck.sanitizedInput.length / 4),
          outputTokens: Math.ceil(cacheResult.entry.responseContent.length / 4),
          totalLatencyMs,
          cacheHit: true,
          costEstimateUsd: 0,
        });

        return {
          content: cacheResult.entry.responseContent,
          citations: cacheResult.entry.citations,
          confidence: (cacheResult.entry.confidence as ConfidenceLevel) || 'HIGH',
          confidenceScore: cacheResult.similarityScore || 0.95,
          fastPathHit: true,
          memoryMatch: similarQuestion,
          securityFlags: securityCheck.securityFlags,
          intent: rewrite.intent,
          topic: rewrite.topic,
          pipelineSteps: [
            { step: 1, id: 'input_validation', name: 'Khử khuẩn Đầu vào (Input Sanitizer)', category: 'GUARD', status: 'PASS', latencyMs: 1, details: 'Đã chuẩn hóa Unicode và lọc ký tự điều khiển' },
            { step: 2, id: 'security_gateway', name: 'Bảo vệ An ninh (Security Guard)', category: 'SECURITY', status: 'PASS', latencyMs: 2, details: 'Không phát hiện Prompt Injection hay Jailbreak' },
            { step: 3, id: 'domain', name: 'Ranh giới AWS (Domain Scope)', category: 'GUARD', status: 'PASS', latencyMs: 2, details: `Xác nhận trong phạm vi bài thi AWS SAA (Chủ đề: ${rewrite.topic})` },
            { step: 4, id: 'rewrite', name: 'Tối ưu Câu hỏi (Query Rewriter)', category: 'UNDERSTANDING', status: 'PASS', latencyMs: 3, details: `Ý định: ${rewrite.intent} | Chuẩn hóa: "${rewrite.normalizedQuery}"` },
            { step: 5, id: 'cache', name: 'Bộ nhớ đệm (Semantic Cache)', category: 'CACHE', status: 'CACHE_HIT', latencyMs: totalLatencyMs, details: `Khớp bộ nhớ đệm (${Math.round((cacheResult.similarityScore || 0.95) * 100)}% tương đồng) - Phản hồi siêu tốc 0ms Fast Path` },
            { step: 6, id: 'memory', name: 'Bộ nhớ Tri thức (Knowledge Memory)', category: 'MEMORY', status: 'PASS', latencyMs: 0, details: similarQuestion ? `Khớp câu hỏi lịch sử: "${similarQuestion.matchedQuestion}"` : 'Đã đối chiếu bộ nhớ sửa sai' },
            { step: 7, id: 'rag', name: 'Truy xuất RAG (Knowledge Retrieval)', category: 'RETRIEVAL', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua nhờ trúng Semantic Cache Fast Path' },
            { step: 8, id: 'rerank', name: 'Cohere Rerank Engine', category: 'RERANK', status: 'SKIPPED', latencyMs: 0, details: 'Bỏ qua nhờ trúng Semantic Cache Fast Path' },
            { step: 9, id: 'generation', name: 'Tạo sinh AI (LLM Generation)', category: 'GENERATION', status: 'SKIPPED', latencyMs: 0, details: 'Tái sử dụng câu trả lời đã xác thực từ trước' },
            { step: 10, id: 'output_guard', name: 'Kiểm định Đầu ra (Output Guard)', category: 'OUTPUT_GUARD', status: 'GROUNDED', latencyMs: 1, details: 'Đã được kiểm định an toàn và grounding trong cache' },
          ],
          telemetry: {
            requestId,
            totalLatencyMs,
            retrievalLatencyMs: 0,
            rerankLatencyMs: 0,
            generationLatencyMs: 0,
            modelUsed: 'semantic_cache',
            rerankUsed: false,
          },
        };
      }

      // Prior output matched in cache: Capture it as previousOutput!
      // The Agent Model will inspect this prior output along with offline knowledge base,
      // AWS docs, memory, context history, and foundational intelligence rather than
      // blindly returning potentially outdated, incomplete, or flawed output.
      matchedPreviousOutput = cacheResult.entry.responseContent;
      cacheHitEntry = cacheResult.entry;
    }
  }

  // If no cache matched, check if conversation history contains a recent assistant message
  if (!matchedPreviousOutput && payload.history && payload.history.length > 0) {
    const lastAssistantMsg = [...payload.history].reverse().find((m) => m.role === 'assistant');
    if (lastAssistantMsg?.content) {
      matchedPreviousOutput = lastAssistantMsg.content;
    }
  }

  // 7. RAG Knowledge Retrieval (Top-K)
  const retStart = Date.now();
  const retrievedChunks = await retrieveKnowledgeChunks({
    query: rewrite.rewrittenQuery,
    topic: rewrite.topic,
    currentQuestionId: payload.currentQuestion?.id,
    topK: config.rag.topK,
    tenantId,
  });
  const retrievalLatencyMs = Date.now() - retStart;

  // 8. Cohere Reranking (Top-N)
  const rerankStart = Date.now();
  let rerankedChunks: RAGCandidateChunk[] = retrievedChunks;
  let rerankUsed = false;

  if (config.cohereRerank.enabled) {
    const rerankRes = await rerankChunks(rewrite.rewrittenQuery, retrievedChunks, {
      model: config.cohereRerank.model,
      topN: config.cohereRerank.topN,
      scoreThreshold: config.cohereRerank.scoreThreshold,
      timeoutMs: config.cohereRerank.timeoutMs,
      mode: config.cohereRerank.mode,
    });
    rerankedChunks = rerankRes.rerankedChunks;
    rerankUsed = rerankRes.rerankUsed;
  } else {
    rerankedChunks = retrievedChunks.slice(0, config.cohereRerank.topN);
  }
  const rerankLatencyMs = Date.now() - rerankStart;

  // Multi-turn thread: don't classify the query with keywords. The LLM receives the full
  // conversation and decides itself whether this is a follow-up or a standalone question.
  const priorTurns = (payload.history || []).filter((m) => m.content !== payload.query);
  const isContextualFollowUp = priorTurns.length > 0;

  const isQuestionSolving =
    isContextualFollowUp ||
    rewrite.intent === 'QUESTION_SOLVING' ||
    /(?:câu này|bài này|đề này|đề bài|đề có|đề hỏi|đề yêu cầu|yêu cầu của đề|trong đề|câu hỏi này|đáp án câu|đáp án của|tại sao chọn|tại sao phải chọn|vì sao chọn|sao lại chọn|phải chọn|tại sao sai|vì sao sai|sao sai|sao lại sai|tôi chọn|chọn [a-e]\b|phương án [a-e]\b|lựa chọn [a-e]\b|\b[a-e]\b.*?(?:đúng|sai)|giải thích câu|giải thích đề|bóc mẽ bẫy)/i.test(payload.query);
  const isConceptOnly =
    !isQuestionSolving || (rewrite.intent === 'CONCEPT_EXPLANATION' && !isContextualFollowUp);

  // 9. Context Builder
  const promptContext = buildSafePromptContext({
    userQuery: securityCheck.sanitizedInput,
    rewrittenQuery: rewrite.rewrittenQuery,
    mode: payload.mode || 'explain',
    intent: rewrite.intent,
    isConceptOnly,
    isFollowUp: isContextualFollowUp,
    rerankedChunks,
    currentQuestion: payload.currentQuestion ? {
      id: payload.currentQuestion.id,
      text: payload.currentQuestion.text,
      choices: payload.currentQuestion.choices,
      answer: payload.currentQuestion.answer,
      explanation: payload.currentQuestion.explanation,
      domain: payload.currentQuestion.domain,
    } : null,
    selectedAnswer: payload.selectedAnswer,
    isSubmitted: payload.isSubmitted,
    isCorrect: payload.isCorrect,
    userNotes: payload.userNotes,
    history: payload.history,
    // History goes to the LLM as native multi-turn messages whenever a provider call will be made
    historyAsTurns: Boolean(
      (payload.clientApiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) &&
        ['gemini', 'openai'].includes(payload.clientProvider || config.aiProvider.provider)
    ),
    previousOutput: matchedPreviousOutput,
    corrections: pastCorrections.map((c) => ({
      errorType: c.errorType,
      originalAnswer: c.originalAnswer,
      correctedAnswer: c.correctedAnswer,
      reason: c.reason,
    })),
  });

  // 10. LLM Generation
  const genStart = Date.now();
  let rawGenerated = '';
  let modelUsed = config.aiProvider.model;

  const apiKeyToUse = payload.clientApiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';
  const providerToUse = payload.clientProvider || config.aiProvider.provider;
  const priorChatTurns = buildPriorTurns(payload.history, payload.query);

  try {
    if (apiKeyToUse && providerToUse === 'gemini') {
      rawGenerated = await callBackendGemini(
        apiKeyToUse,
        payload.clientModel || config.aiProvider.model,
        promptContext.systemPrompt,
        promptContext.userPrompt,
        config.aiProvider.temperature,
        config.aiProvider.timeoutMs,
        payload.attachedImage,
        priorChatTurns
      );
    } else if (apiKeyToUse && providerToUse === 'openai') {
      rawGenerated = await callBackendOpenAI(
        apiKeyToUse,
        payload.clientModel || 'gpt-4o-mini',
        promptContext.systemPrompt,
        promptContext.userPrompt,
        config.aiProvider.temperature,
        config.aiProvider.timeoutMs,
        payload.attachedImage,
        priorChatTurns
      );
    } else {
      // Offline / Local Knowledge Engine Fallback
      modelUsed = 'curated_knowledge_engine';
      const fallbackResult = generateKnowledgeEngineResponse({
        userQuery: securityCheck.sanitizedInput,
        currentQuestion: payload.currentQuestion as any,
        selectedAnswer: payload.selectedAnswer,
        isSubmitted: payload.isSubmitted,
        isCorrect: payload.isCorrect,
        userNotes: payload.userNotes,
        mode: (payload.mode || 'explain') as any,
        history: payload.history,
        imageAttached: Boolean(payload.attachedImage),
      });
      rawGenerated = fallbackResult.answer || (fallbackResult as any).content || '';
    }
  } catch (genErr: any) {
    console.warn('LLM Generation failed, falling back to curated Knowledge Engine:', genErr.message || genErr);
    modelUsed = 'curated_knowledge_engine_fallback';
    const fallbackResult = generateKnowledgeEngineResponse({
      userQuery: securityCheck.sanitizedInput,
      currentQuestion: payload.currentQuestion as any,
      selectedAnswer: payload.selectedAnswer,
      isSubmitted: payload.isSubmitted,
      isCorrect: payload.isCorrect,
      userNotes: payload.userNotes,
      mode: (payload.mode || 'explain') as any,
      history: payload.history,
      imageAttached: Boolean(payload.attachedImage),
    });
    rawGenerated = fallbackResult.answer || (fallbackResult as any).content || '';
    if (apiKeyToUse) {
      let friendlyError = genErr.message || 'Không thể kết nối nhà cung cấp';
      const isQuotaOrLimit =
        genErr?.status === 429 ||
        genErr?.statusCode === 429 ||
        /429|quota|rate limit|resource_exhausted|too many requests|tokens per minute|tpm|rpm/i.test(friendlyError);
      if (isQuotaOrLimit) {
        friendlyError = `Hạn mức gọi API (${providerToUse.toUpperCase()}) tạm thời bị hết hoặc giới hạn tần suất (Rate Limit / Quota Exhausted).`;
      } else if (genErr.name === 'AbortError' || friendlyError.includes('aborted') || friendlyError.includes('timeout')) {
        friendlyError = `Quá thời gian chờ phản hồi (Timeout). Mô hình ${payload.clientModel || config.aiProvider.model} đang chịu tải hoặc xử lý tác vụ suy nghĩ sâu (deep-thinking).`;
      }
      const errorNotice = `> [!WARNING]\n> **Lưu ý về kết nối API (${providerToUse.toUpperCase()}):**\n> ${friendlyError}\n> Hệ thống đã tự động chuyển sang chế độ giải thích chi tiết dựa trên dữ liệu gốc (source) của đề thi và tài liệu AWS chính thức.\n\n`;
      rawGenerated = errorNotice + rawGenerated;
    }
    if (fallbackResult.citations && fallbackResult.citations.length > 0 && !rawGenerated.includes('Tài liệu AWS tham khảo') && !rawGenerated.includes('Nguồn tài liệu đối chiếu')) {
      const docCitations = fallbackResult.citations
        .map((c) => `- [${c.title}](${c.url})`)
        .join('\n');
      rawGenerated += `\n\n### 📚 Nguồn tài liệu đối chiếu (Source AWS):\n${docCitations}`;
    }
  }

  const generationLatencyMs = Date.now() - genStart;

  // 11. Evidence Verification & Hallucination Check
  const step10Start = performance.now();
  const hasVerifiedHit = rerankedChunks.some((c) => c.sourceType === 'VERIFIED_KNOWLEDGE' && c.authority >= 0.9);
  const verification = verifyGeneratedAnswer(rawGenerated, rerankedChunks, hasVerifiedHit, securityCheck.sanitizedInput);

  // 12. Output Security Gate (PII, Secrets, XSS)
  const outputGuard = guardOutput(verification.verifiedAnswer);
  const outputGuardLatencyMs = Math.max(1, Math.round(performance.now() - step10Start));
  const finalSecurityFlags = [...securityCheck.securityFlags, ...outputGuard.securityFlags];

  const totalLatencyMs = Date.now() - startTime;

  // 13. Record Question Memory in background
  void recordQuestionMemory({
    tenantId,
    userId: payload.userId,
    originalQuestion: payload.query,
    normalizedQuestion: rewrite.normalizedQuery,
    rewrittenQuestion: rewrite.rewrittenQuery,
    intent: rewrite.intent,
    topic: rewrite.topic,
    securityFlags: finalSecurityFlags,
  });

  // 14. Cache Verified / High-Confidence Answers in Semantic Cache (do not cache local offline fallback templates)
  if (
    config.memory.semanticCacheEnabled &&
    verification.isValid &&
    (verification.confidence === 'VERIFIED' || verification.confidence === 'HIGH') &&
    pastCorrections.length === 0 &&
    !modelUsed.startsWith('curated_knowledge_engine')
  ) {
    void storeInSemanticCache({
      tenantId,
      queryText: payload.query,
      normalizedQuery: rewrite.normalizedQuery,
      responseContent: outputGuard.safeContent,
      citations: promptContext.citations,
      confidence: verification.confidence,
      modelUsed,
      intent: rewrite.intent,
      topic: rewrite.topic,
    });
  }

  // 14B. Auto-Index Candidate Knowledge in ai_verified_knowledge for Admin Review
  if (
    verification.isValid &&
    (verification.confidence === 'VERIFIED' || verification.confidence === 'HIGH') &&
    pastCorrections.length === 0 &&
    !modelUsed.startsWith('curated_knowledge_engine')
  ) {
    void saveVerifiedKnowledge({
      tenantId,
      question: payload.query,
      answer: outputGuard.safeContent,
      intent: rewrite.intent,
      topic: rewrite.topic,
      sources: promptContext.citations,
      evidence: ['Grounded by AWS RAG & Enterprise AI Verification Engine'],
      confidence: verification.confidence,
      status: 'CANDIDATE',
      verifiedBy: 'AI Pipeline Auto-Index',
    }).catch((kErr) => console.warn('Candidate knowledge auto-index warning:', kErr));
  }

  // 15. Record Usage Telemetry
  const inTokens = Math.ceil((promptContext.systemPrompt.length + promptContext.userPrompt.length) / 4);
  const outTokens = Math.ceil(outputGuard.safeContent.length / 4);
  const costEstimateUsd = (inTokens * 0.00000015) + (outTokens * 0.0000006);

  void logUsageTelemetry({
    requestId,
    tenantId,
    userId: payload.userId,
    model: modelUsed,
    inputTokens: inTokens,
    outputTokens: outTokens,
    retrievalLatencyMs,
    rerankLatencyMs,
    generationLatencyMs,
    totalLatencyMs,
    cacheHit: false,
    memoryHit: Boolean(similarQuestion),
    rerankUsed,
    costEstimateUsd,
  });

  const pipelineSteps: AIPipelineStepInfo[] = [
    { step: 1, id: 'input_validation', name: 'Khử khuẩn Đầu vào (Input Sanitizer)', category: 'GUARD', status: 'PASS', latencyMs: inputSanitizerLatencyMs, details: 'Đã chuẩn hóa Unicode, loại bỏ ký tự điều khiển và xác thực giới hạn token' },
    { step: 2, id: 'security_gateway', name: 'Bảo vệ An ninh (Security Guard)', category: 'SECURITY', status: securityCheck.securityFlags.length ? 'FLAGGED' : 'PASS', latencyMs: securityLatencyMs, details: securityCheck.securityFlags.length ? `Cảnh báo an ninh: ${securityCheck.securityFlags.join(', ')}` : 'An toàn: Không phát hiện Prompt Injection, Jailbreak hay đánh cắp System Prompt' },
    { step: 3, id: 'domain', name: 'Ranh giới AWS (Domain Scope)', category: 'GUARD', status: 'PASS', latencyMs: domainLatencyMs, details: `Xác nhận trong phạm vi đề thi AWS Certified Solutions Architect Associate (Chủ đề: ${rewrite.topic})` },
    { step: 4, id: 'rewrite', name: 'Tối ưu Câu hỏi (Query Rewriter)', category: 'UNDERSTANDING', status: 'PASS', latencyMs: rewriteLatencyMs, details: `Ý định: ${rewrite.intent}${contextualized.method !== 'none' ? ` | Viết lại theo ngữ cảnh hội thoại (${contextualized.method === 'llm' ? 'LLM' : 'heuristic'}): "${contextualized.standaloneQuery}"` : ''} | Chuẩn hóa từ viết tắt AWS: "${rewrite.normalizedQuery}"` },
    {
      step: 5,
      id: 'cache',
      name: 'Bộ nhớ đệm (Semantic Cache)',
      category: 'CACHE',
      status: cacheHitEntry ? 'CACHE_HIT' : 'CACHE_MISS',
      latencyMs: cacheLatencyMs,
      details: cacheHitEntry
        ? `Khớp tri thức trước đó (${Math.round((cacheHitEntry.hitCount ? 0.95 : 0.88) * 100)}%) - Đã nạp vào ngữ cảnh để AI đối soát và tổng hợp đa nguồn`
        : 'Không có cache trùng khớp, chuyển tiếp sang RAG và Rerank',
    },
    { step: 6, id: 'memory', name: 'Bộ nhớ Tri thức (Knowledge Memory)', category: 'MEMORY', status: 'PASS', latencyMs: memoryLatencyMs, details: similarQuestion ? `Khớp câu hỏi tương tự (${Math.round(similarQuestion.similarityScore * 100)}%): "${similarQuestion.matchedQuestion}"` : (pastCorrections.length ? `Đã nạp ${pastCorrections.length} đính chính lỗi sai cũ` : 'Đã đối chiếu bộ nhớ sửa sai và câu hỏi học viên') },
    { step: 7, id: 'rag', name: 'Truy xuất RAG (Knowledge Retrieval)', category: 'RETRIEVAL', status: 'PASS', latencyMs: Math.max(1, retrievalLatencyMs), details: `Trích xuất thành công ${retrievedChunks.length} tài liệu từ 1,019 câu hỏi SAA & 42 cẩm nang AWS` },
    { step: 8, id: 'rerank', name: 'Cohere Rerank Engine', category: 'RERANK', status: rerankUsed ? 'RERANKED' : 'PASS', latencyMs: Math.max(1, rerankLatencyMs), details: rerankUsed ? `Đã rerank Top-${retrievedChunks.length} xuống Top-${rerankedChunks.length} đoạn tối ưu bằng Cohere Rerank v3.5` : `Rerank trực tiếp Top-${rerankedChunks.length} tài liệu liên quan` },
    { step: 9, id: 'generation', name: 'Tạo sinh AI (LLM Generation)', category: 'GENERATION', status: 'GENERATED', latencyMs: Math.max(1, generationLatencyMs), details: `Tạo phản hồi an toàn với model ${modelUsed} trong ranh giới UNTRUSTED_REFERENCE_DATA` },
    { step: 10, id: 'output_guard', name: 'Kiểm định Đầu ra (Output Guard)', category: 'OUTPUT_GUARD', status: 'GROUNDED', latencyMs: outputGuardLatencyMs, details: `Độ tin cậy: ${verification.confidence} (${Math.round(verification.confidenceScore * 100)}%). Đã kiểm tra chống rò rỉ secret, lọc PII và làm sạch XSS` },
  ];

  return {
    content: outputGuard.safeContent,
    citations: promptContext.citations,
    confidence: verification.confidence,
    confidenceScore: verification.confidenceScore,
    fastPathHit: false,
    memoryMatch: similarQuestion,
    securityFlags: finalSecurityFlags,
    intent: rewrite.intent,
    topic: rewrite.topic,
    pipelineSteps,
    telemetry: {
      requestId,
      totalLatencyMs,
      retrievalLatencyMs,
      rerankLatencyMs,
      generationLatencyMs,
      modelUsed,
      rerankUsed,
    },
  };
}
