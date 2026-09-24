import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface DiagramShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  key: string;
  desc: string;
}

const SHORTCUT_GROUPS: { title: string; shortcuts: ShortcutItem[] }[] = [
  {
    title: 'Canvas & Navigation',
    shortcuts: [
      { key: 'Space + Drag', desc: 'Pan canvas' },
      { key: 'Mouse Wheel', desc: 'Pan vertically' },
      { key: 'Ctrl + Wheel', desc: 'Zoom in / out' },
      { key: 'F', desc: 'Fit to screen' },
      { key: '0', desc: 'Reset zoom (100%)' },
      { key: '+ / -', desc: 'Zoom in / out step' },
    ],
  },
  {
    title: 'Selection & Editing',
    shortcuts: [
      { key: 'Click', desc: 'Select object' },
      { key: 'Shift + Click', desc: 'Multi-select objects' },
      { key: 'Drag empty', desc: 'Marquee select' },
      { key: 'Ctrl + A', desc: 'Select all nodes' },
      { key: 'Ctrl + C / V', desc: 'Copy & Paste' },
      { key: 'Ctrl + D', desc: 'Duplicate selected' },
      { key: 'Delete / Backspace', desc: 'Delete selected' },
      { key: 'Double Click', desc: 'Edit node / edge text' },
    ],
  },
  {
    title: 'History & Arrangement',
    shortcuts: [
      { key: 'Ctrl + Z', desc: 'Undo' },
      { key: 'Ctrl + Y / Ctrl+Shift+Z', desc: 'Redo' },
      { key: 'Arrow Keys', desc: 'Nudge 1px' },
      { key: 'Shift + Arrows', desc: 'Nudge 10px' },
      { key: 'L', desc: 'Auto Layout diagram' },
      { key: 'Esc', desc: 'Deselect / Cancel edit' },
    ],
  },
];

export const DiagramShortcutsModal: React.FC<DiagramShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-800 dark:text-slate-100 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Bảng Phím Tắt Diagram Workspace</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tăng tốc độ phác thảo và thao tác kiến trúc
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto py-4 space-y-6 pr-1 custom-scrollbar">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {group.title}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.shortcuts.map((sc) => (
                  <div
                    key={sc.key}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/60 dark:bg-slate-800/60 dark:border-slate-800/80 text-xs"
                  >
                    <span className="text-slate-600 dark:text-slate-300">{sc.desc}</span>
                    <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 shadow-2xs font-mono font-semibold text-slate-800 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-200">
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
