'use client';

import { formatDate, formatPercent } from '@recallify/core';
import { memoryLevel, type MemoryLevel } from '@recallify/tokens';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

interface Day {
  date: string;
  reviews: number;
  retention: number | null;
}

const DAY_MS = 86_400_000;
const GAP = 3;
const MIN_CELL = 11;
const MAX_CELL = 18;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const LEVEL_BG: Record<MemoryLevel, string> = {
  strong: 'bg-mem-strong',
  good: 'bg-mem-good',
  fading: 'bg-mem-fading',
  weak: 'bg-mem-weak',
  lost: 'bg-mem-lost',
};

/** How much was done that day, in four steps relative to the busiest day. */
function intensity(reviews: number, busiest: number): string {
  const share = reviews / Math.max(1, busiest);
  if (share > 0.66) return 'opacity-100';
  if (share > 0.33) return 'opacity-75';
  if (share > 0.1) return 'opacity-55';
  return 'opacity-35';
}

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * A year of study.
 *
 * Two things are encoded, and they are kept apart: hue is how well the day
 * went (recall rate, on the memory scale), strength of colour is how much was
 * done. A day of only new cards has no recall rate, so it is drawn in neutral
 * ink rather than pretending to a score. The readout under the grid says all
 * of it in words, so the colour is never the only signal.
 */
export function Heatmap({ days, weeks = 53 }: { days: readonly Day[]; weeks?: number }) {
  const [active, setActive] = useState<Day | null>(null);
  const [cell, setCell] = useState(MIN_CELL);
  const scroller = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Cells grow to fill a wide container and stop shrinking at a size a finger
  // can still hit. Below that the grid scrolls, starting at the recent end.
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const fit = () => {
      const size = Math.floor((node.clientWidth + GAP) / weeks) - GAP;
      setCell(Math.min(MAX_CELL, Math.max(MIN_CELL, size)));
      node.scrollLeft = node.scrollWidth;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [weeks]);

  const byDate = new Map(days.map((d) => [d.date, d]));
  const busiest = days.reduce((max, d) => Math.max(max, d.reviews), 0);

  // Columns are weeks, Sunday at the top, ending with the current week.
  const today = utcDay(new Date());
  const lastSunday = new Date(today.getTime() - today.getUTCDay() * DAY_MS);
  const start = new Date(lastSunday.getTime() - (weeks - 1) * 7 * DAY_MS);

  const columns: { date: Date; key: string }[][] = [];
  for (let w = 0; w < weeks; w += 1) {
    const column: { date: Date; key: string }[] = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(start.getTime() + (w * 7 + d) * DAY_MS);
      if (date <= today) column.push({ date, key: date.toISOString().slice(0, 10) });
    }
    columns.push(column);
  }

  const total = days.reduce((sum, d) => sum + d.reviews, 0);
  const activeDays = days.filter((d) => d.reviews > 0).length;

  return (
    <div>
      <div ref={scroller} className="scroll-quiet overflow-x-auto pb-2">
        <div className="inline-block">
          <div className="mb-1.5 flex" style={{ gap: GAP }} aria-hidden>
            {columns.map((column, w) => {
              const first = column[0]?.date;
              const label =
                first && first.getUTCDate() <= 7 ? MONTHS[first.getUTCMonth()] : '';
              return (
                <span
                  key={w}
                  className="text-[10px] leading-3 text-ink-faint"
                  style={{ width: cell }}
                >
                  {label}
                </span>
              );
            })}
          </div>

          <div
            role="img"
            aria-label={`Study activity. ${total} reviews across ${activeDays} days in the last year.`}
            className="flex"
            style={{ gap: GAP }}
            onPointerLeave={() => setActive(null)}
          >
            {columns.map((column, w) => (
              <div key={w} className="flex flex-col" style={{ gap: GAP }}>
                {column.map(({ key }, d) => {
                  const day = byDate.get(key);
                  const reviews = day?.reviews ?? 0;
                  const retention = day?.retention ?? null;
                  return (
                    <motion.div
                      key={key}
                      initial={reduced ? false : { opacity: 0, scale: 0.2 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      // A wave across the year, left to right and top to bottom,
                      // finished in about a second however wide the grid is.
                      transition={{
                        duration: 0.45,
                        delay: w * 0.016 + d * 0.012,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      style={{ width: cell, height: cell }}
                      className="rounded-[2px] bg-surface-alt"
                      onPointerEnter={() =>
                        setActive(day ?? { date: key, reviews: 0, retention: null })
                      }
                    >
                      {reviews > 0 ? (
                        <div
                          className={cn(
                            'size-full rounded-[2px]',
                            retention === null
                              ? 'bg-ink-faint'
                              : LEVEL_BG[memoryLevel(retention)],
                            intensity(reviews, busiest),
                          )}
                        />
                      ) : null}
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-2 min-h-5 text-caption text-ink-muted" aria-live="polite">
        {active ? (
          <>
            <span className="tabular text-ink">
              {formatDate(new Date(`${active.date}T00:00:00Z`))}
            </span>
            {active.reviews === 0
              ? ': no reviews'
              : `: ${active.reviews} review${active.reviews === 1 ? '' : 's'}${
                  active.retention === null
                    ? ', all new cards'
                    : `, ${formatPercent(active.retention)} recalled`
                }`}
          </>
        ) : (
          <>
            <span className="tabular text-ink">{total.toLocaleString('en-US')}</span>{' '}
            reviews on <span className="tabular text-ink">{activeDays}</span> days. Colour
            is the recall rate that day, strength is how much was reviewed.
          </>
        )}
      </p>
    </div>
  );
}
