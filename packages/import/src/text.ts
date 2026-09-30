/**
 * Card text is plain text here. A note in the source app is HTML with images
 * and audio attached; this keeps the words and counts what it had to leave
 * behind, so the preview can say "412 cards referred to images that were not
 * imported" rather than quietly shipping cards with holes in them.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  middot: '·',
  bull: '•',
  deg: '°',
  times: '×',
  divide: '÷',
  plusmn: '±',
  euro: '€',
  pound: '£',
  yen: '¥',
  copy: '©',
  reg: '®',
  trade: '™',
  laquo: '«',
  raquo: '»',
  rarr: '→',
  larr: '←',
  uarr: '↑',
  darr: '↓',
  ne: '≠',
  le: '≤',
  ge: '≥',
  micro: 'µ',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  pi: 'π',
  sigma: 'σ',
  omega: 'ω',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

export interface TextResult {
  readonly text: string;
  /** Images, audio and video the text referred to. */
  readonly media: number;
}

/** A regular expression matching one media reference, in either syntax the app uses. */
const MEDIA = /\[sound:[^\]]*\]|<(?:img|audio|video|source|object|embed)\b[^>]*>/gi;

/**
 * HTML to plain text, keeping line structure where the HTML had it.
 *
 * Not a browser's DOM parser: this runs in a web worker-sized budget on tens
 * of thousands of notes, and it also runs in Node for the tests. The rules
 * cover what card editors actually produce, which is `br`, `div`, `p`, lists
 * and inline formatting, plus the maths and media tags particular to cards.
 */
export function htmlToText(html: string): TextResult {
  let media = 0;
  let s = html.replace(MEDIA, () => {
    media += 1;
    return '';
  });

  // Nothing inside these is card text.
  s = s.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Maths is kept as its delimiters, which is how the source app stores the
  // older syntax too.
  s = s
    .replace(/<anki-mathjax\s+block="?true"?[^>]*>([\s\S]*?)<\/anki-mathjax>/gi, '\\[$1\\]')
    .replace(/<anki-mathjax[^>]*>([\s\S]*?)<\/anki-mathjax>/gi, '\\($1\\)');

  // A line break the author typed is kept, so two of them make a blank line.
  // A block boundary only separates lines: `<div>a</div><div>b</div>` is two
  // lines, not two paragraphs, which is how card editors write every line.
  const BREAK = '\u0001';
  s = s
    .replace(/<br\s*\/?>/gi, BREAK)
    .replace(/<hr\s*\/?>/gi, '\n')
    .replace(/<\/?(?:p|div|li|tr|h[1-6]|blockquote|pre|table|ul|ol|dd|dt)\b[^>]*>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<[^>]+>/g, '');

  s = decodeEntities(s);

  const lines = s
    .replace(/\r\n?/g, '\n')
    .replace(/\n[\n \t\u00a0]*\n/g, '\n')
    .replace(new RegExp(BREAK, 'g'), '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim());

  const text = lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text, media };
}
