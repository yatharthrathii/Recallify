import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  controllers: [StatsController],
  providers: [StatsService],
  // ReviewsService folds each answered card into these totals, inside the same
  // transaction as the review itself.
  exports: [StatsService],
})
export class StatsModule {}
