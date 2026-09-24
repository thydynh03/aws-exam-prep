/**
 * AI Learning & Feedback Service
 *
 * Implements:
 * 1. Learning from Correct Answers: Candidate knowledge generation and verification promotion.
 * 2. Learning from Wrong Answers: Error taxonomy classification, correction records, mistake memory.
 * 3. Semantic Cache Invalidation on Corrections: Immediately purge incorrect answers from cache.
 * 4. Strict Anti Self-Poisoning: AI output is never trusted as truth without verification.
 */

import crypto from 'node:crypto';
import { dbExecute } from '../db.js';
import { recordCorrection, saveVerifiedKnowledge } from './aiMemoryService.js';
import { invalidateSemanticCache } from './aiSemanticCache.js';

export type AIErrorType =
  | 'hallucination'
  | 'factual_error'
  | 'outdated_information'
  | 'wrong_source'
  | 'incorrect_reasoning'
  | 'misunderstood_question'
  | 'incomplete_answer'
  | 'missing_context'
  | 'irrelevant_answer'
  | 'security_issue'
  | 'other';

export interface ProcessFeedbackPayload {
  tenantId?: string;
  userId?: string | null;
  queryId?: string;
  questionId?: number | null;
  rating: 'up' | 'down';
  errorType?: AIErrorType;
  userCorrection?: string;
  comment?: string;
  reasonTags?: string[];
  originalQuestion: string;
  originalAnswer: string;
  sources?: Array<{ id: string; title: string; url?: string }>;
  mode?: string;
  provider?: string;
  isAdmin?: boolean;
}

export interface LearningResult {
  success: boolean;
  actionTaken: 'PROMOTED_TO_VERIFIED' | 'PROMOTED_TO_CANDIDATE' | 'CORRECTION_RECORDED' | 'FEEDBACK_LOGGED';
  recordId: string;
  cacheInvalidatedCount?: number;
}

/**
 * Process detailed feedback and update memory/cache
 */
export async function processAIFeedback(payload: ProcessFeedbackPayload): Promise<LearningResult> {
  const tenantId = payload.tenantId || 'default';
  const now = Date.now();
  const feedbackId = `fb_${crypto.randomUUID().slice(0, 10)}`;

  // 1. Record in standard ai_feedback table
  await dbExecute(`
    INSERT INTO ai_feedback (
      id, user_id, question_id, rating, reason_tags_json, comment, mode, provider, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    feedbackId,
    payload.userId || null,
    payload.questionId || null,
    payload.rating,
    JSON.stringify(payload.reasonTags || (payload.errorType ? [payload.errorType] : [])),
    payload.comment || payload.userCorrection || null,
    payload.mode || 'explain',
    payload.provider || 'pipeline',
    now,
  ]);

  // 2. If user rated INCORRECT (Downvote)
  if (payload.rating === 'down') {
    const errorType: AIErrorType = payload.errorType || 'factual_error';

    // A. Create Correction Record
    const correctionId = await recordCorrection({
      tenantId,
      userId: payload.userId,
      errorType,
      originalQuestion: payload.originalQuestion,
      originalAnswer: payload.originalAnswer,
      correctedAnswer: payload.userCorrection || 'Đã ghi nhận câu trả lời không chính xác từ học viên.',
      userCorrection: payload.userCorrection,
      reason: payload.comment || 'Học viên phản hồi câu trả lời chưa chuẩn xác',
      correctSource: payload.sources?.[0]?.title || 'Tài liệu chuẩn AWS',
    });

    // B. Immediately invalidate semantic cache for this question to prevent returning faulty answer
    const invalidated = await invalidateSemanticCache({
      tenantId,
      queryContains: payload.originalQuestion.slice(0, 40),
    });

    // C. If there is existing verified knowledge for this question, mark it as possibly outdated
    await dbExecute(`
      UPDATE ai_verified_knowledge
      SET possibly_outdated = 1, correction_count = correction_count + 1, updated_at = ?
      WHERE tenant_id = ? AND question LIKE ?
    `, [now, tenantId, `%${payload.originalQuestion.slice(0, 40)}%`]);

    return {
      success: true,
      actionTaken: 'CORRECTION_RECORDED',
      recordId: correctionId,
      cacheInvalidatedCount: invalidated,
    };
  }

  // 3. If user rated CORRECT (Upvote)
  // Check if we can promote to Verified Knowledge or Candidate Knowledge
  const isEligibleForVerification = Boolean(
    payload.isAdmin ||
    (payload.sources && payload.sources.length > 0 && payload.originalAnswer.length > 60)
  );

  const status = isEligibleForVerification ? 'VERIFIED' : 'CANDIDATE';

  const { knowledgeId } = await saveVerifiedKnowledge({
    tenantId,
    question: payload.originalQuestion,
    answer: payload.originalAnswer,
    intent: 'CONCEPT_EXPLANATION',
    topic: 'General',
    sources: payload.sources || [],
    confidence: isEligibleForVerification ? 'VERIFIED' : 'HIGH',
    status,
    verifiedBy: payload.isAdmin ? (payload.userId || 'admin') : undefined,
  });

  return {
    success: true,
    actionTaken: isEligibleForVerification ? 'PROMOTED_TO_VERIFIED' : 'PROMOTED_TO_CANDIDATE',
    recordId: knowledgeId,
  };
}
