import { describe, it, expect } from 'vitest';
import { calculateScaledScore, simulateRealExamScoring } from '../examEngine';

describe('scaled score', () => {
  it('maps 0%, 72% and 100% to 100, 720 and 1000', () => {
    expect(calculateScaledScore(0, 50)).toBe(100);
    expect(calculateScaledScore(36, 50)).toBe(720);
    expect(calculateScaledScore(50, 50)).toBe(1000);
  });
});

describe('real exam simulation (50 scored + 15 unscored)', () => {
  it('only applies to a full 65-question exam', () => {
    expect(simulateRealExamScoring(Array(32).fill(true))).toBeUndefined();
  });

  it('gives a fixed score when every answer is right or wrong', () => {
    const all = simulateRealExamScoring(Array(65).fill(true), 200)!;
    expect(all.minScaledScore).toBe(1000);
    expect(all.passProbability).toBe(1);
    const none = simulateRealExamScoring(Array(65).fill(false), 200)!;
    expect(none.maxScaledScore).toBe(100);
    expect(none.passProbability).toBe(0);
  });

  it('produces a score range around the pass mark for a borderline result', () => {
    const flags = Array.from({ length: 65 }, (_, i) => i < 47); // 47/65 = 72.3%
    const sim = simulateRealExamScoring(flags, 2000)!;
    expect(sim.scoredQuestions).toBe(50);
    expect(sim.minScaledScore).toBeLessThan(720);
    expect(sim.maxScaledScore).toBeGreaterThan(720);
    expect(sim.passProbability).toBeGreaterThan(0.2);
    expect(sim.passProbability).toBeLessThan(0.9);
  });
});
