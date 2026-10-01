'use client';

import { formatCount, formatPercent } from '@recallify/core';
import { memoryLevel } from '@recallify/tokens';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { LEVEL_BG_CLASS } from '@/components/ui/misc';
import { cn } from '@/lib/cn';

interface Bucket {
  label: string;
  reviews: number;
  retention: number | null;
}


/**
 * Reviews by hour or by weekday. The same two encodings as the heatmap, kept
 * apart: height is how much was reviewed then, colour is how much of it was
 * recalled. A bar with no recall rate (only first reviews) is neutral ink.
 */
export function PatternBars({
  buckets,
  height = 120,
  labelEvery = 1,
  summary,
  className,
}: {
  buckets: readonly Bucket[];
  height?: number;
  /** Show every nth label, for the 24-hour chart. */
  labelEvery?: number;
  summary: string;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const peak = Math.max(1, ...buckets.map((b) => b.reviews));
  const shown = active === null ? undefined : buckets[active];

  return (
    <div className={className}>
      <div
        role="img"
        aria-label={summary}
        className="flex items-end gap-0.75"
        style={{ height }}
        onPointerLeave={() => setActive(null)}
      >
        {buckets.map((bucket, i) => (
          <div
            key={bucket.label}
            className="flex h-full min-w-0 flex-1 items-end"
            onPointerEnter={() => setActive(i)}
          >
            <motion.div
              initial={reduced ? false : { scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1 + i * 0.025, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: `${Math.max(bucket.reviews > 0 ? 4 : 1.5, (bucket.reviews / peak) * 100)}%` }}
              className={cn(
                'w-full origin-bottom rounded-t-[3px] transition-opacity duration-200',
                bucket.reviews === 0
                  ? 'bg-line-strong'
                  : bucket.retention === null
                    ? 'bg-ink/45'
                    : LEVEL_BG_CLASS[memoryLevel(bucket.retention)],
                active !== null && active !== i && 'opacity-55',
              )}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-0.75 text-[10px] text-ink-faint" aria-hidden>
        {buckets.map((bucket, i) => (
          <span key={bucket.label} className="min-w-0 flex-1 truncate text-center">
            {i % labelEvery === 0 ? bucket.label : ''}
          </span>
        ))}
      </div>
      <p className="mt-1 min-h-5 text-caption text-ink-muted" aria-live="polite">
        {shown ? (
          <>
            <span className="text-ink">{shown.label}</span>:{' '}
            <span className="tabular text-ink">{formatCount(shown.reviews)}</span> reviews
            {shown.retention !== null ? (
              <>
                , <span className="tabular text-ink">{formatPercent(shown.retention)}</span> recalled
              </>
            ) : shown.reviews > 0 ? (
              ', all first reviews'
            ) : null}
          </>
        ) : (
          'Height is how much you reviewed then; colour is how much of it you recalled.'
        )}
      </p>
    </div>
  );
}
