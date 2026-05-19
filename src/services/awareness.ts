const AWARENESS_API_BASE_URL =
  (import.meta.env.VITE_AWARENESS_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'https://lj5zonry26.execute-api.ap-southeast-2.amazonaws.com/api/v1'

const AWARENESS_API_KEY = import.meta.env.VITE_AWARENESS_API_KEY as string | undefined

type QueryValue = string | number | undefined | null

const buildAwarenessUrl = (path: string, query?: Record<string, QueryValue>) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${AWARENESS_API_BASE_URL}${normalizedPath}`)

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) return
      url.searchParams.set(key, String(value))
    })
  }

  return url.toString()
}

const awarenessGet = async <T>(path: string, query?: Record<string, QueryValue>): Promise<T> => {
  const response = await fetch(buildAwarenessUrl(path, query), {
    headers: AWARENESS_API_KEY
      ? {
          'x-api-key': AWARENESS_API_KEY,
        }
      : undefined,
  })

  if (!response.ok) {
    throw new Error(`GET ${path} failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

export interface LiveGridPoint {
  timestamp: string
  coal_mwh: number | null
  gas_mwh: number | null
  solar_mwh: number | null
  wind_mwh: number | null
  hydro_mwh: number | null
  battery_mwh: number | null
  total_mwh: number | null
  renewables_pct: number | null
  fossil_pct: number | null
  emissions_intensity: number | null
  grid_signal: string | null
}

export interface LiveGridSummary {
  window_hours: number
  latest: LiveGridPoint | null
  average_total_mwh: number | null
  peak_total_mwh: number | null
  min_total_mwh: number | null
  average_renewables_pct: number | null
  current_signal: string | null
  series: LiveGridPoint[]
}

export interface DemandTrendPoint {
  timestamp: string
  energy_mwh: number
  temperature_c: number | null
  is_demand_peak?: boolean | null
}

export interface DemandInsights {
  lookback_days: number
  current_energy_mwh: number | null
  average_energy_mwh: number | null
  peak_hour: string | null
  peak_energy_mwh: number | null
  low_hour: string | null
  low_energy_mwh: number | null
  avg_temperature_c: number | null
  peak_hour_ratio_pct: number | null
  demand_series?: DemandTrendPoint[]
}

export interface EmissionTrendPoint {
  timestamp: string
  emissions_t: number
  emission_intensity: number
  is_dirty_grid?: boolean | null
}

export interface EmissionInsights {
  lookback_days: number
  current_emission_intensity: number | null
  average_emission_intensity: number | null
  current_emissions_t: number | null
  average_emissions_t: number | null
  cleanest_hour: string | null
  cleanest_intensity: number | null
  dirtiest_hour: string | null
  dirtiest_intensity: number | null
  dirty_grid_ratio_pct: number | null
  emission_series?: EmissionTrendPoint[]
}

export interface AwarenessOverview {
  generated_at: string
  headline: string
  key_messages: string[]
  live_grid: LiveGridSummary
  demand: DemandInsights
  emissions: EmissionInsights
}

export const fetchLiveGridSummary = async (hours = 24): Promise<LiveGridSummary> =>
  awarenessGet<LiveGridSummary>('/awareness/live', { hours })

export const fetchDemandInsights = async (days = 30): Promise<DemandInsights> =>
  awarenessGet<DemandInsights>('/awareness/demand', { days })

export const fetchEmissionInsights = async (days = 30): Promise<EmissionInsights> =>
  awarenessGet<EmissionInsights>('/awareness/emissions', { days })

export const fetchAwarenessOverview = async (
  liveHours = 24,
  historicalDays = 30,
): Promise<AwarenessOverview> =>
  awarenessGet<AwarenessOverview>('/awareness/overview', {
    live_hours: liveHours,
    historical_days: historicalDays,
  })
