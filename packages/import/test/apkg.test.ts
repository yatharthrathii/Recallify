import { strToU8 } from 'fflate';
import { zstdCompressSync } from 'node:zlib';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { ImportError, parseApkg, reviewIdFor } from '../src/apkg';
import {
  buildLegacyCollection,
  buildModernCollection,
  legacyApkg,
  zipApkg,
} from './build-apkg';
import { BASIC, daysAgoMs, smallSpec } from './spec';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs();
});

describe('parseApkg, legacy collection', () => {
  it('reads decks, renders each note type, and keeps the history', () => {
    const preview = parseApkg(legacyApkg(SQL, smallSpec()), SQL);

    expect(preview.format).toBe('apkg');
    expect(preview.decks.map((d) => d.name)).toEqual(['Biology', 'Geography', 'Japanese / Vocab']);

    const geography = preview.decks[1]!;
    const fronts = geography.cards.map((c) => c.front);
    // The picture-only card is gone; the suspended one and the filtered-deck
    // copy are present.
    expect(fronts).toEqual([
      'Capital of France?',
      'Capital of Japan?\nisland',
      'Suspended?',
      'Capital of France?',
    ]);
    expect(geography.cards[1]!.back).toBe('Tokyo & not Kyoto');
    expect(geography.cards[0]!.back).toBe('Paris (no extra)');
    expect(geography.cards[2]!.suspended).toBe(true);
    expect(geography.cards[0]!.suspended).toBe(false);

    // Six real answers; the reschedule and the unrated entry are dropped.
    const history = geography.cards[0]!.reviews;
    expect(history.map((r) => r.rating)).toEqual([3, 3, 1, 3, 4, 3]);
    expect(history[0]!.reviewedAt).toBe(daysAgoMs(30));
    expect(history[0]!.durationMs).toBe(5200);
    expect(history[1]!.durationMs).toBe(4000);
    // Capped at the contract's ceiling.
    expect(history[4]!.durationMs).toBe(600_000);
    expect(history.every((r) => UUID.test(r.id))).toBe(true);
    expect(geography.reviewCount).toBe(6);

    const japanese = preview.decks[2]!;
    expect(japanese.cards.map((c) => [c.front, c.back, c.hint])).toEqual([
      ['犬', 'dog', 'an animal'],
      ['dog', '犬', undefined],
    ]);

    const biology = preview.decks[0]!;
    expect(biology.cards.map((c) => c.front)).toEqual([
      'The [...] makes ATP.',
      'The mitochondrion makes [energy currency].',
    ]);
    expect(biology.cards[0]!.back).toBe('The mitochondrion makes ATP.\nPowerhouse.');
    // A zero duration is omitted rather than sent as 0.
    expect(biology.cards[0]!.reviews).toEqual([
      expect.not.objectContaining({ durationMs: expect.anything() }),
    ]);

    expect(preview.cardCount).toBe(8);
    expect(preview.reviewCount).toBe(7);
    expect(Object.fromEntries(preview.notes.map((n) => [n.code, n.count]))).toEqual({
      media: 1,
      // The picture, and the note with no answer field.
      'empty-card': 2,
      // 1 unrated + 1 reschedule + 1 zero id + the picture card's + the orphan's.
      'skipped-review': 5,
      // Missing type, missing note, ord past the templates, and a bare type.
      'unknown-notetype': 4,
    });
    for (const note of preview.notes) expect(note.message).toMatch(/\d/);
  });

  it('makes the same review id from the same source ids, and only then', () => {
    expect(reviewIdFor(1_700_000_000_000, 1_600_000_000_001)).toBe(
      reviewIdFor(1_700_000_000_000, 1_600_000_000_001),
    );
    expect(reviewIdFor(1_700_000_000_000, 1_600_000_000_001)).not.toBe(
      reviewIdFor(1_700_000_000_001, 1_600_000_000_001),
    );
    expect(reviewIdFor(1_700_000_000_000, 1_600_000_000_001)).not.toBe(
      reviewIdFor(1_700_000_000_000, 1_600_000_000_002),
    );
    expect(reviewIdFor(1, 2)).toMatch(UUID);
  });

  it('shortens text past the ceiling, and keeps only the newest reviews of an absurd log', () => {
    const spec = smallSpec();
    spec.notes.push({ id: 201, mid: BASIC, fields: ['x'.repeat(5000), 'y'.repeat(4500), ''] });
    spec.cards.push({ id: 2001, nid: 201, did: 10, ord: 0 });
    for (let i = 0; i < 2005; i += 1) {
      spec.revlog.push({ id: daysAgoMs(400) + i * 60_000, cid: 2001, ease: 3, type: 1 });
    }
    const preview = parseApkg(legacyApkg(SQL, spec), SQL);
    const long = preview.decks
      .flatMap((d) => d.cards)
      .find((c) => c.front.startsWith('xxx'))!;
    expect(long.front).toHaveLength(4000);
    expect(long.back).toHaveLength(4000);
    expect(long.reviews).toHaveLength(2000);
    expect(long.reviews[0]!.reviewedAt).toBe(daysAgoMs(400) + 5 * 60_000);
    const notes = Object.fromEntries(preview.notes.map((n) => [n.code, n.count]));
    expect(notes['truncated']).toBe(1);
    expect(notes['skipped-review']).toBe(5 + 5);
  });

  it('reads the newer legacy file name and copes with an empty col row', () => {
    const spec = smallSpec();
    spec.revlog = [];
    const bytes = zipApkg({ 'collection.anki21': buildLegacyCollection(SQL, spec) });
    const preview = parseApkg(bytes, SQL);
    expect(preview.cardCount).toBe(8);
    expect(preview.reviewCount).toBe(0);
    expect(preview.notes.find((n) => n.code === 'skipped-review')).toBeUndefined();
  });

  it('reads a model that declares no fields or templates and a deck with no name', () => {
    const db = new SQL.Database();
    db.run(`
      CREATE TABLE col (id integer primary key, models text, decks text);
      CREATE TABLE notes (id integer primary key, mid integer, flds text, tags text);
      CREATE TABLE cards (id integer primary key, nid integer, did integer, odid integer, ord integer, queue integer);
    `);
    db.run('INSERT INTO col VALUES (1, ?, ?)', [JSON.stringify({ 8: {} }), JSON.stringify({ 3: {} })]);
    db.run('INSERT INTO notes VALUES (1, 8, "q", "")');
    db.run('INSERT INTO cards VALUES (1, 1, 3, 0, 0, 0)');
    const bytes = zipApkg({ 'collection.anki2': db.export() });
    db.close();

    const preview = parseApkg(bytes, SQL);
    expect(preview.cardCount).toBe(0);
    expect(preview.notes).toEqual([expect.objectContaining({ code: 'unknown-notetype', count: 1 })]);
  });

  it('treats empty or null col columns as no decks and no note types', () => {
    for (const columns of [['', ''], [null, null]]) {
      const db = new SQL.Database();
      db.run(`
        CREATE TABLE col (id integer primary key, models text, decks text);
        CREATE TABLE notes (id integer primary key, mid integer, flds text, tags text);
        CREATE TABLE cards (id integer primary key, nid integer, did integer, odid integer, ord integer, queue integer);
      `);
      db.run('INSERT INTO col VALUES (1, ?, ?)', columns);
      db.run('INSERT INTO notes VALUES (1, 8, "q", "")');
      db.run('INSERT INTO cards VALUES (1, 1, 3, 0, 0, 0)');
      const bytes = zipApkg({ 'collection.anki2': db.export() });
      db.close();
      const preview = parseApkg(bytes, SQL);
      expect(preview.cardCount).toBe(0);
      expect(preview.decks).toEqual([]);
    }
  });

  it('keeps the reviews of a file whose col row is fine but whose revlog is empty', () => {
    const spec = smallSpec();
    spec.revlog = [];
    const preview = parseApkg(legacyApkg(SQL, spec), SQL);
    expect(preview.reviewCount).toBe(0);
    expect(preview.notes.find((n) => n.code === 'skipped-review')).toBeUndefined();
  });

  it('survives a collection with no revlog table and a nameless deck', () => {
    const db = new SQL.Database();
    db.run(`
      CREATE TABLE col (id integer primary key, models text, decks text);
      CREATE TABLE notes (id integer primary key, mid integer, flds text, tags text);
      CREATE TABLE cards (id integer primary key, nid integer, did integer, odid integer, ord integer, queue integer);
    `);
    const models = { 7: { name: 'Basic', flds: [{ name: 'Front', ord: 0 }, { name: 'Back', ord: 1 }], tmpls: [{ name: 'c', ord: 0, qfmt: '{{Front}}', afmt: '{{Back}}' }] } };
    db.run('INSERT INTO col VALUES (1, ?, ?)', [JSON.stringify(models), JSON.stringify({ 3: {} })]);
    db.run('INSERT INTO notes VALUES (1, 7, ?, NULL)', ['q\x1fa']);
    db.run('INSERT INTO cards VALUES (1, 1, 3, 0, 0, 0)');
    db.run('INSERT INTO cards VALUES (2, 1, 4, 0, 0, 0)');
    const bytes = zipApkg({ 'collection.anki2': db.export() });
    db.close();

    const preview = parseApkg(bytes, SQL);
    expect(preview.decks.map((d) => d.name)).toEqual(['Deck', 'Imported']);
    expect(preview.reviewCount).toBe(0);
  });

  it('copes with a col table that has no row', () => {
    const db = new SQL.Database();
    db.run(`
      CREATE TABLE col (id integer primary key, models text, decks text);
      CREATE TABLE notes (id integer primary key, mid integer, flds text, tags text);
      CREATE TABLE cards (id integer primary key, nid integer, did integer, odid integer, ord integer, queue integer);
    `);
    const bytes = zipApkg({ 'collection.anki2': db.export() });
    db.close();
    expect(parseApkg(bytes, SQL).cardCount).toBe(0);
  });
});

describe('parseApkg, current collection', () => {
  const zstd = typeof zstdCompressSync === 'function';

  it.skipIf(!zstd)('reads the zstd-compressed schema with protobuf configs', () => {
    const spec = smallSpec();
    const bytes = zipApkg({
      'collection.anki2': strToU8('stub'),
      'collection.anki21b': zstdCompressSync(buildModernCollection(SQL, spec)),
    });
    const modern = parseApkg(bytes, SQL);
    const legacy = parseApkg(legacyApkg(SQL, spec), SQL);
    // Same file, two encodings, one result.
    expect(modern).toEqual(legacy);
  });

  it('refuses a compressed collection that is not zstd', () => {
    const bytes = zipApkg({ 'collection.anki21b': strToU8('not zstd at all') });
    expect(() => parseApkg(bytes, SQL)).toThrow(ImportError);
    expect(() => parseApkg(bytes, SQL)).toThrow(/compressed/);
  });
});

describe('parseApkg, bad input', () => {
  it('refuses something that is not a zip', () => {
    expect(() => parseApkg(strToU8('hello'), SQL)).toThrow(ImportError);
    expect(() => parseApkg(strToU8('hello'), SQL)).toThrow(/could not be opened/);
  });

  it('refuses a zip with no collection inside', () => {
    const bytes = zipApkg({ 'readme.txt': strToU8('nothing here') });
    expect(() => parseApkg(bytes, SQL)).toThrow(/no collection/);
  });

  it('refuses a collection without the card tables', () => {
    const db = new SQL.Database();
    db.run('CREATE TABLE col (id integer primary key)');
    const bytes = zipApkg({ 'collection.anki2': db.export() });
    db.close();
    expect(() => parseApkg(bytes, SQL)).toThrow(/missing its card tables/);
  });
});
