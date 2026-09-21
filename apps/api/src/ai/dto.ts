import {
  aiReportRequest,
  aiUsage,
  generateRequest,
  generateResult,
} from '@recallify/contracts';
import { createZodDto } from 'nestjs-zod';

export class GenerateDto extends createZodDto(generateRequest) {}
export class GenerateResultDto extends createZodDto(generateResult) {}
export class AiUsageDto extends createZodDto(aiUsage) {}
export class AiReportDto extends createZodDto(aiReportRequest) {}
