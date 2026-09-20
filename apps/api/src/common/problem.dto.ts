import { problemDetails } from '@recallify/contracts';
import { createZodDto } from 'nestjs-zod';

/** RFC 9457 problem+json. Every error in this API has this shape. */
export class ProblemDetailsDto extends createZodDto(problemDetails) {}
