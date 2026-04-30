<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { DotLottieVue } from '@lottiefiles/dotlottie-vue'
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
import {
  AlertTriangle,
  Droplets,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-vue-next'

import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchForecastSnapshot, type ForecastSnapshot } from '@/services/forecast'

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

const STORAGE_KEY = 'forecast_setup_v2'

const postcode = ref('')
const houseMaterial = ref('')
const selectedDevices = ref<string[]>([])

const locationStatus = ref<'checking' | 'granted' | 'denied' | 'unavailable'>('checking')
const locationCoords = ref<{ lat: number; lon: number } | null>(null)

const weatherLoading = ref(false)
const weatherError = ref('')
const forecastSnapshot = ref<ForecastSnapshot | null>(null)
const HEATWAVE_THRESHOLD_C = 35
const FORCE_NIGHT_VIDEO = false

const hasValidVicPostcode = computed(() => {
  const code = Number(postcode.value.trim())
  if (Number.isNaN(code)) return false
  return (code >= 3000 && code <= 3999) || (code >= 8000 && code <= 8999)
})

const hasBrowserLocation = computed(() => Boolean(locationCoords.value))

const isLocationValid = computed(() => {
  const usingBrowserLocation = locationStatus.value === 'granted' && hasBrowserLocation.value
  const usingPostcode =
    (locationStatus.value === 'denied' || locationStatus.value === 'unavailable') &&
    hasValidVicPostcode.value

  return usingBrowserLocation || usingPostcode
})

const setupReady = computed(() => isLocationValid.value)
const canShowWeatherBlocks = computed(() => setupReady.value)

const showSetupAlert = computed(
  () => locationStatus.value === 'denied' || locationStatus.value === 'unavailable',
)

const restoreSetupFromSession = () => {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return

  try {
    const parsed = JSON.parse(raw) as {
      postcode?: string
      houseMaterial?: string
      selectedDevices?: string[]
    }

    postcode.value = parsed.postcode ?? ''
    houseMaterial.value = parsed.houseMaterial ?? ''
    selectedDevices.value = Array.isArray(parsed.selectedDevices) ? parsed.selectedDevices : []
  } catch {
    sessionStorage.removeItem(STORAGE_KEY)
  }
}

const persistSetupToSession = () => {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      postcode: postcode.value,
      houseMaterial: houseMaterial.value,
      selectedDevices: selectedDevices.value,
    }),
  )
}

watch([postcode, houseMaterial, selectedDevices], persistSetupToSession, { deep: true })

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
  } catch {
    locationStatus.value = 'denied'
    locationCoords.value = null
  }
}

const checkBrowserLocationPermission = async () => {
  if (!navigator.geolocation) {
    locationStatus.value = 'unavailable'
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

const weatherCodeToIcon = (code: number, isDay: boolean) => {
  if (code === 0) return isDay ? 'wi:day-sunny' : 'wi:night-clear'
  if (code === 1) return isDay ? 'wi:day-sunny-overcast' : 'wi:night-alt-partly-cloudy'
  if ([2, 3].includes(code)) return isDay ? 'wi:day-cloudy' : 'wi:night-alt-cloudy'
  if ([45, 48].includes(code)) return 'wi:fog'
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return 'wi:rain'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'wi:snow'
  if ([95, 96, 99].includes(code)) return 'wi:thunderstorm'
  return isDay ? 'wi:day-cloudy' : 'wi:night-alt-cloudy'
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

const dashboardToneClass = computed(() => {
  switch (moodKey.value) {
    case 'storm':
      return 'from-slate-50 via-indigo-50 to-cyan-50'
    case 'rain':
      return 'from-slate-50 via-sky-50 to-cyan-50'
    case 'snow':
      return 'from-slate-50 via-blue-50 to-indigo-50'
    case 'fog':
      return 'from-slate-100 via-slate-50 to-sky-50'
    case 'cloud':
      return 'from-slate-50 via-cyan-50 to-slate-50'
    case 'night':
      return 'from-slate-100 via-indigo-50 to-slate-50'
    default:
      return 'from-amber-50 via-white to-cyan-50'
  }
})

const moodVideoSrc = computed(() => {
  switch (moodKey.value) {
    case 'storm':
      return '/weather-bg/storm.mp4'
    case 'rain':
      return '/weather-bg/rain.mp4'
    case 'snow':
      return '/weather-bg/snow.mp4'
    case 'fog':
      return '/weather-bg/cloud.mp4'
    case 'cloud':
      return '/weather-bg/cloud.mp4'
    case 'night':
      return '/weather-bg/night.mp4'
    default:
      return '/weather-bg/sun.mp4'
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
  return 'text-violet-400'
})

const uvRing = computed(() => {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(11, uvValue.value))
  const progress = clamped / 11
  return {
    radius,
    circumference,
    dashOffset: circumference * (1 - progress),
  }
})

const conditionLabel = computed(() => {
  if (!forecastSnapshot.value) return 'Weather'
  if (isHeatwaveTomorrow.value && [95, 96, 99].includes(forecastSnapshot.value.weatherCode)) {
    return 'Severe Heat + Storm Risk'
  }
  return weatherCodeToLabel(forecastSnapshot.value.weatherCode, forecastSnapshot.value.isDay)
})

const hourlyTiles = computed(() => {
  const snapshot = forecastSnapshot.value
  if (!snapshot || !snapshot.hourly.length) return []

  return snapshot.hourly.slice(0, 6).map((entry, index) => {
    const date = new Date(entry.time)
    const label =
      index === 0
        ? 'Now'
        : date.toLocaleTimeString('en-AU', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })

    return {
      label,
      temp: Math.round(entry.tempC),
      icon: weatherCodeToIcon(entry.weatherCode, entry.isDay),
    }
  })
})

const weeklyRows = computed(() => {
  const weekly = forecastSnapshot.value?.weekly ?? []
  return weekly.slice(0, 7).map((item, index) => {
    const date = new Date(item.date)
    const weekday = Number.isNaN(date.getTime())
      ? `Day ${index + 1}`
      : date.toLocaleDateString('en-AU', { weekday: 'short' })
    const dayNum = Number.isNaN(date.getTime()) ? '--' : date.toLocaleDateString('en-AU', { day: '2-digit' })
    const month = Number.isNaN(date.getTime()) ? '--' : date.toLocaleDateString('en-AU', { month: 'short' })
    return {
      weekday,
      dayNum,
      month,
      max: Math.round(item.maxC),
      min: Math.round(item.minC),
      icon: weatherCodeToIcon(item.weatherCode, true),
    }
  })
})

const next12Hourly = computed(() => {
  const source = forecastSnapshot.value?.hourly ?? []
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

const hourlyLabels = computed(() =>
  next12Hourly.value.map((h) => {
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

const hourlyTemps = computed(() => next12Hourly.value.map((h) => Math.round(h.tempC)))
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
      grid: { display: false },
      border: { display: false },
      ticks: {
        color: 'rgba(255,255,255,0.9)',
        font: { weight: 'bold' },
        autoSkip: false,
        maxRotation: 0,
        minRotation: 0,
        callback: (value, index) => {
          const label = hourlyLabels.value[index] ?? ''
          const temp = hourlyTemps.value[index]
          return temp !== undefined ? [label, `${temp}°`] : label
        },
      },
    },
    y: {
      display: false,
      min: hourlyTemps.value.length ? Math.min(...hourlyTemps.value) - 1 : undefined,
      max: hourlyTemps.value.length ? Math.max(...hourlyTemps.value) + 1 : undefined,
      grid: { display: false },
      border: { display: false },
    },
  },
}))

const displayHumidityPct = computed(() => forecastSnapshot.value?.humidityPct ?? 0)
const displayWindKph = computed(() => Math.round(forecastSnapshot.value?.windKph ?? 0))

const loadForecastBlocks = async () => {
  if (!canShowWeatherBlocks.value) {
    forecastSnapshot.value = null
    weatherError.value = ''
    weatherLoading.value = false
    return
  }

  weatherLoading.value = true
  weatherError.value = ''

  try {
    const postcodeValue =
      locationStatus.value === 'denied' || locationStatus.value === 'unavailable'
        ? postcode.value.trim()
        : undefined

    const snapshot = await fetchForecastSnapshot({
      lat: locationCoords.value?.lat,
      lon: locationCoords.value?.lon,
      postcode: postcodeValue && hasValidVicPostcode.value ? postcodeValue : undefined,
    })

    forecastSnapshot.value = snapshot
  } catch {
    weatherError.value = 'Unable to load weather right now. Please try again.'
  } finally {
    weatherLoading.value = false
  }
}

onMounted(async () => {
  restoreSetupFromSession()
  await checkBrowserLocationPermission()
  if (canShowWeatherBlocks.value) {
    await loadForecastBlocks()
  }
})

watch(
  [postcode, locationStatus, locationCoords],
  async () => {
    if (setupReady.value) {
      await loadForecastBlocks()
      return
    }

    forecastSnapshot.value = null
    weatherError.value = ''
  },
  { deep: true },
)
</script>

<template>
  <div class="min-h-screen bg-white text-slate-900">
    <SiteHeader />

    <main class="w-full">
      <div
        v-if="locationStatus === 'denied' || locationStatus === 'unavailable'"
        class="mx-auto w-full max-w-[1800px] space-y-2"
      >
        <Label for="postcode" class="text-sm font-semibold text-slate-700">Postcode (VIC fallback)</Label>
        <Input id="postcode" v-model="postcode" placeholder="e.g. 3000" class="h-11 bg-white text-base" />
      </div>

      <Alert
        v-if="showSetupAlert"
        variant="destructive"
        class="rounded-2xl border-red-200 bg-red-50 px-5 py-4 text-red-800"
      >
        <AlertTriangle class="h-4 w-4" />
        <AlertDescription class="font-semibold lg:text-base">
          Location permission is unavailable. Add a valid VIC postcode below.
        </AlertDescription>
      </Alert>

      <div class="grid items-start gap-0 lg:grid-cols-[2.05fr_0.85fr]">
      <Card
        v-if="canShowWeatherBlocks"
        :class="dashboardToneClass"
        class="relative w-full overflow-hidden rounded-none border-slate-200 bg-gradient-to-br p-6 shadow-sm lg:p-8"
      >
        <video
          class="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-100"
          :src="moodVideoSrc"
          autoplay
          muted
          loop
          playsinline
        />

        <div class="relative z-10 grid gap-3 lg:grid-cols-[1.6fr_1fr_1fr]">
          <Card class="rounded-2xl border border-white/18 bg-black/24 p-4 shadow-[0_12px_22px_rgba(15,23,42,0.22)] lg:p-5">
            <CardHeader class="p-0">
              <CardTitle
                class="rounded-lg bg-black/20 px-3 py-1.5 text-center text-sm font-semibold tracking-wide text-white"
              >
                {{ forecastSnapshot?.locationLabel }}
              </CardTitle>
            </CardHeader>
            <CardContent class="mt-3 flex min-h-[140px] items-center justify-center p-0 text-center">
              <div>
                <p class="text-6xl font-bold leading-none text-white lg:text-7xl">
                  {{ forecastSnapshot?.currentTempC.toFixed(0) }}°
                </p>
                <p class="mt-1 text-xl text-white">{{ conditionLabel }}</p>
                <p class="mt-1 text-sm text-white/80">
                  Today: {{ forecastSnapshot?.todayMinC.toFixed(0) }}° / {{ forecastSnapshot?.todayMaxC.toFixed(0) }}°
                </p>
              </div>
            </CardContent>
          </Card>

          <Card :class="glassCardClass" class="rounded-2xl border p-4">
            <CardHeader class="p-0">
              <CardTitle class="text-sm font-bold uppercase tracking-widest text-white/85">Conditions</CardTitle>
            </CardHeader>
            <CardContent class="mt-2 grid grid-cols-2 gap-3 p-0 text-sm">
              <div :class="glassTileClass" class="rounded-lg border px-3 py-3 text-center">
                <p class="text-sm font-bold text-white/85">Today</p>
                <Thermometer class="mx-auto mt-1 h-5 w-5 text-white" />
                <p class="mt-2 text-base font-bold text-white">
                  {{ forecastSnapshot?.todayMaxC.toFixed(0) }}° / {{ forecastSnapshot?.todayMinC.toFixed(0) }}°
                </p>
              </div>
              <div :class="glassTileClass" class="rounded-lg border px-3 py-3 text-center">
                <p class="text-sm font-bold text-white/85">Tomorrow</p>
                <Sun class="mx-auto mt-1 h-5 w-5 text-white" />
                <p class="mt-2 text-base font-bold text-white">{{ forecastSnapshot?.tomorrowMaxC.toFixed(0) }}° max</p>
              </div>
              <div :class="glassTileClass" class="rounded-lg border px-3 py-3 text-center">
                <p class="text-sm font-bold text-white/85">Humidity</p>
                <Droplets class="mx-auto mt-1 h-5 w-5 text-white" />
                <p class="mt-2 text-base font-bold text-white">{{ displayHumidityPct }}%</p>
              </div>
              <div :class="glassTileClass" class="rounded-lg border px-3 py-3 text-center">
                <p class="text-sm font-bold text-white/85">Wind</p>
                <Wind class="mx-auto mt-1 h-5 w-5 text-white" />
                <p class="mt-2 text-base font-bold text-white">{{ displayWindKph }} km/h</p>
              </div>
            </CardContent>
          </Card>

          <Card :class="glassCardClass" class="rounded-2xl border p-4">
            <CardHeader class="p-0">
              <CardTitle class="text-sm font-semibold uppercase tracking-widest text-white/80">Alert Status</CardTitle>
            </CardHeader>
            <CardContent class="mt-2 p-0">
              <div class="space-y-2">
                <div :class="glassTileClass" class="rounded-lg border px-3 py-2 text-center">
                  <p :class="isHeatwaveTomorrow ? 'text-rose-300' : 'text-emerald-300'" class="text-lg font-semibold">
                    {{ isHeatwaveTomorrow ? 'Heatwave Alert' : 'No Heatwave Alert' }}
                  </p>
                  <p class="mt-1 text-xs text-white/80">
                    {{ tomorrowDateLabel }} · Max {{ forecastSnapshot?.tomorrowMaxC.toFixed(1) }}°C
                  </p>
                </div>
                <div :class="glassTileClass" class="rounded-lg border px-4 py-4">
                  <div class="flex items-center justify-center gap-3">
                    <p class="text-lg font-bold text-white/95">UV Index</p>
                    <div class="h-32 w-32">
                      <svg viewBox="0 0 100 100" class="h-full w-full">
                        <circle cx="50" cy="50" :r="uvRing.radius" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="8" />
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
                        <text x="50" y="47" text-anchor="middle" class="fill-white text-[14px] font-bold">
                          {{ uvValue.toFixed(1) }}
                        </text>
                        <text x="50" y="61" text-anchor="middle" class="fill-white/90 text-[11px] font-bold">
                          {{ uvLabel }}
                        </text>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div class="relative z-10 mt-4 grid gap-4 lg:grid-cols-[1.2fr_2.08fr]">
          <Card :class="glassCardClass" class="rounded-2xl border p-4">
            <CardHeader class="p-0">
              <CardTitle class="text-sm font-semibold uppercase tracking-widest text-white/85">7-Day Forecast</CardTitle>
            </CardHeader>
            <CardContent class="mt-2 space-y-1.5 p-0">
              <div
                v-for="day in weeklyRows"
                :key="`${day.weekday}-${day.dayNum}`"
                :class="glassTileClass"
                class="flex items-center justify-between rounded-lg border px-3 py-1.5"
              >
                <div class="flex items-center gap-2">
                  <Icon :icon="day.icon" class="h-5 w-5 text-white" />
                  <span class="text-sm font-bold text-white">{{ day.max }}° / {{ day.min }}°</span>
                </div>
                <span class="text-sm font-bold text-white/90">{{ day.dayNum }} {{ day.month }}, {{ day.weekday }}</span>
              </div>
            </CardContent>
          </Card>

          <Card :class="glassCardClass" class="rounded-2xl border p-4">
            <CardHeader class="p-0">
              <CardTitle class="text-sm font-semibold uppercase tracking-widest text-white/85">Next 12 Hours Trend</CardTitle>
            </CardHeader>
            <CardContent class="mt-2 h-56 p-0">
              <Line :data="hourlyChartData" :options="hourlyChartOptions" />
            </CardContent>
          </Card>
        </div>
      </Card>

      <Card
        v-if="canShowWeatherBlocks"
        class="rounded-none border border-slate-200 text-center  bg-white p-5 text-slate-900 lg:sticky"
      >
        <DotLottieVue
              class="-translate-x-15"
              src="/lottie/forecast/two-people-thinking.lottie"
              autoplay
              loop
              style="width: 130%; height: 150%"
          />

        <CardContent class="mt-3 space-y-3 p-0">
          <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <p class="text-lg font-bold text-slate-900">Want to know what actions to take next?</p>
            <p class="mt-1 text-sm text-slate-600">
              Visit Impact Lab for personalized steps based on forecast risk and your home profile.
            </p>
          </div>
          <a
            href="/awareness"
            class="block rounded-xl border border-slate-300 bg-slate-900 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-800"
          >
            Go To Impact Lab
          </a>
        </CardContent>
      </Card>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped></style>
