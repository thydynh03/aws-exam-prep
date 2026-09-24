import React, { useState } from 'react';
import type { Question, OptionExplanation } from '../core/types';
import { useLanguage } from '../context/useLanguage';
import { generateAllOptionExplanations } from '../core/distractorExplainer';
import { Check, X, Slash, Undo2, AlertCircle } from 'lucide-react';

interface OptionsListProps {
  question: Question;
  selectedAnswer: string; // e.g. "A" or "CD"
  onSelectOption: (choiceKey: string) => void;
  isRevealed?: boolean; // true in Study mode after submit or in Review mode
  disabled?: boolean;
  optionExplanations?: Record<string, OptionExplanation>;
}

export const OptionsList: React.FC<OptionsListProps> = ({
  question,
  selectedAnswer,
  onSelectOption,
  isRevealed = false,
  disabled = false,
  optionExplanations,
}) => {
  const { t } = useLanguage();
  const isMulti = question.isMultiSelect;
  const selectedSet = new Set(selectedAnswer.split(''));
  const correctSet = new Set(question.answer.split(''));

  const explanations = React.useMemo(() => {
    if (!isRevealed) return {};
    if (optionExplanations) return optionExplanations;
    return generateAllOptionExplanations(question, selectedAnswer);
  }, [isRevealed, optionExplanations, question, selectedAnswer]);

  // Track eliminated / struck-through options per question
  const [eliminatedKeys, setEliminatedKeys] = useState<Set<string>>(new Set());

  const toggleEliminate = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    e.preventDefault();
    setEliminatedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // If it was selected, unselect it
        if (selectedSet.has(key)) {
          onSelectOption(key);
        }
      }
      return next;
    });
  };

  // Track mouse coordinates to distinguish drag (text selection) vs simple click
  const dragTrackingRef = React.useRef<{
    startX: number;
    startY: number;
    isDragging: boolean;
  }>({ startX: 0, startY: 0, isDragging: false });

  const handleLabelMouseDown = (e: React.MouseEvent) => {
    dragTrackingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
    };
  };

  const handleLabelMouseMove = (e: React.MouseEvent) => {
    if (e.buttons === 1) {
      const dx = Math.abs(e.clientX - dragTrackingRef.current.startX);
      const dy = Math.abs(e.clientY - dragTrackingRef.current.startY);
      if (dx > 4 || dy > 4) {
        dragTrackingRef.current.isDragging = true;
      }
    }
  };

  const handleLabelClick = (e: React.MouseEvent<HTMLLabelElement>) => {
    const selection = typeof window !== 'undefined' ? window.getSelection() : null;
    const hasSelection = Boolean(
      selection &&
      !selection.isCollapsed &&
      selection.toString().trim().length > 0 &&
      (e.currentTarget.contains(selection.anchorNode) || e.currentTarget.contains(selection.focusNode))
    );

    if (dragTrackingRef.current.isDragging || hasSelection) {
      // Prevent label activation (toggling checkbox/radio) when user was selecting or dragging text
      e.preventDefault();
      dragTrackingRef.current.isDragging = false;
      return;
    }
  };

  const handleSelectWithUneliminate = (key: string) => {
    if (eliminatedKeys.has(key)) {
      setEliminatedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
    onSelectOption(key);
  };

  return (
    <fieldset className="space-y-3" aria-label="Answer Choices">
      <legend className="sr-only">Answer Choices</legend>

      {question.choiceKeys.map((key, idx) => {
        const text = question.choices[key];
        const isSelected = selectedSet.has(key);
        const isCorrect = correctSet.has(key);
        const isEliminated = !isRevealed && eliminatedKeys.has(key);

        let borderClasses = 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60';
        let badgeClasses = 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
        let statusLabel: React.ReactNode = null;

        if (isRevealed) {
          if (isCorrect) {
            borderClasses = 'border-emerald-500 dark:border-emerald-500/80 bg-emerald-500/5 dark:bg-emerald-500/10 ring-1 ring-emerald-500/30';
            badgeClasses = 'border-emerald-500 bg-emerald-500 text-white font-bold';
            statusLabel = (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" /> {t.question.correctAnswer}
              </span>
            );
          } else if (isSelected) {
            borderClasses = 'border-red-500 dark:border-red-500/80 bg-red-500/5 dark:bg-red-500/10 ring-1 ring-red-500/30';
            badgeClasses = 'border-red-500 bg-red-500 text-white font-bold';
            statusLabel = (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                <X className="w-3.5 h-3.5" /> {t.question.yourSelection}
              </span>
            );
          }
        } else if (isEliminated) {
          borderClasses = 'border-slate-200 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/20 opacity-45';
          badgeClasses = 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-400 line-through';
        } else if (isSelected) {
          borderClasses = 'border-[#EC7211] dark:border-[#FF9900] bg-amber-500/5 dark:bg-amber-500/10 ring-1 ring-[#FF9900]/40';
          badgeClasses = 'border-[#EC7211] bg-[#EC7211] text-white dark:border-[#FF9900] dark:bg-[#FF9900] dark:text-slate-950 font-bold';
        }

        return (
          <label
            key={key}
            htmlFor={`choice-${question.id}-${key}`}
            className={`group relative flex items-start gap-3.5 p-3.5 sm:p-4 rounded-lg border transition-all text-left focus-within:ring-2 focus-within:ring-[#FF9900] focus-within:ring-offset-1 dark:focus-within:ring-offset-slate-900 ${borderClasses} ${
              disabled ? 'cursor-default' : 'cursor-pointer'
            }`}
            onMouseDown={disabled ? undefined : handleLabelMouseDown}
            onMouseMove={disabled ? undefined : handleLabelMouseMove}
            onClick={disabled ? undefined : handleLabelClick}
          >
            {/* Native accessible input */}
            <input
              id={`choice-${question.id}-${key}`}
              type={isMulti ? 'checkbox' : 'radio'}
              name={`question-${question.id}`}
              value={key}
              checked={isSelected}
              disabled={disabled}
              onChange={() => handleSelectWithUneliminate(key)}
              className="sr-only"
              aria-label={`Option ${key}: ${text}`}
            />

            {/* Letter Badge */}
            <div
              className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-xs font-mono font-semibold border transition-colors select-none ${
                disabled ? 'cursor-default' : 'cursor-pointer'
              } ${badgeClasses}`}
            >
              {key}
            </div>

            {/* Choice Text & Status Badge */}
            <div className="flex-1 min-w-0 pt-0.5 select-text cursor-text">
              <div
                className={`text-sm sm:text-base leading-relaxed select-text cursor-text selection:bg-amber-400/30 dark:selection:bg-amber-500/30 selection:text-slate-900 dark:selection:text-white ${
                  isEliminated
                    ? 'line-through text-slate-400 dark:text-slate-500 italic'
                    : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                {text}
              </div>
              {statusLabel && <div className="mt-1.5 select-none">{statusLabel}</div>}

              {/* Inline Wrong Answer Reason for selected incorrect option (only when concrete reason exists) */}
              {isRevealed && isSelected && !isCorrect && explanations[key] && 
                !explanations[key].violationType?.includes('Không tối ưu kiến trúc & Vi phạm ràng buộc đề bài') &&
                !explanations[key].shortReasonVi?.includes('không đáp ứng tối ưu yêu cầu của đề bài so với phương án đúng') && (
                <div className="mt-2 text-xs rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-2.5 text-red-900 dark:text-red-200 leading-relaxed select-text cursor-text selection:bg-red-400/25 dark:selection:bg-red-500/30">
                  <div className="font-bold flex items-center gap-1.5 text-red-800 dark:text-red-300 select-text">
                    <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0 select-none" />
                    <span className="select-text cursor-text">{t.question.whyWrong}: {explanations[key].violationType}</span>
                  </div>
                  <p className="mt-1 text-slate-700 dark:text-slate-300 font-normal select-text cursor-text">
                    {explanations[key].shortReasonVi}
                  </p>
                </div>
              )}
            </div>

            {/* Right Action: Elimination Tool & Keyboard Hint */}
            <div className="flex items-center gap-2 self-start pt-0.5 select-none">
              {!isRevealed && !disabled && (
                <button
                  type="button"
                  onClick={(e) => toggleEliminate(e, key)}
                  title={isEliminated ? `${t.question.restoreOption} ${key}` : `${t.question.eliminateOption} ${key}`}
                  aria-label={isEliminated ? `${t.question.restoreOption} ${key}` : `${t.question.eliminateOption} ${key}`}
                  className={`p-2 min-w-[40px] min-h-[40px] -mr-1.5 -mt-1.5 flex items-center justify-center rounded-lg text-xs transition-colors ${
                    isEliminated
                      ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/60'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {isEliminated ? <Undo2 className="w-4 h-4" /> : <Slash className="w-4 h-4" />}
                </button>
              )}

              {/* Keyboard hint (desktop only) */}
              <div className="hidden lg:flex items-center text-[11px] font-mono text-slate-400 dark:text-slate-500 opacity-60 group-hover:opacity-100">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {idx + 1}
                </span>
              </div>
            </div>
          </label>
        );
      })}
    </fieldset>
  );
};
