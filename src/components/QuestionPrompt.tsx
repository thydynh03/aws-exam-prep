import React, { useState, useMemo } from 'react';
import type { Question } from '../core/types';
import { EXAM_CLUES, detectQuestionClues } from '../core/questionClues';
import { segmentTextByMatches } from '../core/textHighlighter';
import { useLanguage } from '../context/useLanguage';
import { Bookmark, Flag, Sparkles, Lightbulb, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { ContentDomainBadge } from './ContentDomainBadge';

interface QuestionPromptProps {
  question: Question;
  index: number;
  total: number;
  isMarked?: boolean;
  isBookmarked?: boolean;
  onToggleMark?: () => void;
  onToggleBookmark?: () => void;
  onResetQuestion?: () => void;
  showBookmark?: boolean;
  showMark?: boolean;
  showCluesToggle?: boolean;
  showReset?: boolean;
}

export const QuestionPrompt: React.FC<QuestionPromptProps> = ({
  question,
  index,
  total,
  isMarked = false,
  isBookmarked = false,
  onToggleMark,
  onToggleBookmark,
  onResetQuestion,
  showBookmark = true,
  showMark = true,
  showCluesToggle = true,
  showReset = false,
}) => {
  const { t } = useLanguage();
  const [highlightClues, setHighlightClues] = useState(false);
  const [showClueDetails, setShowClueDetails] = useState(false);

  const detectedClues = useMemo(() => {
    return detectQuestionClues(question.text);
  }, [question.text]);

  // Render question text with optional clue highlighting without duplication
  const renderedQuestionText = useMemo(() => {
    if (!highlightClues || detectedClues.length === 0) {
      return question.text;
    }

    const rules = EXAM_CLUES.map((clue) => ({
      pattern: clue.pattern,
      data: clue,
    }));

    const segments = segmentTextByMatches(question.text, rules);

    return segments.map((segment, i) => {
      if (segment.type === 'highlight') {
        const matchedClue = segment.data;
        return (
          <mark
            key={i}
            className={`inline-block mx-0.5 px-1.5 py-0.2 rounded border font-semibold text-sm sm:text-base select-text cursor-text ${matchedClue.colorLight} ${matchedClue.colorDark}`}
            title={`${matchedClue.label}: ${matchedClue.architecturalGuidance}`}
          >
            {segment.text}
          </mark>
        );
      }

      return <span key={i}>{segment.text}</span>;
    });
  }, [question.text, highlightClues, detectedClues]);

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 pb-6 mb-6">
      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 text-xs font-mono font-bold rounded bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            {t.question.questionLabel} {index + 1} / {total}
          </span>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            ID #{question.id}
          </span>

          <ContentDomainBadge domain={question.domain} size="sm" />

          <div className="h-3 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

          {/* Tags */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {question.serviceTags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Action icons: Clues toggle, Mark for Review & Bookmark */}
        <div className="flex items-center gap-2">
          {showCluesToggle && (
            <button
              type="button"
              onClick={() => {
                setHighlightClues((prev) => !prev);
                if (!highlightClues) setShowClueDetails(true);
              }}
              title="Gợi ý từ khóa & ràng buộc thiết kế kiến trúc (Exam Clues)"
              aria-label={highlightClues ? t.question.hideClues : t.question.examClues}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[36px] sm:min-h-0 text-xs font-semibold rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900] active:scale-95 ${
                highlightClues
                  ? 'bg-amber-500 text-white border-amber-600 dark:bg-amber-500 dark:text-slate-950 font-bold shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <Lightbulb className={`w-3.5 h-3.5 ${highlightClues ? 'fill-current' : ''}`} />
              <span>{highlightClues ? t.question.hideClues : t.question.examClues}</span>
              {detectedClues.length > 0 && (
                <span className="rounded-full bg-amber-200/80 px-1 text-[10px] text-amber-900 dark:bg-amber-950 dark:text-amber-200 font-bold">
                  {detectedClues.length}
                </span>
              )}
            </button>
          )}

          {showMark && onToggleMark && (
            <button
              type="button"
              onClick={onToggleMark}
              title={`${t.question.markForReview} (Hotkey: M)`}
              aria-label={isMarked ? t.question.marked : t.question.markForReview}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[36px] sm:min-h-0 text-xs font-medium rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900] active:scale-95 ${
                isMarked
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <Flag className={`w-3.5 h-3.5 ${isMarked ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline">{isMarked ? t.question.marked : t.question.markForReview}</span>
              <kbd className="hidden md:inline px-1 text-[10px] rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500">M</kbd>
            </button>
          )}

          {showBookmark && onToggleBookmark && (
            <button
              type="button"
              onClick={onToggleBookmark}
              title={`${t.question.bookmark} (Hotkey: B)`}
              aria-label={isBookmarked ? 'Remove bookmark' : t.question.bookmark}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[36px] sm:min-h-0 text-xs font-medium rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900] active:scale-95 ${
                isBookmarked
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline">{isBookmarked ? t.question.bookmarked : t.question.bookmark}</span>
              <kbd className="hidden md:inline px-1 text-[10px] rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500">B</kbd>
            </button>
          )}

          {showReset && onResetQuestion && (
            <button
              type="button"
              onClick={onResetQuestion}
              title="Reset câu hỏi này về trạng thái ban đầu để làm lại"
              aria-label={t.study.resetQuestion}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[36px] sm:min-h-0 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.study.resetQuestion}</span>
            </button>
          )}
        </div>
      </div>

      {/* Choice Instruction Badge */}
      <div className="mb-3">
        {question.isMultiSelect ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            {t.question.selectMultiple.replace('{count}', String(question.expectedChoicesCount))}
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-slate-500 dark:text-slate-400">
            {t.question.selectOne}
          </span>
        )}
      </div>

      {/* Question Text - Visual Priority #1 */}
      <div className="text-slate-900 dark:text-slate-100 text-base sm:text-lg leading-relaxed font-normal whitespace-pre-line tracking-normal select-text cursor-text selection:bg-amber-400/30 dark:selection:bg-amber-500/30 selection:text-slate-900 dark:selection:text-white">
        {renderedQuestionText}
      </div>

      {/* Interactive Clues Breakdown Accordion */}
      {highlightClues && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30 text-xs">
          {detectedClues.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300">
                  <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span>{t.question.cluesFound} ({detectedClues.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClueDetails((prev) => !prev)}
                  className="flex items-center gap-1 font-semibold text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200"
                >
                  <span>{showClueDetails ? t.question.collapseGuidance : t.question.expandGuidance}</span>
                  {showClueDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>

              {showClueDetails && (
                <div className="mt-3 space-y-2.5 divide-y divide-amber-200/60 dark:divide-amber-900/40 pt-1">
                  {detectedClues.map((item, idx) => (
                    <div key={idx} className={idx > 0 ? 'pt-2.5' : ''}>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-950 dark:text-amber-100">
                          "{item.matchText}"
                        </span>
                        <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                          {item.clue.label}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">
                        <strong>Rule:</strong> {item.clue.architecturalGuidance}
                      </p>
                      <p className="mt-0.5 text-amber-900 dark:text-amber-300 font-medium">
                        🇻🇳 <em>{item.clue.explanationVi}</em>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-start gap-2.5 text-amber-950 dark:text-amber-200">
              <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-bold">
                  {t.question.examClues} - Chiến lược phân tích SAA-C03
                </p>
                <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">
                  Chú ý câu hỏi yêu cầu chính ở cuối đề: xác định rõ mục tiêu kiến trúc (Độ trễ, Tối ưu chi phí, Tính sẵn sàng cao Multi-AZ hay Tối thiểu hóa quản trị vận hành) và loại trừ ngay các đáp án tự cài đặt phần mềm thủ công trên EC2.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
