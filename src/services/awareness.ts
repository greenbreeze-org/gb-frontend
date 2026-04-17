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

interface AwarenessSeriesResponse {
  scope: 'vic' | 'VIC'
  series: Array<{ time: string; demandMw?: number; emissionIntensity?: number; isPeak?: boolean }>
}

const fallbackDemandRaw = [
  { time: '03:00', value: 5439.56 },
  { time: '04:00', value: 5371.69 },
  { time: '05:00', value: 5402.95 },
  { time: '06:00', value: 5423.87 },
  { time: '07:00', value: 4848.8 },
  { time: '08:00', value: 4427.2 },
  { time: '09:00', value: 4707.6 },
  { time: '10:00', value: 5250.51 },
  { time: '11:00', value: 5660.83 },
  { time: '12:00', value: 5958.35 },
]

const fallbackEmissionsRaw = [
  { time: '03:00', value: 891.54 },
  { time: '04:00', value: 903.56 },
  { time: '05:00', value: 900.02 },
  { time: '06:00', value: 909.48 },
  { time: '07:00', value: 965.48 },
  { time: '08:00', value: 801.73 },
  { time: '09:00', value: 664.74 },
  { time: '10:00', value: 566.45 },
  { time: '11:00', value: 500.66 },
  { time: '12:00', value: 461.13 },
]

const addPeakFlags = <T extends { value: number }>(series: T[]) => {
  const sorted = [...series].sort((a, b) => b.value - a.value)
  const thresholdIndex = Math.max(Math.floor(series.length * 0.2) - 1, 0)
  const threshold = sorted[thresholdIndex]?.value ?? sorted[0]?.value ?? 0

  return series.map((point) => ({ ...point, isPeak: point.value >= threshold }))
}

export const fetchEnergyDemandSeries = async (): Promise<DemandPoint[]> => {
  try {
    const response = await apiGet<AwarenessSeriesResponse>('/awareness/energy-demand')

    return response.series.map((point) => ({
      time: point.time,
      value: point.demandMw ?? 0,
      isPeak: Boolean(point.isPeak),
    }))
  } catch {
    // Dataset fallback for fast frontend development.
    return addPeakFlags(fallbackDemandRaw)
  }
}

export const fetchEmissionsSeries = async (): Promise<EmissionPoint[]> => {
  try {
    const response = await apiGet<AwarenessSeriesResponse>('/awareness/emissions')

    return response.series.map((point) => ({
      time: point.time,
      value: point.emissionIntensity ?? 0,
      isPeak: Boolean(point.isPeak),
    }))
  } catch {
    // Dataset fallback for fast frontend development.
    return addPeakFlags(fallbackEmissionsRaw)
  }
}
