import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildOpenApiDocument, configureApp } from './bootstrap';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  configureApp(app);

  SwaggerModule.setup('docs', app, buildOpenApiDocument(app), {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: true },
  });

  // A host that assigns the port (Vercel, most PaaS) says so through PORT.
  // API_PORT is the local default.
  const port =
    Number(process.env.PORT) ||
    app.get(ConfigService<Env, true>).get('API_PORT', { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`api listening on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();
