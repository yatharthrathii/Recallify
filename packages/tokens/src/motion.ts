/**
 * Motion tokens. Motion directs attention; it is never ambient and never loops.
 * Animate transform and opacity only — anything touching layout is a bug.
 */

export const duration = {
  instant: 90, // hover, focus, press
  fast: 160, // reveal, dropdown, tooltip
  base: 240, // page / view transition
  slow: 420, // curve draw-on, once per mount
} as const;

/** easeOutQuint. Decisive, arrives without bouncing. */
export const ease = [0.22, 1, 0.36, 1] as const;

/** Reserved for the card flip, where a physical metaphor is warranted. */
export const spring = { type: 'spring', stiffness: 320, damping: 30 } as const;

export const stagger = { cell: 6, maxTotal: 300 } as const;

/**
 * Call this instead of reading `duration` directly in components. Under
 * prefers-reduced-motion every movement collapses; only opacity survives.
 */
export function respectMotion(ms: number, prefersReduced: boolean): number {
  if (!prefersReduced) return ms;
  return ms === duration.instant ? duration.instant : 0;
}
