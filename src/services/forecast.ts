import { apiGet } from '@/services/http'

export interface ForecastSnapshot {
  locationLabel: string
  currentTempC: number
  todayMinC: number
  todayMaxC: number
  tomorrowMaxC: number
  tomorrowDate: string
  source: 'backend' | 'open-meteo' | 'fallback'
}

interface BackendForecastResponse {
  location?: string
  currentTempC?: number
  todayMinC?: number
  todayMaxC?: number
  tomorrowMaxC?: number
  tomorrowDate?: string
}

interface OpenMeteoForecastResponse {
  current?: {
    temperature_2m?: number
  }
  daily?: {
    time?: string[]
    temperature_2m_min?: number[]
    temperature_2m_max?: number[]
  }
}

interface OpenMeteoGeocodeResponse {
  results?: Array<{
    latitude: number
    longitude: number
    name?: string
    admin2?: string
    admin1?: string
  }>
}

interface ZippopotamPostcodeResponse {
  country?: string
  'country abbreviation'?: string
  'post code'?: string
  places?: Array<{
    'place name'?: string
    longitude?: string
    latitude?: string
    state?: string
    'state abbreviation'?: string
  }>
}

const formatSuburbCity = (name?: string, admin2?: string, admin1?: string) => {
  const suburb = name?.trim()
  const city = admin2?.trim()
  const state = admin1?.trim()

  if (suburb && city) return `${suburb}, ${city}`
  if (suburb && state) return `${suburb}, ${state}`
  if (city && state) return `${city}, ${state}`
  return suburb ?? city ?? state ?? 'Melbourne, VIC'
}

const round = (value: number) => Math.round(value * 10) / 10

const fallbackSnapshot = (): ForecastSnapshot => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  return {
    locationLabel: 'Melbourne, VIC',
    currentTempC: 31.4,
    todayMinC: 20.1,
    todayMaxC: 34.6,
    tomorrowMaxC: 37.2,
    tomorrowDate: tomorrow.toISOString().slice(0, 10),
    source: 'fallback',
  }
}

const fetchFromBackend = async (params: {
  lat?: number
  lon?: number
  postcode?: string
}): Promise<ForecastSnapshot> => {
  const query: Record<string, string> = {}
  if (params.lat !== undefined && params.lon !== undefined) {
    query.lat = String(params.lat)
    query.lon = String(params.lon)
  }
  if (params.postcode) {
    query.postcode = params.postcode
  }

  const response = await apiGet<BackendForecastResponse>('/forecast/weather', query)

  return {
    locationLabel: response.location ?? 'Victoria',
    currentTempC: response.currentTempC ?? 0,
    todayMinC: response.todayMinC ?? 0,
    todayMaxC: response.todayMaxC ?? 0,
    tomorrowMaxC: response.tomorrowMaxC ?? 0,
    tomorrowDate: response.tomorrowDate ?? new Date().toISOString().slice(0, 10),
    source: 'backend',
  }
}

const fetchCoordsForPostcode = async (postcode: string) => {
  // Dedicated AU postcode lookup (more reliable than generic geocoding for numeric postcodes).
  const response = await fetch(`https://api.zippopotam.us/AU/${postcode}`)
  if (!response.ok) {
    throw new Error('Geocoding failed')
  }

  const data = (await response.json()) as ZippopotamPostcodeResponse
  const first = data.places?.[0]
  if (!first) {
    throw new Error('No geocode result')
  }

  const lat = Number(first.latitude)
  const lon = Number(first.longitude)
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    throw new Error('Invalid geocode coordinates')
  }

  const placeName = first['place name']?.trim()
  const state = first.state?.trim() ?? first['state abbreviation']?.trim() ?? 'VIC'

  return {
    lat,
    lon,
    label: placeName ? `${placeName}, ${state}` : `${postcode}, ${state}`,
  }
}

const fetchLabelForCoords = async (lat: number, lon: number) => {
  const reverseUrl = new URL('https://geocoding-api.open-meteo.com/v1/reverse')
  reverseUrl.searchParams.set('latitude', String(lat))
  reverseUrl.searchParams.set('longitude', String(lon))
  reverseUrl.searchParams.set('count', '1')
  reverseUrl.searchParams.set('language', 'en')
  reverseUrl.searchParams.set('format', 'json')

  const response = await fetch(reverseUrl.toString())
  if (!response.ok) {
    throw new Error('Reverse geocoding failed')
  }

  const data = (await response.json()) as OpenMeteoGeocodeResponse
  const first = data.results?.[0]
  if (!first) {
    throw new Error('No reverse geocode result')
  }

  return formatSuburbCity(first.name, first.admin2, first.admin1)
}

const fetchFromOpenMeteo = async (params: {
  lat?: number
  lon?: number
  postcode?: string
}): Promise<ForecastSnapshot> => {
  let lat = params.lat
  let lon = params.lon
  let locationLabel = 'Victoria'

  if ((lat === undefined || lon === undefined) && params.postcode) {
    const geo = await fetchCoordsForPostcode(params.postcode)
    lat = geo.lat
    lon = geo.lon
    locationLabel = geo.label
  }

  if (lat === undefined || lon === undefined) {
    lat = -37.8136
    lon = 144.9631
    locationLabel = 'Melbourne, VIC'
  } else if (!params.postcode) {
    try {
      locationLabel = await fetchLabelForCoords(lat, lon)
    } catch {
      locationLabel = 'Melbourne, VIC'
    }
  }

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast')
  forecastUrl.searchParams.set('latitude', String(lat))
  forecastUrl.searchParams.set('longitude', String(lon))
  forecastUrl.searchParams.set('current', 'temperature_2m')
  forecastUrl.searchParams.set('daily', 'temperature_2m_min,temperature_2m_max')
  forecastUrl.searchParams.set('timezone', 'Australia/Melbourne')
  forecastUrl.searchParams.set('forecast_days', '3')

  const response = await fetch(forecastUrl.toString())
  if (!response.ok) {
    throw new Error('Open-Meteo forecast failed')
  }

  const data = (await response.json()) as OpenMeteoForecastResponse
  const dailyTimes = data.daily?.time ?? []
  const dailyMins = data.daily?.temperature_2m_min ?? []
  const dailyMaxes = data.daily?.temperature_2m_max ?? []

  return {
    locationLabel,
    currentTempC: round(data.current?.temperature_2m ?? dailyMaxes[0] ?? 0),
    todayMinC: round(dailyMins[0] ?? 0),
    todayMaxC: round(dailyMaxes[0] ?? 0),
    tomorrowMaxC: round(dailyMaxes[1] ?? dailyMaxes[0] ?? 0),
    tomorrowDate: dailyTimes[1] ?? new Date().toISOString().slice(0, 10),
    source: 'open-meteo',
  }
}

export const fetchForecastSnapshot = async (params: {
  lat?: number
  lon?: number
  postcode?: string
}): Promise<ForecastSnapshot> => {
  try {
    return await fetchFromBackend(params)
  } catch {
    try {
      return await fetchFromOpenMeteo(params)
    } catch {
      return fallbackSnapshot()
    }
  }
}
