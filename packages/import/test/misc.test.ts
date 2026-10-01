import { describe, expect, it } from 'vitest';
import { chunkDeck, estimateCardBytes } from '../src/chunk';
import { NoteTally } from '../src/notes';
import { protoString, protoVarint, readFields } from '../src/protobuf';
import type { ImportCard, ImportDeck } from '../src/types';
import { protoStringField, protoVarintField } from './build-apkg';

function card(reviews: number): ImportCard {
  return {
    front: 'q',
    back: 'a',
    suspended: false,
    reviews: Array.from({ length: reviews }, (_, i) => ({
      id: `id-${i}`,
      rating: 3 as const,
      reviewedAt: i,
    })),
  };
}

function deck(cards: ImportCard[]): ImportDeck {
  return { name: 'd', cards, reviewCount: cards.reduce((n, c) => n + c.reviews.length, 0) };
}

describe('chunkDeck', () => {
  it('closes a chunk on the card limit', () => {
    const chunks = chunkDeck(deck([card(0), card(0), card(0)]), { cards: 2 });
    expect(chunks.map((c) => c.cards.length)).toEqual([2, 1]);
  });

  it('closes a chunk when the next card would push reviews past the limit', () => {
    const chunks = chunkDeck(deck([card(3), card(3), card(1), card(10)]), { reviews: 5 });
    expect(chunks.map((c) => [c.cards.length, c.reviewCount])).toEqual([
      [1, 3],
      [2, 4],
      [1, 10],
    ]);
  });

  it('closes a chunk on the byte budget, and a card over it travels alone', () => {
    const long = { ...card(0), front: 'x'.repeat(1000), back: 'y'.repeat(1000), hint: 'h'.repeat(100) };
    const size = estimateCardBytes(long);
    expect(size).toBeGreaterThan(6000);
    const chunks = chunkDeck(deck([long, long, long]), { bytes: size * 2 });
    expect(chunks.map((c) => c.cards.length)).toEqual([2, 1]);
    const huge = { ...card(0), front: 'x'.repeat(4000), back: 'y'.repeat(4000) };
    expect(chunkDeck(deck([huge, card(0)]), { bytes: 100 }).map((c) => c.cards.length)).toEqual([1, 1]);
  });

  it('returns nothing for an empty deck and uses the defaults', () => {
    expect(chunkDeck(deck([]))).toEqual([]);
    const many = deck(Array.from({ length: 501 }, () => card(1)));
    expect(chunkDeck(many).map((c) => c.cards.length)).toEqual([500, 1]);
  });
});

describe('protobuf reader', () => {
  it('reads varints and strings, skips fixed-width fields', () => {
    const bytes = Uint8Array.from([
      ...protoVarintField(1, 300),
      ...protoStringField(2, 'héllo'),
      // field 3, wire type 1 (fixed64) and field 4, wire type 5 (fixed32)
      3 * 8 + 1, 1, 2, 3, 4, 5, 6, 7, 8,
      4 * 8 + 5, 9, 9, 9, 9,
      ...protoVarintField(5, 7),
    ]);
    const fields = readFields(bytes);
    expect(protoVarint(fields, 1)).toBe(300);
    expect(protoString(fields, 2)).toBe('héllo');
    expect(protoVarint(fields, 5)).toBe(7);
    expect(protoVarint(fields, 9)).toBe(0);
    expect(protoString(fields, 9)).toBe('');
    expect(fields.map((f) => f.number)).toEqual([1, 2, 5]);
  });

  it('refuses truncated or unknown encodings', () => {
    expect(() => readFields(Uint8Array.from([8]))).toThrow(/varint/);
    expect(() => readFields(Uint8Array.from([8, 0x80]))).toThrow(/varint/);
    expect(() => readFields(Uint8Array.from([2 * 8 + 2, 5, 1]))).toThrow(/field/);
    expect(() => readFields(Uint8Array.from([1 * 8 + 3]))).toThrow(/wire type/);
  });
});

describe('NoteTally', () => {
  it('ignores non-positive counts and words each line for its count', () => {
    const tally = new NoteTally();
    tally.add('media', 0);
    tally.add('media', -2);
    expect(tally.list()).toEqual([]);
    tally.add('media');
    tally.add('empty-card', 2);
    tally.add('truncated');
    tally.add('skipped-review');
    tally.add('unknown-notetype');
    const lines = tally.list();
    expect(lines.map((l) => l.message)).toEqual([
      expect.stringMatching(/^1 card refers/),
      expect.stringMatching(/^2 cards were skipped/),
      expect.stringMatching(/^1 card was shortened/),
      expect.stringMatching(/^1 review was left out/),
      expect.stringMatching(/^1 card uses a note type/),
    ]);
  });
});
