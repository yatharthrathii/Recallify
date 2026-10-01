import type { Prisma } from '@prisma/client';
import { DAY_MS, type ReviewLog, type SchedulingCard } from '@recallify/fsrs';

/**
 * The part of a review row that comes from the scheduler, shared by the live
 * review path and the importer so the log is written one way only.
 */

/**
 * How far ahead of the server a device's clock is allowed to be.
 *
 * `reviewedAt` comes from the device on purpose -- a review taken on a plane
 * happened when it happened. But a phone whose clock is set to 2031 would
 * otherwise push every card years into the future, and nothing would ever come
 * back. A few minutes covers ordinary drift; beyond that the server's clock
 * wins.
 */
export const MAX_CLOCK_SKEW_MS = 5 * 60_000;

/** A review lifts the card's state forward, so replaying the past is not allowed. */
export function clampReviewedAt(requested: Date, lastReviewedAt: Date | null, now: Date): Date {
  const ceiling = new Date(now.getTime() + MAX_CLOCK_SKEW_MS);
  let at = requested > ceiling ? now : requested;
  // Two reviews of the same card cannot happen in the wrong order. An offline
  // batch that arrives shuffled is sorted before it gets here; this catches the
  // rest.
  if (lastReviewedAt && at < lastReviewedAt) at = lastReviewedAt;
  return at;
}

export type ReviewLogColumns = Pick<
  Prisma.ReviewCreateManyInput,
  | 'prevState'
  | 'prevStability'
  | 'prevDifficulty'
  | 'newStability'
  | 'newDifficulty'
  | 'scheduledDays'
  | 'elapsedDays'
  | 'retrievability'
>;

/** The before and after of one answer, as the log stores them. */
export function reviewLogColumns(
  log: ReviewLog,
  after: SchedulingCard,
  reviewedAt: Date,
): ReviewLogColumns {
  return {
    prevState: log.prevState,
    prevStability: log.prevStability,
    prevDifficulty: log.prevDifficulty,
    newStability: log.newStability,
    newDifficulty: log.newDifficulty,
    scheduledDays: Math.max(0, Math.round((after.dueAt.getTime() - reviewedAt.getTime()) / DAY_MS)),
    elapsedDays: Math.round(log.elapsedDays),
    retrievability: log.retrievability,
  };
}
