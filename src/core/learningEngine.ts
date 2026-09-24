import type { 
  Question, 
  AWSDomain, 
  MasteryStatus, 
  StudyProgress, 
  ExamAttemptRecord 
} from './types';
import { storage } from './storage';

export interface DomainMasteryStats {
  domain: AWSDomain;
  totalQuestions: number;
  attemptedQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  accuracyRate: number; // 0 to 100
  masteredCount: number;
  learningCount: number;
}

export interface ServiceMasteryStats {
  serviceTag: string;
  totalQuestions: number;
  attemptedQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  errorRate: number; // 0 to 100
}

export interface RiskItem {
  questionId: number;
  question: Question;
  riskType: 'dangerous_misconception' | 'fragile_knowledge' | 'repeated_failure';
  reason: string;
  confidence?: string;
  attemptsCount: number;
}

export interface ExamReadinessReport {
  readinessPercent: number; // 0 to 100
  estimatedScaledScore: number; // 100 to 1000
  passLikelihood: 'Very Low' | 'Low' | 'Moderate' | 'High' | 'Exam Ready';
  totalQuestionsAvailable: number;
  totalAttempted: number;
  totalMastered: number;
  dangerousMisconceptionsCount: number;
  fragileKnowledgeCount: number;
  domainStats: DomainMasteryStats[];
  topWeakServices: ServiceMasteryStats[];
  recommendations: string[];
}

export const LEITNER_INTERVALS_DAYS = [1, 3, 7, 14, 30];

export function calculateNextReviewInterval(currentBox: number, rating: 'again' | 'hard' | 'good' | 'easy'): { nextBox: number; nextDueTimestamp: number } {
  let nextBox = currentBox;
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  switch (rating) {
    case 'again':
      nextBox = 1;
      return { nextBox, nextDueTimestamp: now + ONE_DAY_MS };
    case 'hard':
      nextBox = Math.max(1, currentBox);
      return { nextBox, nextDueTimestamp: now + ONE_DAY_MS };
    case 'good':
      nextBox = Math.min(5, currentBox + 1);
      const days = LEITNER_INTERVALS_DAYS[nextBox - 1] || 7;
      return { nextBox, nextDueTimestamp: now + days * ONE_DAY_MS };
    case 'easy':
      nextBox = Math.min(5, currentBox + 2);
      const easyDays = LEITNER_INTERVALS_DAYS[nextBox - 1] || 14;
      return { nextBox, nextDueTimestamp: now + easyDays * ONE_DAY_MS };
  }
}

export function evaluateQuestionMastery(attemptsCount: number, isCorrect: boolean, confidence?: string): MasteryStatus {
  if (attemptsCount === 0) return 'NEW';
  if (!isCorrect) return 'LEARNING';
  if (confidence === 'high' && attemptsCount >= 2) return 'MASTERED';
  if (confidence === 'high' && attemptsCount === 1) return 'REVIEW';
  if (confidence === 'medium') return 'REVIEW';
  return 'LEARNING'; // guessing or low confidence even if correct
}

export function analyzeLearningRisks(allQuestions: Question[], studyProgress: StudyProgress): RiskItem[] {
  const risks: RiskItem[] = [];
  const questionMap = new Map(allQuestions.map((q) => [q.id, q]));

  for (const [idStr, item] of Object.entries(studyProgress.items)) {
    const qId = Number(idStr);
    const q = questionMap.get(qId);
    if (!q) continue;

    // Dangerous Misconception: Confident, but Wrong!
    if (!item.isCorrect && (item.confidence === 'high' || item.confidence === 'medium')) {
      risks.push({
        questionId: qId,
        question: q,
        riskType: 'dangerous_misconception',
        reason: `Marked with "${item.confidence?.toUpperCase()}" confidence but selected an incorrect answer. High exam trap hazard!`,
        confidence: item.confidence,
        attemptsCount: item.attemptsCount,
      });
    }
    // Fragile Knowledge: Correct, but Guessed or Low Confidence
    else if (item.isCorrect && (item.confidence === 'guessing' || item.confidence === 'low')) {
      risks.push({
        questionId: qId,
        question: q,
        riskType: 'fragile_knowledge',
        reason: `Answered correctly through "${item.confidence?.toUpperCase()}" confidence. Lucky guess that requires conceptual reinforcement.`,
        confidence: item.confidence,
        attemptsCount: item.attemptsCount,
      });
    }
    // Repeated Failure
    else if (!item.isCorrect && item.attemptsCount >= 2) {
      risks.push({
        questionId: qId,
        question: q,
        riskType: 'repeated_failure',
        reason: `Failed ${item.attemptsCount} times. Core concept needs review.`,
        confidence: item.confidence,
        attemptsCount: item.attemptsCount,
      });
    }
  }

  return risks;
}

export function calculateDomainMastery(allQuestions: Question[], studyProgress: StudyProgress): DomainMasteryStats[] {
  const domainMap = new Map<AWSDomain, {
    total: number;
    attempted: number;
    correct: number;
    incorrect: number;
    mastered: number;
    learning: number;
  }>();

  // Initialize domains
  const domains: AWSDomain[] = [
    'Domain 1: Design Secure Architectures',
    'Domain 2: Design Resilient Architectures',
    'Domain 3: Design High-Performing Architectures',
    'Domain 4: Design Cost-Optimized Architectures',
  ];

  for (const d of domains) {
    domainMap.set(d, { total: 0, attempted: 0, correct: 0, incorrect: 0, mastered: 0, learning: 0 });
  }

  for (const q of allQuestions) {
    const stat = domainMap.get(q.domain);
    if (!stat) continue;
    stat.total += 1;

    const progress = studyProgress.items[q.id];
    if (progress && progress.attemptsCount > 0) {
      stat.attempted += 1;
      if (progress.isCorrect) {
        stat.correct += 1;
      } else {
        stat.incorrect += 1;
      }

      const mastery = evaluateQuestionMastery(progress.attemptsCount, progress.isCorrect, progress.confidence);
      if (mastery === 'MASTERED') stat.mastered += 1;
      else if (mastery === 'LEARNING') stat.learning += 1;
    }
  }

  return domains.map((d) => {
    const s = domainMap.get(d)!;
    const accuracyRate = s.attempted > 0 ? Math.round((s.correct / s.attempted) * 100) : 0;
    return {
      domain: d,
      totalQuestions: s.total,
      attemptedQuestions: s.attempted,
      correctAnswers: s.correct,
      incorrectAnswers: s.incorrect,
      accuracyRate,
      masteredCount: s.mastered,
      learningCount: s.learning,
    };
  });
}

export function calculateServiceWeaknesses(allQuestions: Question[], studyProgress: StudyProgress): ServiceMasteryStats[] {
  const serviceMap = new Map<string, {
    total: number;
    attempted: number;
    correct: number;
    incorrect: number;
  }>();

  for (const q of allQuestions) {
    for (const tag of q.serviceTags) {
      const cleanTag = tag.toUpperCase();
      if (!serviceMap.has(cleanTag)) {
        serviceMap.set(cleanTag, { total: 0, attempted: 0, correct: 0, incorrect: 0 });
      }
      const s = serviceMap.get(cleanTag)!;
      s.total += 1;

      const p = studyProgress.items[q.id];
      if (p && p.attemptsCount > 0) {
        s.attempted += 1;
        if (p.isCorrect) s.correct += 1;
        else s.incorrect += 1;
      }
    }
  }

  const list: ServiceMasteryStats[] = [];
  for (const [tag, s] of serviceMap.entries()) {
    if (s.attempted >= 2) {
      const errorRate = Math.round((s.incorrect / s.attempted) * 100);
      list.push({
        serviceTag: tag,
        totalQuestions: s.total,
        attemptedQuestions: s.attempted,
        correctAnswers: s.correct,
        incorrectAnswers: s.incorrect,
        errorRate,
      });
    }
  }

  // Sort by highest error rate first, then by attempted count
  return list.sort((a, b) => b.errorRate - a.errorRate || b.attemptedQuestions - a.attemptedQuestions);
}

export function calculateExamReadiness(
  allQuestions: Question[],
  studyProgress: StudyProgress,
  examHistory: ExamAttemptRecord[]
): ExamReadinessReport {
  const totalQuestions = allQuestions.length;
  const domainStats = calculateDomainMastery(allQuestions, studyProgress);
  const serviceWeaknesses = calculateServiceWeaknesses(allQuestions, studyProgress);
  const risks = analyzeLearningRisks(allQuestions, studyProgress);

  let totalAttempted = 0;
  let totalMastered = 0;
  for (const ds of domainStats) {
    totalAttempted += ds.attemptedQuestions;
    totalMastered += ds.masteredCount;
  }

  const dangerousMisconceptions = risks.filter((r) => r.riskType === 'dangerous_misconception');
  const fragileKnowledge = risks.filter((r) => r.riskType === 'fragile_knowledge');

  // Calculate Readiness Percent (0..100)
  // 1. Coverage Component (up to 30 pts): 100% when at least 250 unique questions attempted
  const coverageRatio = Math.min(1, totalAttempted / 250);
  const coverageScore = coverageRatio * 30;

  // 2. Accuracy Component (up to 40 pts): weighted accuracy across all attempted
  let totalCorrect = 0;
  for (const ds of domainStats) totalCorrect += ds.correctAnswers;
  const overallAccuracy = totalAttempted > 0 ? totalCorrect / totalAttempted : 0;
  const accuracyScore = overallAccuracy * 40;

  // 3. Timed Exam Simulator Component (up to 30 pts)
  let examScore = 0;
  if (examHistory.length > 0) {
    const recentScores = examHistory.slice(0, 3).map((h) => h.scaledScore);
    const avgRecent = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    // Scaled 100 to 1000; pass is 720
    examScore = Math.max(0, Math.min(30, ((avgRecent - 100) / 900) * 30));
  } else {
    // If no full exams taken yet, cap readiness at 70%
    examScore = coverageRatio * 10;
  }

  // Penalties for dangerous misconceptions
  const penalty = Math.min(15, dangerousMisconceptions.length * 1.5);
  const readinessPercent = Math.max(0, Math.min(100, Math.round(coverageScore + accuracyScore + examScore - penalty)));

  // Scaled Score estimate (100 - 1000)
  const estimatedScaledScore = Math.round(100 + (readinessPercent / 100) * 900);

  let passLikelihood: ExamReadinessReport['passLikelihood'] = 'Very Low';
  if (readinessPercent >= 85) passLikelihood = 'Exam Ready';
  else if (readinessPercent >= 72) passLikelihood = 'High';
  else if (readinessPercent >= 55) passLikelihood = 'Moderate';
  else if (readinessPercent >= 35) passLikelihood = 'Low';

  // Generate actionable recommendations
  const recommendations: string[] = [];
  if (dangerousMisconceptions.length > 0) {
    recommendations.push(`Urgent: You have ${dangerousMisconceptions.length} Dangerous Misconception(s) (high confidence + wrong answer). Clear these first!`);
  }
  if (fragileKnowledge.length > 0) {
    recommendations.push(`Reinforce ${fragileKnowledge.length} Fragile Knowledge question(s) answered by guessing.`);
  }

  const topWeakest = serviceWeaknesses.filter((s) => s.errorRate >= 40).slice(0, 2);
  for (const ws of topWeakest) {
    recommendations.push(`Weak Topic: ${ws.serviceTag} has a ${ws.errorRate}% error rate over ${ws.attemptedQuestions} questions. Drill this topic in Study Mode.`);
  }

  if (examHistory.length === 0) {
    recommendations.push('Take your first full 65-Question / 130-Minute Timed Exam Simulator to benchmark your exam stamina and pacing.');
  } else if (readinessPercent >= 72) {
    recommendations.push('Your readiness is above the 720 passing mark! Do a 20-question Trap Flashcards review before scheduling your test.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue daily practice questions to maintain your streak and review any marked bookmarks.');
  }

  return {
    readinessPercent,
    estimatedScaledScore,
    passLikelihood,
    totalQuestionsAvailable: totalQuestions,
    totalAttempted,
    totalMastered,
    dangerousMisconceptionsCount: dangerousMisconceptions.length,
    fragileKnowledgeCount: fragileKnowledge.length,
    domainStats,
    topWeakServices: serviceWeaknesses.slice(0, 5),
    recommendations,
  };
}

export function recordStudyAttempt(questionId: number, isCorrect: boolean, confidence?: string): void {
  storage.incrementDailyActivity(1);
  const profile = storage.getLearningProfile();
  const existing = profile.questionMastery[questionId] || {
    status: 'NEW' as MasteryStatus,
    attempts: 0,
    correctCount: 0,
    incorrectCount: 0,
    lastAttemptedAt: 0,
  };

  existing.attempts += 1;
  if (isCorrect) {
    existing.correctCount += 1;
  } else {
    existing.incorrectCount += 1;
  }
  existing.lastAttemptedAt = Date.now();
  if (confidence) {
    existing.lastConfidence = confidence as any;
  }
  existing.status = evaluateQuestionMastery(existing.attempts, isCorrect, confidence);

  profile.questionMastery[questionId] = existing;
  storage.saveLearningProfile(profile);
}
