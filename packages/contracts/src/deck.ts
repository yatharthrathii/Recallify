import { z } from 'zod';
import { cuid } from './common';

/**
 * Deck accent colours.
 *
 * Deliberately NOT the memory scale from @recallify/tokens. Those five hues
 * encode retrievability -- colour is data there -- and letting a user paint a
 * deck "lost red" would make the encoding meaningless. Decks get their own
 * small palette, and tokens will need a matching one.
 */
export const deckColor = z.enum(['amber', 'teal', 'clay', 'moss', 'slate', 'sand']);
export type DeckColor = z.infer<typeof deckColor>;

export const createDeckRequest = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  color: deckColor.default('amber'),
});
export type CreateDeckRequest = z.infer<typeof createDeckRequest>;

export const updateDeckRequest = createDeckRequest.partial().extend({
  /** Hidden from the deck list, but never deleted -- the review log outlives it. */
  archived: z.boolean().optional(),
});
export type UpdateDeckRequest = z.infer<typeof updateDeckRequest>;

export const deck = z.object({
  id: cuid,
  title: z.string(),
  description: z.string().nullable(),
  color: deckColor,
  isPublic: z.boolean(),
  archivedAt: z.coerce.date().nullable(),
  cardCount: z.number().int().min(0),
  dueCount: z.number().int().min(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Deck = z.infer<typeof deck>;

/** One day of the workload forecast. */
export const forecastDay = z.object({
  date: z.string().date(),
  due: z.number().int().min(0),
});

export const deckStats = z.object({
  deckId: cuid,
  total: z.number().int().min(0),
  newCards: z.number().int().min(0),
  learning: z.number().int().min(0),
  review: z.number().int().min(0),
  relearning: z.number().int().min(0),
  dueNow: z.number().int().min(0),

  /** Mean predicted recall across the deck, right now. */
  averageRetrievability: z.number().min(0).max(1),
  averageStabilityDays: z.number().min(0),

  /** What the next month looks like if nothing new is added. */
  forecast: z.array(forecastDay),
});
export type DeckStats = z.infer<typeof deckStats>;
