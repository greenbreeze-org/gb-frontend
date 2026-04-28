<script setup lang="ts">
// Imports
import { computed, onMounted, ref, watch } from 'vue'
import {
  AlertTriangle,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Moon,
  Sun,
  Wind,
} from 'lucide-vue-next'

import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchForecastSnapshot, type ForecastSnapshot } from '@/services/forecast'

// Storage key (session only: survives refresh, resets on new tab)
const STORAGE_KEY = 'forecast_setup_v2'

// Forecast setup form state
const postcode = ref('')
const houseMaterial = ref('')
const selectedDevices = ref<string[]>([])

// Browser location state (no manual location button)
const locationStatus = ref<'checking' | 'granted' | 'denied' | 'unavailable'>('checking')
const locationCoords = ref<{ lat: number; lon: number } | null>(null)

// Weather and heatwave state
const weatherLoading = ref(false)
const weatherError = ref('')
const forecastSnapshot = ref<ForecastSnapshot | null>(null)
const HEATWAVE_THRESHOLD_C = 35

// Helpers
const hasValidVicPostcode = computed(() => {
  const code = Number(postcode.value.trim())
  if (Number.isNaN(code)) return false

  // Victoria postcodes are generally 3000-3999 and 8000-8999.
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
const locationError = computed(() =>
  isLocationValid.value ? '' : 'Location unavailable. Please enter a valid Victoria postcode.',
)
const showSetupAlert = computed(
  () => locationStatus.value === 'denied' || locationStatus.value === 'unavailable',
)

// Session storage persistence
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

// Browser geolocation permission flow (auto on page visit)
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

    // 'prompt' state: requesting location lets browser show its native permission popup.
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
  if (code === 0) return isDay ? Sun : Moon
  if (code === 1) return isDay ? Sun : Moon
  if ([2, 3].includes(code)) return isDay ? CloudSun : CloudMoon
  if ([45, 48].includes(code)) return CloudSun
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return CloudRain
  if ([71, 73, 75, 77, 85, 86].includes(code)) return CloudSnow
  if ([95, 96, 99].includes(code)) return CloudLightning
  return isDay ? CloudSun : CloudMoon
}

const conditionLabel = computed(() => {
  if (!forecastSnapshot.value) return 'Weather'
  if (isHeatwaveTomorrow.value && [95, 96, 99].includes(forecastSnapshot.value.weatherCode)) {
    return 'Severe Heat + Storm Risk'
  }
  return weatherCodeToLabel(forecastSnapshot.value.weatherCode, forecastSnapshot.value.isDay)
})

const currentConditionIcon = computed(() => {
  if (!forecastSnapshot.value) return CloudSun
  return weatherCodeToIcon(forecastSnapshot.value.weatherCode, forecastSnapshot.value.isDay)
})

const hourlyTiles = computed(() => {
  const snapshot = forecastSnapshot.value
  if (!snapshot) return []
  if (!snapshot.hourly.length) return []

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

const displayHumidityPct = computed(() => {
  return forecastSnapshot.value?.humidityPct ?? 0
})

const displayWindKph = computed(() => {
  return Math.round(forecastSnapshot.value?.windKph ?? 0)
})

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

// Lifecycle
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

    // Hide blocks and clear stale data until required location/postcode is available.
    forecastSnapshot.value = null
    weatherError.value = ''
  },
  { deep: true },
)
</script>

<template>
  <div class="min-h-screen bg-white text-slate-900">
    <SiteHeader />

    <main class="max-w-7xl align mx-auto space-y-5 px-4 py-6 lg:px-8">
      <Card class="rounded-3xl border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm lg:p-5">
        <div class="grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Location Setup</p>
            <p class="mt-2 text-xl font-bold text-slate-900 lg:text-2xl">
              {{ forecastSnapshot?.locationLabel ?? 'Set your location to start forecast insights' }}
            </p>
            <p class="mt-1 text-sm text-slate-600">
              Use browser location or VIC postcode fallback for weather and alert updates.
            </p>
          </div>

          <div class="space-y-2">
            <Label for="postcode" class="text-sm font-semibold text-slate-700">
              Postcode (VIC fallback)
            </Label>
            <Input id="postcode" v-model="postcode" placeholder="e.g. 3000" class="h-11 bg-white text-base" />
            <p class="text-xs text-slate-500">Used when location permission is denied/unavailable.</p>
          </div>
        </div>
      </Card>

      <Alert
        v-if="showSetupAlert"
        variant="destructive"
        class="rounded-2xl border-red-200 bg-red-50 px-5 py-4 text-red-800"
      >
        <AlertTriangle class="h-4 w-4" />
        <AlertTitle>Setup Required</AlertTitle>
        <AlertDescription class="font-semibold lg:text-base">
          Location permission is unavailable. Add a valid VIC postcode below.
        </AlertDescription>
      </Alert>

      <p v-if="locationError" class="text-sm font-medium text-red-600">{{ locationError }}</p>

      <Card
        v-if="canShowWeatherBlocks"
        class="rounded-3xl border-slate-200 bg-white p-4 shadow-sm lg:p-6"
      >
        <div class="mb-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Forecast Dashboard</p>
            <p class="text-sm text-slate-600">Live weather, hourly trend, and alert intelligence</p>
          </div>
          <Badge variant="outline" class="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
            {{ forecastSnapshot?.source === 'backend' ? 'Live Backend' : 'Live Forecast' }}
          </Badge>
        </div>

        <div class="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <Card class="rounded-3xl border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
            <CardHeader class="p-0">
              <CardTitle class="text-sm font-normal text-slate-500">{{ forecastSnapshot?.locationLabel }}</CardTitle>
            </CardHeader>
            <CardContent class="mt-4 p-0">
              <div class="flex items-center justify-between">
              <div>
                <p class="text-6xl font-bold leading-none text-slate-900">
                  {{ forecastSnapshot?.currentTempC.toFixed(0) }}°
                </p>
                <p class="mt-2 text-2xl text-slate-800">{{ conditionLabel }}</p>
                <p class="mt-2 text-sm text-slate-600">
                  Today: {{ forecastSnapshot?.todayMinC.toFixed(0) }}° /
                  {{ forecastSnapshot?.todayMaxC.toFixed(0) }}°
                </p>
              </div>
              <div class="rounded-2xl bg-white p-3 shadow-sm">
                <component :is="currentConditionIcon" class="h-14 w-14 text-[var(--gb-grid)]" />
              </div>
            </div>
            </CardContent>
          </Card>

          <Card class="rounded-3xl border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
            <CardHeader class="p-0">
              <CardTitle class="text-sm font-semibold uppercase tracking-widest text-slate-500">10-Day Focus</CardTitle>
            </CardHeader>
            <CardContent class="mt-4 space-y-3 p-0 text-sm">
              <div class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span class="text-slate-600">Today</span>
                <span class="font-semibold text-slate-900">
                  {{ forecastSnapshot?.todayMaxC.toFixed(0) }}° /
                  {{ forecastSnapshot?.todayMinC.toFixed(0) }}°
                </span>
              </div>
              <div class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span class="text-slate-600">Tomorrow</span>
                <span class="font-semibold text-slate-900">
                  {{ forecastSnapshot?.tomorrowMaxC.toFixed(0) }}° max
                </span>
              </div>
              <div class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span class="text-slate-600">Heatwave status</span>
                <span :class="isHeatwaveTomorrow ? 'text-rose-500' : 'text-emerald-600'" class="font-semibold">
                  {{ isHeatwaveTomorrow ? 'Alert' : 'Normal' }}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card class="mt-5 rounded-3xl border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
          <CardHeader class="p-0">
            <CardTitle class="text-sm font-semibold uppercase tracking-widest text-slate-500">Hourly Forecast</CardTitle>
          </CardHeader>
          <CardContent class="mt-4 p-0">
            <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <div
              v-for="tile in hourlyTiles"
              :key="tile.label"
              class="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm"
            >
              <p class="text-xs font-semibold text-slate-500">{{ tile.label }}</p>
              <component :is="tile.icon" class="mx-auto mt-2 h-6 w-6 text-[var(--gb-grid)]" />
              <p class="mt-2 text-xl font-bold text-slate-900">{{ tile.temp }}°</p>
            </div>
            </div>
          </CardContent>
        </Card>

        <div class="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr_1.1fr]">
          <Card class="rounded-3xl border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
            <CardContent class="p-0">
              <div class="flex items-center gap-2 text-slate-500">
              <Droplets class="h-4 w-4" />
              <p class="text-sm font-semibold uppercase tracking-wider">Humidity</p>
            </div>
            <p class="mt-3 text-4xl font-bold text-slate-900">{{ displayHumidityPct }}%</p>
            </CardContent>
          </Card>

          <Card class="rounded-3xl border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
            <CardContent class="p-0">
              <div class="flex items-center gap-2 text-slate-500">
              <Wind class="h-4 w-4" />
              <p class="text-sm font-semibold uppercase tracking-wider">Wind</p>
            </div>
            <p class="mt-3 text-4xl font-bold text-slate-900">{{ displayWindKph }}</p>
            <p class="text-slate-500">km/h</p>
            </CardContent>
          </Card>

          <Card class="rounded-3xl border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
            <CardContent class="p-0">
              <div class="flex items-center gap-2 text-slate-500">
              <AlertTriangle class="h-4 w-4" />
              <p class="text-sm font-semibold uppercase tracking-wider">Heatwave Alert</p>
            </div>
            <p
              :class="isHeatwaveTomorrow ? 'text-rose-500' : 'text-emerald-600'"
              class="mt-3 text-2xl font-bold"
            >
              {{ isHeatwaveTomorrow ? 'High Risk' : 'No Alert' }}
            </p>
            <p class="mt-2 text-sm text-slate-600">
              {{ tomorrowDateLabel }} · Max {{ forecastSnapshot?.tomorrowMaxC.toFixed(1) }}°C
            </p>
            </CardContent>
          </Card>
        </div>
      </Card>

      <Card
        v-else
        class="rounded-2xl border-dashed border-slate-300 bg-slate-50 p-6 text-slate-700"
      >
        <CardContent class="p-0">
          <p class="text-base">Weather and heatwave insights will appear once location setup is complete.</p>
        </CardContent>
      </Card>
    </main>

    <SiteFooter />
  </div>
</template>
