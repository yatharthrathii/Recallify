import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { ProblemFilter } from './common/problem.filter';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { validateEnv } from './config/env';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Modular monolith. One deployable, hard module boundaries.
 *
 * Rule from docs/02-ARCHITECTURE.md: no module imports another module's
 * repository. Cross-module reads go through the owning module's service. That
 * boundary is what makes "modular monolith" honest rather than decorative.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // One .env at the repo root rather than a copy per app that drifts.
      envFilePath: ['../../.env'],
      // Boot fails loudly on a missing or malformed variable, naming it.
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
  ],
  providers: [
    // Every request body, query and param is validated against its Zod
    // contract before a handler ever sees it. Nothing reaches a service
    // unparsed.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Every error leaves as problem+json carrying the request id.
    { provide: APP_FILTER, useClass: ProblemFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
