import { z } from 'zod';
import { isoDate } from './common';

/**
 * Parameter fitting.
 *
 * The honest framing matters here, so it is written into the schema rather
 * than left to the UI: optimising promises a model that predicts this user's
 * memory more accurately. It does NOT promise fewer reviews. Measured on
 * simulated learners, a fast forgetter ends up with more daily reviews and a
 * slow forgetter with fewer -- which is the model being right, not the product
 * saving anyone time. `workloadChange` is signed for exactly that reason.
 */

export const PARAM_COUNT = 21;

export const fsrsParamsArray = z.array(z.number().finite()).length(PARAM_COUNT);

export const optimizerEvaluation = z.object({
  /** Mean binary log-loss. Lower is better; 0.693 is a coin flip. */
  logLoss: z.number(),
  predictions: z.number().int().min(0),
  predictedRetention: z.number().min(0).max(1),
  actualRetention: z.number().min(0).max(1),
  /** |predicted - actual|. Sharpness and honesty are different questions. */
  calibrationError: z.number().min(0),
  averageIntervalDays: z.number().min(0),
  estimatedReviewsPerDay: z.number().min(0),
});
export type OptimizerEvaluation = z.infer<typeof optimizerEvaluation>;

/** Whether this user has enough history for fitting to mean anything yet. */
export const optimizerStatus = z.object({
  reviewCount: z.number().int().min(0),
  minimumReviews: z.number().int().min(0),
  eligible: z.boolean(),
  usingOptimizedParams: z.boolean(),
  paramsOptimizedAt: isoDate.nullable(),
  /** Null when a run is allowed right now. */
  nextRunAllowedAt: isoDate.nullable(),
});
export type OptimizerStatus = z.infer<typeof optimizerStatus>;

/**
 * The result of a run. Nothing is saved -- this is a proposal the user accepts
 * with /optimizer/apply, so the comparison can be looked at before it takes
 * effect.
 */
export const optimizerRunResponse = z.object({
  params: fsrsParamsArray,
  reviewsUsed: z.number().int().min(0),
  initialLoss: z.number(),
  finalLoss: z.number(),
  iterations: z.number().int().min(0),
  converged: z.boolean(),
  baseline: optimizerEvaluation,
  candidate: optimizerEvaluation,
  /** Fractional reduction in log-loss. Positive means the fit predicts better. */
  lossImprovement: z.number(),
  /** Change in estimated daily reviews. POSITIVE means more work, not less. */
  workloadChange: z.number(),
});
export type OptimizerRunResponse = z.infer<typeof optimizerRunResponse>;

export const optimizerApplyRequest = z.object({ params: fsrsParamsArray });
export type OptimizerApplyRequest = z.infer<typeof optimizerApplyRequest>;
