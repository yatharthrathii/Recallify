import {
  bulkCreateRequest,
  bulkCreateResponse,
  card,
  createCardRequest,
  listCardsQuery,
  paginated,
  suspendCardRequest,
  updateCardRequest,
} from '@recallify/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateCardDto extends createZodDto(createCardRequest) {}
export class UpdateCardDto extends createZodDto(updateCardRequest) {}
export class BulkCreateDto extends createZodDto(bulkCreateRequest) {}
export class BulkCreateResponseDto extends createZodDto(bulkCreateResponse) {}
export class SuspendCardDto extends createZodDto(suspendCardRequest) {}
export class ListCardsQueryDto extends createZodDto(listCardsQuery) {}
export class CardDto extends createZodDto(card) {}
export class CardPageDto extends createZodDto(paginated(card)) {}
