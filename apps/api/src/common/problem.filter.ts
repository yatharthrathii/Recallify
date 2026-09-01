import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

/**
 * Every error leaves this API in the same shape: RFC 9457 problem+json,
 * always carrying the request id.
 *
 * The id is the point. Without it a bug report is "it broke sometimes" and
 * nothing in the logs can be found. With it, the user reads one string off the
 * screen and the exact request is one grep away.
 */

interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  traceId: string;
  /** Field-level messages, present only for validation failures. */
  errors?: Record<string, string[]>;
}

/** Prisma's error codes, translated into something a client can act on. */
function fromPrisma(
  error: Prisma.PrismaClientKnownRequestError,
): { status: number; title: string; detail: string } | null {
  switch (error.code) {
    case 'P2002': {
      const target = (error.meta?.['target'] as string[] | undefined)?.join(', ');
      return {
        status: HttpStatus.CONFLICT,
        title: 'Already exists',
        detail: target ? `Something else already uses that ${target}.` : 'Already exists.',
      };
    }
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        title: 'Not found',
        detail: 'That record does not exist, or is not yours.',
      };
    case 'P2003':
      return {
        status: HttpStatus.BAD_REQUEST,
        title: 'Invalid reference',
        detail: 'That points at something which does not exist.',
      };
    default:
      return null;
  }
}

function flattenZod(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const traceId = String(request.headers['x-request-id'] ?? 'unknown');
    const problem = this.toProblem(exception, request.url, traceId);

    // 5xx means we broke something and the stack is worth keeping. 4xx is the
    // client being told no, which is routine and not worth a log line each.
    if (problem.status >= 500) {
      this.logger.error(
        { traceId, err: exception, path: request.url },
        problem.detail ?? problem.title,
      );
    }

    response.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(exception: unknown, instance: string, traceId: string): Problem {
    const base = { type: 'about:blank', instance, traceId };

    // nestjs-zod wraps the ZodError; a schema parsed by hand throws it bare.
    // v5 types getZodError() as unknown, so this narrows rather than casts --
    // a cast would turn a library change into a 500 at runtime.
    const zodError =
      exception instanceof ZodValidationException
        ? exception.getZodError()
        : exception;

    if (zodError instanceof ZodError) {
      return {
        ...base,
        status: HttpStatus.BAD_REQUEST,
        title: 'Invalid request',
        detail: 'Some fields are missing or malformed.',
        errors: flattenZod(zodError),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = fromPrisma(exception);
      if (mapped) return { ...base, ...mapped };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const detail =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message);

      return {
        ...base,
        status,
        title: exception.name.replace(/Exception$/, '').replace(/([a-z])([A-Z])/g, '$1 $2'),
        detail: Array.isArray(detail) ? detail.join('; ') : detail,
      };
    }

    // Anything unrecognised is our fault, and the client is told nothing about
    // it beyond the trace id. Internal messages leak schema and stack shape.
    return {
      ...base,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      title: 'Something went wrong',
      detail: 'The error was logged. Quote the trace id if you report it.',
    };
  }
}
