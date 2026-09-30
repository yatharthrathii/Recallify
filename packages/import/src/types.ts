/**
 * What an import produces, whatever the file was.
 *
 * Both readers, .apkg and CSV, end in this one shape, and the API accepts only
 * this shape. The API therefore knows nothing about either format: a third
 * one would be a third reader here and nothing else.
 */

export type ImportRating = 1 | 2 | 3 | 4;

export interface ImportReview {
  /**
   * Made from the source's own identifiers, so the same review in the same
   * file always gets the same id. Importing a file twice then collides on the
   * review id and is refused, instead of doubling a person's history.
   */
  readonly id: string;
  readonly rating: ImportRating;
  /** Epoch milliseconds. A number rather than a Date so the preview is plain JSON. */
  readonly reviewedAt: number;
  readonly durationMs?: number;
}

export interface ImportCard {
  readonly front: string;
  readonly back: string;
  readonly hint?: string;
  readonly suspended: boolean;
  /** Oldest first. Empty for a card that was never reviewed, and for every CSV row. */
  readonly reviews: readonly ImportReview[];
}

export interface ImportDeck {
  readonly name: string;
  readonly cards: readonly ImportCard[];
  readonly reviewCount: number;
}

export type ImportNoteCode =
  | 'media'
  | 'empty-card'
  | 'truncated'
  | 'skipped-review'
  | 'unknown-notetype';

/** Something the reader could not carry across, counted rather than hidden. */
export interface ImportNote {
  readonly code: ImportNoteCode;
  readonly count: number;
  readonly message: string;
}

export interface ImportPreview {
  readonly format: 'apkg' | 'csv';
  readonly decks: readonly ImportDeck[];
  readonly cardCount: number;
  readonly reviewCount: number;
  readonly notes: readonly ImportNote[];
}
