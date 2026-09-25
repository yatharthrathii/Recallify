import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Waits between connection attempts, in ms. */
const RETRY_DELAYS = [500, 1_500, 3_000] as const;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The one place a database connection is opened.
 *
 * Nest owns the lifecycle: connect when the module starts, disconnect when it
 * stops. Without the explicit connect, the first request pays the handshake --
 * and on Neon's free tier, which sleeps after a few minutes idle, that is the
 * difference between a fast first page and a three-second one.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * A sleeping Neon endpoint takes a few seconds to accept its first
   * connection, and the attempt that wakes it usually fails. Retrying is what
   * makes that a slow start instead of a dead server; and if every attempt
   * fails the app still starts, because Prisma connects on the first query
   * anyway and a database that is briefly unreachable should show up as a
   * failing readiness probe, not as a process that will not boot.
   */
  async onModuleInit(): Promise<void> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await this.$connect();
        if (attempt > 0) this.logger.log(`database reached on attempt ${attempt + 1}`);
        return;
      } catch (error) {
        const delay = RETRY_DELAYS[attempt];
        if (delay === undefined) {
          this.logger.error(
            `could not reach the database in ${attempt + 1} attempts; starting anyway, ` +
              `/ready will report it as down: ${(error as Error).message.split('\n')[0]}`,
          );
          return;
        }
        await sleep(delay);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Cheap round trip for the readiness probe. */
  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
