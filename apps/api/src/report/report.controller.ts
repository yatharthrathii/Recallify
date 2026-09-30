import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ApiCreated, ApiOk, ApiOwned } from '../common/api-responses';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { ProblemDetailsDto } from '../common/problem.dto';
import { MemoryReportDto, ReportRequestDto, ReportStatusDto } from './dto';
import { ReportService } from './report.service';

@ApiTags('report')
@ApiBearerAuth()
@Controller('report')
export class ReportController {
  constructor(private readonly reports: ReportService) {}

  @Get()
  @ApiOperation({ summary: 'The latest Memory Report, and whether a new one can be made' })
  @ApiOk(ReportStatusDto)
  status(@CurrentUser() user: AuthenticatedUser): Promise<ReportStatusDto> {
    return this.reports.status(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Make a Memory Report from the review log',
    description:
      'Fits parameters when there is enough history and describes the result ' +
      'in words, beside what the log itself shows: recall by hour and weekday, ' +
      'the cards that keep failing, and each deck’s return on its reviews. ' +
      'Stored, and reread with GET. One a day, or sooner once the log has ' +
      'grown by fifty reviews.',
  })
  @ApiCreated(MemoryReportDto)
  @ApiUnprocessableEntityResponse({
    description: 'No reviews yet, or a report was made too recently.',
    type: ProblemDetailsDto,
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReportRequestDto,
  ): Promise<MemoryReportDto> {
    return this.reports.create(user.id, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One stored report' })
  @ApiOk(MemoryReportDto)
  @ApiOwned()
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<MemoryReportDto> {
    return this.reports.get(user.id, id);
  }
}
