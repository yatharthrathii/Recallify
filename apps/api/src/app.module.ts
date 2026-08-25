import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';

/**
 * Modular monolith. One deployable, hard module boundaries.
 *
 * Rule from docs/02-ARCHITECTURE.md: no module imports another module's
 * repository. Cross-module reads go through the owning module's service. That
 * boundary is what makes "modular monolith" honest rather than decorative.
 *
 * Phase 4 adds: auth, users, decks, cards, reviews, scheduler, stats.
 * Phase 5 adds: ai.
 * Phase 3 output is consumed by: optimizer.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), HealthModule],
})
export class AppModule {}
