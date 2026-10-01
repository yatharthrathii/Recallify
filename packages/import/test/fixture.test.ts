import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { zstdCompressSync } from 'node:zlib';
import { strToU8 } from 'fflate';
import initSqlJs from 'sql.js';
import { describe, expect, it } from 'vitest';
import { parseApkg } from '../src/apkg';
import { buildModernCollection, zipApkg, type FixtureSpec } from './build-apkg';

/**
 * The end-to-end fixture: `apps/e2e/fixtures/sample.apkg`.
 *
 * Built here, from a spec, in the current collection format, so the browser
 * test exercises the zstd and protobuf path a real export takes. Three decks
 * in three note types, 85 cards, and about 500 reviews over six months, so
 * the Memory Report made from it includes a fit. Run with WRITE_FIXTURE=1 to
 * regenerate the file; otherwise this only checks the spec still parses.
 */

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 20, 9);
const BASIC = 1_700_000_000_001;
const REVERSED = 1_700_000_000_002;
const CLOZE = 1_700_000_000_003;

const CAPITALS: [string, string][] = [
  ['France', 'Paris'], ['Japan', 'Tokyo'], ['Kenya', 'Nairobi'], ['Peru', 'Lima'], ['Norway', 'Oslo'],
  ['Egypt', 'Cairo'], ['Chile', 'Santiago'], ['Poland', 'Warsaw'], ['Thailand', 'Bangkok'], ['Ghana', 'Accra'],
  ['Portugal', 'Lisbon'], ['Vietnam', 'Hanoi'], ['Cuba', 'Havana'], ['Nepal', 'Kathmandu'], ['Austria', 'Vienna'],
  ['Morocco', 'Rabat'], ['Finland', 'Helsinki'], ['Jordan', 'Amman'], ['Uruguay', 'Montevideo'], ['Iceland', 'Reykjavik'],
  ['Mongolia', 'Ulaanbaatar'], ['Senegal', 'Dakar'], ['Bolivia', 'Sucre'], ['Latvia', 'Riga'], ['Oman', 'Muscat'],
];

const VOCAB: [string, string][] = [
  ['犬', 'dog'], ['猫', 'cat'], ['水', 'water'], ['山', 'mountain'], ['川', 'river'],
  ['本', 'book'], ['人', 'person'], ['日', 'day, sun'], ['月', 'month, moon'], ['火', 'fire'],
  ['木', 'tree'], ['金', 'gold, money'], ['土', 'earth, soil'], ['学校', 'school'], ['先生', 'teacher'],
  ['友達', 'friend'], ['電車', 'train'], ['時間', 'time'], ['今日', 'today'], ['明日', 'tomorrow'],
];

const CLOZES: [string, string][] = [
  ['The {{c1::mitochondrion}} is the site of {{c2::aerobic respiration}}.', 'Powerhouse of the cell.'],
  ['DNA is copied during the {{c1::S phase}} of the cell cycle, before {{c2::mitosis}}.', ''],
  ['Photosynthesis takes place in the {{c1::chloroplast}} and produces {{c2::glucose}}.', ''],
  ['A {{c1::ribosome}} builds proteins by reading {{c2::messenger RNA}}.', ''],
  ['Water moves across a membrane by {{c1::osmosis}}, from {{c2::low}} to high solute concentration.', ''],
  ['The {{c1::nucleus}} holds the chromosomes; the {{c2::nucleolus}} makes ribosomes.', ''],
  ['Enzymes are {{c1::proteins}} that lower a reaction\'s {{c2::activation energy}}.', ''],
  ['Red blood cells carry oxygen bound to {{c1::haemoglobin}}, which contains {{c2::iron}}.', ''],
  ['Insulin is made in the {{c1::pancreas}} and lowers blood {{c2::glucose}}.', ''],
  ['Neurons pass signals across a {{c1::synapse}} using {{c2::neurotransmitters}}.', 'Chemical, not electrical, at the gap.'],
];

/** Reviews at growing gaps, with a lapse now and then. Deterministic. */
function history(cardIndex: number, cardId: number, revlog: FixtureSpec['revlog'], startDaysAgo: number): void {
  const gaps = [0, 1, 3, 7, 15, 30, 55, 90, 130, 170];
  const start = NOW - startDaysAgo * DAY + ((cardIndex * 7) % 11) * DAY;
  let t = start;
  for (let i = 0; i < gaps.length; i += 1) {
    t = start + gaps[i]! * DAY + ((cardIndex + i) % 5) * 3_600_000;
    if (t > NOW - DAY) break;
    const lapse = (cardIndex + i) % 9 === 4;
    // Ids are epoch milliseconds and must be unique across the log.
    revlog.push({
      id: t + cardIndex * 1000,
      cid: cardId,
      ease: lapse ? 1 : (cardIndex + i) % 6 === 0 ? 4 : 3,
      time: 3000 + ((cardIndex * 13 + i * 7) % 9) * 800,
      type: i === 0 ? 0 : lapse ? 1 : 1,
    });
    if (lapse) {
      // A relearning step ten minutes later.
      revlog.push({ id: t + 600_000 + cardIndex * 1000, cid: cardId, ease: 3, time: 2500, type: 2 });
    }
  }
}

export function sampleSpec(): FixtureSpec {
  const spec: FixtureSpec = {
    decks: [
      { id: 1, name: 'Default' },
      { id: 10, name: 'World capitals' },
      { id: 11, name: 'Japanese::Vocabulary' },
      { id: 12, name: 'Biology' },
    ],
    notetypes: [
      {
        id: BASIC,
        name: 'Basic',
        cloze: false,
        fields: ['Front', 'Back'],
        templates: [{ name: 'Card 1', qfmt: '{{Front}}', afmt: '{{FrontSide}}<hr id=answer>{{Back}}' }],
      },
      {
        id: REVERSED,
        name: 'Basic (and reversed card)',
        cloze: false,
        fields: ['Front', 'Back'],
        templates: [
          { name: 'Card 1', qfmt: '{{Front}}', afmt: '{{FrontSide}}<hr id=answer>{{Back}}' },
          { name: 'Card 2', qfmt: '{{Back}}', afmt: '{{FrontSide}}<hr id=answer>{{Front}}' },
        ],
      },
      {
        id: CLOZE,
        name: 'Cloze',
        cloze: true,
        fields: ['Text', 'Back Extra'],
        templates: [{ name: 'Cloze', qfmt: '{{cloze:Text}}', afmt: '{{cloze:Text}}<br>{{Back Extra}}' }],
      },
    ],
    notes: [],
    cards: [],
    revlog: [],
  };

  let noteId = 1_700_000_100_000;
  let cardId = 1_700_000_200_000;
  let index = 0;

  CAPITALS.forEach(([country, capital], i) => {
    noteId += 1;
    cardId += 1;
    spec.notes.push({ id: noteId, mid: BASIC, fields: [`Capital of <b>${country}</b>?`, capital], tags: 'geography' });
    spec.cards.push({ id: cardId, nid: noteId, did: 10, ord: 0, queue: i === 3 ? -1 : 0 });
    // The last two are still new.
    if (i < CAPITALS.length - 2) history(index, cardId, spec.revlog, 180);
    index += 1;
  });

  VOCAB.forEach(([word, meaning], i) => {
    noteId += 1;
    spec.notes.push({ id: noteId, mid: REVERSED, fields: [word, meaning], tags: 'n5' });
    for (const ord of [0, 1]) {
      cardId += 1;
      spec.cards.push({ id: cardId, nid: noteId, did: 11, ord });
      if (i < VOCAB.length - 1) history(index, cardId, spec.revlog, 150);
      index += 1;
    }
  });

  CLOZES.forEach(([text, extra], i) => {
    noteId += 1;
    spec.notes.push({ id: noteId, mid: CLOZE, fields: [text, extra], tags: 'cells' });
    for (const ord of [0, 1]) {
      cardId += 1;
      spec.cards.push({ id: cardId, nid: noteId, did: 12, ord });
      if (i < CLOZES.length - 1) history(index, cardId, spec.revlog, 120);
      index += 1;
    }
  });

  // An image-only card, which the preview must report as skipped.
  noteId += 1;
  cardId += 1;
  spec.notes.push({ id: noteId, mid: BASIC, fields: ['<img src="map.png">', 'Only a picture'] });
  spec.cards.push({ id: cardId, nid: noteId, did: 10, ord: 0 });
  // A manual reschedule, which is not a review.
  spec.revlog.push({ id: NOW - 2 * DAY, cid: cardId - 1, ease: 0, type: 4 });

  return spec;
}

describe('the end-to-end fixture', () => {
  it('parses to three decks with a fit-sized history', async () => {
    const SQL = await initSqlJs();
    const bytes = zipApkg({
      'collection.anki2': strToU8('stub: open with a newer client'),
      'collection.anki21b': zstdCompressSync(buildModernCollection(SQL, sampleSpec())),
      media: strToU8('{}'),
    });
    const preview = parseApkg(bytes, SQL);

    expect(preview.decks.map((d) => d.name)).toEqual(['Biology', 'Japanese / Vocabulary', 'World capitals']);
    expect(preview.cardCount).toBe(85);
    expect(preview.reviewCount).toBeGreaterThanOrEqual(450);
    expect(preview.decks.flatMap((d) => d.cards).filter((c) => c.suspended)).toHaveLength(1);
    expect(preview.notes.map((n) => n.code).sort()).toEqual(['empty-card', 'media', 'skipped-review']);

    if (process.env['WRITE_FIXTURE']) {
      const dir = join(__dirname, '..', '..', '..', 'apps', 'e2e', 'fixtures');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'sample.apkg'), bytes);
      writeFileSync(
        join(dir, 'sample.csv'),
        'Front,Back,Hint\nCapital of Spain?,Madrid,Iberia\n"Largest ocean?","Pacific",\nBoiling point of water at sea level?,100 °C,\n',
      );
    }
  });
});
