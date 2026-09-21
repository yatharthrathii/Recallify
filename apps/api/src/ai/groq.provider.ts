import { Logger } from '@nestjs/common';
import {
  type AiProvider,
  AiRejectedError,
  AiUnavailableError,
  type Completion,
  type CompletionRequest,
} from './provider';

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

/** Measured generations take one to two seconds. Thirty is a hang, not a slow answer. */
const TIMEOUT_MS = 30_000;

export interface GroqOptions {
  readonly apiKey: string | undefined;
  /** Tried in order. */
  readonly models: readonly string[];
}

/**
 * The slice of `fetch` this file uses, written out rather than borrowed from
 * the global types. Node's `Response` type comes from `undici-types` through
 * @types/node, and a build that resolves types differently (Vercel's did) sees
 * an empty `Response` with no `ok` or `status`. Depending on a shape instead of
 * a global makes the file compile the same everywhere, and it is all a test
 * double has to provide.
 */
interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

interface HttpRequest {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
}

type Fetch = (url: string, init: HttpRequest) => Promise<HttpResponse>;

// The one place the global is touched. The cast is the point: see above.
const globalFetch: Fetch = (url, init) =>
  fetch(url, init) as unknown as Promise<HttpResponse>;

interface GroqResponse {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Groq over its OpenAI-compatible HTTP API, with a fallback chain.
 *
 * Plain fetch rather than an SDK: this is one POST, and an SDK would be a
 * dependency to keep current for the sake of a type definition.
 *
 * On the free tier every model has its own rate-limit bucket -- 1,000 requests
 * a day and 8,000 tokens a minute each, read off the response headers for this
 * account. So when the first model says 429, the second is usually still
 * available, and trying it roughly doubles capacity for nothing.
 *
 * Any failure moves to the next model, not just 429. That includes 404: the
 * model this project was originally planned around, llama-3.3-70b-versatile,
 * was withdrawn from Groq entirely, and a withdrawn model should degrade to
 * the fallback rather than take generation down with it.
 */
export class GroqProvider implements AiProvider {
  private readonly logger = new Logger(GroqProvider.name);

  constructor(
    private readonly options: GroqOptions,
    private readonly fetchFn: Fetch = globalFetch,
  ) {}

  get configured(): boolean {
    return Boolean(this.options.apiKey);
  }

  private body(model: string, request: CompletionRequest): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model,
      messages: request.messages,
      // JSON mode: the reply is guaranteed to parse as an object. What is in it
      // is still validated card by card -- valid JSON is not a valid card.
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_completion_tokens: request.maxOutputTokens,
    };

    // The gpt-oss models reason before answering, and reasoning tokens count
    // against the same 8,000-per-minute budget. "low" gave 10 valid cards out
    // of 10 in every measured run.
    if (model.startsWith('openai/gpt-oss')) body['reasoning_effort'] = 'low';

    return body;
  }

  async complete(request: CompletionRequest): Promise<Completion> {
    if (!this.options.apiKey) {
      throw new AiUnavailableError('AI generation is not configured on this server.');
    }

    let retryAfter: number | undefined;
    let transient = false;
    const failures: string[] = [];

    for (const model of this.options.models) {
      let response: HttpResponse;
      try {
        response = await this.fetchFn(ENDPOINT, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.options.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(this.body(model, request)),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        // Network failure or timeout. Worth trying the next model.
        transient = true;
        failures.push(`${model}: ${(error as Error).name}`);
        continue;
      }

      if (response.ok) {
        const data = (await response.json()) as GroqResponse;
        if (failures.length > 0) {
          this.logger.warn(`served by fallback ${model} after: ${failures.join('; ')}`);
        }
        return {
          text: data.choices?.[0]?.message?.content ?? '',
          model,
          promptTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        };
      }

      if (response.status === 429 || response.status >= 500) {
        transient = true;
        const header = Number(response.headers.get('retry-after'));
        if (Number.isFinite(header) && header > 0) {
          retryAfter = Math.max(retryAfter ?? 0, Math.ceil(header));
        }
      }
      failures.push(`${model}: HTTP ${response.status}`);
    }

    this.logger.error(`every model failed: ${failures.join('; ')}`);

    if (transient) {
      throw new AiUnavailableError(
        'AI generation is busy right now. Try again in a minute.',
        retryAfter,
      );
    }
    throw new AiRejectedError('The AI provider rejected the request.');
  }
}
