import { Module } from '@nestjs/common';
import { OptimizerController } from './optimizer.controller';
import { OptimizerService } from './optimizer.service';

@Module({
  controllers: [OptimizerController],
  providers: [OptimizerService],
})
export class OptimizerModule {}
