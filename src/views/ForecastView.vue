<script setup lang="ts">
// Imports
import { computed, onMounted, ref, watch } from 'vue'
import {
  AlertTriangle,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  Sun,
  Wind,
} from 'lucide-vue-next'

import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
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

const conditionLabel = computed(() => {
  if (!forecastSnapshot.value) return 'Weather'
  if (isHeatwaveTomorrow.value) return 'Heatwave Risk'
  if (displayWindKph.value >= 28) return 'Windy Conditions'
  if (displayHumidityPct.value >= 75) return 'Humid Conditions'
  return 'Mostly Clear'
})

const currentConditionIcon = computed(() => {
  if (!forecastSnapshot.value) return CloudSun
  if (isHeatwaveTomorrow.value) return CloudLightning
  if (displayHumidityPct.value >= 75) return CloudRain
  return Sun
})

const hourlyTiles = computed(() => {
  const snapshot = forecastSnapshot.value
  if (!snapshot) return []

  const base = Math.round(snapshot.currentTempC)
  const labels = ['Now', '12:00', '15:00', '18:00', '21:00', '00:00']
  const values = [
    base,
    Math.max(base + 1, Math.round((base + snapshot.todayMaxC) / 2)),
    Math.round(snapshot.todayMaxC),
    Math.round((snapshot.todayMaxC + snapshot.todayMinC) / 2),
    Math.max(Math.round(snapshot.todayMinC + 2), base - 1),
    Math.round(snapshot.todayMinC + 1),
  ]

  return labels.map((label, index) => ({
    label,
    temp: values[index],
    icon:
      isHeatwaveTomorrow.value && index >= 2
        ? CloudLightning
        : displayHumidityPct.value >= 75 && index >= 3
          ? CloudRain
          : CloudSun,
  }))
})

const displayHumidityPct = computed(() => {
  if (!forecastSnapshot.value) return 0
  const spread = Math.max(0, forecastSnapshot.value.todayMaxC - forecastSnapshot.value.todayMinC)
  return Math.max(44, Math.min(88, Math.round(82 - spread * 2.3)))
})

const displayWindKph = computed(() => {
  if (!forecastSnapshot.value) return 0
  const spread = Math.max(0, forecastSnapshot.value.todayMaxC - forecastSnapshot.value.todayMinC)
  const deltaFromCurrent = Math.abs(forecastSnapshot.value.todayMaxC - forecastSnapshot.value.currentTempC)
  return Math.max(8, Math.min(38, Math.round(10 + spread * 1.4 + deltaFromCurrent * 1.2)))
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
      <section class="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm lg:p-5">
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
      </section>

      <section
        v-if="showSetupAlert"
        class="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800"
      >
        <p class="text-sm font-semibold lg:text-base">
          Setup required: location permission is unavailable. Add a valid VIC postcode below.
        </p>
      </section>

      <p v-if="locationError" class="text-sm font-medium text-red-600">{{ locationError }}</p>

      <section
        v-if="canShowWeatherBlocks"
        class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:p-6"
      >
        <div class="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <article class="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <p class="text-sm text-slate-500">{{ forecastSnapshot?.locationLabel }}</p>
            <div class="mt-4 flex items-center justify-between">
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
              <component :is="currentConditionIcon" class="h-20 w-20 text-[var(--gb-grid)]" />
            </div>
          </article>

          <article class="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-500">10-Day Focus</h3>
            <div class="mt-4 space-y-3 text-sm">
              <div class="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                <span class="text-slate-600">Today</span>
                <span class="font-semibold text-slate-900">
                  {{ forecastSnapshot?.todayMaxC.toFixed(0) }}° /
                  {{ forecastSnapshot?.todayMinC.toFixed(0) }}°
                </span>
              </div>
              <div class="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                <span class="text-slate-600">Tomorrow</span>
                <span class="font-semibold text-slate-900">
                  {{ forecastSnapshot?.tomorrowMaxC.toFixed(0) }}° max
                </span>
              </div>
              <div class="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                <span class="text-slate-600">Heatwave status</span>
                <span :class="isHeatwaveTomorrow ? 'text-rose-500' : 'text-emerald-600'" class="font-semibold">
                  {{ isHeatwaveTomorrow ? 'Alert' : 'Normal' }}
                </span>
              </div>
            </div>
          </article>
        </div>

        <article class="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <h3 class="text-sm font-semibold uppercase tracking-widest text-slate-500">Hourly Forecast</h3>
          <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
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
        </article>

        <div class="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr_1.1fr]">
          <article class="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <div class="flex items-center gap-2 text-slate-500">
              <Droplets class="h-4 w-4" />
              <p class="text-sm font-semibold uppercase tracking-wider">Humidity</p>
            </div>
            <p class="mt-3 text-4xl font-bold text-slate-900">{{ displayHumidityPct }}%</p>
          </article>

          <article class="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <div class="flex items-center gap-2 text-slate-500">
              <Wind class="h-4 w-4" />
              <p class="text-sm font-semibold uppercase tracking-wider">Wind</p>
            </div>
            <p class="mt-3 text-4xl font-bold text-slate-900">{{ displayWindKph }}</p>
            <p class="text-slate-500">km/h</p>
          </article>

          <article class="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
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
          </article>
        </div>
      </section>

      <section
        v-else
        class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-700"
      >
        <p class="text-base">
          Weather and heatwave insights will appear once location setup is complete.
        </p>
      </section>
    </main>

    <SiteFooter />
  </div>
</template>
