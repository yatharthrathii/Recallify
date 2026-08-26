import type { SchedulingCard } from './types';

/** A card that has never been reviewed. Due immediately. */
export function newCard(now: Date): SchedulingCard {
  return {
    state: 'NEW',
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
    dueAt: now,
    learningStep: 0,
  };
}

export const DAY_MS = 86_400_000;

/**
 * Whole days between two instants, never negative.
 *
 * A review submitted from an offline device can carry a client clock that is
 * behind the server's. Clamping at zero means a skewed clock produces a
 * conservative schedule rather than a negative elapsed time, which would make
 * retrievability exceed 1.
 */
export function elapsedDays(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

/** Fractional days are legal: learning steps are measured in minutes. */
export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}
