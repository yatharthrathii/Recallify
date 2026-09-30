import { unzipSync } from 'fflate';
import { decompress } from 'fzstd';
import type { Database, SqlJsStatic } from 'sql.js';
import { CARD_TEXT_MAX, DURATION_MAX_MS, HINT_MAX, REVIEWS_PER_CARD_MAX } from './limits';
import { NoteTally } from './notes';
import { protoString, protoVarint, readFields } from './protobuf';
import { renderTemplate } from './template';
import { htmlToText } from './text';
import type { ImportCard, ImportDeck, ImportPreview, ImportRating, ImportReview } from './types';

/**
 * A `.apkg` file is a zip holding a SQLite collection and, optionally, media.
 *
 * Three generations of collection are found in the wild:
 *
 *   collection.anki2     schema 11, note types and decks as JSON in `col`
 *   collection.anki21    the same schema, written by newer clients
 *   collection.anki21b   schema 18, zstd-compressed; note types, templates and
 *                        decks in their own tables, configured in protobuf
 *
 * A file exported without "legacy support" contains only the last, plus a
 * one-note stub in the first that says to upgrade. The newest present is read.
 *
 * Nothing is scheduled from the file's own state. Every review in its log is
 * carried across and the API replays them through this scheduler, so a card's
 * stability is one this engine computed rather than a number translated from
 * another model. A card with no reviews arrives new, and the preview says so.
 */

export class ImportError extends Error {
  override readonly name = 'ImportError';
}

interface NoteType {
  readonly name: string;
  readonly cloze: boolean;
  readonly fields: readonly string[];
  readonly templates: readonly { name: string; qfmt: string; afmt: string }[];
}

interface Note {
  readonly mid: number;
  readonly fields: readonly string[];
  readonly tags: string;
}

const FIELD_SEPARATOR = '\x1f';

/**
 * A stable id from the source's own identifiers: the review's id (its epoch
 * millisecond) and the card's. It reads as a version 4 UUID to the API's
 * validator, and the same review always yields the same id, which is what
 * lets a second import of the same file be refused instead of counted twice.
 */
export function reviewIdFor(revlogId: number, cardId: number): string {
  const hex = (n: number, width: number) =>
    Math.floor(Math.abs(n)).toString(16).padStart(width, '0').slice(-width);
  const r = hex(revlogId, 12);
  const c = hex(cardId, 12);
  const mid = hex(Math.floor(cardId / 4096) % 4096, 3);
  return `${r.slice(0, 8)}-${r.slice(8, 12)}-4${hex(cardId % 4096, 3)}-8${mid}-${c}`;
}

function pickCollection(files: Record<string, Uint8Array>): Uint8Array {
  const modern = files['collection.anki21b'];
  if (modern) {
    try {
      return decompress(modern);
    } catch {
      throw new ImportError('The collection inside this file is compressed in a way that could not be read.');
    }
  }
  const legacy = files['collection.anki21'] ?? files['collection.anki2'];
  if (legacy) return legacy;
  throw new ImportError('This is not a deck export: no collection was found inside it.');
}

function tableNames(db: Database): Set<string> {
  const names = new Set<string>();
  const stmt = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  while (stmt.step()) names.add(String(stmt.get()[0]));
  stmt.free();
  return names;
}

function readDecks(db: Database, tables: Set<string>, colDecks: string): Map<number, string> {
  const decks = new Map<number, string>();
  if (tables.has('decks')) {
    const stmt = db.prepare('SELECT id, name FROM decks');
    while (stmt.step()) {
      const [id, name] = stmt.get();
      decks.set(Number(id), String(name).split(FIELD_SEPARATOR).join(' / '));
    }
    stmt.free();
    return decks;
  }
  const parsed = JSON.parse(colDecks || '{}') as Record<string, { name?: string }>;
  for (const [id, deck] of Object.entries(parsed)) {
    decks.set(Number(id), String(deck.name ?? 'Deck').split('::').join(' / '));
  }
  return decks;
}

function readNoteTypes(db: Database, tables: Set<string>, colModels: string): Map<number, NoteType> {
  const types = new Map<number, NoteType>();
  if (tables.has('notetypes')) {
    const fieldsByType = new Map<number, string[]>();
    const fields = db.prepare('SELECT ntid, ord, name FROM fields ORDER BY ntid, ord');
    while (fields.step()) {
      const [ntid, , name] = fields.get();
      const list = fieldsByType.get(Number(ntid)) ?? [];
      list.push(String(name));
      fieldsByType.set(Number(ntid), list);
    }
    fields.free();

    const templatesByType = new Map<number, NoteType['templates'][number][]>();
    const templates = db.prepare('SELECT ntid, ord, name, config FROM templates ORDER BY ntid, ord');
    while (templates.step()) {
      const [ntid, , name, config] = templates.get();
      const proto = readFields(config as Uint8Array);
      const list = templatesByType.get(Number(ntid)) ?? [];
      list.push({ name: String(name), qfmt: protoString(proto, 1), afmt: protoString(proto, 2) });
      templatesByType.set(Number(ntid), list);
    }
    templates.free();

    const notetypes = db.prepare('SELECT id, name, config FROM notetypes');
    while (notetypes.step()) {
      const [id, name, config] = notetypes.get();
      const proto = readFields(config as Uint8Array);
      types.set(Number(id), {
        name: String(name),
        cloze: protoVarint(proto, 1) === 1,
        fields: fieldsByType.get(Number(id)) ?? [],
        templates: templatesByType.get(Number(id)) ?? [],
      });
    }
    notetypes.free();
    return types;
  }

  interface LegacyModel {
    name?: string;
    type?: number;
    flds?: { name: string; ord: number }[];
    tmpls?: { name: string; ord: number; qfmt: string; afmt: string }[];
  }
  const parsed = JSON.parse(colModels || '{}') as Record<string, LegacyModel>;
  for (const [id, model] of Object.entries(parsed)) {
    const byOrd = <T extends { ord: number }>(items: T[] | undefined) =>
      [...(items ?? [])].sort((a, b) => a.ord - b.ord);
    types.set(Number(id), {
      name: String(model.name ?? 'Note'),
      cloze: model.type === 1,
      fields: byOrd(model.flds).map((f) => f.name),
      templates: byOrd(model.tmpls).map((t) => ({ name: t.name, qfmt: t.qfmt, afmt: t.afmt })),
    });
  }
  return types;
}

function readNotes(db: Database): Map<number, Note> {
  const notes = new Map<number, Note>();
  const stmt = db.prepare('SELECT id, mid, flds, tags FROM notes');
  while (stmt.step()) {
    const [id, mid, flds, tags] = stmt.get();
    notes.set(Number(id), {
      mid: Number(mid),
      fields: String(flds).split(FIELD_SEPARATOR),
      tags: String(tags ?? '').trim(),
    });
  }
  stmt.free();
  return notes;
}

/**
 * The review log, grouped by card.
 *
 * Skipped: entries with no rating, and the two kinds that are not reviews at
 * all: a manual reschedule (type 4) and a "set due date" (type 5). Learning,
 * review, relearning and filtered-deck reviews (0 to 3) are all real answers
 * and are kept.
 */
function readReviews(db: Database, tally: NoteTally): Map<number, ImportReview[]> {
  const byCard = new Map<number, ImportReview[]>();
  const stmt = db.prepare('SELECT id, cid, ease, time, type FROM revlog ORDER BY id');
  while (stmt.step()) {
    const [id, cid, rating, time, type] = stmt.get().map(Number) as [
      number,
      number,
      number,
      number,
      number,
    ];
    if (!(rating >= 1 && rating <= 4) || type >= 4 || !(id > 0)) {
      tally.add('skipped-review');
      continue;
    }
    const duration = Math.min(DURATION_MAX_MS, Math.max(0, Math.round(time)));
    const list = byCard.get(cid) ?? [];
    list.push({
      id: reviewIdFor(id, cid),
      rating: rating as ImportRating,
      reviewedAt: id,
      ...(duration > 0 ? { durationMs: duration } : {}),
    });
    byCard.set(cid, list);
  }
  stmt.free();
  return byCard;
}

/** The card's own cloze number: card N of a cloze note shows deletion N+1. */
function clozeOrdFor(type: NoteType, ord: number): number | null {
  return type.cloze ? ord + 1 : null;
}

export function parseApkg(bytes: Uint8Array, sql: SqlJsStatic): ImportPreview {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new ImportError('This file could not be opened as a deck export.');
  }

  const db = new sql.Database(pickCollection(files));
  try {
    return readCollection(db);
  } finally {
    db.close();
  }
}

function readCollection(db: Database): ImportPreview {
  const tables = tableNames(db);
  if (!tables.has('cards') || !tables.has('notes') || !tables.has('col')) {
    throw new ImportError('The collection inside this file is missing its card tables.');
  }

  const col = db.exec('SELECT models, decks FROM col LIMIT 1')[0]?.values[0] ?? ['{}', '{}'];
  const deckNames = readDecks(db, tables, String(col[1] ?? '{}'));
  const noteTypes = readNoteTypes(db, tables, String(col[0] ?? '{}'));
  const notes = readNotes(db);

  const tally = new NoteTally();
  const reviewsByCard = tables.has('revlog') ? readReviews(db, tally) : new Map<number, ImportReview[]>();

  const decks = new Map<number, ImportCard[]>();
  const stmt = db.prepare('SELECT id, nid, did, odid, ord, queue FROM cards ORDER BY id');
  while (stmt.step()) {
    const [id, nid, did, odid, ord, queue] = stmt.get().map(Number) as [
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    const history = reviewsByCard.get(id) ?? [];

    const note = notes.get(nid);
    const type = note ? noteTypes.get(note.mid) : undefined;
    if (!note || !type) {
      tally.add('unknown-notetype');
      tally.add('skipped-review', history.length);
      continue;
    }

    const template = type.cloze ? type.templates[0] : type.templates[ord];
    if (!template) {
      tally.add('unknown-notetype');
      tally.add('skipped-review', history.length);
      continue;
    }

    // A card in a filtered deck belongs to the deck it came from.
    const deckId = odid ? odid : did;
    const deckName = deckNames.get(deckId) ?? 'Imported';
    const fields = new Map(type.fields.map((name, i) => [name, note.fields[i] ?? '']));
    const base = {
      fields,
      clozeOrd: clozeOrdFor(type, ord),
      deckName,
      cardName: template.name,
      noteTypeName: type.name,
      tags: note.tags,
    };

    const front = renderTemplate(template.qfmt, { ...base, side: 'front' });
    const back = renderTemplate(template.afmt, { ...base, side: 'back' });
    const frontText = htmlToText(front.html);
    const backText = htmlToText(back.html);
    if (frontText.media + backText.media > 0) tally.add('media');

    if (frontText.text === '' || backText.text === '') {
      tally.add('empty-card');
      tally.add('skipped-review', history.length);
      continue;
    }
    if (frontText.text.length > CARD_TEXT_MAX || backText.text.length > CARD_TEXT_MAX) {
      tally.add('truncated');
    }

    // Newest kept, if a log is somehow longer than the cap.
    const reviews =
      history.length > REVIEWS_PER_CARD_MAX ? history.slice(-REVIEWS_PER_CARD_MAX) : history;
    tally.add('skipped-review', history.length - reviews.length);

    const card: ImportCard = {
      front: frontText.text.slice(0, CARD_TEXT_MAX),
      back: backText.text.slice(0, CARD_TEXT_MAX),
      ...(front.hint ? { hint: (front.hint as string).slice(0, HINT_MAX) } : {}),
      suspended: queue === -1,
      reviews,
    };
    const list = decks.get(deckId) ?? [];
    list.push(card);
    decks.set(deckId, list);
  }
  stmt.free();

  const out: ImportDeck[] = [...decks.entries()]
    .map(([deckId, cards]) => ({
      name: deckNames.get(deckId) ?? 'Imported',
      cards,
      reviewCount: cards.reduce((n, c) => n + c.reviews.length, 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    format: 'apkg',
    decks: out,
    cardCount: out.reduce((n, d) => n + d.cards.length, 0),
    reviewCount: out.reduce((n, d) => n + d.reviewCount, 0),
    notes: tally.list(),
  };
}
