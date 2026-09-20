import { Module } from '@nestjs/common';
import { DecksModule } from '../decks/decks.module';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';

@Module({
  imports: [DecksModule],
  controllers: [CardsController],
  providers: [CardsService],
})
export class CardsModule {}
