import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './auth/auth.module';
import { JwtGuard } from './auth/jwt.guard';
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
    AuthModule,
    HealthModule,
  ],
  providers: [
    // Every request body, query and param is validated against its Zod
    // contract before a handler ever sees it. Nothing reaches a service
    // unparsed.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Every error leaves as problem+json carrying the request id.
    { provide: APP_FILTER, useClass: ProblemFilter },
    // Closed by default. A route is only reachable without a token if it is
    // explicitly marked @Public(), so forgetting a decorator leaves an endpoint
    // locked rather than open -- the failure that would otherwise go unnoticed.
    { provide: APP_GUARD, useClass: JwtGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
