import { describe, expect, it } from 'vitest';
import { detectSeparator, parseCsv, parseRows } from '../src/csv';

const deckName = 'Words';

describe('parseRows', () => {
  it('handles quotes, doubled quotes, and newlines inside quotes', () => {
    const rows = parseRows('a,"b, c","say ""hi""","multi\nline"\r\nx,y\n', ',');
    expect(rows).toEqual([
      ['a', 'b, c', 'say "hi"', 'multi\nline'],
      ['x', 'y'],
    ]);
  });

  it('keeps a last row without a trailing newline and a lone carriage return', () => {
    expect(parseRows('a\tb\rc\td', '\t')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('treats a quote in the middle of a field as text', () => {
    expect(parseRows('5" tall,x', ',')).toEqual([['5" tall', 'x']]);
  });
});

describe('detectSeparator', () => {
  it('picks the most frequent of tab, comma and semicolon', () => {
    expect(detectSeparator('a\tb\tc')).toBe('\t');
    expect(detectSeparator('a,b;c,d')).toBe(',');
    expect(detectSeparator('a;b;c,d')).toBe(';');
    expect(detectSeparator('a')).toBe('\t');
  });

  it('is not fooled by a comma in the first answer of a tab separated file', () => {
    const preview = parseCsv('q1\tHello, world\nq2\ta2\nq3\ta3', { deckName });
    expect(preview.decks[0]!.cards.map((c) => c.back)).toEqual(['Hello, world', 'a2', 'a3']);
  });
});

describe('parseCsv', () => {
  it('reads two columns with a header, and a third as the hint', () => {
    const preview = parseCsv('Front,Back,Hint\nchat,cat,animal\nchien,dog,\n', { deckName });
    expect(preview.format).toBe('csv');
    expect(preview.decks).toHaveLength(1);
    expect(preview.decks[0]!.name).toBe(deckName);
    expect(preview.decks[0]!.cards).toEqual([
      { front: 'chat', back: 'cat', hint: 'animal', suspended: false, reviews: [] },
      { front: 'chien', back: 'dog', suspended: false, reviews: [] },
    ]);
    expect(preview.cardCount).toBe(2);
    expect(preview.reviewCount).toBe(0);
    expect(preview.notes).toEqual([]);
  });

  it('does not mistake a first data row for a header', () => {
    expect(parseCsv('front,rear\nq,a', { deckName }).cardCount).toBe(2);
    // A one-column first row is not a header either, nor a card.
    const lone = parseCsv('front\nq,a', { deckName });
    expect(lone.cardCount).toBe(1);
    expect(lone.notes).toEqual([expect.objectContaining({ code: 'empty-card', count: 1 })]);
  });

  it('falls back to the given deck name when the deck column is missing or blank', () => {
    const missing = parseCsv('#deck column:5\nq,a', { deckName });
    expect(missing.decks[0]!.name).toBe(deckName);
    // Every column skipped leaves nothing to make a card from.
    const only = parseCsv('#deck column:1\nJust a deck', { deckName });
    expect(only.cardCount).toBe(0);
  });

  it('detects a tab separated file with a byte order mark and skips blank rows', () => {
    const preview = parseCsv('﻿q1\ta1\n\n  \t \nq2\ta2', { deckName });
    expect(preview.decks[0]!.cards.map((c) => c.front)).toEqual(['q1', 'q2']);
  });

  it('honours the plain text export directives', () => {
    const text = [
      '#separator:tab',
      '#html:true',
      '#guid column:1',
      '#notetype column:2',
      '#deck column:3',
      '#tags column:6',
      '#nonsense',
      '#bogus column:x',
      'g1\tBasic\tLang::French\tbon<br>jour\t<b>hello</b>\tgreet',
      'g2\tBasic\tLang::French\tmerci\tthanks <img src="x.png">\t',
      'g3\tBasic\t\tsalut\thi\t',
    ].join('\n');
    const preview = parseCsv(text, { deckName });
    expect(preview.decks.map((d) => d.name)).toEqual(['Lang / French', deckName]);
    expect(preview.decks[0]!.cards.map((c) => [c.front, c.back])).toEqual([
      ['bon\njour', 'hello'],
      ['merci', 'thanks'],
    ]);
    expect(preview.decks[1]!.cards[0]!.front).toBe('salut');
    expect(preview.notes).toEqual([expect.objectContaining({ code: 'media', count: 1 })]);
  });

  it('accepts a literal separator character and a semicolon file', () => {
    expect(parseCsv('#separator:|\na|b', { deckName }).cardCount).toBe(1);
    expect(parseCsv('#separator:nonsense\na;b\nc;d', { deckName }).cardCount).toBe(2);
    expect(parseCsv('#separator:semicolon\na;b', { deckName }).cardCount).toBe(1);
  });

  it('strips markup from a cell that plainly contains it, even without the directive', () => {
    const preview = parseCsv('a<br>b,<i>c</i> &amp; d', { deckName });
    expect(preview.decks[0]!.cards[0]).toMatchObject({ front: 'a\nb', back: 'c & d' });
  });

  it('skips rows missing a side and shortens overlong text', () => {
    const long = 'x'.repeat(4100);
    const preview = parseCsv(`only one\n,no front\n${long},${long}`, { deckName });
    expect(preview.cardCount).toBe(1);
    expect(preview.decks[0]!.cards[0]!.front).toHaveLength(4000);
    expect(Object.fromEntries(preview.notes.map((n) => [n.code, n.count]))).toEqual({
      'empty-card': 2,
      truncated: 1,
    });
  });

  it('collapses runs of spaces in plain cells', () => {
    expect(parseCsv('a   b,c', { deckName }).decks[0]!.cards[0]!.front).toBe('a b');
  });

  it('returns no decks for an empty file', () => {
    const preview = parseCsv('', { deckName });
    expect(preview.decks).toEqual([]);
    expect(preview.cardCount).toBe(0);
  });
});
