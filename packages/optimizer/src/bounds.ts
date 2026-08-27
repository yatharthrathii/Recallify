import type { FsrsParams } from '@recallify/fsrs';

/**
 * Valid range for each of the 21 FSRS-6 parameters.
 *
 * Derived empirically from the reference implementation rather than copied from
 * a table: each parameter was pushed to ±1e6 through ts-fsrs `clipParameters`
 * and the value it settled at was recorded. Reading the exported bounds table
 * directly gave [0, 0.1542] for w[17], which cannot be right — the published
 * default for w[17] is 0.5425, outside it.
 *
 * The optimizer clamps to these after every step. Without them, gradient
 * descent will happily drive a weight negative and produce a model that
 * predicts recall probabilities above 1.
 */
export const PARAM_BOUNDS: readonly (readonly [number, number])[] = Object.freeze([
  [0.001, 100], // w0   initial stability, Again
  [0.001, 100], // w1   initial stability, Hard
  [0.001, 100], // w2   initial stability, Good
  [0.001, 100], // w3   initial stability, Easy
  [1, 10], // w4   initial difficulty base
  [0.001, 4], // w5   initial difficulty falloff
  [0.001, 4], // w6   difficulty step per rating
  [0.001, 0.75], // w7   mean-reversion strength
  [0, 4.5], // w8   recall stability scale
  [0, 0.8], // w9   diminishing returns on stability
  [0, 3.5], // w10  spacing-effect strength
  [0.001, 5], // w11  post-lapse scale
  [0.001, 0.25], // w12  post-lapse difficulty falloff
  [0.001, 0.9], // w13  post-lapse stability falloff
  [0, 4], // w14  post-lapse retrievability term
  [0, 1], // w15  Hard penalty
  [1, 6], // w16  Easy bonus
  [0, 2], // w17  same-day rating scale
  [0, 2], // w18  same-day rating offset
  [0.01, 0.8], // w19  same-day diminishing returns
  [0.1, 0.8], // w20  forgetting-curve decay
]);

function bound(index: number): readonly [number, number] {
  const b = PARAM_BOUNDS[index];
  if (b === undefined) throw new RangeError(`No bounds defined for w[${index}]`);
  return b;
}

/** Width of a parameter's range. Used to scale gradient steps and probe sizes. */
export function paramRange(index: number): number {
  const [min, max] = bound(index);
  return max - min;
}

/** Force every parameter back inside its valid range. */
export function clampParams(params: readonly number[]): FsrsParams {
  return params.map((value, index) => {
    const [min, max] = bound(index);
    // A NaN can appear if a probe pushes the model somewhere degenerate; fall
    // back to the midpoint rather than poisoning every later iteration.
    if (!Number.isFinite(value)) return (min + max) / 2;
    return Math.min(Math.max(value, min), max);
  });
}

/** True when every parameter is finite and inside its range. */
export function withinBounds(params: readonly number[]): boolean {
  if (params.length !== PARAM_BOUNDS.length) return false;
  return params.every((value, index) => {
    const [min, max] = bound(index);
    return Number.isFinite(value) && value >= min && value <= max;
  });
}
