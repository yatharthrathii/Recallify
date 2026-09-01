import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../common/current-user.decorator';
import { IS_PUBLIC } from './public.decorator';
import { TokenService } from './token.service';

/**
 * Requires a valid access token, unless the route is marked @Public().
 *
 * Applied globally rather than route by route. Opting out has to be explicit,
 * so forgetting a decorator leaves an endpoint closed rather than open --
 * a missed guard is otherwise invisible until someone finds it.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Sign in to continue.');
    }

    request.user = await this.tokens.verifyAccess(header.slice(7));
    return true;
  }
}
