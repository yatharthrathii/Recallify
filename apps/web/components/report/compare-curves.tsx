'use client';

import { formatPercent } from '@recallify/core';
import { line } from 'd3-shape';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

interface Point {
  day: number;
  retrievability: number;
}

interface Props {
  yours: readonly Point[];
  population: readonly Point[];
  yoursLabel: string;
  height?: number;
  className?: string;
}

const MARGIN = { top: 16, right: 12, bottom: 28, left: 38 };
const Y_MIN = 0.5;

/**
 * Two forgetting curves on one chart: one new card, answered Good once,
 * under this user's parameters and under the published ones. The gap
 * between the lines is the whole finding, so nothing else is drawn on it.
 */
export function CompareCurves({ yours, population, yoursLabel, height = 220, className }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const clipId = useId();
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const maxDay = Math.max(1, yours[yours.length - 1]?.day ?? 1);
  const x = (day: number) => MARGIN.left + (day / maxDay) * innerW;
  const y = (r: number) => MARGIN.top + (1 - (Math.max(Y_MIN, r) - Y_MIN) / (1 - Y_MIN)) * innerH;
  const path = line<Point>()
    .x((p) => x(p.day))
    .y((p) => y(p.retrievability));

  const xTicks = [0, 7, 14, 30, 45, 60].filter((t) => t <= maxDay);
  const yTicks = [0.5, 0.6, 0.7, 0.8, 0.9, 1];
  const at = cursor === null ? null : Math.round((cursor / innerW) * maxDay);
  const pick = (points: readonly Point[]) =>
    at === null ? null : (points.find((p) => p.day === at) ?? null);
  const yourPoint = pick(yours);
  const popPoint = pick(population);

  return (
    <div ref={frame} className={cn('w-full', className)}>
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Predicted recall of a new card over ${maxDay} days: ${yoursLabel} against the published average.`}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = e.clientX - rect.left - MARGIN.left;
            setCursor(px >= 0 && px <= innerW ? px : null);
          }}
          onPointerLeave={() => setCursor(null)}
          className="overflow-visible"
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={MARGIN.left} y={MARGIN.top} width={innerW} height={innerH} />
            </clipPath>
          </defs>

          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={MARGIN.left}
                x2={MARGIN.left + innerW}
                y1={y(t)}
                y2={y(t)}
                className={cn('stroke-line', t === 0.9 && 'stroke-line-strong')}
                strokeDasharray={t === 0.9 ? '3 3' : undefined}
              />
              <text
                x={MARGIN.left - 6}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-ink-faint text-[10px]"
              >
                {formatPercent(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text
              key={t}
              x={x(t)}
              y={height - 8}
              textAnchor="middle"
              className="fill-ink-faint text-[10px]"
            >
              {t === 0 ? 'day 0' : t}
            </text>
          ))}

          <g clipPath={`url(#${clipId})`}>
            <motion.path
              d={path(population as Point[]) ?? ''}
              fill="none"
              className="stroke-ink-faint"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              initial={reduced ? false : { pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.path
              d={path(yours as Point[]) ?? ''}
              fill="none"
              className="stroke-accent"
              strokeWidth={2.25}
              strokeLinecap="round"
              initial={reduced ? false : { pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            />
          </g>

          {at !== null && yourPoint && popPoint ? (
            <g>
              <line
                x1={x(at)}
                x2={x(at)}
                y1={MARGIN.top}
                y2={MARGIN.top + innerH}
                className="stroke-line-strong"
              />
              <circle cx={x(at)} cy={y(yourPoint.retrievability)} r={4} className="fill-accent" />
              <circle cx={x(at)} cy={y(popPoint.retrievability)} r={3.5} className="fill-ink-faint" />
            </g>
          ) : null}
        </svg>
      ) : (
        <div style={{ height }} />
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-caption text-ink-muted">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-5 rounded-full bg-accent" />
          {yoursLabel}
          {yourPoint ? <span className="tabular text-ink">{formatPercent(yourPoint.retrievability)}</span> : null}
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-5 rounded-full border-t border-dashed border-ink-faint" />
          Published average
          {popPoint ? <span className="tabular text-ink">{formatPercent(popPoint.retrievability)}</span> : null}
        </span>
        {at !== null ? <span className="tabular">day {at}</span> : <span>Hover for a day</span>}
      </div>
    </div>
  );
}
