import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AI_PROVIDER, type AiProvider } from '../src/ai/provider';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * These tests run against a real Postgres, not a mock.
 *
 * Everything worth checking here is a property of the database: that ownership
 * really is enforced in the WHERE clause, that a duplicate review id really is
 * rejected by a unique constraint, that a transaction really does roll the XP
 * back with the review. A mocked Prisma would agree with whatever the code
 * already believes and prove none of it.
 *
 * CI runs a postgres:16 service container. Locally it uses whatever DATABASE_URL
 * points at, so every account these tests create is deleted afterwards.
 */

export const API = '/api/v1';

export interface Harness {
  readonly app: INestApplication;
  readonly prisma: PrismaService;
  readonly http: () => request.Agent;
  close(): Promise<void>;
}

export interface HarnessOptions {
  /**
   * Replaces the real model. Integration tests must never spend the live
   * free-tier quota, and CI has no key -- so the AI tests script the model's
   * replies, including the malformed and rate-limited ones.
   */
  readonly aiProvider?: AiProvider;
}

export async function startHarness(options: HarnessOptions = {}): Promise<Harness> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.aiProvider) {
    builder = builder.overrideProvider(AI_PROVIDER).useValue(options.aiProvider);
  }
  const moduleRef = await builder.compile();

  // Quiet by default; TEST_LOG=1 turns the app's own logging back on when a
  // failing test needs the stack behind a 500.
  const app = moduleRef.createNestApplication(
    process.env['TEST_LOG'] ? {} : { logger: false },
  );
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    http: () => request.agent(app.getHttpServer() as App),
    close: async () => {
      await app.close();
    },
  };
}

export interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly accessToken: string;
  readonly refreshToken: string;
}

/** Unique per run, so a failed test never poisons the next one. */
export function uniqueEmail(label = 'user'): string {
  return `${label}-${randomUUID()}@recallify.test`;
}

export async function registerUser(h: Harness, label = 'user'): Promise<TestUser> {
  const email = uniqueEmail(label);
  const res = await h
    .http()
    .post(`${API}/auth/register`)
    .send({ email, password: 'correct-horse-battery', displayName: label })
    .expect(201);

  const me = await h
    .http()
    .get(`${API}/auth/me`)
    .set('authorization', `Bearer ${res.body.accessToken}`)
    .expect(200);

  return {
    id: me.body.id,
    email,
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
  };
}

/** Removes a test account and, by cascade, everything it owns. */
export async function deleteUsers(h: Harness, ...users: TestUser[]): Promise<void> {
  await h.prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
}

export function auth(user: TestUser): { authorization: string } {
  return { authorization: `Bearer ${user.accessToken}` };
}
