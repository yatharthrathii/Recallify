import { z } from 'zod';
import { cardSource, cardState, cuid, isoDate, pageQuery, queryBoolean } from './common';

/** The same ceilings the import reader applies at read time, so a preview shows what will be sent. */
export const CARD_TEXT_MAX = 4000;
export const HINT_MAX = 500;

export const cardText = z.string().trim().min(1).max(CARD_TEXT_MAX);
export const cardHint = z.string().trim().max(HINT_MAX);

export const createCardRequest = z.object({
  deckId: cuid,
  front: cardText,
  back: cardText,
  hint: cardHint.optional(),
});
export type CreateCardRequest = z.infer<typeof createCardRequest>;

export const updateCardRequest = createCardRequest.omit({ deckId: true }).partial();
export type UpdateCardRequest = z.infer<typeof updateCardRequest>;

/**
 * Used by AI generation, CSV and .apkg import alike. Capped so one request
 * cannot lock a table for a noticeable time.
 */
export const bulkCreateRequest = z.object({
  deckId: cuid,
  source: cardSource.default('MANUAL'),
  cards: z
    .array(createCardRequest.omit({ deckId: true }))
    .min(1)
    .max(500),
});
export type BulkCreateRequest = z.infer<typeof bulkCreateRequest>;

/**
 * The FSRS numbers are exposed on purpose. Every other app hides them; showing
 * them is the product.
 */
export const cardSchedule = z.object({
  state: cardState,
  stability: z.number().min(0),
  difficulty: z.number().min(0).max(10),
  dueAt: isoDate,
  reps: z.number().int().min(0),
  lapses: z.number().int().min(0),
  lastReviewedAt: isoDate.nullable(),
  learningStep: z.number().int().min(0),
});

export const card = z
  .object({
    id: cuid,
    deckId: cuid,
    front: z.string(),
    back: z.string(),
    hint: z.string().nullable(),
    source: cardSource,
    /** For a card in a subscribed copy: the author's card it mirrors. */
    sourceCardId: cuid.nullable(),
    suspendedAt: isoDate.nullable(),
    createdAt: isoDate,
    updatedAt: isoDate,
  })
  .merge(cardSchedule);
export type Card = z.infer<typeof card>;

export const listCardsQuery = pageQuery.extend({
  deckId: cuid.optional(),
  includeSuspended: queryBoolean.default(false),
});
export type ListCardsQuery = z.infer<typeof listCardsQuery>;

/**
 * Suspending is not deleting. A suspended card stops appearing in the queue but
 * keeps its FSRS state and its review history, so unsuspending resumes exactly
 * where it left off rather than starting the card over.
 */
export const suspendCardRequest = z.object({ suspended: z.boolean() });
export type SuspendCardRequest = z.infer<typeof suspendCardRequest>;

/**
 * Bulk create returns a count, not the rows. Five hundred cards is a large
 * response to send back to a client that is about to refetch the deck anyway.
 */
export const bulkCreateResponse = z.object({
  deckId: cuid,
  created: z.number().int().min(0),
});
export type BulkCreateResponse = z.infer<typeof bulkCreateResponse>;
