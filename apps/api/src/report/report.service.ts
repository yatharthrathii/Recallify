import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  MemoryReport,
  ReportCurve,
  ReportDeck,
  ReportLeech,
  ReportModel,
  ReportPatterns,
  ReportRequest,
  ReportStatus,
} from '@recallify/contracts';
import { memoryReport } from '@recallify/contracts';
import {
  DEFAULT_PARAMS,
  elapsedDays,
  initialDifficulty,
  initialStability,
  retrievability,
  type FsrsParams,
  type Rating,
} from '@recallify/fsrs';
import { MIN_REVIEWS, evaluate, type TrainingReview } from '@recallify/optimizer';
import { addDays, startOfDay } from '../common/dates';
import { OptimizerService, toEvaluation } from '../optimizer/optimizer.service';
import { PrismaService } from '../prisma/prisma.service';
import { FsrsConfigService, type UserScheduling } from '../scheduling/fsrs-config.service';
import { meanRetrievability } from '../scheduling/recall';
import { measuredRetention } from '../stats/retention';

/** One report a day, unless the log has grown enough to say something new. */
const COOLDOWN_HOURS = 24;
/** Inside the cooldown, this much new history earns a fresh report anyway. */
const GROWTH_FOR_EARLY_REPORT = 50;

/** The measured figures look back this far. */
const WINDOW_DAYS = 90;
/** Days drawn on the "one card, answered Good once" curve. */
const CURVE_DAYS = 60;
/** Answers an hour needs before its recall rate is quoted. */
const MIN_HOUR_ANSWERS = 30;
const LEECH_LAPSES = 3;
const LEECH_LIMIT = 10;

type Stored = Omit<MemoryReport, 'id' | 'createdAt'>;
/** The stored JSON is checked on the way back out, not trusted because we wrote it. */
const stored = memoryReport.omit({ id: true, createdAt: true });

const pct = (fraction: number): string => `${Math.round(fraction * 100)}%`;
const days = (n: number): string => {
  const rounded = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  return `${rounded} ${rounded === 1 ? 'day' : 'days'}`;
};
const HOURS = Array.from({ length: 24 }, (_, h) => {
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${h < 12 ? 'am' : 'pm'}`;
});
const sameParams = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] as number)) < 1e-9);

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: FsrsConfigService,
    private readonly optimizer: OptimizerService,
  ) {}

  /**
   * A stored report, or null when the row no longer matches the shape the
   * contract describes: a deploy that changed it would otherwise turn every
   * read into a 500. The stored JSON has ISO strings where the contract
   * has dates, which is exactly what the schema parses.
   */
  private toReport(row: { id: string; createdAt: Date; data: Prisma.JsonValue }): MemoryReport | null {
    const parsed = stored.safeParse(row.data);
    if (!parsed.success) {
      this.logger.warn(`report ${row.id} no longer matches the contract and is not shown`);
      return null;
    }
    return { id: row.id, createdAt: row.createdAt, ...parsed.data };
  }

  private async latestRow(userId: string) {
    return this.prisma.memoryReport.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * How far the latest report found the model this account is scheduled
   * with to be from right, for the exam forecast to quote beside its range.
   */
  async latestCalibrationError(userId: string): Promise<number | null> {
    const row = await this.latestRow(userId);
    const report = row ? this.toReport(row) : null;
    return report?.model.current?.calibrationError ?? null;
  }

  async status(userId: string): Promise<ReportStatus> {
    const [row, reviewCount] = await Promise.all([
      this.latestRow(userId),
      this.prisma.review.count({ where: { userId } }),
    ]);
    return {
      latest: row ? this.toReport(row) : null,
      reviewCount,
      minimumReviewsForFit: MIN_REVIEWS,
      nextAllowedAt: this.nextAllowedAt(row, reviewCount, new Date()),
    };
  }

  private nextAllowedAt(
    row: { createdAt: Date; reviewCount: number } | null,
    reviewCount: number,
    now: Date,
  ): Date | null {
    if (!row) return null;
    // Growth in either direction: a deck deleted with its history changes
    // what a report would say just as much as new reviews do.
    if (Math.abs(reviewCount - row.reviewCount) >= GROWTH_FOR_EARLY_REPORT) return null;
    const next = new Date(row.createdAt.getTime() + COOLDOWN_HOURS * 3_600_000);
    return next > now ? next : null;
  }

  async get(userId: string, id: string): Promise<MemoryReport> {
    const row = await this.prisma.memoryReport.findFirst({ where: { id, userId } });
    const report = row ? this.toReport(row) : null;
    if (!report) throw new NotFoundException('That report does not exist, or is not yours.');
    return report;
  }

  async create(userId: string, input: ReportRequest, now = new Date()): Promise<MemoryReport> {
    const [latest, reviewCount, cardCount] = await Promise.all([
      this.latestRow(userId),
      this.prisma.review.count({ where: { userId } }),
      this.prisma.card.count({ where: { userId } }),
    ]);
    if (reviewCount === 0) {
      throw new UnprocessableEntityException(
        'There is nothing to report on until at least one card has been reviewed.',
      );
    }
    const nextAllowedAt = this.nextAllowedAt(latest, reviewCount, now);
    if (nextAllowedAt) {
      throw new UnprocessableEntityException(
        `A report was made recently. Another is available after ${nextAllowedAt.toISOString()}, ` +
          `or as soon as ${GROWTH_FOR_EARLY_REPORT} more reviews have been added.`,
      );
    }

    const config = await this.scheduling.forUser(userId);
    const started = Date.now();

    const [model, patterns, leeches, decks, measured] = await Promise.all([
      this.fit(userId, reviewCount, config),
      this.patterns(userId, input.tzOffsetMinutes, now),
      this.leeches(userId, config, now),
      this.decks(userId, config, now),
      measuredRetention(this.prisma, userId, addDays(startOfDay(now), -WINDOW_DAYS)),
    ]);

    const curve = this.curve(model, config);
    const statements = this.statements({
      model,
      curve,
      patterns,
      leeches,
      decks,
      measured,
      desiredRetention: config.desiredRetention,
    });

    const data: Stored = {
      reviewCount,
      cardCount,
      windowDays: WINDOW_DAYS,
      statements,
      model,
      curve,
      patterns,
      leeches,
      decks,
    };

    const row = await this.prisma.memoryReport.create({
      data: { userId, reviewCount, data: data as unknown as Prisma.InputJsonValue, createdAt: now },
    });
    this.logger.log(
      `report for ${userId}: ${reviewCount} reviews, fitted=${model.fitted}, ${Date.now() - started}ms`,
    );
    // Read back from the stored row, not from `data`: Postgres rounds the
    // last digit of a double on the way into jsonb, and the response should
    // be what every later read will say.
    return this.toReport(row) ?? { id: row.id, createdAt: row.createdAt, ...data };
  }

  /**
   * The fit, when there is enough history for one. Below the minimum the
   * defaults are still scored on the log, so the calibration figure exists
   * either way; only the comparison is missing. `current` scores whatever
   * this account is actually scheduled with, which may be neither.
   */
  private async fit(
    userId: string,
    reviewCount: number,
    config: UserScheduling,
  ): Promise<ReportModel> {
    const reviews = await this.optimizer.trainingReviews(userId);
    const scoreCurrent = (reviews: readonly TrainingReview[]) => {
      const e = evaluate(reviews, config.params, config);
      return e.predictions > 0 ? toEvaluation(e) : null;
    };

    if (reviewCount < MIN_REVIEWS) {
      const baseline = evaluate(reviews, DEFAULT_PARAMS, config);
      const scored = baseline.predictions > 0 ? toEvaluation(baseline) : null;
      return {
        fitted: false,
        reviewsUsed: reviews.length,
        params: null,
        baseline: scored,
        candidate: null,
        current: config.usingOptimizedParams ? scoreCurrent(reviews) : scored,
        lossImprovement: null,
        workloadChange: null,
        adopted: false,
      };
    }

    const fit = this.optimizer.fit(reviews, config);
    const adopted = config.usingOptimizedParams && sameParams(config.params, fit.params);
    const baseline = toEvaluation(fit.baseline);
    const candidate = toEvaluation(fit.candidate);
    return {
      fitted: true,
      reviewsUsed: reviews.length,
      params: [...fit.params],
      baseline,
      candidate,
      current: adopted ? candidate : config.usingOptimizedParams ? scoreCurrent(reviews) : baseline,
      lossImprovement: fit.lossImprovement,
      workloadChange: fit.workloadChange,
      adopted,
    };
  }

  /** One new card, answered Good, under this user's parameters and the published ones. */
  private curve(model: ReportModel, config: UserScheduling): ReportCurve {
    const source: ReportCurve['source'] = model.params
      ? 'fitted'
      : config.usingOptimizedParams
        ? 'adopted'
        : 'defaults';
    const yours: FsrsParams = model.params ?? config.params;
    const draw = (params: FsrsParams) => {
      const stability = initialStability(params, 3);
      const points = [];
      for (let day = 0; day <= CURVE_DAYS; day += 1) {
        points.push({ day, retrievability: retrievability(params, day, stability) });
      }
      return { points, stability };
    };
    const mine = draw(yours);
    const population = draw(DEFAULT_PARAMS);
    return {
      yours: mine.points,
      population: population.points,
      stabilityDays: { yours: mine.stability, population: population.stability },
      source,
    };
  }

  /** Recall by local hour and weekday, over the window. */
  private async patterns(
    userId: string,
    tzOffsetMinutes: number,
    now: Date,
  ): Promise<ReportPatterns> {
    const from = addDays(startOfDay(now), -WINDOW_DAYS);
    const rows = await this.prisma.$queryRaw<
      { hour: number; dow: number; reviews: bigint; attempted: bigint; recalled: bigint }[]
    >`
      SELECT
        EXTRACT(HOUR FROM local)::int AS hour,
        EXTRACT(DOW  FROM local)::int AS dow,
        COUNT(*)                                                      AS reviews,
        COUNT(*) FILTER (WHERE "prevState" <> 'NEW')                  AS attempted,
        COUNT(*) FILTER (WHERE "prevState" <> 'NEW' AND "rating" > 1) AS recalled
      FROM (
        SELECT "prevState", "rating",
               "reviewedAt" + make_interval(mins => ${tzOffsetMinutes}::int) AS local
        FROM "reviews"
        WHERE "userId" = ${userId} AND "reviewedAt" >= ${from}
      ) r
      GROUP BY 1, 2
    `;

    const hours = Array.from({ length: 24 }, () => ({ reviews: 0, attempted: 0, recalled: 0 }));
    const weekdays = Array.from({ length: 7 }, () => ({ reviews: 0, attempted: 0, recalled: 0 }));
    for (const r of rows) {
      for (const bucket of [hours[r.hour], weekdays[r.dow]]) {
        if (!bucket) continue;
        bucket.reviews += Number(r.reviews);
        bucket.attempted += Number(r.attempted);
        bucket.recalled += Number(r.recalled);
      }
    }
    const rate = (b: { attempted: number; recalled: number }) =>
      b.attempted > 0 ? b.recalled / b.attempted : null;

    let bestHour: number | null = null;
    let worstHour: number | null = null;
    let bestRate = -1;
    let worstRate = 2;
    hours.forEach((b, hour) => {
      const r = rate(b);
      if (b.attempted < MIN_HOUR_ANSWERS || r === null) return;
      if (r > bestRate) [bestHour, bestRate] = [hour, r];
      if (r < worstRate) [worstHour, worstRate] = [hour, r];
    });

    return {
      tzOffsetMinutes,
      hours: hours.map((b, hour) => ({ hour, reviews: b.reviews, retention: rate(b) })),
      weekdays: weekdays.map((b, weekday) => ({ weekday, reviews: b.reviews, retention: rate(b) })),
      bestHour,
      worstHour,
    };
  }

  /**
   * Cards forgotten again and again, ranked by lapses and then by the time
   * they have taken. Suspended cards and archived decks are left out: the
   * report tells the reader to suspend a leech, so one already suspended is
   * dealt with.
   */
  private async leeches(userId: string, config: UserScheduling, now: Date): Promise<ReportLeech[]> {
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        deckId: string;
        deckTitle: string;
        front: string;
        lapses: number;
        stability: number;
        lastReviewedAt: Date | null;
        reviews: bigint;
        ms: bigint;
        lastRating: number | null;
      }[]
    >`
      SELECT
        c."id", c."deckId", d."title" AS "deckTitle", c."front", c."lapses",
        c."stability", c."lastReviewedAt",
        COUNT(r."id")                     AS reviews,
        COALESCE(SUM(r."durationMs"), 0)  AS ms,
        (SELECT "rating" FROM "reviews" l WHERE l."cardId" = c."id"
           ORDER BY l."reviewedAt" DESC LIMIT 1) AS "lastRating"
      FROM "cards" c
      JOIN "decks" d ON d."id" = c."deckId"
      LEFT JOIN "reviews" r ON r."cardId" = c."id"
      WHERE c."userId" = ${userId} AND c."lapses" >= ${LEECH_LAPSES}
        AND c."suspendedAt" IS NULL AND d."archivedAt" IS NULL
      GROUP BY c."id", d."title"
      ORDER BY c."lapses" DESC, ms DESC
      LIMIT ${LEECH_LIMIT}
    `;
    return rows.map((r) => ({
      cardId: r.id,
      deckId: r.deckId,
      deckTitle: r.deckTitle,
      front: r.front,
      lapses: r.lapses,
      reviews: Number(r.reviews),
      minutesSpent: Number(r.ms) / 60_000,
      lastRating: (r.lastRating as Rating | null) ?? null,
      retrievability: r.lastReviewedAt
        ? retrievability(config.params, elapsedDays(r.lastReviewedAt, now), r.stability)
        : 0,
    }));
  }

  /** Each deck's reviews over the window, what they bought, and where the deck stands now. */
  private async decks(userId: string, config: UserScheduling, now: Date): Promise<ReportDeck[]> {
    const from = addDays(startOfDay(now), -WINDOW_DAYS);
    const [decks, cards, reviews] = await Promise.all([
      this.prisma.deck.findMany({
        where: { userId, archivedAt: null },
        select: { id: true, title: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.card.findMany({
        where: { userId, suspendedAt: null },
        select: { deckId: true, stability: true, lastReviewedAt: true },
      }),
      this.prisma.$queryRaw<
        { deckId: string; reviews: bigint; attempted: bigint; recalled: bigint }[]
      >`
        SELECT c."deckId",
               COUNT(*)                                                      AS reviews,
               COUNT(*) FILTER (WHERE r."prevState" <> 'NEW')                  AS attempted,
               COUNT(*) FILTER (WHERE r."prevState" <> 'NEW' AND r."rating" > 1) AS recalled
        FROM "reviews" r JOIN "cards" c ON c."id" = r."cardId"
        WHERE r."userId" = ${userId} AND r."reviewedAt" >= ${from}
        GROUP BY 1
      `,
    ]);

    const byDeck = new Map(reviews.map((r) => [r.deckId, r]));
    const cardsByDeck = new Map<string, typeof cards>();
    for (const card of cards) {
      const list = cardsByDeck.get(card.deckId);
      if (list) list.push(card);
      else cardsByDeck.set(card.deckId, [card]);
    }
    return decks
      .map((deck) => {
        const mine = cardsByDeck.get(deck.id) ?? [];
        const r = byDeck.get(deck.id);
        const count = r ? Number(r.reviews) : 0;
        const attempted = r ? Number(r.attempted) : 0;
        const recalled = r ? Number(r.recalled) : 0;
        return {
          deckId: deck.id,
          title: deck.title,
          cards: mine.length,
          reviews: count,
          reviewsPerCard: mine.length > 0 ? count / mine.length : 0,
          retention: attempted > 0 ? recalled / attempted : null,
          predictedRetention: meanRetrievability(config.params, mine, now),
        };
      })
      .filter((d) => d.cards > 0);
  }

  /**
   * The findings, in sentences.
   *
   * Every number here is one the sections carry, phrased so it can be acted
   * on. Nothing is said that the data does not support: with too little
   * history the sentence says so rather than guessing.
   */
  private statements(input: {
    model: ReportModel;
    curve: ReportCurve;
    patterns: ReportPatterns;
    leeches: ReportLeech[];
    decks: ReportDeck[];
    measured: { attempted: number; retention: number | null };
    desiredRetention: number;
  }): string[] {
    const { model, curve, patterns, leeches, decks, measured, desiredRetention } = input;
    const out: string[] = [];

    // How fast this person forgets, from the stability a first Good answer earns.
    const { yours, population } = curve.stabilityDays;
    if (curve.source === 'defaults') {
      out.push(
        `A new card you answer Good once stays above 90% for about ${days(population)}. That is the published average: with ${MIN_REVIEWS} reviews the scheduler can be fitted to you instead.`,
      );
    } else {
      const ratio = yours / population;
      const which = curve.source === 'fitted' ? 'The fit says a' : 'On your adopted parameters, a';
      if (Math.abs(ratio - 1) < 0.1) {
        out.push(
          `${which} new card you answer Good once stays above 90% for about ${days(yours)}, close to the ${days(population)} of the average learner.`,
        );
      } else if (ratio < 1) {
        out.push(
          `${which} new card you answer Good once stays above 90% for about ${days(yours)}, against ${days(population)} for the average learner. You forget new material about ${pct(1 - ratio)} faster than average, so it comes back sooner.`,
        );
      } else {
        out.push(
          `${which} new card you answer Good once stays above 90% for about ${days(yours)}, against ${days(population)} for the average learner. You hold new material about ${pct(ratio - 1)} longer than average, so it can wait longer.`,
        );
      }
    }

    if (model.params) {
      const d0 = initialDifficulty(model.params, 3);
      const dDefault = initialDifficulty(DEFAULT_PARAMS, 3);
      const both = `${d0.toFixed(1)} of 10 for you, against ${dDefault.toFixed(1)} for the average learner`;
      if (d0 - dDefault > 0.5) {
        out.push(
          `A new card answered Good starts at difficulty ${both}, so its intervals grow more slowly at first.`,
        );
      } else if (dDefault - d0 > 0.5) {
        out.push(
          `A new card answered Good starts at difficulty ${both}, so its intervals grow faster at first.`,
        );
      }
    }

    if (measured.retention !== null) {
      const gap = desiredRetention - measured.retention;
      const base = `Over the last ${WINDOW_DAYS} days you recalled ${pct(measured.retention)} of the ${measured.attempted.toLocaleString('en-US')} cards you were asked to remember, against a target of ${pct(desiredRetention)}.`;
      if (gap > 0.05) {
        out.push(
          `${base} The scheduler was more optimistic about you than it should have been; a fit corrects for that.`,
        );
      } else if (gap < -0.05) {
        out.push(
          `${base} You are recalling more than the target asks, which usually means reviews are coming sooner than they need to.`,
        );
      } else {
        out.push(`${base} The schedule is doing what it promised.`);
      }
    }

    if (model.fitted && model.baseline && model.candidate) {
      out.push(
        `The published defaults predicted your answers within ${pct(model.baseline.calibrationError)} of what happened; the fitted parameters are within ${pct(model.candidate.calibrationError)}.`,
      );
      if (model.workloadChange !== null && Math.abs(model.workloadChange) >= 0.03) {
        const more = model.workloadChange > 0;
        out.push(
          `Adopting the fit implies about ${pct(Math.abs(model.workloadChange))} ${more ? 'more' : 'fewer'} reviews a day. ${
            more
              ? 'That is the honest price of the target you chose: the model has learned you forget faster than the defaults assume.'
              : 'The defaults were bringing cards back before you needed them.'
          }`,
        );
      }
    } else if (!model.fitted) {
      out.push(
        `Below ${MIN_REVIEWS} reviews a fit follows noise, so this report scores the published defaults on your history instead. You have ${model.reviewsUsed.toLocaleString('en-US')}.`,
      );
    }

    if (patterns.bestHour !== null && patterns.worstHour !== null) {
      const best = patterns.hours[patterns.bestHour]!;
      const worst = patterns.hours[patterns.worstHour]!;
      if (patterns.bestHour !== patterns.worstHour && best.retention !== null && worst.retention !== null) {
        const spread = best.retention - worst.retention;
        out.push(
          spread >= 0.05
            ? `You remember best around ${HOURS[patterns.bestHour]} (${pct(best.retention)} recalled) and worst around ${HOURS[patterns.worstHour]} (${pct(worst.retention)}).`
            : `Time of day makes little difference to you: every hour with enough answers recalls within ${pct(spread)} of the others.`,
        );
      }
    }

    if (leeches.length > 0) {
      const minutes = leeches.reduce((sum, l) => sum + l.minutesSpent, 0);
      const count = leeches.length;
      out.push(
        `${count} ${count === 1 ? 'card has' : 'cards have'} been forgotten ${LEECH_LAPSES} or more times${
          minutes >= 1 ? `, taking ${Math.round(minutes)} ${Math.round(minutes) === 1 ? 'minute' : 'minutes'} between them` : ''
        }. Rewriting or suspending them costs less than another lapse.`,
      );
    }

    const costed = decks.filter((d) => d.retention !== null && d.reviews >= 20);
    if (costed.length >= 2) {
      const worst = [...costed].sort(
        (a, b) => a.retention! / a.reviewsPerCard - b.retention! / b.reviewsPerCard,
      )[0]!;
      out.push(
        `${worst.title} returns the least for its reviews: ${pct(worst.retention!)} recalled at ${worst.reviewsPerCard.toFixed(1)} reviews per card over ${WINDOW_DAYS} days.`,
      );
    }

    return out;
  }
}
