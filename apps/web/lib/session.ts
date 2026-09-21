import type { NextResponse } from 'next/server';

/**
 * Server-only. The session as three httpOnly cookies on this origin.
 *
 *   rc_at       the access token. Short-lived; the proxy turns it into a bearer.
 *   rc_rt       the refresh token. Only ever sent to /api/auth, never to pages
 *               or to the proxy, so it travels as little as it can.
 *   rc_session  carries nothing. It tells proxy.ts a session may exist, so the
 *               sign-in redirect does not need the refresh token on every page
 *               request just to make that decision.
 *
 * None of them is readable from JavaScript, which is the point: an XSS can act
 * as the user while the tab is open, but cannot walk away with the credential.
 * v1 kept its token in localStorage.
 */

export const ACCESS_COOKIE = 'rc_at';
export const REFRESH_COOKIE = 'rc_rt';
export const SESSION_COOKIE = 'rc_session';

const THIRTY_DAYS = 30 * 24 * 60 * 60;

export const API_ORIGIN = process.env.API_URL ?? 'http://localhost:3001';

const base = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

export interface IssuedTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
}

export function setSession(response: NextResponse, tokens: IssuedTokens): void {
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    path: '/',
    maxAge: tokens.expiresIn,
  });
  if (tokens.refreshToken) {
    response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
      ...base,
      path: '/api/auth',
      maxAge: THIRTY_DAYS,
    });
  }
  response.cookies.set(SESSION_COOKIE, '1', { ...base, path: '/', maxAge: THIRTY_DAYS });
}

export function clearSession(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, '', { ...base, path: '/', maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, '', { ...base, path: '/api/auth', maxAge: 0 });
  response.cookies.set(SESSION_COOKIE, '', { ...base, path: '/', maxAge: 0 });
}

/**
 * Cross-site request check for anything that changes state.
 *
 * SameSite=Lax already keeps these cookies off cross-site POSTs. This is the
 * second lock on the same door: a state-changing request whose Origin is not
 * this site is refused before it goes anywhere.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // same-origin GETs and non-browser clients send none
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function problem(status: number, title: string, detail: string): Response {
  return Response.json(
    { type: 'about:blank', title, status, detail, traceId: 'web' },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );
}
