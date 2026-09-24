import React, { useState } from 'react';
import type { DiagramNode, DiagramEdge, DiagramFrame } from '../../core/diagram/diagramTypes';

interface DiagramContextualBarProps {
  selectedNode: DiagramNode | null;
  selectedEdge: DiagramEdge | null;
  selectedFrame?: DiagramFrame | null;
  onUpdateNode: (nodeId: string, changes: Partial<DiagramNode>) => void;
  onUpdateEdge: (edgeId: string, changes: Partial<DiagramEdge>) => void;
  onUpdateFrame?: (frameId: string, changes: Partial<DiagramFrame>) => void;
  onDeleteSelected: () => void;
}

const FILL_PALETTE = [
  { label: 'Không nền (Transparent)', value: 'transparent' },
  { label: 'Dark Slate', value: '#1e293b' },
  { label: 'Deep Blue', value: '#0f172a' },
  { label: 'Azure', value: '#0284c7' },
  { label: 'Emerald', value: '#065f46' },
  { label: 'Amber', value: '#78350f' },
  { label: 'Purple', value: '#581c87' },
  { label: 'Rose', value: '#881337' },
  { label: 'Light', value: '#f8fafc' },
];

const TEXT_COLOR_PALETTE = [
  { label: 'Đen (Black)', value: '#0f172a' },
  { label: 'Trắng (White)', value: '#f8fafc' },
  { label: 'Sky Blue', value: '#38bdf8' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Slate', value: '#64748b' },
];

const STROKE_PALETTE = [
  { label: 'Sky', value: '#38bdf8' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Slate', value: '#64748b' },
  { label: 'White', value: '#ffffff' },
];

export const DiagramContextualBar: React.FC<DiagramContextualBarProps> = ({
  selectedNode,
  selectedEdge,
  selectedFrame,
  onUpdateNode,
  onUpdateEdge,
  onUpdateFrame,
  onDeleteSelected,
}) => {
  const [showFillMenu, setShowFillMenu] = useState(false);
  const [showStrokeMenu, setShowStrokeMenu] = useState(false);
  const [showTextColorMenu, setShowTextColorMenu] = useState(false);

  if (!selectedNode && !selectedEdge && !selectedFrame) return null;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg text-xs text-slate-700 dark:text-slate-200 pointer-events-auto transition-all animate-in fade-in duration-150">
      {/* --- Node Properties --- */}
      {selectedNode && (
        <>
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider pr-1">
            {selectedNode.type}
          </span>

          {/* Fill Color */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowFillMenu(!showFillMenu);
                setShowStrokeMenu(false);
                setShowTextColorMenu(false);
              }}
              className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 transition-colors"
              title="Fill Color"
            >
              <span
                className="w-3.5 h-3.5 rounded-sm border border-slate-300 dark:border-slate-600 shadow-xs relative flex items-center justify-center overflow-hidden"
                style={{
                  backgroundColor:
                    selectedNode.style.fill && selectedNode.style.fill !== 'transparent'
                      ? selectedNode.style.fill
                      : 'transparent',
                }}
              >
                {(!selectedNode.style.fill || selectedNode.style.fill === 'transparent') && (
                  <span className="w-full h-0.5 bg-red-400 rotate-45" />
                )}
              </span>
              <span className="text-[11px]">Fill</span>
            </button>
            {showFillMenu && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl grid grid-cols-4 gap-1.5 z-40 w-40">
                {FILL_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => {
                      const newTextColor =
                        c.value === 'transparent'
                          ? selectedNode.style.textColor || '#0f172a'
                          : c.value === '#f8fafc'
                          ? '#0f172a'
                          : '#f8fafc';
                      onUpdateNode(selectedNode.id, {
                        style: {
                          ...selectedNode.style,
                          fill: c.value,
                          textColor: newTextColor,
                        },
                      });
                      setShowFillMenu(false);
                    }}
                    className="w-6 h-6 rounded-sm border border-slate-300 dark:border-slate-600 hover:scale-110 transition-transform relative flex items-center justify-center"
                    style={{ backgroundColor: c.value === 'transparent' ? 'transparent' : c.value }}
                  >
                    {c.value === 'transparent' && (
                      <span className="w-full h-0.5 bg-red-400 rotate-45" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stroke Color */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowStrokeMenu(!showStrokeMenu);
                setShowFillMenu(false);
              }}
              className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 transition-colors"
              title="Stroke Color"
            >
              <span
                className="w-3.5 h-3.5 rounded-sm border-2"
                style={{ borderColor: selectedNode.style.stroke || '#38bdf8' }}
              />
              <span className="text-[11px]">Border</span>
            </button>
            {showStrokeMenu && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl grid grid-cols-4 gap-1.5 z-40 w-36">
                {STROKE_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => {
                      onUpdateNode(selectedNode.id, {
                        style: { ...selectedNode.style, stroke: c.value },
                      });
                      setShowStrokeMenu(false);
                    }}
                    className="w-6 h-6 rounded-sm border-2 hover:scale-110 transition-transform"
                    style={{ borderColor: c.value, backgroundColor: `${c.value}22` }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Stroke Width */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-md p-0.5 border border-slate-200 dark:border-slate-700">
            {[1, 2, 4].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() =>
                  onUpdateNode(selectedNode.id, {
                    style: { ...selectedNode.style, strokeWidth: w },
                  })
                }
                className={`px-1.5 py-0.5 text-[11px] rounded transition-colors ${
                  (selectedNode.style.strokeWidth || 2) === w
                    ? 'bg-white dark:bg-slate-700 font-bold text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {w}px
              </button>
            ))}
          </div>

          {/* Stroke Dash */}
          <button
            type="button"
            onClick={() =>
              onUpdateNode(selectedNode.id, {
                style: {
                  ...selectedNode.style,
                  strokeDash: selectedNode.style.strokeDash === 'dashed' ? 'solid' : 'dashed',
                },
              })
            }
            className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
              selectedNode.style.strokeDash === 'dashed'
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 text-blue-600 dark:text-blue-300 font-medium'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Toggle Dashed Border"
          >
            {selectedNode.style.strokeDash === 'dashed' ? 'Dashed' : 'Solid'}
          </button>

          {/* Font Size */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-md p-0.5 border border-slate-200 dark:border-slate-700">
            {[11, 13, 16, 20].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() =>
                  onUpdateNode(selectedNode.id, {
                    style: { ...selectedNode.style, fontSize: size },
                  })
                }
                className={`px-1.5 py-0.5 text-[11px] rounded transition-colors ${
                  (selectedNode.style.fontSize || 12) === size
                    ? 'bg-white dark:bg-slate-700 font-bold text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          {/* Text Color */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowTextColorMenu(!showTextColorMenu);
                setShowFillMenu(false);
                setShowStrokeMenu(false);
              }}
              className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 transition-colors"
              title="Màu chữ (Text Color)"
            >
              <span
                className="w-3.5 h-3.5 rounded-sm border border-slate-300 dark:border-slate-600 flex items-center justify-center font-bold text-[10px]"
                style={{
                  color: selectedNode.style.textColor || '#38bdf8',
                  backgroundColor:
                    selectedNode.style.textColor === '#f8fafc' || selectedNode.style.textColor === '#ffffff'
                      ? '#0f172a'
                      : 'transparent',
                }}
              >
                A
              </span>
              <span className="text-[11px]">Chữ</span>
            </button>
            {showTextColorMenu && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl grid grid-cols-4 gap-1.5 z-40 w-36">
                {TEXT_COLOR_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => {
                      onUpdateNode(selectedNode.id, {
                        style: { ...selectedNode.style, textColor: c.value },
                      });
                      setShowTextColorMenu(false);
                    }}
                    className="w-6 h-6 rounded-sm border border-slate-300 dark:border-slate-600 hover:scale-110 transition-transform flex items-center justify-center font-bold text-[10px]"
                    style={{
                      backgroundColor: c.value,
                      color: c.value === '#f8fafc' || c.value === '#ffffff' ? '#0f172a' : '#ffffff',
                    }}
                  >
                    A
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* --- Edge Properties --- */}
      {selectedEdge && (
        <>
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider pr-1">
            Line
          </span>

          {/* Line Type */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-md p-0.5 border border-slate-200 dark:border-slate-700">
            {(['orthogonal', 'curved', 'straight'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onUpdateEdge(selectedEdge.id, { type: t })}
                className={`px-2 py-0.5 text-[11px] capitalize rounded transition-colors ${
                  selectedEdge.type === t
                    ? 'bg-white dark:bg-slate-700 font-bold text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Line Style (Solid / Dashed) */}
          <button
            type="button"
            onClick={() =>
              onUpdateEdge(selectedEdge.id, {
                lineStyle: selectedEdge.lineStyle === 'dashed' ? 'solid' : 'dashed',
              })
            }
            className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
              selectedEdge.lineStyle === 'dashed'
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 text-blue-600 dark:text-blue-300 font-medium'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {selectedEdge.lineStyle === 'dashed' ? 'Dashed' : 'Solid'}
          </button>

          {/* Flow Animation Toggle */}
          <button
            type="button"
            onClick={() => onUpdateEdge(selectedEdge.id, { animated: !selectedEdge.animated })}
            className={`px-2 py-1 text-[11px] rounded-md border transition-colors flex items-center gap-1 ${
              selectedEdge.animated
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-600 dark:text-emerald-300 font-medium'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'
            }`}
            title="Toggle Flow Animation Particle"
          >
            <span
              className={`w-2 h-2 rounded-full ${selectedEdge.animated ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}
            />
            <span>Flow</span>
          </button>
        </>
      )}

      {/* --- Frame / Container Properties --- */}
      {selectedFrame && onUpdateFrame && (
        <>
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider pr-1">
            Frame
          </span>

          {/* Frame Title Input */}
          <input
            type="text"
            value={selectedFrame.title}
            onChange={(e) => onUpdateFrame(selectedFrame.id, { title: e.target.value })}
            className="w-28 sm:w-36 px-2 py-1 text-[11px] rounded-md bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
            placeholder="Frame Title..."
          />

          {/* Frame Border/Stroke Color */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowStrokeMenu(!showStrokeMenu);
                setShowFillMenu(false);
              }}
              className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 transition-colors"
              title="Border Color"
            >
              <span
                className="w-3.5 h-3.5 rounded-sm border shadow-xs"
                style={{
                  backgroundColor: selectedFrame.style?.stroke || '#3b82f6',
                  borderColor: selectedFrame.style?.stroke || '#3b82f6',
                }}
              />
              <span className="text-[11px]">Border</span>
            </button>
            {showStrokeMenu && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl grid grid-cols-4 gap-1.5 z-40 w-36">
                {STROKE_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => {
                      onUpdateFrame(selectedFrame.id, {
                        style: {
                          ...selectedFrame.style,
                          stroke: c.value,
                        },
                      });
                      setShowStrokeMenu(false);
                    }}
                    className="w-6 h-6 rounded-sm border border-slate-300 dark:border-slate-600 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Frame Stroke Dash Style (Solid / Dashed) */}
          <button
            type="button"
            onClick={() =>
              onUpdateFrame(selectedFrame.id, {
                style: {
                  ...selectedFrame.style,
                  strokeDash: selectedFrame.style?.strokeDash === 'dashed' ? 'solid' : 'dashed',
                },
              })
            }
            className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
              selectedFrame.style?.strokeDash === 'dashed'
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 text-blue-600 dark:text-blue-300 font-medium'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Đổi nét viền (Solid / Dashed)"
          >
            {selectedFrame.style?.strokeDash === 'dashed' ? 'Dashed' : 'Solid'}
          </button>
        </>
      )}

      {/* Divider */}
      <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-0.5" />

      {/* Delete Button */}
      <button
        type="button"
        onClick={onDeleteSelected}
        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition-colors"
        title="Delete (Del / Backspace)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  );
};
