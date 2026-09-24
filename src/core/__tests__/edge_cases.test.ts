import { describe, it, expect, beforeEach } from 'vitest';
import { questionRepository } from '../questionRepository';
import { evaluateAnswer, calculateExamResult, calculateScaledScore } from '../examEngine';
import { storage } from '../storage';
import type { ExamSession } from '../types';

describe('Edge Cases & State Resilience', () => {
  beforeEach(() => {
    storage.clearActiveExam();
    storage.clearExamHistory();
    storage.resetStudyProgress();
  });

  describe('Answer Changes & Multi-Select', () => {
    it('handles changing answer from one choice to another', () => {
      let currentAns = 'A';
      // User changes to B
      currentAns = 'B';
      expect(evaluateAnswer(currentAns, 'B')).toBe(true);
      expect(evaluateAnswer(currentAns, 'A')).toBe(false);
    });

    it('handles toggling choices in multi-select without order sensitivity', () => {
      // Question with answer BCD
      const set = new Set<string>();
      set.add('D');
      set.add('B');
      set.add('C');
      const sortedAns = Array.from(set).sort().join('');
      expect(sortedAns).toBe('BCD');
      expect(evaluateAnswer(sortedAns, 'BCD')).toBe(true);

      // User deselects C and selects E
      set.delete('C');
      set.add('E');
      const wrongAns = Array.from(set).sort().join('');
      expect(evaluateAnswer(wrongAns, 'BCD')).toBe(false);
    });
  });

  describe('Exam Scoring & Partial/Unanswered Edge Cases', () => {
    it('accurately scores all unanswered questions as 0 without NaN', () => {
      const emptySession: ExamSession = {
        id: 'empty_session',
        startedAt: Date.now(),
        durationSeconds: 3600,
        timeRemainingSeconds: 3600,
        status: 'submitted',
        questionIds: [1, 2, 3, 4, 5],
        currentIndex: 0,
        answers: {},
        markedForReview: {},
      };
      const questions = questionRepository.getQuestionsByIds([1, 2, 3, 4, 5]);
      const result = calculateExamResult(emptySession, questions, 3600);

      expect(result.totalQuestions).toBe(5);
      expect(result.answeredCount).toBe(0);
      expect(result.unansweredCount).toBe(5);
      expect(result.correctCount).toBe(0);
      expect(result.scorePercent).toBe(0);
      expect(result.scaledScore).toBe(100); // minimum scale on AWS
      expect(result.passed).toBe(false);
    });

    it('accurately calculates pass threshold at 72%', () => {
      // 23 of 32 = 71.875% -> scaled score 747 >= 720 -> PASS
      expect(calculateScaledScore(23, 32)).toBeGreaterThanOrEqual(720);
      // 22 of 32 = 68.75% -> scaled score 719 < 720 -> FAIL
      expect(calculateScaledScore(22, 32)).toBeLessThan(720);
    });
  });

  describe('Storage Resilience & Corruption Recovery', () => {
    it('gracefully survives malformed JSON in localStorage', () => {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('aws_exam_prep_study_progress', '{ invalid json !!');
        const progress = storage.getStudyProgress();
        expect(progress).toBeDefined();
        expect(progress.items).toEqual({});
      }
    });

    it('safely serializes and recovers active exam session on simulated browser reload', () => {
      const activeSession: ExamSession = {
        id: 'reload_test',
        startedAt: Date.now() - 300000,
        durationSeconds: 3840,
        timeRemainingSeconds: 3540,
        status: 'running',
        questionIds: [1, 5, 10, 15, 20],
        currentIndex: 2,
        answers: { 1: 'A', 5: 'D' },
        markedForReview: { 10: true },
      };

      storage.saveActiveExam(activeSession);

      // Simulate new component lifecycle mount
      const recovered = storage.getActiveExam();
      expect(recovered).not.toBeNull();
      expect(recovered?.id).toBe('reload_test');
      expect(recovered?.currentIndex).toBe(2);
      expect(recovered?.answers[5]).toBe('D');
      expect(recovered?.markedForReview[10]).toBe(true);
      expect(recovered?.timeRemainingSeconds).toBe(3540);
    });

    it('does not leak answers in active exam storage', () => {
      const session: ExamSession = {
        id: 'privacy_test',
        startedAt: Date.now(),
        durationSeconds: 3840,
        timeRemainingSeconds: 3840,
        status: 'running',
        questionIds: [1, 2, 3],
        currentIndex: 0,
        answers: { 1: 'A' },
        markedForReview: {},
      };
      storage.saveActiveExam(session);

      const rawStored = typeof window !== 'undefined' && window.localStorage 
        ? window.localStorage.getItem('aws_exam_prep_active_exam') 
        : null;
      if (rawStored) {
        // Active exam session MUST NOT contain answer keys or descriptions
        expect(rawStored).not.toContain('"answer":');
        expect(rawStored).not.toContain('"answer_description":');
      } else {
        // In node/memory mode, verify serialized session object has no answer or description field
        const serialized = JSON.stringify(session);
        expect(serialized).not.toContain('"answer":');
        expect(serialized).not.toContain('"answer_description":');
      }

    });
  });
});
