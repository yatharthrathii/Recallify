import {
  CARD_TEXT_MAX,
  HINT_MAX,
  IMPORT_CARDS_MAX,
  IMPORT_DURATION_MAX_MS,
  IMPORT_REVIEWS_MAX,
  IMPORT_REVIEWS_PER_CARD_MAX,
} from '@recallify/contracts';

/**
 * The ceilings the API's contracts enforce, applied here at read time so the
 * preview already shows what will be sent rather than failing a chunk halfway
 * through an import. They are the contracts' own numbers, re-exported under
 * the reader's names, so the two cannot drift.
 */
export { CARD_TEXT_MAX, HINT_MAX };
export const DURATION_MAX_MS = IMPORT_DURATION_MAX_MS;

/**
 * A card's history is capped at its most recent reviews. Nothing real gets
 * near this; it bounds one request's size against a corrupt log.
 */
export const REVIEWS_PER_CARD_MAX = IMPORT_REVIEWS_PER_CARD_MAX;

/**
 * One request to the API: whole cards, up to these counts, and under a byte
 * budget as well, because five hundred cards of long text would pass the
 * counts and still exceed a serverless body limit. The API accepts 4 MB; the
 * budget leaves room for JSON punctuation and the estimate being rough.
 */
export const CHUNK_CARDS_MAX = IMPORT_CARDS_MAX;
export const CHUNK_REVIEWS_MAX = IMPORT_REVIEWS_MAX;
export const CHUNK_BYTES_MAX = 2_500_000;
