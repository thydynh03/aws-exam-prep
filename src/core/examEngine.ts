import type { Question, ExamSession, ExamResult, QuestionResult, AWSDomain, DomainScore } from './types';

import { normalizeAnswer } from './questionParser';

export function evaluateAnswer(userAnswer: string, correctAnswer: string): boolean {
  if (!userAnswer || !correctAnswer) return false;
  const normUser = normalizeAnswer(userAnswer);
  const normCorrect = normalizeAnswer(correctAnswer);
  return normUser === normCorrect;
}

/** Tỉ lệ câu đúng được coi là ngưỡng đậu khi quy đổi (720/1000). */
export const PASS_RATIO = 0.72;
export const PASSING_SCALED_SCORE = 720;

/**
 * Quy đổi số câu đúng sang thang 100–1000 (ước lượng).
 * AWS không công bố công thức: họ điều chỉnh theo độ khó từng đề. Ở đây dùng hai
 * đoạn thẳng nối 0% → 100, 72% → 720, 100% → 1000 để mốc 720 khớp đúng 72% câu đúng.
 */
export function calculateScaledScore(correct: number, total: number): number {
  if (total <= 0) return 100;
  const ratio = Math.min(1, Math.max(0, correct / total));
  if (ratio <= PASS_RATIO) {
    return Math.round(100 + (ratio / PASS_RATIO) * (PASSING_SCALED_SCORE - 100));
  }
  return Math.round(PASSING_SCALED_SCORE + ((ratio - PASS_RATIO) / (1 - PASS_RATIO)) * (1000 - PASSING_SCALED_SCORE));
}

/** Đề thật SAA-C03: 65 câu, 50 câu tính điểm, 15 câu thử nghiệm không tính điểm. */
export const REAL_EXAM_TOTAL = 65;
export const REAL_EXAM_UNSCORED = 15;

export interface RealExamSimulation {
  scoredQuestions: number;
  unscoredQuestions: number;
  /** Khoảng điểm 90% (phân vị 5–95) khi 15 câu ngẫu nhiên bị loại khỏi điểm */
  minScaledScore: number;
  maxScaledScore: number;
  medianScaledScore: number;
  /** Xác suất đậu (0..1) trên các lần mô phỏng */
  passProbability: number;
  trials: number;
}

/**
 * Mô phỏng cách chấm thật: chọn ngẫu nhiên 15 câu không tính điểm, chấm 50 câu còn lại,
 * lặp nhiều lần để ra khoảng điểm. Chỉ áp dụng cho đề đủ 65 câu.
 */
export function simulateRealExamScoring(
  correctFlags: boolean[],
  trials = 2000,
  random: () => number = Math.random
): RealExamSimulation | undefined {
  const total = correctFlags.length;
  if (total !== REAL_EXAM_TOTAL) return undefined;
  const scored = total - REAL_EXAM_UNSCORED;
  const scores: number[] = [];
  let passes = 0;
  const idx = correctFlags.map((_, i) => i);
  for (let t = 0; t < trials; t++) {
    // Fisher–Yates một phần: lấy 50 câu đầu sau khi xáo trộn
    for (let i = 0; i < scored; i++) {
      const j = i + Math.floor(random() * (total - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    let correct = 0;
    for (let i = 0; i < scored; i++) if (correctFlags[idx[i]]) correct++;
    const score = calculateScaledScore(correct, scored);
    scores.push(score);
    if (score >= PASSING_SCALED_SCORE) passes++;
  }
  scores.sort((a, b) => a - b);
  const pick = (q: number) => scores[Math.min(scores.length - 1, Math.floor(q * scores.length))];
  return {
    scoredQuestions: scored,
    unscoredQuestions: REAL_EXAM_UNSCORED,
    minScaledScore: pick(0.05),
    maxScaledScore: pick(0.95),
    medianScaledScore: pick(0.5),
    passProbability: passes / trials,
    trials,
  };
}

export function calculateExamResult(
  session: ExamSession,
  questions: Question[],
  totalExamDurationSeconds: number
): ExamResult {
  const qMap = new Map<number, Question>();
  for (const q of questions) {
    qMap.set(q.id, q);
  }

  const questionResults: QuestionResult[] = [];
  let correctCount = 0;
  let answeredCount = 0;

  for (const qId of session.questionIds) {
    const q = qMap.get(qId);
    const userAns = session.answers[qId] || '';
    const correctAns = q ? q.answer : '';
    const isAnswered = userAns.trim().length > 0;

    if (isAnswered) {
      answeredCount++;
    }

    const isCorrect = isAnswered && evaluateAnswer(userAns, correctAns);
    if (isCorrect) {
      correctCount++;
    }

    const domain = q?.domain || 'Domain 1: Design Secure Architectures';

    questionResults.push({
      questionId: qId,
      userAnswer: normalizeAnswer(userAns),
      correctAnswer: normalizeAnswer(correctAns),
      isCorrect,
      wasMarked: !!session.markedForReview[qId],
      domain,
    });
  }

  const totalQuestions = session.questionIds.length;
  const unansweredCount = totalQuestions - answeredCount;
  const incorrectCount = answeredCount - correctCount;
  const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const scaledScore = calculateScaledScore(correctCount, totalQuestions);
  const passed = scaledScore >= PASSING_SCALED_SCORE;

  const timeUsedSeconds = Math.max(0, totalExamDurationSeconds - session.timeRemainingSeconds);

  // Compute Domain Scores
  const allDomains: AWSDomain[] = [
    'Domain 1: Design Secure Architectures',
    'Domain 2: Design Resilient Architectures',
    'Domain 3: Design High-Performing Architectures',
    'Domain 4: Design Cost-Optimized Architectures',
  ];
  const domainScoreMap = new Map<AWSDomain, { total: number; correct: number }>();
  for (const d of allDomains) {
    domainScoreMap.set(d, { total: 0, correct: 0 });
  }
  for (const qr of questionResults) {
    const entry = domainScoreMap.get(qr.domain);
    if (entry) {
      entry.total += 1;
      if (qr.isCorrect) entry.correct += 1;
    }
  }
  const domainScores: DomainScore[] = allDomains.map((d) => {
    const entry = domainScoreMap.get(d)!;
    const sPercent = entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0;
    return {
      domain: d,
      total: entry.total,
      correct: entry.correct,
      scorePercent: sPercent,
    };
  });

  return {
    id: `result_${session.id}_${Date.now()}`,
    sessionId: session.id,
    date: new Date().toISOString(),
    totalQuestions,
    answeredCount,
    correctCount,
    incorrectCount,
    unansweredCount,
    scorePercent,
    scaledScore,
    passed,
    timeUsedSeconds,
    questionResults,
    domainScores,
  };
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}
