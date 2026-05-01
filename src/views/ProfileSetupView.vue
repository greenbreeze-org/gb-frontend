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
</script>

<template>
  <div class="min-h-screen bg-white text-slate-900">
    <SiteHeader />

    <main class="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <section class="mx-auto max-w-5xl rounded-2xl border border-slate-200 p-8 lg:p-10">
        <h1 class="mb-8 text-center text-4xl font-bold tracking-tight">Profile Setup</h1>
      </section>
    </main>

    <SiteFooter />
  </div>
</template>
