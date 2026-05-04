import { apiGet } from '@/services/http'

export interface DemandPoint {
  time: string
  value: number
  isPeak: boolean
}

export interface EmissionPoint {
  time: string
  value: number
  isPeak: boolean
}

export interface AwarenessRangeParams {
  from?: string
  to?: string
  granularity?: 'hour' | 'day' | 'month'
  tz?: string
}

interface AwarenessSeriesResponse {
  scope: 'vic' | 'VIC'
  series: Array<{ time: string; demandMw?: number; emissionIntensity?: number; isPeak?: boolean }>
}

export const fetchEnergyDemandSeries = async (params?: AwarenessRangeParams): Promise<DemandPoint[]> => {
  const query = params?.from && params?.to
    ? {
        from: params.from,
        to: params.to,
        ...(params.granularity ? { granularity: params.granularity } : {}),
        ...(params.tz ? { tz: params.tz } : {}),
      }
    : undefined
  const response = await apiGet<AwarenessSeriesResponse>('/awareness/energy-demand', query)

  return response.series.map((point) => ({
    time: point.time,
    value: point.demandMw ?? 0,
    isPeak: Boolean(point.isPeak),
  }))
}

export const fetchEmissionsSeries = async (params?: AwarenessRangeParams): Promise<EmissionPoint[]> => {
  const query = params?.from && params?.to
    ? {
        from: params.from,
        to: params.to,
        ...(params.granularity ? { granularity: params.granularity } : {}),
        ...(params.tz ? { tz: params.tz } : {}),
      }
    : undefined
  const response = await apiGet<AwarenessSeriesResponse>('/awareness/emissions', query)

  return response.series.map((point) => ({
    time: point.time,
    value: point.emissionIntensity ?? 0,
    isPeak: Boolean(point.isPeak),
  }))
}
