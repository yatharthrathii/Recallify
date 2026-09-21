import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route gate. Pages inside the app need a session; the auth pages do not want
 * one. This only checks that a session cookie exists: whether it is still good
 * is the API's decision, made on the first real request.
 */

const APP_PREFIXES = ['/today', '/decks', '/review', '/stats', '/settings'];
const AUTH_PAGES = ['/login', '/register'];

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has('rc_session');

  const inApp = APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (inApp && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (AUTH_PAGES.includes(pathname) && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/today';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/today/:path*',
    '/decks/:path*',
    '/review/:path*',
    '/stats/:path*',
    '/settings/:path*',
    '/login',
    '/register',
  ],
};
