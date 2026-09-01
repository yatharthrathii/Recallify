import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

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
  async onModuleInit(): Promise<void> {
    await this.$connect();
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
