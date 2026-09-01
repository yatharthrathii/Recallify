import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Service index.
   *
   * This process serves the API, not the website. Anyone who opens the API
   * origin in a browser expecting the app would otherwise get a bare 404.
   */
  @Public()
  @Get()
  @ApiExcludeEndpoint()
  index(): Record<string, string> {
    return {
      service: 'recallify-api',
      version: '2.0',
      docs: '/docs',
      health: '/health',
      note: 'This is the API. The web client runs separately on port 3000.',
    };
  }

  /**
   * Liveness: is the process up.
   *
   * Deliberately does NOT touch the database. This is the uptime-ping target,
   * and a probe that wakes Neon every ten minutes forever would burn the free
   * tier's compute hours on nothing.
   */
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe' })
  health(): { status: string; uptime: number } {
    return { status: 'ok', uptime: Math.floor(process.uptime()) };
  }

  /**
   * Readiness: can this instance actually serve traffic.
   *
   * Answers 503 when the database is unreachable, so a deploy that cannot
   * reach Neon is caught by the platform rather than by the first user.
   */
  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ status: 200, description: 'Ready' })
  @ApiResponse({ status: 503, description: 'Database unreachable' })
  async ready(
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ status: string; checks: Record<string, string> }> {
    const database = await this.prisma.ping();
    if (!database) res.status(HttpStatus.SERVICE_UNAVAILABLE);

    return {
      status: database ? 'ok' : 'degraded',
      checks: { database: database ? 'up' : 'down' },
    };
  }
}
