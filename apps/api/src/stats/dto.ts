import {
  curveQuery,
  forecast,
  forecastQuery,
  forgettingCurve,
  heatmapQuery,
  heatmapResponse,
  statsOverview,
  workloadPreview,
} from '@recallify/contracts';
import { createZodDto } from 'nestjs-zod';

export class StatsOverviewDto extends createZodDto(statsOverview) {}
export class HeatmapQueryDto extends createZodDto(heatmapQuery) {}
export class HeatmapDto extends createZodDto(heatmapResponse) {}
export class ForecastQueryDto extends createZodDto(forecastQuery) {}
export class ForecastDto extends createZodDto(forecast) {}
export class CurveQueryDto extends createZodDto(curveQuery) {}
export class ForgettingCurveDto extends createZodDto(forgettingCurve) {}
export class WorkloadPreviewDto extends createZodDto(workloadPreview) {}
