import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';
import { buildLogger } from './common/logger';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<Env, true>);

  const isProd = config.get('NODE_ENV', { infer: true }) === 'production';

  app.use(helmet());
  // Refresh tokens travel as an httpOnly cookie on web, so the server has to
  // be able to read one back.
  app.use(cookieParser());
  app.use(buildLogger(config.get('LOG_LEVEL', { infer: true }), !isProd));

  app.setGlobalPrefix('api/v1', { exclude: ['', 'health', 'ready', 'docs'] });

  // The web client normally reaches the API through its own Next.js route
  // handlers (same-origin BFF), so this is for the mobile client and local
  // tooling. Credentials are allowed because the refresh cookie needs them.
  app.enableCors({
    origin: [config.get('WEB_URL', { infer: true })],
    credentials: true,
  });

  const openapi = new DocumentBuilder()
    .setTitle('Recallify API')
    .setDescription(
      'Spaced-repetition scheduling API. Card scheduling uses FSRS; the Review ' +
        'log is append-only and every scheduling result is derived from it.',
    )
    .setVersion('2.0')
    .addBearerAuth()
    .build();

  // cleanupOpenApiDoc resolves the schemas createZodDto emits into proper
  // OpenAPI components. Without it every request body documents itself as an
  // empty object and the published docs stop being worth reading.
  //
  // (nestjs-zod v4 did this by monkey-patching Swagger internals; v11 of
  // @nestjs/swagger stopped exporting the path it reached into, so v5 replaced
  // the patch with this pass over the finished document.)
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, openapi));

  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get('API_PORT', { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`api listening on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();
