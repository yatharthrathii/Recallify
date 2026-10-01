import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  CurrentUser,
  OptimizerApplyRequest,
  OptimizerEvaluation,
  OptimizerRunResponse,
  OptimizerStatus,
} from '@recallify/contracts';
import { DEFAULT_PARAMS, type FsrsConfig, type FsrsParams, type Rating } from '@recallify/fsrs';
import {
  MIN_REVIEWS,
  backtest,
  optimize,
  withinBounds,
  type Evaluation,
  type TrainingReview,
} from '@recallify/optimizer';
import { PrismaService } from '../prisma/prisma.service';
import { FsrsConfigService } from '../scheduling/fsrs-config.service';

/**
 * Fitting is gradient descent over the user's whole history, and it runs on the
 * same thread that serves every other request. That is a real cost, so it is
 * bounded rather than hidden:
 *
 *   - a hard cap on iterations and on how much history is fed in,
 *   - one run per user per cooldown window,
 *   - and nothing is written until the user accepts the result.
 *
 * Moving it to a worker thread or a queue is the correct answer at scale and is
 * deliberately not pretended here. With the review counts this will see, the
 * caps are what keep a run in the low seconds.
 */
const MAX_ITERATIONS = 60;
const MAX_TRAINING_REVIEWS = 20_000;
const COOLDOWN_HOURS = 24;

export function toEvaluation(e: Evaluation): OptimizerEvaluation {
  return {
    logLoss: e.logLoss,
    predictions: e.predictions,
    predictedRetention: e.predictedRetention,
    actualRetention: e.actualRetention,
    calibrationError: e.calibrationError,
    averageIntervalDays: e.averageIntervalDays,
    estimatedReviewsPerDay: e.estimatedReviewsPerDay,
  };
}

/** A fit and its backtest against the published defaults, on the same history. */
export interface Fit {
  params: FsrsParams;
  iterations: number;
  converged: boolean;
  initialLoss: number;
  finalLoss: number;
  baseline: Evaluation;
  candidate: Evaluation;
  lossImprovement: number;
  workloadChange: number;
}

@Injectable()
export class OptimizerService {
  private readonly logger = new Logger(OptimizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: FsrsConfigService,
  ) {}

  private nextRunAllowedAt(optimizedAt: Date | null): Date | null {
    if (!optimizedAt) return null;
    const next = new Date(optimizedAt.getTime() + COOLDOWN_HOURS * 3_600_000);
    return next > new Date() ? next : null;
  }

  async status(userId: string): Promise<OptimizerStatus> {
    const [user, reviewCount] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { fsrsParams: true, paramsOptimizedAt: true },
      }),
      this.prisma.review.count({ where: { userId } }),
    ]);

    return {
      reviewCount,
      minimumReviews: MIN_REVIEWS,
      eligible: reviewCount >= MIN_REVIEWS,
      usingOptimizedParams: user.fsrsParams.length === DEFAULT_PARAMS.length,
      paramsOptimizedAt: user.paramsOptimizedAt,
      nextRunAllowedAt: this.nextRunAllowedAt(user.paramsOptimizedAt),
    };
  }

  /**
   * The history a fit is made from, oldest first, capped.
   *
   * Only the three columns the optimizer uses. The stored stabilities are
   * deliberately left behind: they belong to whatever parameters were live at
   * the time, and every candidate produces its own. History is replayed from
   * the ratings, which is the concrete reason Review is append-only.
   */
  async trainingReviews(userId: string): Promise<TrainingReview[]> {
    const rows = await this.prisma.review.findMany({
      where: { userId },
      orderBy: { reviewedAt: 'asc' },
      take: MAX_TRAINING_REVIEWS,
      select: { cardId: true, rating: true, reviewedAt: true },
    });
    return rows.map((r) => ({ cardId: r.cardId, rating: r.rating as Rating, reviewedAt: r.reviewedAt }));
  }

  /**
   * The fit itself, and its comparison with the defaults. The report and the
   * optimizer endpoint both call this, so the caps and the order of the
   * comparison live in one place.
   */
  fit(reviews: readonly TrainingReview[], config: FsrsConfig): Fit {
    const started = Date.now();
    const result = optimize(reviews, {
      startingParams: DEFAULT_PARAMS,
      maxIterations: MAX_ITERATIONS,
      config,
    });
    // Candidate first, baseline second -- that is the order backtest takes, and
    // swapping them would report the defaults as the improvement.
    const comparison = backtest(reviews, result.params, DEFAULT_PARAMS, config);
    this.logger.log(
      `fitted params on ${reviews.length} reviews: ${result.iterations} iterations, ${Date.now() - started}ms`,
    );
    return {
      params: result.params,
      iterations: result.iterations,
      converged: result.converged,
      initialLoss: result.initialLoss,
      finalLoss: result.finalLoss,
      baseline: comparison.baseline,
      candidate: comparison.candidate,
      lossImprovement: comparison.lossImprovement,
      workloadChange: comparison.workloadChange,
    };
  }

  /**
   * Fit parameters to this user's log and report what changed.
   *
   * Nothing is saved. The result is a proposal, so the user sees the
   * comparison -- including the workload change, which is often upward --
   * before deciding. Applying it is a separate, explicit call.
   */
  async run(userId: string): Promise<OptimizerRunResponse> {
    const status = await this.status(userId);

    if (!status.eligible) {
      // Below this the fit follows noise and does worse than the published
      // defaults. Returning a worse model would be worse than returning nothing.
      throw new UnprocessableEntityException(
        `Fitting needs at least ${MIN_REVIEWS} reviews. You have ${status.reviewCount}.`,
      );
    }

    if (status.nextRunAllowedAt) {
      throw new UnprocessableEntityException(
        'Parameters were fitted recently. Another run is available ' +
          `after ${status.nextRunAllowedAt.toISOString()}.`,
      );
    }

    const [config, reviews] = await Promise.all([
      this.scheduling.forUser(userId),
      this.trainingReviews(userId),
    ]);
    const fit = this.fit(reviews, config);

    return {
      params: [...fit.params],
      reviewsUsed: reviews.length,
      initialLoss: fit.initialLoss,
      finalLoss: fit.finalLoss,
      iterations: fit.iterations,
      converged: fit.converged,
      baseline: toEvaluation(fit.baseline),
      candidate: toEvaluation(fit.candidate),
      lossImprovement: fit.lossImprovement,
      workloadChange: fit.workloadChange,
    };
  }

  /**
   * Accept a fitted set.
   *
   * The parameters are re-checked against the bounds rather than trusted
   * because they came back from our own endpoint. A client can post anything,
   * and an out-of-range weight does not error -- it quietly schedules every
   * card in the account wrongly, for months, with nothing to see.
   */
  async apply(userId: string, input: OptimizerApplyRequest): Promise<CurrentUser> {
    if (!withinBounds(input.params)) {
      throw new BadRequestException('Those parameters are outside the fitted range.');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { fsrsParams: input.params, paramsOptimizedAt: new Date() },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        isDemo: true,
        desiredRetention: true,
        dailyNewLimit: true,
        dailyReviewLimit: true,
        paramsOptimizedAt: true,
        timezone: true,
      },
    });

    return { ...user, hasOptimizedParams: true };
  }

  /** Back to the published defaults. */
  async reset(userId: string): Promise<CurrentUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { fsrsParams: [], paramsOptimizedAt: null },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        isDemo: true,
        desiredRetention: true,
        dailyNewLimit: true,
        dailyReviewLimit: true,
        paramsOptimizedAt: true,
        timezone: true,
      },
    });

    return { ...user, hasOptimizedParams: false };
  }
}
