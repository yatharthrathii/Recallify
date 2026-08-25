/**
 * Colour tokens. The only place raw hex is allowed in this repo — everywhere
 * else ESLint rejects it. See docs/04-DESIGN-SYSTEM.md.
 *
 * Warm neutrals, deliberately. Paper in light, ink in dark. No blue-grey, and
 * no purple anywhere: the indigo/violet gradient is the single strongest
 * "generated template" signal there is.
 */

/** Surfaces and text. Light theme is the base definition. */
export const light = {
  bg: '#FAF8F5', // warm paper, never pure white
  surface: '#FFFFFF',
  surfaceAlt: '#F2EEE8',
  border: '#E4DED4',
  borderStrong: '#CFC6B8',
  text: '#1A1714',
  textMuted: '#6B635A',
  textFaint: '#9A9187',
} as const;

export const dark = {
  bg: '#12100E', // warm ink, never #000 and never blue-black
  surface: '#1A1815',
  surfaceAlt: '#232019',
  border: '#2E2A24',
  borderStrong: '#453F36',
  text: '#F2EEE8',
  textMuted: '#A69C8F',
  textFaint: '#6E655A',
} as const;

/**
 * The memory scale — this is the product's colour.
 *
 * Retrievability (probability the user can recall a card right now) maps to
 * hue. Used by the forgetting curve, the heatmap, deck badges, and the review
 * card border. Nothing else in the app may use these hues, or they stop
 * reading as data.
 *
 * `fading` doubles as the interactive accent (buttons, links, focus rings),
 * because "about to be forgotten" is the state the whole product exists to
 * act on.
 */
export const memory = {
  strong: '#0E7C66', // R >= 90%   deep teal
  good: '#4A9E5C', // R 75-90%   green
  fading: '#C88A2E', // R 50-75%   amber  <- de-facto accent
  weak: '#B85C38', // R 25-50%   terracotta
  lost: '#8C3A2E', // R < 25%    rust, never fire-engine red
} as const;

/** Amber reads too light on paper. Darkened variant for light backgrounds. */
export const memoryOnLight = {
  ...memory,
  fading: '#A66F1C',
  good: '#3D8850',
} as const;

/**
 * System feedback only. Kept desaturated and deliberately distinct from the
 * memory scale so the two are never confused.
 */
export const status = {
  info: '#3A6B8C',
  success: '#3D8850',
  warning: '#A66F1C',
  danger: '#A33A2C',
} as const;

export type MemoryLevel = keyof typeof memory;

/** Map a retrievability value in [0,1] to its band on the memory scale. */
export function memoryLevel(retrievability: number): MemoryLevel {
  if (retrievability >= 0.9) return 'strong';
  if (retrievability >= 0.75) return 'good';
  if (retrievability >= 0.5) return 'fading';
  if (retrievability >= 0.25) return 'weak';
  return 'lost';
}

export const color = { light, dark, memory, memoryOnLight, status } as const;
