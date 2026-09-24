import type { Question, ExamSession, ExamResult, QuestionResult, AWSDomain, DomainScore } from './types';

import { normalizeAnswer } from './questionParser';

export function evaluateAnswer(userAnswer: string, correctAnswer: string): boolean {
  if (!userAnswer || !correctAnswer) return false;
  const normUser = normalizeAnswer(userAnswer);
  const normCorrect = normalizeAnswer(correctAnswer);
  return normUser === normCorrect;
}

export function calculateScaledScore(correct: number, total: number): number {
  if (total <= 0) return 100;
  // AWS Certification scale is 100 - 1000, with 720 required to pass (72%)
  const percentage = correct / total;
  return Math.round(100 + percentage * 900);
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
  const passed = scaledScore >= 720; // AWS standard passing score 720/1000

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
