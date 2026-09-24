import React, { useState } from 'react';
import {
  MousePointer2,
  Hand,
  Square,
  Circle,
  Diamond,
  Database,
  StickyNote,
  Type,
  Maximize2,
  Undo2,
  Redo2,
  Play,
  SquareDashed,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Grid,
  Download,
  Upload,
  Code2,
  Trash2,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
  PanelLeft,
} from 'lucide-react';
import type { ConnectorType, CanvasBackground } from '../../core/diagram/diagramTypes';
import type { AutoLayoutMode } from '../../core/diagram/diagramAutoLayout';

export type ToolMode =
  | 'select'
  | 'pan'
  | 'shape-rectangle'
  | 'shape-rounded-rect'
  | 'shape-circle'
  | 'shape-diamond'
  | 'shape-cylinder'
  | 'shape-sticky'
  | 'shape-text'
  | 'shape-frame'
  | 'connector';

interface DiagramToolbarProps {
  toolMode: ToolMode;
  onSelectTool: (mode: ToolMode) => void;
  connectorType: ConnectorType;
  onChangeConnectorType: (type: ConnectorType) => void;
  background: CanvasBackground;
  onChangeBackground: (bg: CanvasBackground) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitView: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isFlowPlaying: boolean;
  onToggleFlowPlay: () => void;
  flowSpeed: 'slow' | 'normal' | 'fast';
  onChangeFlowSpeed: (speed: 'slow' | 'normal' | 'fast') => void;
  onAutoLayout: (mode: AutoLayoutMode) => void;
  onOpenShortcuts: () => void;
  onToggleAIPanel: () => void;
  isAIPanelOpen: boolean;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportJSON: () => void;
  onImportJSON: () => void;
  onImportMermaid: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  onClearCanvas: () => void;
}

export const DiagramToolbar: React.FC<DiagramToolbarProps> = ({
  toolMode,
  onSelectTool,
  connectorType,
  onChangeConnectorType,
  background,
  onChangeBackground,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitView,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isFlowPlaying,
  onToggleFlowPlay,
  flowSpeed,
  onChangeFlowSpeed,
  onAutoLayout,
  onOpenShortcuts,
  onToggleAIPanel,
  isAIPanelOpen,
  onToggleSidebar,
  isSidebarCollapsed,
  onExportPNG,
  onExportSVG,
  onExportJSON,
  onImportJSON,
  onImportMermaid,
  onClearCanvas,
}) => {
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showBgMenu, setShowBgMenu] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white/95 backdrop-blur-md border-b border-slate-200 dark:bg-slate-900/95 dark:border-slate-800 text-slate-700 dark:text-slate-200 select-none z-20">
      {/* Group 1: Tools (Sidebar Toggle, Select, Pan, Shapes, Connector) */}
      <div className="flex items-center gap-1">
        {/* Toggle Left Sidebar */}
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? 'Mở panel công cụ bên trái (Hiện panel)' : 'Thu gọn panel công cụ bên trái (Ẩn panel)'}
            className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
              !isSidebarCollapsed
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400'
                : 'hover:bg-slate-100 text-slate-500 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        {/* Select */}
        <button
          onClick={() => onSelectTool('select')}
          title="Chọn (V)"
          className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
            toolMode === 'select'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <MousePointer2 className="w-4 h-4" />
        </button>

        {/* Pan Hand */}
        <button
          onClick={() => onSelectTool('pan')}
          title="Di chuyển canvas (Ấn giữ chuột phải để kéo, hoặc phím H / Space)"
          className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
            toolMode === 'pan'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Hand className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

        {/* Shapes Dropdown / Quick buttons */}
        <div className="relative">
          <button
            onClick={() => setShowShapeMenu(!showShapeMenu)}
            title="Thêm hình khối"
            className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
              toolMode.startsWith('shape-')
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <Square className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Hình khối</span>
          </button>

          {showShapeMenu && (
            <div
              className="absolute left-0 top-full mt-1 w-48 rounded-xl bg-white border border-slate-200 shadow-xl p-1.5 dark:bg-slate-900 dark:border-slate-800 z-30 animate-in fade-in zoom-in-95 duration-100"
              onMouseLeave={() => setShowShapeMenu(false)}
            >
              <button
                onClick={() => {
                  onSelectTool('shape-rectangle');
                  setShowShapeMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Square className="w-3.5 h-3.5 text-blue-500" />
                <span>Hình chữ nhật</span>
              </button>
              <button
                onClick={() => {
                  onSelectTool('shape-rounded-rect');
                  setShowShapeMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <SquareDashed className="w-3.5 h-3.5 text-emerald-500" />
                <span>Bo góc (Rounded)</span>
              </button>
              <button
                onClick={() => {
                  onSelectTool('shape-circle');
                  setShowShapeMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Circle className="w-3.5 h-3.5 text-amber-500" />
                <span>Hình tròn</span>
              </button>
              <button
                onClick={() => {
                  onSelectTool('shape-diamond');
                  setShowShapeMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Diamond className="w-3.5 h-3.5 text-purple-500" />
                <span>Hình thoi (Quyết định)</span>
              </button>
              <button
                onClick={() => {
                  onSelectTool('shape-cylinder');
                  setShowShapeMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Database className="w-3.5 h-3.5 text-sky-500" />
                <span>Cơ sở dữ liệu (Cylinder)</span>
              </button>
              <button
                onClick={() => {
                  onSelectTool('shape-sticky');
                  setShowShapeMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <StickyNote className="w-3.5 h-3.5 text-yellow-500" />
                <span>Ghi chú (Sticky Note)</span>
              </button>
              <button
                onClick={() => {
                  onSelectTool('shape-text');
                  setShowShapeMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Type className="w-3.5 h-3.5 text-slate-500" />
                <span>Văn bản (Text)</span>
              </button>
              <button
                onClick={() => {
                  onSelectTool('shape-frame');
                  setShowShapeMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <SquareDashed className="w-3.5 h-3.5 text-indigo-500" />
                <span>Khung VPC / Subnet</span>
              </button>
            </div>
          )}
        </div>

        {/* Connector Mode */}
        <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
          <button
            onClick={() => {
              onSelectTool('connector');
              onChangeConnectorType('orthogonal');
            }}
            title="Đường nối vuông góc (Orthogonal)"
            className={`px-2 py-1 rounded-md text-xs transition-all ${
              toolMode === 'connector' && connectorType === 'orthogonal'
                ? 'bg-white text-blue-600 shadow-2xs dark:bg-slate-700 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Vuông góc
          </button>
          <button
            onClick={() => {
              onSelectTool('connector');
              onChangeConnectorType('straight');
            }}
            title="Đường nối thẳng (Straight)"
            className={`px-2 py-1 rounded-md text-xs transition-all ${
              toolMode === 'connector' && connectorType === 'straight'
                ? 'bg-white text-blue-600 shadow-2xs dark:bg-slate-700 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Thẳng
          </button>
          <button
            onClick={() => {
              onSelectTool('connector');
              onChangeConnectorType('curved');
            }}
            title="Đường nối cong (Curved)"
            className={`px-2 py-1 rounded-md text-xs transition-all ${
              toolMode === 'connector' && connectorType === 'curved'
                ? 'bg-white text-blue-600 shadow-2xs dark:bg-slate-700 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Cong
          </button>
        </div>
      </div>

      {/* Group 2: Actions (Undo, Redo, Layout, Flow Animation) */}
      <div className="flex items-center gap-1">
        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Hoàn tác (Ctrl+Z)"
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Làm lại (Ctrl+Y)"
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

        {/* Auto Layout Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowLayoutMenu(!showLayoutMenu)}
            title="Tự động sắp xếp sơ đồ (Auto Layout)"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden md:inline">Auto Layout</span>
          </button>

          {showLayoutMenu && (
            <div
              className="absolute left-0 top-full mt-1 w-44 rounded-xl bg-white border border-slate-200 shadow-xl p-1.5 dark:bg-slate-900 dark:border-slate-800 z-30 animate-in fade-in zoom-in-95 duration-100"
              onMouseLeave={() => setShowLayoutMenu(false)}
            >
              <button
                onClick={() => {
                  onAutoLayout('hierarchical-horizontal');
                  setShowLayoutMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Ngang (Trái qua phải)
              </button>
              <button
                onClick={() => {
                  onAutoLayout('hierarchical-vertical');
                  setShowLayoutMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Dọc (Trên xuống dưới)
              </button>
              <button
                onClick={() => {
                  onAutoLayout('grid');
                  setShowLayoutMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Lưới (Grid Matrix)
              </button>
              <button
                onClick={() => {
                  onAutoLayout('circular');
                  setShowLayoutMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Vòng tròn (Circular)
              </button>
            </div>
          )}
        </div>

        {/* Flow Animation Control */}
        <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
          <button
            onClick={onToggleFlowPlay}
            title={isFlowPlaying ? 'Tạm dừng luồng' : 'Chạy luồng dữ liệu (Particle Flow)'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              isFlowPlaying
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {isFlowPlaying ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFlowPlaying ? 'Đang chạy' : 'Flow'}</span>
          </button>
          {isFlowPlaying && (
            <button
              onClick={() => {
                const next = flowSpeed === 'slow' ? 'normal' : flowSpeed === 'normal' ? 'fast' : 'slow';
                onChangeFlowSpeed(next);
              }}
              title="Tốc độ luồng"
              className="px-1.5 py-1 text-[11px] font-mono text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            >
              {flowSpeed === 'slow' ? '0.5x' : flowSpeed === 'normal' ? '1x' : '2x'}
            </button>
          )}
        </div>
      </div>

      {/* Group 3: Canvas View & Export */}
      <div className="flex items-center gap-1">
        {/* Background Grid selector */}
        <div className="relative">
          <button
            onClick={() => setShowBgMenu(!showBgMenu)}
            title="Chế độ lưới nền"
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <Grid className="w-4 h-4" />
          </button>
          {showBgMenu && (
            <div
              className="absolute right-0 top-full mt-1 w-32 rounded-xl bg-white border border-slate-200 shadow-xl p-1 dark:bg-slate-900 dark:border-slate-800 z-30"
              onMouseLeave={() => setShowBgMenu(false)}
            >
              {(['grid', 'dot', 'lines', 'blank'] as CanvasBackground[]).map((bg) => (
                <button
                  key={bg}
                  onClick={() => {
                    onChangeBackground(bg);
                    setShowBgMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs capitalize ${
                    background === bg
                      ? 'bg-blue-50 text-blue-600 font-semibold dark:bg-blue-950 dark:text-blue-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
          <button
            onClick={onZoomOut}
            title="Thu nhỏ"
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onResetZoom}
            title="Reset Zoom"
            className="px-1.5 text-xs font-mono font-medium text-slate-700 dark:text-slate-200"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={onZoomIn}
            title="Phóng to"
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onFitView}
            title="Vừa màn hình (F)"
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 ml-0.5"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Export / Import Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            title="Xuất / Nhập sơ đồ"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden lg:inline">Xuất/Nhập</span>
          </button>

          {showExportMenu && (
            <div
              className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white border border-slate-200 shadow-xl p-1.5 dark:bg-slate-900 dark:border-slate-800 z-30 animate-in fade-in zoom-in-95 duration-100"
              onMouseLeave={() => setShowExportMenu(false)}
            >
              <button
                onClick={() => {
                  onExportPNG();
                  setShowExportMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5 text-blue-500" />
                <span>Xuất ảnh PNG</span>
              </button>
              <button
                onClick={() => {
                  onExportSVG();
                  setShowExportMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500" />
                <span>Xuất file SVG</span>
              </button>
              <button
                onClick={() => {
                  onExportJSON();
                  setShowExportMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5 text-purple-500" />
                <span>Lưu file JSON</span>
              </button>
              <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />
              <button
                onClick={() => {
                  onImportJSON();
                  setShowExportMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Upload className="w-3.5 h-3.5 text-amber-500" />
                <span>Nhập từ JSON</span>
              </button>
              <button
                onClick={() => {
                  onImportMermaid();
                  setShowExportMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Code2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Nhập mã Mermaid</span>
              </button>
            </div>
          )}
        </div>

        {/* Clear */}
        <button
          onClick={onClearCanvas}
          title="Xóa toàn bộ canvas"
          className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Shortcuts */}
        <button
          onClick={onOpenShortcuts}
          title="Phím tắt (?)"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Toggle AI Split Panel */}
        <button
          onClick={onToggleAIPanel}
          title="Bật/Tắt AI Brainstorming Split View"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            isAIPanelOpen
              ? 'bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
          <span>AI Tutor</span>
        </button>
      </div>
    </div>
  );
};
