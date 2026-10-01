import { Module } from '@nestjs/common';
import { DecksModule } from '../decks/decks.module';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';

/**
 * Publishing, subscribing, and keeping a copy in step with its source.
 *
 * Copies are made and updated by writing card and deck rows directly, as the
 * import does: a subscription is a whole deck landing at once, and a sync
 * touches many cards' text in one transaction. What it hands back to a
 * caller is still read through DecksService, so a deck looks the same from
 * every endpoint. The changelog is this module's own table; cards report
 * into it through `recordCardChange`, which costs nothing for a deck that is
 * not published.
 */
@Module({
  imports: [DecksModule],
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],
})
export class LibraryModule {}
