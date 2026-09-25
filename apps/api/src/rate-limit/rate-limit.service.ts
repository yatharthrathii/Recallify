import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Nest has no built-in 429; the problem filter titles errors from the class name. */
export class TooManyRequestsException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

const DAY_MS = 86_400_000;

/**
 * Sliding-window counters in Postgres.
 *
 * Not in memory: the API runs as serverless functions that share nothing, and
 * a per-instance counter would give every cold start a fresh allowance. One
 * indexed count and one insert per check is cheap next to what it protects,
 * an argon2 verification or a seeded demo account.
 */
@Injectable()
export class RateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  /** Events recorded under `key` in the last `windowMs`. */
  count(key: string, windowMs: number): Promise<number> {
    return this.prisma.rateLimitHit.count({
      where: { key, createdAt: { gt: new Date(Date.now() - windowMs) } },
    });
  }

  async record(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.prisma.rateLimitHit.createMany({ data: keys.map((key) => ({ key })) });
    // Sweep now and then rather than on a schedule: there is no scheduler on
    // the free tier, and nothing here needs history older than a day.
    if (Math.random() < 0.02) {
      await this.prisma.rateLimitHit.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - DAY_MS) } },
      });
    }
  }

  /** Throws once any key has reached its limit within its window. */
  async assertUnder(
    checks: ReadonlyArray<{ key: string; limit: number; windowMs: number }>,
    message: string,
  ): Promise<void> {
    const counts = await Promise.all(checks.map((c) => this.count(c.key, c.windowMs)));
    if (counts.some((n, i) => n >= checks[i]!.limit)) throw new TooManyRequestsException(message);
  }
}
