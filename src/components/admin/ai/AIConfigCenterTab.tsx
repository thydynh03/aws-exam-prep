import React, { useState, useEffect, useCallback } from 'react';
import {
  Save,
  RotateCcw,
  History,
  Shield,
  Layers,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { adminApi } from '../../../core/api';

interface ConfigFormState {
  version: number;
  status: string;
  provider: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  ragTopK: number;
  cohereRerankMode: string;
  rerankTopN: number;
  semanticCacheEnabled: boolean;
  strictDomainEnabled: boolean;
}

function parseEnterpriseConfig(raw: any): ConfigFormState {
  const c = raw?.config || raw || {};
  return {
    version: Number(c.version || 1),
    status: c.status || 'PUBLISHED',
    provider: c.provider || c.aiProvider?.provider || 'gemini',
    model: c.model || c.aiProvider?.model || 'gemini-1.5-flash',
    temperature: typeof c.temperature === 'number' ? c.temperature : (c.aiProvider?.temperature ?? 0.2),
    systemPrompt: typeof c.systemPrompt === 'string'
      ? c.systemPrompt
      : (c.systemPrompt?.basePrompt || 'Bạn là Trợ lý AI Luyện Thi Chứng Chỉ AWS (AWS Exam AI Tutor & Architecture Advisor) cấp Enterprise.'),
    ragTopK: Number(c.ragTopK ?? c.rag?.topK ?? 6),
    cohereRerankMode: c.cohereRerankMode || c.cohereRerank?.mode || 'ALWAYS',
    rerankTopN: Number(c.rerankTopN ?? c.cohereRerank?.topN ?? 3),
    semanticCacheEnabled: typeof c.semanticCacheEnabled === 'boolean' ? c.semanticCacheEnabled : (c.memory?.semanticCacheEnabled ?? true),
    strictDomainEnabled: typeof c.strictDomainEnabled === 'boolean' ? c.strictDomainEnabled : (c.security?.domainScopeGuard ?? true),
  };
}

export const AIConfigCenterTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ConfigFormState | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const updateConfig = (updates: Partial<ConfigFormState>) => {
    setConfig((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const fetchConfigAndVersions = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, verRes] = await Promise.all([
        adminApi.getAIConfig(),
        adminApi.getAIConfigVersions(),
      ]);
      if (cfgRes) {
        const parsed = parseEnterpriseConfig(cfgRes);
        setConfig(parsed);
        setSelectedVersion(parsed.version);
      }
      if (verRes?.versions) {
        setVersions(verRes.versions);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Lỗi tải cấu hình AI' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [cfgRes, verRes] = await Promise.all([
          adminApi.getAIConfig(),
          adminApi.getAIConfigVersions(),
        ]);
        if (!active) return;
        if (cfgRes) {
          const parsed = parseEnterpriseConfig(cfgRes);
          setConfig(parsed);
          setSelectedVersion(parsed.version);
        }
        if (verRes?.versions) {
          setVersions(verRes.versions);
        }
      } catch (err: any) {
        if (!active) return;
        setStatusMessage({ type: 'error', text: err.message || 'Lỗi tải cấu hình AI' });
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const handleSaveConfig = async () => {
    if (!config) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await adminApi.saveAIConfig(config, `Cập nhật cấu hình mô hình ${config.model}`);
      if (res?.success) {
        setStatusMessage({ type: 'success', text: `Đã xuất bản cấu hình mới (Phiên bản v${res.version})!` });
        await fetchConfigAndVersions();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Lỗi lưu cấu hình AI' });
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async (targetVersion: number) => {
    if (!window.confirm(`Bạn có chắc muốn khôi phục về phiên bản v${targetVersion}?`)) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await adminApi.rollbackAIConfig(targetVersion);
      if (res?.success) {
        setStatusMessage({ type: 'success', text: `Đã khôi phục thành công về phiên bản v${res.activeVersion}!` });
        await fetchConfigAndVersions();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Lỗi rollback cấu hình' });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 dark:text-slate-400">
        <RefreshCw className="h-6 w-6 animate-spin text-purple-600" />
        <span className="ml-2.5 text-sm font-medium">Đang tải cấu hình AI Enterprise...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Trung Tâm Cấu Hình AI (Configuration Center)</h3>
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
              v{config?.version || 1} {config?.status === 'ACTIVE' ? 'Active' : 'Draft'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Quản lý Model, System Prompt, RAG Top-K, Cohere Rerank, kiểm soát an ninh và khôi phục phiên bản.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchConfigAndVersions}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Tải lại</span>
          </button>

          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Đang lưu...' : 'Xuất Bản Cấu Hình'}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Grid: Main Config Form & Version History Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Config Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Provider & Model */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>Nhà Cung Cấp & Mô Hình AI (Model Provider)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nhà cung cấp
                </label>
                <select
                  value={config?.provider || 'gemini'}
                  onChange={(e) => updateConfig({ provider: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-slate-900 focus:border-purple-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI (GPT-4o)</option>
                  <option value="claude">Anthropic Claude</option>
                  <option value="local_rag">Tri thức nội bộ (Knowledge Engine)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mã mô hình (Model ID)
                </label>
                <input
                  type="text"
                  value={config?.model || 'gemini-1.5-flash'}
                  onChange={(e) => updateConfig({ model: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-slate-900 focus:border-purple-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Độ sáng tạo (Temperature: {config?.temperature ?? 0.2})
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={config?.temperature ?? 0.2}
                  onChange={(e) => updateConfig({ temperature: parseFloat(e.target.value) })}
                  className="w-full mt-2"
                />
              </div>
            </div>
          </div>

          {/* Section 2: System Prompt */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Sliders className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>Chỉ Thị Hệ Thống (System Prompt)</span>
            </h4>

            <div>
              <textarea
                value={config?.systemPrompt || ''}
                onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
                rows={8}
                placeholder="Nhập hướng dẫn kiến trúc sư AWS cho AI..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-900 focus:border-purple-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                Lưu ý: Mọi tài liệu RAG sẽ được cô lập trong thẻ an toàn <code className="text-purple-600 dark:text-purple-400">&lt;untrusted_knowledge_documents&gt;</code> để chống prompt injection.
              </p>
            </div>
          </div>

          {/* Section 3: RAG & Cohere Reranking Settings */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>Cấu Hình RAG & Cohere Rerank</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  RAG Retrieval Top-K ({config?.ragTopK ?? 6} đoạn)
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={config?.ragTopK ?? 6}
                  onChange={(e) => updateConfig({ ragTopK: parseInt(e.target.value, 10) || 6 })}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-slate-900 focus:border-purple-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Cohere Rerank Mode
                </label>
                <select
                  value={config?.cohereRerankMode || 'ALWAYS'}
                  onChange={(e) => updateConfig({ cohereRerankMode: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-slate-900 focus:border-purple-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="ALWAYS">Luôn luôn sử dụng (Khuyến nghị)</option>
                  <option value="WHEN_RELEVANCE_LOW">Khi độ tương đồng sơ khởi thấp</option>
                  <option value="COMPLEX_QUERY_ONLY">Chỉ khi câu hỏi phức tạp</option>
                  <option value="DISABLED">Tắt Rerank</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Rerank Top-N ({config?.rerankTopN ?? 3} đoạn tối ưu)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={config?.rerankTopN ?? 3}
                  onChange={(e) => updateConfig({ rerankTopN: parseInt(e.target.value, 10) || 3 })}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-slate-900 focus:border-purple-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300">Semantic Cache (Fast Path)</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.semanticCacheEnabled ?? true}
                  onChange={(e) => updateConfig({ semanticCacheEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-purple-600" />
              </label>
            </div>
          </div>

          {/* Section 4: Security & Domain Scope Policies */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Chính Sách An Ninh & Phạm Vi Domain (Security Gateway)</span>
            </h4>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">Phát hiện Prompt Injection & Jailbreak</div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Chặn các mẫu lệnh tấn công, bẻ khóa DAN, ép lộ bí mật</div>
                </div>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">BẮT BUỘC (MẶC ĐỊNH)</span>
              </div>

              <div className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">Ranh Giới Domain AWS (Strict Domain Boundary)</div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Từ chối trả lời các chủ đề ngoài phạm vi chứng chỉ điện toán đám mây</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config?.strictDomainEnabled ?? true}
                    onChange={(e) => updateConfig({ strictDomainEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-purple-600" />
                </label>
              </div>

              <div className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">Quét & Che Dấu Thông Tin Nhạy Cảm (PII & Secret Masking)</div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Tự động che giấu email, phone, API key, AWS Access Key khỏi câu trả lời</div>
                </div>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">BẬT (OUTPUT GUARD)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Version History & Rollback Panel */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <History className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>Lịch Sử Phiên Bản (Version Audit)</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
              Mỗi lần lưu cấu hình sẽ sinh ra một phiên bản bất biến. Quản trị viên có thể xem hoặc rollback bất kỳ lúc nào.
            </p>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {versions.length === 0 ? (
                <div className="text-xs text-slate-400 py-4 text-center">Chưa có phiên bản cũ</div>
              ) : (
                versions.map((ver) => {
                  const isActive = config?.version === ver.version;
                  const isSelected = selectedVersion === ver.version;
                  return (
                    <div
                      key={ver.version}
                      className={`p-3 rounded-xl border text-xs transition-colors ${
                        isActive
                          ? 'border-purple-500 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/30'
                          : isSelected
                          ? 'border-slate-400 bg-slate-50 dark:border-slate-600 dark:bg-slate-800'
                          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 dark:text-white">
                          Phiên bản v{ver.version}
                        </span>
                        {isActive && (
                          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Đang chạy
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-400 mb-2">
                        {new Date(ver.createdAt).toLocaleString('vi-VN')} • Bởi {ver.publishedBy || ver.createdBy || 'admin'}
                      </div>

                      <div className="text-[11px] text-slate-600 dark:text-slate-300 mb-2.5 line-clamp-2 font-mono">
                        {ver.changeSummary || ver.changeNote || `Mô hình: ${ver.configSnapshot?.model || 'gemini-1.5-flash'}`}
                      </div>

                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => handleRollback(ver.version)}
                          disabled={saving}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Rollback về v{ver.version}</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
