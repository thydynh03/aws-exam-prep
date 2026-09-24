import crypto from 'node:crypto';
import { dbQuery, dbQueryOne, dbExecute } from './db.js';
import type { Question } from '../core/types.js';

export interface CustomQuestionRecord {
  id: number;
  creator_id: string;
  creator_username?: string;
  text: string;
  choices_json: string;
  choice_keys_json: string;
  answer: string;
  explanation_json: string | null;
  domain: string;
  difficulty: string;
  topic: string;
  service_tags_json: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  is_private: number;
  rejection_reason: string | null;
  source_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface QuestionInput {
  text: string;
  choices: Record<string, string>;
  answer: string;
  explanation?: string;
  domain?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  topic?: string;
  serviceTags?: string[];
  status?: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED';
}

export interface ValidatedQuestionInput {
  text: string;
  choices: Record<string, string>;
  answer: string;
  explanation: string;
  domain: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topic: string;
  serviceTags: string[];
  status?: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED';
}

/**
 * Validate a question payload before storing
 */
export function validateQuestionInput(input: QuestionInput): ValidatedQuestionInput {
  const text = (input.text || '').trim();
  if (text.length < 15) {
    throw new Error('Nội dung câu hỏi quá ngắn (tối thiểu 15 ký tự).');
  }

  const choices = input.choices || {};
  const choiceKeys = Object.keys(choices).sort();
  if (choiceKeys.length < 2) {
    throw new Error('Câu hỏi phải có tối thiểu 2 lựa chọn (A, B, ...).');
  }

  for (const k of choiceKeys) {
    if (!choices[k] || !choices[k].trim()) {
      throw new Error(`Nội dung lựa chọn ${k} không được để trống.`);
    }
  }

  const rawAnswer = (input.answer || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!rawAnswer) {
    throw new Error('Đáp án đúng không được để trống.');
  }

  for (const char of rawAnswer) {
    if (!choices[char]) {
      throw new Error(`Đáp án đúng "${char}" không tồn tại trong danh sách lựa chọn.`);
    }
  }

  const cleanAnswer = rawAnswer.split('').sort().join('');

  return {
    text,
    choices,
    answer: cleanAnswer,
    explanation: input.explanation || '',
    domain: input.domain || 'Domain 1: Design Secure Architectures',
    difficulty: input.difficulty || 'Medium',
    topic: input.topic || 'Custom',
    serviceTags: Array.isArray(input.serviceTags) && input.serviceTags.length > 0 ? input.serviceTags : ['AWS General'],
    status: input.status,
  };
}

/**
 * Convert CustomQuestionRecord from database to canonical Question model
 */
export function recordToQuestion(rec: CustomQuestionRecord): Question {
  let choices: Record<string, string> = {};
  let choiceKeys: string[] = [];
  let serviceTags: string[] = [];

  try {
    choices = JSON.parse(rec.choices_json);
    choiceKeys = JSON.parse(rec.choice_keys_json);
  } catch {
    choices = {};
    choiceKeys = [];
  }

  try {
    serviceTags = JSON.parse(rec.service_tags_json);
  } catch {
    serviceTags = ['AWS Custom'];
  }

  return {
    id: 10000 + Number(rec.id), // Offset custom question IDs to not clash with canonical (1 - 1019)
    originalId: `custom_${rec.id}`,
    text: rec.text,
    choices,
    choiceKeys,
    answer: rec.answer,
    answerDescription: rec.explanation_json || '',
    communityVotes: [{ choice: rec.answer, percentage: 100, raw: `${rec.answer} (100%)` }],
    topic: rec.topic || 'Custom',
    serviceTags,
    domain: rec.domain as any,
    difficulty: rec.difficulty as any,
    isMultiSelect: rec.answer.length > 1,
    expectedChoicesCount: rec.answer.length || 1,
  };
}

/**
 * Learner or Admin submits a new question
 */
export async function submitQuestion(
  creatorId: string,
  role: 'LEARNER' | 'ADMIN',
  rawInput: QuestionInput
): Promise<CustomQuestionRecord> {
  const valid = validateQuestionInput(rawInput);
  const now = Date.now();

  const choiceKeys = Object.keys(valid.choices).sort();
  const choicesJson = JSON.stringify(valid.choices);
  const choiceKeysJson = JSON.stringify(choiceKeys);
  const serviceTagsJson = JSON.stringify(valid.serviceTags);

  // If created by ADMIN and requested to be APPROVED, publish directly
  let status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' = 'PENDING_REVIEW';
  let isPrivate = 1;

  if (role === 'ADMIN' && valid.status === 'APPROVED') {
    status = 'APPROVED';
    isPrivate = 0;
  } else if (valid.status === 'DRAFT') {
    status = 'DRAFT';
    isPrivate = 1;
  }

  const row = await dbQueryOne<CustomQuestionRecord>(`
    INSERT INTO custom_questions (
      creator_id, text, choices_json, choice_keys_json, answer,
      explanation_json, domain, difficulty, topic, service_tags_json,
      status, is_private, rejection_reason, source_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, null, ?, ?)
    RETURNING *
  `, [
    creatorId,
    valid.text,
    choicesJson,
    choiceKeysJson,
    valid.answer,
    valid.explanation || null,
    valid.domain,
    valid.difficulty,
    valid.topic,
    serviceTagsJson,
    status,
    isPrivate,
    now,
    now
  ]);

  if (!row) {
    throw new Error('Không thể lưu câu hỏi vào cơ sở dữ liệu.');
  }

  return row;
}

/**
 * Get submissions made by the current learner
 */
export async function getLearnerSubmissions(userId: string): Promise<CustomQuestionRecord[]> {
  const rows = await dbQuery<CustomQuestionRecord>(`
    SELECT * FROM custom_questions
    WHERE creator_id = ?
    ORDER BY created_at DESC
  `, [userId]);
  return rows;
}

/**
 * Admin: Get questions pending moderation review
 */
export async function getPendingReviewQuestions(): Promise<(CustomQuestionRecord & { creator_username: string })[]> {
  const rows = await dbQuery<CustomQuestionRecord & { creator_username: string }>(`
    SELECT q.*, u.username as creator_username
    FROM custom_questions q
    JOIN users u ON q.creator_id = u.id
    WHERE q.status = 'PENDING_REVIEW'
    ORDER BY q.created_at ASC
  `);
  return rows;
}

/**
 * Admin: Approve question -> published to global bank
 */
export async function approveQuestion(questionId: number, adminId: string) {
  const existing = await dbQueryOne('SELECT id, status FROM custom_questions WHERE id = ?', [questionId]);
  if (!existing) throw new Error('Không tìm thấy câu hỏi.');

  const now = Date.now();
  await dbExecute(`
    UPDATE custom_questions
    SET status = 'APPROVED', is_private = 0, rejection_reason = null, updated_at = ?
    WHERE id = ?
  `, [now, questionId]);

  // Audit log
  await dbExecute(`
    INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, metadata_json, created_at)
    VALUES (?, ?, 'QUESTION_APPROVED', 'CUSTOM_QUESTION', ?, null, ?)
  `, [`aud_${crypto.randomUUID().slice(0, 8)}`, adminId, String(questionId), now]);

  return { success: true, status: 'APPROVED', is_private: false };
}

/**
 * Admin: Reject question -> remains private to creator with reason
 */
export async function rejectQuestion(questionId: number, adminId: string, reason: string) {
  const existing = await dbQueryOne('SELECT id, status FROM custom_questions WHERE id = ?', [questionId]);
  if (!existing) throw new Error('Không tìm thấy câu hỏi.');

  const now = Date.now();
  const rejectionReason = (reason || 'Nội dung câu hỏi chưa đạt tiêu chuẩn kiến trúc AWS SAA-C03.').trim();

  await dbExecute(`
    UPDATE custom_questions
    SET status = 'REJECTED', is_private = 1, rejection_reason = ?, updated_at = ?
    WHERE id = ?
  `, [rejectionReason, now, questionId]);

  // Audit log
  await dbExecute(`
    INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, metadata_json, created_at)
    VALUES (?, ?, 'QUESTION_REJECTED', 'CUSTOM_QUESTION', ?, ?, ?)
  `, [`aud_${crypto.randomUUID().slice(0, 8)}`, adminId, String(questionId), JSON.stringify({ reason: rejectionReason }), now]);

  return { success: true, status: 'REJECTED', is_private: true };
}

/**
 * Get custom questions accessible to user:
 * - Approved & public questions (seen by all)
 * - Questions created by this user (even if draft/pending/rejected)
 */
export async function getAccessibleCustomQuestions(userId?: string): Promise<Question[]> {
  let rows: CustomQuestionRecord[] = [];

  if (userId) {
    rows = await dbQuery<CustomQuestionRecord>(`
      SELECT * FROM custom_questions
      WHERE (status = 'APPROVED' AND is_private = 0)
         OR creator_id = ?
      ORDER BY id ASC
    `, [userId]);
  } else {
    rows = await dbQuery<CustomQuestionRecord>(`
      SELECT * FROM custom_questions
      WHERE status = 'APPROVED' AND is_private = 0
      ORDER BY id ASC
    `);
  }

  return rows.map(recordToQuestion);
}

/**
 * Admin: Import questions from generic JSON file/payload
 */
export async function importQuestionsFromJson(
  adminId: string,
  sourceName: string,
  rawJson: unknown
): Promise<{ importedCount: number; sourceId: string }> {
  if (!rawJson || typeof rawJson !== 'object') {
    throw new Error('Dữ liệu JSON không hợp lệ.');
  }

  let items: any[] = [];
  if (Array.isArray(rawJson)) {
    items = rawJson;
  } else if ('questions' in rawJson && Array.isArray((rawJson as any).questions)) {
    items = (rawJson as any).questions;
  } else {
    throw new Error('Không tìm thấy mảng câu hỏi (danh sách hoặc thuộc tính "questions") trong JSON.');
  }

  if (items.length === 0) {
    throw new Error('Mảng câu hỏi rỗng.');
  }

  const sourceId = `src_${crypto.randomUUID().slice(0, 8)}`;
  const now = Date.now();

  let count = 0;

  for (const item of items) {
    try {
      const qText = item.question || item.text || item.prompt;
      if (!qText || String(qText).trim().length < 10) continue;

      let choices: Record<string, string> = {};
      if (item.choices && typeof item.choices === 'object' && !Array.isArray(item.choices)) {
        choices = item.choices;
      } else if (Array.isArray(item.options)) {
        const alphabet = ['A', 'B', 'C', 'D', 'E', 'F'];
        item.options.forEach((opt: string, idx: number) => {
          if (idx < alphabet.length) {
            choices[alphabet[idx]] = String(opt).trim();
          }
        });
      }

      const keys = Object.keys(choices).sort();
      if (keys.length < 2) continue;

      const rawAns = String(item.answer || item.correctAnswer || 'A').toUpperCase().replace(/[^A-Z]/g, '');
      const answer = rawAns || 'A';
      const explanation = item.explanation || item.answer_description || '';
      const domain = item.domain || item.category || 'Domain 1: Design Secure Architectures';
      const difficulty = item.difficulty || 'Medium';
      const topic = item.topic || sourceName || 'Imported';
      const serviceTags = Array.isArray(item.serviceTags) ? item.serviceTags : ['AWS General'];

      await dbExecute(`
        INSERT INTO custom_questions (
          creator_id, text, choices_json, choice_keys_json, answer,
          explanation_json, domain, difficulty, topic, service_tags_json,
          status, is_private, rejection_reason, source_id, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', 0, null, ?, ?, ?)
      `, [
        adminId,
        String(qText).trim(),
        JSON.stringify(choices),
        JSON.stringify(keys),
        answer,
        explanation,
        domain,
        difficulty,
        topic,
        JSON.stringify(serviceTags),
        sourceId,
        now,
        now
      ]);
      count++;
    } catch {
      // Ignore malformed individual question items
    }
  }

  await dbExecute(`
    INSERT INTO question_sources (id, name, description, source_type, question_count, created_by, created_at)
    VALUES (?, ?, ?, 'JSON_IMPORT', ?, ?, ?)
  `, [sourceId, sourceName.trim() || 'Custom Import', `Imported ${count} questions`, count, adminId, now]);

  // Log audit
  await dbExecute(`
    INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, metadata_json, created_at)
    VALUES (?, ?, 'QUESTION_SOURCE_IMPORTED', 'QUESTION_SOURCE', ?, ?, ?)
  `, [`aud_${crypto.randomUUID().slice(0, 8)}`, adminId, sourceId, JSON.stringify({ count, sourceName }), now]);

  return { importedCount: count, sourceId };
}

/**
 * Get all question sources
 */
export async function getQuestionSources() {
  return dbQuery(`
    SELECT s.*, u.username as creator_username
    FROM question_sources s
    LEFT JOIN users u ON s.created_by = u.id
    ORDER BY s.created_at DESC
  `);
}
