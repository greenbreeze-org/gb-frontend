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
}

interface AwarenessSeriesResponse {
  scope: 'vic' | 'VIC'
  series: Array<{ time: string; demandMw?: number; emissionIntensity?: number; isPeak?: boolean }>
}

const fallbackDemandRaw = [
  { time: '2025-04-12T03:00:00+10:00', value: 5439.56 },
  { time: '2025-04-12T04:00:00+10:00', value: 5371.69 },
  { time: '2025-04-12T05:00:00+10:00', value: 5402.95 },
  { time: '2025-04-12T06:00:00+10:00', value: 5423.87 },
  { time: '2025-04-12T07:00:00+10:00', value: 4848.8 },
  { time: '2025-04-12T08:00:00+10:00', value: 4427.2 },
  { time: '2025-04-12T09:00:00+10:00', value: 4707.6 },
  { time: '2025-04-12T10:00:00+10:00', value: 5250.51 },
  { time: '2025-04-12T11:00:00+10:00', value: 5660.83 },
  { time: '2025-04-12T12:00:00+10:00', value: 5958.35 },
]

const fallbackEmissionsRaw = [
  { time: '2025-04-12T03:00:00+10:00', value: 891.54 },
  { time: '2025-04-12T04:00:00+10:00', value: 903.56 },
  { time: '2025-04-12T05:00:00+10:00', value: 900.02 },
  { time: '2025-04-12T06:00:00+10:00', value: 909.48 },
  { time: '2025-04-12T07:00:00+10:00', value: 965.48 },
  { time: '2025-04-12T08:00:00+10:00', value: 801.73 },
  { time: '2025-04-12T09:00:00+10:00', value: 664.74 },
  { time: '2025-04-12T10:00:00+10:00', value: 566.45 },
  { time: '2025-04-12T11:00:00+10:00', value: 500.66 },
  { time: '2025-04-12T12:00:00+10:00', value: 461.13 },
]

const addPeakFlags = <T extends { value: number }>(series: T[]) => {
  if (!series.length) return []
  const sorted = [...series].sort((a, b) => b.value - a.value)
  const thresholdIndex = Math.max(Math.floor(series.length * 0.2) - 1, 0)
  const threshold = sorted[thresholdIndex]?.value ?? sorted[0]?.value ?? 0
  return series.map((point) => ({ ...point, isPeak: point.value >= threshold }))
}

const filterFallbackByRange = <T extends { time: string; value: number }>(
  series: T[],
  params?: AwarenessRangeParams,
) => {
  if (!params?.from || !params?.to) return series
  const fromMs = new Date(params.from).getTime()
  const toMs = new Date(params.to).getTime()
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return series
  return series.filter((point) => {
    const ms = new Date(point.time).getTime()
    return !Number.isNaN(ms) && ms >= fromMs && ms <= toMs
  })
}

export const fetchEnergyDemandSeries = async (params?: AwarenessRangeParams): Promise<DemandPoint[]> => {
  try {
    const query = params?.from && params?.to ? { from: params.from, to: params.to } : undefined
    const response = await apiGet<AwarenessSeriesResponse>('/awareness/energy-demand', query)

    return response.series.map((point) => ({
      time: point.time,
      value: point.demandMw ?? 0,
      isPeak: Boolean(point.isPeak),
    }))
  } catch {
    const fallback = addPeakFlags(filterFallbackByRange(fallbackDemandRaw, params))
    return fallback.map((point) => ({
      time: point.time,
      value: point.value,
      isPeak: point.isPeak,
    }))
  }
}

export const fetchEmissionsSeries = async (params?: AwarenessRangeParams): Promise<EmissionPoint[]> => {
  try {
    const query = params?.from && params?.to ? { from: params.from, to: params.to } : undefined
    const response = await apiGet<AwarenessSeriesResponse>('/awareness/emissions', query)

    return response.series.map((point) => ({
      time: point.time,
      value: point.emissionIntensity ?? 0,
      isPeak: Boolean(point.isPeak),
    }))
  } catch {
    const fallback = addPeakFlags(filterFallbackByRange(fallbackEmissionsRaw, params))
    return fallback.map((point) => ({
      time: point.time,
      value: point.value,
      isPeak: point.isPeak,
    }))
  }
}