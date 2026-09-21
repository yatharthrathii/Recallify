import type { z } from 'zod';

/**
 * The smallest description of `fetch` this package needs.
 *
 * Declared here rather than taken from the DOM lib because core must compile
 * and run unchanged in the browser, in React Native and under Node. The global
 * fetch on all three satisfies it.
 */
export interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

export interface HttpInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  credentials?: 'include' | 'same-origin' | 'omit';
}

export type FetchLike = (url: string, init?: HttpInit) => Promise<HttpResponse>;

/** An RFC 9457 problem document, as the API sends it. */
export interface Problem {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly traceId?: string;
  /** Field-level messages, on validation failures. */
  readonly errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly traceId: string | undefined;
  readonly fieldErrors: Record<string, string[]>;

  constructor(problem: Problem) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
    this.status = problem.status;
    this.title = problem.title;
    this.traceId = problem.traceId;
    this.fieldErrors = problem.errors ?? {};
  }
}

/** The request never reached the server, or the reply was not JSON. */
export class NetworkError extends Error {
  constructor(message = 'Could not reach the server.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface TransportOptions {
  /** '/api/v1' on web, where Next proxies it. The full origin on mobile. */
  readonly baseUrl: string;
  readonly fetch?: FetchLike;
  /** Mobile: the bearer token. Web sends none; the cookie travels by itself. */
  readonly getAccessToken?: () => string | null | Promise<string | null>;
  /**
   * Called when a request comes back 401. Resolve true if a new session was
   * obtained and the request is worth retrying once.
   */
  readonly refresh?: () => Promise<boolean>;
  readonly credentials?: HttpInit['credentials'];
}

export interface RequestOptions<S extends z.ZodTypeAny | undefined> {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly query?: Record<string, string | number | boolean | undefined | null>;
  readonly body?: unknown;
  /** Response schema. Omit for 204s. */
  readonly schema?: S;
}

function toQuery(query: RequestOptions<undefined>['query']): string {
  if (!query) return '';
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return pairs.length ? `?${pairs.join('&')}` : '';
}

export class Transport {
  private refreshing: Promise<boolean> | null = null;

  constructor(private readonly options: TransportOptions) {}

  /**
   * One refresh at a time, however many requests hit a 401 together.
   *
   * Refresh tokens rotate, and presenting an already-rotated one revokes the
   * whole session family. Ten parallel requests each refreshing on their own
   * would do exactly that to a perfectly healthy session.
   */
  private refreshOnce(): Promise<boolean> {
    const refresh = this.options.refresh;
    if (!refresh) return Promise.resolve(false);
    this.refreshing ??= refresh()
      .catch(() => false)
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  private async send(path: string, options: RequestOptions<z.ZodTypeAny | undefined>) {
    const doFetch = this.options.fetch ?? (globalThis as { fetch?: FetchLike }).fetch;
    if (!doFetch) throw new NetworkError('No fetch implementation is available.');

    const headers: Record<string, string> = { accept: 'application/json' };
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    const token = await this.options.getAccessToken?.();
    if (token) headers['authorization'] = `Bearer ${token}`;

    const init: HttpInit = { method: options.method ?? 'GET', headers };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);
    if (this.options.credentials) init.credentials = this.options.credentials;

    try {
      return await doFetch(`${this.options.baseUrl}${path}${toQuery(options.query)}`, init);
    } catch {
      throw new NetworkError();
    }
  }

  async request<S extends z.ZodTypeAny | undefined = undefined>(
    path: string,
    options: RequestOptions<S> = {},
  ): Promise<S extends z.ZodTypeAny ? z.output<S> : void> {
    let response = await this.send(path, options);

    if (response.status === 401 && (await this.refreshOnce())) {
      response = await this.send(path, options);
    }

    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : undefined;
    } catch {
      throw new NetworkError('The server sent a reply that could not be read.');
    }

    if (!response.ok) {
      const problem = (payload ?? {}) as Partial<Problem>;
      throw new ApiError({
        status: response.status,
        title: problem.title ?? 'Request failed',
        ...(problem.detail !== undefined ? { detail: problem.detail } : {}),
        ...(problem.traceId !== undefined ? { traceId: problem.traceId } : {}),
        ...(problem.errors !== undefined ? { errors: problem.errors } : {}),
      });
    }

    // Parsed, not cast. The schema turns ISO strings into Dates and guarantees
    // the types the rest of the app relies on are true at runtime as well.
    type Out = S extends z.ZodTypeAny ? z.output<S> : void;
    if (!options.schema) return undefined as Out;
    return options.schema.parse(payload) as Out;
  }
}
