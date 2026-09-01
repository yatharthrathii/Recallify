import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CurrentUser, LoginRequest, RegisterRequest } from '@recallify/contracts';
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
