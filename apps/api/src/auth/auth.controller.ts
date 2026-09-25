import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ProblemDetailsDto } from '../common/problem.dto';
import { ApiCreated, ApiNoContent, ApiOk } from '../common/api-responses';
import type { Request, Response } from 'express';
import { clientIp, userAgent } from '../common/client';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { DemoService } from '../demo/demo.service';
import { AuthService } from './auth.service';
import {
  AuthTokensDto,
  CurrentUserDto,
  DeleteAccountDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateSettingsDto,
} from './dto';
import { Public } from './public.decorator';
import { type IssuedTokens, TokenService } from './token.service';

const REFRESH_COOKIE = 'recallify_refresh';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly demo: DemoService,
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
  @ApiCreated(AuthTokensDto)
  @ApiConflictResponse({
    description: 'That email already has an account.',
    type: ProblemDetailsDto,
  })
  async register(
    @Body() body: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensDto> {
    return this.respond(res, await this.auth.register(body, userAgent(req)));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in',
    description:
      'After 10 failed attempts for one address, or 50 from one client, answers 429 ' +
      'for 15 minutes. Counted whether or not the address has an account.',
  })
  @ApiOk(AuthTokensDto)
  @ApiTooManyRequestsResponse({ description: 'Too many failed attempts.', type: ProblemDetailsDto })
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensDto> {
    return this.respond(res, await this.auth.login(body, userAgent(req), clientIp(req)));
  }

  /**
   * A throwaway account with six months of simulated history, signed in.
   * Deleted a day later. Five per client per hour.
   */
  @Public()
  @Post('demo')
  @ApiOperation({
    summary: 'Open a demo account',
    description:
      'Creates a private account seeded with six months of history produced by the ' +
      'scheduler itself, and signs in to it. It cannot be signed in to again and is ' +
      'deleted after 24 hours.',
  })
  @ApiCreated(AuthTokensDto)
  @ApiTooManyRequestsResponse({ description: 'Too many demo accounts.', type: ProblemDetailsDto })
  async openDemo(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensDto> {
    const account = await this.demo.create(clientIp(req));
    return this.respond(res, await this.tokens.issue(account.id, account.email, undefined, userAgent(req)));
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
  @ApiOk(AuthTokensDto)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { refreshToken?: string },
  ): Promise<AuthTokensDto> {
    const presented = req.cookies?.[REFRESH_COOKIE] ?? body?.refreshToken ?? '';
    return this.respond(res, await this.tokens.rotate(presented, userAgent(req)));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out of this session' })
  @ApiNoContent('Signed out. The refresh cookie is cleared.')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { refreshToken?: string },
  ): Promise<void> {
    const presented = req.cookies?.[REFRESH_COOKIE] ?? body?.refreshToken;
    if (presented) await this.tokens.revoke(presented);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Email a password reset link',
    description:
      'Answers 202 whether or not the address has an account, so it cannot be ' +
      'used to discover which addresses do. The link works for 30 minutes, once.',
  })
  @ApiNoContent('Accepted. If the address has an account, a link is on its way.')
  @ApiServiceUnavailableResponse({
    description: 'No email provider is configured.',
    type: ProblemDetailsDto,
  })
  async forgotPassword(@Body() body: ForgotPasswordDto): Promise<void> {
    await this.auth.forgotPassword(body.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Set a new password from a reset link',
    description:
      'Spends the link and signs the account out of every session, on every device.',
  })
  @ApiNoContent('Password changed. Sign in again with the new one.')
  @ApiBadRequestResponse({
    description: 'The link is invalid, already used, or older than 30 minutes.',
    type: ProblemDetailsDto,
  })
  async resetPassword(@Body() body: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(body.token, body.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The signed-in user' })
  @ApiOk(CurrentUserDto)
  me(@CurrentUser() user: AuthenticatedUser): Promise<CurrentUserDto> {
    return this.auth.me(user.id);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update settings',
    description:
      'Name, retention target and daily limits. A new retention target applies ' +
      "from each card's next review; existing due dates are not rewritten.",
  })
  @ApiOk(CurrentUserDto)
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateSettingsDto,
  ): Promise<CurrentUserDto> {
    return this.auth.updateSettings(user.id, body);
  }

  @Delete('me')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete the account and everything it owns',
    description: 'Requires the password again. Cannot be undone.',
  })
  @ApiNoContent('Deleted.')
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.deleteAccount(user.id, body.password);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  }
}
