'use client';

import { formatPercent } from '@recallify/core';
import { area, line } from 'd3-shape';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export interface CurvePoint {
  day: number;
  retrievability: number;
}

export interface CurveMarker {
  day: number;
  rating: number;
  retrievabilityBefore: number;
}

interface Props {
  points: readonly CurvePoint[];
  markers?: readonly CurveMarker[];
  desiredRetention: number;
  /** Where the curve meets the target, on the same axis as the points. */
  dueInDays?: number;
  xLabel: string;
  height?: number;
  className?: string;
  /** A sentence describing the chart, for screen readers. */
  summary: string;
  /**
   * Bottom of the y axis. A card kept at a 90% target never drops far below
   * it, so plotting from zero would leave most of the chart empty and the
   * sawtooth pressed flat against the top. The axis is labelled, so starting
   * it higher hides nothing.
   */
  yMin?: number;
  /**
   * 'sqrt' compresses the far end of the x axis. Intervals grow geometrically
   * (2 days, 11 days, 6 weeks, 5 months), so on a linear axis the first
   * reviews, which are the interesting ones, collapse into the left edge. The
   * ticks still carry real day counts.
   */
  xScale?: 'linear' | 'sqrt';
  /** Words before the day number where the curve meets the target. */
  crossingLabel?: string;
}

const RATING_NAME = ['', 'Again', 'Hard', 'Good', 'Easy'];
const MARGIN = { top: 18, right: 14, bottom: 30, left: 38 };

const SQRT_TICKS = [0, 1, 3, 7, 14, 30, 60, 90, 180, 365, 730, 1095, 1825, 3650];

/**
 * A bottom for the y axis that fits the data: a tenth below the lowest value
 * shown, rounded down to a tenth, and never above 80%. Keeps the line in the
 * middle of the plot instead of pressed against the top of it.
 */
export function fitYMin(points: readonly CurvePoint[], desiredRetention: number): number {
  let lowest = desiredRetention;
  for (const p of points) lowest = Math.min(lowest, p.retrievability);
  return Math.min(0.8, Math.max(0, Math.floor((lowest - 0.1) * 10) / 10));
}

/** Five or so round numbers across the x axis. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const rough = max / 5;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? rough;
  const ticks: number[] = [];
  for (let t = 0; t <= max + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100);
  return ticks;
}

function formatDay(day: number): string {
  if (day < 1 && day > 0) return `${Math.round(day * 24)}h`;
  return Number.isInteger(day) ? String(day) : day.toFixed(1);
}

/**
 * The forgetting curve.
 *
 * Built by hand on purpose. A chart library would draw this in its own accent
 * colour with its own tooltip, and it would look like every dashboard. Here
 * the stroke is a vertical gradient over the memory scale, so the colour of
 * the line at any height IS the retention at that height: the chart needs no
 * legend because it is its own legend.
 */
export function ForgettingCurve({
  points,
  markers = [],
  desiredRetention,
  dueInDays,
  xLabel,
  height = 240,
  className,
  summary,
  yMin = 0,
  xScale = 'linear',
  crossingLabel = 'due day',
}: Props) {
  const clipId = useId();
  const gradientId = useId();
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const [markerIndex, setMarkerIndex] = useState<number | null>(null);
  const reduced = useReducedMotion();

  // Measured rather than scaled with a viewBox, so text and hairlines stay
  // crisp at every width instead of stretching with the chart.
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (points.length < 2) {
    return (
      <div
        className={cn(
          'flex items-center rounded-md border border-dashed border-line-strong px-5 text-ui text-ink-muted',
          className,
        )}
        style={{ height }}
      >
        No curve yet. It is drawn from reviews, so it appears after the first one.
      </div>
    );
  }

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const lastDay = points[points.length - 1]?.day ?? 1;
  const maxDay = Math.max(lastDay, dueInDays ?? 0, 0.01);

  const norm = (day: number) => {
    const ratio = Math.min(1, Math.max(0, day / maxDay));
    return xScale === 'sqrt' ? Math.sqrt(ratio) : ratio;
  };
  const x = (day: number) => MARGIN.left + norm(day) * innerW;
  const y = (r: number) => MARGIN.top + (1 - (r - yMin) / (1 - yMin)) * innerH;

  // Five rules from the bottom of the axis to the top; every other one labelled.
  const yTicks = [0, 1, 2, 3, 4].map((i) => yMin + ((1 - yMin) * i) / 4);

  // On the compressed scale, take round day counts and drop any that would
  // print on top of the one before.
  const xTicks =
    xScale === 'sqrt'
      ? SQRT_TICKS.filter((t) => t <= maxDay).reduce<number[]>((kept, t) => {
          const last = kept[kept.length - 1];
          if (last === undefined || x(t) - x(last) >= 34) kept.push(t);
          return kept;
        }, [])
      : niceTicks(maxDay);

  const path =
    line<CurvePoint>()
      .x((p) => x(p.day))
      .y((p) => y(p.retrievability))(points as CurvePoint[]) ?? '';

  // The same samples closed down to the axis: a faint body under the line.
  const body =
    area<CurvePoint>()
      .x((p) => x(p.day))
      .y0(y(yMin))
      .y1((p) => y(Math.max(yMin, p.retrievability)))(points as CurvePoint[]) ?? '';

  // Nearest sample to a given day. The samples are evenly spaced and few, so a
  // scan is simpler than a bisector and just as fast.
  const nearest = (day: number): CurvePoint => {
    let best = points[0] as CurvePoint;
    for (const p of points)
      if (Math.abs(p.day - day) < Math.abs(best.day - day)) best = p;
    return best;
  };

  const focusedMarker = markerIndex !== null ? markers[markerIndex] : undefined;
  const probe = focusedMarker ? null : cursor !== null ? nearest(cursor) : null;

  const readout = focusedMarker
    ? `Review ${markerIndex! + 1} on day ${formatDay(focusedMarker.day)}: ${RATING_NAME[focusedMarker.rating] ?? ''}, recalled at ${formatPercent(focusedMarker.retrievabilityBefore)}`
    : probe
      ? `Day ${formatDay(Math.round(probe.day * 10) / 10)}: ${formatPercent(probe.retrievability)} likely to recall`
      : null;

  const endsAboveTarget =
    (points[points.length - 1]?.retrievability ?? 0) >= desiredRetention - 0.005;
  const showDue = dueInDays !== undefined && dueInDays > 0 && dueInDays <= maxDay;

  return (
    <figure className={cn('m-0', className)}>
      <div
        ref={frame}
        role="group"
        tabIndex={0}
        aria-label={`${summary} Use the left and right arrow keys to step through reviews.`}
        className="relative rounded-md outline-offset-4"
        style={{ height }}
        onKeyDown={(event) => {
          if (markers.length === 0) return;
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault();
            const step = event.key === 'ArrowRight' ? 1 : -1;
            setMarkerIndex((i) =>
              i === null
                ? step === 1
                  ? 0
                  : markers.length - 1
                : (i + step + markers.length) % markers.length,
            );
          }
          if (event.key === 'Escape') setMarkerIndex(null);
        }}
        onBlur={() => setMarkerIndex(null)}
      >
        {width > 0 ? (
          <svg
            width={width}
            height={height}
            className="block overflow-visible"
            aria-hidden
          >
            <defs>
              {/* Top of the plot is R = 1, bottom is R = 0. Each stop sits at
                  the boundary of a band on the memory scale. */}
              <linearGradient
                id={gradientId}
                gradientUnits="userSpaceOnUse"
                x1={0}
                y1={y(1)}
                x2={0}
                y2={y(0)}
              >
                <stop offset="0" style={{ stopColor: 'var(--memory-strong)' }} />
                <stop offset="0.1" style={{ stopColor: 'var(--memory-strong)' }} />
                <stop offset="0.25" style={{ stopColor: 'var(--memory-good)' }} />
                <stop offset="0.5" style={{ stopColor: 'var(--memory-fading)' }} />
                <stop offset="0.75" style={{ stopColor: 'var(--memory-weak)' }} />
                <stop offset="1" style={{ stopColor: 'var(--memory-lost)' }} />
              </linearGradient>
              {/* Anything below the bottom of the axis is cut, not drawn over the labels. */}
              <clipPath id={clipId}>
                <rect
                  x={MARGIN.left}
                  y={MARGIN.top - 4}
                  width={innerW}
                  height={innerH + 4}
                />
              </clipPath>
            </defs>

            {/* Horizontal rules and their labels. */}
            {yTicks.map((r, i) => (
              <g key={r}>
                <line
                  x1={MARGIN.left}
                  x2={MARGIN.left + innerW}
                  y1={y(r)}
                  y2={y(r)}
                  className={i === 0 ? 'stroke-line-strong' : 'stroke-line'}
                  strokeWidth={1}
                />
                {i % 2 === 0 ? (
                  <text
                    x={MARGIN.left - 8}
                    y={y(r)}
                    dy="0.32em"
                    textAnchor="end"
                    className="tabular fill-ink-faint text-[10px]"
                  >
                    {Math.round(r * 100)}%
                  </text>
                ) : null}
              </g>
            ))}

            {xTicks.map((t) => (
              <text
                key={t}
                x={x(t)}
                y={height - MARGIN.bottom + 16}
                textAnchor="middle"
                className="tabular fill-ink-faint text-[10px]"
              >
                {formatDay(t)}
              </text>
            ))}

            {/* The target. Where the curve meets it is the due date. */}
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + innerW}
              y1={y(desiredRetention)}
              y2={y(desiredRetention)}
              className="stroke-ink-muted"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
            <text
              x={MARGIN.left + innerW}
              // On whichever side of the line the curve is not: a sawtooth ends
              // above its target, a projection ends below it.
              y={y(desiredRetention) + (endsAboveTarget ? 13 : -6)}
              textAnchor="end"
              className="tabular fill-ink-muted text-[10px]"
            >
              target {formatPercent(desiredRetention)}
            </text>

            {showDue ? (
              <g>
                <line
                  x1={x(dueInDays)}
                  x2={x(dueInDays)}
                  y1={y(desiredRetention)}
                  y2={y(yMin)}
                  className="stroke-ink-muted"
                  strokeWidth={1}
                  strokeDasharray="3 4"
                />
                <circle
                  cx={x(dueInDays)}
                  cy={y(desiredRetention)}
                  r={3}
                  className="fill-ink"
                />
                <text
                  x={x(dueInDays)}
                  y={y(yMin) - 6}
                  dx={norm(dueInDays) > 0.8 ? -6 : 6}
                  textAnchor={norm(dueInDays) > 0.8 ? 'end' : 'start'}
                  className="tabular fill-ink-muted text-[10px]"
                >
                  {crossingLabel} {formatDay(Math.round(dueInDays * 10) / 10)}
                </text>
              </g>
            ) : null}

            {/* The body fades up behind the line once the line is mostly drawn. */}
            <motion.path
              d={body}
              clipPath={`url(#${clipId})`}
              fill={`url(#${gradientId})`}
              stroke="none"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 0.1 }}
              transition={{ duration: 0.9, delay: 0.9, ease: 'easeOut' }}
            />

            {/* Draws once, left to right, then stays still. */}
            <motion.path
              d={path}
              clipPath={`url(#${clipId})`}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={reduced ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, ease: [0.65, 0, 0.35, 1] }}
            />

            {/* Each review marker pops as the line reaches it. */}
            {markers.map((m, i) => (
              <motion.circle
                key={`${m.day}-${i}`}
                cx={x(m.day)}
                cy={y(i === 0 ? 1 : Math.max(yMin, m.retrievabilityBefore))}
                r={markerIndex === i ? 5.5 : 4}
                className={cn(
                  'fill-surface stroke-ink',
                  markerIndex === i && 'stroke-accent',
                )}
                strokeWidth={1.75}
                initial={reduced ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 420,
                  damping: 18,
                  delay: 0.25 + norm(m.day) * 1.1,
                }}
              />
            ))}

            {probe ? (
              <g pointerEvents="none">
                <line
                  x1={x(probe.day)}
                  x2={x(probe.day)}
                  y1={y(1)}
                  y2={y(yMin)}
                  className="stroke-ink-faint"
                  strokeWidth={1}
                />
                <circle
                  cx={x(probe.day)}
                  cy={y(Math.max(yMin, probe.retrievability))}
                  r={4}
                  className="fill-surface stroke-ink"
                  strokeWidth={1.5}
                />
              </g>
            ) : null}

            {/* Pointer surface. Touch works too: drag a finger along the curve. */}
            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={innerW}
              height={innerH}
              fill="transparent"
              className="touch-pan-y"
              onPointerMove={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                const ratio = Math.min(
                  1,
                  Math.max(0, (event.clientX - box.left) / box.width),
                );
                setMarkerIndex(null);
                setCursor((xScale === 'sqrt' ? ratio * ratio : ratio) * maxDay);
              }}
              onPointerLeave={() => setCursor(null)}
            />
          </svg>
        ) : null}
      </div>

      <figcaption className="mt-1 flex min-h-5 flex-wrap items-baseline justify-between gap-x-4 text-caption">
        <span aria-live="polite" className="tabular text-ink">
          {readout ?? <span className="text-ink-faint">{xLabel}</span>}
        </span>
        {readout ? <span className="text-ink-faint">{xLabel}</span> : null}
      </figcaption>
    </figure>
  );
}
