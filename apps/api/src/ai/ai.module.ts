import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { DecksModule } from '../decks/decks.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GroqProvider } from './groq.provider';
import { AI_PROVIDER } from './provider';

@Module({
  imports: [DecksModule],
  controllers: [AiController],
  providers: [
    AiService,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new GroqProvider({
          apiKey: config.get('GROQ_API_KEY', { infer: true }),
          models: config.get('GROQ_MODELS', { infer: true }),
        }),
    },
  ],
})
export class AiModule {}
