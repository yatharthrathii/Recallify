import { z } from 'zod';
import { cuid, isoDate } from './common';

/**
 * AI card generation.
 *
 * The model never writes to the database, and neither does this endpoint. Its
 * output is parsed, each card is validated against `generatedCard`, and what
 * survives comes back as drafts. The user reads them and saves the ones worth
 * keeping through `POST /cards/bulk` with `source: 'AI'`.
 *
 * That review step is there because it was needed, not for ceremony. Measured
 * against real output, even the stronger of the two models occasionally
 * produced a confident, wrong card ("Article 12 lists the Fundamental Rights"),
 * and a wrong card saved straight into a review schedule gets memorised.
 */

/**
 * Notes are capped well below what the model could read. The free tier allows
 * 8,000 tokens per minute per model for the whole app, and 10,000 characters is
 * roughly 2,500 tokens -- a single request at the old 20,000-character limit
 * would have spent most of a minute's budget for every user at once.
 */
export const MAX_NOTES_CHARS = 10_000;

export const generateRequest = z
  .object({
    /** Where the drafts are meant to go. Checked for ownership before any quota is spent. */
    deckId: cuid,
    count: z.number().int().min(1).max(20).default(10),
    /** A subject to generate from. */
    topic: z.string().trim().min(3).max(200).optional(),
    /** Or the user's own notes to turn into cards. */
    text: z.string().trim().min(50).max(MAX_NOTES_CHARS).optional(),
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

/**
 * The envelope the model is asked to return. Cards inside it are validated one
 * by one rather than all-or-nothing, so one overlong answer costs one card, not
 * the whole generation.
 */
export const generateResponse = z.object({
  cards: z.array(z.unknown()),
});
export type GenerateResponse = z.infer<typeof generateResponse>;

/**
 * Remaining allowance.
 *
 * `dailyLimit` is read from the user's stored allowance rather than a constant.
 * Generation is the only feature here with a real marginal cost, which makes it
 * the only honest candidate for a paid tier later; storing the number keeps
 * that a config change instead of a refactor. There is no billing.
 *
 * Counted in cards, not requests, and reset at midnight UTC.
 */
export const aiUsage = z.object({
  usedToday: z.number().int().min(0),
  dailyLimit: z.number().int().min(0),
  remaining: z.number().int().min(0),
  resetsAt: isoDate,
});
export type AiUsage = z.infer<typeof aiUsage>;

export const generateResult = z.object({
  deckId: cuid,
  /** Unsaved. Post the ones worth keeping to /cards/bulk with source 'AI'. */
  drafts: z.array(generatedCard),
  /** Cards the model returned that failed validation or repeated an earlier one. */
  discarded: z.number().int().min(0),
  /** Which model actually answered -- the primary, or the fallback. */
  model: z.string(),
  usage: aiUsage,
});
export type GenerateResult = z.infer<typeof generateResult>;

/**
 * Reporting AI output.
 *
 * Google Play requires apps with generative AI to let users flag offensive
 * output from inside the app. "Incorrect" is here too, because a wrong card is
 * the failure that was actually observed.
 *
 * The text is stored as a snapshot rather than as a card id: a draft that was
 * never saved has no id, and a report must survive the card being deleted.
 */
export const aiReportReason = z.enum(['offensive', 'incorrect', 'other']);

export const aiReportRequest = z.object({
  front: z.string().trim().min(1).max(300),
  back: z.string().trim().min(1).max(2000),
  reason: aiReportReason,
  note: z.string().trim().max(500).optional(),
  /** Which model produced it, if the client still has that from the generate response. */
  model: z.string().max(100).optional(),
});
export type AiReportRequest = z.infer<typeof aiReportRequest>;
