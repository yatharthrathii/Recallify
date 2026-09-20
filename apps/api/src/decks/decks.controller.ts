import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiCreated, ApiNoContent, ApiOk, ApiOwned } from '../common/api-responses';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { DecksService } from './decks.service';
import {
  CreateDeckDto,
  DeckDto,
  DeckPageDto,
  DeckStatsDto,
  ListDecksQueryDto,
  UpdateDeckDto,
} from './dto';

@ApiTags('decks')
@ApiBearerAuth()
@Controller('decks')
export class DecksController {
  constructor(private readonly decks: DecksService) {}

  @Get()
  @ApiOperation({ summary: 'List decks, newest first' })
  @ApiOk(DeckPageDto)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDecksQueryDto,
  ): Promise<DeckPageDto> {
    return this.decks.list(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a deck' })
  @ApiCreated(DeckDto)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateDeckDto,
  ): Promise<DeckDto> {
    return this.decks.create(user.id, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One deck' })
  @ApiOk(DeckDto)
  @ApiOwned()
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<DeckDto> {
    return this.decks.get(user.id, id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Counts, mean recall, and a 30-day forecast' })
  @ApiOk(DeckStatsDto)
  @ApiOwned()
  stats(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DeckStatsDto> {
    return this.decks.stats(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename, recolour, or archive' })
  @ApiOk(DeckDto)
  @ApiOwned()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateDeckDto,
  ): Promise<DeckDto> {
    return this.decks.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a deck, its cards, and their review history' })
  @ApiNoContent()
  @ApiOwned()
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.decks.remove(user.id, id);
  }
}
