/**
 * The DSR memory model — the mathematical core of FSRS.
 *
 * Every function here is pure and total: same inputs, same output, no clock, no
 * randomness, no I/O. That is what lets the identical code decide scheduling on
 * the server, drive optimistic UI in the browser, and schedule offline on a
 * phone without the three ever disagreeing.
 *
 * FSRS is a published algorithm (DSR model; papers at ACM KDD and IEEE TKDE)
 * and is not original to this project. It is implemented here from the
 * published formulas, and test/differential.test.ts asserts agreement with
 * ts-fsrs across thousands of generated cases.
 */

import {
  CURVE_ANCHOR,
  D_MAX,
  INIT_S_MAX,
  S_MIN,
  clampDifficulty,
  clampStability,
  w,
} from './constants';
import type { FsrsParams, Rating } from './types';

/**
 * Exponent of the power forgetting curve. Stored as w[20] and applied negated,
 * because retention falls as time passes.
 */
export function decay(params: FsrsParams): number {
  return -w(params, 20);
}

/**
 * Scaling constant chosen so that R(S, S) = 0.9 exactly: after `stability`
 * days, recall probability is 90%. That identity is what makes stability
 * interpretable as "days until I am 90% likely to still know this".
 */
export function curveFactor(params: FsrsParams): number {
  return Math.pow(CURVE_ANCHOR, 1 / decay(params)) - 1;
}

/**
 * Probability of recalling a card right now.
 *
 *   R(t, S) = (1 + factor * t / S) ^ decay
 *
 * A power curve, not an exponential one: real forgetting has a long tail, and
 * FSRS-4.5 switched to this form because it fits review logs measurably better.
 */
export function retrievability(
  params: FsrsParams,
  elapsedDays: number,
  stability: number,
): number {
  const s = Math.max(stability, S_MIN);
  return Math.pow(1 + (curveFactor(params) * Math.max(elapsedDays, 0)) / s, decay(params));
}

/**
 * Days until retrievability decays to `desiredRetention`. The forgetting curve
 * solved for t — this is the number that becomes the next due date.
 *
 * Raising desired retention shortens every interval, which is why the retention
 * slider in the UI can honestly show its cost in daily reviews.
 */
export function intervalFromRetention(
  params: FsrsParams,
  stability: number,
  desiredRetention: number,
): number {
  const d = decay(params);
  return (stability / curveFactor(params)) * (Math.pow(desiredRetention, 1 / d) - 1);
}

/** Stability after the very first review. One weight per rating: w[0..3]. */
export function initialStability(params: FsrsParams, rating: Rating): number {
  return Math.min(Math.max(w(params, rating - 1), S_MIN), INIT_S_MAX);
}

/**
 * Difficulty after the very first review.
 *
 *   D0(G) = w[4] - e^(w[5] * (G - 1)) + 1
 *
 * Exponential in the rating, so an immediate "Easy" starts far below the middle
 * while "Again" starts well above it.
 *
 * Deliberately NOT clamped. With the default weights D0(4) is about -4.77, and
 * that out-of-range value is the mean-reversion target in `nextDifficulty` —
 * clamping here would shift every subsequent difficulty update. The scheduler
 * clamps when it assigns difficulty to a card; the model does not.
 */
export function initialDifficulty(params: FsrsParams, rating: Rating): number {
  return w(params, 4) - Math.exp(w(params, 5) * (rating - 1)) + 1;
}

/**
 * Damps a difficulty change as difficulty approaches its ceiling: a card that
 * is already at 9.5 barely moves, one at 3 moves nearly the full amount. Without
 * this, a run of "Hard" ratings would saturate every card at 10.
 */
export function linearDamping(deltaDifficulty: number, difficulty: number): number {
  return (deltaDifficulty * (D_MAX - difficulty)) / 9;
}

/** Pulls difficulty back toward the "Easy" baseline so it cannot drift forever. */
export function meanReversion(
  params: FsrsParams,
  init: number,
  current: number,
): number {
  return w(params, 7) * init + (1 - w(params, 7)) * current;
}

export function nextDifficulty(
  params: FsrsParams,
  difficulty: number,
  rating: Rating,
): number {
  const delta = -w(params, 6) * (rating - 3);
  const damped = difficulty + linearDamping(delta, difficulty);
  return clampDifficulty(meanReversion(params, initialDifficulty(params, 4), damped));
}

/**
 * Stability after a successful recall.
 *
 * Three effects the model captures, all visible in the formula:
 *   (11 - D)        easier cards gain more
 *   S^-w[9]         already-stable cards gain proportionally less
 *   e^(w[10](1-R))  recalling something you had nearly forgotten is worth most
 *
 * That last term is the spacing effect, and it is why reviewing too early is
 * close to wasted work.
 */
export function nextRecallStability(
  params: FsrsParams,
  difficulty: number,
  stability: number,
  retrievabilityAtReview: number,
  rating: Rating,
): number {
  const hardPenalty = rating === 2 ? w(params, 15) : 1;
  const easyBonus = rating === 4 ? w(params, 16) : 1;

  return clampStability(
    stability *
      (1 +
        Math.exp(w(params, 8)) *
          (11 - difficulty) *
          Math.pow(stability, -w(params, 9)) *
          (Math.exp((1 - retrievabilityAtReview) * w(params, 10)) - 1) *
          hardPenalty *
          easyBonus),
  );
}

/**
 * Stability after a lapse.
 *
 * Note there is no cap against the previous stability here. It is tempting to
 * add `min(candidate, S)` on the reasoning that forgetting cannot strengthen a
 * memory, but the published model does not, and for a barely-formed card the
 * post-lapse value can legitimately land just above the prior one. The oracle
 * confirmed it; the intuition was wrong.
 */
export function nextForgetStability(
  params: FsrsParams,
  difficulty: number,
  stability: number,
  retrievabilityAtReview: number,
): number {
  const candidate =
    w(params, 11) *
    Math.pow(difficulty, -w(params, 12)) *
    (Math.pow(stability + 1, w(params, 13)) - 1) *
    Math.exp((1 - retrievabilityAtReview) * w(params, 14));

  return clampStability(candidate);
}

/**
 * Stability after a same-day repeat, where almost no time has passed so the
 * forgetting curve has nothing to say. FSRS-6 adds the S^-w[19] term so that
 * cramming an already-stable card yields progressively less.
 *
 * Any grade above Again may never reduce stability, hence the floor of 1 on
 * the multiplier — note that includes Hard, not just Good and Easy.
 */
export function nextShortTermStability(
  params: FsrsParams,
  stability: number,
  rating: Rating,
): number {
  let increase =
    Math.exp(w(params, 17) * (rating - 3 + w(params, 18))) *
    Math.pow(stability, -w(params, 19));

  if (rating >= 2) increase = Math.max(increase, 1);

  return clampStability(stability * increase);
}
