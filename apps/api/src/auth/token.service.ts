import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export interface IssuedTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

interface AccessClaims {
  sub: string;
  email: string;
}

/**
 * Two tokens, doing two different jobs.
 *
 * The access token is a short-lived JWT the client sends with every request.
 * The refresh token is a long-lived opaque secret whose only power is to mint
 * a new access token. Splitting them means a stolen access token expires on
 * its own in minutes, and the thing that does not expire never travels except
 * on the one endpoint that needs it.
 *
 * v1 had neither: it kept a Firebase ID token in localStorage and never
 * refreshed it, so every session silently stopped working after an hour while
 * the UI still claimed the user was signed in.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Refresh tokens are stored hashed, never in the clear.
   *
   * A plain SHA-256 rather than argon2 on purpose: this is a 32-byte random
   * value, not a human-chosen password, so there is no dictionary to attack
   * and nothing for a slow hash to buy. It also has to be fast -- it runs on
   * every refresh.
   */
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private accessTtlSeconds(): number {
    const ttl = this.config.get('ACCESS_TOKEN_TTL', { infer: true });
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 900;
    const value = Number(match[1]);
    const unit = match[2];
    const scale = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86_400;
    return value * scale;
  }

  /**
   * Issue a fresh pair.
   *
   * `familyId` ties every token descended from one login together. Rotation
   * keeps the family; only a new login starts a new one.
   */
  async issue(
    userId: string,
    email: string,
    familyId: string = randomUUID(),
    userAgent?: string,
  ): Promise<IssuedTokens> {
    const claims: AccessClaims = { sub: userId, email };
    const expiresIn = this.accessTtlSeconds();

    const accessToken = await this.jwt.signAsync(claims, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn,
    });

    // Opaque and random, not a JWT: nothing about it needs to be readable, and
    // a value the server looks up can be revoked. A stateless refresh JWT
    // cannot be taken back before it expires.
    const refreshToken = randomBytes(48).toString('base64url');
    const days = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(refreshToken),
        familyId,
        expiresAt: new Date(Date.now() + days * 86_400_000),
        userAgent: userAgent?.slice(0, 500) ?? null,
      },
    });

    return { accessToken, refreshToken, expiresIn };
  }

  /**
   * Rotate a refresh token.
   *
   * The interesting case is reuse. If a token that has already been rotated
   * away is presented again, either it was stolen and replayed, or the
   * legitimate client is replaying an old one. Both mean the family can no
   * longer be trusted, so every token in it is revoked and the real user has
   * to sign in again.
   *
   * Without this, a stolen refresh token grants the attacker a rolling session
   * for as long as they keep using it, and nothing ever notices.
   */
  async rotate(presented: string, userAgent?: string): Promise<IssuedTokens> {
    const tokenHash = this.hash(presented);

    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!existing) throw new UnauthorizedException('Session expired. Please sign in again.');

    if (existing.revokedAt !== null) {
      await this.revokeFamily(existing.familyId);
      throw new UnauthorizedException(
        'This session was already replaced. For safety every session has been signed out.',
      );
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    // Retire this one, then mint its replacement inside the same family.
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    return this.issue(existing.user.id, existing.user.email, existing.familyId, userAgent);
  }

  /** Sign out of one session. */
  async revoke(presented: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(presented), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Sign out of every session descended from one login. */
  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async verifyAccess(token: string): Promise<{ id: string; email: string }> {
    try {
      const claims = await this.jwt.verifyAsync<AccessClaims>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      return { id: claims.sub, email: claims.email };
    } catch {
      throw new UnauthorizedException('Your session has expired.');
    }
  }
}
