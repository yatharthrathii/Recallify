import { z } from 'zod';
import { cardHint, cardText } from './card';
import { cuid, isoDate, rating, uuid } from './common';
import { createDeckRequest } from './deck';

/**
 * Importing cards, with their history.
 *
 * The API accepts one shape whatever the file was. `@recallify/import` reads a
 * `.apkg` or a CSV on the device and produces this; the server never sees the
 * file. Every review comes with a rating and a time, nothing else: the server
 * replays them through the scheduler, so an imported card's stability is one
 * this engine computed, not a number translated from another model.
 *
 * Sized as one request of a larger import. A deck with years of history is
 * sent as a series of these, each holding whole cards, because a card's
 * reviews must be replayed together.
 */

export const IMPORT_CARDS_MAX = 500;
export const IMPORT_REVIEWS_PER_CARD_MAX = 2000;
export const IMPORT_REVIEWS_MAX = 5000;
/** Ten minutes on one answer; longer is a tab left open, not a review. */
export const IMPORT_DURATION_MAX_MS = 600_000;

export const importReview = z.object({
  /**
   * Derived from the source's own ids by the reader, so the same review in
   * the same file always carries the same id. The server folds the account
   * into it before storing, so a file imported twice into one account
   * collides and is refused rather than counted twice, while two accounts
   * importing the same shared deck do not collide with each other.
   */
  id: uuid,
  rating,
  reviewedAt: isoDate,
  durationMs: z.number().int().min(0).max(IMPORT_DURATION_MAX_MS).optional(),
});
export type ImportReview = z.infer<typeof importReview>;

export const importCard = z.object({
  front: cardText,
  back: cardText,
  hint: cardHint.optional(),
  suspended: z.boolean().default(false),
  reviews: z.array(importReview).max(IMPORT_REVIEWS_PER_CARD_MAX).default([]),
});
export type ImportCard = z.infer<typeof importCard>;

export const importRequest = z
  .object({
    /** An existing deck to add to, or a new one to make. Exactly one. */
    deckId: cuid.optional(),
    newDeck: createDeckRequest.optional(),
    cards: z.array(importCard).min(1).max(IMPORT_CARDS_MAX),
  })
  .refine((v) => Boolean(v.deckId) !== Boolean(v.newDeck), {
    message: 'Provide either deckId or newDeck, not both',
    path: ['deckId'],
  })
  .refine((v) => v.cards.reduce((n, c) => n + c.reviews.length, 0) <= IMPORT_REVIEWS_MAX, {
    message: `At most ${IMPORT_REVIEWS_MAX} reviews in one request`,
    path: ['cards'],
  })
  // The same id twice in one request is a malformed file, not a repeat import.
  .refine(
    (v) => {
      const ids = v.cards.flatMap((c) => c.reviews.map((r) => r.id));
      return new Set(ids).size === ids.length;
    },
    { message: 'Every review in a request needs its own id', path: ['cards'] },
  );
export type ImportRequest = z.infer<typeof importRequest>;

export const importResponse = z.object({
  deckId: cuid,
  cardsCreated: z.number().int().min(0),
  reviewsCreated: z.number().int().min(0),
});
export type ImportResponse = z.infer<typeof importResponse>;
