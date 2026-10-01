import { elapsedDays, retrievability, type FsrsParams } from '@recallify/fsrs';

/**
 * Mean predicted recall over the cards that have a memory to measure.
 *
 * A NEW card has no memory yet, so averaging it in as either 0 or 1 would be
 * a made-up number; it is left out, and null is returned when nothing is
 * left. Decks, stats and the report all quote this figure, from here.
 */
export function meanRetrievability(
  params: FsrsParams,
  cards: readonly { stability: number; lastReviewedAt: Date | null }[],
  now: Date,
): number | null {
  let sum = 0;
  let seen = 0;
  for (const card of cards) {
    if (!card.lastReviewedAt) continue;
    seen += 1;
    sum += retrievability(params, elapsedDays(card.lastReviewedAt, now), card.stability);
  }
  return seen > 0 ? sum / seen : null;
}
