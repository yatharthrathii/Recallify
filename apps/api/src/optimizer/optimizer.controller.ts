import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ProblemDetailsDto } from '../common/problem.dto';
import { ApiOk } from '../common/api-responses';
import { CurrentUserDto } from '../auth/dto';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { OptimizerApplyDto, OptimizerRunResponseDto, OptimizerStatusDto } from './dto';
import { OptimizerService } from './optimizer.service';

@ApiTags('optimizer')
@ApiBearerAuth()
@Controller('optimizer')
export class OptimizerController {
  constructor(private readonly optimizer: OptimizerService) {}

  @Get('status')
  @ApiOperation({ summary: 'Whether there is enough history to fit parameters yet' })
  @ApiOk(OptimizerStatusDto)
  status(@CurrentUser() user: AuthenticatedUser): Promise<OptimizerStatusDto> {
    return this.optimizer.status(user.id);
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Fit parameters to this user and compare against the defaults',
    description:
      'Saves nothing. The response is a proposal: it reports how much better ' +
      'the fitted model predicts this user, and how the daily workload would ' +
      'change. `workloadChange` is signed and is frequently positive -- ' +
      'fitting buys accuracy, not less studying.',
  })
  @ApiOk(OptimizerRunResponseDto)
  @ApiUnprocessableEntityResponse({
    description: 'Not enough review history yet, or a run happened recently.',
    type: ProblemDetailsDto,
  })
  run(@CurrentUser() user: AuthenticatedUser): Promise<OptimizerRunResponseDto> {
    return this.optimizer.run(user.id);
  }

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Adopt a fitted parameter set' })
  @ApiOk(CurrentUserDto)
  @ApiBadRequestResponse({
    description: 'Parameters outside the fitted range.',
    type: ProblemDetailsDto,
  })
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: OptimizerApplyDto,
  ): Promise<CurrentUserDto> {
    return this.optimizer.apply(user.id, body);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Go back to the published default parameters' })
  @ApiOk(CurrentUserDto)
  reset(@CurrentUser() user: AuthenticatedUser): Promise<CurrentUserDto> {
    return this.optimizer.reset(user.id);
  }
}
