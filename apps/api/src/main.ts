import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(helmet());
  app.setGlobalPrefix('api/v1', { exclude: ['', 'health', 'ready', 'docs'] });

  // Locked to known origins. The web client normally reaches the API through
  // its own Next.js route handlers (same-origin BFF), so this is a fallback for
  // the mobile client and for local tooling.
  app.enableCors({
    origin: [process.env.WEB_URL ?? 'http://localhost:3000'],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Recallify API')
    .setDescription(
      'Spaced-repetition scheduling API. Card scheduling uses FSRS; the Review ' +
        'log is append-only and every scheduling result is derived from it.',
    )
    .setVersion('2.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config), {
    jsonDocumentUrl: 'docs-json',
  });

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`api listening on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();
