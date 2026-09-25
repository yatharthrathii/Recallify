import {
  DAY_MS,
  DEFAULT_CONFIG,
  newCard,
  retrievability,
  schedule,
  type CardState,
  type Rating,
  type SchedulingCard,
} from '@recallify/fsrs';
import { randomUUID } from 'node:crypto';
import { startOfDay } from '../common/dates';
import type { DemoDeck } from './content';

export interface SimulatedReview {
  readonly id: string;
  readonly rating: Rating;
  readonly prevState: CardState;
  readonly prevStability: number;
  readonly prevDifficulty: number;
  readonly newStability: number;
  readonly newDifficulty: number;
  readonly scheduledDays: number;
  readonly elapsedDays: number;
  readonly retrievability: number;
  readonly durationMs: number;
  readonly reviewedAt: Date;
}

export interface SimulatedCard {
  readonly deckIndex: number;
  readonly front: string;
  readonly back: string;
  readonly createdAt: Date;
  readonly state: SchedulingCard;
  readonly reviews: readonly SimulatedReview[];
}

export interface Simulation {
  readonly cards: readonly SimulatedCard[];
  readonly reviewCount: number;
  /** Distinct UTC days with at least one review, oldest first. */
  readonly studyDays: readonly Date[];
}

/** A small seedable generator, so a test can pin the output. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1_664_525) + 1_013_904_223) >>> 0;
    return s / 4_294_967_296;
  };
}

const HOUR = 3_600_000;

/**
 * An answer a person plausibly gives. The chance of Again follows the model's
 * own predicted recall, so a card reviewed late is forgotten more often. That
 * is what makes a fit on this history mean something.
 */
function pickRating(card: SchedulingCard, at: Date, rand: () => number): Rating {
  const r = rand();
  if (card.state !== 'REVIEW') return r < 0.1 ? 1 : r < 0.18 ? 2 : 3;
  const recall = card.lastReviewedAt
    ? retrievability(
        DEFAULT_CONFIG.params,
        (at.getTime() - card.lastReviewedAt.getTime()) / DAY_MS,
        card.stability,
      )
    : 0.9;
  const forget = Math.min(0.5, Math.max(0.03, 1 - recall));
  if (r < forget) return 1;
  if (r < forget + 0.12) return 2;
  if (r < 0.93) return 3;
  return 4;
}

/**
 * People study while awake. A due time outside 07:30 to 22:30 in India moves
 * to the next morning, with some scatter.
 */
function wakingHours(ms: number, rand: () => number): number {
  const hour = new Date(ms).getUTCHours();
  if (hour >= 2 && hour < 17) return ms;
  const next = new Date(ms);
  next.setUTCHours(3, 0, 0, 0);
  if (hour >= 17) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() + Math.floor(rand() * 10) * HOUR;
}

/**
 * Six months of a learner, produced by the same scheduler the app runs.
 *
 * Each card is added some day after its subject was taken up, then reviewed
 * when the scheduler said it was due, give or take a person being late, and
 * answered according to how likely the model says they were to remember it.
 * There is one missed week, because there always is. Nothing is random data:
 * every interval in the result is one the engine really chose.
 */
export function simulate(decks: readonly DemoDeck[], now: Date, seed = Date.now()): Simulation {
  const rand = seededRandom(seed);
  const end = now.getTime() - HOUR;
  const breakStart = now.getTime() - 72 * DAY_MS;
  const breakEnd = breakStart + 7 * DAY_MS;

  const cards: SimulatedCard[] = [];
  const days = new Set<number>();
  let reviewCount = 0;

  decks.forEach((deck, deckIndex) => {
    const deckStart = now.getTime() - deck.startDaysAgo * DAY_MS;
    deck.cards.forEach(([front, back], index) => {
      // The last two cards of each deck were added this week and are still
      // new, so the queue has something to learn as well as to review.
      const fresh = index >= deck.cards.length - 2;
      const createdMs = fresh
        ? now.getTime() - (1 + Math.floor(rand() * 3)) * DAY_MS
        : wakingHours(deckStart + Math.floor(rand() * 21) * DAY_MS, rand);
      const createdAt = new Date(createdMs);

      let state = newCard(createdAt);
      const reviews: SimulatedReview[] = [];
      let at = createdMs + Math.floor(rand() * 4) * HOUR;

      while (!fresh && at < end) {
        if (at >= breakStart && at < breakEnd) at = breakEnd + Math.floor(rand() * 12) * HOUR;
        at = wakingHours(at, rand);
        if (at >= end) break;

        const when = new Date(at);
        const rating = pickRating(state, when, rand);
        const { card: next, log } = schedule(state, rating, when, DEFAULT_CONFIG, rand());
        reviews.push({
          id: randomUUID(),
          rating,
          prevState: log.prevState,
          prevStability: log.prevStability,
          prevDifficulty: log.prevDifficulty,
          newStability: log.newStability,
          newDifficulty: log.newDifficulty,
          scheduledDays: Math.max(0, Math.round((next.dueAt.getTime() - at) / DAY_MS)),
          elapsedDays: Math.round(log.elapsedDays),
          retrievability: log.retrievability,
          durationMs: 3_000 + Math.floor(rand() * 9_000),
          reviewedAt: when,
        });
        days.add(startOfDay(when).getTime());
        state = next;

        // Learning steps are a few minutes late, long intervals up to a day
        // and a half.
        const late = next.state === 'REVIEW' ? rand() * 1.5 * DAY_MS : rand() * 20 * 60_000;
        at = next.dueAt.getTime() + late;
      }

      reviewCount += reviews.length;
      cards.push({ deckIndex, front, back, createdAt, state, reviews });
    });
  });

  const studyDays = [...days].sort((a, b) => a - b).map((d) => new Date(d));
  return { cards, reviewCount, studyDays };
}

/** Current and longest runs of consecutive UTC study days. */
export function streaks(
  studyDays: readonly Date[],
  now: Date,
): { current: number; longest: number } {
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const day of studyDays) {
    const n = Math.round(day.getTime() / DAY_MS);
    run = prev !== null && n === prev + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = n;
  }
  const today = Math.round(startOfDay(now).getTime() / DAY_MS);
  const current = prev !== null && today - prev <= 1 ? run : 0;
  return { current, longest };
}
