'use client';

import { formatInterval } from '@recallify/core';
import {
  DAY_MS,
  DEFAULT_CONFIG,
  newCard,
  schedule,
  type Rating,
  type SchedulingCard,
} from '@recallify/fsrs';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { EASE } from '@/components/motion';
import { cn } from '@/lib/cn';

const RATINGS = [
  { rating: 1, label: 'Again' },
  { rating: 2, label: 'Hard' },
  { rating: 3, label: 'Good' },
  { rating: 4, label: 'Easy' },
] as const;

interface Step {
  id: number;
  label: string;
  gapDays: number;
}

const START = new Date('2026-01-01T09:00:00Z');

function gapDays(from: Date, card: SchedulingCard): number {
  return (card.dueAt.getTime() - from.getTime()) / DAY_MS;
}

/**
 * One real card, scheduled by the real engine, with the clock skipped forward
 * to each due date so a visitor can feel a month of reviews in ten seconds.
 * Nothing is scripted: answer "Again" and the gap collapses, because that is
 * what the scheduler does.
 */
export function TryCard() {
  const [card, setCard] = useState<SchedulingCard>(() => newCard(START));
  const [now, setNow] = useState(START);
  const [revealed, setRevealed] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  const answer = (rating: Rating, label: string) => {
    const next = schedule(card, rating, now, DEFAULT_CONFIG).card;
    setSteps((s) =>
      [
        ...s,
        { id: (s[s.length - 1]?.id ?? 0) + 1, label, gapDays: gapDays(now, next) },
      ].slice(-6),
    );
    setCard(next);
    // Jump to the moment the card comes back.
    setNow(next.dueAt);
    setRevealed(false);
  };

  const reset = () => {
    setCard(newCard(START));
    setNow(START);
    setSteps([]);
    setRevealed(false);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:gap-12">
      <div>
        <div className="[perspective:1400px]">
          <motion.button
            type="button"
            onClick={() => setRevealed(true)}
            aria-label={revealed ? 'Answer shown' : 'Show the answer'}
            className="grid w-full cursor-pointer text-left [transform-style:preserve-3d]"
            initial={false}
            animate={{ rotateY: revealed ? 180 : 0 }}
            whileHover={revealed ? {} : { y: -4 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            <span className="flip-face col-start-1 row-start-1 flex min-h-[240px] flex-col justify-between rounded-lg bg-surface p-6 text-ink sm:min-h-[280px] sm:p-9">
              <span className="eyebrow">
                {card.reps === 0 ? 'Question' : `Question, review ${card.reps + 1}`}
              </span>
              <span className="font-display text-[clamp(22px,3.4vw,34px)] font-medium leading-[1.15]">
                In FSRS, what does the stability of a card measure?
              </span>
              <span className="text-caption text-ink-muted">
                Click the card to turn it over
              </span>
            </span>
            <span className="flip-face col-start-1 row-start-1 flex min-h-[240px] flex-col justify-between rounded-lg bg-surface p-6 text-ink [transform:rotateY(180deg)] sm:min-h-[280px] sm:p-9">
              <span className="eyebrow">Answer</span>
              <span className="font-display text-[clamp(22px,3.4vw,34px)] font-medium leading-[1.15]">
                The number of days it takes for your chance of recalling it to fall from
                100% to 90%.
              </span>
              <span className="text-caption text-ink-muted">
                Now say how well you knew it
              </span>
            </span>
          </motion.button>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
          {RATINGS.map(({ rating, label }) => {
            const preview = gapDays(
              now,
              schedule(card, rating, now, DEFAULT_CONFIG).card,
            );
            return (
              <motion.button
                key={label}
                type="button"
                disabled={!revealed}
                onClick={() => answer(rating, label)}
                whileTap={{ scale: 0.95 }}
                animate={{ opacity: revealed ? 1 : 0.55, y: revealed ? 0 : 6 }}
                transition={{
                  duration: 0.4,
                  ease: EASE,
                  delay: revealed ? rating * 0.05 : 0,
                }}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-0.5 rounded-md border border-on-brand/30 text-on-brand',
                  'transition-colors duration-200 enabled:hover:bg-on-brand enabled:hover:text-brand disabled:cursor-not-allowed',
                )}
              >
                <span className="text-ui font-medium">{label}</span>
                <span className="tabular text-caption opacity-70">
                  {formatInterval(preview)}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col">
        <p className="eyebrow text-on-brand/60!">What the scheduler did</p>
        {steps.length === 0 ? (
          <p className="mt-3 text-ui text-on-brand/70">
            Turn the card, pick an answer, and the next gap appears here. Keep answering
            Good and watch the gaps stretch. Answer Again once and see what it costs.
          </p>
        ) : (
          <ol className="mt-3 flex flex-col">
            <AnimatePresence initial={false}>
              {steps.map((step) => (
                <motion.li
                  key={step.id}
                  layout
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="flex items-baseline justify-between border-b border-on-brand/15 py-2.5"
                >
                  <span className="text-ui text-on-brand/70">{step.label}</span>
                  <span className="tabular text-body text-on-brand">
                    back in {formatInterval(step.gapDays)}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
        {steps.length > 0 ? (
          <button
            type="button"
            onClick={reset}
            className="mt-4 self-start text-caption text-on-brand/70 underline underline-offset-4 hover:text-on-brand"
          >
            Start over with a new card
          </button>
        ) : null}
      </div>
    </div>
  );
}
