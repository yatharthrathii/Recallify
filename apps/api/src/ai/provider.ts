/**
 * The seam between the AI module and whoever serves the model.
 *
 * One implementation today (Groq). The interface exists for the tests, which
 * swap in a scripted provider instead of spending real quota, and so that a
 * second vendor is a new class rather than an edit to AiService.
 */

export interface ChatMessage {
  readonly role: 'system' | 'user';
  readonly content: string;
}

export interface CompletionRequest {
  readonly messages: readonly ChatMessage[];
  readonly maxOutputTokens: number;
}

export interface Completion {
  readonly text: string;
  /** Which model actually answered -- with a fallback chain it is not always the first. */
  readonly model: string;
  readonly promptTokens: number;
  readonly outputTokens: number;
}

export interface AiProvider {
  /** False when the server has no key. The API still runs; only generation is off. */
  readonly configured: boolean;
  complete(request: CompletionRequest): Promise<Completion>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');

/**
 * Every model is rate-limited, down, or timing out. Retrying later can work,
 * so the client is told when.
 */
export class AiUnavailableError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

/** The provider refused the request itself. Retrying the same thing will not help. */
export class AiRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiRejectedError';
  }
}
