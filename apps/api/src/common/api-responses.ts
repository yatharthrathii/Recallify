import { applyDecorators, type Type } from '@nestjs/common';
import { ApiNotFoundResponse, ApiResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ProblemDetailsDto } from './problem.dto';

/**
 * Response documentation, declared rather than inferred.
 *
 * @nestjs/swagger does not read a handler's TypeScript return type on its own;
 * it needs either the build-time plugin or an explicit decorator. The plugin
 * is a second compiler pass that has to agree with the SWC builder, and when
 * it silently stops running the only symptom is that the published document
 * quietly loses every response body. Declaring them costs one line each and
 * cannot fail that way.
 *
 * Every endpoint also documents the error shape, because "what does a failure
 * look like" is the half of an API that usually goes unwritten.
 */
export function ApiOk(type: Type<unknown>, description?: string) {
  return applyDecorators(
    ApiResponse({ status: 200, type, ...(description ? { description } : {}) }),
    ApiUnauthorizedResponse({ description: 'Missing or expired access token.', type: ProblemDetailsDto }),
  );
}

export function ApiCreated(type: Type<unknown>, description?: string) {
  return applyDecorators(
    ApiResponse({ status: 201, type, ...(description ? { description } : {}) }),
    ApiUnauthorizedResponse({ description: 'Missing or expired access token.', type: ProblemDetailsDto }),
  );
}

export function ApiNoContent(description?: string) {
  return applyDecorators(
    ApiResponse({ status: 204, description: description ?? 'Done. No body.' }),
    ApiUnauthorizedResponse({ description: 'Missing or expired access token.', type: ProblemDetailsDto }),
  );
}

/**
 * For anything addressed by an id the caller may not own.
 *
 * There is no 403 anywhere in this API. Answering "that exists but is not
 * yours" would confirm the id, so not-yours and not-there are the same answer.
 */
export function ApiOwned() {
  return ApiNotFoundResponse({
    description: 'No such record, or it belongs to someone else.',
    type: ProblemDetailsDto,
  });
}
