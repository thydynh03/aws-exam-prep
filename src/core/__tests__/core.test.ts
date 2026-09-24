import { describe, it, expect, beforeEach } from 'vitest';
import { questionRepository } from '../questionRepository';
import { evaluateAnswer, calculateScaledScore, calculateExamResult, formatTime } from '../examEngine';
import { normalizeAnswer, parseQuestion } from '../questionParser';
import { storage } from '../storage';
import type { ExamSession, RawQuestion } from '../types';


describe('Data Layer & Question Repository', () => {
  it('loads all 1019 questions correctly', () => {
    const allQuestions = questionRepository.getAllQuestions();
    expect(allQuestions.length).toBe(1019);
  });

  it('standard 32 set contains exactly 32 questions with IDs 1 to 32', () => {
    const standard32 = questionRepository.getStandard32Questions();
    expect(standard32.length).toBe(32);
    for (let i = 0; i < 32; i++) {
      expect(standard32[i].id).toBe(i + 1);
      expect(standard32[i].text.length).toBeGreaterThan(10);
      expect(standard32[i].choiceKeys.length).toBeGreaterThanOrEqual(4);
      expect(standard32[i].answer.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('AWS Associate standard 65-question set strictly follows SAA-C03 content domain ratios', () => {
    const set65Sequential = questionRepository.get65AssociateQuestions(false);
    expect(set65Sequential.length).toBe(65);
    const seqUniqueIds = new Set(set65Sequential.map((q) => q.id));
    expect(seqUniqueIds.size).toBe(65);

    const seqCounts: Record<string, number> = {};
    for (const q of set65Sequential) seqCounts[q.domain] = (seqCounts[q.domain] || 0) + 1;
    expect(seqCounts['Domain 1: Design Secure Architectures']).toBe(20);
    expect(seqCounts['Domain 2: Design Resilient Architectures']).toBe(17);
    expect(seqCounts['Domain 3: Design High-Performing Architectures']).toBe(15);
    expect(seqCounts['Domain 4: Design Cost-Optimized Architectures']).toBe(13);

    const set65Random = questionRepository.get65AssociateQuestions(true);
    expect(set65Random.length).toBe(65);
    const randUniqueIds = new Set(set65Random.map((q) => q.id));
    expect(randUniqueIds.size).toBe(65);

    const randCounts: Record<string, number> = {};
    for (const q of set65Random) randCounts[q.domain] = (randCounts[q.domain] || 0) + 1;
    expect(randCounts['Domain 1: Design Secure Architectures']).toBe(20);
    expect(randCounts['Domain 2: Design Resilient Architectures']).toBe(17);
    expect(randCounts['Domain 3: Design High-Performing Architectures']).toBe(15);
    expect(randCounts['Domain 4: Design Cost-Optimized Architectures']).toBe(13);
  });

  it('AWS Associate 32-question set strictly follows SAA-C03 content domain ratios', () => {
    const set32 = questionRepository.get32AssociateQuestions(true);
    expect(set32.length).toBe(32);
    const uniqueIds = new Set(set32.map((q) => q.id));
    expect(uniqueIds.size).toBe(32);

    const counts: Record<string, number> = {};
    for (const q of set32) counts[q.domain] = (counts[q.domain] || 0) + 1;
    expect(counts['Domain 1: Design Secure Architectures']).toBe(10);
    expect(counts['Domain 2: Design Resilient Architectures']).toBe(8);
    expect(counts['Domain 3: Design High-Performing Architectures']).toBe(8);
    expect(counts['Domain 4: Design Cost-Optimized Architectures']).toBe(6);
  });


  it('verifies all answer letters exist in choice keys across all questions', () => {
    const allQuestions = questionRepository.getAllQuestions();
    for (const q of allQuestions) {
      for (const char of q.answer) {
        expect(q.choiceKeys).toContain(char);
      }
    }
  });

  it('detects multi-select questions accurately', () => {
    const standard32 = questionRepository.getStandard32Questions();
    // In first 32: Q10 is CD, Q15 is BCD, Q16 is AC, Q25 is BE, Q27 is AC
    const q10 = standard32[9];
    expect(q10.id).toBe(10);
    expect(q10.isMultiSelect).toBe(true);
    expect(q10.expectedChoicesCount).toBe(2);
    expect(q10.answer).toBe('CD');

    const q15 = standard32[14];
    expect(q15.id).toBe(15);
    expect(q15.isMultiSelect).toBe(true);
    expect(q15.expectedChoicesCount).toBe(3);
    expect(q15.answer).toBe('BCD');

    const q1 = standard32[0];
    expect(q1.isMultiSelect).toBe(false);
    expect(q1.expectedChoicesCount).toBe(1);
    expect(q1.answer).toBe('A');
  });

  it('handles question filtering properly', () => {
    const s3Questions = questionRepository.filterQuestions({ tag: 'Amazon S3' });
    expect(s3Questions.length).toBeGreaterThan(0);
    for (const q of s3Questions) {
      expect(q.serviceTags).toContain('Amazon S3');
    }
  });
});

describe('Question Parser', () => {
  it('normalizes answers regardless of ordering or case', () => {
    expect(normalizeAnswer('a')).toBe('A');
    expect(normalizeAnswer('dc')).toBe('CD');
    expect(normalizeAnswer('C, D')).toBe('CD');
    expect(normalizeAnswer('d, b, c')).toBe('BCD');
  });

  it('gracefully handles missing or malformed fields', () => {
    const malformed: RawQuestion = {
      question_id: 'invalid-id',
      question: '',
      choices: {},
      answer: '',
      answer_description: '',
      answers_community: [],
      topic: '',
    };
    const parsed = parseQuestion(malformed, 42);
    expect(parsed.id).toBe(43); // fallback to index + 1
    expect(parsed.text).toBe('');
    expect(parsed.expectedChoicesCount).toBe(1);
    expect(parsed.isMultiSelect).toBe(false);
  });
});

describe('Exam Engine & Scoring', () => {
  it('evaluates answers with exact and out-of-order matching', () => {
    expect(evaluateAnswer('A', 'A')).toBe(true);
    expect(evaluateAnswer('A', 'B')).toBe(false);
    expect(evaluateAnswer('CD', 'CD')).toBe(true);
    expect(evaluateAnswer('DC', 'CD')).toBe(true);
    expect(evaluateAnswer('DBC', 'BCD')).toBe(true);
    expect(evaluateAnswer('C', 'CD')).toBe(false);
    expect(evaluateAnswer('', 'A')).toBe(false);
  });

  it('calculates scaled score on AWS 100-1000 scale', () => {
    expect(calculateScaledScore(0, 32)).toBe(100);
    expect(calculateScaledScore(32, 32)).toBe(1000);
    // 23 / 32 = 71.875% -> 100 + 0.71875 * 900 = 747
    expect(calculateScaledScore(23, 32)).toBe(747);
  });

  it('calculates complete exam result accurately', () => {
    const mockSession: ExamSession = {
      id: 'session-1',
      startedAt: Date.now() - 1000,
      durationSeconds: 3600,
      timeRemainingSeconds: 3000,
      status: 'submitted',
      questionIds: [1, 2, 10],
      currentIndex: 0,
      answers: {
        1: 'A', // Q1 correct (A)
        2: 'A', // Q2 incorrect (Ans is B)
        // 10 unanswered
      },
      markedForReview: {
        10: true,
      },
    };

    const questions = questionRepository.getQuestionsByIds([1, 2, 10]);
    const result = calculateExamResult(mockSession, questions, 3600);

    expect(result.totalQuestions).toBe(3);
    expect(result.answeredCount).toBe(2);
    expect(result.correctCount).toBe(1);
    expect(result.incorrectCount).toBe(1);
    expect(result.unansweredCount).toBe(1);
    expect(result.timeUsedSeconds).toBe(600);
    expect(result.questionResults[2].wasMarked).toBe(true);
    expect(result.questionResults[0].isCorrect).toBe(true);
    expect(result.questionResults[1].isCorrect).toBe(false);
  });

  it('formats time correctly', () => {
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(3665)).toBe('01:01:05');
    expect(formatTime(0)).toBe('00:00');
  });
});

describe('Safe Storage Persistence', () => {
  beforeEach(() => {
    storage.clearExamHistory();
    storage.clearActiveExam();
  });

  it('toggles and checks bookmarks', () => {
    const qId = 99;
    const initial = storage.isBookmarked(qId);
    const added = storage.toggleBookmark(qId);
    expect(added).toBe(!initial);
    expect(storage.isBookmarked(qId)).toBe(!initial);

    // Toggle again
    const removed = storage.toggleBookmark(qId);
    expect(removed).toBe(false);
    expect(storage.isBookmarked(qId)).toBe(false);
  });

  it('persists and retrieves active exam session', () => {
    const session: ExamSession = {
      id: 'test-session',
      startedAt: Date.now(),
      durationSeconds: 1800,
      timeRemainingSeconds: 1750,
      status: 'running',
      questionIds: [1, 2, 3],
      currentIndex: 1,
      answers: { 1: 'B' },
      markedForReview: { 2: true },
    };

    storage.saveActiveExam(session);
    const retrieved = storage.getActiveExam();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('test-session');
    expect(retrieved?.currentIndex).toBe(1);
    expect(retrieved?.answers[1]).toBe('B');

    storage.clearActiveExam();
    expect(storage.getActiveExam()).toBeNull();
  });
});
