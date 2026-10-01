import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiBadRequest, ApiConflict, ApiCreated, ApiOk, ApiOwned } from '../common/api-responses';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { ProblemDetailsDto } from '../common/problem.dto';
import { DeckDto } from '../decks/dto';
import {
  DeckChangeDto,
  DeckChangesPageDto,
  DeckChangesQueryDto,
  DeckNoteDto,
  LibraryDeckDetailDto,
  LibraryPageDto,
  LibraryQueryDto,
  SubscriptionStatusDto,
  SyncResultDto,
} from './dto';
import { LibraryService } from './library.service';

@ApiTags('library')
@ApiBearerAuth()
@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  @ApiOperation({ summary: 'Published decks, newest first' })
  @ApiOk(LibraryPageDto)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LibraryQueryDto,
  ): Promise<LibraryPageDto> {
    return this.library.list(user.id, query);
  }

  @Get('subscriptions/:deckId')
  @ApiOperation({
    summary: 'Where a subscribed copy stands against its source',
    description:
      'What a sync would add, edit and suspend, and the author’s changes ' +
      'since the last one. `source` is null once the author has unpublished; ' +
      'the copy is unaffected.',
  })
  @ApiOk(SubscriptionStatusDto)
  @ApiOwned()
  @ApiBadRequest('This deck does not follow another.')
  status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
  ): Promise<SubscriptionStatusDto> {
    return this.library.status(user.id, deckId);
  }

  @Post('subscriptions/:deckId/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bring a subscribed copy up to date',
    description:
      'Text only. The author’s edits reach the copy’s cards; their ' +
      'state, stability and review log are not touched. Cards the author added ' +
      'arrive new; cards the author deleted are suspended, never deleted.',
  })
  @ApiOk(SyncResultDto)
  @ApiOwned()
  @ApiBadRequest('This deck does not follow another.')
  sync(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
  ): Promise<SyncResultDto> {
    return this.library.sync(user.id, deckId);
  }

  @Delete('subscriptions/:deckId')
  @ApiOperation({ summary: 'Stop following. The deck, its cards and their history stay.' })
  @ApiOk(DeckDto)
  @ApiOwned()
  @ApiBadRequest('This deck does not follow another.')
  unsubscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
  ): Promise<DeckDto> {
    return this.library.unsubscribe(user.id, deckId);
  }

  @Get(':deckId')
  @ApiOperation({ summary: 'One published deck, with sample cards and its changelog' })
  @ApiOk(LibraryDeckDetailDto)
  @ApiOwned()
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
  ): Promise<LibraryDeckDetailDto> {
    return this.library.detail(user.id, deckId);
  }

  @Get(':deckId/changes')
  @ApiOperation({ summary: 'The changelog of a published deck, newest first' })
  @ApiOk(DeckChangesPageDto)
  @ApiOwned()
  changes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
    @Query() query: DeckChangesQueryDto,
  ): Promise<DeckChangesPageDto> {
    return this.library.changes(user.id, deckId, query);
  }

  @Post(':deckId/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Put one of your decks in the library',
    description:
      'From then on every card you add, edit or delete is recorded in the ' +
      'deck’s changelog and reaches subscribers on their next sync.',
  })
  @ApiOk(DeckDto)
  @ApiOwned()
  @ApiForbiddenResponse({ description: 'Demo accounts cannot publish.', type: ProblemDetailsDto })
  @ApiBadRequestResponse({
    description: 'The deck follows another, or is archived.',
    type: ProblemDetailsDto,
  })
  publish(@CurrentUser() user: AuthenticatedUser, @Param('deckId') deckId: string): Promise<DeckDto> {
    return this.library.publish(user.id, deckId);
  }

  @Post(':deckId/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Take a deck out of the library. Subscribers keep their copies.' })
  @ApiOk(DeckDto)
  @ApiOwned()
  unpublish(@CurrentUser() user: AuthenticatedUser, @Param('deckId') deckId: string): Promise<DeckDto> {
    return this.library.unpublish(user.id, deckId);
  }

  @Post(':deckId/notes')
  @ApiOperation({ summary: 'Add a note to a published deck’s changelog: the why beside the what' })
  @ApiCreated(DeckChangeDto)
  @ApiOwned()
  @ApiBadRequest('The deck is not published.')
  note(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
    @Body() body: DeckNoteDto,
  ): Promise<DeckChangeDto> {
    return this.library.addNote(user.id, deckId, body.text);
  }

  @Post(':deckId/subscribe')
  @ApiOperation({
    summary: 'Follow a published deck',
    description:
      'Makes a copy in your account with every card new. The copy is yours: ' +
      'reviewed and scheduled like any other deck, and kept in step with the ' +
      'author’s text by sync.',
  })
  @ApiCreated(DeckDto)
  @ApiOwned()
  @ApiBadRequest('The deck is the caller’s own.')
  @ApiConflict('Already following.')
  @ApiConflictResponse({ description: 'Already following this deck.', type: ProblemDetailsDto })
  @ApiBadRequestResponse({ description: 'Your own deck.', type: ProblemDetailsDto })
  subscribe(@CurrentUser() user: AuthenticatedUser, @Param('deckId') deckId: string): Promise<DeckDto> {
    return this.library.subscribe(user.id, deckId);
  }
}
