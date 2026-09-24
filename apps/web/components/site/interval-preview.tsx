'use client';

import { describeInterval, formatInterval } from '@recallify/core';
import {
  DEFAULT_PARAMS,
  clamp,
  initialDifficulty,
  initialStability,
  intervalFromRetention,
  nextDifficulty,
  nextRecallStability,
  retrievability,
} from '@recallify/fsrs';
import { motion } from 'motion/react';
import { EASE } from '@/components/motion';

/**
 * The gaps between the first reviews of a card answered "Good" every time, at
 * the default target. Computed by the engine, not typed in, so the page cannot
 * drift away from what the product will actually do.
 */
function firstIntervals(count: number): number[] {
  const params = DEFAULT_PARAMS;
  let stability = initialStability(params, 3);
  let difficulty = clamp(initialDifficulty(params, 3), 1, 10);
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const interval = Math.max(
      1,
      Math.round(intervalFromRetention(params, stability, 0.9)),
    );
    out.push(interval);
    const recalledAt = retrievability(params, interval, stability);
    stability = nextRecallStability(params, difficulty, stability, recalledAt, 3);
    difficulty = clamp(nextDifficulty(params, difficulty, 3), 1, 10);
  }
  return out;
}

export function IntervalPreview({ count = 6 }: { count?: number }) {
  const intervals = firstIntervals(count);
  const total = intervals.reduce((sum, days) => sum + days, 0);
  // Bar lengths are on a log scale: the last gap is some hundred times the
  // first, and on a linear scale the early ones would be invisible slivers.
  const top = Math.log(1 + Math.max(...intervals));

  return (
    <div className="rounded-lg border border-line bg-paper p-5 sm:p-7">
      <div className="flex items-baseline justify-between gap-4">
        <span className="eyebrow">One card, answered Good each time</span>
        <span className="tabular text-caption text-ink-muted">target 90%</span>
      </div>

      <motion.ol
        initial="hidden"
        whileInView="shown"
        viewport={{ once: true, margin: '0px 0px -10% 0px' }}
        variants={{
          hidden: {},
          shown: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
        }}
        className="mt-6 flex flex-col gap-4"
      >
        {intervals.map((days, i) => (
          <motion.li
            key={i}
            variants={{
              hidden: { opacity: 0, x: -20 },
              shown: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE } },
            }}
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-ui text-ink-muted">
                {i === 0 ? 'After you learn it' : `After review ${i}`}
              </span>
              <span className="tabular text-body text-ink">{formatInterval(days)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-alt">
              <motion.div
                className="h-full origin-left rounded-full bg-accent"
                variants={{
                  hidden: { scaleX: 0 },
                  shown: {
                    scaleX: Math.max(0.04, Math.log(1 + days) / top),
                    transition: { duration: 1.1, ease: EASE, delay: 0.1 },
                  },
                }}
              />
            </div>
          </motion.li>
        ))}
      </motion.ol>

      <p className="mt-6 border-t border-line pt-4 text-ui text-ink-muted">
        Six reviews carry this card{' '}
        <span className="tabular text-ink">{describeInterval(total)}</span>. Answer one
        wrong and the next gap collapses back to minutes.
      </p>
    </div>
  );
}
