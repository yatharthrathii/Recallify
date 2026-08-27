/**
 * A simulated learner, for testing the optimizer against a known answer.
 *
 * The only way to check that training works is to generate data from
 * parameters you already know, then see whether training moves toward them.
 * Real review logs cannot do this — nobody knows a real person's true
 * parameters.
 *
 * The learner is driven by the engine itself: cards are scheduled with the
 * chosen parameters, and whether each review is recalled is sampled from the
 * retrievability those same parameters predict. So the history is exactly what
 * a person with that memory would have produced.
 */

import {
  DEFAULT_CONFIG,
  newCard,
  retrievability,
  schedule,
  type FsrsParams,
  type Rating,
} from '@recallify/fsrs';
import type { TrainingReview } from '../src/types';

/**
 * mulberry32 — a small deterministic PRNG.
 *
 * `Math.random` is deliberately not used anywhere in this repo: a test that
 * fails one run in fifty is worse than no test, because it teaches you to
 * ignore red.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimulationOptions {
  readonly trueParams: FsrsParams;
  readonly cards: number;
  readonly days: number;
  readonly seed: number;
  readonly startedAt?: Date;
}

const DAY_MS = 86_400_000;

/**
 * Study `cards` cards over `days`, reviewing each whenever it falls due.
 *
 * On each review the learner recalls the card with probability equal to its
 * true retrievability. A recall is graded Hard, Good or Easy depending on how
 * comfortable it was; a failure is graded Again.
 */
export function simulateLearner(options: SimulationOptions): TrainingReview[] {
  const { trueParams, cards, days, seed } = options;
  const start = options.startedAt ?? new Date('2026-01-01T08:00:00Z');
  const end = new Date(start.getTime() + days * DAY_MS);
  const rng = makeRng(seed);
  const config = { ...DEFAULT_CONFIG, params: trueParams };

  const reviews: TrainingReview[] = [];

  for (let i = 0; i < cards; i++) {
    const cardId = `card-${i}`;
    // Stagger introductions so the history is not one enormous first day.
    let at = new Date(start.getTime() + Math.floor(rng() * days * 0.4) * DAY_MS);
    let card = newCard(at);

    while (at < end) {
      let rating: Rating;

      if (card.state === 'NEW') {
        // First sight: the learner is being taught, not tested.
        rating = rng() < 0.75 ? 3 : 2;
      } else {
        const elapsed = card.lastReviewedAt
          ? Math.max(0, (at.getTime() - card.lastReviewedAt.getTime()) / DAY_MS)
          : 0;
        const p = retrievability(trueParams, elapsed, card.stability);

        if (rng() < p) {
          const comfort = rng();
          rating = comfort < 0.15 ? 2 : comfort < 0.85 ? 3 : 4;
        } else {
          rating = 1;
        }
      }

      reviews.push({ cardId, rating, reviewedAt: at });
      card = schedule(card, rating, at, config).card;
      at = card.dueAt;
    }
  }

  return reviews;
}

/** Nudge some parameters away from the published defaults, staying in range. */
export function perturb(
  params: FsrsParams,
  changes: Readonly<Record<number, number>>,
): FsrsParams {
  return params.map((value, index) => changes[index] ?? value);
}
