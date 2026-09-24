import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Flashcard } from '../core/types';
import { FLASHCARDS } from '../core/flashcardDatabase';
import { storage } from '../core/storage';
import { calculateNextReviewInterval } from '../core/learningEngine';
import { isTypingInInput } from '../core/noteFormatter';
import { 
  BookOpen, 
  RotateCw, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { useLanguage } from '../context/useLanguage';

interface FlashcardsViewProps {
  onBackToHome: () => void;
  initialDeckId?: string;
}

type DeckType = 'all' | 'services' | 'domains' | 'traps' | 'comparisons';

const VALID_DECKS: DeckType[] = ['all', 'services', 'domains', 'traps', 'comparisons'];

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({ onBackToHome, initialDeckId = 'all' }) => {
  const { t } = useLanguage();
  const getSafeDeck = (deck?: unknown): DeckType => {
    if (typeof deck === 'string' && VALID_DECKS.includes(deck as DeckType)) {
      return deck as DeckType;
    }
    return 'all';
  };

  const [activeDeck, setActiveDeck] = useState<DeckType>(getSafeDeck(initialDeckId));
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [progressState, setProgressState] = useState(() => storage.getFlashcardProgress());

  // Synchronize when initialDeckId prop changes
  const [prevInitialDeckId, setPrevInitialDeckId] = useState(initialDeckId);
  if (initialDeckId !== prevInitialDeckId) {
    setPrevInitialDeckId(initialDeckId);
    setActiveDeck(getSafeDeck(initialDeckId));
    setCardIndex(0);
    setIsFlipped(false);
  }

  const deckCards = useMemo(() => {
    if (activeDeck === 'all') return FLASHCARDS;
    return FLASHCARDS.filter((c) => c.deckId === activeDeck);
  }, [activeDeck]);

  const currentCard: Flashcard | undefined = deckCards[cardIndex];

  const currentCardProgress = useMemo(() => {
    if (!currentCard) return { box: 1, reviewsCount: 0 };
    return progressState[currentCard.id] || { box: currentCard.box, reviewsCount: currentCard.reviewsCount };
  }, [currentCard, progressState]);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleNext = useCallback(() => {
    setIsFlipped(false);
    setCardIndex((prev) => (prev < deckCards.length - 1 ? prev + 1 : 0));
  }, [deckCards.length]);

  const handlePrev = useCallback(() => {
    setIsFlipped(false);
    setCardIndex((prev) => (prev > 0 ? prev - 1 : deckCards.length - 1));
  }, [deckCards.length]);

  const handleRate = useCallback((rating: 'again' | 'hard' | 'good' | 'easy') => {
    if (!currentCard) return;
    const { nextBox, nextDueTimestamp } = calculateNextReviewInterval(currentCardProgress.box, rating);
    storage.saveFlashcardReview(currentCard.id, nextBox, nextDueTimestamp);
    storage.incrementDailyActivity(1);
    setProgressState(storage.getFlashcardProgress());
    handleNext();
  }, [currentCard, currentCardProgress.box, handleNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput(e.target)) return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleFlip();
      } else if (e.key === 'ArrowRight' || e.key === 'j') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'k') {
        e.preventDefault();
        handlePrev();
      } else if (isFlipped) {
        if (e.key === '1') handleRate('again');
        else if (e.key === '2') handleRate('hard');
        else if (e.key === '3') handleRate('good');
        else if (e.key === '4') handleRate('easy');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handleNext, handlePrev, handleRate, isFlipped]);

  const deckStats = useMemo(() => {
    let mastered = 0;
    let learning = 0;
    for (const card of deckCards) {
      const p = progressState[card.id];
      if (p && p.box >= 4) mastered++;
      else if (p && p.box > 1) learning++;
    }
    return { mastered, learning, total: deckCards.length };
  }, [deckCards, progressState]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* Top Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBackToHome}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t.nav.dashboard}</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t.flashcards.cardCount.replace('{current}', String(cardIndex + 1)).replace('{total}', String(deckCards.length))}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
              {deckStats.mastered} {t.flashcards.mastered}
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
              {deckStats.learning} {t.flashcards.learning}
            </span>
          </div>
        </div>
      </div>

      {/* Deck Selector Tabs */}
      <div className="mb-6 flex overflow-x-auto no-scrollbar rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
        {[
          { id: 'all', label: t.flashcards.deckAll, count: FLASHCARDS.length },
          { id: 'services', label: t.flashcards.deckServices, count: FLASHCARDS.filter((c) => c.deckId === 'services').length },
          { id: 'domains', label: t.flashcards.deckDomains, count: FLASHCARDS.filter((c) => c.deckId === 'domains').length },
          { id: 'traps', label: t.flashcards.deckTraps, count: FLASHCARDS.filter((c) => c.deckId === 'traps').length },
          { id: 'comparisons', label: t.flashcards.deckComparisons, count: FLASHCARDS.filter((c) => c.deckId === 'comparisons').length },
        ].map((tab) => {
          const isActive = activeDeck === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveDeck(tab.id as DeckType);
                setCardIndex(0);
                setIsFlipped(false);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold min-h-[36px] transition-all active:scale-95 touch-manipulation ${
                isActive
                  ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-800 dark:text-blue-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className="rounded-full bg-slate-200/70 px-1.5 py-0.2 text-[10px] dark:bg-slate-700">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Flashcard Area */}
      {currentCard ? (
        <div className="space-y-6">
          <div
            onClick={handleFlip}
            className="group relative min-h-[360px] cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-md transition-all hover:border-blue-400 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500 sm:p-8"
          >
            {/* Top Card Badge & Box */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  {currentCard.category}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {currentCard.title}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Leitner Box Indicator */}
                <div className="flex items-center gap-1" title={`Leitner Box ${currentCardProgress.box} of 5`}>
                  {[1, 2, 3, 4, 5].map((b) => (
                    <div
                      key={b}
                      className={`h-2 w-3 rounded-xs transition-colors ${
                        b <= currentCardProgress.box
                          ? 'bg-blue-600 dark:bg-blue-400'
                          : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-mono font-semibold text-slate-400">
                  Box {currentCardProgress.box}
                </span>
              </div>
            </div>

            {/* Main Content (Front or Back) */}
            <div className="flex flex-col justify-center py-8">
              {!isFlipped ? (
                // FRONT
                <div className="space-y-4">
                  <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <BookOpen className="h-3.5 w-3.5" />
                    {t.question.objective}
                  </span>
                  <p className="text-lg font-semibold leading-relaxed text-slate-900 dark:text-slate-100 sm:text-xl">
                    {currentCard.front}
                  </p>
                </div>
              ) : (
                // BACK
                <div className="space-y-4">
                  <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t.question.whyCorrect}
                  </span>
                  <div className="whitespace-pre-line text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                    {currentCard.back}
                  </div>

                  {currentCard.keyTakeaway && (
                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-blue-900 dark:border-blue-950 dark:bg-blue-950/40 dark:text-blue-200">
                      <span className="font-bold">{t.question.coreRule}: </span>
                      {currentCard.keyTakeaway}
                    </div>
                  )}

                  {currentCard.commonTrap && (
                    <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3.5 text-xs text-amber-900 dark:border-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
                      <span className="flex items-center gap-1 font-bold">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        {t.question.trapWarning}:
                      </span>
                      <p className="mt-1">{currentCard.commonTrap}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Flip Prompt */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
              <span className="flex items-center gap-1.5">
                <RotateCw className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
                {t.flashcards.pressSpace}
              </span>
              <span>
                {t.flashcards.reviewedTimes.replace('{count}', String(currentCardProgress.reviewsCount))}
              </span>
            </div>
          </div>

          {/* Action / Spaced Repetition Rating Buttons */}
          {isFlipped ? (
            <div className="space-y-2">
              <p className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t.flashcards.rateRecall}
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => handleRate('again')}
                  className="flex flex-col items-center justify-center min-h-[56px] rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-rose-900 shadow-xs hover:bg-rose-100 hover:border-rose-300 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/60 transition-all active:scale-95 touch-manipulation"
                >
                  <span className="text-xs font-bold">{t.flashcards.again}</span>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400">{t.flashcards.resetBox}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRate('hard')}
                  className="flex flex-col items-center justify-center min-h-[56px] rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-amber-900 shadow-xs hover:bg-amber-100 hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60 transition-all active:scale-95 touch-manipulation"
                >
                  <span className="text-xs font-bold">{t.flashcards.hard}</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">{t.flashcards.keepBox}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRate('good')}
                  className="flex flex-col items-center justify-center min-h-[56px] rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-blue-900 shadow-xs hover:bg-blue-100 hover:border-blue-300 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-950/60 transition-all active:scale-95 touch-manipulation"
                >
                  <span className="text-xs font-bold">{t.flashcards.good}</span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400">{t.flashcards.advanceBox}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRate('easy')}
                  className="flex flex-col items-center justify-center min-h-[56px] rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-900 shadow-xs hover:bg-emerald-100 hover:border-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60 transition-all active:scale-95 touch-manipulation"
                >
                  <span className="text-xs font-bold">{t.flashcards.easy}</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">+2 Boxes</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center justify-center gap-1 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-all active:scale-95 touch-manipulation"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>{t.flashcards.previousCard}</span>
              </button>

              <button
                type="button"
                onClick={handleFlip}
                className="flex items-center justify-center gap-2 min-h-[44px] rounded-lg bg-blue-600 px-5 sm:px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-all active:scale-95 touch-manipulation"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span>{t.flashcards.flipCard}</span>
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="flex items-center justify-center gap-1 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-all active:scale-95 touch-manipulation"
              >
                <span>{t.flashcards.nextCard}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Sparkles className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="mt-3 text-base font-bold text-slate-800 dark:text-slate-200">{t.flashcards.noCards}</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Try selecting another category above.</p>
        </div>
      )}

    </div>
  );
};
