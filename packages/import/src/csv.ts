import { CARD_TEXT_MAX, HINT_MAX } from './limits';
import { NoteTally } from './notes';
import { htmlToText } from './text';
import type { ImportCard, ImportDeck, ImportPreview } from './types';

/**
 * Delimited text: a spreadsheet export, or the "notes in plain text" export
 * of the source app, whose `#` header lines are honoured. Two columns are
 * enough, question then answer; a third is a hint. No history: a text file
 * carries none.
 */

interface Directives {
  separator: string | null;
  html: boolean;
  deckColumn: number | null;
  /** Columns that are bookkeeping, not card text. */
  skip: Set<number>;
}

const SEPARATORS: Record<string, string> = {
  tab: '\t',
  comma: ',',
  semicolon: ';',
  pipe: '|',
  colon: ':',
  space: ' ',
};

function readDirectives(lines: string[]): { directives: Directives; body: string[] } {
  const directives: Directives = { separator: null, html: false, deckColumn: null, skip: new Set() };
  let i = 0;
  for (; i < lines.length; i += 1) {
    const line = lines[i] as string;
    if (!line.startsWith('#')) break;
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(1, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();
    if (key === 'separator') {
      directives.separator = SEPARATORS[value.toLowerCase()] ?? (value.length === 1 ? value : null);
    } else if (key === 'html') {
      directives.html = value.toLowerCase() === 'true';
    } else if (key === 'deck column') {
      const column = Number(value) - 1;
      if (Number.isInteger(column) && column >= 0) {
        directives.deckColumn = column;
        directives.skip.add(column);
      }
    } else if (key.endsWith(' column')) {
      // tags, notetype, guid: kept out of the card text.
      const column = Number(value) - 1;
      if (Number.isInteger(column) && column >= 0) directives.skip.add(column);
    }
  }
  return { directives, body: lines.slice(i) };
}

/**
 * Whichever of tab, comma and semicolon the first lines use most. Tab wins
 * ties. Several lines, not one: a first row with a comma in its answer would
 * otherwise turn a tab separated file into commas.
 */
export function detectSeparator(sample: string): string {
  const count = (ch: string) => sample.split(ch).length - 1;
  const tabs = count('\t');
  const commas = count(',');
  const semis = count(';');
  if (tabs >= commas && tabs >= semis) return '\t';
  return commas >= semis ? ',' : ';';
}

/** RFC 4180 fields: quotes, doubled quotes, and newlines inside quotes. */
export function parseRows(text: string, separator: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] as string;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === separator) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const FRONT_HEADINGS = /^(front|question|term|word|prompt)$/i;
const BACK_HEADINGS = /^(back|answer|definition|meaning|response)$/i;
const LOOKS_LIKE_HTML = /<\/?[a-z][^>]*>|&[a-z#0-9]+;/i;

export function parseCsv(input: string, options: { deckName: string }): ImportPreview {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const { directives, body } = readDirectives(text.split(/\r\n|\r|\n/));
  const sample = body
    .filter((line) => line.trim() !== '')
    .slice(0, 20)
    .join('\n');
  const separator = directives.separator ?? detectSeparator(sample);

  const rows = parseRows(body.join('\n'), separator).filter((row) =>
    row.some((cell) => cell.trim() !== ''),
  );

  const first = rows[0];
  const hasHeader =
    first !== undefined &&
    // Rows are kept only when a cell has text, so a first cell always exists.
    FRONT_HEADINGS.test((first[0] as string).trim()) &&
    BACK_HEADINGS.test((first[1] ?? '').trim());
  const data = hasHeader ? rows.slice(1) : rows;

  const tally = new NoteTally();
  const clean = (cell: string): string => {
    const raw = cell.trim();
    if (!directives.html && !LOOKS_LIKE_HTML.test(raw)) return raw.replace(/[ \t]+/g, ' ');
    const { text: plain, media } = htmlToText(raw);
    if (media > 0) tally.add('media');
    return plain;
  };

  const decks = new Map<string, ImportCard[]>();
  for (const row of data) {
    const cells = row.filter((_, index) => !directives.skip.has(index));
    let front = clean(cells[0] ?? '');
    let back = clean(cells[1] ?? '');
    const hint = clean(cells[2] ?? '').slice(0, HINT_MAX);
    if (front === '' || back === '') {
      tally.add('empty-card');
      continue;
    }
    if (front.length > CARD_TEXT_MAX || back.length > CARD_TEXT_MAX) {
      tally.add('truncated');
      front = front.slice(0, CARD_TEXT_MAX);
      back = back.slice(0, CARD_TEXT_MAX);
    }
    const deckName =
      directives.deckColumn !== null
        ? (row[directives.deckColumn] ?? '').trim().split('::').join(' / ') || options.deckName
        : options.deckName;
    const list = decks.get(deckName) ?? [];
    list.push({ front, back, ...(hint ? { hint } : {}), suspended: false, reviews: [] });
    decks.set(deckName, list);
  }

  const out: ImportDeck[] = [...decks.entries()].map(([name, cards]) => ({
    name,
    cards,
    reviewCount: 0,
  }));

  return {
    format: 'csv',
    decks: out,
    cardCount: out.reduce((n, d) => n + d.cards.length, 0),
    reviewCount: 0,
    notes: tally.list(),
  };
}
