import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, registerUser, startHarness, uniqueEmail, type Harness, type TestUser } from './harness';

describe('auth', () => {
  let h: Harness;
  const created: TestUser[] = [];

  beforeAll(async () => {
    h = await startHarness();
  });

  afterAll(async () => {
    await h.prisma.user.deleteMany({ where: { id: { in: created.map((u) => u.id) } } });
    await h.close();
  });

  it('closes every route by default', async () => {
    await h.http().get(`${API}/auth/me`).expect(401);
    await h.http().get(`${API}/decks`).expect(401);
    await h.http().get(`${API}/review/queue`).expect(401);
  });

  it('stores the password as an argon2id hash and never in the clear', async () => {
    const user = await registerUser(h, 'hash');
    created.push(user);

    const row = await h.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(row.passwordHash).not.toContain('correct-horse-battery');
  });

  it('creates the stats row with the user', async () => {
    const user = await registerUser(h, 'stats-row');
    created.push(user);

    const stats = await h.prisma.userStats.findUnique({ where: { userId: user.id } });
    expect(stats).not.toBeNull();
    expect(stats?.xp).toBe(0);
    expect(stats?.level).toBe(1);
  });

  it('rejects a duplicate email with 409', async () => {
    const user = await registerUser(h, 'dupe');
    created.push(user);

    await h
      .http()
      .post(`${API}/auth/register`)
      .send({ email: user.email, password: 'correct-horse-battery' })
      .expect(409);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const user = await registerUser(h, 'enumerate');
    created.push(user);

    const wrongPassword = await h
      .http()
      .post(`${API}/auth/login`)
      .send({ email: user.email, password: 'not-the-right-password' })
      .expect(401);

    const unknownEmail = await h
      .http()
      .post(`${API}/auth/login`)
      .send({ email: uniqueEmail('ghost'), password: 'not-the-right-password' })
      .expect(401);

    // Identical wording, so the response cannot be used to discover which
    // addresses have accounts.
    expect(wrongPassword.body.detail).toBe(unknownEmail.body.detail);
  });

  it('answers validation failures as problem+json with field errors', async () => {
    const res = await h
      .http()
      .post(`${API}/auth/register`)
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);

    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.traceId).toBeTruthy();
    expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('revokes the whole family when a rotated refresh token is replayed', async () => {
    const user = await registerUser(h, 'reuse');
    created.push(user);

    const first = user.refreshToken;

    const rotated = await h
      .http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: first })
      .expect(200);

    const second = rotated.body.refreshToken as string;
    expect(second).not.toBe(first);

    // The replay. Either it was stolen or the client is confused; both mean
    // the family can no longer be trusted.
    await h.http().post(`${API}/auth/refresh`).send({ refreshToken: first }).expect(401);

    // And the token that was legitimately in use dies with it.
    await h.http().post(`${API}/auth/refresh`).send({ refreshToken: second }).expect(401);

    const live = await h.prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });
    expect(live).toBe(0);
  });

  it('stores refresh tokens hashed, never raw', async () => {
    const user = await registerUser(h, 'token-hash');
    created.push(user);

    const rows = await h.prisma.refreshToken.findMany({
      where: { userId: user.id },
      select: { tokenHash: true },
    });

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.tokenHash).not.toBe(user.refreshToken);
    }
  });
});
