<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Line } from 'vue-chartjs'
import annotationPlugin from 'chartjs-plugin-annotation'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Droplets, Sun, Thermometer, Wind } from 'lucide-vue-next'

import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { apiGet, apiPost } from '@/services/http'
import { fetchForecastSnapshot, type ForecastSnapshot } from '@/services/forecast'
import {
  loadSharedLocationState,
  loadStoredProfileSetup,
  mapToSmartActionsPayload,
  persistSharedLocationState,
  SMART_ACTIONS_RESPONSE_KEY,
  SMART_ACTIONS_UNLOCKED_KEY,
} from '@/services/profileSetup'
import {
  fetchSmartActionsRecommendations,
  type SmartActionRecommendation,
  type SmartActionsResponse,
} from '@/services/smartActions'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin,
)

const loading = ref(false)
const errorMessage = ref('')
const showImpactSummary = ref(false)
const apiResponse = ref<SmartActionsResponse | null>(null)
const flippedCards = ref<boolean[]>([])
const selectedActionItems = ref<string[]>([])

const locationStatus = ref<'checking' | 'granted' | 'denied' | 'unavailable'>('checking')
const locationCoords = ref<{ lat: number; lon: number } | null>(null)
const activeFallbackPostcode = ref('3000')
const forecastSnapshot = ref<ForecastSnapshot | null>(null)
const heroLoading = ref(true)
const chartHourlyFromApi = ref<Array<{ time: string; tempC: number }>>([])
const awsTodayMinMax = ref<{ minC: number; maxC: number } | null>(null)
const HEATWAVE_THRESHOLD_C = 35
const FORCE_NIGHT_VIDEO = false

interface LocationResolveResponse {
  lat: number
  lon: number
}

interface ForecastWeatherResponse {
  today?: {
    minC?: number
    maxC?: number
  }
  hourly?: Array<{
    time?: string
    tempC?: number
  }>
}

const isUnlocked = computed(() => sessionStorage.getItem(SMART_ACTIONS_UNLOCKED_KEY) === 'true')
const hasSelection = computed(() => selectedActionItems.value.length > 0)
const selectedCount = computed(() => selectedActionItems.value.length)

const hasBrowserLocation = computed(() => Boolean(locationCoords.value))
const hasValidActiveFallbackPostcode = computed(() => {
  const code = Number(activeFallbackPostcode.value.trim())
  if (Number.isNaN(code)) return false
  return (code >= 3000 && code <= 3999) || (code >= 8000 && code <= 8999)
})

const setupReady = computed(() => {
  const usingBrowserLocation = locationStatus.value === 'granted' && hasBrowserLocation.value
  const usingPostcode =
    (locationStatus.value === 'denied' || locationStatus.value === 'unavailable') &&
    hasValidActiveFallbackPostcode.value

  return usingBrowserLocation || usingPostcode
})

const colorClass = (color: SmartActionRecommendation['color']) => {
  if (color === 'RED') return 'border-red-300 bg-red-50 text-red-800'
  if (color === 'YELLOW') return 'border-yellow-300 bg-yellow-50 text-yellow-800'
  return 'border-emerald-300 bg-emerald-50 text-emerald-800'
}

const priorityBadgeClass = (priority: SmartActionRecommendation['priority']) => {
  if (priority === 'HIGH') return 'bg-red-900 text-white'
  if (priority === 'MEDIUM') return 'bg-yellow-700 text-white'
  return 'bg-emerald-900 text-white'
}

const recommendationTitle = (rec: SmartActionRecommendation) => {
  return rec.short_reason?.trim() || rec.appliance.replaceAll('_', ' ')
}

const recommendationFingerprint = (rec: SmartActionRecommendation) => {
  return recommendationTitle(rec).toLowerCase()
}

const dedupedRecommendations = computed(() => {
  const seen = new Set<string>()
  const unique: SmartActionRecommendation[] = []

  for (const rec of apiResponse.value?.recommendations ?? []) {
    const key = recommendationFingerprint(rec)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(rec)
  }

  return unique
})

const actionItems = computed(() =>
  dedupedRecommendations.value.map((rec) => ({
    id: rec.id,
    title: recommendationTitle(rec),
  })),
)

const impactSummary = computed(() => {
  const selectedRecommendations = dedupedRecommendations.value.filter((rec) =>
    selectedActionItems.value.includes(rec.id),
  )

  const totalKwh = selectedRecommendations.reduce(
    (sum, rec) => sum + (rec.action.impact?.avoided_kwh ?? 0),
    0,
  )
  const totalCo2 = selectedRecommendations.reduce(
    (sum, rec) => sum + (rec.action.impact?.avoided_emissions_kg_co2 ?? 0),
    0,
  )
  const peakReduction = selectedRecommendations.reduce(
    (sum, rec) => sum + (rec.action.impact?.peak_reduction_pct ?? 0),
    0,
  )

  return [
    { value: `${totalCo2.toFixed(2)} kg`, label: 'CO2 emissions avoided' },
    { value: `${peakReduction.toFixed(1)}%`, label: 'Peak load reduction' },
    { value: `${totalKwh.toFixed(2)} kWh`, label: 'Energy shifted off-peak' },
    { value: `${selectedRecommendations.length}`, label: 'Recommendations completed' },
  ]
})

const requestBrowserLocation = async () => {
  if (!navigator.geolocation) {
    locationStatus.value = 'unavailable'
    return
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
      })
    })

    locationCoords.value = {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
    }
    locationStatus.value = 'granted'
    persistSharedLocationState('granted', locationCoords.value)
  } catch {
    locationStatus.value = 'denied'
    locationCoords.value = null
    persistSharedLocationState('denied', null)
  }
}

const checkBrowserLocationPermission = async () => {
  const shared = loadSharedLocationState()
  if (shared?.status === 'granted' && shared.coords) {
    locationStatus.value = 'granted'
    locationCoords.value = shared.coords
    return
  }

  if (!navigator.geolocation) {
    locationStatus.value = 'unavailable'
    persistSharedLocationState('unavailable', null)
    return
  }

  if (!('permissions' in navigator)) {
    await requestBrowserLocation()
    return
  }

  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName })

    if (permission.state === 'granted') {
      await requestBrowserLocation()
      return
    }

    if (permission.state === 'denied') {
      locationStatus.value = 'denied'
      persistSharedLocationState('denied', null)
      return
    }

    await requestBrowserLocation()
  } catch {
    await requestBrowserLocation()
  }
}

const tomorrowDateLabel = computed(() => {
  if (!forecastSnapshot.value?.tomorrowDate) return ''

  const date = new Date(forecastSnapshot.value.tomorrowDate)
  if (Number.isNaN(date.getTime())) return forecastSnapshot.value.tomorrowDate

  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
})

const isHeatwaveTomorrow = computed(
  () => (forecastSnapshot.value?.tomorrowMaxC ?? 0) >= HEATWAVE_THRESHOLD_C,
)

const weatherCodeToLabel = (code: number, isDay: boolean) => {
  if (code === 0) return isDay ? 'Clear Sky' : 'Clear Night'
  if (code === 1) return isDay ? 'Mainly Sunny' : 'Mainly Clear'
  if (code === 2) return 'Partly Cloudy'
  if (code === 3) return 'Overcast'
  if ([45, 48].includes(code)) return 'Foggy'
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain Showers'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow'
  if ([95, 96, 99].includes(code)) return 'Thunderstorm'
  return 'Weather'
}

const moodKey = computed(() => {
  if (FORCE_NIGHT_VIDEO) return 'cloud'

  const code = forecastSnapshot.value?.weatherCode ?? 1
  const isDay = forecastSnapshot.value?.isDay ?? true

  if ([95, 96, 99].includes(code)) return 'storm'
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow'
  if (!isDay) return 'night'
  if ([45, 48].includes(code)) return 'fog'
  if ([2, 3].includes(code)) return 'cloud'
  return 'sun'
})

const moodVideoSrc = computed(() => {
  switch (moodKey.value) {
    case 'storm':
      return '/weather-bg/storm.mp4'
    case 'rain':
      return '/weather-bg/rain.mp4'
    case 'snow':
      return '/weather-bg/cloud.mp4'
    case 'night':
      return '/weather-bg/night.mp4'
    case 'fog':
      return '/weather-bg/cloud.mp4'
    case 'cloud':
      return '/weather-bg/cloud.mp4'
    default:
      return '/weather-bg/sun.mp4'
  }
})

const dashboardToneClass = computed(() => {
  switch (moodKey.value) {
    case 'storm':
      return 'from-slate-950/40 via-indigo-900/35 to-slate-900/50'
    case 'rain':
      return 'from-slate-900/30 via-sky-900/30 to-slate-900/45'
    case 'snow':
      return 'from-slate-900/20 via-sky-900/24 to-slate-800/35'
    case 'night':
      return 'from-indigo-950/45 via-slate-900/40 to-slate-900/50'
    case 'fog':
      return 'from-slate-800/22 via-slate-700/26 to-slate-800/35'
    case 'cloud':
      return 'from-slate-800/24 via-slate-700/30 to-slate-800/38'
    default:
      return 'from-amber-700/24 via-sky-700/26 to-emerald-900/32'
  }
})

const glassCardClass = 'bg-black/22 border-white/18 shadow-[0_12px_22px_rgba(15,23,42,0.22)]'
const glassTileClass = 'bg-black/20 border-white/16 shadow-[0_6px_12px_rgba(15,23,42,0.16)]'

const uvValue = computed(() => {
  return Math.max(0, Math.min(11, forecastSnapshot.value?.uvIndex ?? 0))
})

const uvLabel = computed(() => {
  const uv = uvValue.value
  if (uv < 3) return 'Low'
  if (uv < 6) return 'Moderate'
  if (uv < 8) return 'High'
  if (uv < 11) return 'Very High'
  return 'Extreme'
})

const uvIndicatorClass = computed(() => {
  const uv = uvValue.value
  if (uv < 3) return 'text-emerald-400'
  if (uv < 6) return 'text-yellow-400'
  if (uv < 8) return 'text-orange-400'
  if (uv < 11) return 'text-rose-400'
  return 'text-fuchsia-400'
})

const uvRing = computed(() => {
  const radius = 30
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(11, uvValue.value))
  const progress = clamped / 11
  const dashOffset = circumference * (1 - progress)

  return { radius, circumference, dashOffset }
})

const conditionLabel = computed(() => {
  if (!forecastSnapshot.value) return 'Weather'
  if (isHeatwaveTomorrow.value && [95, 96, 99].includes(forecastSnapshot.value.weatherCode)) {
    return 'Severe Heat + Storm Risk'
  }
  return weatherCodeToLabel(forecastSnapshot.value.weatherCode, forecastSnapshot.value.isDay)
})

const displayTodayMinC = computed(() => {
  if (awsTodayMinMax.value) return awsTodayMinMax.value.minC
  return forecastSnapshot.value?.todayMinC ?? 0
})

const displayTodayMaxC = computed(() => {
  if (awsTodayMinMax.value) return awsTodayMinMax.value.maxC
  return forecastSnapshot.value?.todayMaxC ?? 0
})

const displayHumidityPct = computed(() => forecastSnapshot.value?.humidityPct ?? 0)
const displayWindKph = computed(() => Math.round(forecastSnapshot.value?.windKph ?? 0))

const fetchChartHourlyFromWeatherApi = async () => {
  let lat = locationCoords.value?.lat
  let lon = locationCoords.value?.lon

  if ((lat === undefined || lon === undefined) && hasValidActiveFallbackPostcode.value) {
    const resolved = await apiPost<LocationResolveResponse>('/location/resolve', {
      postcode: activeFallbackPostcode.value.trim(),
    })
    lat = resolved.lat
    lon = resolved.lon
  }

  if (lat === undefined || lon === undefined) {
    awsTodayMinMax.value = null
    chartHourlyFromApi.value = []
    return
  }

  const response = await apiGet<ForecastWeatherResponse>('/forecast/weather', {
    lat: String(lat),
    lon: String(lon),
  })

  const minC = Number(response.today?.minC)
  const maxC = Number(response.today?.maxC)
  awsTodayMinMax.value = Number.isFinite(minC) && Number.isFinite(maxC) ? { minC, maxC } : null

  chartHourlyFromApi.value = (response.hourly ?? [])
    .map((entry) => ({
      time: entry.time ?? '',
      tempC: Number(entry.tempC ?? 0),
    }))
    .filter((entry) => Boolean(entry.time) && Number.isFinite(entry.tempC))
}

const next12Hourly = computed(() => {
  const source = chartHourlyFromApi.value.map((entry) => ({
    time: entry.time,
    tempC: entry.tempC,
  }))
  if (!source.length) return []

  const now = new Date()
  now.setMinutes(0, 0, 0)
  const startMs = now.getTime()

  const startIndex = source.findIndex((h) => {
    const ms = new Date(h.time).getTime()
    return !Number.isNaN(ms) && ms >= startMs
  })

  if (startIndex === -1) return source.slice(0, 12)
  return source.slice(startIndex, startIndex + 12)
})

const sampledHourly = computed(() => next12Hourly.value.filter((_, index) => index % 2 === 0))

const hourlyLabels = computed(() =>
  sampledHourly.value.map((h) => {
    const date = new Date(h.time)
    if (Number.isNaN(date.getTime())) return '--:--'
    return date.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Australia/Melbourne',
    })
  }),
)

const hourlyTemps = computed(() => sampledHourly.value.map((h) => Math.round(h.tempC)))
const midnightLabelIndex = computed(() => hourlyLabels.value.findIndex((label) => label === '00:00'))

const hourlyChartData = computed<ChartData<'line'>>(() => ({
  labels: hourlyLabels.value,
  datasets: [
    {
      data: hourlyTemps.value,
      borderColor: 'rgba(251,191,36,1)',
      borderWidth: 3,
      pointRadius: 4,
      pointHoverRadius: 4,
      pointBackgroundColor: 'rgba(255,255,255,0.95)',
      pointBorderColor: 'rgba(255,255,255,0.95)',
      tension: 0.35,
      fill: true,
      backgroundColor: (ctx) => {
        const { chart } = ctx
        const area = chart.chartArea
        if (!area) return 'rgba(250,204,21,0.35)'
        const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
        gradient.addColorStop(0, 'rgba(250,204,21,0.62)')
        gradient.addColorStop(1, 'rgba(251,146,60,0.14)')
        return gradient
      },
    },
  ],
}))

const hourlyChartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        label: (ctx) => `${ctx.parsed.y}°C`,
      },
    },
    annotation: {
      annotations:
        midnightLabelIndex.value >= 0
          ? {
              midnightLine: {
                type: 'line',
                xMin: midnightLabelIndex.value,
                xMax: midnightLabelIndex.value,
                borderColor: 'rgba(255,255,255,0.4)',
                borderWidth: 1,
                borderDash: [6, 6],
                label: {
                  display: true,
                  content: 'MIDNIGHT',
                  position: 'end',
                  backgroundColor: 'rgba(0,0,0,0)',
                  color: 'rgba(255,255,255,0.85)',
                  yAdjust: -6,
                  font: { weight: 'bold' },
                },
              },
            }
          : {},
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(148,163,184,0.24)' },
      border: { display: true, color: 'rgba(100,116,139,0.45)' },
      ticks: {
        color: 'rgba(30,41,59,0.9)',
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 7,
      },
    },
    y: {
      beginAtZero: false,
      grid: { color: 'rgba(148,163,184,0.24)' },
      border: { display: true, color: 'rgba(100,116,139,0.45)' },
      ticks: {
        color: 'rgba(30,41,59,0.9)',
        callback: (value) => `${value}°`,
      },
    },
  },
  interaction: {
    mode: 'index',
    intersect: false,
  },
}))

const loadForecastBlocks = async () => {
  if (!setupReady.value) {
    forecastSnapshot.value = null
    heroLoading.value = false
    return
  }

  try {
    const fallbackPostcode =
      locationStatus.value === 'denied' || locationStatus.value === 'unavailable'
        ? activeFallbackPostcode.value.trim()
        : undefined

    const snapshot = await fetchForecastSnapshot({
      lat: locationCoords.value?.lat,
      lon: locationCoords.value?.lon,
      postcode: fallbackPostcode,
    })

    forecastSnapshot.value = snapshot
    await fetchChartHourlyFromWeatherApi()
  } catch {
    forecastSnapshot.value = null
  } finally {
    heroLoading.value = false
  }
}

const scrollToActionFlow = () => {
  const section = document.getElementById('smart-actions-flow')
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const toggleCardFlip = (index: number) => {
  flippedCards.value[index] = !flippedCards.value[index]
}

const toggleActionItem = (itemId: string, checked: boolean) => {
  if (checked) {
    if (!selectedActionItems.value.includes(itemId)) {
      selectedActionItems.value.push(itemId)
    }
    return
  }

  selectedActionItems.value = selectedActionItems.value.filter((v) => v !== itemId)
}

const selectAllActions = () => {
  selectedActionItems.value = actionItems.value.map((item) => item.id)
}

const clearAllActions = () => {
  selectedActionItems.value = []
  showImpactSummary.value = false
}

const loadRecommendations = async () => {
  if (!isUnlocked.value) return

  const cached = sessionStorage.getItem(SMART_ACTIONS_RESPONSE_KEY)
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as SmartActionsResponse
      apiResponse.value = parsed
      flippedCards.value = dedupedRecommendations.value.map(() => false)
      selectedActionItems.value = selectedActionItems.value.filter((id) =>
        dedupedRecommendations.value.some((rec) => rec.id === id),
      )
      return
    } catch {
      sessionStorage.removeItem(SMART_ACTIONS_RESPONSE_KEY)
    }
  }

  const setup = loadStoredProfileSetup()
  if (!setup) {
    errorMessage.value = 'Profile setup data not found. Please complete setup again.'
    return
  }

  const payload = mapToSmartActionsPayload(setup)
  if (!payload.wall_type || payload.appliances.length === 0 || !payload.postcode) {
    errorMessage.value = 'Profile setup is incomplete for Smart Actions.'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const response = await fetchSmartActionsRecommendations({
      wall_type: payload.wall_type,
      appliances: payload.appliances,
      postcode: payload.postcode,
    })
    apiResponse.value = response
    flippedCards.value = dedupedRecommendations.value.map(() => false)
    selectedActionItems.value = selectedActionItems.value.filter((id) =>
      dedupedRecommendations.value.some((rec) => rec.id === id),
    )
    sessionStorage.setItem(SMART_ACTIONS_RESPONSE_KEY, JSON.stringify(response))
  } catch {
    errorMessage.value = 'Unable to load smart actions recommendations right now.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const heroFlow = (async () => {
    await checkBrowserLocationPermission()
    await loadForecastBlocks()
  })()

  const deferredRecommendations = new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(async () => {
        await loadRecommendations()
        resolve()
      }, 0)
    })
  })

  await Promise.all([heroFlow, deferredRecommendations])
})
</script>

<template>
  <div class="min-h-screen bg-white text-slate-900">
    <Transition name="page-overlay-fade">
      <div
        v-if="heroLoading"
        class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/92"
      >
        <div class="text-center text-white">
          <div class="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white"></div>
          <p class="mt-4 text-sm font-semibold uppercase tracking-widest text-white/85">
            Loading Smart Actions
          </p>
        </div>
      </div>
    </Transition>

    <SiteHeader />

    <section class="w-full">
      <Transition name="hero-fade">
        <Card
          v-if="forecastSnapshot"
          key="hero-weather"
          class="relative mx-auto w-full max-w-none overflow-hidden rounded-none border-transparent bg-white p-0 shadow-sm"
        >
          <div class="smart-actions-hero-surface relative min-h-[730px] w-full overflow-hidden rounded-none">
            <div class="smart-actions-hero-bg" aria-hidden="true"></div>
            <div class="smart-actions-hero-overlay" aria-hidden="true"></div>

            <Card class="hero-card hero-temp-card hero-primary-card hero-accent-green float-card hero-top-left rounded-2xl p-4">
              <CardHeader class="p-0">
                <CardTitle
                  class="rounded-lg bg-slate-100/80 px-3 py-1.5 text-center text-sm font-semibold tracking-wide text-slate-800"
                >
                  {{ forecastSnapshot.locationLabel }}
                </CardTitle>
              </CardHeader>
              <CardContent class="mt-3 flex items-center justify-center p-0 text-center">
                <div>
                  <p class="text-5xl font-bold leading-none text-slate-900 lg:text-6xl">
                    {{ forecastSnapshot.currentTempC.toFixed(0) }}°
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card class="hero-card hero-accent-orange float-card-delay hero-top-right rounded-2xl p-4">
              <CardContent class="p-0 text-sm">
                <p class="text-center text-sm font-semibold uppercase tracking-wide text-slate-700">Today</p>
                <Thermometer class="mx-auto mt-2 h-5 w-5 text-slate-700" />
                <p class="mt-2 text-center text-base font-bold text-slate-900">
                    {{ displayTodayMaxC.toFixed(0) }}° / {{ displayTodayMinC.toFixed(0) }}°
                </p>
              </CardContent>
            </Card>

            <Card class="hero-card hero-accent-green float-card-soft hero-mid-right rounded-2xl p-4">
              <CardContent class="p-0 text-sm">
                <p class="text-center text-sm font-semibold uppercase tracking-wide text-slate-700">Tomorrow</p>
                <Sun class="mx-auto mt-2 h-5 w-5 text-slate-700" />
                <p class="mt-2 text-center text-base font-bold text-slate-900">{{ forecastSnapshot.tomorrowMaxC.toFixed(0) }}° max</p>
              </CardContent>
            </Card>

            <Card class="hero-card hero-accent-green float-card-delay hero-bottom-left rounded-2xl p-4">
              <CardContent class="p-0">
                <p class="text-center text-lg font-bold text-slate-800">UV Index</p>
                <div class="mt-2 flex justify-center">
                  <div class="h-24 w-24">
                    <svg viewBox="0 0 100 100" class="h-full w-full">
                      <circle cx="50" cy="50" :r="uvRing.radius" fill="none" stroke="rgba(71,85,105,0.25)" stroke-width="8" />
                      <circle
                        cx="50"
                        cy="50"
                        :r="uvRing.radius"
                        fill="none"
                        :class="uvIndicatorClass"
                        stroke="currentColor"
                        stroke-width="8"
                        stroke-linecap="round"
                        :stroke-dasharray="uvRing.circumference"
                        :stroke-dashoffset="uvRing.dashOffset"
                        transform="rotate(-90 50 50)"
                      />
                      <text x="50" y="47" text-anchor="middle" class="fill-slate-800 text-[14px] font-bold">
                        {{ uvValue.toFixed(1) }}
                      </text>
                      <text x="50" y="61" text-anchor="middle" class="fill-slate-700 text-[11px] font-bold">
                        {{ uvLabel }}
                      </text>
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card class="hero-card hero-accent-orange float-card hero-mid-left rounded-2xl p-4">
              <CardContent class="p-0 text-center">
                <p class="text-sm font-semibold uppercase tracking-wide text-slate-700">Humidity</p>
                <p class="mt-2 text-base font-bold text-slate-900">{{ displayHumidityPct }}%</p>
              </CardContent>
            </Card>

            <Card class="hero-card hero-accent-green float-card-soft hero-bottom-mid rounded-2xl p-4">
              <CardContent class="p-0 text-center">
                <p class="text-sm font-semibold uppercase tracking-wide text-slate-700">Wind</p>
                <p class="mt-2 text-base font-bold text-slate-900">{{ displayWindKph }} km/h</p>
              </CardContent>
            </Card>

            <Card class="hero-card hero-trend-card hero-accent-orange float-card-delay hero-bottom-right rounded-2xl p-4">
              <CardHeader class="p-0">
                <CardTitle class="text-sm font-semibold uppercase tracking-widest text-slate-700">Next Hours Trend</CardTitle>
              </CardHeader>
              <CardContent class="mt-2 h-56 p-0">
                <Line :data="hourlyChartData" :options="hourlyChartOptions" />
              </CardContent>
            </Card>

            <div class="hero-center-quote">
              <h1 class="text-3xl font-extrabold leading-tight text-slate-900 lg:text-5xl">Smart Actions, Smarter Outcomes.</h1>
              <p class="mx-auto mt-3 max-w-xl text-base text-slate-700 lg:text-lg">
                Every action you choose today helps reduce pressure on the grid and climate impact tomorrow.
              </p>
              <Button
                size="lg"
                class="mt-6 bg-[var(--gb-electric)] px-8 text-white hover:bg-[#4CBB17] hover:text-white"
                @click="scrollToActionFlow"
              >
                Act Now
              </Button>
            </div>
          </div>
        </Card>

        <div
          v-else
          key="hero-fallback"
          class="relative mx-auto flex min-h-[620px] w-full items-center justify-center overflow-hidden bg-slate-900 text-center"
        >
          <div class="px-6 text-white">
            <p class="text-2xl font-bold lg:text-3xl">Smart Actions, Smarter Outcomes.</p>
            <p class="mt-3 text-sm text-white/85 lg:text-base">
              Weather context is temporarily unavailable. You can still continue with Smart Actions.
            </p>
            <Button
              size="lg"
              class="mt-6 bg-[var(--gb-electric)] px-8 text-white hover:bg-[#4CBB17] hover:text-white"
              @click="scrollToActionFlow"
            >
              Act Now
            </Button>
          </div>
        </div>
      </Transition>
    </section>

    <main id="smart-actions-flow" class="mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-10 text-center lg:px-10">
      <h2 class="text-3xl font-extrabold tracking-tight text-[var(--gb-grid)] lg:text-4xl">Smart Actions</h2>

      <Card
        v-if="!isUnlocked"
        class="mt-10 w-full max-w-xl border border-amber-200 bg-amber-50 text-center"
      >
        <CardHeader>
          <CardTitle class="text-2xl font-bold text-amber-900">Complete Profile Setup First</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-amber-800">
            You need to complete and submit your profile setup before Smart Actions can be generated.
          </p>
          <Button as-child class="mt-5 bg-[var(--gb-electric)] text-white hover:bg-[#4CBB17] hover:text-white">
            <RouterLink to="/profile-setup">Go to Profile Setup</RouterLink>
          </Button>
        </CardContent>
      </Card>

      <template v-else>
        <p v-if="loading" class="mt-6 text-sm font-semibold text-slate-600">Loading smart actions...</p>
        <p v-if="errorMessage" class="mt-6 text-sm font-semibold text-red-600">{{ errorMessage }}</p>

        <section v-if="apiResponse" class="mt-8 w-full">
          <h3 class="text-2xl font-bold">Recommendations</h3>

          <div class="mt-5 grid gap-4 md:grid-cols-2">
            <div
              v-for="(card, index) in dedupedRecommendations"
              :key="card.id"
              class="flip-card h-52 w-full text-left"
            >
              <div class="flip-card-inner h-full w-full" :class="{ 'is-flipped': flippedCards[index] }">
                <Card :class="colorClass(card.color)" class="flip-card-face flip-card-front border">
                  <CardHeader>
                    <div class="flex items-start justify-between gap-2">
                      <CardTitle class="text-lg font-bold">{{ recommendationTitle(card) }}</CardTitle>
                      <span
                        class="rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
                        :class="priorityBadgeClass(card.priority)"
                      >
                        {{ card.priority }}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent class="flex h-full flex-col pt-0">
                    <div class="mt-auto flex justify-end">
                      <button
                        type="button"
                        class="cursor-pointer text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
                        @click.stop="toggleCardFlip(index)"
                      >
                        Learn more
                      </button>
                    </div>
                  </CardContent>
                </Card>

                <Card class="flip-card-face flip-card-back border border-slate-200 bg-white text-slate-900">
                  <CardHeader>
                    <div class="flex items-start justify-between gap-2">
                      <CardTitle class="text-lg font-bold">Why this matters</CardTitle>
                      <span
                        class="rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
                        :class="priorityBadgeClass(card.priority)"
                      >
                        {{ card.priority }}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent class="flex h-full flex-col pt-0">
                    <p class="text-sm text-slate-700">{{ card.explanation }}</p>
                    <div class="mt-auto flex justify-end">
                      <button
                        type="button"
                        class="cursor-pointer text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
                        @click.stop="toggleCardFlip(index)"
                      >
                        Go back
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section v-if="apiResponse" class="mt-10 w-full">
          <h3 class="text-2xl font-bold">Action Items</h3>
          <p class="mx-auto mt-2 max-w-2xl text-sm text-slate-700">
            Select only the actions you completed today (choose any that apply).
          </p>

          <div class="mx-auto mt-4 flex w-full max-w-2xl items-center justify-end gap-2">
            <button
              type="button"
              class="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              @click="selectAllActions"
            >
              Select all
            </button>
            <button
              type="button"
              class="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              @click="clearAllActions"
            >
              Clear all
            </button>
          </div>

          <div class="mx-auto mt-3 flex w-full max-w-2xl flex-col gap-3 text-left">
            <label
              v-for="item in actionItems"
              :key="item.id"
              class="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <Checkbox
                :model-value="selectedActionItems.includes(item.id)"
                @update:model-value="(checked) => toggleActionItem(item.id, Boolean(checked))"
              />
              <span class="text-sm font-medium text-slate-800">{{ item.title }}</span>
            </label>
          </div>

          <button
            type="button"
            class="mt-5 rounded-lg bg-[var(--gb-electric)] px-6 py-2 text-sm font-bold text-white hover:bg-[#4CBB17] hover:text-white"
            @click="showImpactSummary = true"
          >
            Estimate Impact
          </button>

          <div
            v-if="showImpactSummary && !hasSelection"
            class="mx-auto mt-4 w-full max-w-2xl rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-left"
          >
            <p class="text-sm font-semibold text-amber-700">
              No actions selected yet. Choose at least one completed action to calculate impact.
            </p>
            <p class="mt-1 text-sm font-bold text-emerald-900">
              Suggestion: Next time, pre-cool your living room 60-90 minutes before peak hours to reduce emissions and peak load.
            </p>
          </div>
        </section>

        <section v-if="apiResponse && showImpactSummary && hasSelection" class="mt-10 w-full">
          <h3 class="text-2xl font-bold">Impact Summary</h3>
          <p class="mt-2 text-sm text-slate-700">
            Impact calculated for {{ selectedCount }} selected action<span v-if="selectedCount > 1">s</span>.
          </p>

          <div class="mx-auto mt-4 grid w-full max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              v-for="item in impactSummary"
              :key="item.label"
              class="border border-slate-200 bg-slate-50 text-center"
            >
              <CardContent class="py-6">
                <p class="text-4xl font-extrabold text-slate-900">{{ item.value }}</p>
                <p class="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{{ item.label }}</p>
              </CardContent>
            </Card>
          </div>

          <p class="mx-auto mt-5 max-w-3xl rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
            Great job. Your selected actions are helping reduce grid stress and supporting a more reliable, lower-emission energy system.
          </p>
        </section>
      </template>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.smart-actions-hero-surface {
  background: #ffffff;
}

.smart-actions-hero-bg {
  position: absolute;
  inset: 0;
  background-image: url('/smart-actions-doodle-bg.png');
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 1;
  z-index: 0;
}

.smart-actions-hero-overlay {
  position: absolute;
  inset: 0;
  background: transparent;
  z-index: 1;
}

.hero-card {
  position: absolute;
  width: min(17.5vw, 248px);
  z-index: 20;
  border: 1px solid rgba(47, 127, 121, 0.22);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  box-shadow:
    0 14px 32px rgba(15, 23, 42, 0.12),
    0 1px 0 rgba(255, 255, 255, 0.7) inset;
  transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
}

.hero-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 14px;
  right: 14px;
  height: 3px;
  border-radius: 999px;
  opacity: 0.95;
}

.hero-card:hover {
  transform: translateY(-3px);
  box-shadow:
    0 18px 36px rgba(15, 23, 42, 0.16),
    0 1px 0 rgba(255, 255, 255, 0.75) inset;
}

.hero-accent-green::before {
  background: linear-gradient(90deg, #2f7f79 0%, #1f9d89 100%);
}

.hero-accent-orange::before {
  background: linear-gradient(90deg, #f0aa3c 0%, #f59e0b 100%);
}

.hero-primary-card {
  border-color: rgba(47, 127, 121, 0.3);
  box-shadow:
    0 18px 38px rgba(15, 23, 42, 0.16),
    0 1px 0 rgba(255, 255, 255, 0.75) inset;
}

.hero-temp-card {
  width: min(22vw, 316px);
}

.hero-trend-card {
  width: min(30vw, 455px);
}

.hero-top-left {
  top: 16%;
  left: 6%;
}

.hero-top-right {
  top: 8%;
  right: 7%;
}

.hero-bottom-left {
  top: 68%;
  left: 5%;
}

.hero-mid-right {
  top: 2%;
  right: 42%;
}

.hero-mid-left {
  top: 73%;
  left: 30%;
}

.hero-bottom-mid {
  top: 77%;
  left: 48%;
}

.hero-bottom-right {
  top: 34%;
  right: 4%;
}

.hero-center-quote {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(56vw, 700px);
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 40;
}

@media (max-width: 1100px) {
  .hero-card {
    position: static;
    width: 100%;
  }

  .hero-center-quote {
    position: static;
    width: 100%;
    transform: none;
    margin-top: 1rem;
    margin-bottom: 1rem;
  }
}

.float-card {
  animation: cardFloat 5.2s ease-in-out infinite;
}

.float-card-delay {
  animation: cardFloat 6.1s ease-in-out infinite;
}

.float-card-soft {
  animation: cardFloat 7s ease-in-out infinite;
}

.flip-card {
  perspective: 1000px;
}

.flip-card-inner {
  position: relative;
  height: 100%;
  width: 100%;
  transform-style: preserve-3d;
  transition: transform 0.35s ease;
}

.flip-card-inner.is-flipped {
  transform: rotateY(180deg);
}

.flip-card-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
}

.flip-card-front,
.flip-card-back {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.flip-card-back {
  transform: rotateY(180deg);
}

.hero-fade-enter-active,
.hero-fade-leave-active {
  transition: opacity 380ms ease;
}

.hero-fade-enter-from,
.hero-fade-leave-to {
  opacity: 0;
}

.hero-fade-leave-active {
  position: absolute;
  inset: 0;
  z-index: 60;
}

.page-overlay-fade-enter-active,
.page-overlay-fade-leave-active {
  transition: opacity 320ms ease;
}

.page-overlay-fade-enter-from,
.page-overlay-fade-leave-to {
  opacity: 0;
}

@keyframes cardFloat {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}
</style>
