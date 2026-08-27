/**
 * Comparing two parameter sets on the same history.
 *
 * Training produces a number that only means something to the optimizer. This
 * turns it into the two numbers a user actually cares about: is the model
 * predicting my memory better, and does that mean more or less studying.
 */

import { DEFAULT_CONFIG, DEFAULT_PARAMS, type FsrsConfig, type FsrsParams } from '@recallify/fsrs';
import { evaluate } from './evaluate';
import type { BacktestResult, TrainingReview } from './types';

/**
 * Replay one history under both parameter sets and report the difference.
 *
 * Both sides see exactly the same reviews in the same order, so the comparison
 * is like-for-like -- the only thing that changed is the model.
 */
export function backtest(
  reviews: readonly TrainingReview[],
  candidateParams: FsrsParams,
  baselineParams: FsrsParams = DEFAULT_PARAMS,
  config: FsrsConfig = DEFAULT_CONFIG,
): BacktestResult {
  const baseline = evaluate(reviews, baselineParams, config);
  const candidate = evaluate(reviews, candidateParams, config);

  const lossImprovement =
    baseline.logLoss > 0 ? (baseline.logLoss - candidate.logLoss) / baseline.logLoss : 0;

  const workloadChange =
    baseline.estimatedReviewsPerDay > 0
      ? (candidate.estimatedReviewsPerDay - baseline.estimatedReviewsPerDay) /
        baseline.estimatedReviewsPerDay
      : 0;

  return { baseline, candidate, lossImprovement, workloadChange };
}
