import { Injectable, UnauthorizedException } from '@nestjs/common';
import type {
  CurrentUser,
  LoginRequest,
  RegisterRequest,
  UpdateSettingsRequest,
} from '@recallify/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { type IssuedTokens, TokenService } from './token.service';

/** A password hash to compare against when the email does not exist. */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$8s7Zm1p4YrJqQGQ0dVjKZzHl4mUXqLwSxNmVBHFJ0nA';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
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
