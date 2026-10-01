import { CHUNK_BYTES_MAX, CHUNK_CARDS_MAX, CHUNK_REVIEWS_MAX } from './limits';
import type { ImportCard, ImportDeck } from './types';

export interface ImportChunk {
  readonly cards: readonly ImportCard[];
  readonly reviewCount: number;
}

/** JSON bytes per review, in the shape the request carries: id, rating, time, duration. */
const REVIEW_BYTES = 120;
/** Punctuation and field names around one card. */
const CARD_OVERHEAD_BYTES = 80;

/**
 * Roughly what a card weighs on the wire. Text is counted at three bytes a
 * character, the UTF-8 worst case for the scripts flashcards are written in;
 * it overestimates ASCII, which errs on the side of a smaller request.
 */
export function estimateCardBytes(card: ImportCard): number {
  const text = card.front.length + card.back.length + (card.hint?.length ?? 0);
  return text * 3 + CARD_OVERHEAD_BYTES + card.reviews.length * REVIEW_BYTES;
}

/**
 * A deck split into requests.
 *
 * Cards and their histories go up together, because the server replays each
 * card's reviews to compute its state, and a history split across two
 * requests would be replayed as two shorter ones. So a chunk closes when it
 * holds enough cards, enough reviews or enough bytes, whichever comes first,
 * and a card never straddles two. A single card over the byte budget travels
 * alone; the contracts cap its text, so it still fits.
 */
export function chunkDeck(
  deck: ImportDeck,
  limits: { cards?: number; reviews?: number; bytes?: number } = {},
): ImportChunk[] {
  const maxCards = limits.cards ?? CHUNK_CARDS_MAX;
  const maxReviews = limits.reviews ?? CHUNK_REVIEWS_MAX;
  const maxBytes = limits.bytes ?? CHUNK_BYTES_MAX;

  const chunks: ImportChunk[] = [];
  let cards: ImportCard[] = [];
  let reviews = 0;
  let bytes = 0;

  for (const card of deck.cards) {
    const size = estimateCardBytes(card);
    const full =
      cards.length > 0 &&
      (cards.length >= maxCards ||
        reviews + card.reviews.length > maxReviews ||
        bytes + size > maxBytes);
    if (full) {
      chunks.push({ cards, reviewCount: reviews });
      cards = [];
      reviews = 0;
      bytes = 0;
    }
    cards.push(card);
    reviews += card.reviews.length;
    bytes += size;
  }
  if (cards.length > 0) chunks.push({ cards, reviewCount: reviews });
  return chunks;
}
