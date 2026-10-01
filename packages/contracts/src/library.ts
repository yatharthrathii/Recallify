import { z } from 'zod';
import { cuid, isoDate, pageQuery } from './common';
import { deckColor } from './deck';

/**
 * Live decks.
 *
 * An author publishes a deck. A subscriber gets a copy whose cards point back
 * at the author's. When the author edits a card, the text reaches every copy
 * on its next sync; the subscriber's stability, difficulty and review log for
 * that card are untouched, because card content and memory state have been
 * separate tables since the schema was drawn. An author's addition arrives as
 * a new card, a deletion as a suspension, and never as a deletion of anything
 * a subscriber has reviewed. A card the author had suspended arrives
 * suspended. While a deck follows its source, its copied cards cannot be
 * deleted, only suspended: the next sync would bring them straight back.
 */

export const deckChangeKind = z.enum(['ADDED', 'EDITED', 'REMOVED', 'NOTE']);
export type DeckChangeKind = z.infer<typeof deckChangeKind>;

export const deckChange = z.object({
  id: z.string(),
  kind: deckChangeKind,
  /** The author's card, when the change is about one. */
  cardId: cuid.nullable(),
  /** The card's question (cut short), a count, or the author's note in full. */
  summary: z.string(),
  createdAt: isoDate,
});
export type DeckChange = z.infer<typeof deckChange>;

/** A published deck as the library shows it. */
export const libraryDeck = z.object({
  id: cuid,
  title: z.string(),
  description: z.string().nullable(),
  color: deckColor,
  authorName: z.string(),
  cardCount: z.number().int().min(0),
  subscriberCount: z.number().int().min(0),
  /** Null only when the author is looking at a deck of their own that is not published. */
  publishedAt: isoDate.nullable(),
  /** The most recent change, or the publish date. */
  updatedAt: isoDate,
  /** True when the caller is the author. */
  isMine: z.boolean(),
  /** The caller's copy, when subscribed. */
  subscribedDeckId: cuid.nullable(),
});
export type LibraryDeck = z.infer<typeof libraryDeck>;

export const libraryDeckDetail = libraryDeck.extend({
  /** The first few cards, so a visitor can judge the deck before subscribing. */
  sampleCards: z.array(z.object({ front: z.string(), back: z.string() })),
  /** Newest first. */
  changes: z.array(deckChange),
});
export type LibraryDeckDetail = z.infer<typeof libraryDeckDetail>;

export const libraryQuery = pageQuery.extend({
  q: z.string().trim().max(80).optional(),
});
export type LibraryQuery = z.infer<typeof libraryQuery>;

export const deckNoteRequest = z.object({
  text: z.string().trim().min(1).max(500),
});
export type DeckNoteRequest = z.infer<typeof deckNoteRequest>;

/** What a sync did to the copy. */
export const syncResult = z.object({
  added: z.number().int().min(0),
  edited: z.number().int().min(0),
  /** Suspended in the copy, never deleted. */
  removed: z.number().int().min(0),
  syncedAt: isoDate,
});
export type SyncResult = z.infer<typeof syncResult>;

/** Where a subscribed copy stands against its source. */
export const subscriptionStatus = z.object({
  deckId: cuid,
  /** Null when the author has unpublished or deleted the source: the copy stays as it is. */
  source: libraryDeck.nullable(),
  syncedAt: isoDate.nullable(),
  /** What a sync would do right now. */
  pending: z.object({
    added: z.number().int().min(0),
    edited: z.number().int().min(0),
    removed: z.number().int().min(0),
  }),
  /** The author's changes since the last sync, newest first. */
  changes: z.array(deckChange),
});
export type SubscriptionStatus = z.infer<typeof subscriptionStatus>;

export const deckChangesPage = z.object({
  items: z.array(deckChange),
  nextCursor: z.string().nullable(),
});
export type DeckChangesPage = z.infer<typeof deckChangesPage>;
