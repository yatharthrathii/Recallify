'use client';

import { formatInterval } from '@recallify/core';
import { motion } from 'motion/react';
import { EASE } from '@/components/motion';

/**
 * The growing gaps between reviews, as bars. Lengths are on a log scale:
 * the last gap is some sixty times the first, and on a linear scale the first
 * four would be slivers.
 */
export function IntervalLadder({ intervals }: { intervals: readonly number[] }) {
  const top = Math.log(1 + Math.max(...intervals));

  return (
    <motion.ol
      initial="hidden"
      animate="shown"
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: 0.14, delayChildren: 0.5 } },
      }}
      className="mt-10 flex max-w-[460px] flex-col gap-4"
    >
      {intervals.map((days, i) => (
        <motion.li
          key={i}
          variants={{
            hidden: { opacity: 0, x: -24 },
            shown: { opacity: 1, x: 0, transition: { duration: 0.7, ease: EASE } },
          }}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-ui text-on-brand/70">
              {i === 0 ? 'After you learn it' : `After review ${i}`}
            </span>
            <span className="tabular text-body text-on-brand">
              {formatInterval(days)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-on-brand/15">
            <motion.div
              className="h-full origin-left rounded-full bg-on-brand"
              variants={{
                hidden: { scaleX: 0 },
                shown: {
                  scaleX: Math.max(0.04, Math.log(1 + days) / top),
                  transition: { duration: 1.2, ease: EASE, delay: 0.15 },
                },
              }}
            />
          </div>
        </motion.li>
      ))}
    </motion.ol>
  );
}
