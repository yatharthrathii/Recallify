import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Give every request an id, and hand it back on the response.
 *
 * An id supplied by the caller is kept, so a trace started in the web client
 * or a load balancer stays one trace rather than becoming two unrelated ones.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();

    req.headers['x-request-id'] = id;
    res.setHeader('x-request-id', id);
    next();
  }
}
