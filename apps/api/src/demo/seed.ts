import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';
import { DemoService } from './demo.service';

/**
 * `pnpm db:seed`: a local account with six months of simulated history, so a
 * fresh database has something to look at. Replaces the account if it is
 * already there. Refuses to run with NODE_ENV=production.
 *
 *   SEED_EMAIL     default dev@recallify.local
 *   SEED_PASSWORD  default correct-horse-battery
 */
async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('Refusing to seed with NODE_ENV=production.');
  }
  const email = (process.env['SEED_EMAIL'] ?? 'dev@recallify.local').toLowerCase();
  const password = process.env['SEED_PASSWORD'] ?? 'correct-horse-battery';

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email } });
    const passwordHash = await app.get(PasswordService).hash(password);
    const account = await app.get(DemoService).seed({
      email,
      passwordHash,
      displayName: 'Dev',
      isDemo: false,
    });
    process.stdout.write(
      [
        `Seeded ${account.email} with ${account.reviewCount} reviews.`,
        `Sign in with the password: ${password}`,
        '',
      ].join('\n'),
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
