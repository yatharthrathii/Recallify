'use client';

import { describeInterval, formatInterval, formatPercent } from '@recallify/core';
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
import { useState } from 'react';
import {
  ForgettingCurve,
  type CurveMarker,
  type CurvePoint,
} from '@/components/curve/forgetting-curve';
import { Slider } from '@/components/ui/controls';

const REVIEWS = 5;
const SAMPLES_PER_SEGMENT = 28;

/**
 * One card, answered "Good" every time, reviewed exactly when recall falls to
 * the target. Nothing here is drawn by hand: it is the real engine, the same
 * package the server schedules with, running in the visitor's browser.
 */
function simulate(target: number) {
  const params = DEFAULT_PARAMS;
  let stability = initialStability(params, 3);
  let difficulty = clamp(initialDifficulty(params, 3), 1, 10);
  let day = 0;

  const points: CurvePoint[] = [];
  const markers: CurveMarker[] = [{ day: 0, rating: 3, retrievabilityBefore: 0 }];
  const intervals: number[] = [];

  for (let review = 0; review < REVIEWS; review += 1) {
    const interval = Math.max(
      1,
      Math.round(intervalFromRetention(params, stability, target)),
    );
    intervals.push(interval);

    for (let i = 0; i <= SAMPLES_PER_SEGMENT; i += 1) {
      const t = (interval * i) / SAMPLES_PER_SEGMENT;
      points.push({ day: day + t, retrievability: retrievability(params, t, stability) });
    }

    day += interval;
    if (review === REVIEWS - 1) break;

    const recalledAt = retrievability(params, interval, stability);
    markers.push({ day, rating: 3, retrievabilityBefore: recalledAt });
    // Stability from the difficulty before this review, as the model defines it.
    stability = nextRecallStability(params, difficulty, stability, recalledAt, 3);
    difficulty = clamp(nextDifficulty(params, difficulty, 3), 1, 10);
  }

  return { points, markers, intervals, totalDays: day };
}

export function DemoCurve() {
  const [target, setTarget] = useState(0.9);
  const sim = simulate(target);

  return (
    <div className="rounded-lg border border-line bg-surface p-4 sm:p-6">
      <div className="mb-1 flex items-baseline justify-between gap-4">
        <span className="eyebrow">One card, five reviews</span>
        <span className="tabular text-caption text-ink-muted">
          live, computed in your browser
        </span>
      </div>

      <ForgettingCurve
        points={sim.points}
        markers={sim.markers}
        desiredRetention={target}
        xLabel="Days since the card was learned. The axis is compressed towards the right."
        height={280}
        // Fixed, so moving the slider visibly deepens the teeth rather than
        // rescaling the chart around them.
        yMin={0.7}
        xScale="sqrt"
        summary={`A forgetting curve for one card reviewed five times at a ${formatPercent(target)} retention target.`}
      />

      <div className="mt-5 grid gap-5 border-t border-line pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-ui font-medium text-ink">Retention target</span>
            <span className="tabular text-ui text-ink">{formatPercent(target)}</span>
          </div>
          <Slider
            label="Retention target"
            value={Math.round(target * 100)}
            min={75}
            max={97}
            step={1}
            onChange={(v) => setTarget(v / 100)}
          />
        </div>
        <p className="text-ui text-ink-muted sm:max-w-[240px] sm:text-right">
          Reviews land{' '}
          <span className="tabular text-ink">
            {sim.intervals.map(formatInterval).join(', ')}
          </span>{' '}
          apart. Five reviews carry this card{' '}
          <span className="tabular text-ink">{describeInterval(sim.totalDays)}</span>.
        </p>
      </div>
    </div>
  );
}
