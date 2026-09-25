import { MIN_REVIEWS } from '@recallify/optimizer';
import { describe, expect, it } from 'vitest';
import { DEMO_DECKS } from '../src/demo/content';
import { simulate, streaks } from '../src/demo/simulate';

const NOW = new Date('2026-09-25T09:00:00Z');

describe('demo simulation', () => {
  const sim = simulate(DEMO_DECKS, NOW, 7);

  it('is deterministic for a seed', () => {
    const again = simulate(DEMO_DECKS, NOW, 7);
    expect(again.reviewCount).toBe(sim.reviewCount);
    expect(again.cards.map((c) => c.state.dueAt.getTime())).toEqual(
      sim.cards.map((c) => c.state.dueAt.getTime()),
    );
  });

  it('usually clears the optimizer threshold on its own', () => {
    // The service reruns the rare short one; this pins that it is rare.
    const counts = Array.from({ length: 200 }, (_, i) => simulate(DEMO_DECKS, NOW, i + 1).reviewCount);
    const short = counts.filter((n) => n < MIN_REVIEWS + 50).length;
    expect(short / counts.length).toBeLessThan(0.1);
  });

  it('writes nothing in the future and nothing before the card existed', () => {
    for (const card of sim.cards) {
      for (const review of card.reviews) {
        expect(review.reviewedAt.getTime()).toBeLessThan(NOW.getTime());
        expect(review.reviewedAt.getTime()).toBeGreaterThanOrEqual(card.createdAt.getTime());
      }
    }
  });

  it('reviews in order, and each review starts where the last one left off', () => {
    for (const card of sim.cards) {
      for (let i = 1; i < card.reviews.length; i += 1) {
        const prev = card.reviews[i - 1]!;
        const cur = card.reviews[i]!;
        expect(cur.reviewedAt.getTime()).toBeGreaterThan(prev.reviewedAt.getTime());
        expect(cur.prevStability).toBeCloseTo(prev.newStability, 9);
      }
    }
  });

  it('keeps a few new cards and leaves some due', () => {
    expect(sim.cards.filter((c) => c.state.state === 'NEW').length).toBe(DEMO_DECKS.length * 2);
    expect(sim.cards.some((c) => c.state.state !== 'NEW' && c.state.dueAt <= NOW)).toBe(true);
  });

  it('includes forgetting, not only a run of perfect answers', () => {
    const ratings = sim.cards.flatMap((c) => c.reviews.map((r) => r.rating));
    const again = ratings.filter((r) => r === 1).length / ratings.length;
    expect(again).toBeGreaterThan(0.03);
    expect(again).toBeLessThan(0.3);
  });

  it('studies only in waking hours in India', () => {
    for (const card of sim.cards) {
      for (const review of card.reviews) {
        const hour = review.reviewedAt.getUTCHours();
        expect(hour >= 2 && hour < 17).toBe(true);
      }
    }
  });
});

describe('streaks', () => {
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

  it('counts the current run only if it reaches today or yesterday', () => {
    const days = [day('2026-09-20'), day('2026-09-22'), day('2026-09-23'), day('2026-09-24')];
    expect(streaks(days, NOW)).toEqual({ current: 3, longest: 3 });
    expect(streaks(days, new Date('2026-09-27T09:00:00Z')).current).toBe(0);
  });

  it('remembers a longer run in the past', () => {
    const days = ['01', '02', '03', '04', '05', '20', '24'].map((d) => day(`2026-09-${d}`));
    expect(streaks(days, NOW)).toEqual({ current: 1, longest: 5 });
  });
});
