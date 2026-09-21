import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AiReportRequest,
  AiUsage,
  GenerateRequest,
  GenerateResult,
} from '@recallify/contracts';
import { addDays, startOfDay } from '../common/dates';
import { DecksService } from '../decks/decks.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseDrafts, type ParsedDrafts } from './parse';
import { RETRY_NUDGE, buildMessages, outputBudget } from './prompt';
import {
  AI_PROVIDER,
  type AiProvider,
  AiRejectedError,
  AiUnavailableError,
} from './provider';

/**
 * Generation requests per user per minute, successful or not.
 *
 * Counted from the database rather than in memory, because the API is meant to
 * run on serverless instances that share nothing -- an in-process counter
 * would give every instance its own fresh allowance.
 */
const PER_MINUTE = 3;

/**
 * Room for a reservation's seven round trips on a hosted database that may be
 * waking from idle. Prisma's default of five seconds was measured failing: a
 * cold Neon start alone can take one of these most of the way there.
 */
const RESERVE_TX = { maxWait: 5_000, timeout: 15_000 } as const;

/** Postgres lock_not_available -- what NOWAIT raises when the row is held. */
function isLockBusy(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const meta = JSON.stringify(error.meta ?? {});
  return meta.includes('55P03') || /could not obtain lock/i.test(error.message);
}

/** Nest has no built-in 429; the problem filter titles errors from the class name. */
class TooManyRequestsException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly decks: DecksService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
  ) {}

  async usage(userId: string, now = new Date()): Promise<AiUsage> {
    const today = startOfDay(now);
    const [user, spent] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { aiDailyLimit: true },
      }),
      this.prisma.aiUsage.aggregate({
        where: { userId, createdAt: { gte: today } },
        _sum: { cardsCreated: true },
      }),
    ]);

    const usedToday = spent._sum.cardsCreated ?? 0;
    return {
      usedToday,
      dailyLimit: user.aiDailyLimit,
      remaining: Math.max(0, user.aiDailyLimit - usedToday),
      resetsAt: addDays(today, 1),
    };
  }

  /**
   * Reserve the allowance, then call the model, then settle.
   *
   * The order is the point. Checking the allowance, calling the model and then
   * recording usage would let two requests arriving together both see twenty
   * cards remaining and both spend them. So the check and the charge happen
   * together, first, under a row lock on the user -- held only for those two
   * queries, never across the seconds the model takes to answer.
   *
   * Afterwards the reservation is corrected to what was actually produced. On
   * failure it is kept with zero cards rather than deleted: the daily allowance
   * is refunded, but the attempt still counts towards the per-minute limit, or
   * a stream of requests that always fail could hammer the provider for free.
   */
  async generate(userId: string, input: GenerateRequest): Promise<GenerateResult> {
    if (!this.provider.configured) {
      throw new ServiceUnavailableException(
        'AI generation is not configured on this server.',
      );
    }

    // Before any allowance is touched: a request for a deck that is not yours
    // should cost nothing.
    await this.decks.assertOwned(userId, input.deckId);

    const { reservationId, charge } = await this.reserve(userId, input.count);

    try {
      const request = { count: charge, topic: input.topic, text: input.text };
      const messages = buildMessages(request);
      const maxOutputTokens = outputBudget(charge);

      let completion = await this.provider.complete({ messages, maxOutputTokens });
      let promptTokens = completion.promptTokens;
      let outputTokens = completion.outputTokens;
      let result: ParsedDrafts = parseDrafts(completion.text, charge);

      // One retry, and only one. A second bad reply usually means the request
      // itself is the problem, and every retry spends shared free-tier capacity.
      if (!result.parsed || result.drafts.length === 0) {
        completion = await this.provider.complete({
          messages: [...messages, RETRY_NUDGE],
          maxOutputTokens,
        });
        promptTokens += completion.promptTokens;
        outputTokens += completion.outputTokens;
        result = parseDrafts(completion.text, charge);
      }

      if (!result.parsed) {
        await this.settle(reservationId, 0, promptTokens, outputTokens, completion.model);
        throw new BadGatewayException(
          'The model did not return a usable reply. Nothing was charged.',
        );
      }
      if (result.drafts.length === 0) {
        await this.settle(reservationId, 0, promptTokens, outputTokens, completion.model);
        throw new UnprocessableEntityException(
          'No usable cards came back for that request. Try a more specific topic. Nothing was charged.',
        );
      }

      await this.settle(
        reservationId,
        result.drafts.length,
        promptTokens,
        outputTokens,
        completion.model,
      );

      return {
        deckId: input.deckId,
        drafts: result.drafts,
        discarded: result.discarded,
        model: completion.model,
        usage: await this.usage(userId),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      // Refund the allowance. If even that write fails, the original error is
      // still the one worth reporting, so it is not allowed to mask it.
      await this.settle(reservationId, 0, 0, 0, 'failed').catch(() => undefined);

      if (error instanceof AiUnavailableError) {
        const wait = error.retryAfterSeconds;
        throw new ServiceUnavailableException(
          wait
            ? `AI generation is busy. Try again in about ${wait} seconds. Nothing was charged.`
            : `${error.message} Nothing was charged.`,
        );
      }
      if (error instanceof AiRejectedError) {
        throw new BadGatewayException(`${error.message} Nothing was charged.`);
      }
      throw error;
    }
  }

  private async reserve(
    userId: string,
    requested: number,
  ): Promise<{ reservationId: string; charge: number }> {
    try {
      return await this.prisma.$transaction(
        async (tx) => this.reserveIn(tx, userId, requested),
        RESERVE_TX,
      );
    } catch (error) {
      if (isLockBusy(error)) {
        throw new TooManyRequestsException(
          'Another generation for this account is already starting. Try again in a moment.',
        );
      }
      throw error;
    }
  }

  private async reserveIn(
    tx: Prisma.TransactionClient,
    userId: string,
    requested: number,
  ): Promise<{ reservationId: string; charge: number }> {
    // One reservation per account at a time. Different accounts never block
    // each other.
    //
    // NOWAIT, not a plain FOR UPDATE. Waiting was the first version and it
    // failed under load: every queued request held a pooled connection while
    // it waited, six at once ran past the transaction timeout, and four of
    // them came back as 500s. A second simultaneous generation for the same
    // person is not a normal thing to do, so it is refused at once instead.
    await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE NOWAIT`;

    const now = new Date();
    const [user, spent, recent] = await Promise.all([
      tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { aiDailyLimit: true },
      }),
      tx.aiUsage.aggregate({
        where: { userId, createdAt: { gte: startOfDay(now) } },
        _sum: { cardsCreated: true },
      }),
      tx.aiUsage.count({
        where: { userId, createdAt: { gte: new Date(now.getTime() - 60_000) } },
      }),
    ]);

    if (recent >= PER_MINUTE) {
      throw new TooManyRequestsException(
        `At most ${PER_MINUTE} generations a minute. Wait a moment and try again.`,
      );
    }

    const remaining = user.aiDailyLimit - (spent._sum.cardsCreated ?? 0);
    if (remaining <= 0) {
      throw new TooManyRequestsException(
        "Today's AI allowance is used up. It resets at midnight UTC.",
      );
    }

    // Asking for ten with five left gets five, not a refusal.
    const charge = Math.min(requested, remaining);
    const row = await tx.aiUsage.create({
      data: {
        userId,
        promptTokens: 0,
        outputTokens: 0,
        cardsCreated: charge,
        model: 'pending',
      },
      select: { id: true },
    });

    return { reservationId: row.id, charge };
  }

  private async settle(
    id: string,
    cardsCreated: number,
    promptTokens: number,
    outputTokens: number,
    model: string,
  ): Promise<void> {
    await this.prisma.aiUsage.update({
      where: { id },
      data: { cardsCreated, promptTokens, outputTokens, model },
    });
  }

  async report(userId: string, input: AiReportRequest): Promise<void> {
    await this.prisma.aiReport.create({
      data: {
        userId,
        front: input.front,
        back: input.back,
        reason: input.reason,
        note: input.note ?? null,
        model: input.model ?? null,
      },
    });
  }
}
