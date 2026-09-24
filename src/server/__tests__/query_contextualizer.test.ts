import { describe, it, expect, vi, afterEach } from 'vitest';
import { contextualizeQuery } from '../ai/aiQueryContextualizer.js';
import { buildPriorTurns } from '../ai/aiGatewayService.js';

describe('buildPriorTurns', () => {
  it('drops the current query, merges same-role turns and alternates user/assistant', () => {
    const turns = buildPriorTurns(
      [
        { role: 'assistant', content: 'greeting' },
        { role: 'user', content: 'q1' },
        { role: 'user', content: 'q1b' },
        { role: 'assistant', content: 'a1' },
        { role: 'user', content: 'follow-up' },
      ],
      'follow-up'
    );
    expect(turns).toEqual([
      { role: 'user', content: 'q1\n\nq1b' },
      { role: 'assistant', content: 'a1' },
    ]);
  });
});

const pastedQuestion =
  'A company wants to eliminate physical backup tapes and preserve the existing investment in on-premises backup applications and workflows. A. Storage Gateway NFS ... D. Storage Gateway iSCSI-VTL';

describe('contextualizeQuery', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns the query unchanged when there is no prior turn', async () => {
    const q = 'VTL là gì?';
    const res = await contextualizeQuery({ query: q, history: [{ role: 'user', content: q }] });
    expect(res).toMatchObject({ standaloneQuery: q, method: 'none' });
  });

  it('anchors a follow-up to the first user turn when no API key is available', async () => {
    const q = 'đề có cái gì mà phải chọn iSCSI-VTL';
    const res = await contextualizeQuery({
      query: q,
      history: [
        { role: 'user', content: pastedQuestion },
        { role: 'assistant', content: 'Đáp án D ...' },
        { role: 'user', content: q },
      ],
    });
    expect(res.method).toBe('heuristic');
    expect(res.standaloneQuery).toContain(q);
    expect(res.standaloneQuery).toContain('physical backup tapes');
  });

  it('uses the LLM rewrite when available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Ràng buộc nào trong đề khiến phải chọn Storage Gateway Tape Gateway (iSCSI-VTL)?\n' }] } }],
        }),
        { status: 200 }
      )
    );
    const q = 'đề có cái gì mà phải chọn iSCSI-VTL';
    const res = await contextualizeQuery({
      query: q,
      history: [
        { role: 'user', content: pastedQuestion },
        { role: 'assistant', content: 'Đáp án D ...' },
      ],
      apiKey: 'test-key',
      provider: 'gemini',
    });
    expect(res.method).toBe('llm');
    expect(res.standaloneQuery).toBe('Ràng buộc nào trong đề khiến phải chọn Storage Gateway Tape Gateway (iSCSI-VTL)?');
  });

  it('falls back to heuristic when the LLM call fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await contextualizeQuery({
      query: 'tại sao vậy?',
      history: [{ role: 'user', content: pastedQuestion }, { role: 'assistant', content: 'D' }],
      apiKey: 'k',
      provider: 'openai',
    });
    expect(res.method).toBe('heuristic');
  });
});
