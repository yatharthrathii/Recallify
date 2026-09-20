import {
  createDeckRequest,
  deck,
  deckStats,
  listDecksQuery,
  paginated,
  updateDeckRequest,
} from '@recallify/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateDeckDto extends createZodDto(createDeckRequest) {}
export class UpdateDeckDto extends createZodDto(updateDeckRequest) {}
export class ListDecksQueryDto extends createZodDto(listDecksQuery) {}
export class DeckDto extends createZodDto(deck) {}
export class DeckPageDto extends createZodDto(paginated(deck)) {}
export class DeckStatsDto extends createZodDto(deckStats) {}
