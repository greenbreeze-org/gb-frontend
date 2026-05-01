<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const STORAGE_KEY = 'forecast_setup_v2'

const postcode = ref('')
const houseMaterial = ref('')
const selectedDevices = ref<string[]>([])

const locationStatus = ref<'checking' | 'granted' | 'denied' | 'unavailable'>('checking')
const locationCoords = ref<{ lat: number; lon: number } | null>(null)

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

const isHouseMaterialValid = computed(() => Boolean(houseMaterial.value))
const isDeviceSelectionValid = computed(() => selectedDevices.value.length > 0)
const setupReady = computed(
  () => isLocationValid.value && isHouseMaterialValid.value && isDeviceSelectionValid.value,
)

const locationError = computed(() =>
  isLocationValid.value ? '' : 'Location unavailable. Please enter a valid Victoria postcode.',
)
const houseMaterialError = computed(() =>
  isHouseMaterialValid.value ? '' : 'Please select a house material.',
)
const devicesError = computed(() =>
  isDeviceSelectionValid.value ? '' : 'Please select at least one heating/cooling device.',
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

const toggleDevice = (value: string, checked: boolean) => {
  if (checked) {
    if (!selectedDevices.value.includes(value)) {
      selectedDevices.value = [...selectedDevices.value, value]
    }
    return
  }

  selectedDevices.value = selectedDevices.value.filter((item) => item !== value)
}

onMounted(async () => {
  restoreSetupFromSession()
  await checkBrowserLocationPermission()
})
</script>

<template>
  <div class="min-h-screen bg-white text-slate-900">
    <SiteHeader />

    <main class="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <section class="mx-auto max-w-5xl rounded-2xl border border-slate-200 p-8 lg:p-10">
        <h1 class="mb-8 text-center text-4xl font-bold tracking-tight">Profile Setup</h1>

        <div class="mx-auto max-w-4xl">
          <div class="mb-10 flex flex-wrap items-center justify-center gap-3">
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

          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div class="space-y-2">
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
              class="space-y-2"
            >
              <Label for="postcode" class="text-base font-semibold"
                >Postcode (VIC only, required when location is denied)</Label
              >
              <Input id="postcode" v-model="postcode" placeholder="e.g. 3000" class="h-11 text-base" />
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
            class="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            Profile setup is validated.
          </div>

          <div v-else class="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Please complete all setup fields to unlock full forecast insights.
          </div>
        </div>
      </section>
    </main>

    <SiteFooter />
  </div>
</template>
