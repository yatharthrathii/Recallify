/**
 * Typography tokens. See docs/04-DESIGN-SYSTEM.md.
 *
 * Fraunces  — variable serif with optical-size and WONK axes. It has a voice,
 *             and no template ships with it. Keep WONK low and opsz high on
 *             large headings so it reads editorial rather than novelty.
 * IBM Plex Sans — interface. More character than Inter, and it pairs natively
 *             with Plex Mono, which keeps the system coherent for free.
 * IBM Plex Mono — every number. Always tabular, so columns line up.
 */

export const font = {
  display: '"Fraunces", "Iowan Old Style", Georgia, serif',
  ui: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, "SF Mono", "Cascadia Mono", monospace',
} as const;

export const weight = {
  regular: 400,
  medium: 500,
  semibold: 600,
} as const;

/**
 * 1.25 ratio. These are the only sizes in the app — if a design needs a size
 * that is not here, the design is wrong, not the scale.
 */
export const text = {
  display: { size: 48, leading: 52, family: font.display, weight: weight.semibold },
  h1: { size: 34, leading: 40, family: font.display, weight: weight.semibold },
  h2: { size: 26, leading: 32, family: font.display, weight: weight.semibold },
  h3: { size: 20, leading: 28, family: font.ui, weight: weight.semibold },
  body: { size: 16, leading: 26, family: font.ui, weight: weight.regular },
  ui: { size: 14, leading: 20, family: font.ui, weight: weight.medium },
  caption: { size: 12, leading: 16, family: font.ui, weight: weight.regular },
  data: { size: 14, leading: 20, family: font.mono, weight: weight.regular },
  dataLg: { size: 28, leading: 32, family: font.mono, weight: weight.medium },
} as const;

export const tracking = {
  tight: '-0.02em', // display and h1
  normal: '0',
  wide: '0.04em', // small caps labels
} as const;

export type TextToken = keyof typeof text;
