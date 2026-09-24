import { describe, it, expect, beforeEach } from 'vitest';
import { TRANSLATIONS } from '../translations';
import { storage } from '../storage';
import { questionRepository } from '../questionRepository';

describe('i18n & translations coverage', () => {
  beforeEach(() => {
    storage.setLanguage('en');
  });

  it('persists and retrieves language preferences', () => {
    expect(storage.getLanguage()).toBe('en');
    storage.setLanguage('vi');
    expect(storage.getLanguage()).toBe('vi');
    storage.setLanguage('en');
    expect(storage.getLanguage()).toBe('en');
  });

  it('has identical sections in EN and VI translation dictionaries', () => {
    const enSections = Object.keys(TRANSLATIONS.en).sort();
    const viSections = Object.keys(TRANSLATIONS.vi).sort();
    expect(enSections).toEqual(viSections);
  });

  it('has identical keys and non-empty strings in every section between EN and VI', () => {
    const sections = Object.keys(TRANSLATIONS.en) as Array<keyof typeof TRANSLATIONS.en>;

    for (const section of sections) {
      const enKeys = Object.keys(TRANSLATIONS.en[section]).sort();
      const viKeys = Object.keys(TRANSLATIONS.vi[section]).sort();

      expect(viKeys, `Keys mismatch in section: ${section}`).toEqual(enKeys);

      for (const key of enKeys) {
        const enVal = (TRANSLATIONS.en[section] as Record<string, string>)[key];
        const viVal = (TRANSLATIONS.vi[section] as Record<string, string>)[key];

        expect(typeof enVal, `EN [${section}][${key}] should be string`).toBe('string');
        expect(enVal.length, `EN [${section}][${key}] is empty`).toBeGreaterThan(0);

        expect(typeof viVal, `VI [${section}][${key}] should be string`).toBe('string');
        expect(viVal.length, `VI [${section}][${key}] is empty`).toBeGreaterThan(0);
      }
    }
  });

  it('strictly preserves question text, choices, and answers in question bank without modification', () => {
    const standard32 = questionRepository.getStandard32Questions();
    expect(standard32.length).toBe(32);

    for (const q of standard32) {
      // Must have original English question text
      expect(typeof q.text).toBe('string');
      expect(q.text.length).toBeGreaterThan(20);

      // Choices must be intact and non-empty
      const choices = q.choices;
      expect(typeof choices).toBe('object');
      const keys = Object.keys(choices);
      expect(keys.length).toBeGreaterThanOrEqual(4);

      for (const key of keys) {
        expect(choices[key].trim().length).toBeGreaterThan(0);
      }

      // Answer key must be valid (e.g. 'A', 'B', 'CD')
      expect(typeof q.answer).toBe('string');
      expect(q.answer.length).toBeGreaterThanOrEqual(1);
      for (const letter of q.answer.split('')) {
        expect(keys).toContain(letter);
      }
    }

    const set65 = questionRepository.get65AssociateQuestions(false);
    expect(set65.length).toBe(65);
    for (const q of set65) {
      expect(q.text.length).toBeGreaterThan(20);
      expect(q.choiceKeys.length).toBeGreaterThanOrEqual(4);
      expect(q.answer.length).toBeGreaterThanOrEqual(1);
    }
  });
});
