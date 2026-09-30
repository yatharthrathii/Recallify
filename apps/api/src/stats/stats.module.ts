import { Module } from '@nestjs/common';
import { ReportModule } from '../report/report.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [ReportModule],
  controllers: [StatsController],
  providers: [StatsService],
  // ReviewsService folds each answered card into these totals, inside the same
  // transaction as the review itself.
  exports: [StatsService],
})
export class StatsModule {}
