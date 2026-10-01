import { Module } from '@nestjs/common';
import { OptimizerController } from './optimizer.controller';
import { OptimizerService } from './optimizer.service';

@Module({
  controllers: [OptimizerController],
  providers: [OptimizerService],
  // The Memory Report is the same fit, described in sentences.
  exports: [OptimizerService],
})
export class OptimizerModule {}
