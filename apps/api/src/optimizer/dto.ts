import {
  optimizerApplyRequest,
  optimizerRunResponse,
  optimizerStatus,
} from '@recallify/contracts';
import { createZodDto } from 'nestjs-zod';

export class OptimizerStatusDto extends createZodDto(optimizerStatus) {}
export class OptimizerRunResponseDto extends createZodDto(optimizerRunResponse) {}
export class OptimizerApplyDto extends createZodDto(optimizerApplyRequest) {}
