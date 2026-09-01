import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

/** What the access token proves about the caller. */
export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * The authenticated caller, attached by JwtGuard.
 *
 * Reading it without the guard in place is a programming error, not a runtime
 * condition, so it throws rather than returning undefined and letting a
 * handler silently query for `userId: undefined`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new Error('CurrentUser used on a route that is not behind JwtGuard');
    }
    return request.user;
  },
);
