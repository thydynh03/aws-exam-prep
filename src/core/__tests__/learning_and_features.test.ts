import { describe, it, expect } from 'vitest';
import { 
  calculateNextReviewInterval, 
  evaluateQuestionMastery, 
  analyzeLearningRisks,
  calculateDomainMastery,
  calculateExamReadiness
} from '../learningEngine';
import { 
  getAllServices, 
  getServiceById, 
  searchServices, 
  getAllComparisons, 
  getComparisonById 
} from '../serviceDatabase';
import { 
  getAllFlashcards, 
  getFlashcardsByDeck 
} from '../flashcardDatabase';
import { storage } from '../storage';
import { questionRepository } from '../questionRepository';
import type { StudyProgress } from '../types';

describe('Learning Engine', () => {
  it('correctly calculates Leitner box transitions and review intervals', () => {
    // Again: resets to box 1
    const resAgain = calculateNextReviewInterval(3, 'again');
    expect(resAgain.nextBox).toBe(1);

    // Hard: stays in current box
    const resHard = calculateNextReviewInterval(3, 'hard');
    expect(resHard.nextBox).toBe(3);

    // Good: advances +1 box, max 5
    const resGood = calculateNextReviewInterval(2, 'good');
    expect(resGood.nextBox).toBe(3);
    const resGoodMax = calculateNextReviewInterval(5, 'good');
    expect(resGoodMax.nextBox).toBe(5);

    // Easy: advances +2 boxes, max 5
    const resEasy = calculateNextReviewInterval(2, 'easy');
    expect(resEasy.nextBox).toBe(4);
    const resEasyMax = calculateNextReviewInterval(4, 'easy');
    expect(resEasyMax.nextBox).toBe(5);
  });

  it('correctly classifies Question Mastery status', () => {
    expect(evaluateQuestionMastery(0, false)).toBe('NEW');
    expect(evaluateQuestionMastery(1, false, 'high')).toBe('LEARNING');
    expect(evaluateQuestionMastery(1, true, 'guessing')).toBe('LEARNING');
    expect(evaluateQuestionMastery(1, true, 'medium')).toBe('REVIEW');
    expect(evaluateQuestionMastery(1, true, 'high')).toBe('REVIEW');
    expect(evaluateQuestionMastery(2, true, 'high')).toBe('MASTERED');
  });

  it('detects Dangerous Misconceptions and Fragile Knowledge', () => {
    const sampleQuestions = questionRepository.getStandard32Questions();
    const q1 = sampleQuestions[0];
    const q2 = sampleQuestions[1];

    const mockProgress: StudyProgress = {
      currentIndex: 0,
      items: {
        [q1.id]: {
          selectedAnswer: 'A',
          isSubmitted: true,
          isCorrect: false, // Confident but WRONG
          confidence: 'high',
          attemptsCount: 1,
          lastAttemptedAt: Date.now(),
        },
        [q2.id]: {
          selectedAnswer: 'B',
          isSubmitted: true,
          isCorrect: true, // Guessed but CORRECT
          confidence: 'guessing',
          attemptsCount: 1,
          lastAttemptedAt: Date.now(),
        },
      },
    };

    const risks = analyzeLearningRisks(sampleQuestions, mockProgress);
    const dangerous = risks.find((r) => r.riskType === 'dangerous_misconception');
    const fragile = risks.find((r) => r.riskType === 'fragile_knowledge');

    expect(dangerous).toBeDefined();
    expect(dangerous?.questionId).toBe(q1.id);

    expect(fragile).toBeDefined();
    expect(fragile?.questionId).toBe(q2.id);
  });

  it('computes domain mastery statistics across 4 AWS blueprint domains', () => {
    const allQuestions = questionRepository.getAllQuestions();
    const mockProgress: StudyProgress = {
      currentIndex: 0,
      items: {},
    };

    const domainStats = calculateDomainMastery(allQuestions, mockProgress);
    expect(domainStats.length).toBe(4);
    expect(domainStats[0].domain).toContain('Domain 1');
    expect(domainStats[1].domain).toContain('Domain 2');
    expect(domainStats[2].domain).toContain('Domain 3');
    expect(domainStats[3].domain).toContain('Domain 4');

    const totalCalculated = domainStats.reduce((acc, d) => acc + d.totalQuestions, 0);
    expect(totalCalculated).toBe(allQuestions.length);
  });

  it('computes Exam Readiness score and recommendations', () => {
    const allQuestions = questionRepository.getAllQuestions();
    const report = calculateExamReadiness(allQuestions, { currentIndex: 0, items: {} }, []);

    expect(report.readinessPercent).toBeGreaterThanOrEqual(0);
    expect(report.readinessPercent).toBeLessThanOrEqual(100);
    expect(report.estimatedScaledScore).toBeGreaterThanOrEqual(100);
    expect(report.estimatedScaledScore).toBeLessThanOrEqual(1000);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});

describe('AWS Service Database', () => {
  it('retrieves all services with complete metadata', () => {
    const services = getAllServices();
    expect(services.length).toBeGreaterThan(10);

    for (const s of services) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.category).toBeTruthy();
      expect(s.summary).toBeTruthy();
      expect(s.coreConcepts.length).toBeGreaterThan(0);
      expect(s.examRelevance).toBeTruthy();
      expect(s.docsUrl).toContain('https://');
    }
  });

  it('looks up services by ID and abbreviation', () => {
    const s3 = getServiceById('s3');
    expect(s3).toBeDefined();
    expect(s3?.name).toBe('Amazon S3');

    const ec2 = getServiceById('EC2');
    expect(ec2).toBeDefined();
    expect(ec2?.category).toBe('Compute');
  });

  it('searches services with keyword query', () => {
    const results = searchServices('serverless');
    expect(results.length).toBeGreaterThan(0);
    const hasLambda = results.some((r) => r.id === 'lambda');
    expect(hasLambda).toBe(true);
  });

  it('retrieves architectural comparisons', () => {
    const comparisons = getAllComparisons();
    expect(comparisons.length).toBeGreaterThanOrEqual(5);

    const s3Comp = getComparisonById('s3-vs-ebs-vs-efs');
    expect(s3Comp).toBeDefined();
    expect(s3Comp?.services).toContain('Amazon S3');
    expect(s3Comp?.services).toContain('Amazon EBS');
    expect(s3Comp?.services).toContain('Amazon EFS');
    expect(s3Comp?.examTip).toBeTruthy();
    expect(s3Comp?.commonTrap).toBeTruthy();
  });
});

describe('Flashcard Database', () => {
  it('retrieves flashcards across all 4 decks', () => {
    const allCards = getAllFlashcards();
    expect(allCards.length).toBeGreaterThanOrEqual(10);

    const servicesDeck = getFlashcardsByDeck('services');
    expect(servicesDeck.length).toBeGreaterThan(0);

    const domainsDeck = getFlashcardsByDeck('domains');
    expect(domainsDeck.length).toBeGreaterThan(0);

    const trapsDeck = getFlashcardsByDeck('traps');
    expect(trapsDeck.length).toBeGreaterThan(0);

    const comparisonsDeck = getFlashcardsByDeck('comparisons');
    expect(comparisonsDeck.length).toBeGreaterThan(0);
  });
});

describe('Persistent Storage Extensions', () => {
  it('handles personal notes lifecycle (save, get, delete)', () => {
    const qId = 99999;
    storage.saveNote(qId, 'Remember: S3 Transfer Acceleration requires public endpoints');
    const note = storage.getNote(qId);
    expect(note).toBeDefined();
    expect(note?.noteText).toContain('S3 Transfer Acceleration');

    storage.deleteNote(qId);
    expect(storage.getNote(qId)).toBeNull();
  });

  it('handles flashcard review state saving', () => {
    const cardId = 'test-card-1';
    storage.saveFlashcardReview(cardId, 3, Date.now() + 7 * 24 * 3600 * 1000);
    const progress = storage.getFlashcardProgress();
    expect(progress[cardId]).toBeDefined();
    expect(progress[cardId].box).toBe(3);
    expect(progress[cardId].reviewsCount).toBe(1);
  });

  it('tracks learning profile and daily streak', () => {
    const profile = storage.getLearningProfile();
    expect(profile).toBeDefined();
    expect(profile.streakDays).toBeGreaterThanOrEqual(1);

    storage.incrementDailyActivity(2);
    const updated = storage.getLearningProfile();
    expect(updated.todayCompletedCount).toBeGreaterThanOrEqual(2);
  });

  it('resets progress for a single question or entire study session', () => {
    storage.saveStudyProgress({
      currentIndex: 2,
      items: {
        101: {
          selectedAnswer: 'A',
          isSubmitted: true,
          isCorrect: true,
          attemptsCount: 1,
          lastAttemptedAt: Date.now(),
        },
        102: {
          selectedAnswer: 'B',
          isSubmitted: true,
          isCorrect: false,
          attemptsCount: 1,
          lastAttemptedAt: Date.now(),
        },
      },
    });

    let progress = storage.getStudyProgress();
    expect(progress.items[101]).toBeDefined();
    expect(progress.items[102]).toBeDefined();

    // Reset single question 101
    storage.resetQuestionProgress(101);
    progress = storage.getStudyProgress();
    expect(progress.items[101]).toBeUndefined();
    expect(progress.items[102]).toBeDefined();

    // Reset all study progress
    storage.resetStudyProgress();
    progress = storage.getStudyProgress();
    expect(Object.keys(progress.items).length).toBe(0);
  });
});
