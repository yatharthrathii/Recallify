/**
 * FSRS types — the contract the whole product is built on.
 *
 * This package is PURE: zero dependencies, no I/O, no framework imports, no
 * Date.now() inside the scheduler (the caller passes `now`, so every result is
 * reproducible and testable). It runs unchanged on the server, in the browser,
 * and on the phone. See docs/02-ARCHITECTURE.md.
 */

/** Card lifecycle. Mirrors the Prisma enum exactly. */
export type CardState = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';

/** 1 Again · 2 Hard · 3 Good · 4 Easy */
export type Rating = 1 | 2 | 3 | 4;

export const Ratings = {
  Again: 1,
  Hard: 2,
  Good: 3,
  Easy: 4,
} as const satisfies Record<string, Rating>;

/**
 * The DSR model's two persistent variables.
 *
 * stability  — storage strength, in days. Higher means slower forgetting.
 *              Concretely: the number of days until retrievability decays to
 *              90%.
 * difficulty — intrinsic hardness of this card, in [1, 10].
 *
 * Retrievability is not stored: it is a function of stability and elapsed
 * time, so it is always computed.
 */
export interface MemoryState {
  readonly stability: number;
  readonly difficulty: number;
}

/** Everything the scheduler needs to know about a card. No DB types leak in. */
export interface SchedulingCard extends MemoryState {
  readonly state: CardState;
  readonly reps: number;
  readonly lapses: number;
  readonly lastReviewedAt: Date | null;
  readonly dueAt: Date;
}

/** What a review produced. Persisted as one append-only `Review` row. */
export interface ReviewLog {
  readonly rating: Rating;
  readonly reviewedAt: Date;

  /** State before the review, so the log alone is enough to replay history. */
  readonly prevState: CardState;
  readonly prevStability: number;
  readonly prevDifficulty: number;

  readonly newStability: number;
  readonly newDifficulty: number;

  readonly elapsedDays: number;
  readonly scheduledDays: number;
  /** Predicted retrievability at the moment of review, in [0, 1]. */
  readonly retrievability: number;
}

/** Return value of `schedule`. The card is the new cached state. */
export interface SchedulingResult {
  readonly card: SchedulingCard;
  readonly log: ReviewLog;
}

/**
 * FSRS-6 weights. 21 numbers, fitted per user by @recallify/optimizer.
 * Defaults are the published values; a user with enough review history gets
 * their own.
 */
export type FsrsParams = readonly number[];

export interface FsrsConfig {
  readonly params: FsrsParams;
  /** Target recall probability, in (0, 1). Drives interval length. */
  readonly desiredRetention: number;
  /** Hard ceiling on any interval, in days. */
  readonly maximumInterval: number;
  /** Sub-day steps for cards still being learned, in minutes. */
  readonly learningSteps: readonly number[];
  readonly relearningSteps: readonly number[];
  /** Add +/- this fraction of jitter so reviews do not clump on one day. */
  readonly fuzzFactor: number;
}

/** Why a card is due right now — powers the "Why this card?" panel. */
export interface Explanation {
  readonly retrievability: number;
  readonly stability: number;
  readonly difficulty: number;
  readonly elapsedDays: number;
  readonly intervalDays: number;
  /** When retrievability is predicted to cross desiredRetention. */
  readonly predictedForgetAt: Date;
}
