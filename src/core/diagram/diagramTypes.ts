/**
 * AI Diagram & Visual Brainstorming Workspace — Type Definitions
 */

export type ShapeType =
  | 'rectangle'
  | 'rounded-rect'
  | 'circle'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'cylinder'
  | 'sticky'
  | 'aws-service'
  | 'frame'
  | 'text'
  | 'freehand';

export type ConnectorType = 'straight' | 'orthogonal' | 'curved';

export type LineStyle = 'solid' | 'dashed' | 'dotted';

export type ArrowHead = 'none' | 'arrow' | 'triangle' | 'circle';

export type CanvasBackground = 'blank' | 'grid' | 'dot' | 'lines';

export type AnchorDirection = 'top' | 'right' | 'bottom' | 'left';

export interface AnchorPoint {
  id: string;
  x: number;
  y: number;
  direction: AnchorDirection;
}

export interface NodeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDash?: LineStyle;
  opacity?: number;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  borderRadius?: number;
}

export interface NodeData {
  serviceId?: string;
  serviceCategory?: string;
  icon?: string;
  description?: string;
  stepNumber?: number;
  freehandPoints?: Array<{ x: number; y: number }>;
}

export interface DiagramNode {
  id: string;
  type: ShapeType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  style: NodeStyle;
  data?: NodeData;
  groupId?: string;
  frameId?: string;
  locked?: boolean;
  hidden?: boolean;
  zIndex?: number;
}

export interface DiagramEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceAnchor?: AnchorDirection;
  targetAnchor?: AnchorDirection;
  type: ConnectorType;
  lineStyle: LineStyle;
  strokeColor: string;
  strokeWidth: number;
  startArrow?: ArrowHead;
  endArrow?: ArrowHead;
  label?: string;
  labelPosition?: number; // 0 to 1 along line
  animated?: boolean;
  points?: Array<{ x: number; y: number }>;
}

export interface DiagramFrame {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style: {
    fill: string;
    stroke: string;
    strokeDash?: LineStyle;
  };
  collapsed?: boolean;
}

export interface PresentationStep {
  id: string;
  stepNumber: number;
  title: string;
  explanation: string;
  highlightNodeIds: string[];
  highlightEdgeIds: string[];
}

export interface DiagramViewport {
  x: number;
  y: number;
  zoom: number; // 0.1 to 4.0 (10% to 400%)
}

export interface Diagram {
  id: string;
  name: string;
  description?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  frames: DiagramFrame[];
  viewport: DiagramViewport;
  background: CanvasBackground;
  showGrid: boolean;
  snapToGrid: boolean;
  presentationSteps?: PresentationStep[];
  createdAt: number;
  updatedAt: number;
}

export interface DiagramWorkbook {
  id: string;
  name: string;
  activeSheetId: string;
  sheets: Diagram[];
  createdAt: number;
  updatedAt: number;
}

export interface DiagramPatch {
  id: string;
  title: string;
  reason: string;
  addNodes?: DiagramNode[];
  removeNodeIds?: string[];
  updateNodes?: Array<{ id: string; changes: Partial<DiagramNode> }>;
  addEdges?: DiagramEdge[];
  removeEdgeIds?: string[];
  updateEdges?: Array<{ id: string; changes: Partial<DiagramEdge> }>;
}

export interface DiagramTemplate {
  id: string;
  title: string;
  category: 'AWS Architecture' | 'System Design' | 'DevOps' | 'Database';
  description: string;
  diagram: Omit<Diagram, 'id' | 'createdAt' | 'updatedAt'>;
}

export interface FlowAnimationConfig {
  isPlaying: boolean;
  speed: 'slow' | 'normal' | 'fast';
  scope: 'all' | 'selected';
}
