import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Send,
  X,
  Minimize2,
  Maximize2,
  RotateCcw,
  Copy,
  Check,
  Paperclip,
  Monitor,
  Camera,
  Settings,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  Bot,
  Image as ImageIcon,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Zap,
  Edit3,
  Brain,
  GripVertical,
  Plus,
  MessageSquare,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type { Question } from '../../core/types';
import {
  type AITutorConfig,
  getAITutorConfig,
  MODE_METADATA,
} from '../../core/aiConfigStorage';
import {
  type AIChatMessage,
  type AIChatThread,
  getAIThreads,
  saveAIThreads,
  createDefaultThread,
  getActiveThreadId,
  saveActiveThreadId,
  getThreadsStorageKey,
} from '../../core/aiConversationStorage';
import { openChatPopout } from '../../core/chatWindow';
import { buildAIPromptContext, generateKnowledgeEngineResponse } from '../../core/aiRagEngine';
import { sendAITutorMessage } from '../../core/aiClient';
import { aiApi, getStoredUser } from '../../core/api';
import { realtimeManager } from '../../core/realtime';
import { AISettingsModal } from './AISettingsModal';
import { AIFeedbackModal, type AIFeedbackSubmitData } from './AIFeedbackModal';
import { AIMarkdownRenderer } from './AIMarkdownRenderer';
import { cleanupAnyRogueMermaidElements } from './mermaidSanitizer';
import { AIPipelineFlowPanel } from './AIPipelineFlowPanel';

const AI_ICON_SIZE = 50;
const STORAGE_KEY_AI_ICON_POS = 'aws_ai_tutor_icon_pos';

interface IconPosition {
  x: number;
  y: number;
}

function clampIconPosition(x: number, y: number, size = AI_ICON_SIZE): IconPosition {
  if (typeof window === 'undefined') return { x, y };
  const margin = 10;
  const maxX = Math.max(margin, window.innerWidth - size - margin);
  const maxY = Math.max(margin, window.innerHeight - size - margin);
  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY),
  };
}

function getDefaultIconPosition(size = AI_ICON_SIZE): IconPosition {
  if (typeof window === 'undefined') return { x: 100, y: 100 };
  const isMobile = window.innerWidth < 640;
  return clampIconPosition(
    window.innerWidth - size - 16,
    window.innerHeight - (isMobile ? 128 : 76),
    size
  );
}

const STORAGE_KEY_AI_PANEL_POS = 'aws_ai_tutor_panel_pos';

interface PanelPosition {
  x: number;
  y: number;
}

function getPanelDimensions(showFlowPanel: boolean): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 460, height: 640 };
  const width = Math.min(window.innerWidth - 20, showFlowPanel ? 900 : 460);
  const height = Math.min(window.innerHeight - 20, showFlowPanel ? 680 : 640);
  return { width, height };
}

function clampPanelPosition(x: number, y: number, showFlowPanel: boolean): PanelPosition {
  if (typeof window === 'undefined') return { x, y };
  const { width, height } = getPanelDimensions(showFlowPanel);
  const margin = 10;
  const maxX = Math.max(margin, window.innerWidth - width - margin);
  const maxY = Math.max(margin, window.innerHeight - height - margin);
  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY),
  };
}

function getDefaultPanelPosition(showFlowPanel: boolean): PanelPosition {
  if (typeof window === 'undefined') return { x: 100, y: 100 };
  const { width, height } = getPanelDimensions(showFlowPanel);
  return clampPanelPosition(
    window.innerWidth - width - 16,
    window.innerHeight - height - 16,
    showFlowPanel
  );
}

interface AITutorChatboxProps {
  userId: string;
  currentQuestion?: Question;
  selectedAnswer?: string;
  isSubmitted?: boolean;
  isCorrect?: boolean;
  userNotes?: string;
  learnerAnalytics?: {
    accuracyPercent?: number;
    weakTopics?: string[];
  };
  isOpen: boolean;
  onToggleOpen: () => void;
  currentMode?: string;
  /** Bật khi chatbox chạy trong cửa sổ trình duyệt riêng (/ai-chat). */
  popout?: boolean;
}

interface ChatMessageItemProps {
  msg: AIChatMessage;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
  onThumbsUp: (msg: AIChatMessage) => void;
  onOpenFeedback: (msg: AIChatMessage) => void;
  onOpenCorrection: (msg: AIChatMessage) => void;
  onRegenerate: (msg: AIChatMessage) => void;
  onViewPipelineFlow: (msg: AIChatMessage) => void;
}

const renderConfidenceBadge = (confidence?: string, score?: number) => {
  if (!confidence) return null;
  switch (confidence) {
    case 'VERIFIED':
      return (
        <span
          title={`Câu trả lời đã qua kiểm chứng đối chiếu tài liệu AWS (${Math.round((score ?? 1) * 100)}%)`}
          className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
        >
          <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          <span>Đã xác thực (100%)</span>
        </span>
      );
    case 'HIGH':
      return (
        <span
          title={`Độ tin cậy cao dựa trên RAG (${Math.round((score ?? 0.9) * 100)}%)`}
          className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
        >
          <CheckCircle2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
          <span>Độ tin cậy cao ({Math.round((score ?? 0.9) * 100)}%)</span>
        </span>
      );
    case 'MEDIUM':
      return (
        <span
          title={`Độ tin cậy trung bình (${Math.round((score ?? 0.7) * 100)}%)`}
          className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
        >
          <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          <span>Độ tin cậy vừa ({Math.round((score ?? 0.7) * 100)}%)</span>
        </span>
      );
    case 'LOW':
    default:
      return (
        <span
          title="Độ tin cậy thấp, cần đối chiếu kỹ tài liệu AWS"
          className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
        >
          <AlertCircle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
          <span>Cần đối chiếu thêm</span>
        </span>
      );
  }
};

const ChatMessageItem = React.memo<ChatMessageItemProps>(({
  msg,
  copiedId,
  onCopy,
  onThumbsUp,
  onOpenFeedback,
  onOpenCorrection,
  onRegenerate,
  onViewPipelineFlow,
}) => {
  const isAssistant = msg.role === 'assistant';
  return (
    <div className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}>
      <div
        className={`relative max-w-[92%] rounded-2xl p-3.5 shadow-sm leading-relaxed ${
          isAssistant
            ? 'bg-slate-50 text-slate-900 border border-slate-200 dark:bg-slate-800/60 dark:text-slate-100 dark:border-slate-800'
            : 'bg-blue-600 text-white'
        }`}
      >
        {/* Assistant Header Badges: Confidence, Semantic Cache, Cohere */}
        {isAssistant && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b border-slate-200/60 pb-2 dark:border-slate-700/50">
            {renderConfidenceBadge(msg.confidence, msg.confidenceScore)}
            {msg.fastPathHit && (
              <span
                title="Phản hồi tức thì từ Semantic Cache"
                className="inline-flex items-center gap-1 rounded-full border border-purple-300 bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
              >
                <Zap className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                <span>Semantic Cache</span>
              </span>
            )}
            {msg.telemetry?.rerankUsed && (
              <span
                title="Đã qua bộ định vị ngữ nghĩa Cohere Rerank"
                className="inline-flex items-center gap-1 rounded-full border border-indigo-300 bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
              >
                <span>Cohere Rerank</span>
              </span>
            )}
          </div>
        )}

        {/* Related Memory Pill */}
        {isAssistant && msg.memoryMatch && (
          <div className="mb-2.5 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50/80 p-2 text-[11px] text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
            <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="leading-tight">
              <span className="font-bold">Khớp tri thức trước đó: </span>
              <span className="opacity-90">{msg.memoryMatch.matchedQuestion || msg.memoryMatch.question || 'Câu hỏi tương tự trong ngân hàng'}</span>
              {typeof msg.memoryMatch.similarityScore === 'number' && (
                <span className="ml-1 font-semibold text-[10px] opacity-75">
                  ({Math.round(msg.memoryMatch.similarityScore * 100)}% khớp)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Attached Image preview in message */}
        {msg.attachedImage && (
          <div className="mb-2 overflow-hidden rounded-xl border border-white/20 max-w-xs">
            <img
              src={msg.attachedImage.dataUrl}
              alt={msg.attachedImage.name}
              className="w-full object-cover max-h-48"
            />
          </div>
        )}

        {/* Message Content (Rich Markdown, Callouts, and Mermaid Diagrams) */}
        <AIMarkdownRenderer
          content={msg.content}
          isAssistant={isAssistant}
        />

        {/* Citations & Sources list if available */}
        {msg.citations && msg.citations.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/80 space-y-1">
            <span className="block font-bold text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Nguồn Tham Chiếu Xác Thực (RAG Sources):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {msg.citations.map((c, i) => (
                <span
                  key={i}
                  title={c.snippet}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-700/60 dark:text-slate-300"
                >
                  <span>[{i + 1}] {c.title}</span>
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-600">
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Bar for AI message */}
        {isAssistant && (
          <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/40 flex items-center justify-between text-slate-400 text-[11px]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onCopy(msg.id, msg.content)}
                title="Sao chép câu trả lời"
                className="flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-colors"
              >
                {copiedId === msg.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                <span>{copiedId === msg.id ? 'Đã sao chép' : 'Sao chép'}</span>
              </button>

              <button
                type="button"
                onClick={() => onRegenerate(msg)}
                title="Tạo lại câu trả lời"
                className="flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Tạo lại</span>
              </button>
            </div>

            {/* Thumbs up / down / edit correction feedback */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onThumbsUp(msg)}
                disabled={msg.feedback?.helpful === true}
                className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors ${
                  msg.feedback?.helpful === true ? 'text-emerald-500 font-bold' : 'hover:text-emerald-600'
                }`}
                title="Đúng & Hữu ích"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onOpenFeedback(msg)}
                disabled={msg.feedback?.helpful === false}
                className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors ${
                  msg.feedback?.helpful === false ? 'text-rose-500 font-bold' : 'hover:text-rose-600'
                }`}
                title="Chưa đúng / Báo lỗi"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onOpenCorrection(msg)}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer hover:text-amber-500 transition-colors"
                title="Đóng góp câu trả lời chuẩn (AI Correction)"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onViewPipelineFlow(msg)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 font-bold text-[10px] cursor-pointer transition-colors border border-indigo-200 dark:border-indigo-800"
                title="Soi luồng xử lý AI 10 giai đoạn cho câu trả lời này"
              >
                <Zap className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                <span>Luồng AI</span>
              </button>
            </div>
          </div>
        )}
      </div>
      <span className="mt-1 text-[10px] text-slate-400 px-1">
        {new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
});

export const AITutorChatbox: React.FC<AITutorChatboxProps> = ({
  userId,
  currentQuestion,
  selectedAnswer,
  isSubmitted,
  isCorrect,
  userNotes,
  learnerAnalytics,
  isOpen,
  onToggleOpen,
  currentMode,
  popout = false,
}) => {
  // Window states
  const [isMinimized, setIsMinimized] = useState(false);
  // Cửa sổ rời luôn chiếm trọn khung, không cho thu nhỏ hay kéo thả
  const [isExpanded, setIsExpanded] = useState(popout);
  const [showFlowPanel, setShowFlowPanel] = useState(false);
  const [selectedFlowMessage, setSelectedFlowMessage] = useState<AIChatMessage | null>(null);

  const handleViewPipelineFlow = useCallback((msg: AIChatMessage) => {
    setSelectedFlowMessage(msg);
    setShowFlowPanel(true);
  }, []);

  // Configuration state
  const [config, setConfig] = useState<AITutorConfig>(() => getAITutorConfig(userId));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Multi-process / Multi-thread State
  const [threads, setThreads] = useState<AIChatThread[]>(() => getAIThreads(userId));
  const [activeThreadId, setActiveThreadId] = useState<string>(() => {
    const savedActiveId = getActiveThreadId(userId);
    const initialThreads = getAIThreads(userId);
    if (savedActiveId && initialThreads.some((t) => t.id === savedActiveId)) {
      return savedActiveId;
    }
    return initialThreads[0]?.id || '';
  });

  // Track background loading & unread notifications per thread
  const [loadingThreadIds, setLoadingThreadIds] = useState<Record<string, boolean>>({});
  const [unreadThreadIds, setUnreadThreadIds] = useState<Record<string, boolean>>({});

  // Inline thread title editing state
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Active thread helper variables
  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0] || createDefaultThread('Tiến trình 1');
  const messages = activeThread.messages || [];
  const isLoading = Boolean(loadingThreadIds[activeThread.id]);

  // Draft input and attached image for active thread
  const [inputQuery, setInputQuery] = useState(() => activeThread.inputDraft || '');
  const [attachedImage, setAttachedImage] = useState<{ name: string; dataUrl: string } | null>(() => activeThread.attachedImageDraft || null);

  // Refs to maintain latest state across async callbacks
  const activeThreadIdRef = useRef(activeThreadId);
  const threadsRef = useRef(threads);
  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  // Copy and Feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackTargetMessage, setFeedbackTargetMessage] = useState<AIChatMessage | null>(null);
  const [isCorrectionMode, setIsCorrectionMode] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handleSendMessageRef = useRef<(queryText?: string, targetThreadId?: string) => Promise<void>>(async () => {});

  // Draggable floating icon position & drag refs
  const [iconPosition, setIconPosition] = useState<IconPosition>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem(STORAGE_KEY_AI_ICON_POS);
        if (saved) {
          const parsed = JSON.parse(saved) as { x: number; y: number };
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            return clampIconPosition(parsed.x, parsed.y);
          }
        }
      }
    } catch {
      // Fallback
    }
    return getDefaultIconPosition();
  });

  const [isIconDragging, setIsIconDragging] = useState(false);
  const iconDragRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    hasMoved: boolean;
  } | null>(null);

  // Draggable floating panel position & drag refs
  const [panelPosition, setPanelPosition] = useState<PanelPosition>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem(STORAGE_KEY_AI_PANEL_POS);
        if (saved) {
          const parsed = JSON.parse(saved) as { x: number; y: number };
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            return clampPanelPosition(parsed.x, parsed.y, false);
          }
        }
      }
    } catch {
      // Fallback
    }
    return getDefaultPanelPosition(false);
  });

  const [isPanelDragging, setIsPanelDragging] = useState(false);
  const panelDragRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    hasMoved: boolean;
  } | null>(null);

  // Re-clamp position on window resize
  useEffect(() => {
    const handleResize = () => {
      setIconPosition((prev) => clampIconPosition(prev.x, prev.y));
      setPanelPosition((prev) => clampPanelPosition(prev.x, prev.y, showFlowPanel));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showFlowPanel]);

  const handleIconPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    iconDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: iconPosition.x,
      initialY: iconPosition.y,
      hasMoved: false,
    };
  };

  const handleIconPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!iconDragRef.current) return;
    const dx = e.clientX - iconDragRef.current.startX;
    const dy = e.clientY - iconDragRef.current.startY;
    const dist = Math.hypot(dx, dy);

    if (dist > 4) {
      if (!iconDragRef.current.hasMoved) {
        iconDragRef.current.hasMoved = true;
        setIsIconDragging(true);
      }
      const newPos = clampIconPosition(
        iconDragRef.current.initialX + dx,
        iconDragRef.current.initialY + dy
      );
      setIconPosition(newPos);
    }
  };

  const handleIconPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!iconDragRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const wasMoved = iconDragRef.current.hasMoved;
    iconDragRef.current = null;
    setIsIconDragging(false);

    if (wasMoved) {
      try {
        localStorage.setItem(STORAGE_KEY_AI_ICON_POS, JSON.stringify(iconPosition));
      } catch {
        // Ignore
      }
    } else {
      // Click / Tap triggered without significant drag
      if (isMinimized) {
        setIsMinimized(false);
      } else {
        onToggleOpen();
      }
    }
  };

  const handleIconPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    iconDragRef.current = null;
    setIsIconDragging(false);
  };

  // Draggable panel header handlers
  const handlePanelHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isExpanded) return;
    if (typeof window !== 'undefined' && window.innerWidth < 640) return;
    if ((e.target as HTMLElement).closest('button, input, textarea, select, a')) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    panelDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: panelPosition.x,
      initialY: panelPosition.y,
      hasMoved: false,
    };
  };

  const handlePanelHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panelDragRef.current || isExpanded) return;
    const dx = e.clientX - panelDragRef.current.startX;
    const dy = e.clientY - panelDragRef.current.startY;
    const dist = Math.hypot(dx, dy);

    if (dist > 3) {
      if (!panelDragRef.current.hasMoved) {
        panelDragRef.current.hasMoved = true;
        setIsPanelDragging(true);
      }
      const newPos = clampPanelPosition(
        panelDragRef.current.initialX + dx,
        panelDragRef.current.initialY + dy,
        showFlowPanel
      );
      setPanelPosition(newPos);
    }
  };

  const handlePanelHeaderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panelDragRef.current) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    const wasMoved = panelDragRef.current.hasMoved;
    panelDragRef.current = null;
    setIsPanelDragging(false);

    if (wasMoved) {
      try {
        localStorage.setItem(STORAGE_KEY_AI_PANEL_POS, JSON.stringify(panelPosition));
      } catch {
        // Ignore
      }
    }
  };

  const handlePanelHeaderPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panelDragRef.current) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      panelDragRef.current = null;
      setIsPanelDragging(false);
    }
  };

  const handleResetPanelPosition = () => {
    const defaultPos = getDefaultPanelPosition(showFlowPanel);
    setPanelPosition(defaultPos);
    try {
      localStorage.setItem(STORAGE_KEY_AI_PANEL_POS, JSON.stringify(defaultPos));
    } catch {
      // Ignore
    }
  };

  // Reload config and threads when userId changes (derived during render)
  const [prevUserId, setPrevUserId] = useState(userId);
  if (prevUserId !== userId) {
    setPrevUserId(userId);
    setConfig(getAITutorConfig(userId));
    const loadedThreads = getAIThreads(userId);
    setThreads(loadedThreads);
    const activeId = getActiveThreadId(userId) || loadedThreads[0]?.id || '';
    setActiveThreadId(activeId);
    const cur = loadedThreads.find((t) => t.id === activeId) || loadedThreads[0];
    setInputQuery(cur?.inputDraft || '');
    setAttachedImage(cur?.attachedImageDraft || null);
  }

  // Scroll to bottom on new message or thread switch
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isOpen, isMinimized, activeThreadId]);

  // --- Đồng bộ hội thoại giữa cửa sổ chính và cửa sổ rời ---
  // Hai cửa sổ cùng origin nên dùng chung localStorage. Sự kiện `storage` chỉ
  // bắn sang CÁC cửa sổ khác, nên không sợ vòng lặp ghi đè chính mình.
  const inputQueryRef = useRef(inputQuery);
  const attachedImageRef = useRef(attachedImage);
  const loadingThreadIdsRef = useRef(loadingThreadIds);
  useEffect(() => {
    inputQueryRef.current = inputQuery;
  }, [inputQuery]);
  useEffect(() => {
    attachedImageRef.current = attachedImage;
  }, [attachedImage]);
  useEffect(() => {
    loadingThreadIdsRef.current = loadingThreadIds;
  }, [loadingThreadIds]);

  useEffect(() => {
    const threadsKey = getThreadsStorageKey(userId);

    const handleStorageSync = (e: StorageEvent) => {
      if (e.key !== threadsKey || !e.newValue) return;

      // Cửa sổ này đang chờ AI trả lời -> bỏ qua để không cắt ngang luồng đang chạy
      if (Object.values(loadingThreadIdsRef.current).some(Boolean)) return;

      let incoming: AIChatThread[];
      try {
        incoming = JSON.parse(e.newValue);
      } catch {
        return;
      }
      if (!Array.isArray(incoming) || incoming.length === 0) return;

      // Giữ nguyên nội dung đang gõ dở ở cửa sổ này
      const localActiveId = activeThreadIdRef.current;
      setThreads(
        incoming.map((t) =>
          t.id === localActiveId
            ? { ...t, inputDraft: inputQueryRef.current, attachedImageDraft: attachedImageRef.current }
            : t
        )
      );

      // Tiến trình đang mở bị cửa sổ kia xoá -> nhảy sang tiến trình khác
      if (!incoming.some((t) => t.id === localActiveId)) {
        setActiveThreadId(getActiveThreadId(userId) || incoming[0].id);
      }
    };

    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, [userId]);

  // Switch to a different thread
  const handleSwitchThread = (nextThreadId: string) => {
    if (nextThreadId === activeThreadId) return;

    // Save current drafts into the current thread
    const updatedThreads = threadsRef.current.map((t) =>
      t.id === activeThreadId
        ? { ...t, inputDraft: inputQuery, attachedImageDraft: attachedImage }
        : t
    );
    setThreads(updatedThreads);
    saveAIThreads(userId, updatedThreads, nextThreadId);

    const nextThread = updatedThreads.find((t) => t.id === nextThreadId);
    setInputQuery(nextThread?.inputDraft || '');
    setAttachedImage(nextThread?.attachedImageDraft || null);
    setActiveThreadId(nextThreadId);
    saveActiveThreadId(userId, nextThreadId);

    // Clear unread flag for this opened thread
    setUnreadThreadIds((prev) => ({ ...prev, [nextThreadId]: false }));

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  // Create a brand new thread
  const handleCreateNewThread = () => {
    const currentThreads = threadsRef.current;
    // Save draft of current thread
    const updatedThreads = currentThreads.map((t) =>
      t.id === activeThreadId
        ? { ...t, inputDraft: inputQuery, attachedImageDraft: attachedImage }
        : t
    );

    const nextIndex = updatedThreads.length + 1;
    const newThread = createDefaultThread(`Tiến trình ${nextIndex}`);
    const nextThreads = [...updatedThreads, newThread];

    setThreads(nextThreads);
    setActiveThreadId(newThread.id);
    setInputQuery('');
    setAttachedImage(null);
    saveAIThreads(userId, nextThreads, newThread.id);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 80);
  };

  // Close / Delete a thread
  const handleCloseThread = (e: React.MouseEvent, threadIdToClose: string) => {
    e.stopPropagation();

    const currentThreads = threadsRef.current;
    if (currentThreads.length <= 1) {
      if (window.confirm('Bạn có muốn làm mới tiến trình này không?')) {
        const fresh = createDefaultThread('Tiến trình 1');
        setThreads([fresh]);
        setActiveThreadId(fresh.id);
        setInputQuery('');
        setAttachedImage(null);
        saveAIThreads(userId, [fresh], fresh.id);
      }
      return;
    }

    const threadToClose = currentThreads.find((t) => t.id === threadIdToClose);
    if (threadToClose && threadToClose.messages.length > 0) {
      if (!window.confirm(`Bạn có chắc muốn đóng "${threadToClose.title}"?`)) {
        return;
      }
    }

    const remainingThreads = currentThreads.filter((t) => t.id !== threadIdToClose);
    let nextActiveId = activeThreadId;

    if (activeThreadId === threadIdToClose) {
      const nextThread = remainingThreads[remainingThreads.length - 1];
      nextActiveId = nextThread.id;
      setInputQuery(nextThread.inputDraft || '');
      setAttachedImage(nextThread.attachedImageDraft || null);
    }

    setThreads(remainingThreads);
    setActiveThreadId(nextActiveId);
    saveAIThreads(userId, remainingThreads, nextActiveId);
  };

  // Inline rename thread
  const handleStartRename = (e: React.MouseEvent, threadId: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingThreadId(threadId);
    setEditingTitle(currentTitle);
  };

  const handleSaveRename = (threadId: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      setThreads((prev) => {
        const updated = prev.map((t) => (t.id === threadId ? { ...t, title: trimmed } : t));
        saveAIThreads(userId, updated, activeThreadId);
        return updated;
      });
    }
    setEditingThreadId(null);
  };

  // Clean up any rogue mermaid error elements from document.body
  useEffect(() => {
    cleanupAnyRogueMermaidElements();
  }, []);

  // Listen for open AI tutor events triggered from question explanation panels
  useEffect(() => {
    const handleOpenTutor = (e: Event) => {
      const customEvent = e as CustomEvent<{
        initialPrompt?: string;
      }>;
      if (customEvent.detail?.initialPrompt) {
        setInputQuery(customEvent.detail.initialPrompt);
        setIsMinimized(false);
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 150);
      }
    };
    window.addEventListener('aws_open_ai_tutor', handleOpenTutor);
    return () => {
      window.removeEventListener('aws_open_ai_tutor', handleOpenTutor);
    };
  }, []);

  // Handle paste image from clipboard
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              setAttachedImage({
                name: file.name || 'Pasted_Screenshot.png',
                dataUrl: reader.result,
              });
            }
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    }
  }, []);

  // Handle image upload from file picker
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Kích thước ảnh tối đa là 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAttachedImage({
            name: file.name,
            dataUrl: reader.result,
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit query
  const handleSendMessage = async (queryText?: string, targetThreadId?: string) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend && !attachedImage) return;

    const currentThreadId = targetThreadId || activeThreadIdRef.current;
    const currentThreads = threadsRef.current;
    const targetThread = currentThreads.find((t) => t.id === currentThreadId) || currentThreads[0];
    if (!targetThread) return;

    const userMessageId = `user_${Date.now()}`;
    const newUserMessage: AIChatMessage = {
      id: userMessageId,
      role: 'user',
      content: textToSend || (attachedImage ? 'Hãy phân tích hình ảnh/sơ đồ này theo kiến trúc AWS.' : ''),
      timestamp: Date.now(),
      currentQuestionId: currentQuestion?.id,
      attachedImage: attachedImage ? { ...attachedImage } : undefined,
    };

    // Auto update thread title if it has default name
    let newTitle = targetThread.title;
    if (targetThread.title.startsWith('Tiến trình') && textToSend) {
      const firstLine = textToSend.split('\n')[0].trim();
      newTitle = firstLine.length > 25 ? firstLine.slice(0, 25) + '...' : firstLine;
    }

    const updatedMessages = [...(targetThread.messages || []), newUserMessage];
    const updatedThread: AIChatThread = {
      ...targetThread,
      title: newTitle,
      messages: updatedMessages,
      inputDraft: '',
      attachedImageDraft: null,
      updatedAt: Date.now(),
    };

    const nextThreads = currentThreads.map((t) => (t.id === currentThreadId ? updatedThread : t));
    setThreads(nextThreads);
    saveAIThreads(userId, nextThreads, activeThreadIdRef.current);

    if (currentThreadId === activeThreadIdRef.current) {
      setInputQuery('');
      setAttachedImage(null);
    }

    // Set loading for this thread
    setLoadingThreadIds((prev) => ({ ...prev, [currentThreadId]: true }));

    const currentStoredUser = getStoredUser();
    const effectiveUsername =
      currentStoredUser?.username ||
      (userId && userId !== 'guest_learner' && userId !== 'guest' ? userId : 'Khách vãng lai');

    // Prepare multi-turn history (last 10 messages before current query, excluding errors)
    const chatHistory = (targetThread.messages || [])
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.content.startsWith('⚠️'))
      .slice(-10)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    try {

      let result: {
        content: string;
        citations?: any[];
        confidence?: 'VERIFIED' | 'HIGH' | 'MEDIUM' | 'LOW';
        confidenceScore?: number;
        fastPathHit?: boolean;
        memoryMatch?: any | null;
        queryId?: string;
        securityFlags?: string[];
        pipelineSteps?: any[];
        telemetry?: any;
      };

      try {
        // 1. Production Enterprise Backend Pipeline (Rewriting, Semantic Cache, RAG, Cohere Rerank, Output Guard)
        const chatRes = await aiApi.chat({
          query: newUserMessage.content,
          userId,
          username: effectiveUsername,
          mode: config.systemMode || 'explain',
          currentQuestion: currentQuestion
            ? {
                id: currentQuestion.id,
                text: currentQuestion.text,
                choices: currentQuestion.choices,
                answer: currentQuestion.answer,
                explanation: currentQuestion.answerDescription,
                domain: currentQuestion.domain,
                serviceTags: currentQuestion.serviceTags,
              }
            : null,
          selectedAnswer,
          isSubmitted,
          isCorrect,
          userNotes,
          history: chatHistory,
          clientApiKey: config.apiKey || undefined,
          clientProvider: config.provider,
          clientModel: config.model,
          attachedImage: newUserMessage.attachedImage,
        });

        let finalContent = chatRes.content;
        let finalModel = chatRes.telemetry?.modelUsed;

        // If user provided a client API Key, but backend fell back due to network/timeout error:
        if (config.apiKey && config.apiKey.trim() && finalContent.includes('Lưu ý về kết nối API')) {
          try {
            const ragContext = buildAIPromptContext({
              currentQuestion,
              selectedAnswer,
              isSubmitted,
              isCorrect,
              userNotes,
              userQuery: newUserMessage.content,
              mode: config.systemMode || 'explain',
              learnerAnalytics,
              imageAttached: Boolean(newUserMessage.attachedImage),
              history: chatHistory,
            });

            const directClientRes = await sendAITutorMessage({
              config,
              systemPrompt: ragContext.systemPrompt,
              userPrompt: ragContext.userPrompt,
              rawUserQuery: newUserMessage.content,
              citations: chatRes.citations as any,
              attachedImage: newUserMessage.attachedImage,
              history: chatHistory,
              currentQuestion,
              selectedAnswer,
              isSubmitted,
              isCorrect,
              userNotes,
              mode: config.systemMode,
            });

            if (directClientRes && directClientRes.content) {
              finalContent = directClientRes.content;
              finalModel = `${config.provider.toUpperCase()} (Client Direct)`;
            }
          } catch (directErr) {
            console.warn('Client direct AI call failed after backend warning:', directErr);
          }
        }

        result = {
          content: finalContent,
          citations: chatRes.citations as any,
          confidence: chatRes.confidence,
          confidenceScore: chatRes.confidenceScore,
          fastPathHit: chatRes.fastPathHit,
          memoryMatch: chatRes.memoryMatch,
          queryId: chatRes.telemetry?.requestId,
          securityFlags: chatRes.securityFlags,
          pipelineSteps: (chatRes as any).pipelineSteps,
          telemetry: {
            ...chatRes.telemetry,
            modelUsed: finalModel || chatRes.telemetry?.modelUsed,
          },
        };
      } catch (pipelineErr) {
        // Graceful fallback to client-side Knowledge Engine if offline or endpoint error
        console.warn('Backend AI Pipeline offline or failed, falling back to local engine:', pipelineErr);
        const ragContext = buildAIPromptContext({
          currentQuestion,
          selectedAnswer,
          isSubmitted,
          isCorrect,
          userNotes,
          userQuery: newUserMessage.content,
          mode: config.systemMode || 'explain',
          learnerAnalytics,
          imageAttached: Boolean(newUserMessage.attachedImage),
          history: chatHistory,
        });

        const fallbackRes = await sendAITutorMessage({
          config,
          systemPrompt: ragContext.systemPrompt,
          userPrompt: ragContext.userPrompt,
          rawUserQuery: newUserMessage.content,
          citations: ragContext.citations,
          attachedImage: newUserMessage.attachedImage,
          history: chatHistory,
          currentQuestion,
          selectedAnswer,
          isSubmitted,
          isCorrect,
          userNotes,
          mode: config.systemMode,
        });

        result = {
          content: fallbackRes.content,
          citations: fallbackRes.citations,
          confidence: 'MEDIUM',
          confidenceScore: 0.75,
          fastPathHit: false,
          memoryMatch: null,
          telemetry: {
            modelUsed: config.apiKey ? (config.model || config.provider) : 'local_rag',
            totalLatencyMs: 0,
            rerankUsed: false,
          },
        };
      }

      const assistantMessage: AIChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: result.content,
        timestamp: Date.now(),
        currentQuestionId: currentQuestion?.id,
        citations: result.citations,
        confidence: result.confidence,
        confidenceScore: result.confidenceScore,
        fastPathHit: result.fastPathHit,
        memoryMatch: result.memoryMatch,
        queryId: result.queryId,
        securityFlags: result.securityFlags,
        pipelineSteps: result.pipelineSteps,
        telemetry: result.telemetry,
      };

      setThreads((prevThreads) => {
        const final = prevThreads.map((t) => {
          if (t.id === currentThreadId) {
            return {
              ...t,
              messages: [...t.messages, assistantMessage],
              updatedAt: Date.now(),
            };
          }
          return t;
        });
        saveAIThreads(userId, final, activeThreadIdRef.current);
        return final;
      });

      if (activeThreadIdRef.current === currentThreadId) {
        setSelectedFlowMessage(assistantMessage);
      } else {
        setUnreadThreadIds((prev) => ({ ...prev, [currentThreadId]: true }));
      }

      // Record full Q&A interaction to server and broadcast via realtime socket
      const queryRecord = {
        id: result.queryId || `aiq_${newUserMessage.id}`,
        userId,
        username: effectiveUsername,
        questionId: currentQuestion?.id ?? null,
        prompt: newUserMessage.content,
        response: result.content,
        mode: config.systemMode || 'explain',
        provider: result.telemetry?.modelUsed || (config.apiKey ? (config.model || config.provider) : 'local_rag'),
        createdAt: newUserMessage.timestamp,
      };

      void aiApi.recordQuery(queryRecord).catch(() => {});
      realtimeManager.broadcast('ai_query', queryRecord);
    } catch (err: any) {
      let fallbackContent = '';
      let fallbackCitations: any[] = [];
      try {
        const fallbackRes = generateKnowledgeEngineResponse({
          currentQuestion,
          selectedAnswer,
          isSubmitted,
          isCorrect,
          userNotes,
          userQuery: newUserMessage.content,
          mode: config.systemMode || 'explain',
          history: chatHistory,
          imageAttached: Boolean(newUserMessage.attachedImage),
        });
        if (fallbackRes && fallbackRes.answer) {
          fallbackContent = fallbackRes.answer;
          fallbackCitations = fallbackRes.citations || [];
        }
      } catch (fallbackErr) {
        console.warn('Fallback explanation generation failed in catch block:', fallbackErr);
      }

      const errMsg = String(err?.message || '').toLowerCase();
      const isRateOrQuota =
        errMsg.includes('429') ||
        errMsg.includes('quota') ||
        errMsg.includes('rate limit') ||
        errMsg.includes('resource_exhausted') ||
        errMsg.includes('insufficient_quota') ||
        errMsg.includes('hạn mức') ||
        errMsg.includes('exceeded') ||
        errMsg.includes('limit') ||
        errMsg.includes('api_key_invalid') ||
        errMsg.includes('không hợp lệ');

      let responseContent = '';
      if (fallbackContent) {
        const notice = isRateOrQuota
          ? `> [!NOTE]\n> ⚡ **Tài khoản API AI đã chạm giới hạn / hết hạn mức (Rate Limit / Quota Exceeded):**\n> ${err?.message || 'Hạn mức API tạm thời không khả dụng.'}\n> Hệ thống đã tự động chuyển sang **giải thích chuyên sâu dựa trên nguồn tài liệu chuẩn & đáp án chính thức (Curated Source & Official Answer Description)** để không làm gián đoạn việc học của bạn.\n\n`
          : `> [!WARNING]\n> ⚠️ **Không thể kết nối API AI:** ${err?.message || 'Lỗi mạng / API'}\n> Đã tự động hiển thị câu trả lời giải thích dựa theo tài liệu nguồn chính thức.\n\n`;
        responseContent = notice + fallbackContent;
      } else {
        responseContent = `⚠️ **Lỗi kết nối:** ${err.message || 'Không thể xử lý câu trả lời.'}\n\n*Gợi ý: Bấm biểu tượng bánh răng ⚙️ ở trên để kiểm tra lại API Key hoặc dùng Chế độ Tri thức Nội bộ.*`;
      }

      const errorMessage: AIChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: responseContent,
        timestamp: Date.now(),
        currentQuestionId: currentQuestion?.id,
        citations: fallbackCitations,
        confidence: fallbackContent ? 'HIGH' : 'LOW',
      };

      setThreads((prevThreads) => {
        const final = prevThreads.map((t) => {
          if (t.id === currentThreadId) {
            return {
              ...t,
              messages: [...t.messages, errorMessage],
              updatedAt: Date.now(),
            };
          }
          return t;
        });
        saveAIThreads(userId, final, activeThreadIdRef.current);
        return final;
      });

      if (activeThreadIdRef.current !== currentThreadId) {
        setUnreadThreadIds((prev) => ({ ...prev, [currentThreadId]: true }));
      }

      // Record failed query to server and broadcast so admin sees issues in realtime
      const errorRecord = {
        id: `aiq_${newUserMessage.id}`,
        userId,
        username: effectiveUsername,
        questionId: currentQuestion?.id ?? null,
        prompt: newUserMessage.content,
        response: errorMessage.content,
        mode: config.systemMode || 'explain',
        provider: config.apiKey ? (config.model || config.provider) : 'local_rag',
        createdAt: newUserMessage.timestamp,
      };

      void aiApi.recordQuery(errorRecord).catch(() => {});
      realtimeManager.broadcast('ai_query', errorRecord);
    } finally {
      setLoadingThreadIds((prev) => ({ ...prev, [currentThreadId]: false }));
    }
  };

  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  });

  // Quick Action Chips
  const handleQuickAction = (actionType: string) => {
    switch (actionType) {
      case 'explain_question':
        void handleSendMessage('Hãy giải thích toàn diện câu hỏi này, từ khóa đề thi và lý do vì sao đáp án đúng là tối ưu nhất.');
        break;
      case 'why_wrong':
        if (selectedAnswer) {
          void handleSendMessage(`Vì sao tôi chọn đáp án ${selectedAnswer} lại sai? Hãy chỉ rõ anti-pattern hoặc bẫy đề thi.`);
        } else {
          void handleSendMessage('Tại sao các phương án gây nhiễu trong câu này lại sai? Hãy phân tích từng lựa chọn.');
        }
        break;
      case 'explain_all_options':
        void handleSendMessage('Hãy phân tích chi tiết từng lựa chọn A, B, C, D: Tại sao đúng hoặc tại sao sai?');
        break;
      case 'real_world_example':
        void handleSendMessage('Cho tôi 1 ví dụ thực tế trong doanh nghiệp áp dụng mô hình kiến trúc của câu hỏi này.');
        break;
      case 'memory_trick':
        void handleSendMessage('Cho tôi mẹo nhớ nhanh (Exam Tip / Memory Trick) để không bao giờ bị lừa ở dạng câu hỏi này.');
        break;
      case 'beginner_explain':
        void handleSendMessage('Hãy giải thích lại bài này theo cách đơn giản nhất như cho người mới bắt đầu (Beginner-friendly).');
        break;
      case 'comparison_table':
        void handleSendMessage('Hãy lập bảng so sánh chi tiết các dịch vụ xuất hiện trong câu hỏi này.');
        break;
      case 'draw_architecture_diagram':
        void handleSendMessage('Hãy vẽ sơ đồ kiến trúc Mermaid (flowchart TD) chi tiết và chuẩn cú pháp (lưu ý dùng subgraph ID ["Tiêu đề"], nhãn node bọc trong ["..."] và đóng end đầy đủ) cho câu hỏi/tình huống này, kèm phân tích luồng dữ liệu.');
        break;
      case 'quiz_me':
        void handleSendMessage('Hãy đố tôi 1 câu hỏi tình huống thực tế tương tự câu này để tôi luyện phản xạ.');
        break;
      default:
        break;
    }
  };

  // Capture screen context action (Context & DOM Aware)
  const handleReadCurrentScreen = () => {
    let screenTitle = 'Học tập AWS';
    let screenDetails = '';

    if (currentQuestion) {
      const modeLabel =
        currentMode === 'exam'
          ? 'Bài thi mô phỏng Pearson VUE'
          : currentMode === 'review'
          ? 'Xem lại câu hỏi'
          : currentMode === 'weakness'
          ? 'Luyện tập điểm mù'
          : 'Luyện tập theo câu';

      screenTitle = `${modeLabel} - Câu #${currentQuestion.id}`;

      const choicesText = currentQuestion.choiceKeys
        .map((k) => `  ${k}. ${currentQuestion.choices[k] || ''}`)
        .join('\n');

      const answerStatus = selectedAnswer
        ? `Đã chọn đáp án: [${selectedAnswer}] (${isSubmitted ? (isCorrect ? '✅ ĐÃ NỘP - KẾT QUẢ ĐÚNG' : '❌ ĐÃ NỘP - KẾT QUẢ SAI') : '⏳ ĐANG LÀM BÀI - CHƯA NỘP'})`
        : 'Chưa chọn phương án nào (đang đọc đề suy nghĩ)';

      screenDetails = `
- Chế độ màn hình: ${modeLabel}
- Mã câu hỏi: #${currentQuestion.id} (Domain: ${currentQuestion.domain})
- Nội dung đề bài:
${currentQuestion.text}

- Các phương án lựa chọn:
${choicesText}

- Trạng thái học viên trên màn hình:
  * ${answerStatus}
  ${userNotes ? `* Ghi chú học viên: "${userNotes}"` : ''}
  ${isSubmitted && currentQuestion.answerDescription ? `* Giải thích câu hỏi: ${currentQuestion.answerDescription.slice(0, 350)}...` : ''}
`.trim();
    } else {
      // Non-question screen handling: Read based on currentMode & DOM text
      const mainElement = document.querySelector('main') || document.querySelector('#root');
      const domTextSnippet = mainElement
        ? (mainElement.innerText || '').slice(0, 600).replace(/\s+/g, ' ').trim()
        : '';

      switch (currentMode) {
        case 'flashcards':
          screenTitle = 'Thẻ ghi nhớ Flashcards AWS';
          screenDetails = `Học viên đang học Flashcards ghi nhớ các dịch vụ và khái niệm AWS SAA-C03.\nNội dung đang hiển thị: ${domTextSnippet}`;
          break;
        case 'services':
          screenTitle = 'Tra cứu Cẩm nang Dịch vụ AWS';
          screenDetails = `Học viên đang tra cứu cẩm nang dịch vụ và so sánh kiến trúc AWS.\nNội dung đang hiển thị: ${domTextSnippet}`;
          break;
        case 'result':
          screenTitle = 'Bảng kết quả bài thi SAA-C03';
          screenDetails = `Học viên đang xem kết quả và điểm số bài thi SAA-C03 vừa hoàn thành.\nNội dung đang hiển thị: ${domTextSnippet}`;
          break;
        case 'weakness':
          screenTitle = 'Phân tích Điểm mù & Rủi ro kiến thức';
          screenDetails = `Học viên đang xem phân tích các câu hỏi và chủ đề hay làm sai, điểm mù kiến trúc.\nNội dung đang hiển thị: ${domTextSnippet}`;
          break;
        case 'plan':
          screenTitle = 'Kế hoạch học tập 30 ngày';
          screenDetails = `Học viên đang xem lộ trình học tập 30 ngày luyện thi AWS SAA-C03.\nNội dung đang hiển thị: ${domTextSnippet}`;
          break;
        case 'home':
        default:
          screenTitle = 'Bảng điều khiển Trang chủ (Dashboard)';
          screenDetails = `Học viên đang ở trang chủ trung tâm luyện thi AWS SAA-C03.\nThông tin tiến độ: ${domTextSnippet}`;
          break;
      }
    }

    const fullPrompt = `🖥 [ĐỌC MÀN HÌNH HIỆN TẠI - ${screenTitle}]:
${screenDetails}

👉 Hãy đọc kỹ ngữ cảnh màn hình này, giải thích và đưa ra lời khuyên kiến trúc AWS chuẩn xác nhất cho tôi!`;

    void handleSendMessage(fullPrompt);
  };

  // Visual Screenshot Capture via Screen Capture API
  const handleCaptureScreen = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const track = stream.getVideoTracks()[0];
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

      track.stop();
      stream.getTracks().forEach((t) => t.stop());

      const dataUrl = canvas.toDataURL('image/png');
      setAttachedImage({
        name: `Screen_${new Date().toLocaleTimeString('vi-VN').replace(/:/g, '-')}.png`,
        dataUrl,
      });
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.warn('Screen capture issue:', err);
      }
    }
  };

  // Clear conversation
  const handleClearHistory = () => {
    if (window.confirm(`Bạn có chắc muốn xóa toàn bộ lịch sử trò chuyện trong "${activeThread.title}"?`)) {
      setThreads((prev) => {
        const updated = prev.map((t) =>
          t.id === activeThreadId
            ? { ...t, messages: [], inputDraft: '', attachedImageDraft: null }
            : t
        );
        saveAIThreads(userId, updated, activeThreadId);
        return updated;
      });
      setInputQuery('');
      setAttachedImage(null);
    }
  };

  // Copy text to clipboard
  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Thumbs up feedback
  const handleThumbsUp = useCallback((msg: AIChatMessage) => {
    setThreads((prev) => {
      const updated = prev.map((t) =>
        t.id === activeThreadIdRef.current
          ? {
              ...t,
              messages: t.messages.map((m) =>
                m.id === msg.id ? { ...m, feedback: { helpful: true } } : m
              ),
            }
          : t
      );
      saveAIThreads(userId, updated, activeThreadIdRef.current);
      return updated;
    });

    // Send feedback to detailed learning endpoint
    void aiApi.sendDetailedFeedback({
      queryId: msg.queryId,
      questionId: msg.currentQuestionId,
      rating: 'up',
      originalAnswer: msg.content,
      mode: config.systemMode,
      provider: msg.telemetry?.modelUsed || config.provider,
    }).catch(() => {});
  }, [userId, config.systemMode, config.provider]);

  // Open thumbs down feedback modal
  const handleOpenFeedback = useCallback((msg: AIChatMessage) => {
    setIsCorrectionMode(false);
    setFeedbackTargetMessage(msg);
  }, []);

  // Open correction modal
  const handleOpenCorrection = useCallback((msg: AIChatMessage) => {
    setIsCorrectionMode(true);
    setFeedbackTargetMessage(msg);
  }, []);

  // Regenerate response
  const handleRegenerate = useCallback((targetMsg: AIChatMessage) => {
    const currentThread = threadsRef.current.find((t) => t.id === activeThreadIdRef.current);
    const curMessages = currentThread?.messages || [];
    const msgIndex = curMessages.findIndex((m) => m.id === targetMsg.id);
    let promptToResend = '';
    if (msgIndex > 0) {
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (curMessages[i].role === 'user') {
          promptToResend = curMessages[i].content;
          break;
        }
      }
    }
    if (promptToResend) {
      void handleSendMessageRef.current(promptToResend, activeThreadIdRef.current);
    }
  }, []);

  // Submit thumbs down feedback or user correction
  const handleFeedbackSubmit = (data: AIFeedbackSubmitData) => {
    setThreads((prev) => {
      const updated = prev.map((t) =>
        t.id === activeThreadIdRef.current
          ? {
              ...t,
              messages: t.messages.map((m) =>
                m.id === data.messageId
                  ? {
                      ...m,
                      feedback: {
                        helpful: false,
                        errorType: data.errorType,
                        userCorrection: data.userCorrection,
                        comment: data.comment,
                      },
                    }
                  : m
              ),
            }
          : t
      );
      saveAIThreads(userId, updated, activeThreadIdRef.current);
      return updated;
    });

    void aiApi.sendDetailedFeedback({
      queryId: feedbackTargetMessage?.queryId,
      questionId: feedbackTargetMessage?.currentQuestionId,
      rating: 'down',
      errorType: data.errorType,
      userCorrection: data.userCorrection,
      comment: data.comment,
      reasonTags: data.errorType ? [data.errorType] : [],
      originalAnswer: feedbackTargetMessage?.content,
      mode: config.systemMode,
      provider: feedbackTargetMessage?.telemetry?.modelUsed || config.provider,
    }).catch(() => {});
  };

  // Floating Draggable Compact Icon when closed or minimized
  // (cửa sổ rời luôn hiển thị đầy đủ, không có icon nổi)
  if (!popout && (!isOpen || isMinimized)) {
    return (
      <button
        type="button"
        onPointerDown={handleIconPointerDown}
        onPointerMove={handleIconPointerMove}
        onPointerUp={handleIconPointerUp}
        onPointerCancel={handleIconPointerCancel}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isMinimized) {
              setIsMinimized(false);
            } else {
              onToggleOpen();
            }
          }
        }}
        style={{
          left: `${iconPosition.x}px`,
          top: `${iconPosition.y}px`,
        }}
        title={
          isMinimized
            ? 'AWS AI Tutor (Đang thu nhỏ - Bấm để mở lại, kéo thả để đổi vị trí)'
            : 'Mở AWS AI Tutor (Kéo thả để đổi vị trí)'
        }
        aria-label="AWS AI Tutor Assistant"
        className={`fixed z-40 ${currentMode !== 'exam' ? 'hidden md:flex' : 'flex'} h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-500 text-white shadow-xl transition-transform border-2 border-white/40 dark:border-white/20 select-none touch-none group ${
          isIconDragging
            ? 'scale-110 shadow-2xl ring-4 ring-blue-400/40 cursor-grabbing'
            : 'hover:scale-105 active:scale-95 cursor-grab hover:shadow-2xl'
        }`}
      >
        {/* Pulse online indicator */}
        <span className="pointer-events-none absolute -top-1 -right-1 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-400 border-2 border-white dark:border-slate-900" />
        </span>

        {/* Center AI Bot icon */}
        <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-white drop-shadow-xs pointer-events-none" />

        {/* Question tag or Minimized tag */}
        {isMinimized ? (
          <span className="pointer-events-none absolute -bottom-1.5 inset-x-0 mx-auto w-max px-1.5 py-0.5 rounded-full bg-blue-900/90 dark:bg-blue-950 text-white text-[8px] font-bold border border-white/20 shadow-xs leading-none">
            Thu nhỏ
          </span>
        ) : currentQuestion ? (
          <span className="pointer-events-none absolute -bottom-1.5 inset-x-0 mx-auto w-max px-1.5 py-0.5 rounded-full bg-slate-900/90 dark:bg-slate-950 text-amber-300 text-[8.5px] font-bold border border-white/20 shadow-xs leading-none">
            #{currentQuestion.id}
          </span>
        ) : null}

        {/* Hover Tooltip on desktop */}
        {!isIconDragging && (
          <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900/95 px-2 py-1 text-[10px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md dark:bg-slate-800 border border-slate-700">
            {isMinimized ? 'Mở lại AI Tutor (Kéo thả)' : 'AWS AI Tutor (Kéo thả)'}
          </span>
        )}
      </button>
    );
  }

  const activeModeMeta = MODE_METADATA[config.systemMode || 'explain'] || MODE_METADATA.explain;
  const effectivePanelPosition = clampPanelPosition(panelPosition.x, panelPosition.y, showFlowPanel);

  return (
    <>
      <div
        style={
          !isExpanded && typeof window !== 'undefined' && window.innerWidth >= 640
            ? {
                left: `${effectivePanelPosition.x}px`,
                top: `${effectivePanelPosition.y}px`,
                width: `${Math.min(window.innerWidth - 20, showFlowPanel ? 900 : 460)}px`,
                height: `${Math.min(window.innerHeight - 20, showFlowPanel ? 680 : 640)}px`,
                maxHeight: 'calc(100vh - 20px)',
              }
            : undefined
        }
        className={`fixed z-40 flex flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${
          isPanelDragging
            ? 'transition-none select-none ring-2 ring-blue-400/50 shadow-2xl'
            : 'transition-all'
        } ${
          popout
            ? 'inset-0'
            : isExpanded
            ? 'inset-0 sm:inset-6 sm:rounded-2xl'
            : 'inset-0 sm:inset-auto sm:rounded-2xl'
        }`}
      >
        {/* Chatbox Header */}
        <div
          onPointerDown={handlePanelHeaderPointerDown}
          onPointerMove={handlePanelHeaderPointerMove}
          onPointerUp={handlePanelHeaderPointerUp}
          onPointerCancel={handlePanelHeaderPointerCancel}
          onDoubleClick={handleResetPanelPosition}
          title={
            isExpanded
              ? 'AWS AI Tutor'
              : 'Kéo thả thanh tiêu đề để di chuyển vị trí chatbox (Nhấn đúp để đặt lại góc phải dưới)'
          }
          className={`flex items-center justify-between border-b border-slate-200 px-3.5 sm:px-4 py-2.5 sm:py-3 dark:border-slate-800 bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500 text-white shadow-sm select-none touch-none ${
            isExpanded
              ? 'cursor-default'
              : isPanelDragging
              ? 'cursor-grabbing'
              : 'cursor-grab'
          }`}
        >
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 pointer-events-none">
            {!isExpanded && (
              <div
                title="Kéo thả để di chuyển (Nhấn đúp để đặt lại góc)"
                className="hidden sm:flex items-center text-white/70 hover:text-white dark:text-white/70 dark:hover:text-white shrink-0 -ml-1 mr-0.5 cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md text-white font-bold shrink-0">
              <Sparkles className="h-4 w-4 text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs truncate">AWS AI Tutor</span>
                <span className="rounded bg-black/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200 uppercase">
                  {config.apiKey ? config.provider : 'Nội bộ'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  title={`Chế độ hiện tại: ${activeModeMeta.label}. Bấm để đổi chế độ.`}
                  className="pointer-events-auto rounded-full bg-white/20 hover:bg-white/30 px-2 py-0.5 text-[9.5px] font-semibold text-white flex items-center gap-1 transition-all cursor-pointer shadow-xs border border-white/20"
                >
                  <span>{activeModeMeta.icon}</span>
                  <span className="hidden sm:inline">{activeModeMeta.shortLabel}</span>
                </button>
              </div>
              <div className="text-[10px] text-blue-100 truncate">
                {currentQuestion ? `Ngữ cảnh: Câu #${currentQuestion.id}` : 'Trợ lý học thi AWS SAA-C03'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-white/80 pointer-events-auto">
            <button
              type="button"
              onClick={() => {
                setShowFlowPanel((prev) => !prev);
                if (!showFlowPanel) {
                  const latestAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
                  setSelectedFlowMessage(latestAssistant || null);
                }
              }}
              title="Bật/Tắt Bảng Luồng Xử Lý AI Pipeline 10 Giai Đoạn"
              className={`rounded-lg px-2 py-1 transition-all flex items-center gap-1 text-[11px] font-bold cursor-pointer ${
                showFlowPanel
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Luồng AI</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title="Cài đặt API Key & Nhà cung cấp"
              className="rounded-lg p-1.5 hover:bg-white/20 hover:text-white transition-colors"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleClearHistory}
              title="Xóa đoạn chat này"
              className="rounded-lg p-1.5 hover:bg-white/20 hover:text-white transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            {/* Tách chatbox ra cửa sổ riêng để Alt+Tab qua lại giữa 2 màn hình */}
            {!popout && (
              <button
                type="button"
                onClick={() => {
                  const win = openChatPopout();
                  // Mở được cửa sổ rời thì đóng chatbox nổi cho đỡ trùng lặp
                  if (win) onToggleOpen();
                }}
                title="Tách ra cửa sổ riêng (Alt+Tab qua lại được)"
                className="rounded-lg p-1.5 hover:bg-white/20 hover:text-white transition-colors hidden sm:block"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}

            {!popout && (
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                title={isExpanded ? 'Thu nhỏ cửa sổ' : 'Phóng to toàn màn hình'}
                className="rounded-lg p-1.5 hover:bg-white/20 hover:text-white transition-colors hidden sm:block"
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            )}
            {!popout && (
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                title="Thu nhỏ thanh dock"
                className="rounded-lg p-1.5 hover:bg-white/20 hover:text-white transition-colors"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (popout) {
                  window.close();
                } else {
                  onToggleOpen();
                }
              }}
              title={popout ? 'Đóng cửa sổ chat' : 'Đóng AI Tutor'}
              className="rounded-lg p-1.5 hover:bg-white/20 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Save Toast Notification Banner */}
        {saveToast && (
          <div className="flex items-center justify-between gap-2 bg-emerald-600 dark:bg-emerald-700 text-white px-3.5 py-2 text-xs shadow-md animate-fadeIn z-10 border-b border-emerald-700 dark:border-emerald-800">
            <div className="flex items-center gap-2 min-w-0 font-medium">
              <Check className="h-4 w-4 shrink-0 text-emerald-200" />
              <span className="truncate">{saveToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveToast(null)}
              className="p-1 hover:bg-white/20 rounded-md transition-colors cursor-pointer"
              title="Đóng thông báo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Main Content Area (Chat + Flow Panel Split) */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Column: Chat Conversation */}
          <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
            {/* Process / Multi-Thread Tab Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/95 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900/90 text-xs select-none">
              {/* Horizontal Scrollable Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-[calc(100%-88px)]">
                {threads.map((thread, idx) => {
                  const isActive = thread.id === activeThreadId;
                  const isThreadLoading = Boolean(loadingThreadIds[thread.id]);
                  const hasUnread = Boolean(unreadThreadIds[thread.id]);
                  const isEditing = editingThreadId === thread.id;

                  return (
                    <div
                      key={thread.id}
                      onClick={() => !isEditing && handleSwitchThread(thread.id)}
                      title={thread.title}
                      className={`group relative flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-all cursor-pointer shrink-0 border ${
                        isActive
                          ? 'bg-white font-semibold text-purple-700 shadow-xs border-purple-300 dark:bg-slate-800 dark:text-purple-300 dark:border-purple-600/70'
                          : 'border-slate-200/60 bg-white/50 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:border-slate-800/80 dark:bg-slate-800/40 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200'
                      }`}
                    >
                      {/* Status Indicator Icon */}
                      {isThreadLoading ? (
                        <span
                          title="Đang xử lý trong nền..."
                          className="flex items-center text-purple-600 dark:text-purple-400 animate-spin"
                        >
                          <Loader2 className="h-3 w-3" />
                        </span>
                      ) : hasUnread ? (
                        <span
                          title="Có phản hồi mới!"
                          className="relative flex h-2 w-2"
                        >
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                      ) : (
                        <MessageSquare
                          className={`h-3 w-3 ${
                            isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'
                          }`}
                        />
                      )}

                      {/* Title or Inline Edit Input */}
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingTitle}
                          autoFocus
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => handleSaveRename(thread.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(thread.id);
                            if (e.key === 'Escape') setEditingThreadId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-24 rounded bg-white px-1 py-0.5 text-xs text-slate-900 outline-none ring-1 ring-purple-500 dark:bg-slate-900 dark:text-white"
                        />
                      ) : (
                        <span
                          onDoubleClick={(e) => handleStartRename(e, thread.id, thread.title)}
                          className="max-w-[100px] sm:max-w-[130px] truncate"
                        >
                          {thread.title || `Tiến trình ${idx + 1}`}
                        </span>
                      )}

                      {/* Close Tab Button */}
                      {threads.length > 1 && !isEditing && (
                        <button
                          type="button"
                          onClick={(e) => handleCloseThread(e, thread.id)}
                          title="Đóng tiến trình này"
                          className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors opacity-70 group-hover:opacity-100 cursor-pointer"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* New Thread Action Button */}
              <button
                type="button"
                onClick={handleCreateNewThread}
                title="Tạo tiến trình mới (Hỏi câu hỏi mới đồng thời mà không cần chờ tiến trình khác)"
                className="inline-flex items-center gap-1 rounded-lg bg-purple-100/80 hover:bg-purple-200/80 px-2 py-1 text-[11px] font-bold text-purple-800 dark:bg-purple-950/60 dark:hover:bg-purple-900/80 dark:text-purple-300 transition-colors shrink-0 border border-purple-200 dark:border-purple-800 shadow-2xs cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span className="hidden sm:inline">Tiến trình mới</span>
              </button>
            </div>

            {/* Quick Actions Bar (Context-Aware) */}
            <div className="border-b border-slate-100 bg-slate-50/90 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={handleReadCurrentScreen}
                disabled={isLoading}
                title="Đọc nội dung văn bản màn hình hiện tại vào ngữ cảnh AI Tutor"
                className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-800 hover:bg-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors disabled:opacity-40"
              >
                <Monitor className="h-3 w-3" />
                <span>Đọc màn hình</span>
              </button>
              <button
                type="button"
                onClick={handleCaptureScreen}
                disabled={isLoading}
                title="Chụp ảnh màn hình đính kèm cho AI Vision phân tích hình vẽ / bảng biểu"
                className="flex shrink-0 items-center gap-1 rounded-lg bg-indigo-100 px-2.5 py-1 text-[11px] font-bold text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition-colors disabled:opacity-40"
              >
                <Camera className="h-3 w-3" />
                <span>Chụp màn hình</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('draw_architecture_diagram')}
                disabled={isLoading}
                title="Yêu cầu AI vẽ sơ đồ kiến trúc Mermaid tương tác và xuất ảnh"
                className="flex shrink-0 items-center gap-1 rounded-lg bg-purple-100 px-2.5 py-1 text-[11px] font-bold text-purple-800 hover:bg-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:hover:bg-purple-900/60 transition-colors disabled:opacity-40"
              >
                <span>📐 Vẽ sơ đồ</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('explain_question')}
                disabled={!currentQuestion || isLoading}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 disabled:opacity-40"
              >
                💡 Giải thích câu này
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('why_wrong')}
                disabled={!currentQuestion || isLoading}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 disabled:opacity-40"
              >
                ❌ Vì sao sai?
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('explain_all_options')}
                disabled={!currentQuestion || isLoading}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 disabled:opacity-40"
              >
                🔍 Phân tích 4 đáp án
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('memory_trick')}
                disabled={isLoading}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 disabled:opacity-40"
              >
                🧠 Mẹo nhớ (Tip)
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('comparison_table')}
                disabled={isLoading}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 disabled:opacity-40"
              >
                📊 Bảng so sánh
              </button>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 shadow-inner">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">Chào bạn! Tôi là AWS AI Tutor</h4>
                    <p className="mt-1 text-slate-500 dark:text-slate-400 max-w-xs text-[11px]">
                      Tôi có thể giải thích câu hỏi bạn đang làm, phân tích lý do vì sao chọn sai, vẽ sơ đồ kiến trúc và đưa ra mẹo nhớ thi SAA-C03.
                    </p>
                  </div>

                  {!config.apiKey && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-2.5 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50 text-[11px]">
                      <Sparkles className="h-4 w-4 shrink-0 text-amber-600" />
                      <span>
                        Đang chạy ở <strong>Chế Độ Tri Thức Nội Bộ</strong>. Bấm ⚙️ để nhập API Key riêng (Gemini/OpenAI/Claude) nếu muốn hỏi tự do!
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                messages.map((msg) => (
                  <ChatMessageItem
                    key={msg.id}
                    msg={msg}
                    copiedId={copiedId}
                    onCopy={handleCopy}
                    onThumbsUp={handleThumbsUp}
                    onOpenFeedback={handleOpenFeedback}
                    onOpenCorrection={handleOpenCorrection}
                    onRegenerate={handleRegenerate}
                    onViewPipelineFlow={handleViewPipelineFlow}
                  />
                ))
              )}

              {isLoading && (
                <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 p-2">
                  <Sparkles className="h-4 w-4 animate-spin text-blue-600" />
                  <span>AI Tutor đang suy luận và phân tích đề bài...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Attached Image Thumbnail before sending */}
            {attachedImage && (
              <div className="border-t border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/40 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <ImageIcon className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                    {attachedImage.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  className="rounded p-1 text-slate-400 hover:text-red-600"
                  title="Xóa ảnh"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Input Bar */}
            <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 safe-pb-bottom">
              <div className="flex items-end gap-2">
                {/* Image attachment button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Đính kèm ảnh hoặc ảnh chụp kiến trúc (PNG, JPG)"
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                {/* Textarea */}
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    onPaste={handlePaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    rows={1}
                    placeholder="Hỏi bất kỳ điều gì về câu hỏi này... (Enter để gửi)"
                    className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-3.5 pr-10 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900"
                  />
                </div>

                {/* Send button */}
                <button
                  type="button"
                  disabled={isLoading || (!inputQuery.trim() && !attachedImage)}
                  onClick={() => handleSendMessage()}
                  className="rounded-xl bg-blue-600 p-2.5 text-white hover:bg-blue-700 active:scale-95 disabled:opacity-40 transition-all shadow-sm"
                  title="Gửi câu hỏi"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: AI Pipeline Flow Panel Drawer (Collapsible) */}
          {showFlowPanel && (
            <div className="w-[340px] sm:w-[380px] border-l border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex flex-col h-full overflow-hidden shrink-0 animate-fadeIn">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                  <Zap className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Chi Tiết Luồng Chạy AI</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFlowPanel(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors"
                  title="Thu gọn bảng luồng"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <AIPipelineFlowPanel
                  steps={selectedFlowMessage?.pipelineSteps}
                  isLoading={isLoading}
                  totalLatencyMs={selectedFlowMessage?.telemetry?.totalLatencyMs}
                  modelUsed={selectedFlowMessage?.telemetry?.modelUsed}
                  rerankUsed={selectedFlowMessage?.telemetry?.rerankUsed}
                  fastPathHit={selectedFlowMessage?.fastPathHit}
                  title="Pipeline Tracer"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Settings Modal */}
      <AISettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userId={userId}
        config={config}
        onConfigUpdated={(newConfig) => {
          setConfig(newConfig);
          const meta = MODE_METADATA[newConfig.systemMode] || MODE_METADATA.explain;
          const providerName = newConfig.apiKey ? newConfig.provider.toUpperCase() : 'Tri thức nội bộ';
          setSaveToast(`Đã lưu cấu hình AI! Chế độ: ${meta.shortLabel} (${providerName})`);
          setTimeout(() => setSaveToast(null), 4000);
        }}
      />

      {/* AI Thumbs Down & Correction Feedback Modal */}
      {feedbackTargetMessage && (
        <AIFeedbackModal
          isOpen={Boolean(feedbackTargetMessage)}
          onClose={() => setFeedbackTargetMessage(null)}
          messageId={feedbackTargetMessage.id}
          questionId={feedbackTargetMessage.currentQuestionId}
          providerUsed={config.provider}
          isCorrectionMode={isCorrectionMode}
          onSubmit={handleFeedbackSubmit}
        />
      )}
    </>
  );
};
