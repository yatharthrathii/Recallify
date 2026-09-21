import { createApiClient } from '@recallify/core';
import { refreshSession } from './auth';

/**
 * Same origin, no token in sight. Requests go to this app's /api/v1 proxy,
 * which reads the httpOnly access cookie and attaches the bearer on the server.
 */
export const api = createApiClient({
  baseUrl: '/api/v1',
  credentials: 'same-origin',
  refresh: refreshSession,
});
