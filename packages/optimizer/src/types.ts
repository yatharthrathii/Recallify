import type { FsrsConfig, FsrsParams, Rating } from '@recallify/fsrs';

/**
 * One row of the training set. This is a `Review` from the database, reduced to
 * the three things the optimizer needs: which card, what the user answered, and
 * when.
 *
 * The stored FSRS numbers are deliberately NOT used. Every candidate parameter
 * set produces its own stabilities, so the history has to be replayed from the
 * ratings rather than read back from the cache — which is exactly why `Review`
 * is append-only.
 */
export interface TrainingReview {
  readonly cardId: string;
  readonly rating: Rating;
  readonly reviewedAt: Date;
}

/** How well one parameter set explains a user's actual review history. */
export interface Evaluation {
  /**
   * Mean binary log-loss — the number being minimised.
   *
   * For each review the model predicted a recall probability p, and the user
   * either recalled it (y=1) or did not (y=0). Loss is -[y·ln p + (1-y)·ln(1-p)],
   * so confident-and-wrong is punished far harder than unsure-and-wrong.
   * Lower is better; 0.693 is what you get by always guessing 50%.
   */
  readonly logLoss: number;

  /** Reviews that contributed. First-ever reviews are excluded — nothing to predict from. */
  readonly predictions: number;

  /** Mean predicted recall probability. */
  readonly predictedRetention: number;

  /** Fraction the user actually recalled. */
  readonly actualRetention: number;

  /**
   * |predicted − actual|. Log-loss says how sharp the model is; this says
   * whether it is honest. A model can be well calibrated and still vague, so
   * both numbers are reported.
   */
  readonly calibrationError: number;

  /** Mean interval, in days, across reviews that landed a card back in REVIEW. */
  readonly averageIntervalDays: number;

  /**
   * Rough daily workload these parameters imply: each card resurfaces about
   * once per interval, so cards / averageInterval. A proxy, not a simulation —
   * it ignores lapses bunching up and the daily caps.
   */
  readonly estimatedReviewsPerDay: number;
}

export interface OptimizeOptions {
  readonly startingParams?: FsrsParams;
  readonly maxIterations?: number;
  readonly learningRate?: number;
  /** Stop once an accepted step improves loss by less than this. */
  readonly tolerance?: number;
  readonly config?: FsrsConfig;
}

export interface OptimizeResult {
  readonly params: FsrsParams;
  readonly initialLoss: number;
  readonly finalLoss: number;
  readonly iterations: number;
  /** True when it stopped because it stopped improving, false when it ran out of iterations. */
  readonly converged: boolean;
  /** Loss after each accepted step, starting with the initial loss. */
  readonly trace: readonly number[];
}

export interface BacktestResult {
  readonly baseline: Evaluation;
  readonly candidate: Evaluation;
  /** Reduction in log-loss as a fraction. Positive means the candidate predicts better. */
  readonly lossImprovement: number;
  /** Change in estimated daily reviews. Negative means less work. */
  readonly workloadChange: number;
}
