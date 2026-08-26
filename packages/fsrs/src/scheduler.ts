/**
 * The scheduler — the state machine wrapped around the memory model.
 *
 * memory.ts answers "how strong is this memory now?". This file answers "so
 * when do we show the card, and what state is it in?". Same purity rules: no
 * clock, no randomness, no I/O. `now` is passed in, and fuzz takes a number
 * rather than calling Math.random, so every result is reproducible.
 *
 *   NEW ──first review──► LEARNING ──graduates──► REVIEW
 *                            ▲                     │
 *                            │                   Again
 *                            └── RELEARNING ◄──────┘
 */

import { DEFAULT_CONFIG, clampDifficulty, clampStability } from './constants';
import { DAY_MS, elapsedDays } from './defaults';
import {
  initialDifficulty,
  initialStability,
  intervalFromRetention,
  nextDifficulty,
  nextForgetStability,
  nextRecallStability,
  nextShortTermStability,
  retrievability,
} from './memory';
import type {
  CardState,
  Explanation,
  FsrsConfig,
  Rating,
  ReviewLog,
  SchedulingCard,
  SchedulingResult,
} from './types';

const MINUTES_PER_DAY = 1440;

/** Below this, an interval is too short for jitter to be worth anything. */
const MIN_FUZZ_DAYS = 2.5;

/**
 * Spread due dates so a big study day does not reappear as one enormous day a
 * month later. `random` is a caller-supplied value in [0, 1); the default of
 * 0.5 lands exactly in the middle, which means no jitter — so the scheduler is
 * deterministic unless you deliberately feed it randomness.
 */
export function fuzzInterval(
  days: number,
  random: number,
  config: FsrsConfig = DEFAULT_CONFIG,
): number {
  if (days < MIN_FUZZ_DAYS || config.fuzzFactor <= 0) return days;
  const spread = days * config.fuzzFactor;
  return Math.max(MIN_FUZZ_DAYS, days + (random * 2 - 1) * spread);
}

/** Days until the card should next be seen, from stability alone. */
function reviewInterval(
  stability: number,
  config: FsrsConfig,
  random: number,
): number {
  const raw = intervalFromRetention(config.params, stability, config.desiredRetention);
  const fuzzed = fuzzInterval(raw, random, config);
  return Math.min(Math.max(Math.round(fuzzed), 1), config.maximumInterval);
}

/**
 * Where the card lands in the learning ladder.
 *
 *   Again  back to the first step
 *   Hard   stay where it is
 *   Good   one step forward; past the last step it graduates
 *   Easy   graduates immediately
 *
 * Returns -1 to mean "graduate".
 */
export function nextLearningStep(
  currentStep: number,
  rating: Rating,
  stepCount: number,
): number {
  if (rating === 4) return -1;
  if (stepCount === 0) return -1;

  const target = rating === 1 ? 0 : rating === 2 ? currentStep : currentStep + 1;
  return target >= stepCount ? -1 : target;
}

/**
 * Apply one review.
 *
 * Returns the card's new state and the log row to append. The caller persists
 * both; the log is the record of truth and the card is a cache of it.
 */
export function schedule(
  card: SchedulingCard,
  rating: Rating,
  now: Date,
  config: FsrsConfig = DEFAULT_CONFIG,
  random = 0.5,
): SchedulingResult {
  const { params } = config;
  const isNew = card.state === 'NEW';

  const elapsed = card.lastReviewedAt ? elapsedDays(card.lastReviewedAt, now) : 0;

  // A card nobody has seen has no memory to retrieve, so R is 0 rather than 1:
  // treating it as perfectly recallable would hand the first review the full
  // spacing bonus it has not earned.
  const r = isNew ? 0 : retrievability(params, elapsed, card.stability);

  // Difficulty and stability both derive from the state BEFORE this review.
  // Feeding the freshly updated difficulty into the stability formula shifts
  // every result — verified against the reference implementation.
  let difficulty: number;
  let stability: number;

  if (isNew) {
    difficulty = clampDifficulty(initialDifficulty(params, rating));
    stability = initialStability(params, rating);
  } else {
    difficulty = nextDifficulty(params, card.difficulty, rating);

    if (card.state === 'REVIEW') {
      stability =
        rating === 1
          ? nextForgetStability(params, card.difficulty, card.stability, r)
          : nextRecallStability(params, card.difficulty, card.stability, r, rating);
    } else {
      // Still in the learning ladder, where intervals are minutes and the
      // forgetting curve has effectively nothing to say yet.
      stability = nextShortTermStability(params, card.stability, rating);
    }
  }

  stability = clampStability(stability);

  const lapsed = card.state === 'REVIEW' && rating === 1;

  // A card that has lapsed once uses the shorter relearning ladder for the rest
  // of its way back. Keying this off `lapsed` alone was wrong: `lapsed` is only
  // true on the review that broke the card, so on the NEXT review it fell back
  // to the full learning ladder and could never graduate.
  const relearning = lapsed || card.state === 'RELEARNING';
  const steps = relearning ? config.relearningSteps : config.learningSteps;
  const currentStep = isNew ? 0 : card.learningStep;

  let state: CardState;
  let learningStep: number;
  let intervalDays: number;

  if (card.state === 'REVIEW' && !lapsed) {
    // Stays in review; only the interval moves.
    state = 'REVIEW';
    learningStep = 0;
    intervalDays = reviewInterval(stability, config, random);
  } else {
    const step = nextLearningStep(lapsed ? 0 : currentStep, rating, steps.length);

    // "No rung to move to" and "the rung is missing" are the same outcome, so
    // they share a branch rather than hiding an unreachable fallback behind a
    // `?? 1` that no test could ever reach.
    const stepMinutes = step === -1 ? undefined : steps[step];

    if (stepMinutes === undefined) {
      state = 'REVIEW';
      learningStep = 0;
      intervalDays = reviewInterval(stability, config, random);
    } else {
      state = relearning ? 'RELEARNING' : 'LEARNING';
      learningStep = step;
      intervalDays = stepMinutes / MINUTES_PER_DAY;
    }
  }

  const next: SchedulingCard = {
    state,
    stability,
    difficulty,
    reps: card.reps + 1,
    lapses: card.lapses + (lapsed ? 1 : 0),
    lastReviewedAt: now,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
    learningStep,
  };

  const log: ReviewLog = {
    rating,
    reviewedAt: now,
    prevState: card.state,
    prevStability: card.stability,
    prevDifficulty: card.difficulty,
    newStability: stability,
    newDifficulty: difficulty,
    elapsedDays: elapsed,
    scheduledDays: Math.round(intervalDays),
    retrievability: r,
  };

  return { card: next, log };
}

/**
 * Why is this card in front of me right now?
 *
 * Powers the panel no competitor has: the numbers behind the decision, in the
 * user's own terms.
 */
export function explain(
  card: SchedulingCard,
  now: Date,
  config: FsrsConfig = DEFAULT_CONFIG,
): Explanation {
  const from = card.lastReviewedAt ?? now;
  const elapsed = elapsedDays(from, now);
  const r = card.state === 'NEW' ? 0 : retrievability(config.params, elapsed, card.stability);

  const intervalDays = intervalFromRetention(
    config.params,
    card.stability,
    config.desiredRetention,
  );

  return {
    retrievability: r,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: elapsed,
    intervalDays,
    predictedForgetAt: new Date(from.getTime() + intervalDays * DAY_MS),
  };
}

/**
 * Rebuild a card's state by replaying its review log from scratch.
 *
 * This is why `Review` is append-only. The stored card state is only a cache;
 * this function is the definition. It is what lets the optimizer re-derive
 * history under different parameters, and what makes a corrupted cache
 * recoverable rather than fatal.
 *
 * Logs are sorted by `reviewedAt` first, so an offline batch that arrives out
 * of order still replays in the order the reviews actually happened.
 */
export function replay(
  logs: readonly ReviewLog[],
  config: FsrsConfig = DEFAULT_CONFIG,
  startedAt?: Date,
): SchedulingCard {
  const ordered = [...logs].sort(
    (a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime(),
  );

  const first = ordered[0];
  const origin = startedAt ?? first?.reviewedAt ?? new Date(0);

  let card: SchedulingCard = {
    state: 'NEW',
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
    dueAt: origin,
    learningStep: 0,
  };

  for (const log of ordered) {
    // random = 0.5 means no fuzz, so a replay is byte-for-byte reproducible.
    card = schedule(card, log.rating, log.reviewedAt, config).card;
  }

  return card;
}
