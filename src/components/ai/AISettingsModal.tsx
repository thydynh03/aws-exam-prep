import React, { useState } from 'react';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Activity,
  Lock,
} from 'lucide-react';
import {
  type AITutorConfig,
  type AIProvider,
  type AITutorMode,
  PROVIDER_DEFAULT_MODELS,
  MODEL_DESCRIPTIONS,
  MODE_METADATA,
  saveAITutorConfig,
  clearAITutorConfig,
} from '../../core/aiConfigStorage';
import { testAIConnection } from '../../core/aiClient';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  config: AITutorConfig;
  onConfigUpdated: (newConfig: AITutorConfig) => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  isOpen,
  onClose,
  userId,
  config,
  onConfigUpdated,
}) => {
  const [provider, setProvider] = useState<AIProvider>(config.provider);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [model, setModel] = useState(config.model);
  const isDefaultModel = (PROVIDER_DEFAULT_MODELS[config.provider] as readonly string[]).includes(config.model);
  const [isCustomModelInput, setIsCustomModelInput] = useState<boolean>(!isDefaultModel && config.provider !== 'custom');
  const [customEndpoint, setCustomEndpoint] = useState(config.customEndpoint || '');
  const [systemMode, setSystemMode] = useState<AITutorMode>(config.systemMode || 'explain');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleProviderChange = (p: AIProvider) => {
    setProvider(p);
    setIsCustomModelInput(false);
    setModel(PROVIDER_DEFAULT_MODELS[p][0] || 'default');
    setTestResult(null);
    setSavedSuccess(false);
  };

  const handleSave = () => {
    const updated: AITutorConfig = {
      provider,
      apiKey: apiKey.trim(),
      model,
      customEndpoint: customEndpoint.trim() || undefined,
      temperature: config.temperature ?? 0.3,
      systemMode,
    };
    saveAITutorConfig(userId, updated);
    onConfigUpdated(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1100);
  };

  const handleClearKey = () => {
    if (window.confirm('Bạn có chắc muốn xóa khóa API đã lưu trên trình duyệt này?')) {
      setApiKey('');
      clearAITutorConfig(userId);
      const updated: AITutorConfig = {
        ...config,
        apiKey: '',
      };
      onConfigUpdated(updated);
      setTestResult(null);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const candidate: AITutorConfig = {
        provider,
        apiKey: apiKey.trim(),
        model,
        customEndpoint: customEndpoint.trim() || undefined,
        temperature: 0.3,
        systemMode,
      };
      const result = await testAIConnection(candidate);
      setTestResult(result);
      if (result.success && apiKey.trim()) {
        const updated: AITutorConfig = {
          provider,
          apiKey: apiKey.trim(),
          model,
          customEndpoint: customEndpoint.trim() || undefined,
          temperature: config.temperature ?? 0.3,
          systemMode,
        };
        saveAITutorConfig(userId, updated);
        onConfigUpdated(updated);
        setSavedSuccess(true);
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Cài Đặt AWS AI Tutor</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Quản lý nhà cung cấp và khóa API cá nhân</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-xs">
          {/* Privacy Banner */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
            <div className="flex items-start gap-2.5">
              <Lock className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <div className="leading-relaxed">
                <span className="font-bold">Bảo Mật Cục Bộ 100% (Local-Only Storage):</span>
                <p className="mt-0.5 text-[11px] text-emerald-800/90 dark:text-emerald-300/80">
                  Khóa API của bạn được lưu an toàn duy nhất trên trình duyệt của thiết bị này theo tài khoản học viên hiện tại. Khóa <strong>không bao giờ</strong> được lưu vào cơ sở dữ liệu, không ghi nhật ký máy chủ và không được chia sẻ với bất kỳ ai.
                </p>
              </div>
            </div>
          </div>

          {/* Provider Selection */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              1. Chọn Nhà Cung Cấp AI (Provider)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(['gemini', 'openai', 'anthropic', 'deepseek', 'custom'] as AIProvider[]).map((p) => {
                const isSelected = provider === p;
                const labels: Record<AIProvider, { name: string; tag: string }> = {
                  gemini: { name: 'Google Gemini', tag: 'Khuyên dùng' },
                  openai: { name: 'OpenAI', tag: 'GPT-4o' },
                  anthropic: { name: 'Anthropic', tag: 'Claude 3.5' },
                  deepseek: { name: 'DeepSeek', tag: 'Tiết kiệm' },
                  custom: { name: 'Tùy Chỉnh', tag: 'OpenAI API' },
                };
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleProviderChange(p)}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 dark:border-blue-500 dark:bg-blue-950/40 ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold text-slate-900 dark:text-white">{labels[p].name}</span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">{labels[p].tag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                2. Mô Hình (Model)
              </label>
              {provider !== 'custom' && (
                <button
                  type="button"
                  onClick={() => setIsCustomModelInput((prev) => !prev)}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  {isCustomModelInput ? '← Chọn từ danh sách có sẵn' : '✏️ Tự nhập model tùy ý'}
                </button>
              )}
            </div>

            {provider === 'custom' || isCustomModelInput ? (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value.trim())}
                  placeholder={
                    provider === 'gemini'
                      ? 'VD: gemini-2.5-pro, gemini-2.0-flash-lite...'
                      : provider === 'openai'
                      ? 'VD: gpt-4.5-preview, o3-mini, o1...'
                      : provider === 'anthropic'
                      ? 'VD: claude-3-7-sonnet-20250219, claude-3-5-haiku-20241022...'
                      : provider === 'deepseek'
                      ? 'VD: deepseek-reasoner, deepseek-chat...'
                      : 'VD: meta-llama/llama-3.3-70b-instruct'
                  }
                  className="w-full rounded-xl border border-blue-400 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-blue-500 dark:bg-slate-900 dark:text-white font-mono font-semibold ring-1 ring-blue-400/30"
                />
                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-1">
                  <span>Bạn có thể tự nhập bất kỳ mã model ID nào của {provider.toUpperCase()}.</span>
                  {provider !== 'custom' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomModelInput(false);
                        setModel(PROVIDER_DEFAULT_MODELS[provider][0]);
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                    >
                      Dùng danh sách chuẩn
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <select
                  value={model}
                  onChange={(e) => {
                    if (e.target.value === '__custom_entry__') {
                      setIsCustomModelInput(true);
                      setModel('');
                    } else {
                      setModel(e.target.value);
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white font-medium"
                >
                  {PROVIDER_DEFAULT_MODELS[provider].map((m) => (
                    <option key={m} value={m}>
                      {MODEL_DESCRIPTIONS[m] || m}
                    </option>
                  ))}
                  <option value="__custom_entry__">✏️ Tự nhập model khác (Custom Model ID)...</option>
                </select>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Mã model đang chọn: <code className="font-mono font-bold text-blue-600 dark:text-blue-400">{model}</code></span>
                  <span>({PROVIDER_DEFAULT_MODELS[provider].length} models có sẵn)</span>
                </div>
              </div>
            )}
          </div>

          {/* Custom Endpoint for Custom / Local LLM */}
          {provider === 'custom' && (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Custom Endpoint URL
              </label>
              <input
                type="url"
                value={customEndpoint}
                onChange={(e) => setCustomEndpoint(e.target.value)}
                placeholder="https://api.together.xyz/v1/chat/completions"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white font-mono"
              />
            </div>
          )}

          {/* API Key Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                3. Khóa API (API Key)
              </label>
              {apiKey && (
                <button
                  type="button"
                  onClick={handleClearKey}
                  className="flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Xóa khóa</span>
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder={
                  provider === 'gemini'
                    ? 'AIzaSy...'
                    : provider === 'openai'
                    ? 'sk-...'
                    : provider === 'anthropic'
                    ? 'sk-ant-...'
                    : 'Nhập API key...'
                }
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-3.5 pr-10 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              Chưa có khóa? Nếu để trống, AI Tutor sẽ dùng <strong>Chế Độ Tri Thức Nội Bộ (Knowledge Engine)</strong> sẵn có miễn phí!
            </p>
          </div>

          {/* Default Tutor Mode */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              4. Chế Độ Trợ Lý Mặc Định
            </label>
            <select
              value={systemMode}
              onChange={(e) => setSystemMode(e.target.value as AITutorMode)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="explain">Explain Mode (Giải thích toàn diện, chi tiết từng đáp án)</option>
              <option value="exam">Exam Mode (Tư duy thi SAA-C03, chỉ rõ bẫy và từ khóa đề thi)</option>
              <option value="beginner">Beginner Mode (Giải thích đơn giản, ví von thực tế đời sống)</option>
              <option value="deep_dive">Deep Dive Mode (Phân tích chuyên sâu kiến trúc và trade-offs)</option>
              <option value="flashcard">Flashcard Mode (Đúc kết các điểm cốt lõi thành thẻ nhớ)</option>
              <option value="quiz">Quiz Mode (AI tự đố câu hỏi tình huống để kiểm tra)</option>
              <option value="mistake_review">Mistake Review (So sánh đối kháng các dịch vụ dễ nhầm)</option>
            </select>
          </div>

          {/* Test Connection Button & Result */}
          <div className="pt-1">
            <button
              type="button"
              disabled={testing || !apiKey.trim()}
              onClick={handleTestConnection}
              className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
            >
              <Activity className={`h-3.5 w-3.5 ${testing ? 'animate-spin text-blue-600' : ''}`} />
              <span>{testing ? 'Đang kiểm tra kết nối...' : 'Kiểm tra kết nối API Key'}</span>
            </button>

            {testResult && (
              <div
                className={`mt-2.5 flex items-start gap-2 rounded-xl p-3 text-xs ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
                    : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
            {savedSuccess && (
              <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200 animate-fadeIn">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="font-bold text-xs">Đã lưu cấu hình AI Tutor thành công!</p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Đang áp dụng: <strong>{MODE_METADATA[systemMode]?.shortLabel || systemMode}</strong> ({provider.toUpperCase()})
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={savedSuccess}
            className={`flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-semibold text-white active:scale-95 transition-all shadow-sm ${
              savedSuccess
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {savedSuccess ? <CheckCircle2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            <span>{savedSuccess ? 'Đã lưu thành công!' : 'Lưu cấu hình'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
