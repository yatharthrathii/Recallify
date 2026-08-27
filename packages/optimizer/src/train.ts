/**
 * Fitting FSRS parameters to one user's review history.
 *
 * Gradient descent with numerical gradients and a backtracking step size. No
 * autodiff library, no tensors — the objective is cheap enough to probe
 * directly, and 21 parameters is small enough that finite differences are
 * honest rather than a shortcut.
 *
 * Each iteration costs about 22 full replays of the history for the gradient,
 * plus up to 8 more while the step size backs off. On a few thousand reviews
 * that is seconds, which is fine for a job the user triggers occasionally. It
 * would not be fine in a request handler, and the API must not call it in one.
 */

import { DEFAULT_CONFIG, DEFAULT_PARAMS, type FsrsParams } from '@recallify/fsrs';
import { clampParams, paramRange } from './bounds';
import { evaluate } from './evaluate';
import type { OptimizeOptions, OptimizeResult, TrainingReview } from './types';

/**
 * Below this, training overfits noise and produces parameters worse than the
 * published defaults. Refusing is the honest answer; the FSRS project gives
 * similar guidance.
 */
export const MIN_REVIEWS = 400;

const DEFAULTS = {
  maxIterations: 60,
  learningRate: 0.05,
  tolerance: 1e-5,
} as const;

/** Smallest step size worth trying before calling it converged. */
const MIN_LEARNING_RATE = 1e-6;
const MAX_BACKTRACKS = 8;

/**
 * Finite-difference gradient.
 *
 * The probe for each parameter is scaled to that parameter's own range, because
 * the ranges differ by three orders of magnitude — a fixed step would be
 * invisible to w0 (range 100) and enormous for w12 (range 0.25).
 */
export function numericalGradient(
  reviews: readonly TrainingReview[],
  params: FsrsParams,
  baseLoss: number,
  config = DEFAULT_CONFIG,
): number[] {
  return params.map((_, index) => {
    const h = paramRange(index) * 1e-4;
    const probed = clampParams(
      params.map((value, i) => (i === index ? value + h : value)),
    );
    const probedLoss = evaluate(reviews, probed, config).logLoss;
    return (probedLoss - baseLoss) / h;
  });
}

/**
 * Train parameters on a user's own review history.
 *
 * Throws below MIN_REVIEWS rather than returning noise dressed up as a result.
 */
export function optimize(
  reviews: readonly TrainingReview[],
  options: OptimizeOptions = {},
): OptimizeResult {
  if (reviews.length < MIN_REVIEWS) {
    throw new RangeError(
      `Need at least ${MIN_REVIEWS} reviews to fit parameters; got ${reviews.length}. ` +
        `Below that the fit follows noise and does worse than the published defaults.`,
    );
  }

  const config = options.config ?? DEFAULT_CONFIG;
  const maxIterations = options.maxIterations ?? DEFAULTS.maxIterations;
  const tolerance = options.tolerance ?? DEFAULTS.tolerance;

  let learningRate = options.learningRate ?? DEFAULTS.learningRate;
  let params = clampParams(options.startingParams ?? DEFAULT_PARAMS);
  let loss = evaluate(reviews, params, config).logLoss;

  const initialLoss = loss;
  const trace: number[] = [loss];
  let iterations = 0;
  let converged = false;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    iterations += 1;

    const gradient = numericalGradient(reviews, params, loss, config);
    let accepted = false;

    // Backtracking line search: try a step, and keep halving it until the loss
    // actually falls. This is what stops the run from diverging when the
    // starting rate is too ambitious, without needing a tuned schedule.
    for (let attempt = 0; attempt < MAX_BACKTRACKS; attempt++) {
      const candidate = clampParams(
        params.map((value, i) => value - learningRate * gradient[i]! * paramRange(i)),
      );
      const candidateLoss = evaluate(reviews, candidate, config).logLoss;

      if (candidateLoss < loss) {
        const improvement = loss - candidateLoss;
        params = candidate;
        loss = candidateLoss;
        trace.push(loss);
        accepted = true;
        if (improvement < tolerance) converged = true;
        break;
      }

      learningRate /= 2;
      if (learningRate < MIN_LEARNING_RATE) break;
    }

    // No step of any size helped: this is a local minimum as far as the
    // gradient can see, and there is nothing left to do.
    if (!accepted) converged = true;
    if (converged) break;
  }

  return { params, initialLoss, finalLoss: loss, iterations, converged, trace };
}
