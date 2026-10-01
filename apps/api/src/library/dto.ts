import {
  deckChange,
  deckChangesPage,
  deckNoteRequest,
  libraryDeck,
  libraryDeckDetail,
  libraryQuery,
  pageQuery,
  paginated,
  subscriptionStatus,
  syncResult,
} from '@recallify/contracts';
import { createZodDto } from 'nestjs-zod';

export class LibraryQueryDto extends createZodDto(libraryQuery) {}
export class LibraryPageDto extends createZodDto(paginated(libraryDeck)) {}
export class LibraryDeckDetailDto extends createZodDto(libraryDeckDetail) {}
export class DeckChangeDto extends createZodDto(deckChange) {}
export class DeckChangesQueryDto extends createZodDto(pageQuery) {}
export class DeckChangesPageDto extends createZodDto(deckChangesPage) {}
export class DeckNoteDto extends createZodDto(deckNoteRequest) {}
export class SubscriptionStatusDto extends createZodDto(subscriptionStatus) {}
export class SyncResultDto extends createZodDto(syncResult) {}
