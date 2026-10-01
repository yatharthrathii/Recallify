import { Module } from '@nestjs/common';
import { DecksModule } from '../decks/decks.module';
import { LibraryModule } from '../library/library.module';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';

@Module({
  // Every card write is reported to the library's changelog; it records
  // nothing unless the deck is published.
  imports: [DecksModule, LibraryModule],
  controllers: [CardsController],
  providers: [CardsService],
})
export class CardsModule {}
