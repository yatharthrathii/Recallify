import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  API_ORIGIN,
  REFRESH_COOKIE,
  clearSession,
  isSameOrigin,
  problem,
  setSession,
  type IssuedTokens,
} from '@/lib/session';

/**
 * Sign in, register, refresh, sign out.
 *
 * The browser never sees a token. This handler calls the API, moves the tokens
 * into httpOnly cookies, and answers the page with nothing but success.
 */

/**
 * The API sees this server, not the visitor. Their address and browser are
 * passed along so rate limits count people rather than the web app, and the
 * session list shows the browser that signed in rather than Node.
 */
function forwarded(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '';
  if (ip) headers['x-client-ip'] = ip;
  const agent = request.headers.get('user-agent');
  if (agent) headers['user-agent'] = agent;
  return headers;
}

async function callApi(
  action: string,
  body: unknown,
  extra: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${API_ORIGIN}/api/v1/auth/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extra },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
  });
}

async function passThroughError(upstream: Response): Promise<Response> {
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'content-type': 'application/problem+json' },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
): Promise<Response> {
  if (!isSameOrigin(request))
    return problem(403, 'Forbidden', 'Cross-site request refused.');

  const { action } = await context.params;
  const jar = await cookies();

  try {
    if (action === 'login' || action === 'register' || action === 'demo') {
      const body: unknown = await request.json().catch(() => ({}));
      const upstream = await callApi(action, body, forwarded(request));
      if (!upstream.ok) return passThroughError(upstream);

      const response = NextResponse.json({ ok: true }, { status: upstream.status });
      setSession(response, (await upstream.json()) as IssuedTokens);
      return response;
    }

    // Neither of these starts a session. The API's answer is passed back as
    // it is, status and all.
    if (action === 'forgot-password' || action === 'reset-password') {
      const body: unknown = await request.json().catch(() => ({}));
      const upstream = await callApi(action, body, forwarded(request));
      if (!upstream.ok) return passThroughError(upstream);
      return new NextResponse(null, { status: 204 });
    }

    if (action === 'refresh') {
      const refreshToken = jar.get(REFRESH_COOKIE)?.value;
      if (!refreshToken) {
        const response = NextResponse.json(
          { title: 'Unauthorized', status: 401, detail: 'No session.' },
          { status: 401 },
        );
        clearSession(response);
        return response;
      }

      const upstream = await callApi('refresh', { refreshToken }, forwarded(request));
      if (!upstream.ok) {
        // Expired, revoked, or replayed. Whichever it was, this session is over.
        const response = new NextResponse(await upstream.text(), {
          status: 401,
          headers: { 'content-type': 'application/problem+json' },
        });
        clearSession(response);
        return response;
      }

      const response = NextResponse.json({ ok: true });
      setSession(response, (await upstream.json()) as IssuedTokens);
      return response;
    }

    if (action === 'logout') {
      const refreshToken = jar.get(REFRESH_COOKIE)?.value;
      // Best effort: the cookies are cleared whether or not the API answers.
      if (refreshToken) await callApi('logout', { refreshToken }).catch(() => undefined);
      const response = new NextResponse(null, { status: 204 });
      clearSession(response);
      return response;
    }

    return problem(404, 'Not found', 'No such auth action.');
  } catch {
    return problem(502, 'Bad gateway', 'The API could not be reached.');
  }
}
