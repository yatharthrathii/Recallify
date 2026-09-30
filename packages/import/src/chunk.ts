import { CHUNK_CARDS_MAX, CHUNK_REVIEWS_MAX } from './limits';
import type { ImportCard, ImportDeck } from './types';

export interface ImportChunk {
  readonly cards: readonly ImportCard[];
  readonly reviewCount: number;
}

/**
 * A deck split into requests.
 *
 * Cards and their histories go up together, because the server replays each
 * card's reviews to compute its state, and a history split across two
 * requests would be replayed as two shorter ones. So a chunk closes when it
 * holds enough cards or enough reviews, whichever comes first, and a card
 * never straddles two.
 */
export function chunkDeck(
  deck: ImportDeck,
  limits: { cards?: number; reviews?: number } = {},
): ImportChunk[] {
  const maxCards = limits.cards ?? CHUNK_CARDS_MAX;
  const maxReviews = limits.reviews ?? CHUNK_REVIEWS_MAX;

  const chunks: ImportChunk[] = [];
  let cards: ImportCard[] = [];
  let reviews = 0;

  for (const card of deck.cards) {
    const full =
      cards.length > 0 &&
      (cards.length >= maxCards || reviews + card.reviews.length > maxReviews);
    if (full) {
      chunks.push({ cards, reviewCount: reviews });
      cards = [];
      reviews = 0;
    }
    cards.push(card);
    reviews += card.reviews.length;
  }
  if (cards.length > 0) chunks.push({ cards, reviewCount: reviews });
  return chunks;
}
