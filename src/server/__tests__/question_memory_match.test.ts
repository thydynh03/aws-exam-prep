import { describe, it, expect } from 'vitest';
import { recordQuestionMemory, findSimilarQuestions } from '../ai/aiMemoryService.js';
import { rewritePrompt } from '../ai/aiPromptRewriter.js';

describe('question memory matching', () => {
  const tenantId = `memtest_${Date.now()}`;

  it('does not match a greeting to an unrelated question', async () => {
    await recordQuestionMemory({
      tenantId,
      originalQuestion: 'hi',
      normalizedQuestion: rewritePrompt('hi').normalizedQuery,
      rewrittenQuestion: 'hi',
      intent: 'UNCLEAR',
      topic: 'General',
    });
    const q = rewritePrompt('How does Athena partitioning reduce cost?');
    expect(await findSimilarQuestions(q.normalizedQuery, q.intent, q.topic, tenantId)).toBeNull();
    // A greeting itself is too vague to match anything
    expect(await findSimilarQuestions('hi', 'UNCLEAR', 'General', tenantId)).toBeNull();
  });

  it('still matches a genuinely repeated question', async () => {
    const q = rewritePrompt('How does Athena partitioning reduce cost?');
    await recordQuestionMemory({
      tenantId,
      originalQuestion: 'How does Athena partitioning reduce cost?',
      normalizedQuestion: q.normalizedQuery,
      rewrittenQuestion: q.rewrittenQuery,
      intent: q.intent,
      topic: q.topic,
    });
    const again = rewritePrompt('how does athena partitioning reduce the cost');
    const match = await findSimilarQuestions(again.normalizedQuery, again.intent, again.topic, tenantId);
    expect(match?.matchedQuestion).toBe('How does Athena partitioning reduce cost?');
  });
});
