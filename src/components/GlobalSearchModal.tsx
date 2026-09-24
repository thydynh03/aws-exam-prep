import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Question } from '../core/types';
import { AWS_SERVICES, SERVICE_COMPARISONS } from '../core/serviceDatabase';
import { FLASHCARDS } from '../core/flashcardDatabase';
import { storage } from '../core/storage';
import { Search, X, Layers, Server, BookOpen, StickyNote, HelpCircle, ArrowRight } from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  onNavigateToQuestion: (questionId: number) => void;
  onNavigateToServices: (serviceId?: string) => void;
  onNavigateToFlashcards: (deckId?: string) => void;
}

interface SearchResultItem {
  id: string;
  type: 'question' | 'service' | 'comparison' | 'flashcard' | 'note';
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  targetId: string | number;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  questions,
  onNavigateToQuestion,
  onNavigateToServices,
  onNavigateToFlashcards,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleClose = () => {
    setQuery('');
    setSelectedIndex(0);
    onClose();
  };

  const searchResults: SearchResultItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const results: SearchResultItem[] = [];

    // 1. Search AWS Services
    for (const s of AWS_SERVICES) {
      if (
        s.name.toLowerCase().includes(q) ||
        (s.abbreviation && s.abbreviation.toLowerCase().includes(q)) ||
        s.summary.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      ) {
        results.push({
          id: `service-${s.id}`,
          type: 'service',
          title: `${s.name} (${s.abbreviation || s.category})`,
          subtitle: s.summary,
          badge: 'AWS Service',
          badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
          targetId: s.id,
        });
      }
    }

    // 2. Search Architectural Comparisons
    for (const c of SERVICE_COMPARISONS) {
      if (
        c.title.toLowerCase().includes(q) ||
        c.services.some((srv) => srv.toLowerCase().includes(q)) ||
        c.examTip.toLowerCase().includes(q)
      ) {
        results.push({
          id: `comp-${c.id}`,
          type: 'comparison',
          title: c.title,
          subtitle: c.examTip,
          badge: 'Comparison Guide',
          badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
          targetId: c.id,
        });
      }
    }

    // 3. Search Personal Notes
    const notes = storage.getAllNotes();
    for (const [qIdStr, note] of Object.entries(notes)) {
      if (note.noteText.toLowerCase().includes(q)) {
        const qId = Number(qIdStr);
        results.push({
          id: `note-${qId}`,
          type: 'note',
          title: `Question #${qId} Note`,
          subtitle: note.noteText,
          badge: 'Personal Note',
          badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
          targetId: qId,
        });
      }
    }

    // 4. Search Flashcards
    for (const fc of FLASHCARDS) {
      if (
        fc.title.toLowerCase().includes(q) ||
        fc.front.toLowerCase().includes(q) ||
        fc.back.toLowerCase().includes(q) ||
        fc.keyTakeaway.toLowerCase().includes(q)
      ) {
        results.push({
          id: `fc-${fc.id}`,
          type: 'flashcard',
          title: fc.title,
          subtitle: fc.keyTakeaway || fc.front,
          badge: `Flashcard (${fc.deckId})`,
          badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
          targetId: fc.deckId,
        });
      }
    }

    // 5. Search Questions
    let questionMatches = 0;
    for (const qu of questions) {
      if (questionMatches >= 15) break; // Limit questions to keep list responsive

      const isIdMatch = qu.id.toString() === q || qu.originalId === q;
      const isTextMatch = qu.text.toLowerCase().includes(q);
      const isServiceMatch = qu.serviceTags.some((t) => t.toLowerCase().includes(q));

      if (isIdMatch || isTextMatch || isServiceMatch) {
        results.push({
          id: `q-${qu.id}`,
          type: 'question',
          title: `Question #${qu.id}: ${qu.domain}`,
          subtitle: qu.text.slice(0, 140) + '...',
          badge: qu.serviceTags[0] || 'Question',
          badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
          targetId: qu.id,
        });
        questionMatches++;
      }
    }

    return results.slice(0, 25);
  }, [query, questions]);

  const handleSelect = (item: SearchResultItem) => {
    handleClose();
    if (item.type === 'question' || item.type === 'note') {
      onNavigateToQuestion(Number(item.targetId));
    } else if (item.type === 'service' || item.type === 'comparison') {
      onNavigateToServices(String(item.targetId));
    } else if (item.type === 'flashcard') {
      onNavigateToFlashcards(String(item.targetId));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter' && searchResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(searchResults[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-4 pt-16 backdrop-blur-xs sm:pt-24"
      onClick={handleClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
          <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search 1,019 questions, AWS services, comparisons, flashcards, notes..."
            className="ml-3 flex-1 bg-transparent text-base text-slate-900 placeholder-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder-slate-500"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              ESC
            </span>
          )}
        </div>

        {/* Results Container */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <p className="text-sm font-medium">Type at least 2 characters to search</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Try: "S3 vs EFS"
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Try: "ALB"
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Try: "Multi-AZ"
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Try: "Question 42"
                </span>
              </div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <p className="text-sm">No results found for "{query}"</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Try searching for service names (EC2, KMS, SQS), domain topics, or question numbers.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {searchResults.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                let Icon = HelpCircle;
                if (item.type === 'service') Icon = Server;
                else if (item.type === 'comparison') Icon = Layers;
                else if (item.type === 'flashcard') Icon = BookOpen;
                else if (item.type === 'note') Icon = StickyNote;

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex w-full items-center justify-between rounded-xl p-3 text-left transition-colors ${
                        isSelected
                          ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200'
                          : 'text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-start gap-3 overflow-hidden">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">{item.title}</span>
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          </div>
                          <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className={`ml-3 h-4 w-4 shrink-0 opacity-0 transition-opacity ${isSelected ? 'opacity-100' : ''}`} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-4 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span><kbd className="rounded bg-slate-200 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">↑</kbd> <kbd className="rounded bg-slate-200 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">↓</kbd> navigate</span>
            <span><kbd className="rounded bg-slate-200 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">↵</kbd> select</span>
          </div>
          <span>{searchResults.length} match{searchResults.length === 1 ? '' : 'es'}</span>
        </div>
      </div>
    </div>
  );
};
