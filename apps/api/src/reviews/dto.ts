import {
  batchReviewRequest,
  batchReviewResponse,
  explanation,
  paginated,
  queueQuery,
  queueResponse,
  reviewHistoryItem,
  reviewHistoryQuery,
  reviewOutcome,
  submitReviewRequest,
} from '@recallify/contracts';
import { createZodDto } from 'nestjs-zod';

export class SubmitReviewDto extends createZodDto(submitReviewRequest) {}
export class BatchReviewDto extends createZodDto(batchReviewRequest) {}
export class BatchReviewResponseDto extends createZodDto(batchReviewResponse) {}
export class ReviewOutcomeDto extends createZodDto(reviewOutcome) {}
export class QueueQueryDto extends createZodDto(queueQuery) {}
export class QueueResponseDto extends createZodDto(queueResponse) {}
export class ExplanationDto extends createZodDto(explanation) {}
export class ReviewHistoryQueryDto extends createZodDto(reviewHistoryQuery) {}
export class ReviewHistoryPageDto extends createZodDto(paginated(reviewHistoryItem)) {}
