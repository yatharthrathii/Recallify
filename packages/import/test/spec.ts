import type { FixtureSpec } from './build-apkg';

/** Epoch ms of a day in the past, plus an hour offset. */
export function daysAgoMs(days: number, now = Date.UTC(2026, 8, 25, 9)): number {
  return now - days * 86_400_000;
}

export const BASIC = 1_600_000_000_001;
export const REVERSED = 1_600_000_000_002;
export const CLOZE = 1_600_000_000_003;
/** A note type with no fields and no templates: nothing can be rendered from it. */
export const BARE = 1_600_000_000_004;

/**
 * A small collection that exercises everything the reader has to handle:
 * three note types, a nested deck name, a filtered deck, a suspended card, an
 * image-only card, a card whose note type is missing, and log entries that
 * are not reviews.
 */
export function smallSpec(): FixtureSpec {
  return {
    decks: [
      { id: 1, name: 'Default' },
      { id: 10, name: 'Geography' },
      { id: 11, name: 'Japanese::Vocab' },
      { id: 12, name: 'Biology' },
      { id: 13, name: 'Cram' },
    ],
    notetypes: [
      {
        id: BASIC,
        name: 'Basic',
        cloze: false,
        fields: ['Front', 'Back', 'Extra'],
        templates: [
          {
            name: 'Card 1',
            qfmt: '{{Front}}{{#Extra}}<br><i>{{Extra}}</i>{{/Extra}}',
            afmt: '{{FrontSide}}<hr id=answer>{{Back}}{{^Extra}} (no extra){{/Extra}}',
          },
        ],
      },
      {
        id: REVERSED,
        name: 'Basic (and reversed card)',
        cloze: false,
        fields: ['Front', 'Back', 'Hint'],
        templates: [
          { name: 'Card 1', qfmt: '{{Front}}{{hint:Hint}}', afmt: '{{FrontSide}}<hr>{{type:Back}}' },
          { name: 'Card 2', qfmt: '{{Back}}', afmt: '{{FrontSide}}<hr>{{Front}}' },
        ],
      },
      {
        id: CLOZE,
        name: 'Cloze',
        cloze: true,
        fields: ['Text', 'Back Extra'],
        templates: [
          { name: 'Cloze', qfmt: '{{cloze:Text}}', afmt: '{{cloze:Text}}<br>{{Back Extra}}' },
        ],
      },
      { id: BARE, name: 'Bare', cloze: false, fields: [], templates: [] },
    ],
    notes: [
      { id: 101, mid: BASIC, fields: ['Capital of France?', 'Paris', ''], tags: 'europe' },
      { id: 102, mid: BASIC, fields: ['Capital of <b>Japan</b>?', 'Tokyo &amp; not Kyoto', 'island'] },
      { id: 103, mid: BASIC, fields: ['<img src="map.png">', 'Only a picture', ''] },
      { id: 104, mid: REVERSED, fields: ['犬', 'dog', 'an animal'] },
      { id: 105, mid: CLOZE, fields: ['The {{c1::mitochondrion}} makes {{c2::ATP::energy currency}}.', 'Powerhouse.'] },
      { id: 106, mid: 999, fields: ['orphan', 'no note type'] },
      { id: 107, mid: BASIC, fields: ['Suspended?', 'Yes', ''] },
      { id: 108, mid: BARE, fields: ['nothing to render'] },
      // Fewer fields than the note type declares: no Back, so no answer side.
      { id: 109, mid: REVERSED, fields: ['Short note'] },
    ],
    cards: [
      { id: 1001, nid: 101, did: 10, ord: 0 },
      { id: 1002, nid: 102, did: 10, ord: 0 },
      { id: 1003, nid: 103, did: 10, ord: 0 },
      { id: 1004, nid: 104, did: 11, ord: 0 },
      { id: 1005, nid: 104, did: 11, ord: 1 },
      { id: 1006, nid: 105, did: 12, ord: 0 },
      { id: 1007, nid: 105, did: 12, ord: 1 },
      { id: 1008, nid: 106, did: 12, ord: 0 },
      { id: 1009, nid: 107, did: 10, ord: 0, queue: -1 },
      // In the filtered deck "Cram" right now, but belongs to Geography.
      { id: 1010, nid: 101, did: 13, odid: 10, ord: 0 },
      // A card whose note is missing entirely.
      { id: 1011, nid: 12345, did: 10, ord: 0 },
      // A card whose ord has no template.
      { id: 1012, nid: 101, did: 10, ord: 5 },
      { id: 1013, nid: 108, did: 10, ord: 0 },
      { id: 1014, nid: 109, did: 10, ord: 0 },
    ],
    revlog: [
      { id: daysAgoMs(30), cid: 1001, ease: 3, time: 5200, type: 0 },
      { id: daysAgoMs(29), cid: 1001, ease: 3, type: 0 },
      { id: daysAgoMs(20), cid: 1001, ease: 1, type: 1 },
      { id: daysAgoMs(19), cid: 1001, ease: 3, type: 2 },
      { id: daysAgoMs(10), cid: 1001, ease: 4, type: 1, time: 900_000 },
      { id: daysAgoMs(5), cid: 1001, ease: 3, type: 3 },
      // Not reviews: a manual reschedule and an entry with no rating.
      { id: daysAgoMs(4), cid: 1001, ease: 0, type: 4 },
      { id: daysAgoMs(3), cid: 1001, ease: 3, type: 5 },
      { id: daysAgoMs(15), cid: 1003, ease: 3, type: 0 },
      { id: daysAgoMs(8), cid: 1008, ease: 3, type: 0 },
      { id: daysAgoMs(12), cid: 1006, ease: 3, type: 0, time: 0 },
      { id: 0, cid: 1006, ease: 3, type: 0 },
    ],
  };
}
