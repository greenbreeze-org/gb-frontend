<script setup lang="ts">
// Imports
import { computed, onMounted, ref, watch } from 'vue'

import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Storage key (session only: survives refresh, resets on new tab)
const STORAGE_KEY = 'forecast_setup_v2'

// Forecast setup form state
const postcode = ref('')
const houseMaterial = ref('')
const selectedDevices = ref<string[]>([])

// Browser location state (no manual location button)
const locationStatus = ref<'checking' | 'granted' | 'denied' | 'unavailable'>('checking')
const locationCoords = ref<{ lat: number; lon: number } | null>(null)

// Validation state
const errors = ref({
  location: '',
  houseMaterial: '',
  devices: '',
})
const setupReady = ref(false)

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
const hasValidPostcode = computed(() => /^\d{4}$/.test(postcode.value.trim()))
const hasBrowserLocation = computed(() => Boolean(locationCoords.value))

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

// Validation rules
const validateAndContinue = () => {
  setupReady.value = false
  errors.value = {
    location: '',
    houseMaterial: '',
    devices: '',
  }

  if (!hasBrowserLocation.value && !hasValidPostcode.value) {
    errors.value.location = 'Location unavailable. Please enter a valid 4-digit postcode.'
  }

  if (!houseMaterial.value) {
    errors.value.houseMaterial = 'Please select a house material.'
  }

  if (selectedDevices.value.length === 0) {
    errors.value.devices = 'Please select at least one heating/cooling device.'
  }

  if (errors.value.location || errors.value.houseMaterial || errors.value.devices) {
    return
  }

  setupReady.value = true
}

// Lifecycle
onMounted(async () => {
  restoreSetupFromSession()
  await checkBrowserLocationPermission()
})
</script>

<template>
  <!-- Page wrapper -->
  <div class="min-h-screen bg-white text-slate-900">
    <!-- Shared navbar -->
    <SiteHeader />

    <!-- Forecast page shell -->
    <main class="mx-auto max-w-7xl space-y-8 px-6 py-10 lg:px-10">
      <!-- Heading -->
      <section>
        <h1 class="text-3xl font-bold tracking-tight lg:text-5xl">Forecast Setup</h1>
        <p class="mt-3 text-[18px]">
          Set your household context for smarter heating and cooling guidance.
        </p>
      </section>

      <!-- User setup form -->
      <section class="rounded-2xl border border-slate-200 p-8 lg:p-10">
        <div class="mx-auto max-w-4xl">
          <div class="flex flex-wrap items-center gap-3">
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
            <p v-if="errors.houseMaterial" class="text-sm text-red-600">
              {{ errors.houseMaterial }}
            </p>
          </div>

          <div
            v-if="locationStatus === 'denied' || locationStatus === 'unavailable'"
            class="mt-6 space-y-2"
          >
            <Label for="postcode" class="text-base font-semibold"
              >Postcode (required when location is denied)</Label
            >
            <Input
              id="postcode"
              v-model="postcode"
              placeholder="e.g. 3000"
              class="h-11 text-base"
            />
            <p v-if="errors.location" class="text-sm text-red-600">{{ errors.location }}</p>
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
            <p v-if="errors.devices" class="text-sm text-red-600">{{ errors.devices }}</p>
          </div>

          <div class="mt-6 flex items-center gap-3">
            <Button class="h-11 px-5 text-base" @click="validateAndContinue"
              >See Recommendations</Button
            >
            <p class="text-base text-slate-600">
              Validates required setup fields for this iteration.
            </p>
          </div>

          <div
            v-if="setupReady"
            class="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            Setup complete. You can now move to forecast recommendations in the next implementation
            step.
          </div>
        </div>
      </section>
    </main>

    <!-- Shared footer -->
    <SiteFooter />
  </div>
</template>
