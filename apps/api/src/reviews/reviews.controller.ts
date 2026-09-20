import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiOk, ApiOwned } from '../common/api-responses';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import {
  BatchReviewDto,
  BatchReviewResponseDto,
  ExplanationDto,
  QueueQueryDto,
  QueueResponseDto,
  ReviewHistoryPageDto,
  ReviewHistoryQueryDto,
  ReviewOutcomeDto,
  SubmitReviewDto,
} from './dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('review')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('queue')
  @ApiOperation({ summary: "Cards to study now, after the day's caps" })
  @ApiOk(QueueResponseDto)
  queue(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueueQueryDto,
  ): Promise<QueueResponseDto> {
    return this.reviews.queue(user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit one review',
    description:
      'The `id` is generated on the device and is the primary key, so this is ' +
      'safe to retry: a repeated id returns `applied: false` and the review is ' +
      'stored once.',
  })
  @ApiOk(ReviewOutcomeDto)
  @ApiOwned()
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SubmitReviewDto,
  ): Promise<ReviewOutcomeDto> {
    return this.reviews.submit(user.id, body);
  }

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync up to 200 reviews taken offline',
    description:
      'Applied oldest first. Ids already stored are counted as duplicates ' +
      'rather than rejected, so a partially delivered batch can be resent whole.',
  })
  @ApiOk(BatchReviewResponseDto)
  @ApiOwned()
  batch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: BatchReviewDto,
  ): Promise<BatchReviewResponseDto> {
    return this.reviews.batch(user.id, body);
  }

  @Get('history')
  @ApiOperation({ summary: 'The append-only log, newest first' })
  @ApiOk(ReviewHistoryPageDto)
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReviewHistoryQueryDto,
  ): Promise<ReviewHistoryPageDto> {
    return this.reviews.history(user.id, query);
  }

  @Get('explain/:cardId')
  @ApiOperation({
    summary: 'Why this card is due, and what each button would do',
    description:
      'Stability, difficulty, predicted recall, and the interval each rating ' +
      'would produce -- computed by running the scheduler, not by a second ' +
      'approximation of it.',
  })
  @ApiOk(ExplanationDto)
  @ApiOwned()
  explain(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId') cardId: string,
  ): Promise<ExplanationDto> {
    return this.reviews.explain(user.id, cardId);
  }
}
