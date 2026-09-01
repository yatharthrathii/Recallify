import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { AuthService } from './auth.service';
import { AuthTokensDto, CurrentUserDto, LoginDto, RegisterDto } from './dto';
import { Public } from './public.decorator';
import { type IssuedTokens, TokenService } from './token.service';

const REFRESH_COOKIE = 'recallify_refresh';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Put the refresh token in an httpOnly cookie and keep it out of the body.
   *
   * httpOnly means no script can read it, so an XSS cannot walk off with the
   * long-lived credential. The path restriction means it is not attached to
   * every ordinary request either -- it only travels to the endpoints that
   * actually need it.
   *
   * Mobile has no cookie jar, so it also receives the token in the body and
   * stores it in the OS keychain instead.
   */
  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 30 * 86_400_000,
    });
  }

  private respond(res: Response, issued: IssuedTokens): { accessToken: string; expiresIn: number; refreshToken: string } {
    this.setRefreshCookie(res, issued.refreshToken);
    return {
      accessToken: issued.accessToken,
      expiresIn: issued.expiresIn,
      refreshToken: issued.refreshToken,
    };
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create an account' })
  async register(
    @Body() body: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensDto> {
    return this.respond(res, await this.auth.register(body, req.headers['user-agent']));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in' })
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensDto> {
    return this.respond(res, await this.auth.login(body, req.headers['user-agent']));
  }

  /**
   * Exchange a refresh token for a new pair.
   *
   * The old one is retired in the same step. Presenting a retired token later
   * revokes every session in its family -- see TokenService.rotate.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the session' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { refreshToken?: string },
  ): Promise<AuthTokensDto> {
    const presented = req.cookies?.[REFRESH_COOKIE] ?? body?.refreshToken ?? '';
    return this.respond(res, await this.tokens.rotate(presented, req.headers['user-agent']));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out of this session' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { refreshToken?: string },
  ): Promise<void> {
    const presented = req.cookies?.[REFRESH_COOKIE] ?? body?.refreshToken;
    if (presented) await this.tokens.revoke(presented);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The signed-in user' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<CurrentUserDto> {
    return this.auth.me(user.id);
  }
}
