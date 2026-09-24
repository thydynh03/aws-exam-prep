import { describe, it, expect, vi } from 'vitest';
import { resolveConversationContext, generateKnowledgeEngineResponse, buildAIPromptContext } from '../aiRagEngine';
import { questionRepository } from '../questionRepository';
import { sendAITutorMessage } from '../aiClient';

const bankQuestion = questionRepository.getAllQuestions()[0];
const pasted = `[ĐỌC MÀN HÌNH HIỆN TẠI]\n- Mã câu hỏi: #${bankQuestion.id}\n${bankQuestion.text}`;
const history = [
  { role: 'user' as const, content: pasted },
  { role: 'assistant' as const, content: 'Phân tích đề ...' },
];

describe('resolveConversationContext', () => {
  it('is not a follow-up without prior turns', () => {
    const ctx = resolveConversationContext('VTL là gì?', []);
    expect(ctx.isFollowUp).toBe(false);
    expect(ctx.resolvedQuestion).toBeUndefined();
    expect(ctx.retrievalQuery).toBe('VTL là gì?');
  });

  it('resolves the pasted question by id and anchors the retrieval query', () => {
    const ctx = resolveConversationContext('đề có cái gì mà phải chọn đáp án đó', history);
    expect(ctx.isFollowUp).toBe(true);
    expect(ctx.resolvedQuestion?.id).toBe(bankQuestion.id);
    expect(ctx.retrievalQuery.startsWith('đề có cái gì mà phải chọn đáp án đó ')).toBe(true);
  });

  it('resolves the pasted question by text when no id is present', () => {
    const ctx = resolveConversationContext('tại sao vậy', [{ role: 'user', content: bankQuestion.text }, history[1]]);
    expect(ctx.resolvedQuestion?.id).toBe(bankQuestion.id);
  });

  it('ignores the current query when it is the last history item', () => {
    const q = 'tại sao vậy';
    const ctx = resolveConversationContext(q, [{ role: 'user', content: q }]);
    expect(ctx.isFollowUp).toBe(false);
  });
});

describe('fallback engines use conversation history', () => {
  it('knowledge engine answers a follow-up against the question from history', () => {
    const res = generateKnowledgeEngineResponse({ userQuery: 'đề có cái gì mà phải chọn đáp án đó', history });
    expect(res.answer).toContain(`#${bankQuestion.id}`);
  });

  it('prompt builder includes the resolved question and multi-turn directive', () => {
    const ctx = buildAIPromptContext({ userQuery: 'đề có cái gì mà phải chọn đáp án đó', history });
    expect(ctx.systemPrompt).toContain('HỘI THOẠI NHIỀU LƯỢT');
    expect(ctx.userPrompt).toContain(`#${bankQuestion.id}`);
  });
});

describe('unbanked pasted question & source-based explanation fallback', () => {
  const pastedUnbanked = `[ĐỌC MÀN HÌNH HIỆN TẠI]
- Mã câu hỏi: #517
- Nội dung câu hỏi: A company has an on-premises backup application that uses physical tape libraries. The company wants to migrate backup data to AWS without changing its backup application workflows. Which solution meets these requirements?
- Các lựa chọn:
[A] Use AWS DataSync to copy backup data to Amazon S3 Glacier Flexible Retrieval.
[B] Set up an AWS Storage Gateway Volume Gateway.
[C] Configure Amazon S3 File Gateway.
[D] Deploy an AWS Storage Gateway Tape Gateway using the iSCSI-VTL interface.
- Đáp án người dùng chọn: D`;

  const unbankedHistory = [
    { role: 'user' as const, content: pastedUnbanked },
    { role: 'assistant' as const, content: 'Phân tích đề #517...' },
  ];

  it('correctly resolves unbanked pasted question #517 from screen reading', () => {
    const ctx = resolveConversationContext('đề có cái gì mà phải chọn giao thức iSCSI-VTL', unbankedHistory);
    expect(ctx.isFollowUp).toBe(true);
    expect(ctx.resolvedQuestion).toBeDefined();
    expect(ctx.resolvedQuestion?.id).toBe(517);
    expect(ctx.resolvedQuestion?.choices.D).toContain('Storage Gateway');
    expect(ctx.resolvedQuestion?.choices.D).toContain('VTL');
  });

  it('generates source-based explanation for why iSCSI-VTL / option D was chosen', () => {
    const res = generateKnowledgeEngineResponse({
      userQuery: 'đề có cái gì mà phải chọn giao thức iSCSI-VTL',
      history: unbankedHistory,
    });
    expect(res.answer).toContain('517');
    expect(res.answer).toContain('iSCSI-VTL');
    expect(res.answer).toContain('Storage Gateway');
    expect(res.citations.length).toBeGreaterThan(0);
    expect(res.answer).toContain('docs.aws.amazon.com');
  });

  it('prompt builder tags follow-up query as question solving instead of general concept', () => {
    const ctx = buildAIPromptContext({
      userQuery: 'đề có cái gì mà phải chọn giao thức iSCSI-VTL',
      history: unbankedHistory,
    });
    expect(ctx.systemPrompt).not.toContain('BẠN ĐANG TRẢ LỜI CÂU HỎI KHÁI NIỆM');
    expect(ctx.systemPrompt).toContain('HỘI THOẠI NHIỀU LƯỢT');
    expect(ctx.userPrompt).toContain('517');
  });

  it('falls back to source-based explanation with AWS citations when API is rate-limited / quota exhausted', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: { message: 'You have exceeded your current quota / rate limit (429).' },
        }),
      });

      const res = await sendAITutorMessage({
        config: {
          provider: 'openai',
          apiKey: 'sk-test-mock-key',
          model: 'gpt-4o-mini',
          systemMode: 'explain',
          temperature: 0.3,
        },
        systemPrompt: 'You are an AWS tutor.',
        userPrompt: 'đề có cái gì mà phải chọn giao thức iSCSI-VTL',
        rawUserQuery: 'đề có cái gì mà phải chọn giao thức iSCSI-VTL',
        citations: [],
        history: unbankedHistory,
      });

      expect(res.content).toContain('Rate Limit / Quota Exceeded');
      expect(res.content).toContain('517');
      expect(res.content).toContain('iSCSI-VTL');
      expect(res.citations.length).toBeGreaterThan(0);
      expect(res.providerUsed).toContain('Nguồn tài liệu chuẩn (Source)');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
