import React, { useState } from 'react';
import {
  X,
  Bot,
  Copy,
  Check,
  Clock,
  User,
  HelpCircle,
  Sparkles,
  Server,
} from 'lucide-react';
import { AIMarkdownRenderer } from './AIMarkdownRenderer';
import { MODE_METADATA } from '../../core/aiConfigStorage';

interface AIInspectQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: {
    id: string;
    userId?: string | null;
    username: string;
    ipAddress?: string | null;
    questionId?: number | null;
    prompt: string;
    response?: string | null;
    mode?: string | null;
    provider?: string | null;
    createdAt: number;
  } | null;
}

export const AIInspectQueryModal: React.FC<AIInspectQueryModalProps> = ({
  isOpen,
  onClose,
  query,
}) => {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);

  if (!isOpen || !query) return null;

  const handleCopyPrompt = () => {
    if (query.prompt) {
      void navigator.clipboard.writeText(query.prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  const handleCopyResponse = () => {
    if (query.response) {
      void navigator.clipboard.writeText(query.response);
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 2000);
    }
  };

  const modeKey = (query.mode || 'explain') as keyof typeof MODE_METADATA;
  const modeMeta = MODE_METADATA[modeKey] || MODE_METADATA.explain;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative flex flex-col w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm font-bold">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Chi Tiết Phiên Hỏi Đáp: Người Học & AI Tutor</span>
                <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-950/70 dark:text-purple-300">
                  ID: {query.id}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Toàn văn câu hỏi của học viên và câu trả lời tương ứng từ hệ thống
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Metadata Badges Bar */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs shrink-0">
          {/* User Info */}
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <User className="h-3.5 w-3.5 text-slate-500" />
            <span>Người hỏi: <strong>{query.username}</strong></span>
            {query.ipAddress && (
              <span className="text-[10px] text-slate-400 font-mono">({query.ipAddress})</span>
            )}
          </span>

          {/* Time Info */}
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span>{new Date(query.createdAt).toLocaleString('vi-VN')}</span>
          </span>

          {/* Context Info */}
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
            <HelpCircle className="h-3.5 w-3.5 text-blue-600" />
            <span>{query.questionId ? `Ngữ cảnh: Câu #${query.questionId}` : 'Hỏi tự do'}</span>
          </span>

          {/* Mode Info */}
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-50 px-2.5 py-1 font-semibold text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50">
            <Sparkles className="h-3.5 w-3.5 text-purple-600" />
            <span>Chế độ: <strong>{modeMeta.shortLabel}</strong></span>
          </span>

          {/* Model / Provider */}
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
            <Server className="h-3.5 w-3.5 text-amber-600" />
            <span>AI: <strong>{query.provider || 'local_rag'}</strong></span>
          </span>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Section 1: User Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-blue-600" />
                <span>Nội dung câu hỏi của người học (Prompt Input):</span>
              </span>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {copiedPrompt ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Đã sao chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Sao chép câu hỏi</span>
                  </>
                )}
              </button>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-slate-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-slate-100 leading-relaxed whitespace-pre-wrap font-medium text-xs sm:text-sm">
              {query.prompt}
            </div>
          </div>

          {/* Section 2: AI Response Output */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5 text-purple-600" />
                <span>Câu trả lời của AI Tutor (AI Output):</span>
              </span>
              {query.response && (
                <button
                  type="button"
                  onClick={handleCopyResponse}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {copiedResponse ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Sao chép phản hồi</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {query.response ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-950/80 leading-relaxed text-slate-900 dark:text-slate-100">
                <AIMarkdownRenderer
                  content={query.response}
                  isAssistant={true}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                Chưa ghi nhận nội dung câu trả lời (hoặc câu hỏi đang trong quá trình xử lý).
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-200 px-6 py-3 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors shadow-xs"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};
