import { z } from 'zod';
import { cuid } from './common';

/**
 * AI card generation.
 *
 * The model never writes to the database. Its output is parsed, validated
 * against `generatedCard` below, and only then persisted -- so a malformed or
 * adversarial response is rejected rather than stored.
 */

export const generateRequest = z
  .object({
    deckId: cuid,
    count: z.number().int().min(1).max(20).default(10),
    /** A subject to generate from. */
    topic: z.string().trim().min(3).max(200).optional(),
    /** Or the user's own notes to turn into cards. */
    text: z.string().trim().min(50).max(20_000).optional(),
  })
  .refine((v) => Boolean(v.topic) !== Boolean(v.text), {
    message: 'Provide either a topic or some text, not both',
    path: ['topic'],
  });
export type GenerateRequest = z.infer<typeof generateRequest>;

export const generatedCard = z.object({
  front: z.string().trim().min(3).max(300),
  back: z.string().trim().min(1).max(2000),
  hint: z.string().trim().max(200).optional(),
});
export type GeneratedCard = z.infer<typeof generatedCard>;

/** The shape the model is asked to return. Anything else is rejected. */
export const generateResponse = z.object({
  cards: z.array(generatedCard).min(1).max(20),
});
export type GenerateResponse = z.infer<typeof generateResponse>;

/**
 * Remaining allowance.
 *
 * `dailyLimit` is read from the user's stored allowance rather than a constant.
 * Generation is the only feature here with a real marginal cost, which makes it
 * the only honest candidate for a paid tier later; storing the number keeps
 * that a config change instead of a refactor. There is no billing.
 */
export const aiUsage = z.object({
  usedToday: z.number().int().min(0),
  dailyLimit: z.number().int().min(0),
  remaining: z.number().int().min(0),
  resetsAt: z.coerce.date(),
});
export type AiUsage = z.infer<typeof aiUsage>;
