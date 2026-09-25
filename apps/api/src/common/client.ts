import type { Request } from 'express';

/**
 * Who is on the other end, as far as rate limits are concerned.
 *
 * Browsers never talk to the API directly: the web app's route handlers do,
 * from Vercel's servers. So the web app forwards the visitor's address in
 * `x-client-ip`, and that is read first. A direct caller can set the header to
 * anything, which is why the address is only ever a second limit beside a
 * per-account one, never the only thing standing between a guesser and a
 * password.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers['x-client-ip'] ?? req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return (first || req.ip || 'unknown').slice(0, 64);
}

export function userAgent(req: Request): string | undefined {
  return req.headers['user-agent']?.slice(0, 500);
}
