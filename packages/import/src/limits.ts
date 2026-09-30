/**
 * The same ceilings the API's contracts enforce. Applied here, at read time,
 * so the preview already shows what will be sent rather than failing a chunk
 * halfway through an import.
 */
export const CARD_TEXT_MAX = 4000;
export const HINT_MAX = 500;
export const DURATION_MAX_MS = 600_000;

/**
 * A card's history is capped at its most recent reviews. Nothing real gets
 * near this; it bounds one request's size against a corrupt log.
 */
export const REVIEWS_PER_CARD_MAX = 2000;

/** One request to the API. Sized to stay well under a serverless body limit. */
export const CHUNK_CARDS_MAX = 500;
export const CHUNK_REVIEWS_MAX = 5000;
