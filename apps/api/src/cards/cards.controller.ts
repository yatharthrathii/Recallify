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
import { CardsService } from './cards.service';
import {
  BulkCreateDto,
  BulkCreateResponseDto,
  CardDto,
  CardPageDto,
  CreateCardDto,
  ListCardsQueryDto,
  SuspendCardDto,
  UpdateCardDto,
} from './dto';

@ApiTags('cards')
@ApiBearerAuth()
@Controller('cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  @ApiOperation({ summary: 'List cards, optionally within one deck' })
  @ApiOk(CardPageDto)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCardsQueryDto,
  ): Promise<CardPageDto> {
    return this.cards.list(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a card' })
  @ApiCreated(CardDto)
  @ApiOwned()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateCardDto): Promise<CardDto> {
    return this.cards.create(user.id, body);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create up to 500 cards in one insert' })
  @ApiCreated(BulkCreateResponseDto)
  @ApiOwned()
  bulk(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: BulkCreateDto,
  ): Promise<BulkCreateResponseDto> {
    return this.cards.bulkCreate(user.id, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One card, with its full FSRS state' })
  @ApiOk(CardDto)
  @ApiOwned()
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<CardDto> {
    return this.cards.get(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit the text. Scheduling state is untouched.' })
  @ApiOk(CardDto)
  @ApiOwned()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateCardDto,
  ): Promise<CardDto> {
    return this.cards.update(user.id, id, body);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hide from the queue, or put it back' })
  @ApiOk(CardDto)
  @ApiOwned()
  suspend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: SuspendCardDto,
  ): Promise<CardDto> {
    return this.cards.setSuspended(user.id, id, body.suspended);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a card and its review history' })
  @ApiNoContent()
  @ApiOwned()
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.cards.remove(user.id, id);
  }
}
