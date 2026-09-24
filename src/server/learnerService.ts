import crypto from 'node:crypto';
import { dbQuery, dbQueryOne, dbExecute } from './db.js';

export interface NoteItem {
  id: string;
  questionId: number;
  noteText: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProgressItem {
  questionId: number;
  selectedAnswer: string;
  isSubmitted: boolean;
  isCorrect: boolean;
  confidence: string;
  attemptsCount: number;
  lastAttemptedAt: number;
}

/**
 * Get all progress items for a user
 */
export async function getUserStudyProgress(userId: string) {
  const rows = await dbQuery<{
    question_id: number;
    selected_answer: string;
    is_submitted: number;
    is_correct: number;
    confidence: string;
    attempts_count: number;
    last_attempted_at: number;
  }>(`
    SELECT question_id, selected_answer, is_submitted, is_correct, confidence, attempts_count, last_attempted_at
    FROM study_progress
    WHERE user_id = ?
  `, [userId]);

  const items: Record<number, ProgressItem> = {};
  for (const r of rows) {
    items[r.question_id] = {
      questionId: r.question_id,
      selectedAnswer: r.selected_answer,
      isSubmitted: Boolean(r.is_submitted),
      isCorrect: Boolean(r.is_correct),
      confidence: r.confidence || 'medium',
      attemptsCount: Number(r.attempts_count),
      lastAttemptedAt: Number(r.last_attempted_at),
    };
  }

  return { items };
}

/**
 * Save / update single progress item
 */
export async function saveUserStudyProgress(userId: string, item: {
  questionId: number;
  selectedAnswer?: string;
  selectedChoices?: string[];
  isSubmitted?: boolean;
  isCorrect?: boolean;
  confidence?: string;
}) {
  if (!item || typeof item.questionId !== 'number') {
    throw new Error('questionId không hợp lệ.');
  }

  const selectedAnswer = item.selectedAnswer !== undefined
    ? item.selectedAnswer
    : (Array.isArray(item.selectedChoices) ? item.selectedChoices.join('') : '');
  const isSubmitted = item.isSubmitted !== undefined ? (item.isSubmitted ? 1 : 0) : 1;
  const isCorrect = item.isCorrect !== undefined ? (item.isCorrect ? 1 : 0) : 0;
  const confidence = item.confidence || 'medium';

  const now = Date.now();
  await dbExecute(`
    INSERT INTO study_progress (user_id, question_id, selected_answer, is_submitted, is_correct, confidence, attempts_count, last_attempted_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(user_id, question_id) DO UPDATE SET
      selected_answer = excluded.selected_answer,
      is_submitted = excluded.is_submitted,
      is_correct = excluded.is_correct,
      confidence = excluded.confidence,
      attempts_count = study_progress.attempts_count + 1,
      last_attempted_at = excluded.last_attempted_at
  `, [
    userId,
    item.questionId,
    selectedAnswer,
    isSubmitted,
    isCorrect,
    confidence,
    now
  ]);
}

/**
 * Reset single question progress item for user
 */
export async function resetUserQuestionProgress(userId: string, questionId: number): Promise<void> {
  await dbExecute(`
    DELETE FROM study_progress
    WHERE user_id = ? AND question_id = ?
  `, [userId, questionId]);
}

/**
 * Reset all study progress for user
 */
export async function resetUserAllStudyProgress(userId: string): Promise<void> {
  await dbExecute(`
    DELETE FROM study_progress
    WHERE user_id = ?
  `, [userId]);
}

/**
 * Batch import/migrate progress from localStorage to database on first login
 */
export async function migrateLocalProgressToDatabase(
  userId: string,
  progressItems: Record<string, {
    selectedAnswer: string;
    isSubmitted: boolean;
    isCorrect: boolean;
    confidence?: string;
    attemptsCount?: number;
    lastAttemptedAt?: number;
  }>,
  notes: Record<string, { noteText: string; updatedAt?: number }>,
  bookmarks: number[],
  exams?: any[]
) {
  const now = Date.now();

  // Progress items
  if (progressItems && typeof progressItems === 'object') {
    for (const [qIdStr, prog] of Object.entries(progressItems)) {
      const qId = parseInt(qIdStr, 10);
      if (!isNaN(qId)) {
        await dbExecute(`
          INSERT INTO study_progress (user_id, question_id, selected_answer, is_submitted, is_correct, confidence, attempts_count, last_attempted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, question_id) DO UPDATE SET
            selected_answer = excluded.selected_answer,
            is_submitted = excluded.is_submitted,
            is_correct = excluded.is_correct,
            confidence = excluded.confidence,
            attempts_count = max(study_progress.attempts_count, excluded.attempts_count),
            last_attempted_at = max(study_progress.last_attempted_at, excluded.last_attempted_at)
        `, [
          userId,
          qId,
          prog.selectedAnswer || '',
          prog.isSubmitted ? 1 : 0,
          prog.isCorrect ? 1 : 0,
          prog.confidence || 'medium',
          prog.attemptsCount || 1,
          prog.lastAttemptedAt || now
        ]);
      }
    }
  }

  // Notes
  if (notes && typeof notes === 'object') {
    for (const [qIdStr, n] of Object.entries(notes)) {
      const qId = parseInt(qIdStr, 10);
      if (!isNaN(qId) && n.noteText && n.noteText.trim()) {
        const noteId = `note_${crypto.randomUUID().slice(0, 8)}`;
        await dbExecute(`
          INSERT INTO notes (id, user_id, question_id, note_text, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, question_id) DO UPDATE SET
            note_text = excluded.note_text,
            updated_at = excluded.updated_at
        `, [noteId, userId, qId, n.noteText.trim(), n.updatedAt || now, n.updatedAt || now]);
      }
    }
  }

  // Bookmarks
  if (Array.isArray(bookmarks)) {
    for (const b of bookmarks) {
      if (typeof b === 'number') {
        await dbExecute(`
          INSERT INTO bookmarks (user_id, question_id, created_at)
          VALUES (?, ?, ?)
          ON CONFLICT(user_id, question_id) DO NOTHING
        `, [userId, b, now]);
      }
    }
  }

  // Exam attempts
  if (Array.isArray(exams)) {
    for (const ex of exams) {
      if (ex && typeof ex === 'object' && typeof ex.scorePercent === 'number') {
        try {
          await saveUserExamAttempt(userId, ex);
        } catch {
          // Ignore duplicate exam attempt
        }
      }
    }
  }
}

/**
 * Get all notes for user
 */
export async function getUserNotes(userId: string) {
  const rows = await dbQuery<{
    id: string;
    question_id: number;
    note_text: string;
    created_at: number;
    updated_at: number;
  }>(`
    SELECT id, question_id, note_text, created_at, updated_at
    FROM notes
    WHERE user_id = ?
    ORDER BY updated_at DESC
  `, [userId]);

  const notesMap: Record<number, { questionId: number; noteText: string; updatedAt: number; id: string }> = {};
  for (const r of rows) {
    notesMap[r.question_id] = {
      id: r.id,
      questionId: r.question_id,
      noteText: r.note_text,
      updatedAt: Number(r.updated_at),
    };
  }

  return { notes: notesMap, list: rows };
}

/**
 * Save note for a question
 */
export async function saveUserNote(userId: string, questionId: number, noteText: string) {
  const trimmed = (noteText || '').trim();
  const now = Date.now();

  if (!trimmed) {
    await dbExecute('DELETE FROM notes WHERE user_id = ? AND question_id = ?', [userId, questionId]);
    return { success: true, deleted: true };
  }

  const noteId = `note_${crypto.randomUUID().slice(0, 8)}`;
  await dbExecute(`
    INSERT INTO notes (id, user_id, question_id, note_text, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, question_id) DO UPDATE SET
      note_text = excluded.note_text,
      updated_at = excluded.updated_at
  `, [noteId, userId, questionId, trimmed, now, now]);

  return { success: true, questionId, noteText: trimmed, updatedAt: now };
}

/**
 * Delete note
 */
export async function deleteUserNote(userId: string, questionId: number) {
  await dbExecute('DELETE FROM notes WHERE user_id = ? AND question_id = ?', [userId, questionId]);
  return { success: true };
}

/**
 * Get user exam history
 */
export async function getUserExamHistory(userId: string) {
  return dbQuery(`
    SELECT id, date, score_percent as "scorePercent", scaled_score as "scaledScore", passed,
           total_questions as "totalQuestions", correct_count as "correctCount",
           incorrect_count as "incorrectCount", unanswered_count as "unansweredCount",
           time_used_seconds as "timeUsedSeconds", exam_type as "examType", created_at as "createdAt"
    FROM exam_attempts
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `, [userId]);
}

/**
 * Save exam attempt
 */
export async function saveUserExamAttempt(userId: string, attempt: {
  id?: string;
  date: string;
  scorePercent: number;
  scaledScore: number;
  passed: boolean;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  timeUsedSeconds: number;
  examType?: string;
  questionResults?: Array<{
    questionId: number;
    userAnswer: string;
    isCorrect: boolean;
  }>;
}) {
  const id = attempt.id || `exam_${crypto.randomUUID().slice(0, 8)}`;
  const now = Date.now();

  await dbExecute(`
    INSERT INTO exam_attempts (id, user_id, date, score_percent, scaled_score, passed, total_questions, correct_count, incorrect_count, unanswered_count, time_used_seconds, exam_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      score_percent = excluded.score_percent,
      scaled_score = excluded.scaled_score,
      passed = excluded.passed
  `, [
    id,
    userId,
    attempt.date,
    attempt.scorePercent,
    attempt.scaledScore,
    attempt.passed ? 1 : 0,
    attempt.totalQuestions,
    attempt.correctCount,
    attempt.incorrectCount,
    attempt.unansweredCount,
    attempt.timeUsedSeconds,
    attempt.examType || 'SAA-C03 Simulation',
    now
  ]);

  // If questionResults is provided, also sync each answered question into study_progress
  if (Array.isArray(attempt.questionResults) && attempt.questionResults.length > 0) {
    for (const qr of attempt.questionResults) {
      if (qr.userAnswer && qr.userAnswer.trim()) {
        await dbExecute(`
          INSERT INTO study_progress (user_id, question_id, selected_answer, is_submitted, is_correct, confidence, attempts_count, last_attempted_at)
          VALUES (?, ?, ?, 1, ?, 'medium', 1, ?)
          ON CONFLICT(user_id, question_id) DO UPDATE SET
            selected_answer = excluded.selected_answer,
            is_submitted = 1,
            is_correct = excluded.is_correct,
            attempts_count = study_progress.attempts_count + 1,
            last_attempted_at = max(study_progress.last_attempted_at, excluded.last_attempted_at)
        `, [userId, qr.questionId, qr.userAnswer, qr.isCorrect ? 1 : 0, now]);
      }
    }
  }

  return { id, success: true };
}

/**
 * Get user bookmarks
 */
export async function getUserBookmarks(userId: string): Promise<number[]> {
  const rows = await dbQuery<{ question_id: number }>('SELECT question_id FROM bookmarks WHERE user_id = ?', [userId]);
  return rows.map(r => r.question_id);
}

/**
 * Toggle bookmark
 */
export async function toggleUserBookmark(userId: string, questionId: number): Promise<{ isBookmarked: boolean }> {
  const existing = await dbQueryOne('SELECT 1 FROM bookmarks WHERE user_id = ? AND question_id = ?', [userId, questionId]);
  if (existing) {
    await dbExecute('DELETE FROM bookmarks WHERE user_id = ? AND question_id = ?', [userId, questionId]);
    return { isBookmarked: false };
  } else {
    await dbExecute('INSERT INTO bookmarks (user_id, question_id, created_at) VALUES (?, ?, ?) ON CONFLICT (user_id, question_id) DO NOTHING', [userId, questionId, Date.now()]);
    return { isBookmarked: true };
  }
}
