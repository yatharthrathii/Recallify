import { ApiError, NetworkError, type Problem } from '@recallify/core';

/**
 * Calls to this app's own auth routes (app/api/auth). They exist because the
 * tokens must never reach JavaScript: the route handler talks to the API,
 * keeps the tokens in httpOnly cookies, and tells the page only "ok".
 */

async function post(action: string, body?: unknown): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${action}`, {
      method: 'POST',
      headers: body ? { 'content-type': 'application/json' } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new NetworkError();
  }
  if (response.ok) return;

  const problem = (await response.json().catch(() => ({}))) as Partial<Problem>;
  throw new ApiError({
    status: response.status,
    title: problem.title ?? 'Request failed',
    ...(problem.detail !== undefined ? { detail: problem.detail } : {}),
    ...(problem.traceId !== undefined ? { traceId: problem.traceId } : {}),
    ...(problem.errors !== undefined ? { errors: problem.errors } : {}),
  });
}

export const login = (body: { email: string; password: string }) => post('login', body);
export const register = (body: {
  email: string;
  password: string;
  displayName?: string;
}) => post('register', body);
export const logout = () => post('logout');
export const forgotPassword = (body: { email: string }) => post('forgot-password', body);
export const resetPassword = (body: { token: string; password: string }) =>
  post('reset-password', body);

/**
 * Exchange the refresh cookie for a new session.
 *
 * Refresh tokens rotate, and replaying a rotated one signs the whole family
 * out. Within a tab the API client already refreshes once; the Web Lock makes
 * that true across tabs too, so two tabs waking up together queue instead of
 * racing. Whoever goes second simply rotates the cookie the first one set.
 */
export async function refreshSession(): Promise<boolean> {
  const run = async (): Promise<boolean> => {
    try {
      return (await fetch('/api/auth/refresh', { method: 'POST' })).ok;
    } catch {
      return false;
    }
  };

  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    return navigator.locks.request('recallify-refresh', run);
  }
  return run();
}
