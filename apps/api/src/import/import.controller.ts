import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiCreated, ApiOwned } from '../common/api-responses';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { ProblemDetailsDto } from '../common/problem.dto';
import { ImportRequestDto, ImportResponseDto } from './dto';
import { ImportService } from './import.service';

@ApiTags('import')
@ApiBearerAuth()
@Controller('import')
export class ImportController {
  constructor(private readonly importer: ImportService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Import cards with their review history',
    description:
      'One request of a larger import: up to 500 cards and 5,000 reviews, ' +
      'into an existing deck or a new one. Each card’s reviews are ' +
      'replayed through the scheduler, oldest first, so the card arrives ' +
      'with a stability this engine computed. A card with no reviews arrives ' +
      'new. The file itself is read on the device; see @recallify/import.',
  })
  @ApiCreated(ImportResponseDto)
  @ApiOwned()
  @ApiConflictResponse({
    description: 'A review id in the request is already stored: this history was imported before.',
    type: ProblemDetailsDto,
  })
  importCards(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ImportRequestDto,
  ): Promise<ImportResponseDto> {
    return this.importer.importCards(user.id, body);
  }
}
