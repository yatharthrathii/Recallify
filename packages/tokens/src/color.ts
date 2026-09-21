/**
 * Colour tokens. The only place raw hex is allowed in this repo — everywhere
 * else ESLint rejects it. See docs/04-DESIGN-SYSTEM.md.
 *
 * Two palettes, one per theme, chosen by Yatharth from sites he liked rather
 * than from a generator. Light is blush paper with navy ink and a raspberry
 * accent. Dark is slate with a deep teal and the same raspberry, lifted.
 * No purple anywhere: the indigo/violet gradient is the single strongest
 * "generated template" signal there is.
 */

/** Surfaces and text. Light theme is the base definition. */
export const light = {
  bg: '#EEE2DC', // blush paper. The page is tinted; the panels are lighter than it
  surface: '#F8F1EC',
  surfaceAlt: '#E6D6CE',
  border: '#DDCBC1',
  borderStrong: '#BAB2B5',
  text: '#123C69', // navy ink, never black
  textMuted: '#55637F',
  textFaint: '#857F8B',
} as const;

export const dark = {
  bg: '#212A31', // slate, never #000
  surface: '#28333C',
  surfaceAlt: '#2E3944',
  border: '#37444F',
  borderStrong: '#4C5C68',
  text: '#D3D9D4',
  textMuted: '#9DB0B4',
  textFaint: '#748D92',
} as const;

/**
 * Brand colours: what is left of each palette once surfaces and text are
 * taken. `accent` marks the thing that wants attention (a due count, a link,
 * a focus ring). `brand` is the deep block colour behind full-bleed bands and
 * the auth panel, with `onBrand` as the text that sits on it. `highlight` is
 * the soft tint behind a marked word or a hovered row.
 */
export const brand = {
  accent: '#AC3B61', // raspberry
  brand: '#123C69', // navy
  onBrand: '#EEE2DC',
  highlight: '#EDC7B7', // peach
} as const;

export const brandOnDark = {
  accent: '#EE8FA9', // the same raspberry, lifted until it reads on slate
  brand: '#124E66', // deep teal
  onBrand: '#D3D9D4',
  highlight: '#124E66',
} as const;

/**
 * The memory scale — this is the product's data colour.
 *
 * Retrievability (probability the user can recall a card right now) maps to
 * hue. Used by the forgetting curve, the heatmap, deck badges, and the review
 * card border. Nothing else in the app may use these hues, or they stop
 * reading as data. The interactive accent is deliberately NOT on this scale.
 */
export const memory = {
  strong: '#0E7C66', // R >= 90%   deep teal
  good: '#3A8049', // R 75-90%   green
  fading: '#96620F', // R 50-75%   amber, darkened until it reads on blush
  weak: '#B1532F', // R 25-50%   terracotta
  lost: '#8C3A2E', // R < 25%    rust, never fire-engine red
} as const;

/** Kept as an alias: the base scale is already tuned for the light theme. */
export const memoryOnLight = memory;

/**
 * The deep end of the scale disappears against slate. Lifted for dark
 * backgrounds so every band stays legible as data; the hue of each band is
 * unchanged, only its lightness.
 */
export const memoryOnDark = {
  strong: '#3DB39A',
  good: '#5DB070',
  fading: '#D9993A',
  weak: '#DD8562',
  lost: '#CC6A58',
} as const;

/**
 * System feedback only. Kept distinct from the memory scale so the two are
 * never confused.
 */
export const status = {
  info: '#124E66',
  success: '#3A8049',
  warning: '#96620F',
  danger: '#A8321F',
} as const;

export const statusOnDark = {
  info: '#6FB0C9',
  success: '#5DB070',
  warning: '#D9993A',
  danger: '#E57362',
} as const;

/**
 * Deck labels. A small swatch beside a deck's name, nothing more.
 *
 * Deliberately chalky and low in saturation, so they cannot be mistaken for
 * the memory scale: a user picking "teal" for a deck must not look like that
 * deck is well remembered. They identify, they never measure.
 */
export const deck = {
  amber: '#D4B06A',
  teal: '#7FAFA8',
  clay: '#C49A84',
  moss: '#9AAE82',
  slate: '#8F9AA6',
  sand: '#CFC2A8',
} as const;

export type DeckColorName = keyof typeof deck;

export type MemoryLevel = keyof typeof memory;

/** Map a retrievability value in [0,1] to its band on the memory scale. */
export function memoryLevel(retrievability: number): MemoryLevel {
  if (retrievability >= 0.9) return 'strong';
  if (retrievability >= 0.75) return 'good';
  if (retrievability >= 0.5) return 'fading';
  if (retrievability >= 0.25) return 'weak';
  return 'lost';
}

export const color = {
  light,
  dark,
  brand,
  brandOnDark,
  memory,
  memoryOnLight,
  memoryOnDark,
  status,
  statusOnDark,
  deck,
} as const;
