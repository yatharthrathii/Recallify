import { z } from 'zod';
import { cuid, isoDate } from './common';

/**
 * Stats are computed server-side from the append-only review log.
 *
 * v1 kept XP in the client and did `xp = xp % 100`, which silently destroyed
 * the running total every time a user crossed 100. Here the total is
 * cumulative and the level is derived from it, so the same bug cannot recur.
 */
export const statsOverview = z.object({
  xp: z.number().int().min(0),
  level: z.number().int().min(1),
  streak: z.number().int().min(0),
  longestStreak: z.number().int().min(0),
  lastStudyDate: isoDate.nullable(),

  totalReviews: z.number().int().min(0),
  totalCards: z.number().int().min(0),
  dueToday: z.number().int().min(0),
  /** Fraction actually recalled, over the window. Measured, not predicted. */
  retention: z.number().min(0).max(1),
});
export type StatsOverview = z.infer<typeof statsOverview>;

export const heatmapDay = z.object({
  date: z.string().date(),
  reviews: z.number().int().min(0),
  /** Recalled fraction that day; null when nothing was reviewed. */
  retention: z.number().min(0).max(1).nullable(),
});
export const heatmap = z.array(heatmapDay);
export type Heatmap = z.infer<typeof heatmap>;

/**
 * One point on a forgetting curve: days since the last review, and the
 * probability of recall at that moment. This is the product's signature chart.
 */
export const curvePoint = z.object({
  day: z.number().min(0),
  retrievability: z.number().min(0).max(1),
});

/** A review that lifted the curve back up. */
export const curveMarker = z.object({
  day: z.number().min(0),
  rating: z.number().int().min(1).max(4),
  retrievabilityBefore: z.number().min(0).max(1),
});

export const forgettingCurve = z.object({
  cardId: cuid.optional(),
  deckId: cuid.optional(),
  points: z.array(curvePoint),
  markers: z.array(curveMarker),
  desiredRetention: z.number().min(0).max(1),
  /** Where the curve crosses desiredRetention -- the due date, drawn. */
  dueInDays: z.number().min(0),
});
export type ForgettingCurve = z.infer<typeof forgettingCurve>;

/**
 * Wrapped in an object rather than returned as a bare array.
 *
 * A top-level JSON array is a shape that can never grow: adding "and here is
 * the range this covers" later would be a breaking change for every client.
 */
export const heatmapResponse = z.object({ days: heatmap });
export type HeatmapResponse = z.infer<typeof heatmapResponse>;

export const heatmapQuery = z.object({
  days: z.coerce.number().int().min(7).max(730).default(365),
});
export type HeatmapQuery = z.infer<typeof heatmapQuery>;

export const forecastQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  deckId: cuid.optional(),
});
export type ForecastQuery = z.infer<typeof forecastQuery>;

/** One of cardId or deckId. A whole-account curve would average away the shape. */
export const curveQuery = z
  .object({ cardId: cuid.optional(), deckId: cuid.optional() })
  .refine((v) => Boolean(v.cardId) !== Boolean(v.deckId), {
    message: 'Provide either cardId or deckId, not both',
    path: ['cardId'],
  });
export type CurveQuery = z.infer<typeof curveQuery>;

export const forecast = z.object({
  days: z.array(z.object({ date: z.string().date(), due: z.number().int().min(0) })),
  /** Cards already overdue, all of which land on day one. */
  backlog: z.number().int().min(0),
});
export type Forecast = z.infer<typeof forecast>;
