import { cookies } from 'next/headers';
import { ACCESS_COOKIE, API_ORIGIN, isSameOrigin, problem } from '@/lib/session';

/**
 * The proxy half of the BFF.
 *
 * The page calls /api/v1/... on this origin. This handler reads the httpOnly
 * access cookie, which the page cannot, and forwards the request to the API
 * with a bearer header. Same origin, so no CORS and no token in JavaScript.
 *
 * It does not refresh. A 401 goes back to the client, which refreshes once
 * (single-flight, across tabs) and retries. Refreshing here would let parallel
 * requests rotate the same refresh token at the same time, and the API reads a
 * replayed token as theft and signs the whole family out.
 */

const FORWARDED = ['content-type', 'accept'];

/** Token-bearing endpoints are reachable only through /api/auth. */
function isBlocked(path: string[]): boolean {
  return path[0] === 'auth' && path[1] !== 'me';
}

async function forward(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  if (isBlocked(path))
    return problem(404, 'Not found', 'Not available through the proxy.');

  const mutating = request.method !== 'GET' && request.method !== 'HEAD';
  if (mutating && !isSameOrigin(request)) {
    return problem(403, 'Forbidden', 'Cross-site request refused.');
  }

  const headers = new Headers();
  for (const name of FORWARDED) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (token) headers.set('authorization', `Bearer ${token}`);

  const search = new URL(request.url).search;
  const target = `${API_ORIGIN}/api/v1/${path.map(encodeURIComponent).join('/')}${search}`;

  let upstream: Response;
  try {
    const body = mutating ? await request.text() : undefined;
    upstream = await fetch(target, {
      method: request.method,
      headers,
      ...(body !== undefined ? { body } : {}),
      cache: 'no-store',
    });
  } catch {
    return problem(502, 'Bad gateway', 'The API could not be reached.');
  }

  const out = new Headers();
  const type = upstream.headers.get('content-type');
  if (type) out.set('content-type', type);
  const trace = upstream.headers.get('x-request-id');
  if (trace) out.set('x-request-id', trace);
  // Every response here is per-user. Nothing in between may keep a copy.
  out.set('cache-control', 'no-store');

  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: out,
  });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
