import { apiGet, apiPost } from '@/services/http'

export interface ForecastSnapshot {
  locationLabel: string
  currentTempC: number
  todayMinC: number
  todayMaxC: number
  tomorrowMaxC: number
  tomorrowDate: string
  humidityPct: number
  windKph: number
  uvIndex: number
  weatherCode: number
  isDay: boolean
  hourly: Array<{
    time: string
    tempC: number
    weatherCode: number
    isDay: boolean
  }>
  weekly: Array<{
    date: string
    minC: number
    maxC: number
    weatherCode: number
  }>
  source: 'backend'
}

interface LocationResolveResponse {
  postcode: string
  state: string
  lat?: number
  lon?: number
  coordinates?: {
    lat?: number
    lon?: number
  }
}

interface BackendForecastResponse {
  currentTempC?: number
  humidityPct?: number
  windKph?: number
  uvIndex?: number
  weatherCode?: number
  isDay?: boolean
  today?: {
    minC?: number
    maxC?: number
  }
  tomorrow?: {
    date?: string
    minC?: number
    maxC?: number
  }
  hourly?: Array<{
    time: string
    tempC: number
    weatherCode: number
    isDay: boolean
  }>
  weekly?: Array<{
    date: string
    minC: number
    maxC: number
    weatherCode: number
  }>
}

const round = (value: number) => Math.round(value * 10) / 10

const resolvePostcode = async (postcode: string) => {
  const response = await apiPost<LocationResolveResponse>('/location/resolve', { postcode })
  const lat = response.coordinates?.lat ?? response.lat
  const lon = response.coordinates?.lon ?? response.lon
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    throw new Error('Invalid location resolve response')
  }
  return {
    lat,
    lon,
    label: `${response.postcode}, ${response.state}`,
  }
}

const normalizeSnapshot = (
  response: BackendForecastResponse,
  locationLabel: string,
): ForecastSnapshot => {
  return {
    locationLabel,
    currentTempC: round(response.currentTempC ?? 0),
    todayMinC: round(response.today?.minC ?? 0),
    todayMaxC: round(response.today?.maxC ?? 0),
    tomorrowMaxC: round(response.tomorrow?.maxC ?? 0),
    tomorrowDate: response.tomorrow?.date ?? new Date().toISOString().slice(0, 10),
    humidityPct: Math.round(response.humidityPct ?? 0),
    windKph: round(response.windKph ?? 0),
    uvIndex: round(response.uvIndex ?? 0),
    weatherCode: Math.round(response.weatherCode ?? 0),
    isDay: Boolean(response.isDay ?? true),
    hourly: (response.hourly ?? []).map((row) => ({
      time: row.time,
      tempC: round(row.tempC ?? 0),
      weatherCode: Math.round(row.weatherCode ?? 0),
      isDay: Boolean(row.isDay ?? true),
    })),
    weekly: (response.weekly ?? []).map((row) => ({
      date: row.date,
      minC: round(row.minC ?? 0),
      maxC: round(row.maxC ?? 0),
      weatherCode: Math.round(row.weatherCode ?? 0),
    })),
    source: 'backend',
  }
}

export const fetchForecastSnapshot = async (params: {
  lat?: number
  lon?: number
  postcode?: string
}): Promise<ForecastSnapshot> => {
  let lat = params.lat
  let lon = params.lon
  let locationLabel = 'Victoria'

  if ((lat === undefined || lon === undefined) && params.postcode) {
    const resolved = await resolvePostcode(params.postcode)
    lat = resolved.lat
    lon = resolved.lon
    locationLabel = resolved.label
  } else if (lat !== undefined && lon !== undefined) {
    locationLabel = 'Current Location'
  }

  if (lat === undefined || lon === undefined) {
    throw new Error('Forecast requires either coordinates or a resolvable postcode')
  }

  const response = await apiGet<BackendForecastResponse>('/forecast/weather', {
    lat: String(lat),
    lon: String(lon),
  })

  return normalizeSnapshot(response, locationLabel)
}
