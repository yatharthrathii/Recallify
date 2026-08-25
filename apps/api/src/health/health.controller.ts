import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class HealthController {
  /**
   * Service index.
   *
   * This process serves the API, not the website. Anyone who opens the API
   * origin in a browser expecting the app would otherwise get a bare 404, so
   * point them somewhere useful instead.
   */
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
   * Liveness. Also the uptime-ping target: Neon's free tier scales to zero
   * after ~5 minutes idle, so an external ping every 10 minutes keeps the first
   * real request fast. See docs/02-ARCHITECTURE.md.
   */
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe' })
  health(): { status: string; uptime: number } {
    return { status: 'ok', uptime: Math.floor(process.uptime()) };
  }

  /** Readiness. Phase 4 adds a real database round-trip here. */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  ready(): { status: string; checks: Record<string, string> } {
    return { status: 'ok', checks: { database: 'not-wired-yet' } };
  }
}
