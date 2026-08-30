import { z } from 'zod';
import { cardSource, cardState, cuid } from './common';

export const cardText = z.string().trim().min(1).max(4000);

export const createCardRequest = z.object({
  deckId: cuid,
  front: cardText,
  back: cardText,
  hint: z.string().trim().max(500).optional(),
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
  dueAt: z.coerce.date(),
  reps: z.number().int().min(0),
  lapses: z.number().int().min(0),
  lastReviewedAt: z.coerce.date().nullable(),
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
    suspendedAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .merge(cardSchedule);
export type Card = z.infer<typeof card>;
