'use client';

import { formatDayShort } from '@recallify/core';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

interface Day {
  date: string;
  due: number;
}

/**
 * Cards falling due over the coming days.
 *
 * Neutral ink, not the memory scale: these bars count cards, they do not say
 * how well anything is remembered, and borrowing those hues here would make
 * them mean nothing on the curve.
 */
export function ForecastBars({
  days,
  height = 120,
  className,
}: {
  days: readonly Day[];
  height?: number;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const peak = Math.max(1, ...days.map((d) => d.due));
  const total = days.reduce((sum, d) => sum + d.due, 0);
  const shown = active !== null ? days[active] : undefined;

  return (
    <div className={className}>
      <div
        role="img"
        aria-label={`Forecast. ${total} cards fall due over the next ${days.length} days, at most ${peak} in one day.`}
        className="flex items-end gap-0.75"
        style={{ height }}
        onPointerLeave={() => setActive(null)}
      >
        {days.map((day, i) => (
          <div
            key={day.date}
            className="flex h-full min-w-0 flex-1 items-end"
            onPointerEnter={() => setActive(i)}
          >
            <motion.div
              initial={reduced ? false : { scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.8,
                delay: 0.1 + i * 0.03,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                height: `${Math.max(day.due > 0 ? 3 : 1, (day.due / peak) * 100)}%`,
              }}
              className={cn(
                'w-full origin-bottom rounded-t-[3px] transition-colors duration-200',
                day.due === 0 ? 'bg-line-strong' : i === 0 ? 'bg-ink' : 'bg-ink/45',
                active === i && 'bg-accent',
              )}
            />
          </div>
        ))}
      </div>

      <div className="mt-1.5 flex justify-between text-[10px] text-ink-faint" aria-hidden>
        <span className="tabular">today</span>
        <span className="tabular">
          {days.length > 0
            ? formatDayShort(new Date(`${days[days.length - 1]!.date}T00:00:00Z`))
            : ''}
        </span>
      </div>

      <p className="mt-1 min-h-5 text-caption text-ink-muted" aria-live="polite">
        {shown ? (
          <>
            <span className="tabular text-ink">
              {active === 0
                ? 'Today'
                : formatDayShort(new Date(`${shown.date}T00:00:00Z`))}
            </span>
            : <span className="tabular text-ink">{shown.due}</span> due
          </>
        ) : (
          <>
            <span className="tabular text-ink">{total}</span> due over {days.length} days,
            if nothing new is added.
          </>
        )}
      </p>
    </div>
  );
}
