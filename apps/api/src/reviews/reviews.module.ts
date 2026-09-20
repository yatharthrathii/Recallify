import { Module } from '@nestjs/common';
import { StatsModule } from '../stats/stats.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  // Reviews earn XP and move the streak, but user_stats belongs to stats.
  // Reviews calls its service inside the same transaction rather than writing
  // that table directly.
  imports: [StatsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
