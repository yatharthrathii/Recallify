import { Injectable } from '@nestjs/common';
import { DEFAULT_CONFIG, DEFAULT_PARAMS, type FsrsConfig } from '@recallify/fsrs';
import { PrismaService } from '../prisma/prisma.service';

/** What the user's row contributes to scheduling. */
export interface UserScheduling extends FsrsConfig {
  readonly dailyNewLimit: number;
  readonly dailyReviewLimit: number;
  readonly usingOptimizedParams: boolean;
}

/**
 * Turns a user row into the config the pure engine expects.
 *
 * `@recallify/fsrs` knows nothing about users or databases -- that is the whole
 * point of keeping it pure. This is the one place the two meet, so there is
 * exactly one answer to "which parameters is this user being scheduled with?".
 */
@Injectable()
export class FsrsConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(userId: string): Promise<UserScheduling> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        fsrsParams: true,
        desiredRetention: true,
        dailyNewLimit: true,
        dailyReviewLimit: true,
      },
    });

    // A stored array of the wrong length is treated as absent rather than
    // padded. Half a parameter set is not a parameter set, and silently
    // filling the gap would schedule everyone from a model nobody fitted.
    const fitted = user.fsrsParams.length === DEFAULT_PARAMS.length;

    return {
      ...DEFAULT_CONFIG,
      params: fitted ? user.fsrsParams : DEFAULT_PARAMS,
      desiredRetention: user.desiredRetention,
      dailyNewLimit: user.dailyNewLimit,
      dailyReviewLimit: user.dailyReviewLimit,
      usingOptimizedParams: fitted,
    };
  }
}
