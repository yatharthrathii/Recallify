import { Module } from '@nestjs/common';
import { DecksModule } from '../decks/decks.module';
import { LibraryModule } from '../library/library.module';
import { StatsModule } from '../stats/stats.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

/**
 * Cards and reviews arrive together and are written together. Like the demo
 * seed, this writes card and review rows itself rather than going through
 * the cards and reviews services: each of those writes one card's state from
 * one answer, and an import has to land a whole history and the state it
 * produces in a single transaction. Decks and stats still go through their
 * owners.
 */
@Module({
  imports: [DecksModule, StatsModule, LibraryModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
