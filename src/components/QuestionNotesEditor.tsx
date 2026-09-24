import React, { useState, useRef, useEffect, useCallback } from 'react';
import { storage } from '../core/storage';
import { learnerApi, getStoredToken } from '../core/api';
import { useLanguage } from '../context/useLanguage';
import {
  renderInlineFormattedText,
  markdownToNoteHtml,
  noteHtmlToMarkdown,
} from '../core/noteFormatter';
import { 
  StickyNote, 
  Check, 
  Trash2, 
  Save,
  Maximize2, 
  Minimize2, 
  Bold, 
  Italic, 
  Highlighter, 
  List, 
  Heading3, 
  Code, 
  X
} from 'lucide-react';

interface QuestionNotesEditorProps {
  questionId: number;
}

/**
 * Formatted Note Preview Component
 * Renders paragraphs, headings, bullet lists, and horizontal dividers with clean line breaking.
 */
export const FormattedNotePreview: React.FC<{ content: string; className?: string; emptyPlaceholder?: string }> = ({
  content,
  className = '',
  emptyPlaceholder,
}) => {
  if (!content.trim()) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
        {emptyPlaceholder || 'No note content to preview yet.'}
      </div>
    );
  }

  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let currentListItems: string[] = [];

  const flushList = (keyPrefix: string) => {
    if (currentListItems.length > 0) {
      blocks.push(
        <ul key={`${keyPrefix}-list`} className="my-2.5 space-y-1.5 pl-5 text-sm text-slate-800 dark:text-slate-200 list-disc">
          {currentListItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineFormattedText(item)}
            </li>
          ))}
        </ul>
      );
      currentListItems = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      currentListItems.push(trimmed.slice(2));
    } else {
      flushList(`line-${idx}`);

      if (trimmed.startsWith('### ')) {
        blocks.push(
          <h4
            key={`h3-${idx}`}
            className="mt-3.5 mb-1.5 border-b border-slate-200 pb-1 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-white"
          >
            {renderInlineFormattedText(trimmed.slice(4))}
          </h4>
        );
      } else if (trimmed.startsWith('## ')) {
        blocks.push(
          <h3
            key={`h2-${idx}`}
            className="mt-4 mb-2 border-b border-slate-200 pb-1 text-base font-bold text-slate-900 dark:border-slate-800 dark:text-white"
          >
            {renderInlineFormattedText(trimmed.slice(3))}
          </h3>
        );
      } else if (trimmed.startsWith('# ')) {
        blocks.push(
          <h2
            key={`h1-${idx}`}
            className="mt-5 mb-2.5 border-b border-slate-200 pb-1 text-lg font-black text-slate-900 dark:border-slate-800 dark:text-white"
          >
            {renderInlineFormattedText(trimmed.slice(2))}
          </h2>
        );
      } else if (trimmed === '---') {
        blocks.push(
          <hr key={`hr-${idx}`} className="my-4 border-slate-200 dark:border-slate-800" />
        );
      } else if (trimmed.length === 0) {
        blocks.push(<div key={`blank-${idx}`} className="h-2" />);
      } else {
        blocks.push(
          <p key={`p-${idx}`} className="my-1.5 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
            {renderInlineFormattedText(line)}
          </p>
        );
      }
    }
  });

  flushList('end');

  return <div className={`space-y-0.5 ${className}`}>{blocks}</div>;
};

export const QuestionNotesEditor: React.FC<QuestionNotesEditorProps> = ({ questionId }) => {
  const { t } = useLanguage();
  const initialNote = storage.getNote(questionId);

  const [isOpen, setIsOpen] = useState(() => Boolean(initialNote) || storage.isNotesSectionOpen());
  const [isSaved, setIsSaved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasContent, setHasContent] = useState(Boolean(initialNote?.noteText));
  const [charCount, setCharCount] = useState(initialNote?.noteText?.length || 0);

  const [prevQuestionId, setPrevQuestionId] = useState(questionId);
  if (questionId !== prevQuestionId) {
    setPrevQuestionId(questionId);
    const note = storage.getNote(questionId);
    const text = note ? note.noteText : '';
    setIsOpen(Boolean(note) || storage.isNotesSectionOpen());
    setIsSaved(false);
    setHasContent(Boolean(text.trim()));
    setCharCount(text.length);
  }

  const editorRef = useRef<HTMLDivElement>(null);
  const modalEditorRef = useRef<HTMLDivElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronize DOM elements when questionId changes
  useEffect(() => {
    const note = storage.getNote(questionId);
    const text = note ? note.noteText : '';
    const html = markdownToNoteHtml(text);

    if (editorRef.current) {
      editorRef.current.innerHTML = html;
    }
    if (modalEditorRef.current) {
      modalEditorRef.current.innerHTML = html;
    }
  }, [questionId]);

  // Flush any pending auto-save when component unmounts or before switching questions
  useEffect(() => {
    const inlineEl = editorRef.current;
    const modalEl = modalEditorRef.current;
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        const activeEl = isExpanded && modalEl ? modalEl : inlineEl;
        if (activeEl) {
          const html = activeEl.innerHTML;
          const md = noteHtmlToMarkdown(html);
          storage.saveNote(questionId, md);
          if (getStoredToken()) {
            if (md.trim()) {
              learnerApi.saveNote(questionId, md).catch(() => {});
            } else {
              learnerApi.deleteNote(questionId).catch(() => {});
            }
          }
        }
      }
    };
  }, [isExpanded, questionId]);

  // Stop native keyboard event bubbling so window-level shortcut handlers in StudyView/App never intercept typing
  useEffect(() => {
    const stopBubble = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.stopImmediatePropagation?.();
    };

    const ed = editorRef.current;
    const med = modalEditorRef.current;

    ed?.addEventListener('keydown', stopBubble);
    ed?.addEventListener('keyup', stopBubble);
    med?.addEventListener('keydown', stopBubble);
    med?.addEventListener('keyup', stopBubble);

    return () => {
      ed?.removeEventListener('keydown', stopBubble);
      ed?.removeEventListener('keyup', stopBubble);
      med?.removeEventListener('keydown', stopBubble);
      med?.removeEventListener('keyup', stopBubble);
    };
  }, [isOpen, isExpanded]);

  // Sync content between inline and modal editor when modal opens
  useEffect(() => {
    if (isExpanded && modalEditorRef.current && editorRef.current) {
      modalEditorRef.current.innerHTML = editorRef.current.innerHTML;
      setTimeout(() => {
        modalEditorRef.current?.focus();
      }, 50);
    }
  }, [isExpanded]);

  // Read current active editor container
  const getActiveEditor = useCallback(() => {
    if (isExpanded && modalEditorRef.current) {
      return modalEditorRef.current;
    }
    return editorRef.current;
  }, [isExpanded]);

  // Save current HTML converted to markdown
  const saveCurrentNote = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    const editor = getActiveEditor();
    if (!editor) return;

    const html = editor.innerHTML;
    const md = noteHtmlToMarkdown(html);

    storage.saveNote(questionId, md);

    if (getStoredToken()) {
      if (md.trim()) {
        learnerApi.saveNote(questionId, md).catch(() => {});
      } else {
        learnerApi.deleteNote(questionId).catch(() => {});
      }
    }

    setIsSaved(true);
    setHasContent(Boolean(md.trim()));
    setCharCount(md.length);

    // Sync content to both editors
    if (editorRef.current && editorRef.current !== editor) {
      editorRef.current.innerHTML = html;
    }
    if (modalEditorRef.current && modalEditorRef.current !== editor) {
      modalEditorRef.current.innerHTML = html;
    }

    setTimeout(() => setIsSaved(false), 2200);
  }, [getActiveEditor, questionId]);

  // Debounced input change handler
  const handleEditorInput = useCallback(() => {
    const editor = getActiveEditor();
    if (!editor) return;

    const textContent = editor.innerText || '';
    const hasText = Boolean(textContent.trim());
    setHasContent(hasText);
    setCharCount(textContent.length);
    setIsSaved(false);

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      saveCurrentNote();
    }, 1200);
  }, [getActiveEditor, saveCurrentNote]);

  // Delete note confirmation
  const handleDeleteNote = () => {
    if (window.confirm(t.notes.deleteConfirm)) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      storage.deleteNote(questionId);

      if (getStoredToken()) {
        learnerApi.deleteNote(questionId).catch(() => {});
      }

      if (editorRef.current) editorRef.current.innerHTML = '';
      if (modalEditorRef.current) modalEditorRef.current.innerHTML = '';

      setHasContent(false);
      setCharCount(0);
      setIsSaved(false);
      setIsExpanded(false);
      setIsOpen(false);
    }
  };

  // Formatting actions (MouseDown prevents losing editor focus & selection)
  const executeFormatting = useCallback(
    (action: () => void) => {
      const editor = getActiveEditor();
      if (!editor) return;
      editor.focus();
      action();
      handleEditorInput();
    },
    [getActiveEditor, handleEditorInput]
  );

  const handleBold = useCallback(() => {
    executeFormatting(() => {
      document.execCommand('bold', false);
    });
  }, [executeFormatting]);

  const handleItalic = useCallback(() => {
    executeFormatting(() => {
      document.execCommand('italic', false);
    });
  }, [executeFormatting]);

  const handleHighlight = useCallback(() => {
    executeFormatting(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return;
      }

      // Check if current selection is already inside a <mark>
      const anchor = selection.anchorNode;
      const element =
        anchor?.nodeType === Node.ELEMENT_NODE
          ? (anchor as HTMLElement)
          : anchor?.parentElement;
      const existingMark = element?.closest('mark');

      if (existingMark) {
        // Unwrap mark
        const parent = existingMark.parentNode;
        while (existingMark.firstChild) {
          parent?.insertBefore(existingMark.firstChild, existingMark);
        }
        parent?.removeChild(existingMark);
      } else {
        const range = selection.getRangeAt(0);
        const mark = document.createElement('mark');
        mark.className =
          'note-highlight rounded px-1.5 py-0.5 font-semibold border bg-amber-200/90 text-amber-950 border-amber-300 dark:bg-amber-500/30 dark:text-amber-200 dark:border-amber-600/60 shadow-2xs';
        try {
          range.surroundContents(mark);
        } catch {
          // Fallback if cross-boundary
          document.execCommand('hiliteColor', false, '#fef08a');
        }
      }
    });
  }, [executeFormatting]);

  const handleHeading = useCallback(() => {
    executeFormatting(() => {
      document.execCommand('formatBlock', false, '<h3>');
    });
  }, [executeFormatting]);

  const handleList = useCallback(() => {
    executeFormatting(() => {
      document.execCommand('insertUnorderedList', false);
    });
  }, [executeFormatting]);

  const handleCode = useCallback(() => {
    executeFormatting(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
      const range = selection.getRangeAt(0);
      const code = document.createElement('code');
      code.className =
        'mx-0.5 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300';
      try {
        range.surroundContents(code);
      } catch {
        // ignore
      }
    });
  }, [executeFormatting]);

  const handleToggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      storage.setNotesSectionOpen(next);
      return next;
    });
  }, []);

  // Keyboard shortcut listener
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Stop keyboard events from leaking to parent containers (e.g. StudyView, App)
    e.stopPropagation();
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation?.();
    }

    const isModifier = e.ctrlKey || e.metaKey;

    // Ctrl+H -> Highlight
    if (isModifier && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      handleHighlight();
      return;
    }

    // Ctrl+B -> Bold
    if (isModifier && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      handleBold();
      return;
    }

    // Ctrl+I -> Italic
    if (isModifier && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      handleItalic();
      return;
    }

    // Ctrl+S or Ctrl+Enter -> Instant Save
    if (isModifier && (e.key === 's' || e.key === 'Enter')) {
      e.preventDefault();
      saveCurrentNote();
      return;
    }

    // Escape -> Exit expanded view
    if (e.key === 'Escape' && isExpanded) {
      e.preventDefault();
      setIsExpanded(false);
      return;
    }
  };

  // Render unified formatting toolbar
  const renderToolbar = (inModal = false) => (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/90 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900/90 select-none">
      <div className="flex flex-wrap items-center gap-1">
        {/* Bold */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleBold}
          title={`${t.notes.bold} (Ctrl+B)`}
          className="flex h-7 w-7 items-center justify-center rounded border border-transparent text-slate-700 hover:border-slate-300 hover:bg-white active:bg-slate-100 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>

        {/* Italic */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleItalic}
          title={`${t.notes.italic} (Ctrl+I)`}
          className="flex h-7 w-7 items-center justify-center rounded border border-transparent text-slate-700 hover:border-slate-300 hover:bg-white active:bg-slate-100 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>

        {/* Highlight */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleHighlight}
          title={`${t.notes.highlight} (Ctrl+H) - Tô sáng màu vàng`}
          className="flex items-center gap-1 h-7 px-2 rounded border border-amber-300/90 bg-amber-100 text-amber-900 hover:bg-amber-200 active:bg-amber-300 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900/80 font-semibold text-xs shadow-2xs"
        >
          <Highlighter className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span className="hidden sm:inline text-[11px]">{t.notes.highlight}</span>
        </button>

        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

        {/* Heading */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleHeading}
          title={t.notes.heading}
          className="flex h-7 w-7 items-center justify-center rounded border border-transparent text-slate-700 hover:border-slate-300 hover:bg-white active:bg-slate-100 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </button>

        {/* Bullet List */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleList}
          title={t.notes.bulletList}
          className="flex h-7 w-7 items-center justify-center rounded border border-transparent text-slate-700 hover:border-slate-300 hover:bg-white active:bg-slate-100 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800"
        >
          <List className="h-3.5 w-3.5" />
        </button>

        {/* Code / AWS Service tag */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleCode}
          title={t.notes.code}
          className="flex h-7 w-7 items-center justify-center rounded border border-transparent text-slate-700 hover:border-slate-300 hover:bg-white active:bg-slate-100 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800"
        >
          <Code className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Right controls: Expand / Collapse */}
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline font-mono">
          WYSIWYG
        </span>

        {!inModal ? (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            title={t.notes.expand}
            className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Maximize2 className="h-3 w-3" />
            <span>{t.notes.expand}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            title={t.notes.collapse}
            className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Minimize2 className="h-3 w-3" />
            <span>{t.notes.collapse}</span>
          </button>
        )}
      </div>
    </div>
  );

  // Render bottom footer bar
  const renderFooter = () => (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-2 text-xs dark:border-slate-800 select-none">
      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
        <span>
          {charCount} {t.notes.chars}
        </span>
        <span>•</span>
        <span className="hidden sm:inline text-slate-400 dark:text-slate-500">
          Ctrl+B (In đậm) • Ctrl+H (Tô sáng) • Enter (Xuống dòng) • Ctrl+S (Lưu)
        </span>
      </div>

      <div className="flex items-center gap-2">
        {hasContent && (
          <button
            type="button"
            onClick={handleDeleteNote}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 active:bg-rose-100 dark:border-slate-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
            title={t.notes.delete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{t.notes.delete}</span>
          </button>
        )}

        <button
          type="button"
          onClick={saveCurrentNote}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {isSaved ? (
            <>
              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>{t.notes.saved}</span>
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              <span>{t.notes.save}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Inline Note Card in Question View */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleToggleOpen}
            className="flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
          >
            <StickyNote
              className={`h-4 w-4 ${hasContent ? 'text-amber-500 fill-amber-500/20' : 'text-slate-400'}`}
            />
            <span>{t.notes.title}</span>
            {hasContent && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                {t.notes.saved}
              </span>
            )}
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
              {t.notes.searchable}{' '}
              <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">
                Ctrl+K
              </kbd>
            </span>
            {isOpen && (
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                title={t.notes.expand}
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <Maximize2 className="h-3 w-3" />
                <span className="hidden sm:inline">{t.notes.expand}</span>
              </button>
            )}
          </div>
        </div>

        {isOpen && (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-950">
            {renderToolbar(false)}

            <div className="p-3">
              {/* Single Unified Rich Editable Surface */}
              <div
                ref={editorRef}
                contentEditable
                role="textbox"
                aria-multiline="true"
                data-placeholder="Nhập ghi chú quan trọng, mẹo nhớ kiến trúc... Bôi đen từ khóa rồi bấm [Tô sáng] hoặc [B] để in đậm/highlight trực tiếp..."
                onInput={handleEditorInput}
                onKeyDown={handleKeyDown}
                onKeyDownCapture={(e) => e.stopPropagation()}
                onKeyUpCapture={(e) => e.stopPropagation()}
                className="note-editor-surface min-h-[140px] max-h-[420px] overflow-y-auto w-full rounded-lg border border-transparent p-2 text-sm leading-relaxed text-slate-900 focus:outline-none dark:text-slate-100 font-sans focus:ring-1 focus:ring-amber-500/40 relative empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 dark:empty:before:text-slate-500 empty:before:pointer-events-none"
              />

              {renderFooter()}
            </div>
          </div>
        )}
      </div>

      {/* Expanded Focus / Fullscreen Modal */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="relative flex h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <StickyNote className="h-4 w-4 fill-current" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t.notes.title} • Câu hỏi #{questionId}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Trình soạn thảo ghi chú kiến trúc AWS: tô sáng, in đậm, danh sách và xuống dòng trực tiếp
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  title={t.notes.collapse}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Toolbar */}
            {renderToolbar(true)}

            {/* Modal Editor Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-7 bg-slate-50/40 dark:bg-slate-950/40">
              <div
                ref={modalEditorRef}
                contentEditable
                role="textbox"
                aria-multiline="true"
                data-placeholder="Nhập ghi chú chi tiết cho câu hỏi này... Bôi đen chữ rồi dùng thanh công cụ phía trên để tô sáng hoặc in đậm..."
                onInput={handleEditorInput}
                onKeyDown={handleKeyDown}
                onKeyDownCapture={(e) => e.stopPropagation()}
                onKeyUpCapture={(e) => e.stopPropagation()}
                className="note-editor-surface min-h-full w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-base leading-relaxed text-slate-900 dark:text-slate-100 font-sans focus:outline-none focus:ring-2 focus:ring-amber-500/30 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 dark:empty:before:text-slate-500 empty:before:pointer-events-none"
              />
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 bg-slate-50/90 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/90">
              {renderFooter()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
