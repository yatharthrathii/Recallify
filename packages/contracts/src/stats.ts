import { z } from 'zod';
import { cuid } from './common';

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
  lastStudyDate: z.coerce.date().nullable(),

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
