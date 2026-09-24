import React, { useRef, useState, useEffect, useCallback } from 'react';
import type {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramFrame,
  AnchorDirection,
} from '../../core/diagram/diagramTypes';
import type { ToolMode } from './DiagramToolbar';
import { getAnchorPoint, computeOrthogonalWaypoints, getBestAnchorPair } from '../../core/diagram/diagramAutoLayout';
import { generateId } from '../../core/diagram/diagramStorage';

interface DiagramCanvasProps {
  diagram: Diagram;
  toolMode: ToolMode;
  onSelectTool: (mode: ToolMode) => void;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  selectedFrameId?: string | null;
  onSelectNode: (nodeId: string | null, isMulti?: boolean) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onSelectFrame?: (frameId: string | null) => void;
  onUpdateNode: (nodeId: string, changes: Partial<DiagramNode>) => void;
  onBatchUpdateNodes: (updates: Array<{ id: string; changes: Partial<DiagramNode> }>) => void;
  onUpdateFrame?: (frameId: string, changes: Partial<DiagramFrame>) => void;
  onBatchUpdateFrames?: (updates: Array<{ id: string; changes: Partial<DiagramFrame> }>) => void;
  onAddNode: (node: DiagramNode) => void;
  onAddFrame?: (frame: DiagramFrame) => void;
  onBatchAdd?: (data: { frames?: DiagramFrame[]; nodes?: DiagramNode[]; edges?: DiagramEdge[] }) => void;
  onDeleteSelected: () => void;
  onAddEdge: (edge: DiagramEdge) => void;
  onUpdateEdge: (edgeId: string, changes: Partial<DiagramEdge>) => void;
  onUpdateViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  isFlowPlaying: boolean;
  flowSpeed: 'slow' | 'normal' | 'fast';
  onUndo: () => void;
  onRedo: () => void;
  highlightNodeIds?: string[];
  highlightEdgeIds?: string[];
}

interface DragState {
  type: 'pan' | 'drag-nodes' | 'drag-frame' | 'resize-frame' | 'create-edge' | 'marquee' | 'resize';
  startX: number;
  startY: number;
  initialNodePositions?: Map<string, { x: number; y: number }>;
  initialFramePositions?: Map<string, { x: number; y: number }>;
  targetFrameId?: string;
  initialViewport?: { x: number; y: number };
  sourceNodeId?: string;
  sourceAnchor?: AnchorDirection;
  currentMouse?: { x: number; y: number };
  resizeHandle?: string;
  initialBounds?: { x: number; y: number; width: number; height: number };
  initialFontSize?: number;
}

/**
 * Recursively find all child frames and nodes contained within a target frame
 */
function getContainedFramesAndNodes(
  frame: DiagramFrame,
  allFrames: DiagramFrame[],
  allNodes: DiagramNode[]
): { frameIds: string[]; nodeIds: string[] } {
  const frameIds = new Set<string>([frame.id]);

  let added = true;
  while (added) {
    added = false;
    for (const f of allFrames) {
      if (!frameIds.has(f.id)) {
        for (const parentId of frameIds) {
          const parent = allFrames.find((p) => p.id === parentId);
          if (
            parent &&
            f.x >= parent.x - 15 &&
            f.x + f.width <= parent.x + parent.width + 60 &&
            f.y >= parent.y - 15 &&
            f.y + f.height <= parent.y + parent.height + 60
          ) {
            frameIds.add(f.id);
            added = true;
            break;
          }
        }
      }
    }
  }

  const nodeIds: string[] = [];
  for (const node of allNodes) {
    const nodeCenterX = node.x + node.width / 2;
    const nodeCenterY = node.y + node.height / 2;
    for (const fId of frameIds) {
      const f = allFrames.find((item) => item.id === fId);
      if (
        f &&
        (node.frameId === f.id ||
          (nodeCenterX >= f.x &&
            nodeCenterX <= f.x + f.width &&
            nodeCenterY >= f.y &&
            nodeCenterY <= f.y + f.height))
      ) {
        nodeIds.push(node.id);
        break;
      }
    }
  }

  return { frameIds: Array.from(frameIds), nodeIds };
}

export const DiagramCanvas: React.FC<DiagramCanvasProps> = ({
  diagram,
  toolMode,
  onSelectTool,
  selectedNodeIds,
  selectedEdgeId,
  selectedFrameId = null,
  onSelectNode,
  onSelectEdge,
  onSelectFrame,
  onUpdateNode,
  onBatchUpdateNodes,
  onUpdateFrame,
  onBatchUpdateFrames,
  onAddNode,
  onAddFrame,
  onBatchAdd,
  onDeleteSelected,
  onAddEdge,
  onUpdateEdge,
  onUpdateViewport,
  isFlowPlaying,
  flowSpeed,
  onUndo,
  onRedo,
  highlightNodeIds = [],
  highlightEdgeIds = [],
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredFrameId, setHoveredFrameId] = useState<string | null>(null);
  const [editingElement, setEditingElement] = useState<{ id: string; type: 'node' | 'edge' | 'frame'; text: string } | null>(null);

  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Clipboard state for Ctrl+C, Ctrl+V, Ctrl+D and context menu
  const clipboardRef = useRef<{
    type: 'frame' | 'nodes';
    frame?: DiagramFrame;
    childFrames?: DiagramFrame[];
    nodes?: DiagramNode[];
    edges?: DiagramEdge[];
  } | null>(null);
  const [hasClipboard, setHasClipboard] = useState(false);

  // Right-click tracking to distinguish drag-pan vs click context menu
  const rightMouseDownRef = useRef<{ clientX: number; clientY: number; moved: boolean } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    screenX: number;
    screenY: number;
    canvasX: number;
    canvasY: number;
  } | null>(null);

  // Convert screen client coordinates to SVG canvas space
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      const zoom = diagram.viewport.zoom;
      return {
        x: (clientX - rect.left - diagram.viewport.x) / zoom,
        y: (clientY - rect.top - diagram.viewport.y) / zoom,
      };
    },
    [diagram.viewport]
  );

  // Copy handler
  const handleCopy = useCallback(() => {
    if (selectedFrameId) {
      const targetFrame = diagram.frames.find((f) => f.id === selectedFrameId);
      if (targetFrame) {
        const { frameIds, nodeIds } = getContainedFramesAndNodes(targetFrame, diagram.frames, diagram.nodes);
        const childFrames = diagram.frames.filter((f) => f.id !== targetFrame.id && frameIds.includes(f.id));
        const containedNodes = diagram.nodes.filter((n) => nodeIds.includes(n.id));
        clipboardRef.current = {
          type: 'frame',
          frame: JSON.parse(JSON.stringify(targetFrame)),
          childFrames: JSON.parse(JSON.stringify(childFrames)),
          nodes: JSON.parse(JSON.stringify(containedNodes)),
        };
        setHasClipboard(true);
      }
    } else if (selectedNodeIds.length > 0) {
      const nodes = diagram.nodes.filter((n) => selectedNodeIds.includes(n.id));
      const edges = diagram.edges.filter(
        (e) => selectedNodeIds.includes(e.sourceNodeId) && selectedNodeIds.includes(e.targetNodeId)
      );
      clipboardRef.current = {
        type: 'nodes',
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
      };
      setHasClipboard(true);
    }
  }, [selectedFrameId, selectedNodeIds, diagram.frames, diagram.nodes, diagram.edges]);

  // Paste handler
  const handlePaste = useCallback(
    (targetPos?: { x: number; y: number }) => {
      const clip = clipboardRef.current;
      if (!clip) return;

      if (clip.type === 'frame' && clip.frame) {
        const idMap = new Map<string, string>();
        const newMainFrameId = generateId('frame');
        idMap.set(clip.frame.id, newMainFrameId);

        const offsetX = targetPos ? targetPos.x - clip.frame.x : 30;
        const offsetY = targetPos ? targetPos.y - clip.frame.y : 30;

        const newMainFrame: DiagramFrame = {
          ...clip.frame,
          id: newMainFrameId,
          title: `${clip.frame.title} (Copy)`,
          x: Math.round(clip.frame.x + offsetX),
          y: Math.round(clip.frame.y + offsetY),
        };

        const newChildFrames: DiagramFrame[] = (clip.childFrames || []).map((f) => {
          const newFId = generateId('frame');
          idMap.set(f.id, newFId);
          return {
            ...f,
            id: newFId,
            x: Math.round(f.x + offsetX),
            y: Math.round(f.y + offsetY),
          };
        });

        const newNodes: DiagramNode[] = (clip.nodes || []).map((n) => {
          const newNId = generateId('node');
          idMap.set(n.id, newNId);
          return {
            ...n,
            id: newNId,
            frameId: n.frameId && idMap.has(n.frameId) ? idMap.get(n.frameId) : undefined,
            x: Math.round(n.x + offsetX),
            y: Math.round(n.y + offsetY),
          };
        });

        if (onBatchAdd) {
          onBatchAdd({ frames: [newMainFrame, ...newChildFrames], nodes: newNodes });
        } else {
          onAddFrame?.(newMainFrame);
          newChildFrames.forEach((cf) => onAddFrame?.(cf));
          newNodes.forEach((cn) => onAddNode(cn));
        }

        onSelectFrame?.(newMainFrameId);
        onSelectNode(null);
      } else if (clip.type === 'nodes' && clip.nodes && clip.nodes.length > 0) {
        const idMap = new Map<string, string>();
        let offsetX = 30;
        let offsetY = 30;
        if (targetPos && clip.nodes[0]) {
          offsetX = targetPos.x - clip.nodes[0].x;
          offsetY = targetPos.y - clip.nodes[0].y;
        }

        const newNodes: DiagramNode[] = clip.nodes.map((n) => {
          const newId = generateId('node');
          idMap.set(n.id, newId);
          return {
            ...n,
            id: newId,
            x: Math.round(n.x + offsetX),
            y: Math.round(n.y + offsetY),
          };
        });

        const newEdges: DiagramEdge[] = (clip.edges || []).map((e) => ({
          ...e,
          id: generateId('edge'),
          sourceNodeId: idMap.get(e.sourceNodeId) || e.sourceNodeId,
          targetNodeId: idMap.get(e.targetNodeId) || e.targetNodeId,
        }));

        if (onBatchAdd) {
          onBatchAdd({ nodes: newNodes, edges: newEdges });
        } else {
          newNodes.forEach((n) => onAddNode(n));
          newEdges.forEach((e) => onAddEdge(e));
        }

        const newIds = newNodes.map((n) => n.id);
        if (newIds.length > 0) {
          newIds.forEach((id, idx) => onSelectNode(id, idx > 0));
          onSelectFrame?.(null);
        }
      }
    },
    [onBatchAdd, onAddFrame, onAddNode, onAddEdge, onSelectFrame, onSelectNode]
  );

  // Duplicate handler (Ctrl+D)
  const handleDuplicate = useCallback(() => {
    handleCopy();
    handlePaste();
  }, [handleCopy, handlePaste]);

  // Global spacebar tracking for panning (draw.io behavior)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        setIsSpacePressed(true);
      }
    };
    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('keyup', handleGlobalKeyUp);
    };
  }, []);

  // Global click & esc listener to close context menu
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest?.('.context-menu-dropdown')) return;
      setContextMenu(null);
    };
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  // Global mouseup to cleanly release pan when dragging outside SVG
  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (dragState?.type === 'pan' && (e.button === 2 || e.button === 1 || e.button === 0)) {
        setDragState(null);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragState?.type]);

  // Keyboard shortcuts within canvas
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is editing text in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedNodeIds.length > 0 || selectedEdgeId || selectedFrameId)) {
        e.preventDefault();
        onDeleteSelected();
      } else if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        onUndo();
      } else if (
        (e.key.toLowerCase() === 'y' && (e.ctrlKey || e.metaKey)) ||
        (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)
      ) {
        e.preventDefault();
        onRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopy();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePaste();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicate();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (diagram.nodes.length > 0) {
          diagram.nodes.forEach((n, idx) => onSelectNode(n.id, idx > 0));
          onSelectFrame?.(null);
        }
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (selectedNodeIds.length > 0) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 2;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          const updates = selectedNodeIds.map((id) => {
            const n = diagram.nodes.find((node) => node.id === id);
            return { id, changes: { x: (n?.x || 0) + dx, y: (n?.y || 0) + dy } };
          });
          onBatchUpdateNodes(updates);
        } else if (selectedFrameId) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 2;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          const targetFrame = diagram.frames.find((f) => f.id === selectedFrameId);
          if (targetFrame) {
            const { frameIds, nodeIds } = getContainedFramesAndNodes(targetFrame, diagram.frames, diagram.nodes);
            const fUpdates = frameIds.map((fId) => {
              const cur = diagram.frames.find((item) => item.id === fId);
              return { id: fId, changes: { x: (cur?.x || 0) + dx, y: (cur?.y || 0) + dy } };
            });
            onBatchUpdateFrames?.(fUpdates);
            if (nodeIds.length > 0) {
              const nUpdates = nodeIds.map((nId) => {
                const cur = diagram.nodes.find((item) => item.id === nId);
                return { id: nId, changes: { x: (cur?.x || 0) + dx, y: (cur?.y || 0) + dy } };
              });
              onBatchUpdateNodes(nUpdates);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedNodeIds,
    selectedEdgeId,
    selectedFrameId,
    onDeleteSelected,
    onUndo,
    onRedo,
    handleCopy,
    handlePaste,
    handleDuplicate,
    onSelectNode,
    onSelectFrame,
    diagram.nodes,
    diagram.frames,
    onBatchUpdateNodes,
    onBatchUpdateFrames,
  ]);

  // Handle Wheel Zoom (towards cursor) and Trackpad Pan
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!svgRef.current) return;

    if (e.ctrlKey || e.metaKey) {
      // Zoom toward cursor (draw.io / Figma behavior)
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
      const newZoom = Math.min(4.0, Math.max(0.1, diagram.viewport.zoom * zoomFactor));

      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const scaleChange = newZoom / diagram.viewport.zoom;
      const newX = mouseX - (mouseX - diagram.viewport.x) * scaleChange;
      const newY = mouseY - (mouseY - diagram.viewport.y) * scaleChange;

      onUpdateViewport({ x: newX, y: newY, zoom: newZoom });
    } else {
      // Pan with wheel / trackpad
      onUpdateViewport({
        ...diagram.viewport,
        x: diagram.viewport.x - e.deltaX,
        y: diagram.viewport.y - e.deltaY,
      });
    }
  };

  // Canvas Mouse Down
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Close context menu if open
    if (contextMenu?.isOpen) {
      setContextMenu(null);
    }

    // Right click (button 2) -> track for drag-pan vs click context menu
    if (e.button === 2) {
      rightMouseDownRef.current = { clientX: e.clientX, clientY: e.clientY, moved: false };
      setDragState({
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        initialViewport: { ...diagram.viewport },
      });
      return;
    }

    // Middle click (button 1), spacebar held, or pan tool mode -> initiate pan
    if (e.button === 1 || isSpacePressed || toolMode === 'pan') {
      e.preventDefault();
      setDragState({
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        initialViewport: { ...diagram.viewport },
      });
      return;
    }

    if (e.button !== 0) return; // Left click only for subsequent actions
    const pt = screenToCanvas(e.clientX, e.clientY);

    // If in shape creation mode, create shape immediately where clicked
    if (toolMode.startsWith('shape-')) {
      const shapeType = toolMode.replace('shape-', '') as DiagramNode['type'];
      const isText = shapeType === 'text';
      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      const defaultTextColor = isDark ? '#f8fafc' : '#0f172a';

      const newNode: DiagramNode = {
        id: generateId('node'),
        type: shapeType,
        label: isText
          ? 'Nhập văn bản...'
          : shapeType === 'aws-service'
          ? 'New Service'
          : shapeType === 'sticky'
          ? 'Note...'
          : 'New Block',
        x: Math.round(pt.x - (isText ? 60 : 75)),
        y: Math.round(pt.y - (isText ? 18 : 35)),
        width: isText ? 140 : shapeType === 'circle' ? 90 : shapeType === 'diamond' ? 110 : shapeType === 'frame' ? 320 : 150,
        height: isText ? 36 : shapeType === 'circle' ? 90 : shapeType === 'diamond' ? 80 : shapeType === 'frame' ? 220 : 70,
        style: {
          fill: isText ? 'transparent' : shapeType === 'sticky' ? '#fef08a' : shapeType === 'frame' ? '#0f172a15' : '#1e293b',
          stroke: isText ? 'transparent' : shapeType === 'sticky' ? '#eab308' : shapeType === 'frame' ? '#8b5cf6' : '#38bdf8',
          strokeWidth: isText ? 0 : 2,
          textColor: isText ? defaultTextColor : shapeType === 'sticky' ? '#713f12' : '#f8fafc',
          borderRadius: 8,
          fontSize: isText ? 16 : 12,
          strokeDash: shapeType === 'frame' ? 'dashed' : 'solid',
        },
      };
      onAddNode(newNode);
      onSelectNode(newNode.id);
      onSelectFrame?.(null);
      if (isText) {
        setEditingElement({ id: newNode.id, type: 'node', text: 'Nhập văn bản...' });
      }
      onSelectTool('select');
      return;
    }

    // Marquee selection start on canvas background
    onSelectNode(null);
    onSelectEdge(null);
    onSelectFrame?.(null);
    setDragState({
      type: 'marquee',
      startX: pt.x,
      startY: pt.y,
      currentMouse: { x: pt.x, y: pt.y },
    });
  };

  // Node Mouse Down
  const handleNodeMouseDown = (e: React.MouseEvent, node: DiagramNode) => {
    if (e.button === 2) return; // allow right-click pan to bubble
    e.stopPropagation();
    if (e.button !== 0) return;

    onSelectFrame?.(null);

    if (node.locked) {
      onSelectNode(node.id);
      return;
    }

    const isMulti = e.shiftKey;
    const isAlreadySelected = selectedNodeIds.includes(node.id);

    if (!isAlreadySelected) {
      onSelectNode(node.id, isMulti);
    }

    const activeNodeIds = isAlreadySelected ? selectedNodeIds : isMulti ? [...selectedNodeIds, node.id] : [node.id];
    const initialPositions = new Map<string, { x: number; y: number }>();
    activeNodeIds.forEach((id) => {
      const n = diagram.nodes.find((item) => item.id === id);
      if (n) initialPositions.set(id, { x: n.x, y: n.y });
    });

    const pt = screenToCanvas(e.clientX, e.clientY);
    setDragState({
      type: 'drag-nodes',
      startX: pt.x,
      startY: pt.y,
      initialNodePositions: initialPositions,
    });
  };

  // Frame Mouse Down — Drag frame and its nested subnets and nodes
  const handleFrameMouseDown = (e: React.MouseEvent, frame: DiagramFrame) => {
    if (e.button === 2) return; // allow right-click pan to bubble
    e.stopPropagation();
    if (e.button !== 0) return;

    onSelectFrame?.(frame.id);
    onSelectNode(null);
    onSelectEdge(null);

    const pt = screenToCanvas(e.clientX, e.clientY);

    // Recursively collect all descendant frames and nodes inside this frame
    const { frameIds, nodeIds } = getContainedFramesAndNodes(frame, diagram.frames, diagram.nodes);

    const initialFramePositions = new Map<string, { x: number; y: number }>();
    frameIds.forEach((fId) => {
      const f = diagram.frames.find((item) => item.id === fId);
      if (f) initialFramePositions.set(fId, { x: f.x, y: f.y });
    });

    const initialNodePositions = new Map<string, { x: number; y: number }>();
    nodeIds.forEach((nId) => {
      const n = diagram.nodes.find((item) => item.id === nId);
      if (n) initialNodePositions.set(nId, { x: n.x, y: n.y });
    });

    setDragState({
      type: 'drag-frame',
      targetFrameId: frame.id,
      startX: pt.x,
      startY: pt.y,
      initialFramePositions,
      initialNodePositions,
    });
  };

  // Frame Resize Mouse Down
  const handleFrameResizeMouseDown = (e: React.MouseEvent, frame: DiagramFrame) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const pt = screenToCanvas(e.clientX, e.clientY);
    setDragState({
      type: 'resize-frame',
      targetFrameId: frame.id,
      startX: pt.x,
      startY: pt.y,
      initialBounds: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
    });
  };

  // Start connector drag from anchor point
  const handleAnchorMouseDown = (e: React.MouseEvent, nodeId: string, direction: AnchorDirection) => {
    e.stopPropagation();
    const pt = screenToCanvas(e.clientX, e.clientY);
    setDragState({
      type: 'create-edge',
      startX: pt.x,
      startY: pt.y,
      sourceNodeId: nodeId,
      sourceAnchor: direction,
      currentMouse: { x: pt.x, y: pt.y },
    });
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    // Track distance moved if right mouse button was pressed to distinguish pan drag vs context menu click
    if (rightMouseDownRef.current && !rightMouseDownRef.current.moved) {
      const dist = Math.hypot(
        e.clientX - rightMouseDownRef.current.clientX,
        e.clientY - rightMouseDownRef.current.clientY
      );
      if (dist > 5) {
        rightMouseDownRef.current.moved = true;
      }
    }

    if (!dragState) return;

    if (dragState.type === 'pan' && dragState.initialViewport) {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      onUpdateViewport({
        ...diagram.viewport,
        x: dragState.initialViewport.x + dx,
        y: dragState.initialViewport.y + dy,
      });
      return;
    }

    const pt = screenToCanvas(e.clientX, e.clientY);

    if (dragState.type === 'drag-frame' && dragState.initialFramePositions) {
      const dx = pt.x - dragState.startX;
      const dy = pt.y - dragState.startY;

      const frameUpdates: Array<{ id: string; changes: Partial<DiagramFrame> }> = [];
      dragState.initialFramePositions.forEach((pos, id) => {
        let nextX = Math.round(pos.x + dx);
        let nextY = Math.round(pos.y + dy);
        if (diagram.snapToGrid) {
          nextX = Math.round(nextX / 16) * 16;
          nextY = Math.round(nextY / 16) * 16;
        }
        frameUpdates.push({ id, changes: { x: nextX, y: nextY } });
      });
      onBatchUpdateFrames?.(frameUpdates);

      if (dragState.initialNodePositions && dragState.initialNodePositions.size > 0) {
        const nodeUpdates: Array<{ id: string; changes: Partial<DiagramNode> }> = [];
        dragState.initialNodePositions.forEach((pos, id) => {
          let nextX = Math.round(pos.x + dx);
          let nextY = Math.round(pos.y + dy);
          if (diagram.snapToGrid) {
            nextX = Math.round(nextX / 16) * 16;
            nextY = Math.round(nextY / 16) * 16;
          }
          nodeUpdates.push({ id, changes: { x: nextX, y: nextY } });
        });
        onBatchUpdateNodes(nodeUpdates);
      }
      return;
    }

    if (dragState.type === 'resize-frame' && dragState.initialBounds && dragState.targetFrameId) {
      const dx = pt.x - dragState.startX;
      const dy = pt.y - dragState.startY;
      let newW = Math.max(140, Math.round(dragState.initialBounds.width + dx));
      let newH = Math.max(60, Math.round(dragState.initialBounds.height + dy));
      if (diagram.snapToGrid) {
        newW = Math.round(newW / 16) * 16;
        newH = Math.round(newH / 16) * 16;
      }
      onUpdateFrame?.(dragState.targetFrameId, { width: newW, height: newH });
      return;
    }

    if (dragState.type === 'drag-nodes' && dragState.initialNodePositions) {
      const dx = pt.x - dragState.startX;
      const dy = pt.y - dragState.startY;

      const updates: Array<{ id: string; changes: Partial<DiagramNode> }> = [];
      dragState.initialNodePositions.forEach((pos, id) => {
        let nextX = Math.round(pos.x + dx);
        let nextY = Math.round(pos.y + dy);
        if (diagram.snapToGrid) {
          nextX = Math.round(nextX / 16) * 16;
          nextY = Math.round(nextY / 16) * 16;
        }
        updates.push({ id, changes: { x: nextX, y: nextY } });
      });
      onBatchUpdateNodes(updates);
    } else if (dragState.type === 'create-edge' || dragState.type === 'marquee') {
      setDragState((prev) => (prev ? { ...prev, currentMouse: { x: pt.x, y: pt.y } } : null));
    } else if (dragState.type === 'resize' && dragState.initialBounds && selectedNodeIds[0]) {
      const dx = pt.x - dragState.startX;
      const dy = pt.y - dragState.startY;
      const { x, y, width, height } = dragState.initialBounds;
      const handle = dragState.resizeHandle;

      let newX = x;
      let newY = y;
      let newW = width;
      let newH = height;

      if (handle?.includes('e')) newW = Math.max(40, width + dx);
      if (handle?.includes('s')) newH = Math.max(30, height + dy);
      if (handle?.includes('w')) {
        const potentialW = width - dx;
        if (potentialW >= 40) {
          newX = x + dx;
          newW = potentialW;
        }
      }
      if (handle?.includes('n')) {
        const potentialH = height - dy;
        if (potentialH >= 30) {
          newY = y + dy;
          newH = potentialH;
        }
      }

      const targetNode = diagram.nodes.find((n) => n.id === selectedNodeIds[0]);
      const changes: Partial<DiagramNode> = { x: newX, y: newY, width: newW, height: newH };

      // Proportional text font size scaling when resizing
      if (dragState.initialFontSize && targetNode && dragState.initialBounds.height > 0) {
        const scale = newH / dragState.initialBounds.height;
        const newFontSize = Math.max(10, Math.min(96, Math.round(dragState.initialFontSize * scale)));
        changes.style = {
          ...targetNode.style,
          fontSize: newFontSize,
        };
      }

      onBatchUpdateNodes([{ id: selectedNodeIds[0], changes }]);
    }
  };

  // Mouse Up
  const handleMouseUp = (_e: React.MouseEvent) => {
    if (!dragState) return;

    if (dragState.type === 'create-edge' && dragState.sourceNodeId && dragState.currentMouse) {
      // Check if dropped onto a target node
      const pt = dragState.currentMouse;
      const targetNode = diagram.nodes.find(
        (n) =>
          n.id !== dragState.sourceNodeId &&
          pt.x >= n.x &&
          pt.x <= n.x + n.width &&
          pt.y >= n.y &&
          pt.y <= n.y + n.height
      );

      if (targetNode) {
        const sNode = diagram.nodes.find((n) => n.id === dragState.sourceNodeId)!;
        const { sourceAnchor, targetAnchor } = getBestAnchorPair(sNode, targetNode);
        const newEdge: DiagramEdge = {
          id: generateId('edge'),
          sourceNodeId: dragState.sourceNodeId,
          targetNodeId: targetNode.id,
          sourceAnchor: dragState.sourceAnchor || sourceAnchor,
          targetAnchor,
          type: 'orthogonal',
          lineStyle: 'solid',
          strokeColor: '#38bdf8',
          strokeWidth: 2,
          endArrow: 'arrow',
          animated: true,
        };
        onAddEdge(newEdge);
      }
    } else if (dragState.type === 'marquee' && dragState.currentMouse) {
      const minX = Math.min(dragState.startX, dragState.currentMouse.x);
      const maxX = Math.max(dragState.startX, dragState.currentMouse.x);
      const minY = Math.min(dragState.startY, dragState.currentMouse.y);
      const maxY = Math.max(dragState.startY, dragState.currentMouse.y);

      // Select all nodes intersecting marquee
      const intersected = diagram.nodes
        .filter((n) => n.x + n.width >= minX && n.x <= maxX && n.y + n.height >= minY && n.y <= maxY)
        .map((n) => n.id);

      if (intersected.length > 0) {
        intersected.forEach((id, idx) => onSelectNode(id, idx > 0));
      }
    }

    setDragState(null);
  };

  // Start resize from handle
  const handleResizeHandleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    const node = diagram.nodes.find((n) => n.id === selectedNodeIds[0]);
    if (!node) return;
    const pt = screenToCanvas(e.clientX, e.clientY);
    setDragState({
      type: 'resize',
      startX: pt.x,
      startY: pt.y,
      resizeHandle: handle,
      initialBounds: { x: node.x, y: node.y, width: node.width, height: node.height },
      initialFontSize: node.style.fontSize || (node.type === 'text' ? 16 : 12),
    });
  };

  // Render SVG Shape
  const renderShape = (node: DiagramNode) => {
    const isSelected = selectedNodeIds.includes(node.id);
    const isHighlighted = highlightNodeIds.includes(node.id);
    const { width: w, height: h, style } = node;

    const strokeColor = isHighlighted ? '#10b981' : isSelected ? '#3b82f6' : style.stroke || '#38bdf8';
    const strokeWidth = isHighlighted || isSelected ? (style.strokeWidth || 2) + 1.5 : style.strokeWidth || 2;
    const fill = style.fill || '#1e293b';

    switch (node.type) {
      case 'circle':
        return (
          <ellipse
            cx={w / 2}
            cy={h / 2}
            rx={w / 2}
            ry={h / 2}
            fill={fill}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={style.strokeDash === 'dashed' ? '6 4' : undefined}
          />
        );
      case 'diamond':
        return (
          <polygon
            points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`}
            fill={fill}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );
      case 'cylinder':
        return (
          <g>
            <path
              d={`M0,14 A${w / 2},14 0 0,0 ${w},14 L${w},${h - 14} A${w / 2},14 0 0,1 0,${h - 14} Z`}
              fill={fill}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            <ellipse
              cx={w / 2}
              cy={14}
              rx={w / 2}
              ry={14}
              fill={fill}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            <ellipse
              cx={w / 2}
              cy={h - 14}
              rx={w / 2}
              ry={14}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          </g>
        );
      case 'sticky':
        return (
          <g>
            <path
              d={`M0,0 L${w - 18},0 L${w},18 L${w},${h} L0,${h} Z`}
              fill={fill}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            <path
              d={`M${w - 18},0 L${w - 18},18 L${w},18 Z`}
              fill="#eab308"
              opacity="0.6"
            />
          </g>
        );
      case 'text': {
        const hasFill = style.fill && style.fill !== 'transparent';
        if (hasFill) {
          return (
            <rect
              width={w}
              height={h}
              rx={6}
              ry={6}
              fill={style.fill}
              stroke={isSelected ? '#3b82f6' : style.stroke || 'transparent'}
              strokeWidth={isSelected ? 1.5 : style.strokeWidth || 0}
            />
          );
        }
        return (
          <rect
            width={w}
            height={h}
            rx={4}
            fill="transparent"
            stroke={isSelected ? '#3b82f6' : 'transparent'}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        );
      }
      case 'aws-service':
      case 'rectangle':
      case 'rounded-rect':
      default:
        return (
          <rect
            width={w}
            height={h}
            rx={node.type === 'rounded-rect' ? 12 : 8}
            ry={node.type === 'rounded-rect' ? 12 : 8}
            fill={fill}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={style.strokeDash === 'dashed' ? '6 4' : undefined}
          />
        );
    }
  };

  // Render Frames
  const renderFrame = (frame: DiagramFrame) => {
    const isSelected = selectedFrameId === frame.id;
    const isHovered = hoveredFrameId === frame.id;
    const isEditing = editingElement?.id === frame.id && editingElement.type === 'frame';
    const strokeColor = isSelected ? '#3b82f6' : (frame.style.stroke || '#8b5cf6');
    const strokeWidth = isSelected ? 3 : isHovered ? 2.5 : 2;

    return (
      <g
        key={frame.id}
        transform={`translate(${frame.x}, ${frame.y})`}
        onMouseDown={(e) => handleFrameMouseDown(e, frame)}
        onMouseEnter={() => setHoveredFrameId(frame.id)}
        onMouseLeave={() => setHoveredFrameId(null)}
      >
        {/* Frame Boundary / Background */}
        <rect
          width={frame.width}
          height={frame.height}
          rx={12}
          ry={12}
          fill={frame.style.fill || '#0f172a15'}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={frame.style.strokeDash === 'dashed' ? '6 4' : undefined}
          className="cursor-move"
        />

        {/* Frame Title Badge (Draggable + Double Click to Rename) */}
        {isEditing ? (
          <foreignObject x={12} y={-14} width={Math.max(160, frame.title.length * 8 + 40)} height={28}>
            <input
              autoFocus
              type="text"
              value={editingElement.text}
              onChange={(e) => setEditingElement({ ...editingElement, text: e.target.value })}
              onBlur={() => {
                if (editingElement.text.trim()) {
                  onUpdateFrame?.(frame.id, { title: editingElement.text.trim() });
                }
                setEditingElement(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (editingElement.text.trim()) {
                    onUpdateFrame?.(frame.id, { title: editingElement.text.trim() });
                  }
                  setEditingElement(null);
                }
                if (e.key === 'Escape') setEditingElement(null);
              }}
              className="w-full h-full px-2 py-0.5 bg-slate-900 text-white text-xs font-bold rounded-md border border-blue-500 focus:outline-hidden shadow-md"
              onClick={(e) => e.stopPropagation()}
            />
          </foreignObject>
        ) : (
          <g
            className="cursor-pointer"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingElement({ id: frame.id, type: 'frame', text: frame.title });
            }}
          >
            <rect
              x={12}
              y={-12}
              width={Math.max(80, frame.title.length * 7 + 24)}
              height={24}
              rx={6}
              ry={6}
              fill="#1e293b"
              stroke={strokeColor}
              strokeWidth={1.5}
            />
            <text
              x={24}
              y={4}
              fontSize={11}
              fontWeight="bold"
              fill="#f8fafc"
              dominantBaseline="middle"
            >
              {frame.title}
            </text>
          </g>
        )}

        {/* Frame Resize Handle on bottom-right corner when selected */}
        {isSelected && (
          <circle
            cx={frame.width}
            cy={frame.height}
            r={6}
            fill="#3b82f6"
            stroke="#ffffff"
            strokeWidth={2}
            className="cursor-nwse-resize"
            onMouseDown={(e) => handleFrameResizeMouseDown(e, frame)}
          />
        )}
      </g>
    );
  };

  // Selected single node for resize handles
  const singleSelectedNode = selectedNodeIds.length === 1 ? diagram.nodes.find((n) => n.id === selectedNodeIds[0]) : null;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!rightMouseDownRef.current?.moved) {
      const pt = screenToCanvas(e.clientX, e.clientY);
      setContextMenu({
        isOpen: true,
        screenX: e.clientX,
        screenY: e.clientY,
        canvasX: Math.round(pt.x),
        canvasY: Math.round(pt.y),
      });
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100 dark:bg-slate-950 select-none">
      <svg
        ref={svgRef}
        className={`w-full h-full ${dragState?.type === 'pan' || toolMode === 'pan' || isSpacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      >
        <defs>
          {/* Grid Background Patterns */}
          <pattern id="grid-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#64748b" strokeWidth="0.5" strokeOpacity="0.18" />
          </pattern>
          <pattern id="dot-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="#64748b" fillOpacity="0.25" />
          </pattern>
          <pattern id="lines-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 0 40 L 40 40" fill="none" stroke="#64748b" strokeWidth="0.5" strokeOpacity="0.18" />
          </pattern>

          {/* Arrowhead Markers */}
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
          </marker>
          <marker
            id="arrow-green"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
          </marker>
        </defs>

        {/* Canvas World Transform */}
        <g transform={`translate(${diagram.viewport.x}, ${diagram.viewport.y}) scale(${diagram.viewport.zoom})`}>
          {/* Infinite Canvas Background Fill (moves and zooms 1:1 with canvas) */}
          {diagram.background !== 'blank' && (
            <rect
              x={-500000}
              y={-500000}
              width={1000000}
              height={1000000}
              fill={`url(#${diagram.background === 'dot' ? 'dot-pattern' : diagram.background === 'lines' ? 'lines-pattern' : 'grid-pattern'})`}
            />
          )}

          {/* Canvas empty state hint */}
          {diagram.nodes.length === 0 && (
            <g transform="translate(260, 180)" className="pointer-events-none select-none">
              <text
                x={0}
                y={0}
                textAnchor="middle"
                fontSize={13}
                fill="#94a3b8"
                opacity={0.65}
                fontWeight="500"
              >
                Click a shape above or press Tab to brainstorm with AI
              </text>
            </g>
          )}

          {/* 1. Frames Layer (rendered below nodes, largest frames first so child frames sit on top) */}
          {[...diagram.frames]
            .sort((a, b) => b.width * b.height - a.width * a.height)
            .map(renderFrame)}

          {/* 2. Edges / Connectors Layer */}
          {diagram.edges.map((edge) => {
            const sNode = diagram.nodes.find((n) => n.id === edge.sourceNodeId);
            const tNode = diagram.nodes.find((n) => n.id === edge.targetNodeId);
            if (!sNode || !tNode || sNode.hidden || tNode.hidden) return null;

            const sAnchor = getAnchorPoint(sNode, edge.sourceAnchor || 'right');
            const tAnchor = getAnchorPoint(tNode, edge.targetAnchor || 'left');

            let pathD = '';
            let midPt = { x: (sAnchor.x + tAnchor.x) / 2, y: (sAnchor.y + tAnchor.y) / 2 };

            if (edge.type === 'straight') {
              pathD = `M ${sAnchor.x} ${sAnchor.y} L ${tAnchor.x} ${tAnchor.y}`;
            } else if (edge.type === 'curved') {
              const dx = tAnchor.x - sAnchor.x;
              const ctrlX1 = sAnchor.x + dx * 0.5;
              const ctrlY1 = sAnchor.y;
              const ctrlX2 = tAnchor.x - dx * 0.5;
              const ctrlY2 = tAnchor.y;
              pathD = `M ${sAnchor.x} ${sAnchor.y} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${tAnchor.x} ${tAnchor.y}`;
            } else {
              // Orthogonal
              const pts = computeOrthogonalWaypoints(sAnchor, tAnchor);
              pathD = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
              if (pts.length >= 3) {
                midPt = pts[Math.floor(pts.length / 2)];
              }
            }

            const isSelected = selectedEdgeId === edge.id;
            const isHighlighted = highlightEdgeIds.includes(edge.id);
            const strokeColor = isHighlighted ? '#10b981' : isSelected ? '#3b82f6' : edge.strokeColor || '#38bdf8';
            const strokeWidth = isSelected || isHighlighted ? (edge.strokeWidth || 2) + 1.5 : edge.strokeWidth || 2;

            return (
              <g
                key={edge.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEdge(edge.id);
                }}
                className="cursor-pointer group"
              >
                {/* Thick invisible path for easy clicking */}
                <path d={pathD} fill="none" stroke="transparent" strokeWidth={16} />

                {/* Visible connector line */}
                <path
                  id={`path-${edge.id}`}
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={edge.lineStyle === 'dashed' ? '6 4' : undefined}
                  markerEnd={`url(#${isHighlighted ? 'arrow-green' : 'arrow'})`}
                  className="transition-colors"
                />

                {/* Flow Animation Particles */}
                {(isFlowPlaying || edge.animated) && (
                  <circle
                    r={4}
                    fill={isHighlighted ? '#10b981' : '#38bdf8'}
                    className="no-export"
                  >
                    <animateMotion
                      dur={flowSpeed === 'slow' ? '4s' : flowSpeed === 'fast' ? '1.2s' : '2.2s'}
                      repeatCount="indefinite"
                      path={pathD}
                    />
                  </circle>
                )}

                {/* Edge Centered Label */}
                {edge.label && (
                  <g
                    transform={`translate(${midPt.x}, ${midPt.y})`}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingElement({ id: edge.id, type: 'edge', text: edge.label || '' });
                    }}
                  >
                    {editingElement?.id === edge.id && editingElement.type === 'edge' ? (
                      <foreignObject x={-60} y={-14} width={120} height={28}>
                        <input
                          autoFocus
                          type="text"
                          defaultValue={edge.label}
                          onBlur={(e) => {
                            onUpdateEdge(edge.id, { label: e.target.value });
                            setEditingElement(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onUpdateEdge(edge.id, { label: (e.target as HTMLInputElement).value });
                              setEditingElement(null);
                            }
                          }}
                          className="w-full h-full px-2 bg-slate-900 text-white text-[10px] text-center border border-blue-500 rounded focus:outline-hidden"
                        />
                      </foreignObject>
                    ) : (
                      <>
                        <rect
                          x={-(edge.label.length * 3.5 + 10)}
                          y={-10}
                          width={edge.label.length * 7 + 20}
                          height={20}
                          rx={5}
                          ry={5}
                          fill="#0f172a"
                          stroke={strokeColor}
                          strokeWidth={1}
                        />
                        <text
                          fontSize={10}
                          fill="#e2e8f0"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontWeight="600"
                        >
                          {edge.label}
                        </text>
                      </>
                    )}
                  </g>
                )}
              </g>
            );
          })}

          {/* Rubber band line when creating new connector */}
          {dragState?.type === 'create-edge' && dragState.currentMouse && (
            <line
              x1={dragState.startX}
              y1={dragState.startY}
              x2={dragState.currentMouse.x}
              y2={dragState.currentMouse.y}
              stroke="#38bdf8"
              strokeWidth={2}
              strokeDasharray="4 4"
              markerEnd="url(#arrow)"
            />
          )}

          {/* 3. Nodes Layer */}
          {diagram.nodes.map((node) => {
            if (node.hidden) return null;
            const isSelected = selectedNodeIds.includes(node.id);
            const isHovered = hoveredNodeId === node.id;
            const isEditing = editingElement?.id === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingElement({ id: node.id, type: 'node', text: node.label });
                }}
                className="cursor-move"
              >
                {/* Node Shape Body */}
                {renderShape(node)}

                {/* AWS Category pill badge */}
                {node.type === 'aws-service' && node.data?.serviceCategory && (
                  <g transform="translate(8, 8)">
                    <rect
                      width={node.data.serviceCategory.length * 6 + 12}
                      height={16}
                      rx={4}
                      ry={4}
                      fill="#0284c725"
                      stroke="#0284c7"
                      strokeWidth={0.75}
                    />
                    <text
                      x={6}
                      y={9}
                      fontSize={9}
                      fill="#38bdf8"
                      fontWeight="bold"
                      dominantBaseline="middle"
                    >
                      {node.data.serviceCategory}
                    </text>
                  </g>
                )}

                {/* Node Label Text */}
                {!isEditing && (
                  <g
                    transform={`translate(${node.width / 2}, ${
                      node.type === 'aws-service' ? node.height / 2 + 6 : node.height / 2
                    })`}
                  >
                    {node.label.split('\n').map((line, idx, arr) => {
                      const fontSize = node.style.fontSize || (node.type === 'text' ? 16 : 12);
                      const lineHeight = fontSize * 1.35;
                      const isDark =
                        typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
                      const resolvedTextColor =
                        node.style.textColor ||
                        (node.style.fill &&
                        node.style.fill !== 'transparent' &&
                        node.style.fill !== '#f8fafc' &&
                        node.style.fill !== '#fef08a'
                          ? '#f8fafc'
                          : isDark
                          ? '#f8fafc'
                          : '#0f172a');

                      return (
                        <text
                          key={idx}
                          y={(idx - (arr.length - 1) / 2) * lineHeight}
                          fontSize={fontSize}
                          fontWeight={node.style.fontWeight || (node.type === 'text' ? 'normal' : 'bold')}
                          fill={resolvedTextColor}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {line}
                        </text>
                      );
                    })}
                  </g>
                )}

                {/* Inline HTML Textarea when editing */}
                {isEditing && (
                  <foreignObject x={0} y={0} width={Math.max(node.width, 120)} height={Math.max(node.height, 40)}>
                    <textarea
                      autoFocus
                      defaultValue={node.label}
                      onBlur={(e) => {
                        onUpdateNode(node.id, { label: e.target.value });
                        setEditingElement(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          onUpdateNode(node.id, { label: (e.target as HTMLTextAreaElement).value });
                          setEditingElement(null);
                        }
                      }}
                      className="w-full h-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-blue-500 rounded resize-none focus:outline-hidden text-center shadow-lg"
                      style={{ fontSize: `${node.style.fontSize || (node.type === 'text' ? 16 : 12)}px` }}
                    />
                  </foreignObject>
                )}

                {/* 4 Snap Anchor Points (Shown on hover or when dragging connector) */}
                {(isHovered || isSelected || dragState?.type === 'create-edge') && (
                  <g className="no-export">
                    {(['top', 'right', 'bottom', 'left'] as AnchorDirection[]).map((dir) => {
                      const pt = getAnchorPoint(
                        { ...node, x: 0, y: 0 }, // Relative to node group
                        dir
                      );
                      return (
                        <g
                          key={dir}
                          className="cursor-crosshair group/anchor"
                          onMouseDown={(e) => handleAnchorMouseDown(e, node.id, dir)}
                        >
                          {/* Generous hit area to avoid pixel-hunting and prevent flickering */}
                          <circle cx={pt.x} cy={pt.y} r={12} fill="transparent" />
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={5}
                            fill="#38bdf8"
                            stroke="#ffffff"
                            strokeWidth={1.5}
                            className="transition-transform group-hover/anchor:scale-135 drop-shadow-xs"
                          />
                        </g>
                      );
                    })}
                  </g>
                )}
              </g>
            );
          })}

          {/* 4-Corner Resize Handles for Single Selected Node (Edges reserved for anchors to eliminate flicker) */}
          {singleSelectedNode && !singleSelectedNode.locked && (
            <g
              transform={`translate(${singleSelectedNode.x}, ${singleSelectedNode.y})`}
              className="no-export"
            >
              {[
                { pos: 'nw', cx: 0, cy: 0, cursor: 'nwse-resize' },
                { pos: 'ne', cx: singleSelectedNode.width, cy: 0, cursor: 'nesw-resize' },
                { pos: 'se', cx: singleSelectedNode.width, cy: singleSelectedNode.height, cursor: 'nwse-resize' },
                { pos: 'sw', cx: 0, cy: singleSelectedNode.height, cursor: 'nesw-resize' },
              ].map(({ pos, cx, cy, cursor }) => (
                <rect
                  key={pos}
                  x={cx - 4}
                  y={cy - 4}
                  width={8}
                  height={8}
                  fill="#ffffff"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  style={{ cursor }}
                  onMouseDown={(e) => handleResizeHandleMouseDown(e, pos)}
                />
              ))}
            </g>
          )}

          {/* Marquee Selection Box */}
          {dragState?.type === 'marquee' && dragState.currentMouse && (
            <rect
              x={Math.min(dragState.startX, dragState.currentMouse.x)}
              y={Math.min(dragState.startY, dragState.currentMouse.y)}
              width={Math.abs(dragState.startX - dragState.currentMouse.x)}
              height={Math.abs(dragState.startY - dragState.currentMouse.y)}
              fill="#0284c715"
              stroke="#0284c7"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )}
        </g>
      </svg>

      {/* Right-Click Canvas Layout Context Menu */}
      {contextMenu?.isOpen && (
        <div
          className="context-menu-dropdown fixed z-50 min-w-[220px] py-1.5 px-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100 select-none"
          style={{
            left: Math.max(12, Math.min(contextMenu.screenX, window.innerWidth - 240)),
            top: Math.max(12, Math.min(contextMenu.screenY, window.innerHeight - 460)),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Thêm Section / Đối tượng
          </div>

          <button
            type="button"
            onClick={() => {
              const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
              const newNode: DiagramNode = {
                id: generateId('node'),
                type: 'text',
                label: 'Nhập văn bản...',
                x: contextMenu.canvasX - 60,
                y: contextMenu.canvasY - 18,
                width: 140,
                height: 36,
                style: {
                  fill: 'transparent',
                  stroke: 'transparent',
                  strokeWidth: 0,
                  textColor: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: 16,
                },
              };
              onAddNode(newNode);
              onSelectNode(newNode.id);
              onSelectFrame?.(null);
              setEditingElement({ id: newNode.id, type: 'node', text: 'Nhập văn bản...' });
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-left transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="text-sm font-bold text-blue-500">T</span>
              <span>Văn bản (Text)</span>
            </span>
            <span className="text-[10px] text-slate-400">Không nền</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const newNode: DiagramNode = {
                id: generateId('node'),
                type: 'rectangle',
                label: 'Khối mới',
                x: contextMenu.canvasX - 75,
                y: contextMenu.canvasY - 35,
                width: 150,
                height: 70,
                style: {
                  fill: '#1e293b',
                  stroke: '#38bdf8',
                  strokeWidth: 2,
                  textColor: '#f8fafc',
                  borderRadius: 8,
                },
              };
              onAddNode(newNode);
              onSelectNode(newNode.id);
              onSelectFrame?.(null);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-left transition-colors"
          >
            <span className="w-3.5 h-3.5 border-2 border-sky-400 rounded-xs" />
            <span>Ô chữ nhật (Rectangle)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const newNode: DiagramNode = {
                id: generateId('node'),
                type: 'rounded-rect',
                label: 'Ô bo góc',
                x: contextMenu.canvasX - 75,
                y: contextMenu.canvasY - 35,
                width: 150,
                height: 70,
                style: {
                  fill: '#1e293b',
                  stroke: '#38bdf8',
                  strokeWidth: 2,
                  textColor: '#f8fafc',
                  borderRadius: 14,
                },
              };
              onAddNode(newNode);
              onSelectNode(newNode.id);
              onSelectFrame?.(null);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-left transition-colors"
          >
            <span className="w-3.5 h-3.5 border-2 border-sky-400 rounded-md" />
            <span>Ô bo góc (Rounded)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const newNode: DiagramNode = {
                id: generateId('node'),
                type: 'circle',
                label: 'Hình tròn',
                x: contextMenu.canvasX - 45,
                y: contextMenu.canvasY - 45,
                width: 90,
                height: 90,
                style: {
                  fill: '#1e293b',
                  stroke: '#38bdf8',
                  strokeWidth: 2,
                  textColor: '#f8fafc',
                },
              };
              onAddNode(newNode);
              onSelectNode(newNode.id);
              onSelectFrame?.(null);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-left transition-colors"
          >
            <span className="w-3.5 h-3.5 border-2 border-sky-400 rounded-full" />
            <span>Hình tròn (Circle)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const newNode: DiagramNode = {
                id: generateId('node'),
                type: 'diamond',
                label: 'Điều kiện',
                x: contextMenu.canvasX - 55,
                y: contextMenu.canvasY - 40,
                width: 110,
                height: 80,
                style: {
                  fill: '#1e293b',
                  stroke: '#38bdf8',
                  strokeWidth: 2,
                  textColor: '#f8fafc',
                },
              };
              onAddNode(newNode);
              onSelectNode(newNode.id);
              onSelectFrame?.(null);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-left transition-colors"
          >
            <span className="w-3 h-3 border-2 border-sky-400 rotate-45" />
            <span>Hình thoi (Diamond)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const newNode: DiagramNode = {
                id: generateId('node'),
                type: 'sticky',
                label: 'Ghi chú...',
                x: contextMenu.canvasX - 60,
                y: contextMenu.canvasY - 45,
                width: 120,
                height: 90,
                style: {
                  fill: '#fef08a',
                  stroke: '#eab308',
                  strokeWidth: 2,
                  textColor: '#713f12',
                },
              };
              onAddNode(newNode);
              onSelectNode(newNode.id);
              onSelectFrame?.(null);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-left transition-colors"
          >
            <span className="w-3.5 h-3.5 bg-yellow-300 border border-yellow-500 rounded-xs" />
            <span>Ghi chú (Sticky Note)</span>
          </button>

          <div className="my-1 border-t border-slate-200 dark:border-slate-800" />

          {/* Frame / Section option */}
          <button
            type="button"
            onClick={() => {
              const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
              const newFrame: DiagramFrame = {
                id: generateId('frame'),
                title: 'Section / VPC Container',
                x: contextMenu.canvasX - 170,
                y: contextMenu.canvasY - 110,
                width: 340,
                height: 220,
                style: {
                  fill: isDark ? '#0f172a25' : '#f8fafc80',
                  stroke: '#8b5cf6',
                  strokeDash: 'dashed',
                },
              };
              if (onAddFrame) {
                onAddFrame(newFrame);
              }
              onSelectFrame?.(newFrame.id);
              onSelectNode(null);
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/30 text-purple-700 dark:text-purple-300 text-left font-medium transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-dashed border-purple-500 rounded-xs" />
              <span>Section / Khung VPC</span>
            </span>
            <span className="text-[10px] bg-purple-100 dark:bg-purple-900/50 px-1 rounded text-purple-600 dark:text-purple-300 font-bold">
              Frame
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              const newNode: DiagramNode = {
                id: generateId('node'),
                type: 'aws-service',
                label: 'Amazon EC2',
                x: contextMenu.canvasX - 75,
                y: contextMenu.canvasY - 35,
                width: 150,
                height: 70,
                style: {
                  fill: '#1e293b',
                  stroke: '#f97316',
                  strokeWidth: 2,
                  textColor: '#f8fafc',
                  borderRadius: 8,
                },
                data: {
                  serviceCategory: 'Compute',
                },
              };
              onAddNode(newNode);
              onSelectNode(newNode.id);
              onSelectFrame?.(null);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/30 text-orange-700 dark:text-orange-300 text-left transition-colors"
          >
            <span className="w-3.5 h-3.5 bg-orange-500 rounded-xs flex items-center justify-center text-[8px] font-bold text-white">
              AWS
            </span>
            <span>AWS Service Node</span>
          </button>

          <div className="my-1 border-t border-slate-200 dark:border-slate-800" />

          {/* Paste & Select All */}
          <button
            type="button"
            disabled={!hasClipboard}
            onClick={() => {
              handlePaste({ x: contextMenu.canvasX, y: contextMenu.canvasY });
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-left transition-colors"
          >
            <span>Dán (Paste)</span>
            <kbd className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">Ctrl+V</kbd>
          </button>

          <button
            type="button"
            onClick={() => {
              if (diagram.nodes.length > 0) {
                diagram.nodes.forEach((n, idx) => onSelectNode(n.id, idx > 0));
                onSelectFrame?.(null);
              }
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-left transition-colors"
          >
            <span>Chọn tất cả (Select All)</span>
            <kbd className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">Ctrl+A</kbd>
          </button>
        </div>
      )}
    </div>
  );
};
