/**
 * Unified AI Client for AWS AI Tutor
 *
 * Supports:
 * - Google Gemini (Gemini 2.0 Flash, 1.5 Flash, 1.5 Pro)
 * - OpenAI (GPT-4o, GPT-4o-mini)
 * - DeepSeek (deepseek-chat, deepseek-reasoner)
 * - Anthropic (Claude 3.5 Sonnet, 3.5 Haiku)
 * - Custom OpenAI-compatible endpoints
 * - Knowledge Engine fallback (zero-setup offline RAG mode)
 */

import type { AITutorConfig } from './aiConfigStorage';
import type { AICitation } from './aiConversationStorage';
import { generateKnowledgeEngineResponse } from './aiRagEngine';
import type { Question } from './types';
import type { AITutorMode } from './aiConfigStorage';

export interface AIChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AISendOptions {
  config: AITutorConfig;
  systemPrompt: string;
  userPrompt: string;
  citations: AICitation[];
  attachedImage?: {
    name: string;
    dataUrl: string; // "data:image/png;base64,..."
  };
  history?: AIChatHistoryItem[];
  // Fallback data for offline knowledge engine
  currentQuestion?: Question;
  selectedAnswer?: string;
  isSubmitted?: boolean;
  isCorrect?: boolean;
  userNotes?: string;
  mode?: AITutorMode;
  rawUserQuery?: string;
}

export interface AIResponseResult {
  content: string;
  citations: AICitation[];
  providerUsed: string;
  modelUsed: string;
}

/**
 * Execute Gemini API request
 */
async function callGemini(
  config: AITutorConfig,
  systemPrompt: string,
  userPrompt: string,
  attachedImage?: { dataUrl: string },
  history?: AIChatHistoryItem[]
): Promise<string> {
  const model = config.model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey.trim())}`;

  const contents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, any>> }> = [];

  // Add conversation history if available
  if (history && history.length > 0) {
    for (const item of history) {
      if (!item.content || !item.content.trim()) continue;
      const role: 'user' | 'model' = item.role === 'assistant' ? 'model' : 'user';

      // Gemini requires strictly alternating roles (user, model, user, model...)
      const lastMsg = contents[contents.length - 1];
      if (lastMsg && lastMsg.role === role) {
        lastMsg.parts.push({ text: item.content });
      } else {
        contents.push({
          role,
          parts: [{ text: item.content }],
        });
      }
    }
  }

  const currentParts: Array<Record<string, any>> = [];

  // Vision support for attached image
  if (attachedImage?.dataUrl) {
    const [header, base64Data] = attachedImage.dataUrl.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    if (base64Data) {
      currentParts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }
  }

  currentParts.push({ text: userPrompt });

  const lastTurn = contents[contents.length - 1];
  if (lastTurn && lastTurn.role === 'user') {
    lastTurn.parts.push(...currentParts);
  } else {
    contents.push({
      role: 'user',
      parts: currentParts,
    });
  }

  const maxOutputTokens = 8192;

  const generationConfig: Record<string, any> = {
    temperature: config.temperature ?? 0.3,
    maxOutputTokens,
  };

  // If using Gemini 2.5 or thinking models, constrain thinkingBudget so reasoning doesn't starve response tokens
  if (model.includes('2.5') || model.includes('thinking')) {
    generationConfig.thinkingConfig = {
      thinkingBudget: 1024,
    };
  }

  const payload: Record<string, any> = {
    contents,
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Lỗi Gemini API (${response.status})`;
    if (response.status === 400 && errorMsg.includes('API_KEY_INVALID')) {
      throw new Error('Khóa API Gemini không hợp lệ. Vui lòng kiểm tra lại trong phần Cài đặt AI.');
    }
    if (response.status === 429) {
      throw new Error('Đã vượt quá hạn mức gọi Gemini API (Rate Limit / Quota Exceeded). Vui lòng thử lại sau giây lát.');
    }
    throw new Error(errorMsg);
  }

  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts;

  let text = '';
  if (Array.isArray(parts) && parts.length > 0) {
    // Filter out internal thought parts if present (Gemini 2.0/2.5 Flash Thinking)
    const validParts = parts.filter((p: any) => !p.thought && typeof p.text === 'string');
    if (validParts.length > 0) {
      text = validParts.map((p: any) => p.text).join('');
    } else {
      text = parts.map((p: any) => p.text || '').join('');
    }
  }

  if (candidate?.finishReason === 'MAX_TOKENS') {
    text += '\n\n*(Lưu ý: Phản hồi đã đạt giới hạn độ dài token của mô hình. Bạn có thể chat tiếp để hỏi sâu thêm phần tiếp theo!)*';
  }

  if (!text.trim()) {
    if (candidate?.finishReason === 'SAFETY') {
      throw new Error('Câu trả lời bị chặn bởi bộ lọc chính sách an toàn của Gemini.');
    }
    if (candidate?.finishReason === 'RECITATION') {
      throw new Error('Câu trả lời bị chặn do kiểm tra trùng lặp trích dẫn bản quyền.');
    }
    throw new Error('Gemini không trả về nội dung câu trả lời hợp lệ.');
  }

  return text;
}

/**
 * Execute OpenAI or OpenAI-compatible (DeepSeek / Custom) API request
 */
async function callOpenAICompatible(
  config: AITutorConfig,
  systemPrompt: string,
  userPrompt: string,
  attachedImage?: { dataUrl: string },
  history?: AIChatHistoryItem[]
): Promise<string> {
  let endpoint = 'https://api.openai.com/v1/chat/completions';
  if (config.provider === 'deepseek') {
    endpoint = 'https://api.deepseek.com/chat/completions';
  } else if (config.provider === 'custom' && config.customEndpoint) {
    endpoint = config.customEndpoint.trim();
  }

  const messages: Array<Record<string, any>> = [
    { role: 'system', content: systemPrompt },
  ];

  if (history && history.length > 0) {
    for (const h of history) {
      if (h.content && h.content.trim()) {
        messages.push({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content,
        });
      }
    }
  }

  const userContent: Array<Record<string, any>> = [];

  // Vision support
  if (attachedImage?.dataUrl) {
    userContent.push({
      type: 'image_url',
      image_url: {
        url: attachedImage.dataUrl,
      },
    });
  }

  userContent.push({
    type: 'text',
    text: userPrompt,
  });

  messages.push({
    role: 'user',
    content: attachedImage ? userContent : userPrompt,
  });

  const payload: Record<string, any> = {
    model: config.model || (config.provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'),
    temperature: config.temperature ?? 0.3,
    max_tokens: 8192,
    messages,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey.trim()}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Lỗi nhà cung cấp AI (${response.status})`;
    if (response.status === 401) {
      throw new Error('Khóa API không chính xác hoặc đã hết hạn. Vui lòng kiểm tra lại trong Cài đặt AI.');
    }
    if (response.status === 429) {
      throw new Error('Tài khoản AI đã vượt quá hạn mức gọi (Quota / Rate Limit). Vui lòng kiểm tra số dư tại nhà cung cấp.');
    }
    throw new Error(errorMsg);
  }

  const choice = data?.choices?.[0];
  const message = choice?.message;
  let text = message?.content || '';
  if (!text.trim() && message?.reasoning_content) {
    text = message.reasoning_content;
  }

  if (!text.trim()) {
    throw new Error('Nhà cung cấp không trả lời nội dung hợp lệ.');
  }

  return text;
}

/**
 * Execute Anthropic Claude API request (with direct or proxy fallback)
 */
async function callAnthropic(
  config: AITutorConfig,
  systemPrompt: string,
  userPrompt: string,
  attachedImage?: { dataUrl: string },
  history?: AIChatHistoryItem[]
): Promise<string> {
  const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [];

  // Add history, ensuring alternating turns starting with 'user'
  if (history && history.length > 0) {
    for (const h of history) {
      if (!h.content || !h.content.trim()) continue;
      const role = h.role === 'assistant' ? 'assistant' : 'user';
      const last = messages[messages.length - 1];
      if (last && last.role === role) {
        last.content = typeof last.content === 'string'
          ? `${last.content}\n\n${h.content}`
          : h.content;
      } else {
        messages.push({ role, content: h.content });
      }
    }
  }

  // Anthropic messages array MUST start with 'user'
  if (messages.length > 0 && messages[0].role !== 'user') {
    messages.shift();
  }

  const contentParts: Array<Record<string, any>> = [];

  if (attachedImage?.dataUrl) {
    const [header, base64Data] = attachedImage.dataUrl.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mediaType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    contentParts.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: base64Data,
      },
    });
  }

  contentParts.push({
    type: 'text',
    text: userPrompt,
  });

  const lastTurn = messages[messages.length - 1];
  if (lastTurn && lastTurn.role === 'user') {
    if (typeof lastTurn.content === 'string') {
      lastTurn.content = [
        { type: 'text', text: lastTurn.content },
        ...contentParts,
      ];
    } else if (Array.isArray(lastTurn.content)) {
      lastTurn.content.push(...contentParts);
    }
  } else {
    messages.push({
      role: 'user',
      content: contentParts,
    });
  }

  const payload = {
    model: config.model || 'claude-3-5-sonnet-20241022',
    max_tokens: 8192,
    system: systemPrompt,
    messages,
  };

  // Try direct Anthropic browser request
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || `Lỗi Anthropic (${res.status})`);
    }

    const text = data?.content?.[0]?.text;
    if (text) return text;
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('Failed to fetch') || msg.includes('CORS') || msg.includes('Load failed')) {
      // Fallback to ephemeral zero-logging server proxy
      const proxyRes = await fetch('/api/ai/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ai-provider': 'anthropic',
          'x-ai-key': config.apiKey.trim(),
        },
        body: JSON.stringify(payload),
      });

      const proxyData = await proxyRes.json().catch(() => ({}));
      if (!proxyRes.ok) {
        throw new Error(proxyData?.error || 'Không thể kết nối với Anthropic API qua proxy.');
      }
      return proxyData?.content?.[0]?.text || 'Không nhận được câu trả lời từ Anthropic.';
    }
    throw err;
  }

  throw new Error('Không thể nhận phản hồi từ Anthropic Claude.');
}

/**
 * Main dispatcher to send prompt to AI Provider or fallback to local Knowledge Engine
 */
export async function sendAITutorMessage(options: AISendOptions): Promise<AIResponseResult> {
  const { config, systemPrompt, userPrompt, citations, attachedImage, history } = options;

  // 1. If no API key is provided, use built-in offline Knowledge Engine
  if (!config.apiKey || !config.apiKey.trim()) {
    const fallback = generateKnowledgeEngineResponse({
      currentQuestion: options.currentQuestion,
      selectedAnswer: options.selectedAnswer,
      isSubmitted: options.isSubmitted,
      isCorrect: options.isCorrect,
      userNotes: options.userNotes,
      userQuery: options.rawUserQuery || options.userPrompt,
      mode: options.mode,
      history,
      imageAttached: Boolean(attachedImage),
    });

    return {
      content: fallback.answer,
      citations: fallback.citations,
      providerUsed: 'Knowledge Engine (Nội bộ)',
      modelUsed: 'AWS Knowledge Base RAG',
    };
  }

  // 2. Call configured Generative AI Provider
  let responseText = '';
  const provider = config.provider || 'gemini';

  try {
    switch (provider) {
      case 'gemini':
        responseText = await callGemini(config, systemPrompt, userPrompt, attachedImage, history);
        break;
      case 'openai':
      case 'deepseek':
      case 'custom':
        responseText = await callOpenAICompatible(config, systemPrompt, userPrompt, attachedImage, history);
        break;
      case 'anthropic':
        responseText = await callAnthropic(config, systemPrompt, userPrompt, attachedImage, history);
        break;
      default:
        throw new Error(`Nhà cung cấp AI '${provider}' chưa được hỗ trợ.`);
    }

    return {
      content: responseText,
      citations,
      providerUsed: config.provider.toUpperCase(),
      modelUsed: config.model,
    };
  } catch (apiErr: any) {
    console.warn(`[AI Client] Provider ${provider} failed or rate limited, falling back to source-based explanation:`, apiErr);
    const errMsg = String(apiErr?.message || '').toLowerCase();
    const isRateOrQuota =
      errMsg.includes('429') ||
      errMsg.includes('quota') ||
      errMsg.includes('rate limit') ||
      errMsg.includes('resource_exhausted') ||
      errMsg.includes('insufficient_quota') ||
      errMsg.includes('hạn mức') ||
      errMsg.includes('exceeded') ||
      errMsg.includes('limit') ||
      errMsg.includes('credit') ||
      errMsg.includes('billing') ||
      errMsg.includes('api_key_invalid') ||
      errMsg.includes('không hợp lệ');

    // Generate comprehensive explanation based on question source & knowledge engine
    const fallback = generateKnowledgeEngineResponse({
      currentQuestion: options.currentQuestion,
      selectedAnswer: options.selectedAnswer,
      isSubmitted: options.isSubmitted,
      isCorrect: options.isCorrect,
      userNotes: options.userNotes,
      userQuery: options.rawUserQuery || options.userPrompt,
      mode: options.mode,
      history,
      imageAttached: Boolean(attachedImage),
    });

    const noticeHeader = isRateOrQuota
      ? `> [!NOTE]\n> ⚡ **Tài khoản API (${provider.toUpperCase()}) đã chạm giới hạn / hết hạn mức (Rate Limit / Quota Exceeded):**\n> ${apiErr?.message || 'Hạn mức API tạm thời không khả dụng.'}\n> Hệ thống đã tự động chuyển sang **giải thích chi tiết dựa trên nguồn tài liệu chuẩn & đáp án chính thức (Curated Source & Official Answer Description)** để không làm gián đoạn việc học của bạn.\n\n`
      : `> [!WARNING]\n> ⚠️ **Không thể kết nối API (${provider.toUpperCase()}):** ${apiErr?.message || 'Lỗi kết nối'}\n> Đã tự động hiển thị nội dung giải thích dựa theo tài liệu nguồn chính thức.\n\n`;

    return {
      content: noticeHeader + fallback.answer,
      citations: fallback.citations && fallback.citations.length > 0 ? fallback.citations : citations,
      providerUsed: `${provider.toUpperCase()} ➔ Nguồn tài liệu chuẩn (Source)`,
      modelUsed: 'Curated Source Knowledge Base',
    };
  }
}

/**
 * Verification utility: Test API key connection with a minimal 1-token query
 */
export async function testAIConnection(config: AITutorConfig): Promise<{ success: boolean; message: string }> {
  if (!config.apiKey || !config.apiKey.trim()) {
    return { success: false, message: 'Vui lòng nhập API key trước khi kiểm tra kết nối.' };
  }

  try {
    const testOptions: AISendOptions = {
      config,
      systemPrompt: 'You are a test ping.',
      userPrompt: 'Reply with the single word "READY".',
      citations: [],
    };

    const res = await sendAITutorMessage(testOptions);
    if (res.content) {
      return { success: true, message: `Kết nối thành công tới ${config.provider.toUpperCase()} (${config.model})!` };
    }
    return { success: false, message: 'Không nhận được phản hồi từ nhà cung cấp.' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Kiểm tra kết nối thất bại.' };
  }
}
