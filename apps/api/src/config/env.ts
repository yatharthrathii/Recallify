import { z } from 'zod';

/**
 * Environment, validated at boot.
 *
 * A missing secret should stop the process on startup with a message naming
 * the variable -- not surface three hours later as a 500 nobody can trace.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Rejecting a short secret here is the point: a 12-character JWT secret is
  // brute-forceable and nothing else in the system would ever complain.
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // Optional so the app, CI and the tests all boot without one. Without a key
  // /ai/generate answers 503 and everything else works.
  GROQ_API_KEY: z.string().optional(),
  // Tried in order. Each model has its own rate-limit bucket on Groq, so a
  // fallback roughly doubles free capacity. Chosen by measurement against real
  // output -- see docs/06-ROADMAP.md, phase 5. The previous default,
  // llama-3.3-70b-versatile, no longer exists on Groq at all.
  GROQ_MODELS: z
    .string()
    .default('openai/gpt-oss-120b,openai/gpt-oss-20b')
    .transform((v) =>
      v
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string()).min(1)),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${problems}`);
  }
  return parsed.data;
}
