import { Module } from '@nestjs/common';
import { DecksController } from './decks.controller';
import { DecksService } from './decks.service';

@Module({
  controllers: [DecksController],
  providers: [DecksService],
  // Cards and reviews need to check deck ownership. They go through this
  // service rather than reaching for the deck table themselves.
  exports: [DecksService],
})
export class DecksModule {}
