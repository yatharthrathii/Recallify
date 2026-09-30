import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProblemDetailsDto } from '../common/problem.dto';
import { ApiOk, ApiOwned } from '../common/api-responses';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import {
  CurveQueryDto,
  ExamForecastDto,
  ExamQueryDto,
  ForecastDto,
  ForecastQueryDto,
  ForgettingCurveDto,
  HeatmapDto,
  HeatmapQueryDto,
  StatsOverviewDto,
  WorkloadPreviewDto,
} from './dto';
import { StatsService } from './stats.service';

@ApiTags('stats')
@ApiBearerAuth()
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'XP, level, streak, and measured retention',
    description:
      'Retention here is what the user actually recalled over the last 30 ' +
      'days, not what the model predicted. First-ever reviews are excluded.',
  })
  @ApiOk(StatsOverviewDto)
  overview(@CurrentUser() user: AuthenticatedUser): Promise<StatsOverviewDto> {
    return this.stats.overview(user.id);
  }

  @Get('heatmap')
  @ApiOperation({ summary: 'Reviews per day, and the recall rate on each' })
  @ApiOk(HeatmapDto)
  async heatmap(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: HeatmapQueryDto,
  ): Promise<HeatmapDto> {
    return { days: await this.stats.heatmap(user.id, query) };
  }

  @Get('forecast')
  @ApiOperation({ summary: 'Cards falling due over the coming days' })
  @ApiOk(ForecastDto)
  forecast(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ForecastQueryDto,
  ): Promise<ForecastDto> {
    return this.stats.forecast(user.id, query);
  }

  @Get('workload')
  @ApiOperation({
    summary: 'Estimated daily reviews at each retention target',
    description:
      'The whole slider range in one response. An estimate: it counts cards ' +
      'in REVIEW and ignores lapses and new cards.',
  })
  @ApiOk(WorkloadPreviewDto)
  workload(@CurrentUser() user: AuthenticatedUser): Promise<WorkloadPreviewDto> {
    return this.stats.workload(user.id);
  }

  @Get('exam')
  @ApiOperation({
    summary: 'What will still be known on a date',
    description:
      'Every reviewed card’s predicted recall on the date, summed, with ' +
      'a range and the latest report’s calibration error beside it. Lists ' +
      'the cards most likely to be gone and the ones a single Good answer ' +
      'today would lift the most. New cards are counted but not predicted.',
  })
  @ApiOk(ExamForecastDto)
  @ApiOwned()
  @ApiBadRequestResponse({ description: 'A date in the past.', type: ProblemDetailsDto })
  exam(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ExamQueryDto,
  ): Promise<ExamForecastDto> {
    return this.stats.exam(user.id, query);
  }

  @Get('curve')
  @ApiOperation({
    summary: 'The forgetting curve for one card, or a whole deck',
    description:
      'For a card: the real sawtooth, drawn from its review log -- decay ' +
      'between reviews and a jump at each one. For a deck: mean predicted ' +
      'recall projected forward, which is a claim that can be checked.',
  })
  @ApiOk(ForgettingCurveDto)
  @ApiOwned()
  curve(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CurveQueryDto,
  ): Promise<ForgettingCurveDto> {
    return this.stats.curve(user.id, query);
  }
}
