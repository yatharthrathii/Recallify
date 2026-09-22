import 'reflect-metadata';
import { createServer } from 'node:http';
import type { Env } from './config/env';

// A host that assigns the port (Vercel, most PaaS) says so through PORT.
// API_PORT is the local default.
const hostPort = Number(process.env.PORT) || undefined;

async function bootstrap(): Promise<void> {
  // Loaded here rather than at the top of the file, so that a module that is
  // missing from a deployment bundle fails inside this function, where the
  // failure is caught and reported, instead of killing the process first.
  const { ConfigService } = await import('@nestjs/config');
  const { NestFactory } = await import('@nestjs/core');
  const { SwaggerModule } = await import('@nestjs/swagger');
  const { AppModule } = await import('./app.module');
  const { buildOpenApiDocument, configureApp } = await import('./bootstrap');

  // abortOnError off: by default Nest ends the process itself on a startup
  // error, and the handler below would never get to report it.
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    abortOnError: false,
  });

  configureApp(app);

  SwaggerModule.setup('docs', app, buildOpenApiDocument(app), {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: true },
  });

  const port =
    hostPort ??
    app.get(ConfigService<Env, true>).get('API_PORT', { infer: true }) ??
    3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`api listening on http://localhost:${port} (docs at /docs)`);
}

/**
 * Strip anything that could identify infrastructure from an error message:
 * connection strings, and hostnames of the database provider.
 */
function redact(message: string): string {
  return message
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>')
    .replace(/[\w.-]+\.(neon\.tech|amazonaws\.com)\S*/gi, '<host>')
    .slice(0, 600);
}

bootstrap().catch((error: unknown) => {
  console.error('api failed to start', error);

  // A serverless host shows a bare "function failed" page when the process
  // dies, and the reason is only in a dashboard. Answering every request with
  // the reason, stripped of anything sensitive, makes a broken deploy
  // diagnosable from the outside. It only ever runs when the app could not
  // start, so a healthy deployment never serves it.
  const reason =
    error instanceof Error ? `${error.name}: ${redact(error.message)}` : 'unknown error';
  createServer((_req, res) => {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`The API could not start.\n\n${reason}\n`);
  }).listen(hostPort ?? 3001);
});
