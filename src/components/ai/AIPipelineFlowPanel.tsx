import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Brain,
  BookOpen,
  Cpu,
  Sparkles,
  Lock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Layers,
  Activity,
  Check,
  Slash,
} from 'lucide-react';

export interface AIPipelineStep {
  step: number;
  id: string;
  name: string;
  category?: string;
  status:
    | 'PASS'
    | 'BLOCKED'
    | 'FLAGGED'
    | 'CACHE_HIT'
    | 'CACHE_MISS'
    | 'GROUNDED'
    | 'RERANKED'
    | 'GENERATED'
    | 'SKIPPED'
    | 'RUNNING'
    | 'IDLE';
  latencyMs?: number;
  details?: string;
}

export interface AIPipelineFlowPanelProps {
  steps?: AIPipelineStep[];
  isLoading?: boolean;
  totalLatencyMs?: number;
  modelUsed?: string;
  rerankUsed?: boolean;
  fastPathHit?: boolean;
  compact?: boolean;
  className?: string;
  title?: string;
}

const DEFAULT_10_STEPS: AIPipelineStep[] = [
  {
    step: 1,
    id: 'input_validation',
    name: 'Khử khuẩn Đầu vào & Giới hạn Token',
    category: 'GUARD',
    status: 'IDLE',
    details: 'Chuẩn hóa Unicode, lọc ký tự điều khiển và áp dụng giới hạn Max 4,096 tokens.',
  },
  {
    step: 2,
    id: 'security_gateway',
    name: 'Quét An ninh & Prompt Injection Guard',
    category: 'SECURITY',
    status: 'IDLE',
    details: 'Phát hiện tấn công Direct/Indirect Injection, DAN Jailbreak, đánh cắp System Prompt.',
  },
  {
    step: 3,
    id: 'domain_scope',
    name: 'Ranh giới Đề thi AWS SAA-C03',
    category: 'GUARD',
    status: 'IDLE',
    details: 'Kiểm tra câu hỏi có thuộc phạm vi kiến trúc AWS Solutions Architect Associate.',
  },
  {
    step: 4,
    id: 'prompt_rewriter',
    name: 'Tối ưu Câu hỏi & Viết tắt AWS',
    category: 'UNDERSTANDING',
    status: 'IDLE',
    details: 'Chuẩn hóa từ viết tắt (ALB, S3, RDS, ASG) và xác định Intent / Topic.',
  },
  {
    step: 5,
    id: 'semantic_cache',
    name: 'Bộ nhớ đệm Ngữ nghĩa (Semantic Cache)',
    category: 'CACHE',
    status: 'IDLE',
    details: 'Tra cứu câu hỏi tương đồng ≥ 88% để kích hoạt Fast Path 0ms.',
  },
  {
    step: 6,
    id: 'memory_check',
    name: 'Bộ nhớ Câu hỏi & Lịch sử Đính chính',
    category: 'MEMORY',
    status: 'IDLE',
    details: 'Đối chiếu các câu hỏi học viên từng hỏi và các lỗi sai cũ cần tránh lặp lại.',
  },
  {
    step: 7,
    id: 'rag_retrieval',
    name: 'Truy xuất RAG Tri thức AWS',
    category: 'RETRIEVAL',
    status: 'IDLE',
    details: 'Trích xuất Top-K ngữ cảnh từ 1,019 câu hỏi SAA và 42 cẩm nang dịch vụ AWS.',
  },
  {
    step: 8,
    id: 'cohere_rerank',
    name: 'Cohere Rerank V3.5 Engine',
    category: 'RERANK',
    status: 'IDLE',
    details: 'Tái xếp hạng sâu Top-K thành Top-N đoạn liên quan nhất để tối ưu độ chính xác.',
  },
  {
    step: 9,
    id: 'llm_generation',
    name: 'Tạo sinh Phản hồi AI An toàn',
    category: 'GENERATION',
    status: 'IDLE',
    details: 'Đóng khung dữ liệu UNTRUSTED_REFERENCE_DATA, gọi Gemini / OpenAI / Knowledge Engine.',
  },
  {
    step: 10,
    id: 'output_guard',
    name: 'Kiểm định Chống Ảo giác & Output Guard',
    category: 'OUTPUT_GUARD',
    status: 'IDLE',
    details: 'Xác thực Grounding, quét chống rò rỉ secret, chặn PII và làm sạch XSS.',
  },
];

export const AIPipelineFlowPanel: React.FC<AIPipelineFlowPanelProps> = ({
  steps,
  isLoading = false,
  totalLatencyMs,
  modelUsed,
  rerankUsed,
  fastPathHit,
  className = '',
  title = 'Luồng Xử Lý AI (Pipeline 10 Giai Đoạn)',
}) => {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [runningStepIndex, setRunningStepIndex] = useState<number>(0);
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  React.useEffect(() => {
    if (!isLoading) {
      setRunningStepIndex(0);
      setElapsedMs(0);
      return;
    }
    const start = performance.now();
    const timerInterval = setInterval(() => {
      setElapsedMs(Math.round(performance.now() - start));
    }, 60);

    const stepInterval = setInterval(() => {
      setRunningStepIndex((prev) => (prev < 9 ? prev + 1 : prev));
    }, 650);

    return () => {
      clearInterval(timerInterval);
      clearInterval(stepInterval);
    };
  }, [isLoading]);

  const activeSteps = React.useMemo(() => {
    if (steps && steps.length > 0 && !isLoading) return steps;
    if (isLoading) {
      return DEFAULT_10_STEPS.map((step, idx) => {
        if (idx < runningStepIndex) {
          return {
            ...step,
            status: 'PASS' as const,
            latencyMs: Math.max(1, Math.round(10 + idx * 15)),
            details: `Đã hoàn tất kiểm định giai đoạn ${step.step} (${step.name})`,
          };
        }
        if (idx === runningStepIndex) {
          return {
            ...step,
            status: 'RUNNING' as const,
            details: `Đang phân tích và xử lý realtime giai đoạn ${step.step}...`,
          };
        }
        return { ...step, status: 'IDLE' as const };
      });
    }
    return DEFAULT_10_STEPS;
  }, [steps, isLoading, runningStepIndex]);

  const toggleExpand = (stepNumber: number) => {
    setExpandedStep((prev) => (prev === stepNumber ? null : stepNumber));
  };

  const getStepIcon = (step: AIPipelineStep) => {
    switch (step.id) {
      case 'input_validation':
      case 'rate_limit':
        return <Lock className="h-3.5 w-3.5" />;
      case 'security_gateway':
      case 'security':
        return step.status === 'BLOCKED' ? (
          <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
        ) : (
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        );
      case 'domain_scope':
      case 'domain':
        return <Activity className="h-3.5 w-3.5" />;
      case 'prompt_rewriter':
      case 'rewrite':
        return <Layers className="h-3.5 w-3.5" />;
      case 'semantic_cache':
      case 'cache':
        return <Zap className="h-3.5 w-3.5 text-purple-500" />;
      case 'memory_check':
      case 'memory':
        return <Brain className="h-3.5 w-3.5 text-amber-500" />;
      case 'rag_retrieval':
      case 'rag':
        return <BookOpen className="h-3.5 w-3.5 text-blue-500" />;
      case 'cohere_rerank':
      case 'rerank':
        return <Cpu className="h-3.5 w-3.5 text-indigo-500" />;
      case 'llm_generation':
      case 'generation':
        return <Sparkles className="h-3.5 w-3.5 text-amber-500" />;
      case 'output_guard':
      default:
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    }
  };

  const getStatusBadge = (status: AIPipelineStep['status']) => {
    switch (status) {
      case 'PASS':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Check className="h-2.5 w-2.5" />
            PASS
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse">
            <ShieldAlert className="h-2.5 w-2.5" />
            BLOCKED
          </span>
        );
      case 'FLAGGED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <AlertTriangle className="h-2.5 w-2.5" />
            FLAGGED
          </span>
        );
      case 'CACHE_HIT':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
            <Zap className="h-2.5 w-2.5" />
            CACHE HIT
          </span>
        );
      case 'CACHE_MISS':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            MISS
          </span>
        );
      case 'GROUNDED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="h-2.5 w-2.5" />
            GROUNDED
          </span>
        );
      case 'RERANKED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
            <Cpu className="h-2.5 w-2.5" />
            RERANKED
          </span>
        );
      case 'GENERATED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            <Sparkles className="h-2.5 w-2.5" />
            GENERATED
          </span>
        );
      case 'SKIPPED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-800/50 dark:text-slate-500">
            <Slash className="h-2.5 w-2.5" />
            SKIPPED
          </span>
        );
      case 'RUNNING':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
            <RefreshCw className="h-2.5 w-2.5 animate-spin" />
            RUNNING
          </span>
        );
      case 'IDLE':
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-500">
            SẴN SÀNG
          </span>
        );
    }
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-none">
              {title}
            </h4>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {isLoading
                ? `⚡ Đang chạy realtime: ${elapsedMs}ms • Giai đoạn ${Math.min(10, runningStepIndex + 1)}/10: ${DEFAULT_10_STEPS[runningStepIndex]?.name || 'Xử lý'}`
                : totalLatencyMs !== undefined
                ? `Độ trễ: ${totalLatencyMs}ms • Model: ${modelUsed || 'Gemini/Local'}`
                : '10 chặng kiểm định an ninh & tri thức'}
            </span>
          </div>
        </div>

        {fastPathHit && (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
            <Zap className="h-3 w-3" />
            0ms FAST PATH
          </span>
        )}
      </div>

      {/* Meta Telemetry Bar (if executed) */}
      {(totalLatencyMs !== undefined || rerankUsed) && (
        <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2 text-center text-[10px] dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
          <div>
            <span className="block text-slate-400">Tổng Độ Trễ</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
              {totalLatencyMs}ms
            </span>
          </div>
          <div>
            <span className="block text-slate-400">Rerank Engine</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {rerankUsed ? 'Cohere v3.5' : 'Direct RAG'}
            </span>
          </div>
          <div>
            <span className="block text-slate-400">Mô Hình AI</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block">
              {modelUsed || 'Gemini'}
            </span>
          </div>
        </div>
      )}

      {/* Steps List */}
      <div className="space-y-2 overflow-y-auto max-h-[620px] pr-1">
        {activeSteps.map((step, idx) => {
          const isExpanded = expandedStep === step.step;
          const isLast = idx === activeSteps.length - 1;

          return (
            <div key={step.id || step.step} className="relative">
              {/* Connector line between steps */}
              {!isLast && (
                <div
                  className={`absolute left-[17px] top-[30px] bottom-[-8px] w-0.5 transition-colors z-0 ${
                    step.status === 'PASS' || step.status === 'GROUNDED' || step.status === 'CACHE_HIT'
                      ? 'bg-emerald-300 dark:bg-emerald-800'
                      : step.status === 'BLOCKED'
                      ? 'bg-rose-300 dark:bg-rose-800'
                      : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                />
              )}

              {/* Step Card */}
              <div
                onClick={() => toggleExpand(step.step)}
                className={`relative z-10 flex cursor-pointer flex-col rounded-xl border p-2.5 transition-all ${
                  isExpanded
                    ? 'border-indigo-400 bg-indigo-50/40 dark:border-indigo-600 dark:bg-indigo-950/20 shadow-xs'
                    : step.status === 'BLOCKED'
                    ? 'border-rose-300 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20'
                    : step.status === 'CACHE_HIT'
                    ? 'border-purple-300 bg-purple-50/50 dark:border-purple-900/60 dark:bg-purple-950/20'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-850/50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Step Number Circle */}
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                        step.status === 'PASS' || step.status === 'GROUNDED'
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : step.status === 'CACHE_HIT'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : step.status === 'BLOCKED'
                          ? 'bg-rose-500 text-white shadow-xs'
                          : step.status === 'FLAGGED'
                          ? 'bg-amber-500 text-white'
                          : step.status === 'RERANKED' || step.status === 'GENERATED'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {step.step}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="shrink-0 text-slate-500 dark:text-slate-400">
                          {getStepIcon(step)}
                        </span>
                        <span className="truncate text-xs font-bold text-slate-900 dark:text-white">
                          {step.name}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {step.latencyMs !== undefined && step.latencyMs > 0 && (
                      <span className="font-mono text-[10px] text-slate-400">
                        {step.latencyMs}ms
                      </span>
                    )}
                    {getStatusBadge(step.status)}
                    <span className="text-slate-400">
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && step.details && (
                  <div className="mt-2.5 rounded-lg border border-slate-200/80 bg-white p-2.5 text-[11px] leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Chi tiết xử lý:
                    </div>
                    <div>{step.details}</div>
                    {step.latencyMs !== undefined && (
                      <div className="mt-1.5 text-[10px] text-slate-400 flex items-center gap-2">
                        <span>Thời gian thực thi: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{step.latencyMs}ms</strong></span>
                        <span>•</span>
                        <span>Phân loại: <strong className="uppercase">{step.category || 'PIPELINE'}</strong></span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
