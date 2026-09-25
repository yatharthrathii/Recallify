import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CurrentUser,
  LoginRequest,
  RegisterRequest,
  UpdateSettingsRequest,
} from '@recallify/contracts';
import { createHash, randomBytes } from 'node:crypto';
import type { Env } from '../config/env';
import { MailService, MailUnavailableError } from '../mail/mail.service';
import { passwordResetEmail } from '../mail/templates';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { type IssuedTokens, TokenService } from './token.service';

/** How long a reset link works. Short, because it is a password in the post. */
const RESET_TTL_MINUTES = 30;

/** Links one address can ask for in an hour. Enough for a typo; not a flood. */
const RESET_LINKS_PER_HOUR = 3;

/** A password hash to compare against when the email does not exist. */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$8s7Zm1p4YrJqQGQ0dVjKZzHl4mUXqLwSxNmVBHFJ0nA';

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(input: RegisterRequest, userAgent?: string): Promise<IssuedTokens> {
    const passwordHash = await this.passwords.hash(input.password);

    // A duplicate email surfaces as Prisma P2002, which the problem filter
    // turns into a 409. Checking first and then inserting would leave a race
    // between the two queries; the unique index is the only real guard.
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        displayName: input.displayName ?? null,
        // Created eagerly so no later code has to cope with stats being absent.
        stats: { create: {} },
      },
      select: { id: true, email: true },
    });

    return this.tokens.issue(user.id, user.email, undefined, userAgent);
  }

  async login(input: LoginRequest, userAgent?: string): Promise<IssuedTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, passwordHash: true },
    });

    // Verify against a dummy hash when the email is unknown, so both paths do
    // the same work. Returning early would make "no such user" measurably
    // faster than "wrong password", which is enough to enumerate accounts.
    const ok = await this.passwords.verify(user?.passwordHash ?? DUMMY_HASH, input.password);

    // One message for both failures, for the same reason.
    if (!user || !ok) throw new UnauthorizedException('Email or password is incorrect.');

    return this.tokens.issue(user.id, user.email, undefined, userAgent);
  }

  /**
   * Email a reset link.
   *
   * Answers the same way whether or not the address has an account, so the
   * endpoint cannot be used to find out which addresses do. The one thing it
   * will not do is pretend: with no email provider configured in production,
   * it says so rather than leave someone watching an empty inbox.
   */
  async forgotPassword(email: string): Promise<void> {
    if (!this.mail.configured) {
      throw new ServiceUnavailableException(
        'Password reset email cannot be sent right now. Please try again later.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    if (!user) return;

    const recent = await this.prisma.passwordReset.count({
      where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3_600_000) } },
    });
    if (recent >= RESET_LINKS_PER_HOUR) {
      // Silently, for the same reason as above: a 429 would confirm the
      // address exists. The earlier links still work.
      this.log.warn(`Reset link limit reached for user ${user.id}`);
      return;
    }

    // Opaque and random. Only its hash is stored, so the database alone
    // cannot be turned into a working link.
    const token = randomBytes(32).toString('base64url');
    const reset = await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
      },
      select: { id: true },
    });

    const link = new URL('/reset-password', this.config.get('WEB_URL', { infer: true }));
    link.searchParams.set('token', token);

    try {
      await this.mail.send(passwordResetEmail(user.email, link.toString(), RESET_TTL_MINUTES));
    } catch (error) {
      // A link nobody received should not count against the hourly allowance.
      await this.prisma.passwordReset.delete({ where: { id: reset.id } });
      if (error instanceof MailUnavailableError) {
        throw new ServiceUnavailableException(
          'Password reset email cannot be sent right now. Please try again later.',
        );
      }
      throw error;
    }
  }

  /**
   * Set a new password from a link.
   *
   * The link is spent, every other outstanding link for the account is spent
   * with it, and every session on every device is signed out. A reset is the
   * one moment when "who else is signed in" can be answered with certainty:
   * nobody.
   */
  async resetPassword(token: string, password: string): Promise<void> {
    const reset = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: this.hashToken(token) },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });

    if (!reset || reset.usedAt !== null || reset.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'This reset link is invalid or has expired. Ask for a new one.',
      );
    }

    const passwordHash = await this.passwords.hash(password);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      this.prisma.passwordReset.updateMany({
        where: { userId: reset.userId, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Settings, including the retention target.
   *
   * Changing desiredRetention does not rewrite any card's due date. Intervals
   * already handed out stand; the new target applies from each card's next
   * review. Rescheduling a whole collection because a slider moved would be a
   * surprise, and an expensive one.
   */
  async updateSettings(userId: string, input: UpdateSettingsRequest): Promise<CurrentUser> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.desiredRetention !== undefined
          ? { desiredRetention: input.desiredRetention }
          : {}),
        ...(input.dailyNewLimit !== undefined ? { dailyNewLimit: input.dailyNewLimit } : {}),
        ...(input.dailyReviewLimit !== undefined
          ? { dailyReviewLimit: input.dailyReviewLimit }
          : {}),
      },
    });
    return this.me(userId);
  }

  /**
   * Erase the account and, by cascade, everything it owns.
   *
   * Asks for the password again: a session left open on a shared laptop should
   * not be enough to delete years of review history. Google Play also requires
   * apps that create accounts to offer deletion from inside the app.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });

    const ok = await this.passwords.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('That password is not correct.');

    await this.prisma.user.delete({ where: { id: userId } });
  }

  async me(userId: string): Promise<CurrentUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        isDemo: true,
        desiredRetention: true,
        dailyNewLimit: true,
        dailyReviewLimit: true,
        fsrsParams: true,
        paramsOptimizedAt: true,
      },
    });

    const { fsrsParams, ...rest } = user;
    return {
      ...rest,
      // The parameters themselves are not exposed here; the settings screen
      // only needs to know whether the optimizer has ever run.
      hasOptimizedParams: fsrsParams.length > 0,
    };
  }
}
