import { memoryReport, reportRequest, reportStatus } from '@recallify/contracts';
import { createZodDto } from 'nestjs-zod';

export class ReportRequestDto extends createZodDto(reportRequest) {}
export class MemoryReportDto extends createZodDto(memoryReport) {}
export class ReportStatusDto extends createZodDto(reportStatus) {}
