import { importRequest, importResponse } from '@recallify/contracts';
import { createZodDto } from 'nestjs-zod';

export class ImportRequestDto extends createZodDto(importRequest) {}
export class ImportResponseDto extends createZodDto(importResponse) {}
