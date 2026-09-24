import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  Minimize2,
  Moon,
  Sun,
  Edit2,
  Check,
  Code2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Minus,
  Square,
} from 'lucide-react';
import type {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramFrame,
  PresentationStep,
  CanvasBackground,
  ConnectorType,
  DiagramWorkbook,
} from '../../core/diagram/diagramTypes';
import type { ToolMode } from './DiagramToolbar';
import type { AutoLayoutMode } from '../../core/diagram/diagramAutoLayout';
import {
  createEmptyDiagram,
  loadWorkbook,
  saveWorkbook,
  addSheetToWorkbook,
  renameSheetInWorkbook,
  duplicateSheetInWorkbook,
  deleteSheetFromWorkbook,
  exportDiagramAsJSON,
  exportDiagramAsSVG,
  exportDiagramAsPNG,
  generateId,
} from '../../core/diagram/diagramStorage';
import { DIAGRAM_TEMPLATES } from '../../core/diagram/diagramTemplates';
import { applyAutoLayout } from '../../core/diagram/diagramAutoLayout';
import { parseMermaidToDiagram } from '../../core/diagram/mermaidToDiagram';
import { useTheme } from '../../context/useTheme';
import { fetchCloudWorkbook } from '../../core/api';
import { DiagramToolbar } from './DiagramToolbar';
import { DiagramSidebar } from './DiagramSidebar';
import { DiagramCanvas } from './DiagramCanvas';
import { DiagramAISplitView } from './DiagramAISplitView';
import { DiagramShortcutsModal } from './DiagramShortcutsModal';
import { DiagramSheetsBar } from './DiagramSheetsBar';
import { DiagramContextualBar } from './DiagramContextualBar';

interface DiagramWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
}

interface PanelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const STORAGE_KEY_BOUNDS = 'xbrain_diagram_panel_bounds_v1';

function getInitialBounds(): PanelBounds {
  if (typeof window === 'undefined') return { x: 40, y: 40, width: 1100, height: 720 };
  if (window.innerWidth < 768) {
    return {
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOUNDS);
    if (raw) {
      const b = JSON.parse(raw) as PanelBounds;
      if (b.width >= 520 && b.height >= 380) {
        return {
          x: Math.max(10, Math.min(window.innerWidth - 120, b.x)),
          y: Math.max(10, Math.min(window.innerHeight - 80, b.y)),
          width: Math.min(window.innerWidth - 20, b.width),
          height: Math.min(window.innerHeight - 20, b.height),
        };
      }
    }
  } catch {
    // Fallback
  }
  const w = Math.min(1160, Math.max(540, window.innerWidth - 64));
  const h = Math.min(760, Math.max(400, window.innerHeight - 64));
  return {
    x: Math.max(16, Math.round((window.innerWidth - w) / 2)),
    y: Math.max(16, Math.round((window.innerHeight - h) / 2)),
    width: w,
    height: h,
  };
}

export const DiagramWorkspaceModal: React.FC<DiagramWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onMinimize,
}) => {
  // Theme context hook (Rule 2)
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';

  // Multi-sheet Workbook state
  const [workbook, setWorkbook] = useState<DiagramWorkbook>(() => loadWorkbook());
  const diagram =
    workbook.sheets.find((s) => s.id === workbook.activeSheetId) ||
    workbook.sheets[0] ||
    createEmptyDiagram('AWS VPC Architecture');

  // History stack for Undo / Redo (per active sheet)
  const [history, setHistory] = useState<Diagram[]>(() => [JSON.parse(JSON.stringify(diagram))]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Sync with cloud on initial mount
  useEffect(() => {
    let isMounted = true;
    fetchCloudWorkbook().then((cloudWb) => {
      if (isMounted && cloudWb && cloudWb.sheets && cloudWb.sheets.length > 0) {
        setWorkbook((currentLocal) => {
          if ((cloudWb.updatedAt || 0) >= (currentLocal.updatedAt || 0)) {
            saveWorkbook(cloudWb);
            return cloudWb;
          }
          return currentLocal;
        });
      }
    }).catch(() => {
      // Offline fallback: keep local
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Floating Panel window bounds and maximization
  const [bounds, setBounds] = useState<PanelBounds>(getInitialBounds);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null);
  const resizeStartRef = useRef<{ clientX: number; clientY: number; initialBounds: PanelBounds; handle: string } | null>(null);

  // Tool & Canvas states
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [connectorType, setConnectorType] = useState<ConnectorType>('orthogonal');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [isFlowPlaying, setIsFlowPlaying] = useState<boolean>(false);
  const [flowSpeed, setFlowSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');

  // Sidebar & AI Split Panel
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < 1024
  );
  const [isAIPanelOpen, setIsAIPanelOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth >= 1280
  );
  const [aiPanelWidth, setAiPanelWidth] = useState<number>(380);

  // Modals & Dialogs
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isMermaidModalOpen, setIsMermaidModalOpen] = useState<boolean>(false);
  const [mermaidInput, setMermaidInput] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleInput, setTitleInput] = useState<string>('');
  const [activeStep, setActiveStep] = useState<PresentationStep | null>(null);

  // File input ref for JSON import
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Push new state to undo/redo history
  const pushHistory = useCallback(
    (nextDiagram: Diagram) => {
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1);
        return [...trimmed, JSON.parse(JSON.stringify(nextDiagram))];
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [historyIndex]
  );

  // Update diagram with workbook persistence and history tracking
  const updateDiagram = useCallback(
    (updater: (prev: Diagram) => Diagram, recordHistory = true) => {
      setWorkbook((prevWb) => {
        const activeSheet =
          prevWb.sheets.find((s) => s.id === prevWb.activeSheetId) || prevWb.sheets[0];
        const nextSheet = updater(activeSheet);
        if (recordHistory) {
          pushHistory(nextSheet);
        }
        const updatedSheets = prevWb.sheets.map((s) => (s.id === nextSheet.id ? nextSheet : s));
        const updatedWb: DiagramWorkbook = {
          ...prevWb,
          sheets: updatedSheets,
          updatedAt: Date.now(),
        };
        saveWorkbook(updatedWb);
        return updatedWb;
      });
    },
    [pushHistory]
  );

  // Sheet Management Handlers
  const handleSelectSheet = (sheetId: string) => {
    const target = workbook.sheets.find((s) => s.id === sheetId);
    if (!target) return;
    const updated: DiagramWorkbook = {
      ...workbook,
      activeSheetId: sheetId,
      updatedAt: Date.now(),
    };
    saveWorkbook(updated);
    setWorkbook(updated);
    setHistory([JSON.parse(JSON.stringify(target))]);
    setHistoryIndex(0);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setSelectedFrameId(null);
  };

  const handleAddSheet = () => {
    const { workbook: updated, newSheet } = addSheetToWorkbook(workbook);
    setWorkbook(updated);
    setHistory([JSON.parse(JSON.stringify(newSheet))]);
    setHistoryIndex(0);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setSelectedFrameId(null);
  };

  const handleRenameSheet = (sheetId: string, newTitle: string) => {
    const updated = renameSheetInWorkbook(workbook, sheetId, newTitle);
    setWorkbook(updated);
  };

  const handleDuplicateSheet = (sheetId: string) => {
    const { workbook: updated, copySheet } = duplicateSheetInWorkbook(workbook, sheetId);
    setWorkbook(updated);
    setHistory([JSON.parse(JSON.stringify(copySheet))]);
    setHistoryIndex(0);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setSelectedFrameId(null);
  };

  const handleDeleteSheet = (sheetId: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa sheet này không?')) {
      const updated = deleteSheetFromWorkbook(workbook, sheetId);
      setWorkbook(updated);
      const active = updated.sheets.find((s) => s.id === updated.activeSheetId) || updated.sheets[0];
      setHistory([JSON.parse(JSON.stringify(active))]);
      setHistoryIndex(0);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setSelectedFrameId(null);
    }
  };

  // Undo / Redo handlers
  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      const prev = history[targetIndex];
      setHistoryIndex(targetIndex);
      updateDiagram(() => JSON.parse(JSON.stringify(prev)), false);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const targetIndex = historyIndex + 1;
      const next = history[targetIndex];
      setHistoryIndex(targetIndex);
      updateDiagram(() => JSON.parse(JSON.stringify(next)), false);
    }
  };

  // Node selection
  const handleSelectNode = (nodeId: string | null, isMulti = false) => {
    if (!nodeId) {
      setSelectedNodeIds([]);
      return;
    }
    setSelectedFrameId(null);
    if (isMulti) {
      setSelectedNodeIds((prev) =>
        prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
      );
    } else {
      setSelectedNodeIds([nodeId]);
      setSelectedEdgeId(null);
    }
  };

  const handleSelectEdge = (edgeId: string | null) => {
    setSelectedEdgeId(edgeId);
    if (edgeId) {
      setSelectedNodeIds([]);
      setSelectedFrameId(null);
    }
  };

  const handleSelectFrame = (frameId: string | null) => {
    setSelectedFrameId(frameId);
    if (frameId) {
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
    }
  };

  // Element mutations
  const handleAddNode = (newNode: DiagramNode) => {
    updateDiagram((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
  };

  const handleUpdateNode = (nodeId: string, changes: Partial<DiagramNode>) => {
    updateDiagram((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, ...changes } : n)),
    }));
  };

  const handleBatchUpdateNodes = (updates: Array<{ id: string; changes: Partial<DiagramNode> }>) => {
    const map = new Map(updates.map((u) => [u.id, u.changes]));
    updateDiagram(
      (prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => {
          const c = map.get(n.id);
          return c ? { ...n, ...c } : n;
        }),
      }),
      false
    );
  };

  const handleDeleteNode = (nodeId: string) => {
    updateDiagram((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId),
    }));
    setSelectedNodeIds((prev) => prev.filter((id) => id !== nodeId));
  };

  // Frame mutations
  const handleUpdateFrame = (frameId: string, changes: Partial<DiagramFrame>) => {
    updateDiagram((prev) => ({
      ...prev,
      frames: (prev.frames || []).map((f) => (f.id === frameId ? { ...f, ...changes } : f)),
    }));
  };

  const handleBatchUpdateFrames = (updates: Array<{ id: string; changes: Partial<DiagramFrame> }>) => {
    const map = new Map(updates.map((u) => [u.id, u.changes]));
    updateDiagram(
      (prev) => ({
        ...prev,
        frames: (prev.frames || []).map((f) => {
          const c = map.get(f.id);
          return c ? { ...f, ...c } : f;
        }),
      }),
      false
    );
  };

  const handleDeleteFrame = (frameId: string) => {
    updateDiagram((prev) => ({
      ...prev,
      frames: (prev.frames || []).filter((f) => f.id !== frameId),
    }));
    setSelectedFrameId((prev) => (prev === frameId ? null : prev));
  };

  const handleAddFrame = (newFrame: DiagramFrame) => {
    updateDiagram((prev) => ({
      ...prev,
      frames: [...(prev.frames || []), newFrame],
    }));
  };

  const handleBatchAdd = (elements: {
    frames?: DiagramFrame[];
    nodes?: DiagramNode[];
    edges?: DiagramEdge[];
  }) => {
    updateDiagram((prev) => ({
      ...prev,
      frames: [...(prev.frames || []), ...(elements.frames || [])],
      nodes: [...prev.nodes, ...(elements.nodes || [])],
      edges: [...prev.edges, ...(elements.edges || [])],
    }));
  };

  const handleDeleteSelected = () => {
    if (selectedNodeIds.length > 0) {
      updateDiagram((prev) => ({
        ...prev,
        nodes: prev.nodes.filter((n) => !selectedNodeIds.includes(n.id)),
        edges: prev.edges.filter(
          (e) => !selectedNodeIds.includes(e.sourceNodeId) && !selectedNodeIds.includes(e.targetNodeId)
        ),
      }));
      setSelectedNodeIds([]);
    } else if (selectedEdgeId) {
      handleDeleteEdge(selectedEdgeId);
    } else if (selectedFrameId) {
      handleDeleteFrame(selectedFrameId);
    }
  };

  const handleAddEdge = (newEdge: DiagramEdge) => {
    updateDiagram((prev) => ({
      ...prev,
      edges: [...prev.edges, newEdge],
    }));
  };

  const handleUpdateEdge = (edgeId: string, changes: Partial<DiagramEdge>) => {
    updateDiagram((prev) => ({
      ...prev,
      edges: prev.edges.map((e) => (e.id === edgeId ? { ...e, ...changes } : e)),
    }));
  };

  const handleDeleteEdge = (edgeId: string) => {
    updateDiagram((prev) => ({
      ...prev,
      edges: prev.edges.filter((e) => e.id !== edgeId),
    }));
    setSelectedEdgeId(null);
  };

  const handleToggleLockNode = (nodeId: string) => {
    updateDiagram((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, locked: !n.locked } : n)),
    }));
  };

  const handleToggleHideNode = (nodeId: string) => {
    updateDiagram((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, hidden: !n.hidden } : n)),
    }));
  };

  // Add AWS Service Node from Library
  const handleAddAwsNode = (service: {
    name: string;
    category: string;
    icon: string;
    color: string;
    defaultDescription: string;
  }) => {
    const centerCanvasX = -diagram.viewport.x / diagram.viewport.zoom + 300;
    const centerCanvasY = -diagram.viewport.y / diagram.viewport.zoom + 200;

    const newNode: DiagramNode = {
      id: generateId('node'),
      type: 'aws-service',
      label: `${service.name}\n${service.defaultDescription}`,
      x: Math.round(centerCanvasX),
      y: Math.round(centerCanvasY),
      width: 170,
      height: 75,
      style: {
        fill: '#1e293b',
        stroke: service.color,
        strokeWidth: 2,
        textColor: '#f8fafc',
        borderRadius: 8,
      },
      data: {
        serviceCategory: service.category,
        icon: service.icon,
      },
    };

    handleAddNode(newNode);
    handleSelectNode(newNode.id);
  };

  // Auto Layout
  const handleAutoLayout = (mode: AutoLayoutMode) => {
    const result = applyAutoLayout(diagram.nodes, diagram.edges, mode);
    updateDiagram((prev) => ({
      ...prev,
      nodes: result.nodes,
      edges: result.edges,
    }));
  };

  // Load Template
  const handleLoadTemplate = (templateId: string) => {
    const tpl = DIAGRAM_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    updateDiagram(() => ({
      ...tpl.diagram,
      id: generateId('diag'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
  };

  // Mermaid Flowchart Import
  const handleImportMermaid = () => {
    if (!mermaidInput.trim()) return;
    try {
      const imported = parseMermaidToDiagram(mermaidInput);
      updateDiagram((prev) => ({
        ...prev,
        nodes: imported.nodes,
        edges: imported.edges,
        frames: imported.frames || [],
        updatedAt: Date.now(),
      }));
      setIsMermaidModalOpen(false);
      setMermaidInput('');
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
    } catch {
      alert('Không thể nhận diện cú pháp Mermaid. Vui lòng kiểm tra lại định dạng flowchart.');
    }
  };

  // Import JSON
  const handleImportJSONClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as Diagram;
        if (parsed.nodes && parsed.edges) {
          parsed.id = generateId('diag');
          updateDiagram(() => parsed);
        }
      } catch {
        alert('File JSON không hợp lệ.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Export handlers
  const handleExportPNG = () => {
    const svgEl = document.querySelector('svg.w-full.h-full') as SVGSVGElement | null;
    if (svgEl) {
      exportDiagramAsPNG(svgEl, diagram.name);
    }
  };

  const handleExportSVG = () => {
    const svgEl = document.querySelector('svg.w-full.h-full') as SVGSVGElement | null;
    if (svgEl) {
      exportDiagramAsSVG(svgEl, diagram.name);
    }
  };

  const handleExportJSON = () => {
    exportDiagramAsJSON(diagram);
  };

  // Presentation Step Walkthrough
  const handlePlayStepFlow = (step: PresentationStep) => {
    setActiveStep(step);
    setIsFlowPlaying(true);
    if (step.highlightNodeIds.length > 0) {
      const highlighted = diagram.nodes.filter((n) => step.highlightNodeIds.includes(n.id));
      if (highlighted.length > 0) {
        const avgX = highlighted.reduce((sum, n) => sum + n.x + n.width / 2, 0) / highlighted.length;
        const avgY = highlighted.reduce((sum, n) => sum + n.y + n.height / 2, 0) / highlighted.length;
        updateDiagram(
          (prev) => ({
            ...prev,
            viewport: {
              ...prev.viewport,
              x: bounds.width / 2 - avgX * prev.viewport.zoom - (isSidebarCollapsed ? 40 : 160),
              y: bounds.height / 2 - avgY * prev.viewport.zoom,
            },
          }),
          false
        );
      }
    }
  };

  const handleAddPresentationStep = (step?: Omit<PresentationStep, 'id' | 'stepNumber'>) => {
    const stepNumber = (diagram.presentationSteps?.length || 0) + 1;
    const newStep: PresentationStep = step
      ? {
          ...step,
          id: generateId('step'),
          stepNumber,
        }
      : {
          id: generateId('step'),
          stepNumber,
          title: `Bước ${stepNumber}`,
          explanation: 'Mô tả kịch bản kiến trúc...',
          highlightNodeIds: selectedNodeIds.length > 0 ? [...selectedNodeIds] : [],
          highlightEdgeIds: selectedEdgeId ? [selectedEdgeId] : [],
        };
    updateDiagram((prev) => ({
      ...prev,
      presentationSteps: [...(prev.presentationSteps || []), newStep],
    }));
  };

  const handleDeletePresentationStep = (stepId: string) => {
    updateDiagram((prev) => ({
      ...prev,
      presentationSteps: (prev.presentationSteps || []).filter((s) => s.id !== stepId),
    }));
    if (activeStep?.id === stepId) setActiveStep(null);
  };

  // Header Drag Event Handlers
  const handleHeaderPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, textarea')) return;
    if (isMaximized || (typeof window !== 'undefined' && window.innerWidth < 768)) return;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX: bounds.x,
      startY: bounds.y,
    };
    setIsDraggingPanel(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleHeaderPointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;
    const nextX = Math.max(0, Math.min(window.innerWidth - 120, dragStartRef.current.startX + dx));
    const nextY = Math.max(0, Math.min(window.innerHeight - 60, dragStartRef.current.startY + dy));
    setBounds((prev) => ({ ...prev, x: nextX, y: nextY }));
  };

  const handleHeaderPointerUp = (e: React.PointerEvent) => {
    if (dragStartRef.current) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      dragStartRef.current = null;
      setIsDraggingPanel(false);
      try {
        localStorage.setItem(STORAGE_KEY_BOUNDS, JSON.stringify(bounds));
      } catch {
        // Fallback
      }
    }
  };

  // 8-Handle Resize Event Handlers
  const handleResizePointerDown = (e: React.PointerEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (isMaximized) return;
    resizeStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialBounds: { ...bounds },
      handle,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!resizeStartRef.current) return;
    const { clientX: startCX, clientY: startCY, initialBounds, handle } = resizeStartRef.current;
    const dx = e.clientX - startCX;
    const dy = e.clientY - startCY;

    let newX = initialBounds.x;
    let newY = initialBounds.y;
    let newW = initialBounds.width;
    let newH = initialBounds.height;

    const MIN_W = 520;
    const MIN_H = 380;

    if (handle.includes('e')) {
      newW = Math.max(MIN_W, Math.min(window.innerWidth - initialBounds.x - 12, initialBounds.width + dx));
    }
    if (handle.includes('s')) {
      newH = Math.max(MIN_H, Math.min(window.innerHeight - initialBounds.y - 12, initialBounds.height + dy));
    }
    if (handle.includes('w')) {
      const potW = initialBounds.width - dx;
      if (potW >= MIN_W) {
        newX = Math.max(10, initialBounds.x + dx);
        newW = potW;
      }
    }
    if (handle.includes('n')) {
      const potH = initialBounds.height - dy;
      if (potH >= MIN_H) {
        newY = Math.max(10, initialBounds.y + dy);
        newH = potH;
      }
    }

    setBounds({ x: newX, y: newY, width: newW, height: newH });
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    if (resizeStartRef.current) {
      if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }
      resizeStartRef.current = null;
      try {
        localStorage.setItem(STORAGE_KEY_BOUNDS, JSON.stringify(bounds));
      } catch {
        // Fallback
      }
    }
  };

  if (!isOpen) return null;

  const selectedNode =
    selectedNodeIds.length === 1
      ? diagram.nodes.find((n) => n.id === selectedNodeIds[0]) || null
      : null;
  const selectedEdge = selectedEdgeId
    ? diagram.edges.find((e) => e.id === selectedEdgeId) || null
    : null;
  const selectedFrame = selectedFrameId
    ? (diagram.frames || []).find((f) => f.id === selectedFrameId) || null
    : null;

  // Compute container position
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const containerStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
      }
    : isMaximized
    ? {
        position: 'fixed',
        top: 12,
        left: 12,
        right: 12,
        bottom: 12,
        width: 'calc(100vw - 24px)',
        height: 'calc(100vh - 24px)',
      }
    : {
        position: 'fixed',
        top: `${bounds.y}px`,
        left: `${bounds.x}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
      };

  return (
    <div
      style={containerStyle}
      className={`z-50 flex flex-col bg-white dark:bg-slate-900 shadow-2xl overflow-hidden font-sans select-none ${
        isMobile ? 'rounded-none border-0' : 'rounded-2xl border border-slate-300/80 dark:border-slate-800'
      }`}
    >
      {/* 8 Perimeter Resize Handles */}
      {!isMaximized && !isMobile && (
        <>
          {/* Edges */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'n')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute top-0 left-3 right-3 h-1.5 cursor-ns-resize z-50 hover:bg-blue-500/30"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 's')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute bottom-0 left-3 right-3 h-1.5 cursor-ns-resize z-50 hover:bg-blue-500/30"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'w')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute top-3 bottom-3 left-0 w-1.5 cursor-ew-resize z-50 hover:bg-blue-500/30"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'e')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute top-3 bottom-3 right-0 w-1.5 cursor-ew-resize z-50 hover:bg-blue-500/30"
          />

          {/* Corners */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'nw')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute top-0 left-0 w-3.5 h-3.5 cursor-nwse-resize z-50 hover:bg-blue-500/40"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'ne')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute top-0 right-0 w-3.5 h-3.5 cursor-nesw-resize z-50 hover:bg-blue-500/40"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'sw')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute bottom-0 left-0 w-3.5 h-3.5 cursor-nesw-resize z-50 hover:bg-blue-500/40"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown(e, 'se')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize z-50 hover:bg-blue-500/40"
          />
        </>
      )}

      {/* Hidden File Input for JSON import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top Header Bar (Draggable handle) */}
      <div
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        className={`flex items-center justify-between px-3 py-1.5 bg-slate-100/90 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 select-none shrink-0 z-30 ${
          isMaximized ? '' : isDraggingPanel ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Left: Drag Grip + Logo & Title */}
        <div className="flex items-center gap-2">
          {!isMaximized && (
            <GripVertical className="w-4 h-4 text-slate-400 dark:text-slate-500 cursor-grab active:cursor-grabbing shrink-0" />
          )}
          <div className="p-1 rounded-lg bg-blue-600 text-white shadow-xs shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>

          <div className="flex items-center gap-2">
            {isEditingTitle ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={() => {
                    if (titleInput.trim()) {
                      handleRenameSheet(diagram.id, titleInput.trim());
                    }
                    setIsEditingTitle(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (titleInput.trim()) {
                        handleRenameSheet(diagram.id, titleInput.trim());
                      }
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  className="px-2 py-0.5 text-xs font-bold bg-white dark:bg-slate-800 border border-blue-500 rounded text-slate-900 dark:text-white focus:outline-hidden"
                />
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="p-1 text-emerald-500 hover:text-emerald-600"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <h1
                onClick={() => {
                  setTitleInput(diagram.name);
                  setIsEditingTitle(true);
                }}
                className="text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:text-blue-500 transition-colors"
                title="Nhấn để đổi tên sheet"
              >
                <span>{diagram.name}</span>
                <Edit2 className="w-3 h-3 opacity-40 hover:opacity-100" />
              </h1>
            )}
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium">
              Autosaved
            </span>
          </div>
        </div>

        {/* Right: Theme & Window Controls */}
        <div className="flex items-center gap-1">
          {/* Theme Toggle Button (Rule 2) */}
          <button
            onClick={toggleTheme}
            title={isDarkMode ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-500" />}
          </button>

          {/* Minimize [-] */}
          <button
            onClick={onMinimize}
            title="Thu nhỏ cửa sổ"
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Maximize / Restore [□] */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Khôi phục kích thước' : 'Phóng to'}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
          </button>

          {/* Close [×] */}
          <button
            onClick={onClose}
            title="Đóng Workspace"
            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/60 text-slate-500 hover:text-red-500 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Toolbar */}
      <DiagramToolbar
        toolMode={toolMode}
        onSelectTool={setToolMode}
        connectorType={connectorType}
        onChangeConnectorType={setConnectorType}
        background={diagram.background}
        onChangeBackground={(bg: CanvasBackground) =>
          updateDiagram((prev) => ({ ...prev, background: bg }))
        }
        zoom={diagram.viewport.zoom}
        onZoomIn={() =>
          updateDiagram((prev) => ({
            ...prev,
            viewport: { ...prev.viewport, zoom: Math.min(4.0, prev.viewport.zoom * 1.15) },
          }))
        }
        onZoomOut={() =>
          updateDiagram((prev) => ({
            ...prev,
            viewport: { ...prev.viewport, zoom: Math.max(0.1, prev.viewport.zoom * 0.85) },
          }))
        }
        onResetZoom={() =>
          updateDiagram((prev) => ({
            ...prev,
            viewport: { ...prev.viewport, zoom: 1 },
          }))
        }
        onFitView={() => {
          if (diagram.nodes.length === 0) return;
          const minX = Math.min(...diagram.nodes.map((n) => n.x));
          const maxX = Math.max(...diagram.nodes.map((n) => n.x + n.width));
          const minY = Math.min(...diagram.nodes.map((n) => n.y));
          const maxY = Math.max(...diagram.nodes.map((n) => n.y + n.height));
          const w = maxX - minX + 160;
          const h = maxY - minY + 160;
          const zoom = Math.min(
            1.5,
            Math.max(0.3, Math.min(bounds.width / w, bounds.height / h))
          );
          updateDiagram((prev) => ({
            ...prev,
            viewport: {
              x: (bounds.width - (isSidebarCollapsed ? 60 : 300) - (isAIPanelOpen ? aiPanelWidth : 0) - w * zoom) / 2 - minX * zoom,
              y: (bounds.height - 100 - h * zoom) / 2 - minY * zoom,
              zoom,
            },
          }));
        }}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        isFlowPlaying={isFlowPlaying}
        onToggleFlowPlay={() => setIsFlowPlaying(!isFlowPlaying)}
        flowSpeed={flowSpeed}
        onChangeFlowSpeed={setFlowSpeed}
        onAutoLayout={handleAutoLayout}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onToggleAIPanel={() => setIsAIPanelOpen(!isAIPanelOpen)}
        isAIPanelOpen={isAIPanelOpen}
        onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isSidebarCollapsed={isSidebarCollapsed}
        onExportPNG={handleExportPNG}
        onExportSVG={handleExportSVG}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSONClick}
        onImportMermaid={() => setIsMermaidModalOpen(true)}
        onClearCanvas={() => {
          if (confirm('Bạn có chắc chắn muốn xóa toàn bộ sơ đồ trên sheet này không?')) {
            updateDiagram((prev) => ({
              ...prev,
              nodes: [],
              edges: [],
              frames: [],
              presentationSteps: [],
            }));
            setSelectedNodeIds([]);
            setSelectedEdgeId(null);
            setSelectedFrameId(null);
          }
        }}
      />

      {/* Sheets Bar directly beneath Toolbar/Navbar */}
      <DiagramSheetsBar
        sheets={workbook.sheets}
        activeSheetId={workbook.activeSheetId}
        onSelectSheet={handleSelectSheet}
        onAddSheet={handleAddSheet}
        onRenameSheet={handleRenameSheet}
        onDuplicateSheet={handleDuplicateSheet}
        onDeleteSheet={handleDeleteSheet}
      />

      {/* Center Layout: Sidebar + Canvas + AI Split View */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <DiagramSidebar
          diagram={diagram}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onAddAwsNode={handleAddAwsNode}
          onSelectNode={(id) => handleSelectNode(id, false)}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onToggleLockNode={handleToggleLockNode}
          onToggleHideNode={handleToggleHideNode}
          onUpdateEdge={handleUpdateEdge}
          onDeleteEdge={handleDeleteEdge}
          onLoadTemplate={handleLoadTemplate}
          onPlayStepFlow={handlePlayStepFlow}
          onAddPresentationStep={handleAddPresentationStep}
          onDeletePresentationStep={handleDeletePresentationStep}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Center Interactive Canvas Container */}
        <div className="flex-1 h-full relative overflow-hidden flex flex-col">
          {/* Floating Contextual Property Bar */}
          <DiagramContextualBar
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            selectedFrame={selectedFrame}
            onUpdateNode={handleUpdateNode}
            onUpdateEdge={handleUpdateEdge}
            onUpdateFrame={handleUpdateFrame}
            onDeleteSelected={handleDeleteSelected}
          />

          {/* Interactive SVG Canvas */}
          <div className="flex-1 relative overflow-hidden">
            <DiagramCanvas
              diagram={diagram}
              toolMode={toolMode}
              onSelectTool={setToolMode}
              selectedNodeIds={selectedNodeIds}
              selectedEdgeId={selectedEdgeId}
              selectedFrameId={selectedFrameId}
              onSelectNode={handleSelectNode}
              onSelectEdge={handleSelectEdge}
              onSelectFrame={handleSelectFrame}
              onUpdateNode={handleUpdateNode}
              onBatchUpdateNodes={handleBatchUpdateNodes}
              onUpdateFrame={handleUpdateFrame}
              onBatchUpdateFrames={handleBatchUpdateFrames}
              onAddNode={handleAddNode}
              onAddFrame={handleAddFrame}
              onBatchAdd={handleBatchAdd}
              onDeleteSelected={handleDeleteSelected}
              onAddEdge={handleAddEdge}
              onUpdateEdge={handleUpdateEdge}
              onUpdateViewport={(vp) => updateDiagram((prev) => ({ ...prev, viewport: vp }), false)}
              isFlowPlaying={isFlowPlaying}
              flowSpeed={flowSpeed}
              onUndo={handleUndo}
              onRedo={handleRedo}
              highlightNodeIds={activeStep?.highlightNodeIds || []}
              highlightEdgeIds={activeStep?.highlightEdgeIds || []}
            />

            {/* Active Presentation Step Banner */}
            {activeStep && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-lg w-full px-4">
                <div className="p-3 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-emerald-500/50 shadow-2xl text-slate-800 dark:text-slate-100 flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-xs">
                        Bước {activeStep.stepNumber}
                      </span>
                      <h4 className="font-bold text-xs">{activeStep.title}</h4>
                    </div>
                    <button
                      onClick={() => setActiveStep(null)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {activeStep.explanation}
                  </p>
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-slate-800 text-xs">
                    <span className="text-slate-400 text-[10px]">
                      {diagram.presentationSteps?.length || 1} bước trong kịch bản
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const steps = diagram.presentationSteps || [];
                          const currIdx = steps.findIndex((s) => s.id === activeStep.id);
                          if (currIdx > 0) handlePlayStepFlow(steps[currIdx - 1]);
                        }}
                        className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 text-[11px]"
                      >
                        <ChevronLeft className="w-3 h-3" />
                        <span>Trước</span>
                      </button>
                      <button
                        onClick={() => {
                          const steps = diagram.presentationSteps || [];
                          const currIdx = steps.findIndex((s) => s.id === activeStep.id);
                          if (currIdx < steps.length - 1) handlePlayStepFlow(steps[currIdx + 1]);
                        }}
                        className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 font-semibold text-[11px]"
                      >
                        <span>Tiếp</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right AI Assistant Split Panel */}
        {isAIPanelOpen && (
          <DiagramAISplitView
            diagram={diagram}
            selectedNode={selectedNode}
            onApplyDiagramChange={(updated) => updateDiagram(() => updated)}
            onClose={() => setIsAIPanelOpen(false)}
            width={aiPanelWidth}
            onResizeWidth={setAiPanelWidth}
          />
        )}
      </div>

      {/* Keyboard Shortcuts Modal */}
      <DiagramShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Mermaid Import Dialog Modal */}
      {isMermaidModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl text-slate-800 dark:text-slate-100 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold">Nhập cú pháp Mermaid Flowchart</h3>
              </div>
              <button
                onClick={() => setIsMermaidModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dán mã Mermaid flowchart vào ô dưới đây để tự động chuyển thành sơ đồ kiến trúc trực quan:
            </p>

            <textarea
              rows={7}
              value={mermaidInput}
              onChange={(e) => setMermaidInput(e.target.value)}
              placeholder={`flowchart LR\n  User["Client"] --> CloudFront["Amazon CloudFront"]\n  CloudFront --> ALB["Application Load Balancer"]\n  ALB --> EC2["EC2 Auto Scaling"]\n  EC2 --> RDS[("Amazon RDS Aurora")]`}
              className="w-full p-2.5 font-mono text-xs rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100"
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setIsMermaidModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleImportMermaid}
                disabled={!mermaidInput.trim()}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
              >
                Chuyển thành Sơ đồ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
