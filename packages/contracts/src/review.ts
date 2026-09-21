import { z } from 'zod';
import { cardSchedule } from './card';
import { cardState, cuid, isoDate, pageQuery, queryBoolean, rating, uuid } from './common';

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
  reviewedAt: isoDate,
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
  /**
   * Include cards not due yet, for a user who wants to study ahead.
   *
   * queryBoolean, not z.coerce.boolean(): the latter reads the string "false"
   * as true, so `?ahead=false` would have turned the flag on.
   */
  ahead: queryBoolean.default(false),
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
  predictedForgetAt: isoDate,
  /** What each button would do, so the choice is visible before it is made. */
  projectedIntervals: z.object({
    again: z.number().min(0),
    hard: z.number().min(0),
    good: z.number().min(0),
    easy: z.number().min(0),
  }),
});
export type Explanation = z.infer<typeof explanation>;

export const reviewHistoryQuery = pageQuery.extend({ cardId: cuid.optional() });
export type ReviewHistoryQuery = z.infer<typeof reviewHistoryQuery>;

/**
 * One row of the append-only log, as stored. The before-state is included
 * because it is what makes the log replayable on its own.
 */
export const reviewHistoryItem = z.object({
  id: uuid,
  cardId: cuid,
  rating,
  prevState: cardState,
  prevStability: z.number(),
  prevDifficulty: z.number(),
  newStability: z.number(),
  newDifficulty: z.number(),
  elapsedDays: z.number(),
  scheduledDays: z.number(),
  retrievability: z.number(),
  durationMs: z.number().int().nullable(),
  reviewedAt: isoDate,
});
export type ReviewHistoryItem = z.infer<typeof reviewHistoryItem>;

/**
 * A card in the due queue, answer included.
 *
 * Withholding `back` until the user taps "show" would stop them peeking at the
 * network tab, but it would also mean a round trip per card -- and the mobile
 * client has to work on a plane. Offline-first wins: these are the user's own
 * cards, and the only person a peek costs anything is them.
 */
export const queueCard = z
  .object({
    id: cuid,
    deckId: cuid,
    deckTitle: z.string(),
    front: z.string(),
    back: z.string(),
    hint: z.string().nullable(),
    /** Predicted recall right now. The reason this card is here. */
    retrievability: z.number().min(0).max(1),
  })
  // The full scheduling state, so the client can run the same pure scheduler
  // the server does and show the next interval before the round trip finishes.
  .merge(cardSchedule);
export type QueueCard = z.infer<typeof queueCard>;

/**
 * What this user is being scheduled with.
 *
 * Sent with the queue so the client can schedule locally -- instantly on web,
 * offline on the phone -- with the same parameters the server will use. The
 * server still has the last word: its result replaces the local one when the
 * review lands, and only the server applies interval fuzz.
 */
export const schedulingConfig = z.object({
  params: z.array(z.number()),
  desiredRetention: z.number().min(0).max(1),
  maximumInterval: z.number().min(1),
  learningSteps: z.array(z.number()),
  relearningSteps: z.array(z.number()),
});
export type SchedulingConfig = z.infer<typeof schedulingConfig>;

export const queueResponse = z.object({
  cards: z.array(queueCard),
  config: schedulingConfig,
  /** Everything due right now, before the daily caps were applied. */
  dueTotal: z.number().int().min(0),
  newRemainingToday: z.number().int().min(0),
  reviewRemainingToday: z.number().int().min(0),
});
export type QueueResponse = z.infer<typeof queueResponse>;
