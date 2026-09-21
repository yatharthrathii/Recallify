import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ApiNoContent, ApiOk, ApiOwned } from '../common/api-responses';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { ProblemDetailsDto } from '../common/problem.dto';
import { AiService } from './ai.service';
import { AiReportDto, AiUsageDto, GenerateDto, GenerateResultDto } from './dto';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Draft cards from a topic or from notes',
    description:
      'Returns drafts and saves nothing. Post the ones worth keeping to ' +
      "/cards/bulk with source 'AI'. Charged in cards against a daily " +
      'allowance; a request with less allowance left than it asks for gets ' +
      'fewer cards rather than a refusal. Any failure refunds the charge.',
  })
  @ApiOk(GenerateResultDto)
  @ApiOwned()
  @ApiTooManyRequestsResponse({
    description: 'Daily allowance used up, or more than three requests in a minute.',
    type: ProblemDetailsDto,
  })
  @ApiUnprocessableEntityResponse({
    description: 'The model returned no usable cards for this request.',
    type: ProblemDetailsDto,
  })
  @ApiBadGatewayResponse({
    description: 'The model replied with something that could not be parsed, twice.',
    type: ProblemDetailsDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Every model is rate-limited or down, or no key is configured.',
    type: ProblemDetailsDto,
  })
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenerateDto,
  ): Promise<GenerateResultDto> {
    return this.ai.generate(user.id, body);
  }

  @Get('usage')
  @ApiOperation({ summary: "Today's allowance: used, remaining, and when it resets" })
  @ApiOk(AiUsageDto)
  usage(@CurrentUser() user: AuthenticatedUser): Promise<AiUsageDto> {
    return this.ai.usage(user.id);
  }

  @Post('report')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Flag a generated card as offensive or wrong',
    description:
      'Works for drafts that were never saved as well as for saved cards: the ' +
      'text is stored as a snapshot, not as a card id.',
  })
  @ApiNoContent('Recorded.')
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AiReportDto,
  ): Promise<void> {
    return this.ai.report(user.id, body);
  }
}
