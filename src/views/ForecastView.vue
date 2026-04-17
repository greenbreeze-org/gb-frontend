<script setup lang="ts">
// Imports
import { computed, onMounted, ref, watch } from 'vue'

import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
const showRecommendations = ref(false)

// Predefined options
const houseMaterialOptions = [
  { value: 'brick-veneer', label: 'Brick Veneer' },
  { value: 'double-brick', label: 'Double Brick' },
  { value: 'weatherboard-timber', label: 'Weatherboard / Timber' },
  { value: 'lightweight-cladding', label: 'Lightweight Cladding (Fiber Cement / Metal)' },
]

const deviceOptions = [
  { value: 'ac_split', label: 'Air Conditioner (Split System)' },
  { value: 'ac_ducted', label: 'Air Conditioner (Ducted)' },
  { value: 'evaporative', label: 'Evaporative Cooler' },
  { value: 'fan_ceiling', label: 'Ceiling Fan' },
  { value: 'fan_portable', label: 'Portable Fan' },
  { value: 'heat_pump', label: 'Heat Pump Heater' },
  { value: 'electric_heater', label: 'Electric Heater' },
  { value: 'gas_heater', label: 'Gas Heater' },
]

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
const isHouseMaterialValid = computed(() => Boolean(houseMaterial.value))
const isDeviceSelectionValid = computed(() => selectedDevices.value.length > 0)
const setupReady = computed(
  () => isLocationValid.value && isHouseMaterialValid.value && isDeviceSelectionValid.value,
)
const canShowWeatherBlocks = computed(() => setupReady.value)
const locationError = computed(() =>
  isLocationValid.value ? '' : 'Location unavailable. Please enter a valid Victoria postcode.',
)
const houseMaterialError = computed(() =>
  isHouseMaterialValid.value ? '' : 'Please select a house material.',
)
const devicesError = computed(() =>
  isDeviceSelectionValid.value ? '' : 'Please select at least one heating/cooling device.',
)
const recommendationCards = [
  {
    title: 'Pre-cool / Pre-heat Before Peak',
    detail:
      'Use your main system 30-45 minutes before peak demand windows, then reduce intensity during peak hours.',
  },
  {
    title: 'Use Fans First for Comfort',
    detail:
      'Run ceiling or portable fans before increasing AC/heater setpoint to cut unnecessary electricity use.',
  },
  {
    title: 'Block Heat Gain in Daytime',
    detail:
      'Close blinds/curtains on sunny sides and keep doors closed for rooms not in use to hold indoor comfort.',
  },
  {
    title: 'Shift Heavy Appliance Use',
    detail:
      'Move laundry, dishwasher, and other high-load usage away from evening peak periods when possible.',
  },
]

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

// Device toggle
const toggleDevice = (value: string, checked: boolean) => {
  if (checked) {
    if (!selectedDevices.value.includes(value)) {
      selectedDevices.value = [...selectedDevices.value, value]
    }
    return
  }

  selectedDevices.value = selectedDevices.value.filter((item) => item !== value)
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
  [postcode, locationStatus, locationCoords, houseMaterial, selectedDevices],
  async () => {
    if (setupReady.value) {
      await loadForecastBlocks()
      return
    }

    // Hide blocks and clear stale data until required location/postcode is available.
    forecastSnapshot.value = null
    weatherError.value = ''
    showRecommendations.value = false
  },
  { deep: true },
)
</script>

<template>
  <!-- Page wrapper -->
  <div class="min-h-screen bg-white text-slate-900">
    <!-- Shared navbar -->
    <SiteHeader />

    <section
        class="relative flex w-full min-h-[320px] items-center justify-center overflow-hidden px-6 py-10 lg:h-[600px] lg:px-10"
        style="
          background-image: url('/forecast.jpg');
          background-size: 100% 100%;
          background-repeat: no-repeat;
          background-position: center top;
        "
      >
        <div class="text-center">
          <h1 class="text-3xl font-bold tracking-tight text-white lg:text-8xl">Forecast</h1>
          <p class="mt-3 text-[30px] text-white">
            Set your household context for smarter heating and cooling guidance.
          </p>
        </div>
      </section>

    <!-- Forecast page shell -->
    <main class="mx-auto max-w-7xl space-y-8 px-6 py-10 lg:px-10">
      <!-- User setup form -->
      <section class="ml-[100px] max-w-5xl rounded-2xl border border-slate-200 p-8 lg:p-10">
        <div class="mx-auto max-w-4xl">
          <div class="flex flex-wrap items-center gap-3 justify-center mb-[40px]">
            <h2 class="text-3xl font-bold">User Setup</h2>
            <span
              v-if="locationStatus === 'granted'"
              class="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white"
            >
              Location Granted
            </span>
            <span
              v-else-if="locationStatus === 'denied' || locationStatus === 'unavailable'"
              class="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white"
            >
              Location Denied
            </span>
            <span
              v-else
              class="rounded-md bg-slate-600 px-3 py-1.5 text-sm font-semibold text-white"
            >
              Checking Location...
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div class="mt-6 space-y-2">
            <Label for="house-material" class="text-base font-semibold"
              >House Material (Detached House)</Label
            >
            <select
              id="house-material"
              v-model="houseMaterial"
              class="border-input focus-visible:ring-ring/50 h-11 w-full rounded-md border bg-white px-4 text-base outline-none focus-visible:ring-[3px]"
            >
              <option value="" disabled>Select house material</option>
              <option
                v-for="option in houseMaterialOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
            <p v-if="houseMaterialError" class="text-sm text-red-600">{{ houseMaterialError }}</p>
          </div>

          <div
            v-if="locationStatus === 'denied' || locationStatus === 'unavailable'"
            class="mt-6 space-y-2"
          >
            <Label for="postcode" class="text-base font-semibold"
              >Postcode (VIC only, required when location is denied)</Label
            >
            <Input
              id="postcode"
              v-model="postcode"
              placeholder="e.g. 3000"
              class="h-11 text-base"
            />
            <p v-if="locationError" class="text-sm text-red-600">{{ locationError }}</p>
          </div>
          </div>

          

          <div class="mt-6 space-y-3">
            <Label class="text-base font-semibold">Available Heating/Cooling Devices</Label>
            <div class="grid gap-3 md:grid-cols-2">
              <div
                v-for="device in deviceOptions"
                :key="device.value"
                class="flex items-center gap-3 rounded-md py-1"
              >
                <Checkbox
                  :id="device.value"
                  :model-value="selectedDevices.includes(device.value)"
                  @update:model-value="(checked) => toggleDevice(device.value, Boolean(checked))"
                />
                <Label :for="device.value" class="text-base">{{ device.label }}</Label>
              </div>
            </div>
            <p v-if="devicesError" class="text-sm text-red-600">{{ devicesError }}</p>
          </div>

          <div
            v-if="setupReady"
            class="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            Form has been validated.
          </div>

          <div v-else class="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Form is yet to be validated.
          </div>
        </div>
      </section>

      <!-- Weather + Heatwave row -->
      <section v-if="canShowWeatherBlocks" class="grid gap-6 lg:grid-cols-2">
        <!-- Weather block -->
        <article class="rounded-2xl border border-slate-200 p-6 lg:p-7">
          <h3 class="text-2xl font-bold">Weather Forecast</h3>
          <p class="mt-2 text-[16px]">Current and day-ahead temperature view for planning.</p>

          <div v-if="weatherLoading" class="mt-5 text-sm text-slate-600">
            Loading weather data...
          </div>

          <div v-else-if="forecastSnapshot" class="mt-5 space-y-3">
            <p class="text-sm font-semibold text-slate-600">{{ forecastSnapshot.locationLabel }}</p>
            <p class="text-2xl font-bold">
              Current: {{ forecastSnapshot.currentTempC.toFixed(1) }}°C
            </p>
            <p class="text-[17px]">
              Today: {{ forecastSnapshot.todayMinC.toFixed(1) }}°C -
              {{ forecastSnapshot.todayMaxC.toFixed(1) }}°C
            </p>
            <p class="text-[17px]">
              Tomorrow max: {{ forecastSnapshot.tomorrowMaxC.toFixed(1) }}°C
              <span class="text-slate-500">({{ tomorrowDateLabel }})</span>
            </p>
          </div>

          <p v-else-if="weatherError" class="mt-5 text-sm text-red-600">{{ weatherError }}</p>
        </article>

        <!-- Heatwave alert block -->
        <article class="rounded-2xl border border-slate-200 p-6 lg:p-7">
          <h3 class="text-2xl font-bold">Heatwave Alert</h3>
          <p class="mt-2 text-[16px]">Advance warning based on tomorrow's forecast maximum.</p>

          <div
            v-if="weatherLoading"
            class="mt-5 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700"
          >
            Checking forecast for heatwave conditions...
          </div>

          <div
            v-else-if="forecastSnapshot && isHeatwaveTomorrow"
            class="mt-5 rounded-xl bg-red-100 px-4 py-3 text-[15px] text-red-800"
          >
            Heatwave expected on {{ tomorrowDateLabel }} ({{
              forecastSnapshot.tomorrowMaxC.toFixed(1)
            }}°C). Prepare your home today.
          </div>

          <div
            v-else-if="forecastSnapshot"
            class="mt-5 rounded-xl bg-emerald-100 px-4 py-3 text-[15px] text-emerald-800"
          >
            No heatwave alert for {{ tomorrowDateLabel }}. Forecast max is
            {{ forecastSnapshot.tomorrowMaxC.toFixed(1) }}°C.
          </div>

          <p v-else-if="weatherError" class="mt-5 text-sm text-red-600">{{ weatherError }}</p>

          <div class="mt-5">
            <Button class="electric h-10 px-4 text-sm" @click="showRecommendations = true"
              >See Recommendations</Button
            >
          </div>
        </article>
      </section>

      <section
        v-else
        class="rounded-2xl max-w-5xl ml-[100px] border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-700"
      >
        <p class="text-base">
          Weather and heatwave insights will appear once the form is fully validated.
        </p>
      </section>

      <!-- Recommendations block -->
      <section v-if="showRecommendations" class="rounded-2xl border border-slate-200 p-6 lg:p-7">
        <h3 class="text-2xl font-bold">Cooling & Heating Recommendations</h3>

        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <article
            v-for="item in recommendationCards"
            :key="item.title"
            class="rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <h4 class="text-lg font-semibold text-emerald-800">{{ item.title }}</h4>
            <p class="mt-2 text-sm text-slate-700">{{ item.detail }}</p>
          </article>
        </div>
      </section>
    </main>

    <!-- Shared footer -->
    <SiteFooter />
  </div>
</template>
