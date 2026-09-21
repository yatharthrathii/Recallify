/**
 * Motion tokens. Motion is part of the product's voice: things arrive, they do
 * not just appear. Animate transform, opacity and clip-path only — anything
 * touching layout is a bug. The first version of these was so restrained
 * (240ms, 8px) that nobody could see it; these are sized to be noticed.
 */

export const duration = {
  instant: 120, // hover, focus, press
  fast: 220, // dropdown, tooltip
  base: 520, // a block rising into view
  slow: 900, // headline reveal, count-up
  draw: 1400, // the curve drawing itself, once per mount
} as const;

/** Distance a block travels as it rises in, in px. */
export const rise = 28;

/** easeOutQuint. Decisive, arrives without bouncing. */
export const ease = [0.22, 1, 0.36, 1] as const;

/** Reserved for the card flip, where a physical metaphor is warranted. */
export const spring = { type: 'spring', stiffness: 320, damping: 30 } as const;

export const stagger = { cell: 6, maxTotal: 300, item: 70 } as const;

/**
 * Call this instead of reading `duration` directly in components. Under
 * prefers-reduced-motion every movement collapses; only opacity survives.
 */
export function respectMotion(ms: number, prefersReduced: boolean): number {
  if (!prefersReduced) return ms;
  return ms === duration.instant ? duration.instant : 0;
}
