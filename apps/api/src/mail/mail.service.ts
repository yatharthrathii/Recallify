import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** Thrown when a message could not be handed to the provider. */
export class MailUnavailableError extends Error {
  constructor(message = 'Email could not be sent.') {
    super(message);
    this.name = 'MailUnavailableError';
  }
}

/**
 * The slice of `fetch` this file uses, written out rather than borrowed from
 * the global types, for the reason given in ai/groq.provider.ts: the global
 * `Response` type resolves differently across builds.
 */
interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

interface HttpRequest {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
}

type Fetch = (url: string, init: HttpRequest) => Promise<HttpResponse>;

const globalFetch: Fetch = (url, init) =>
  fetch(url, init) as unknown as Promise<HttpResponse>;

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10_000;

/**
 * Transactional email through Brevo's HTTP API.
 *
 * Plain fetch, one POST, no SDK. Three behaviours by environment:
 *
 *   test         nothing leaves the process; messages land in `outbox` so a
 *                test can read the link out of one.
 *   development  without a key, the message is written to the log, link and
 *                all, so the flow can be exercised with no account anywhere.
 *   production   without a key, sending throws and the caller answers 503.
 *                Pretending to send would leave the person waiting for an
 *                email that is never coming.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private readonly apiKey: string | undefined;
  private readonly from: string | undefined;
  private readonly fromName: string;
  private readonly env: Env['NODE_ENV'];
  /**
   * Under vitest the .env loaded for the run can still say "development",
   * so the runner's own flag is the reliable sign that no email may leave.
   */
  private readonly testing: boolean;

  /** Test only: every message that would have been sent. */
  readonly outbox: MailMessage[] = [];

  /** Replaceable so a test can script the provider without a network. */
  fetchFn: Fetch = globalFetch;

  constructor(config: ConfigService<Env, true>) {
    this.apiKey = config.get('BREVO_API_KEY', { infer: true });
    this.from = config.get('MAIL_FROM', { infer: true });
    this.fromName = config.get('MAIL_FROM_NAME', { infer: true });
    this.env = config.get('NODE_ENV', { infer: true });
    this.testing = this.env === 'test' || process.env['VITEST'] === 'true';
  }

  /**
   * Whether a request that needs an email can be accepted. Only production
   * insists on a provider; development logs and test captures.
   */
  get configured(): boolean {
    if (this.testing || this.env !== 'production') return true;
    return Boolean(this.apiKey) && Boolean(this.from);
  }

  async send(message: MailMessage): Promise<void> {
    if (this.testing) {
      this.outbox.push(message);
      return;
    }

    if (!this.apiKey || !this.from) {
      if (this.env === 'production') throw new MailUnavailableError('Email is not configured.');
      this.log.warn(
        `BREVO_API_KEY or MAIL_FROM is not set, so this message was not sent.\n` +
          `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`,
      );
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await this.fetchFn(BREVO_URL, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { email: this.from, name: this.fromName },
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
          htmlContent: message.html,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        // The body names the problem (an unverified sender, an expired key)
        // and never contains the message, so it is safe to log.
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        this.log.error(`Brevo answered ${response.status}: ${detail}`);
        throw new MailUnavailableError();
      }
    } catch (error) {
      if (error instanceof MailUnavailableError) throw error;
      this.log.error(`Brevo request failed: ${error instanceof Error ? error.message : error}`);
      throw new MailUnavailableError();
    } finally {
      clearTimeout(timer);
    }
  }
}
