import { z } from 'zod';
import { cuid, isoDate, rating } from './common';
import { fsrsParamsArray, optimizerEvaluation } from './optimizer';
import { curvePoint } from './stats';

/**
 * The Memory Report: the optimizer's output, and the review log, made
 * readable.
 *
 * A fit returns twenty-one numbers and explains none of them. This is the
 * same fit described in sentences a person can act on, with the log's own
 * patterns beside it: when they remember best, which cards keep failing, and
 * which deck returns the least for the reviews it costs. It is a snapshot,
 * stored when it is made, so it can be reread and compared with a later one.
 */

export const reportModel = z.object({
  /** Whether parameters were fitted for this report. False below the minimum history. */
  fitted: z.boolean(),
  reviewsUsed: z.number().int().min(0),
  /** The fitted parameters, or null when nothing was fitted. */
  params: fsrsParamsArray.nullable(),
  /** The published defaults on this history. Null when nothing could be predicted yet. */
  baseline: optimizerEvaluation.nullable(),
  /** The fitted parameters on the same history. Null when not fitted. */
  candidate: optimizerEvaluation.nullable(),
  lossImprovement: z.number().nullable(),
  /** Signed: positive means more reviews a day, which is often the honest answer. */
  workloadChange: z.number().nullable(),
  /** True when the account is already scheduling with exactly these parameters. */
  adopted: z.boolean(),
});
export type ReportModel = z.infer<typeof reportModel>;

/**
 * One new card, answered Good once, and how the chance of recalling it falls
 * over the following days: under this user's parameters and under the
 * published ones. The plainest picture of "how fast do I forget".
 */
export const reportCurve = z.object({
  yours: z.array(curvePoint),
  population: z.array(curvePoint),
  /** Days until recall of that card drops to 90%. Stability, in words. */
  stabilityDays: z.object({ yours: z.number().min(0), population: z.number().min(0) }),
  /** Which parameters "yours" was drawn from. */
  source: z.enum(['fitted', 'adopted', 'defaults']),
});
export type ReportCurve = z.infer<typeof reportCurve>;

export const hourBucket = z.object({
  hour: z.number().int().min(0).max(23),
  reviews: z.number().int().min(0),
  /** Fraction recalled of cards that were being recalled, not first reviews. Null if none. */
  retention: z.number().min(0).max(1).nullable(),
});

export const weekdayBucket = z.object({
  /** 0 is Sunday, as in JavaScript. */
  weekday: z.number().int().min(0).max(6),
  reviews: z.number().int().min(0),
  retention: z.number().min(0).max(1).nullable(),
});

export const reportPatterns = z.object({
  /** Local time, shifted by the offset the client sent. */
  tzOffsetMinutes: z.number().int(),
  hours: z.array(hourBucket).length(24),
  weekdays: z.array(weekdayBucket).length(7),
  /** Null until an hour has enough answers to say anything. */
  bestHour: z.number().int().min(0).max(23).nullable(),
  worstHour: z.number().int().min(0).max(23).nullable(),
});
export type ReportPatterns = z.infer<typeof reportPatterns>;

/** A card that keeps being forgotten, and what it has cost. */
export const reportLeech = z.object({
  cardId: cuid,
  deckId: cuid,
  deckTitle: z.string(),
  front: z.string(),
  lapses: z.number().int().min(0),
  reviews: z.number().int().min(0),
  minutesSpent: z.number().min(0),
  lastRating: rating.nullable(),
  /** Predicted recall right now. */
  retrievability: z.number().min(0).max(1),
});
export type ReportLeech = z.infer<typeof reportLeech>;

/** What a deck returned for the reviews it cost, over the report's window. */
export const reportDeck = z.object({
  deckId: cuid,
  title: z.string(),
  cards: z.number().int().min(0),
  reviews: z.number().int().min(0),
  reviewsPerCard: z.number().min(0),
  /** Measured, over the window: recalled of those being recalled. Null if none. */
  retention: z.number().min(0).max(1).nullable(),
  /** Mean predicted recall across the deck's seen cards, right now. */
  predictedRetention: z.number().min(0).max(1).nullable(),
});
export type ReportDeck = z.infer<typeof reportDeck>;

export const memoryReport = z.object({
  id: cuid,
  createdAt: isoDate,
  reviewCount: z.number().int().min(0),
  cardCount: z.number().int().min(0),
  /** Days of history the measured figures (retention, deck cost) cover. */
  windowDays: z.number().int().min(1),
  /** The findings, in sentences. Every number in them appears in the sections below. */
  statements: z.array(z.string()),
  model: reportModel,
  curve: reportCurve,
  patterns: reportPatterns,
  leeches: z.array(reportLeech),
  decks: z.array(reportDeck),
});
export type MemoryReport = z.infer<typeof memoryReport>;

export const reportRequest = z.object({
  /**
   * The client's offset from UTC in minutes, as `Date.getTimezoneOffset()`
   * reports it but with the sign that reads naturally: +330 for India.
   * Hour-of-day patterns mean nothing in UTC to someone in Kolkata.
   */
  tzOffsetMinutes: z.number().int().min(-840).max(840).default(0),
});
export type ReportRequest = z.infer<typeof reportRequest>;

/** The latest report, and whether another can be made now. */
export const reportStatus = z.object({
  latest: memoryReport.nullable(),
  reviewCount: z.number().int().min(0),
  /** Reviews needed before the report includes a fit. Below it, the rest still works. */
  minimumReviewsForFit: z.number().int().min(0),
  /** Null when a report can be made right now. */
  nextAllowedAt: isoDate.nullable(),
});
export type ReportStatus = z.infer<typeof reportStatus>;
