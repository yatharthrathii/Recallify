import { z } from 'zod';
import { cardSchedule } from './card';
import { cuid, rating, uuid } from './common';

/**
 * Submitting a review.
 *
 * The id is generated on the DEVICE, not the server, and it is the primary key.
 * That single decision is what makes sync safe: a retried request, a
 * half-delivered offline batch, a double-tap on a slow connection — all carry
 * the same id, so the server stores the first and recognises the rest.
 *
 * Without it, "did that save?" has no answer that does not risk double-counting.
 */
export const submitReviewRequest = z.object({
  id: uuid,
  cardId: cuid,
  rating,
  /**
   * The device's clock, because a review taken on a plane happened when it
   * happened, not when it eventually uploaded. The server clamps a clock that
   * runs backwards rather than trusting it blindly.
   */
  reviewedAt: z.coerce.date(),
  /** How long the card was on screen. Optional; used for the stats page only. */
  durationMs: z.number().int().min(0).max(600_000).optional(),
});
export type SubmitReviewRequest = z.infer<typeof submitReviewRequest>;

/**
 * Offline sync. Capped at 200 so one flight home cannot arrive as a single
 * enormous transaction.
 */
export const batchReviewRequest = z.object({
  reviews: z.array(submitReviewRequest).min(1).max(200),
});
export type BatchReviewRequest = z.infer<typeof batchReviewRequest>;

/** What the server did with each submitted review. */
export const reviewOutcome = z.object({
  reviewId: uuid,
  cardId: cuid,
  /** False when this id had already been stored — a retry, not a new review. */
  applied: z.boolean(),
  card: cardSchedule,
});
export type ReviewOutcome = z.infer<typeof reviewOutcome>;

export const batchReviewResponse = z.object({
  outcomes: z.array(reviewOutcome),
  applied: z.number().int().min(0),
  duplicates: z.number().int().min(0),
});
export type BatchReviewResponse = z.infer<typeof batchReviewResponse>;

export const queueQuery = z.object({
  deckId: cuid.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** Include cards not due yet, for a user who wants to study ahead. */
  ahead: z.coerce.boolean().default(false),
});
export type QueueQuery = z.infer<typeof queueQuery>;

/**
 * "Why is this card in front of me?" — the panel no competitor has.
 * Straight out of the engine's `explain`.
 */
export const explanation = z.object({
  cardId: cuid,
  retrievability: z.number().min(0).max(1),
  stability: z.number().min(0),
  difficulty: z.number().min(0).max(10),
  elapsedDays: z.number().min(0),
  intervalDays: z.number().min(0),
  predictedForgetAt: z.coerce.date(),
  /** What each button would do, so the choice is visible before it is made. */
  projectedIntervals: z.object({
    again: z.number().min(0),
    hard: z.number().min(0),
    good: z.number().min(0),
    easy: z.number().min(0),
  }),
});
export type Explanation = z.infer<typeof explanation>;
