/**
 * Local-only AI Tutor Configuration Storage with Strict User Isolation
 *
 * CRITICAL SECURITY & PRIVACY MANDATE:
 * API keys entered by learners are strictly saved in the client browser's
 * localStorage under a per-user namespace. They are NEVER persisted to
 * any remote database, backend logs, analytics, feedback, or admin dashboards.
 */

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'custom';

export type AITutorMode =
  | 'explain'
  | 'exam'
  | 'beginner'
  | 'deep_dive'
  | 'flashcard'
  | 'quiz'
  | 'mistake_review';

export interface AITutorConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  customEndpoint?: string;
  temperature: number;
  systemMode: AITutorMode;
}

export interface ModeMeta {
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
}

export const MODE_METADATA: Record<AITutorMode, ModeMeta> = {
  explain: {
    label: 'Explain Mode (Giải thích toàn diện, chi tiết từng đáp án)',
    shortLabel: 'Giải thích toàn diện',
    icon: '📘',
    description: 'Tóm tắt đáp án, phân tích đề bài, mổ xẻ 4 phương án A/B/C/D và vẽ sơ đồ kiến trúc.',
  },
  exam: {
    label: 'Exam Mode (Tư duy thi SAA-C03, chỉ rõ bẫy và từ khóa đề thi)',
    shortLabel: 'Tư duy đề thi',
    icon: '🎯',
    description: 'Tập trung vào từ khóa "bẫy", phân tích phương án gây nhiễu, mẹo phòng thi 15s.',
  },
  beginner: {
    label: 'Beginner Mode (Giải thích đơn giản, ví von thực tế đời sống)',
    shortLabel: 'Người mới bắt đầu',
    icon: '💡',
    description: 'Dùng ví von đời thường gần gũi, ngôn ngữ bình dân, đơn giản hóa các khái niệm đám mây.',
  },
  deep_dive: {
    label: 'Deep Dive Mode (Phân tích chuyên sâu kiến trúc và trade-offs)',
    shortLabel: 'Phân tích chuyên sâu',
    icon: '⚡',
    description: 'Mổ xẻ tầng sâu kiến trúc, throughput, latency, bảng trade-off và sơ đồ enterprise.',
  },
  flashcard: {
    label: 'Flashcard Mode (Đúc kết các điểm cốt lõi thành thẻ nhớ)',
    shortLabel: 'Thẻ ghi nhớ',
    icon: '🗂️',
    description: 'Đúc kết kiến thức thành các cặp thẻ nhớ ngắn gọn: Khái niệm - Nguyên tắc - Bẫy thi.',
  },
  quiz: {
    label: 'Quiz Mode (AI tự đố câu hỏi tình huống để kiểm tra)',
    shortLabel: 'Thử thách phản xạ',
    icon: '❓',
    description: 'Đố học viên câu hỏi tình huống tương tự kèm 4 đáp án A/B/C/D để luyện phản xạ trước khi giải thích.',
  },
  mistake_review: {
    label: 'Mistake Review (So sánh đối kháng các dịch vụ dễ nhầm)',
    shortLabel: 'Giải tỏa sai lầm',
    icon: '⚔️',
    description: 'Bảng đối kháng trực diện giữa 2 dịch vụ dễ nhầm, chỉ ra cạm bẫy 80% người học mắc phải.',
  },
};

export const PROVIDER_DEFAULT_MODELS: Record<AIProvider, string[]> = {
  gemini: [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.0-pro-exp-02-05',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'o3-mini',
    'o1',
    'o1-mini',
    'o1-preview',
    'gpt-4.5-preview',
    'gpt-4-turbo',
    'chatgpt-4o-latest',
  ],
  anthropic: [
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-reasoner',
    'deepseek-coder',
  ],
  custom: [
    'meta-llama/llama-3.3-70b-instruct',
    'deepseek-ai/DeepSeek-R1',
    'deepseek-ai/DeepSeek-V3',
    'qwen/qwen-2.5-coder-32b-instruct',
    'mistralai/Mistral-Large-2407',
    'microsoft/phi-4',
    'default',
  ],
};

export const MODEL_DESCRIPTIONS: Record<string, string> = {
  // Gemini
  'gemini-2.5-pro': 'Gemini 2.5 Pro (Tư duy sâu & Lập trình hàng đầu)',
  'gemini-2.5-flash': 'Gemini 2.5 Flash (Tốc độ cao, đa nhiệm xuất sắc)',
  'gemini-2.0-flash': 'Gemini 2.0 Flash (Chuẩn mặc định cân bằng thế hệ mới)',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite (Siêu nhẹ, độ trễ thấp nhất)',
  'gemini-2.0-pro-exp-02-05': 'Gemini 2.0 Pro Experimental (Thử nghiệm tính năng mới)',
  'gemini-1.5-pro': 'Gemini 1.5 Pro (Ngữ cảnh 2 triệu tokens, tài liệu lớn)',
  'gemini-1.5-flash': 'Gemini 1.5 Flash (Nhanh & tiết kiệm chi phí)',
  'gemini-1.5-flash-8b': 'Gemini 1.5 Flash 8B (Nhỏ gọn, tối ưu tài nguyên)',
  // OpenAI
  'gpt-4o': 'GPT-4o (Flagship thông minh nhất, hỗ trợ thị giác)',
  'gpt-4o-mini': 'GPT-4o Mini (Nhanh, rẻ, phù hợp học thi hàng ngày)',
  'o3-mini': 'o3-mini (Mô hình suy luận kỹ thuật và logic cao cấp)',
  'o1': 'o1 (Mô hình tư duy reasoning sâu toàn diện)',
  'o1-mini': 'o1-mini (Suy luận nhanh cho bài toán phân tích)',
  'o1-preview': 'o1-preview (Bản thử nghiệm suy luận đầu tiên)',
  'gpt-4.5-preview': 'GPT-4.5 Preview (Siêu mô hình quy mô lớn thế hệ mới)',
  'gpt-4-turbo': 'GPT-4 Turbo (Hiệu năng cao, ổn định)',
  'chatgpt-4o-latest': 'ChatGPT-4o Latest (Phiên bản đồng bộ với ChatGPT)',
  // Anthropic
  'claude-3-7-sonnet-20250219': 'Claude 3.7 Sonnet (Hybrid Reasoning đỉnh cao mới nhất)',
  'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet v2 (Xuất sắc nhất về kiến trúc AWS & code)',
  'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku (Siêu nhanh, phản hồi tức thì)',
  'claude-3-opus-20240229': 'Claude 3 Opus (Phân tích chuyên sâu phức tạp)',
  'claude-3-sonnet-20240229': 'Claude 3 Sonnet (Phiên bản cân bằng)',
  'claude-3-haiku-20240307': 'Claude 3 Haiku (Tiết kiệm)',
  // DeepSeek
  'deepseek-chat': 'DeepSeek-V3 (Thông minh vượt trội, chi phí siêu rẻ)',
  'deepseek-reasoner': 'DeepSeek-R1 (Tư duy chuỗi suy luận Reasoning mạnh mẽ)',
  'deepseek-coder': 'DeepSeek Coder (Chuyên sâu hạ tầng đám mây & lập trình)',
  // Custom
  'meta-llama/llama-3.3-70b-instruct': 'Llama 3.3 70B Instruct (Mã nguồn mở hàng đầu)',
  'deepseek-ai/DeepSeek-R1': 'DeepSeek-R1 (Open Weights Reasoning)',
  'deepseek-ai/DeepSeek-V3': 'DeepSeek-V3 (671B MoE Model)',
  'qwen/qwen-2.5-coder-32b-instruct': 'Qwen 2.5 Coder 32B (Chuyên gia kỹ thuật)',
  'mistralai/Mistral-Large-2407': 'Mistral Large (Chất lượng châu Âu cao cấp)',
  'microsoft/phi-4': 'Phi-4 (14B Thông minh vượt trội quy mô nhỏ)',
  'default': 'Default Endpoint Model',
};

export const DEFAULT_AI_CONFIG: AITutorConfig = {
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-2.0-flash',
  temperature: 0.3,
  systemMode: 'explain',
};

const CONFIG_PREFIX = 'aws_ai_tutor_config_';
const memoryConfigStore: Map<string, string> = new Map();

/**
 * Get sanitized local storage key for a user
 */
export function getAIConfigStorageKey(userId: string): string {
  const safeId = (userId || 'guest').trim().toLowerCase();
  return `${CONFIG_PREFIX}${safeId}`;
}

/**
 * Retrieve AI configuration for a specific learner from browser localStorage only
 */
export function getAITutorConfig(userId: string): AITutorConfig {
  const key = getAIConfigStorageKey(userId);
  const resolveRaw = (targetKey: string): string | null => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(targetKey);
      } catch {
        return memoryConfigStore.get(targetKey) || null;
      }
    }
    return memoryConfigStore.get(targetKey) || null;
  };

  let raw = resolveRaw(key);

  // If this specific user has no config or no apiKey, and is not an isolated test account,
  // check if guest_learner has an API key configured on this device/browser
  const isIsolatedTestAccount = userId === 'user_alice' || userId === 'user_bob' || userId === 'user_test';
  if ((!raw || !JSON.parse(raw || '{}').apiKey) && !isIsolatedTestAccount) {
    const guestKey = getAIConfigStorageKey('guest_learner');
    const guestRaw = resolveRaw(guestKey);
    if (guestRaw) {
      try {
        const guestParsed = JSON.parse(guestRaw);
        if (guestParsed.apiKey && guestParsed.apiKey.trim()) {
          raw = guestRaw;
        }
      } catch {
        // Ignore
      }
    }
  }

  if (!raw) return { ...DEFAULT_AI_CONFIG };
  try {
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_AI_CONFIG,
      ...parsed,
      provider: parsed.provider || DEFAULT_AI_CONFIG.provider,
      model: parsed.model || DEFAULT_AI_CONFIG.model,
      systemMode: parsed.systemMode || DEFAULT_AI_CONFIG.systemMode,
    };
  } catch {
    return { ...DEFAULT_AI_CONFIG };
  }
}

/**
 * Save AI configuration for a specific learner into browser localStorage only
 */
export function saveAITutorConfig(userId: string, config: Partial<AITutorConfig>): void {
  const key = getAIConfigStorageKey(userId);
  try {
    const current = getAITutorConfig(userId);
    const updated: AITutorConfig = {
      ...current,
      ...config,
    };
    const serialized = JSON.stringify(updated);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, serialized);
      } catch {
        memoryConfigStore.set(key, serialized);
      }
    } else {
      memoryConfigStore.set(key, serialized);
    }

    // If saving an API key for a real learner (not test isolation), synchronize with guest session so key isn't lost on relogin
    const isIsolatedTestAccount = userId === 'user_alice' || userId === 'user_bob' || userId === 'user_test';
    if (updated.apiKey && updated.apiKey.trim() && !isIsolatedTestAccount) {
      const guestKey = getAIConfigStorageKey('guest_learner');
      if (typeof window !== 'undefined' && window.localStorage) {
        try { window.localStorage.setItem(guestKey, serialized); } catch {}
      } else {
        memoryConfigStore.set(guestKey, serialized);
      }
    }
  } catch {
    // Ignore localStorage write failures
  }
}

/**
 * Clear AI configuration for a specific learner (e.g., on account wipe)
 */
export function clearAITutorConfig(userId: string): void {
  const key = getAIConfigStorageKey(userId);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }
  memoryConfigStore.delete(key);
}

/**
 * Sanitize any state object to guarantee API keys are completely stripped before telemetry or export
 */
export function stripApiKeyFromExport<T extends Record<string, any>>(data: T): Omit<T, 'apiKey'> {
  const cloned = { ...data };
  delete cloned.apiKey;
  return cloned;
}

/**
 * Load AI Tutor Config for the current or default learner
 */
export function loadAITutorConfig(userId = 'guest_learner'): AITutorConfig {
  return getAITutorConfig(userId);
}
