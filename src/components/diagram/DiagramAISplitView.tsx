import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Sparkles,
  ShieldAlert,
  Cpu,
  PlusCircle,
  RotateCcw,
  Check,
  X,
  Bot,
  User,
  Loader2,
  Minimize2,
  Info,
} from 'lucide-react';
import type { Diagram, DiagramNode, DiagramPatch } from '../../core/diagram/diagramTypes';
import {
  buildExplainArchitecturePrompt,
  buildValidateArchitecturePrompt,
  buildSuggestNextComponentPrompt,
  parseAIDiagramResponse,
  parseAIPatchResponse,
  applyPatchToDiagram,
} from '../../core/diagram/diagramAIBridge';
import { sendAITutorMessage } from '../../core/aiClient';
import { loadAITutorConfig } from '../../core/aiConfigStorage';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
  patch?: DiagramPatch | null;
  generatedDiagramResult?: ReturnType<typeof parseAIDiagramResponse> | null;
}

interface DiagramAISplitViewProps {
  diagram: Diagram;
  selectedNode: DiagramNode | null;
  onApplyDiagramChange: (updatedDiagram: Diagram) => void;
  onClose: () => void;
  width: number;
  onResizeWidth: (width: number) => void;
}

export const DiagramAISplitView: React.FC<DiagramAISplitViewProps> = ({
  diagram,
  selectedNode,
  onApplyDiagramChange,
  onClose,
  width,
  onResizeWidth,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'init-1',
      sender: 'ai',
      text: `👋 Xin chào! Tôi là **AI Cloud Architect Tutor**.\nTôi có thể đọc, phân tích sơ đồ hiện tại, kiểm tra lỗi SPOF & Security, hoặc tự động tạo sơ đồ kiến trúc theo yêu cầu của bạn!`,
      timestamp: 0,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle draggable divider resize
  useEffect(() => {
    if (!isDraggingDivider) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(750, Math.max(280, window.innerWidth - e.clientX));
      onResizeWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider, onResizeWidth]);

  // Send message helper
  const handleSendMessage = async (customPrompt?: string, systemPromptOverride?: string) => {
    const promptToSend = customPrompt || inputText.trim();
    if (!promptToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: promptToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInputText('');
    setIsLoading(true);

    try {
      const aiConfig = loadAITutorConfig();
      const sysPrompt =
        systemPromptOverride ||
        `You are a Senior AWS Solutions Architect & Visual Diagram Brainstorming Assistant.
Assist the user with architecture reviews, system design patterns, AWS exam explanations, and diagram construction.
Explain in clear Vietnamese, structured with bullet points.`;

      const response = await sendAITutorMessage({
        config: aiConfig,
        systemPrompt: sysPrompt,
        userPrompt: promptToSend,
        citations: [],
      });

      const parsedGen = parseAIDiagramResponse(response.content);
      const parsedPatch = parseAIPatchResponse(response.content);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: parsedGen.explanation || response.content,
        timestamp: Date.now(),
        generatedDiagramResult: parsedGen.success ? parsedGen : null,
        patch: parsedPatch,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: unknown) {
      const errorMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        text: `⚠️ Lỗi kết nối AI: ${err instanceof Error ? err.message : 'Vui lòng kiểm tra lại cấu hình API key trong phần Cài đặt AI.'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Action Handlers
  const handleExplainArchitecture = () => {
    const prompt = buildExplainArchitecturePrompt(diagram, selectedNode?.id);
    handleSendMessage(prompt);
  };

  const handleValidateArchitecture = () => {
    const prompt = buildValidateArchitecturePrompt(diagram);
    handleSendMessage(prompt);
  };

  const handleAskSelectedNode = () => {
    if (!selectedNode) return;
    const prompt = `Giải thích chi tiết vai trò của thành phần "${selectedNode.label.replace(/\n/g, ' ')}" trong sơ đồ này, các kết nối vào/ra của nó và các câu hỏi thi AWS SAA/SAP liên quan.`;
    handleSendMessage(prompt);
  };

  const handleSuggestNext = () => {
    const prompt = buildSuggestNextComponentPrompt(diagram);
    handleSendMessage(prompt);
  };

  const handleApplyGeneratedDiagram = useCallback((genResult: NonNullable<ChatMessage['generatedDiagramResult']>) => {
    if (!genResult.parsedDiagram) return;
    const updated: Diagram = {
      ...diagram,
      nodes: genResult.parsedDiagram.nodes,
      edges: genResult.parsedDiagram.edges,
      frames: genResult.parsedDiagram.frames || [],
      updatedAt: Date.now(),
    };
    onApplyDiagramChange(updated);
  }, [diagram, onApplyDiagramChange]);

  const handleApplyPatch = useCallback((patch: DiagramPatch) => {
    const updated = applyPatchToDiagram(diagram, patch);
    onApplyDiagramChange(updated);
  }, [diagram, onApplyDiagramChange]);

  return (
    <div
      style={{ width }}
      className="relative flex flex-col bg-white border-l border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-800 dark:text-slate-100 z-20 shrink-0 h-full overflow-hidden select-none"
    >
      {/* Draggable Divider Handle */}
      <div
        onMouseDown={() => setIsDraggingDivider(true)}
        className="absolute left-0 top-0 bottom-0 w-1.5 hover:w-2 bg-transparent hover:bg-blue-500/50 cursor-col-resize z-30 transition-all"
        title="Kéo để thay đổi kích thước"
      />

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold flex items-center gap-1.5">
              <span>AI Diagram Assistant</span>
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                Active
              </span>
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Đọc ngữ cảnh & đồng sáng tạo kiến trúc
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setMessages([{ id: 'init-1', sender: 'ai', text: 'Đã làm mới cuộc hội thoại.', timestamp: Date.now() }])}
            title="Làm mới hội thoại"
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            title="Thu nhỏ AI"
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Action Chips */}
      <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0">
        <button
          onClick={handleExplainArchitecture}
          disabled={isLoading}
          className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-blue-200 dark:border-blue-800/80 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-all flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
        >
          <Info className="w-3 h-3 text-blue-500" />
          <span>Giải thích sơ đồ</span>
        </button>

        <button
          onClick={handleValidateArchitecture}
          disabled={isLoading}
          className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-amber-200 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 transition-all flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
        >
          <ShieldAlert className="w-3 h-3 text-amber-500" />
          <span>Kiểm tra lỗi (Audit)</span>
        </button>

        {selectedNode && (
          <button
            onClick={handleAskSelectedNode}
            disabled={isLoading}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-all flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Cpu className="w-3 h-3 text-emerald-500" />
            <span className="max-w-[120px] truncate">{selectedNode.label.split('\n')[0]}</span>
          </button>
        )}

        <button
          onClick={handleSuggestNext}
          disabled={isLoading}
          className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-purple-200 dark:border-purple-800/80 bg-purple-50/70 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 transition-all flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
        >
          <PlusCircle className="w-3 h-3 text-purple-500" />
          <span>Gợi ý thêm</span>
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
              {msg.sender === 'user' ? (
                <>
                  <span>Bạn</span>
                  <User className="w-3 h-3" />
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3 text-blue-500" />
                  <span>AI Architect Tutor</span>
                </>
              )}
            </div>

            <div
              className={`p-3 rounded-2xl max-w-[92%] text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-xs'
                  : 'bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 rounded-tl-xs border border-slate-200/80 dark:border-slate-700/60 shadow-2xs'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>

              {/* AI Generated Diagram Card with Apply button */}
              {msg.generatedDiagramResult?.parsedDiagram && (
                <div className="mt-3 p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/90 border border-blue-200 dark:border-blue-800/80 text-slate-800 dark:text-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Sơ đồ đã được tạo ({msg.generatedDiagramResult.parsedDiagram.nodes.length} nodes)</span>
                    </span>
                  </div>
                  <button
                    onClick={() => handleApplyGeneratedDiagram(msg.generatedDiagramResult!)}
                    className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Áp dụng sơ đồ này lên Canvas</span>
                  </button>
                </div>
              )}

              {/* AI Patch Suggestion Card */}
              {msg.patch && (
                <div className="mt-3 p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/90 border border-purple-200 dark:border-purple-800/80 text-slate-800 dark:text-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{msg.patch.title}</span>
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {msg.patch.reason}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleApplyPatch(msg.patch!)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Chấp nhận thay đổi</span>
                    </button>
                    <button
                      onClick={() => {}}
                      className="py-1.5 px-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs transition-colors flex items-center justify-center"
                      title="Bỏ qua"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span>AI đang phân tích sơ đồ kiến trúc...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Hỏi AI hoặc gõ 'Tạo sơ đồ serverless'..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors cursor-pointer"
            title="Gửi tin nhắn"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
