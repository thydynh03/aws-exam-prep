import { describe, it, expect } from 'vitest';
import { HANDBOOK_SECTIONS, getHandbookSectionsForService, getHandbookSectionsForExplorerId, searchHandbook } from '../saaHandbook';
import { getFlashcardsByDeck, FLASHCARDS } from '../flashcardDatabase';
import { retrieveRelevantKnowledge, buildHandbookAnswer } from '../aiRagEngine';

describe('SAA-C03 Handbook data', () => {
  it('covers every entry of the table of contents with content', () => {
    expect(HANDBOOK_SECTIONS.length).toBeGreaterThanOrEqual(100);
    for (const s of HANDBOOK_SECTIONS) {
      expect(s.subsections.length, s.name).toBeGreaterThan(0);
      expect(s.printedPages.length, s.name).toBeGreaterThan(0);
    }
  });

  it('maps core services to their handbook chapters', () => {
    expect(getHandbookSectionsForService('s3')[0].name).toBe('Amazon S3');
    expect(getHandbookSectionsForService('athena')[0].summary).toMatch(/query/i);
    expect(getHandbookSectionsForExplorerId('alb-nlb').map((s) => s.name)).toContain('Elastic Load Balancing');
  });

  it('searches passages by keyword and prioritises detected services', () => {
    const hits = searchHandbook('S3 storage classes lifecycle glacier', { serviceIds: ['s3'] });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].section.serviceIds).toContain('s3');
    expect(searchHandbook('', {})).toEqual([]);
  });
});

describe('Handbook integration', () => {
  it('adds handbook citations to RAG retrieval', () => {
    const { citations, serviceSnippets } = retrieveRelevantKnowledge('How does Athena partitioning reduce cost?');
    expect(citations.some((c) => c.title.startsWith('SAA-C03 Handbook'))).toBe(true);
    expect(serviceSnippets.join('\n')).toMatch(/Handbook/);
  });

  it('generates a handbook flashcard deck with unique ids', () => {
    const deck = getFlashcardsByDeck('handbook');
    expect(deck.length).toBeGreaterThan(100);
    expect(new Set(FLASHCARDS.map((c) => c.id)).size).toBe(FLASHCARDS.length);
    for (const card of deck.slice(0, 20)) {
      expect(card.front).toBeTruthy();
      expect(card.back).toBeTruthy();
    }
  });

  it('answers offline from the handbook for services outside the curated list', () => {
    const res = buildHandbookAnswer('How does Athena partitioning reduce cost?');
    expect(res?.answer).toMatch(/Amazon Athena/);
    expect(res?.answer).toMatch(/[Pp]artition/);
    expect(res?.citations[0].title).toMatch(/SAA-C03 Handbook: Amazon Athena/);
    expect(buildHandbookAnswer('hi')).toBeUndefined();
  });
});
