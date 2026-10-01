import { strToU8, zipSync } from 'fflate';
import type { SqlJsStatic } from 'sql.js';

/**
 * Builds `.apkg` files for the tests, in both collection formats.
 *
 * Nothing here is copied from a real export. The schemas are the documented
 * ones, and writing the fixture from a spec means each test can say exactly
 * which note, template and log entry it is about.
 */

export interface FixtureNoteType {
  id: number;
  name: string;
  cloze: boolean;
  fields: string[];
  templates: { name: string; qfmt: string; afmt: string }[];
}

export interface FixtureSpec {
  decks: { id: number; name: string }[];
  notetypes: FixtureNoteType[];
  notes: { id: number; mid: number; fields: string[]; tags?: string }[];
  cards: { id: number; nid: number; did: number; ord: number; queue?: number; odid?: number }[];
  revlog: { id: number; cid: number; ease: number; time?: number; type?: number }[];
}

const SEP = '\x1f';

const COMMON = `
CREATE TABLE col (id integer primary key, crt integer, mod integer, scm integer, ver integer, dty integer, usn integer, ls integer, conf text, models text, decks text, dconf text, tags text);
CREATE TABLE notes (id integer primary key, guid text, mid integer, mod integer, usn integer, tags text, flds text, sfld integer, csum integer, flags integer, data text);
CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer, mod integer, usn integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, left integer, odue integer, odid integer, flags integer, data text);
CREATE TABLE revlog (id integer primary key, cid integer, usn integer, ease integer, ivl integer, lastIvl integer, factor integer, time integer, type integer);
`;

function insertRows(db: import('sql.js').Database, spec: FixtureSpec): void {
  for (const n of spec.notes) {
    db.run('INSERT INTO notes VALUES (?, ?, ?, 0, 0, ?, ?, 0, 0, 0, "")', [
      n.id,
      `guid${n.id}`,
      n.mid,
      n.tags ?? '',
      n.fields.join(SEP),
    ]);
  }
  for (const c of spec.cards) {
    db.run('INSERT INTO cards VALUES (?, ?, ?, ?, 0, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, ?, 0, "")', [
      c.id,
      c.nid,
      c.did,
      c.ord,
      c.queue ?? 0,
      c.odid ?? 0,
    ]);
  }
  for (const r of spec.revlog) {
    db.run('INSERT INTO revlog VALUES (?, ?, 0, ?, 0, 0, 0, ?, ?)', [
      r.id,
      r.cid,
      r.ease,
      r.time ?? 4000,
      r.type ?? 1,
    ]);
  }
}

/** Schema 11: note types and decks are JSON in the `col` row. */
export function buildLegacyCollection(SQL: SqlJsStatic, spec: FixtureSpec): Uint8Array {
  const db = new SQL.Database();
  db.run(COMMON);
  const models = Object.fromEntries(
    spec.notetypes.map((t) => [
      t.id,
      {
        id: t.id,
        name: t.name,
        type: t.cloze ? 1 : 0,
        // Out of order on purpose: the reader must sort by ord.
        flds: t.fields.map((name, ord) => ({ name, ord })).reverse(),
        tmpls: t.templates.map((tm, ord) => ({ ...tm, ord })).reverse(),
      },
    ]),
  );
  const decks = Object.fromEntries(spec.decks.map((d) => [d.id, { id: d.id, name: d.name }]));
  db.run('INSERT INTO col VALUES (1, 0, 0, 0, 11, 0, 0, 0, "{}", ?, ?, "{}", "{}")', [
    JSON.stringify(models),
    JSON.stringify(decks),
  ]);
  insertRows(db, spec);
  const bytes = db.export();
  db.close();
  return bytes;
}

// --- a minimal protobuf writer, for the schema 18 tables -------------------

function varint(n: number): number[] {
  const out: number[] = [];
  let v = n;
  while (v >= 0x80) {
    out.push((v % 0x80) | 0x80);
    v = Math.floor(v / 0x80);
  }
  out.push(v);
  return out;
}

export function protoVarintField(number: number, value: number): number[] {
  return [...varint(number * 8), ...varint(value)];
}

export function protoStringField(number: number, value: string): number[] {
  const bytes = strToU8(value);
  return [...varint(number * 8 + 2), ...varint(bytes.length), ...bytes];
}

/** Schema 18: separate tables, protobuf configs, the JSON columns empty. */
export function buildModernCollection(SQL: SqlJsStatic, spec: FixtureSpec): Uint8Array {
  const db = new SQL.Database();
  db.run(COMMON);
  db.run(`
    CREATE TABLE decks (id integer primary key, name text, mtime_secs integer, usn integer, common blob, kind blob);
    CREATE TABLE notetypes (id integer primary key, name text, mtime_secs integer, usn integer, config blob);
    CREATE TABLE fields (ntid integer, ord integer, name text, config blob, PRIMARY KEY (ntid, ord));
    CREATE TABLE templates (ntid integer, ord integer, name text, mtime_secs integer, usn integer, config blob, PRIMARY KEY (ntid, ord));
  `);
  db.run('INSERT INTO col VALUES (1, 0, 0, 0, 18, 0, 0, 0, "{}", "{}", "{}", "{}", "{}")');
  for (const d of spec.decks) {
    db.run('INSERT INTO decks VALUES (?, ?, 0, 0, X\'\', X\'\')', [d.id, d.name.split('::').join(SEP)]);
  }
  for (const t of spec.notetypes) {
    // Field 3 (css) is present so the reader has to skip a field it does not
    // want; the kind is only written when it is not the default, as proto3 does.
    const config = [
      ...(t.cloze ? protoVarintField(1, 1) : []),
      ...protoVarintField(2, 0),
      ...protoStringField(3, '.card { }'),
    ];
    db.run('INSERT INTO notetypes VALUES (?, ?, 0, 0, ?)', [t.id, t.name, Uint8Array.from(config)]);
    t.fields.forEach((name, ord) => {
      db.run('INSERT INTO fields VALUES (?, ?, ?, ?)', [t.id, ord, name, Uint8Array.from(protoVarintField(1, 0))]);
    });
    t.templates.forEach((tm, ord) => {
      const tconfig = [...protoStringField(1, tm.qfmt), ...protoStringField(2, tm.afmt)];
      db.run('INSERT INTO templates VALUES (?, ?, ?, 0, 0, ?)', [t.id, ord, tm.name, Uint8Array.from(tconfig)]);
    });
  }
  insertRows(db, spec);
  const bytes = db.export();
  db.close();
  return bytes;
}

export function zipApkg(entries: Record<string, Uint8Array>): Uint8Array {
  return zipSync(entries, { level: 6 });
}

export function legacyApkg(SQL: SqlJsStatic, spec: FixtureSpec): Uint8Array {
  return zipApkg({
    'collection.anki2': buildLegacyCollection(SQL, spec),
    media: strToU8('{}'),
  });
}
