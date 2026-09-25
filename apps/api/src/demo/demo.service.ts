import { Injectable, Logger } from '@nestjs/common';
import { MIN_REVIEWS } from '@recallify/optimizer';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { levelFromXp } from '../stats/stats.service';
import { DEMO_DECKS } from './content';
import { simulate, streaks, type Simulation } from './simulate';

/** A demo account lives for a day. Nobody comes back to one. */
export const DEMO_TTL_MS = 24 * 3_600_000;

const PER_IP_PER_HOUR = 5;
const ALL_PER_DAY = 300;
const XP_PER_REVIEW = 10;

/**
 * Not an argon2 hash, so no password can ever match it: verification fails on
 * the malformed string and a demo account cannot be signed in to twice.
 */
const UNUSABLE_PASSWORD = '!demo';

export interface SeededAccount {
  readonly id: string;
  readonly email: string;
  readonly reviewCount: number;
}

/**
 * A simulation with room above the optimizer's threshold. Across seeds the
 * count ranges roughly 390 to 750, so the rare short one is simply rerun: the
 * point of the demo is that the fitting screen works in it.
 */
function enoughHistory(now: Date): Simulation {
  let sim = simulate(DEMO_DECKS, now, randomInt(2 ** 31));
  for (let i = 0; i < 10 && sim.reviewCount < MIN_REVIEWS + 50; i += 1) {
    sim = simulate(DEMO_DECKS, now, randomInt(2 ** 31));
  }
  return sim;
}

/**
 * Throwaway accounts with six months of history, one per visitor.
 *
 * A shared demo login would be a shared notebook: the first visitor to delete
 * a deck deletes it for everyone after them. So each visitor gets their own,
 * built in one request from the simulation, and it is swept a day later.
 */
@Injectable()
export class DemoService {
  private readonly log = new Logger(DemoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: RateLimitService,
  ) {}

  async create(ip: string): Promise<SeededAccount> {
    await this.limits.assertUnder(
      [
        { key: `demo:ip:${ip}`, limit: PER_IP_PER_HOUR, windowMs: 3_600_000 },
        { key: 'demo:all', limit: ALL_PER_DAY, windowMs: DEMO_TTL_MS },
      ],
      'Too many demo accounts from here. Try again in an hour, or create a free account.',
    );
    await this.limits.record(`demo:ip:${ip}`, 'demo:all');
    await this.sweep();

    return this.seed({
      email: `demo-${randomUUID()}@demo.recallify.invalid`,
      passwordHash: UNUSABLE_PASSWORD,
      displayName: 'Demo',
      isDemo: true,
    });
  }

  /** Demo accounts older than a day, and everything they own, by cascade. */
  async sweep(now = new Date()): Promise<number> {
    const { count } = await this.prisma.user.deleteMany({
      where: { isDemo: true, createdAt: { lt: new Date(now.getTime() - DEMO_TTL_MS) } },
    });
    if (count > 0) this.log.log(`Swept ${count} expired demo accounts`);
    return count;
  }

  /**
   * One account with the whole simulated history, in a handful of bulk
   * inserts rather than one transaction per review. Also used by the local
   * seed script, with a real password.
   */
  async seed(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    isDemo: boolean;
    now?: Date;
  }): Promise<SeededAccount> {
    const now = input.now ?? new Date();
    const sim = enoughHistory(now);
    const { current, longest } = streaks(sim.studyDays, now);
    const xp = sim.reviewCount * XP_PER_REVIEW;
    const lastStudyDate = sim.studyDays[sim.studyDays.length - 1] ?? null;

    return this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.create({
          data: {
            email: input.email,
            passwordHash: input.passwordHash,
            displayName: input.displayName,
            isDemo: input.isDemo,
            createdAt: now,
            stats: {
              create: {
                xp,
                level: levelFromXp(xp),
                streak: current,
                longestStreak: longest,
                lastStudyDate,
              },
            },
          },
          select: { id: true, email: true },
        });

        const decks = await tx.deck.createManyAndReturn({
          data: DEMO_DECKS.map((deck) => ({
            userId: user.id,
            title: deck.title,
            description: deck.description,
            color: deck.color,
            createdAt: new Date(now.getTime() - deck.startDaysAgo * 86_400_000),
          })),
          select: { id: true },
        });

        const cards = await tx.card.createManyAndReturn({
          data: sim.cards.map((card) => ({
            userId: user.id,
            deckId: decks[card.deckIndex]!.id,
            front: card.front,
            back: card.back,
            createdAt: card.createdAt,
            state: card.state.state,
            stability: card.state.stability,
            difficulty: card.state.difficulty,
            dueAt: card.state.dueAt,
            reps: card.state.reps,
            lapses: card.state.lapses,
            lastReviewedAt: card.state.lastReviewedAt,
            learningStep: card.state.learningStep,
          })),
          select: { id: true },
        });

        await tx.review.createMany({
          data: sim.cards.flatMap((card, i) =>
            card.reviews.map((review) => ({
              ...review,
              cardId: cards[i]!.id,
              userId: user.id,
              syncedAt: review.reviewedAt,
            })),
          ),
        });

        return { id: user.id, email: user.email, reviewCount: sim.reviewCount };
      },
      // Five bulk statements on a database that may be waking from idle.
      { maxWait: 10_000, timeout: 30_000 },
    );
  }
}
