/**
 * Contextual Query Rewriter (history-aware)
 *
 * Follow-up turns such as "đề có cái gì mà phải chọn iSCSI-VTL" are meaningless to
 * retrieval / semantic cache on their own. This service condenses the conversation into a
 * single standalone query that the downstream steps (cache, memory, RAG, rerank) use.
 *
 * Primary path: a small, fast LLM call. Fallback: a deterministic heuristic that anchors
 * the query to the exam question / first user turn, so retrieval never loses the topic.
 */

export interface ContextualizeOptions {
  query: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentQuestion?: { id: number; text: string; choices?: Record<string, string>; answer?: string } | null;
  apiKey?: string;
  provider?: string;
  timeoutMs?: number;
}

export interface ContextualizeResult {
  standaloneQuery: string;
  method: 'llm' | 'heuristic' | 'none';
  latencyMs: number;
}

const REWRITE_SYSTEM_PROMPT = `Bạn là bộ viết lại truy vấn (query rewriter) cho hệ thống tìm kiếm tài liệu AWS.
Nhiệm vụ: dựa vào lịch sử hội thoại, viết lại CÂU HỎI MỚI NHẤT của học viên thành MỘT câu hỏi độc lập, đầy đủ ngữ cảnh, có thể hiểu được mà không cần đọc lịch sử.
Quy tắc:
- Thay các tham chiếu ngầm ("nó", "cái đó", "đề", "phương án kia"...) bằng đối tượng cụ thể (tên dịch vụ AWS, ràng buộc trong đề, phương án cụ thể).
- Giữ nguyên thuật ngữ AWS bằng tiếng Anh; giữ ngôn ngữ của học viên.
- Nếu câu hỏi mới vốn đã độc lập hoặc là chủ đề mới không liên quan lịch sử, trả lại gần như nguyên văn.
- KHÔNG trả lời câu hỏi. CHỈ xuất đúng một dòng là câu hỏi đã viết lại, không giải thích, không dấu ngoặc kép.`;

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function buildTranscript(opts: ContextualizeOptions): string {
  const parts: string[] = [];
  if (opts.currentQuestion) {
    const q = opts.currentQuestion;
    const choices = q.choices
      ? Object.entries(q.choices).map(([k, v]) => `${k}. ${v}`).join('\n')
      : '';
    parts.push(`[Câu hỏi thi đang hiển thị #${q.id}]\n${clip(q.text, 1500)}\n${clip(choices, 1000)}${q.answer ? `\nĐáp án: ${q.answer}` : ''}`);
  }
  const prior = opts.history.filter(
    (h, i, arr) => !(i === arr.length - 1 && h.role === 'user' && h.content === opts.query)
  );
  const firstUser = prior.find((h) => h.role === 'user');
  const recent = prior.slice(-4);
  if (firstUser && !recent.includes(firstUser)) recent.unshift(firstUser);
  for (const h of recent) {
    parts.push(`${h.role === 'user' ? 'Học viên' : 'AI'}: ${clip(h.content, h.role === 'user' ? 2000 : 600)}`);
  }
  return parts.join('\n\n');
}

function heuristicRewrite(opts: ContextualizeOptions): string {
  // Anchor the follow-up to the topic source: displayed question, else first user turn.
  const anchorSource =
    opts.currentQuestion?.text ||
    opts.history.find((h) => h.role === 'user' && h.content !== opts.query)?.content ||
    '';
  const anchor = clip(anchorSource.replace(/\s+/g, ' ').trim(), 400);
  return anchor ? `${opts.query} (ngữ cảnh: ${anchor})` : opts.query;
}

async function callRewriteLLM(
  provider: string,
  apiKey: string,
  transcript: string,
  query: string,
  timeoutMs: number
): Promise<string> {
  const userPrompt = `LỊCH SỬ HỘI THOẠI:\n${transcript}\n\nCÂU HỎI MỚI NHẤT CỦA HỌC VIÊN:\n${query}\n\nCâu hỏi độc lập đã viết lại:`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (provider === 'openai') {
      const model = process.env.AI_QUERY_REWRITE_MODEL || 'gpt-4o-mini';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: REWRITE_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0,
          max_tokens: 200,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`OpenAI rewrite HTTP ${res.status}`);
      const data = (await res.json()) as any;
      return String(data?.choices?.[0]?.message?.content || '');
    }

    const model = process.env.AI_QUERY_REWRITE_MODEL || 'gemini-2.5-flash-lite';
    const generationConfig: Record<string, any> = { temperature: 0, maxOutputTokens: 200 };
    if (model.includes('flash')) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: REWRITE_SYSTEM_PROMPT }] },
        generationConfig,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Gemini rewrite HTTP ${res.status}`);
    const data = (await res.json()) as any;
    const parts = data?.candidates?.[0]?.content?.parts;
    return Array.isArray(parts)
      ? parts.filter((p: any) => !p.thought && typeof p.text === 'string').map((p: any) => p.text).join('')
      : '';
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns a standalone version of the query. Never throws.
 */
export async function contextualizeQuery(opts: ContextualizeOptions): Promise<ContextualizeResult> {
  const start = Date.now();
  const hasPrior = opts.history.some(
    (h, i, arr) => !(i === arr.length - 1 && h.role === 'user' && h.content === opts.query)
  );
  if (!hasPrior) {
    return { standaloneQuery: opts.query, method: 'none', latencyMs: 0 };
  }

  if (opts.apiKey && (opts.provider === 'gemini' || opts.provider === 'openai')) {
    try {
      const raw = await callRewriteLLM(
        opts.provider,
        opts.apiKey,
        buildTranscript(opts),
        opts.query,
        opts.timeoutMs ?? 6000
      );
      const cleaned = raw.split('\n').map((l) => l.trim()).find(Boolean)?.replace(/^["'“”]+|["'“”]+$/g, '') || '';
      // Guard against the model answering instead of rewriting.
      if (cleaned.length >= 3 && cleaned.length <= 600) {
        return { standaloneQuery: cleaned, method: 'llm', latencyMs: Date.now() - start };
      }
    } catch (err: any) {
      console.warn('Contextual query rewrite failed, using heuristic:', err?.message || err);
    }
  }

  return { standaloneQuery: heuristicRewrite(opts), method: 'heuristic', latencyMs: Date.now() - start };
}
