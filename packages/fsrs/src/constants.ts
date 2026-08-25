import type { FsrsConfig, FsrsParams } from './types';

/**
 * Published FSRS-6 default weights (21 parameters).
 *
 * These are the population-average fit. @recallify/optimizer replaces them with
 * per-user values once a user has enough review history; measuring that
 * difference is what the backtest is for.
 *
 * Verified against ts-fsrs 5.4.1 (FSRS-6.0) in test/differential.test.ts.
 */
export const DEFAULT_PARAMS: FsrsParams = Object.freeze([
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666,
  0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658,
  0.1542,
]);

/** Stability is measured in days and is never allowed to reach zero. */
export const S_MIN = 0.001;
export const S_MAX = 36500;

/** First-review stability is capped harder than later stability. */
export const INIT_S_MAX = 100;

export const D_MIN = 1;
export const D_MAX = 10;

/** The retention the forgetting curve is anchored at: R(S, S) = 0.9. */
export const CURVE_ANCHOR = 0.9;

export const DEFAULT_CONFIG: FsrsConfig = Object.freeze({
  params: DEFAULT_PARAMS,
  desiredRetention: 0.9,
  maximumInterval: S_MAX,
  learningSteps: Object.freeze([1, 10]),
  relearningSteps: Object.freeze([10]),
  fuzzFactor: 0.05,
});

/**
 * Read one weight.
 *
 * `noUncheckedIndexedAccess` is on, so an out-of-range index would otherwise
 * silently become `undefined` and propagate as NaN through the whole model.
 * A short-parameter array is a programming error, so it throws.
 */
export function w(params: FsrsParams, index: number): number {
  const value = params[index];
  if (value === undefined) {
    throw new RangeError(`FSRS parameter w[${index}] is missing`);
  }
  return value;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export const clampStability = (s: number): number => clamp(s, S_MIN, S_MAX);
export const clampDifficulty = (d: number): number => clamp(d, D_MIN, D_MAX);
