import { Module } from '@nestjs/common';
import { OptimizerModule } from '../optimizer/optimizer.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  imports: [OptimizerModule],
  controllers: [ReportController],
  providers: [ReportService],
  // Exam-day prediction quotes the latest report's calibration error.
  exports: [ReportService],
})
export class ReportModule {}
