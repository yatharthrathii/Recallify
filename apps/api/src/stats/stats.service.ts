import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CurveQuery,
  ExamCard,
  ExamForecast,
  ExamQuery,
  Forecast,
  ForecastQuery,
  ForgettingCurve,
  Heatmap,
  HeatmapQuery,
  StatsOverview,
  WorkloadPreview,
} from '@recallify/contracts';
import { elapsedDays, intervalFromRetention, retrievability, schedule } from '@recallify/fsrs';
import { ReportService } from '../report/report.service';
import { addDays, dayKey, daysBetween, startOfDay } from '../common/dates';
import { streaks } from './streaks';
import { PrismaService } from '../prisma/prisma.service';
import { FsrsConfigService, type UserScheduling } from '../scheduling/fsrs-config.service';

/** XP per answered card. Flat on purpose -- see `recordReview`. */
const XP_PER_REVIEW = 10;
const XP_PER_LEVEL = 100;

/** How far back `retention` on the overview looks. */
const RETENTION_WINDOW_DAYS = 30;

/** Points sampled along a forgetting curve. Enough to look smooth, small enough to send. */
const CURVE_RESOLUTION = 120;

/**
 * Level from cumulative XP.
 *
 * Derived, never stored as its own running total. v1 kept both and did
 * `xp = xp % 100` on level-up, which threw the lifetime total away every
 * hundred points -- the user's history visibly reset and there was no way to
 * recover it. Storing one number and computing the other makes that class of
 * bug unrepresentable.
 */
export function levelFromXp(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: FsrsConfigService,
    private readonly reports: ReportService,
  ) {}

  /**
   * Fold one review into the user's running totals.
   *
   * Takes the caller's transaction so the review row and the XP it earns commit
   * together. Called from ReviewsService; nothing else writes this table.
   *
   * XP is flat rather than scaled by rating. Paying more for "Easy" would pay
   * people to lie to the scheduler, and the scheduler is only as good as the
   * ratings it is given.
   *
   * The streak moves forward only. An offline batch from last week adds its
   * reviews to the log and the heatmap, but it does not retroactively repair a
   * streak that has already been broken -- recomputing the whole history on
   * every review would be a scan of the log for a number nobody is watching in
   * that moment.
   */
  async recordReview(
    tx: Prisma.TransactionClient,
    userId: string,
    reviewedAt: Date,
  ): Promise<void> {
    const stats = await tx.userStats.findUnique({ where: { userId } });
    // Created with the user in AuthService, so absence means something is
    // already wrong; creating it here keeps a review from being lost to it.
    const current = stats ?? {
      xp: 0,
      streak: 0,
      longestStreak: 0,
      lastStudyDate: null as Date | null,
    };

    const today = startOfDay(reviewedAt);
    const last = current.lastStudyDate ? startOfDay(current.lastStudyDate) : null;
    const gap = last ? daysBetween(last, today) : null;

    let streak = current.streak;
    let lastStudyDate = current.lastStudyDate;

    if (gap === null) {
      streak = 1;
      lastStudyDate = today;
    } else if (gap === 1) {
      streak = current.streak + 1;
      lastStudyDate = today;
    } else if (gap > 1) {
      streak = 1;
      lastStudyDate = today;
    }
    // gap === 0 is another review on a day already counted, and a negative gap
    // is a late-arriving offline review. Neither moves the streak.

    const xp = current.xp + XP_PER_REVIEW;

    await tx.userStats.upsert({
      where: { userId },
      create: {
        userId,
        xp,
        level: levelFromXp(xp),
        streak,
        longestStreak: Math.max(current.longestStreak, streak),
        lastStudyDate,
      },
      update: {
        xp,
        level: levelFromXp(xp),
        streak,
        longestStreak: Math.max(current.longestStreak, streak),
        lastStudyDate,
      },
    });
  }

  /**
   * Fold a block of history into the totals, after an import.
   *
   * XP is earned the same way as for a live review, so an imported log and a
   * lived one look alike on the stats page. The streak is recomputed from the
   * whole log rather than moved forward, because the reviews just added may
   * sit anywhere in the past.
   */
  async absorbHistory(
    tx: Prisma.TransactionClient,
    userId: string,
    reviewsAdded: number,
    now: Date,
  ): Promise<void> {
    const days = await tx.$queryRaw<{ day: Date }[]>`
      SELECT DISTINCT date_trunc('day', "reviewedAt")::date AS day
      FROM "reviews"
      WHERE "userId" = ${userId}
      ORDER BY 1
    `;
    const studyDays = days.map((r) => startOfDay(r.day));
    const { current, longest } = streaks(studyDays, now);
    const lastStudyDate = studyDays[studyDays.length - 1] ?? null;

    const stats = await tx.userStats.findUnique({ where: { userId } });
    const xp = (stats?.xp ?? 0) + reviewsAdded * XP_PER_REVIEW;

    await tx.userStats.upsert({
      where: { userId },
      create: {
        userId,
        xp,
        level: levelFromXp(xp),
        streak: current,
        longestStreak: longest,
        lastStudyDate,
      },
      update: {
        xp,
        level: levelFromXp(xp),
        streak: current,
        longestStreak: Math.max(stats?.longestStreak ?? 0, longest),
        lastStudyDate,
      },
    });
  }

  async overview(userId: string): Promise<StatsOverview> {
    const now = new Date();
    const windowStart = addDays(startOfDay(now), -RETENTION_WINDOW_DAYS);

    // Retention is measured, not predicted: of the cards the user was actually
    // asked to recall, how many did they. First-ever reviews are excluded --
    // there was nothing to recall yet, and counting them would drag the number
    // toward whatever fraction of the user's study happens to be new cards.
    const attemptedWhere = {
      userId,
      reviewedAt: { gte: windowStart },
      prevState: { not: 'NEW' as const },
    };

    const [stats, totalReviews, totalCards, dueToday, attempted, recalled] = await Promise.all([
      this.prisma.userStats.findUnique({ where: { userId } }),
      this.prisma.review.count({ where: { userId } }),
      this.prisma.card.count({ where: { userId } }),
      this.prisma.card.count({ where: { userId, suspendedAt: null, dueAt: { lte: now } } }),
      this.prisma.review.count({ where: attemptedWhere }),
      this.prisma.review.count({ where: { ...attemptedWhere, rating: { gt: 1 } } }),
    ]);

    return {
      xp: stats?.xp ?? 0,
      level: stats?.level ?? 1,
      streak: stats?.streak ?? 0,
      longestStreak: stats?.longestStreak ?? 0,
      lastStudyDate: stats?.lastStudyDate ?? null,
      totalReviews,
      totalCards,
      dueToday,
      retention: attempted > 0 ? recalled / attempted : 0,
    };
  }

  /**
   * Reviews per day, and how many of them were recalled.
   *
   * Grouped in SQL rather than by pulling a year of rows into Node and bucketing
   * them there: a heavy user's year is tens of thousands of rows, all of which
   * would cross the wire to produce 365 numbers.
   */
  async heatmap(userId: string, query: HeatmapQuery): Promise<Heatmap> {
    const from = addDays(startOfDay(new Date()), -(query.days - 1));

    const rows = await this.prisma.$queryRaw<
      { day: Date; reviews: bigint; recalled: bigint; attempted: bigint }[]
    >`
      SELECT
        date_trunc('day', "reviewedAt")::date                         AS day,
        COUNT(*)                                                      AS reviews,
        COUNT(*) FILTER (WHERE "rating" > 1 AND "prevState" <> 'NEW') AS recalled,
        COUNT(*) FILTER (WHERE "prevState" <> 'NEW')                  AS attempted
      FROM "reviews"
      WHERE "userId" = ${userId} AND "reviewedAt" >= ${from}
      GROUP BY 1
      ORDER BY 1
    `;

    return rows.map((r) => {
      const attempted = Number(r.attempted);
      return {
        date: dayKey(r.day),
        reviews: Number(r.reviews),
        // Null, not zero, on a day of nothing but new cards. Zero would read as
        // "forgot everything" on a day the user got nothing wrong.
        retention: attempted > 0 ? Number(r.recalled) / attempted : null,
      };
    });
  }

  /** What the next N days look like if nothing new is added. */
  async forecast(userId: string, query: ForecastQuery): Promise<Forecast> {
    const today = startOfDay(new Date());
    const end = addDays(today, query.days);

    const rows = await this.prisma.$queryRaw<{ day: Date; due: bigint }[]>`
      SELECT
        GREATEST("dueAt"::date, ${today}::date) AS day,
        COUNT(*)                                AS due
      FROM "cards"
      WHERE "userId" = ${userId}
        AND "suspendedAt" IS NULL
        AND "dueAt" < ${end}
        ${query.deckId ? Prisma.sql`AND "deckId" = ${query.deckId}` : Prisma.empty}
      GROUP BY 1
      ORDER BY 1
    `;

    const byDay = new Map(rows.map((r) => [dayKey(r.day), Number(r.due)]));

    const backlog = await this.prisma.card.count({
      where: {
        userId,
        suspendedAt: null,
        dueAt: { lt: today },
        ...(query.deckId ? { deckId: query.deckId } : {}),
      },
    });

    return {
      days: Array.from({ length: query.days }, (_, i) => {
        const date = dayKey(addDays(today, i));
        return { date, due: byDay.get(date) ?? 0 };
      }),
      backlog,
    };
  }

  /**
   * What each retention target would cost in daily reviews.
   *
   * A card in REVIEW comes back about once per interval, so the steady-state
   * load is the sum of 1/interval over those cards. It ignores lapses and new
   * cards, which is why the UI calls it an estimate. One column is read per
   * card and the whole slider range is computed in one pass.
   */
  async workload(userId: string): Promise<WorkloadPreview> {
    const config = await this.scheduling.forUser(userId);
    const cards = await this.prisma.card.findMany({
      where: { userId, suspendedAt: null, state: 'REVIEW' },
      select: { stability: true },
    });

    const points = [];
    for (let step = 70; step <= 97; step += 1) {
      const retention = step / 100;
      let perDay = 0;
      for (const card of cards) {
        const interval = Math.min(
          config.maximumInterval,
          Math.max(1, intervalFromRetention(config.params, card.stability, retention)),
        );
        perDay += 1 / interval;
      }
      points.push({ retention, reviewsPerDay: perDay });
    }

    return { cardsCounted: cards.length, current: config.desiredRetention, points };
  }

  /**
   * What will still be known on a date.
   *
   * Each seen card's retrievability is projected to the exam date and summed.
   * The sum of independent chances has a variance of p(1-p) each, so the range
   * is two standard deviations either side; the calibration error from the
   * latest report is quoted beside it, because the range only holds if the
   * model is right about this person. Nothing is simulated: the reviews that
   * will happen between now and then are not guessed at. Instead the cards a
   * single Good answer today would lift the most are listed, computed by
   * running the scheduler on each one.
   */
  async exam(userId: string, query: ExamQuery): Promise<ExamForecast> {
    const now = new Date();
    const examAt = new Date(`${query.date}T00:00:00Z`);
    const daysAway = daysBetween(now, examAt);
    if (daysAway < 0) throw new BadRequestException('The date has already passed.');

    const [config, calibrationError, decks, cards] = await Promise.all([
      this.scheduling.forUser(userId),
      this.reports.latestCalibrationError(userId),
      this.prisma.deck.findMany({ where: { userId }, select: { id: true, title: true } }),
      this.prisma.card.findMany({
        where: {
          userId,
          suspendedAt: null,
          ...(query.deckId ? { deckId: query.deckId } : {}),
        },
        select: {
          id: true,
          deckId: true,
          front: true,
          state: true,
          stability: true,
          difficulty: true,
          dueAt: true,
          reps: true,
          lapses: true,
          lastReviewedAt: true,
          learningStep: true,
        },
      }),
    ]);
    if (query.deckId && !decks.some((d) => d.id === query.deckId)) {
      throw new NotFoundException('That deck does not exist, or is not yours.');
    }
    const titles = new Map(decks.map((d) => [d.id, d.title]));

    const seen = cards.filter(
      (c): c is typeof c & { lastReviewedAt: Date } =>
        c.state !== 'NEW' && c.lastReviewedAt !== null,
    );
    const daysNowToExam = Math.max(0, (examAt.getTime() - now.getTime()) / 86_400_000);

    let expected = 0;
    let variance = 0;
    const histogram = Array.from({ length: 10 }, () => 0);
    const projected: (ExamCard & { gain: number })[] = [];

    for (const card of seen) {
      const elapsedAtExam = elapsedDays(card.lastReviewedAt, now) + daysNowToExam;
      const r = retrievability(config.params, elapsedAtExam, card.stability);
      expected += r;
      variance += r * (1 - r);
      histogram[Math.min(9, Math.floor(r * 10))]! += 1;

      // One Good answer now, then the same wait.
      const { card: after } = schedule(card, 3, now, config, 0.5);
      const lifted = retrievability(config.params, daysNowToExam, after.stability);
      projected.push({
        cardId: card.id,
        deckId: card.deckId,
        deckTitle: titles.get(card.deckId) ?? '',
        front: card.front,
        retrievability: r,
        gain: Math.max(0, lifted - r),
      });
    }

    const sd = Math.sqrt(variance);
    const atRisk = [...projected]
      .sort((a, b) => a.retrievability - b.retrievability)
      .slice(0, 20)
      .map(({ gain: _gain, ...card }) => card);
    const bestMoves = [...projected].sort((a, b) => b.gain - a.gain).slice(0, 10);

    return {
      date: query.date,
      daysAway,
      cardsCounted: seen.length,
      newCards: cards.length - seen.length,
      expectedRecalled: expected,
      low: Math.max(0, expected - 2 * sd),
      high: Math.min(seen.length, expected + 2 * sd),
      calibrationError,
      histogram,
      atRisk,
      bestMoves,
    };
  }

  async curve(userId: string, query: CurveQuery): Promise<ForgettingCurve> {
    const config = await this.scheduling.forUser(userId);
    if (query.cardId) return this.cardCurve(userId, query.cardId, config);
    if (query.deckId) return this.deckCurve(userId, query.deckId, config);
    // The contract's refine already rules this out; it is here so the types
    // hold without a cast that would outlive the schema it depends on.
    throw new BadRequestException('Provide either cardId or deckId.');
  }

  /**
   * One card's actual history: decay between reviews, a jump at each one.
   *
   * The x-axis is days since the card's first review, so the whole sawtooth
   * sits on one timeline. This is the chart the product is named for -- it is
   * drawn from the stored log rather than from the card's cached state, which
   * is why `Review` keeps the before- and after-stability of every answer.
   */
  private async cardCurve(
    userId: string,
    cardId: string,
    config: UserScheduling,
  ): Promise<ForgettingCurve> {
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, userId },
      select: { stability: true, lastReviewedAt: true, state: true },
    });
    if (!card) throw new NotFoundException('That card does not exist, or is not yours.');

    const reviews = await this.prisma.review.findMany({
      where: { cardId, userId },
      orderBy: { reviewedAt: 'asc' },
      select: { reviewedAt: true, rating: true, retrievability: true, newStability: true },
    });

    if (reviews.length === 0 || !card.lastReviewedAt) {
      // Never reviewed: there is no curve yet, and inventing one would be a
      // drawing of nothing.
      return {
        cardId,
        points: [],
        markers: [],
        desiredRetention: config.desiredRetention,
        dueInDays: 0,
      };
    }

    const origin = reviews[0]!.reviewedAt.getTime();
    const dayOf = (at: Date): number => (at.getTime() - origin) / 86_400_000;

    const interval = intervalFromRetention(
      config.params,
      card.stability,
      config.desiredRetention,
    );
    const lastDay = dayOf(card.lastReviewedAt);
    const end = Math.max(lastDay + interval * 1.2, lastDay + 1 / 24);

    // Sampled per segment, not evenly across the whole history. Intervals grow
    // geometrically, so evenly spaced samples put nearly all of them in the
    // last gap and can skip an early one entirely: a ten-minute learning step
    // inside a two-year history falls between two samples and vanishes.
    const perSegment = Math.max(6, Math.floor((CURVE_RESOLUTION * 2) / reviews.length));
    const points: { day: number; retrievability: number }[] = [];

    reviews.forEach((review, index) => {
      const from = dayOf(review.reviewedAt);
      const next = reviews[index + 1];
      const to = next ? dayOf(next.reviewedAt) : end;
      for (let i = 0; i <= perSegment; i += 1) {
        const since = ((to - from) * i) / perSegment;
        points.push({
          day: from + since,
          retrievability: retrievability(config.params, since, review.newStability),
        });
      }
    });

    return {
      cardId,
      points,
      markers: reviews.map((r) => ({
        day: dayOf(r.reviewedAt),
        rating: r.rating,
        retrievabilityBefore: r.retrievability,
      })),
      desiredRetention: config.desiredRetention,
      // On the same axis as the points, so the crossing can be drawn where it
      // actually falls rather than as a number beside the chart.
      dueInDays: lastDay + interval,
    };
  }

  /**
   * A deck's aggregate curve: mean predicted recall over the coming weeks.
   *
   * Not an average of the individual sawtooths -- those peak at different times
   * and averaging them produces a smooth line that describes no card in the
   * deck. This projects every card forward from where it is now and takes the
   * mean at each day, which is a claim that can actually be checked.
   */
  private async deckCurve(
    userId: string,
    deckId: string,
    config: UserScheduling,
  ): Promise<ForgettingCurve> {
    const deck = await this.prisma.deck.findFirst({
      where: { id: deckId, userId },
      select: { id: true },
    });
    if (!deck) throw new NotFoundException('That deck does not exist, or is not yours.');

    const cards = await this.prisma.card.findMany({
      where: { deckId, userId, suspendedAt: null, state: { not: 'NEW' } },
      select: { stability: true, lastReviewedAt: true },
    });

    const seen = cards.filter((c) => c.lastReviewedAt !== null);
    if (seen.length === 0) {
      return {
        deckId,
        points: [],
        markers: [],
        desiredRetention: config.desiredRetention,
        dueInDays: 0,
      };
    }

    const now = new Date();
    const horizonDays = 60;
    const step = horizonDays / CURVE_RESOLUTION;

    const points: { day: number; retrievability: number }[] = [];
    let crossing = horizonDays;
    let found = false;

    for (let i = 0; i <= CURVE_RESOLUTION; i += 1) {
      const day = i * step;
      let sum = 0;
      for (const c of seen) {
        const elapsed = elapsedDays(c.lastReviewedAt as Date, now) + day;
        sum += retrievability(config.params, elapsed, c.stability);
      }
      const mean = sum / seen.length;
      points.push({ day, retrievability: mean });

      if (!found && mean < config.desiredRetention) {
        crossing = day;
        found = true;
      }
    }

    return {
      deckId,
      points,
      markers: [],
      desiredRetention: config.desiredRetention,
      dueInDays: crossing,
    };
  }
}
