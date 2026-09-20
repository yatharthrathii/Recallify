import { Global, Module } from '@nestjs/common';
import { FsrsConfigService } from './fsrs-config.service';

/**
 * Global for the same reason PrismaModule is: decks, cards, reviews, stats and
 * the optimizer all need to know how this user is scheduled, and threading it
 * through five imports arrays adds noise without adding a boundary.
 */
@Global()
@Module({ providers: [FsrsConfigService], exports: [FsrsConfigService] })
export class SchedulingModule {}
