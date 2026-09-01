import pinoHttp from 'pino-http';
import type { HttpLogger, Options } from 'pino-http';

/**
 * Structured request logging.
 *
 * JSON in production because machines read it; pretty in development because
 * a person does. Every line carries the request id, so a user quoting the one
 * from an error page leads straight to the request that produced it.
 */
export function buildLogger(level: string, pretty: boolean): HttpLogger {
  const options: Options = {
    level,
    genReqId: (req) => String(req.headers['x-request-id'] ?? ''),
    // Health checks run every few minutes forever; logging them buries
    // everything that matters.
    autoLogging: {
      ignore: (req) => req.url === '/health' || req.url === '/ready',
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    // Never log an Authorization header or a cookie. This is the line that
    // stops a token ending up in a log aggregator.
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      remove: true,
    },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  };

  if (pretty) {
    options.transport = {
      target: 'pino-pretty',
      options: { colorize: true, singleLine: true, ignore: 'pid,hostname' },
    };
  }

  return pinoHttp(options);
}
