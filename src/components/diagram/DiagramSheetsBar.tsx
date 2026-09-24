import React, { useState, useRef, useEffect } from 'react';
import type { Diagram } from '../../core/diagram/diagramTypes';
import { Edit3, Copy, Trash2, Plus } from 'lucide-react';

interface DiagramSheetsBarProps {
  sheets: Diagram[];
  activeSheetId: string;
  onSelectSheet: (sheetId: string) => void;
  onAddSheet: () => void;
  onRenameSheet: (sheetId: string, newTitle: string) => void;
  onDuplicateSheet: (sheetId: string) => void;
  onDeleteSheet: (sheetId: string) => void;
}

export const DiagramSheetsBar: React.FC<DiagramSheetsBarProps> = ({
  sheets,
  activeSheetId,
  onSelectSheet,
  onAddSheet,
  onRenameSheet,
  onDuplicateSheet,
  onDeleteSheet,
}) => {
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [menuSheetId, setMenuSheetId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Close context menu on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuSheetId(null);
        setContextMenuPos(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuSheetId(null);
        setContextMenuPos(null);
      }
    };
    if (menuSheetId) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuSheetId]);

  // Focus & select text when renaming begins
  useEffect(() => {
    if (editingSheetId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingSheetId]);

  const startRename = (sheet: Diagram) => {
    setEditingSheetId(sheet.id);
    setEditingTitle(sheet.name);
    setMenuSheetId(null);
    setContextMenuPos(null);
  };

  const submitRename = (sheetId: string) => {
    if (editingTitle.trim()) {
      onRenameSheet(sheetId, editingTitle.trim());
    }
    setEditingSheetId(null);
  };

  const handleContextMenu = (e: React.MouseEvent, sheetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuSheetId(sheetId);
    // Keep context menu within viewport
    const menuWidth = 160;
    const menuHeight = 110;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);
    setContextMenuPos({ x, y });
  };

  const activeSheet = sheets.find((s) => s.id === activeSheetId);
  const menuSheet = sheets.find((s) => s.id === menuSheetId);

  return (
    <div className="h-8 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 px-2 flex items-center justify-between text-xs select-none shrink-0 z-20">
      {/* Sheets Tab List */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 max-w-full sm:max-w-[75%] scroll-touch">
        {sheets.map((sheet) => {
          const isActive = sheet.id === activeSheetId;
          const isEditing = editingSheetId === sheet.id;

          return (
            <div
              key={sheet.id}
              className={`group relative flex items-center h-6 px-2.5 rounded-md border text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-slate-300 dark:border-slate-700 shadow-xs'
                  : 'bg-transparent hover:bg-slate-200/70 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-transparent'
              }`}
              onClick={() => onSelectSheet(sheet.id)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                startRename(sheet);
              }}
              onContextMenu={(e) => handleContextMenu(e, sheet.id)}
              title="Click để chọn sheet, click đúp hoặc click chuột phải để đổi tên/xóa"
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => submitRename(sheet.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitRename(sheet.id);
                    if (e.key === 'Escape') setEditingSheetId(null);
                  }}
                  className="w-28 px-1.5 py-0 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-blue-500 rounded text-xs focus:outline-hidden"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate max-w-[140px]">{sheet.name}</span>
              )}

              {/* Tab options trigger button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleContextMenu(e, sheet.id);
                }}
                className={`ml-1.5 p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-opacity ${
                  isActive ? 'opacity-70 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-70'
                }`}
                title="Tùy chọn sheet (Đổi tên, nhân bản, xóa)"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v.01M12 12v.01M12 19v.01"
                  />
                </svg>
              </button>
            </div>
          );
        })}

        {/* Add Sheet Button */}
        <button
          type="button"
          onClick={onAddSheet}
          className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors shrink-0"
          title="Thêm sheet mới (+)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right side stats */}
      <div className="hidden md:flex text-[11px] text-slate-400 dark:text-slate-500 items-center gap-2 pr-1 shrink-0">
        <span>
          {activeSheet?.nodes.length || 0} nodes • {activeSheet?.edges.length || 0} connectors • {activeSheet?.frames?.length || 0} frames
        </span>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <span>
          Sheet {sheets.findIndex((s) => s.id === activeSheetId) + 1} / {sheets.length}
        </span>
      </div>

      {/* Global Fixed Position Context Menu on Right Click */}
      {menuSheet && contextMenuPos && (
        <div
          ref={menuRef}
          style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
          className="fixed w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-1.5 z-9999 animate-in fade-in zoom-in-95 duration-100 text-slate-700 dark:text-slate-200 font-sans"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/80 mb-1 truncate">
            {menuSheet.name}
          </div>
          <button
            type="button"
            onClick={() => startRename(menuSheet)}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-blue-500" />
            <span>Đổi tên sheet</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onDuplicateSheet(menuSheet.id);
              setMenuSheetId(null);
              setContextMenuPos(null);
            }}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-purple-500" />
            <span>Nhân bản sheet</span>
          </button>
          {sheets.length > 1 && (
            <button
              type="button"
              onClick={() => {
                onDeleteSheet(menuSheet.id);
                setMenuSheetId(null);
                setContextMenuPos(null);
              }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center gap-2 cursor-pointer border-t border-slate-100 dark:border-slate-800/80 mt-1"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <span>Xóa sheet này</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
