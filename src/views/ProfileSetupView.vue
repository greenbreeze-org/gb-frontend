<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  loadSharedLocationState,
  loadStoredProfileSetup,
  mapToSmartActionsPayload,
  persistSharedLocationState,
  PROFILE_SETUP_STORAGE_KEY,
  SMART_ACTIONS_RESPONSE_KEY,
  SMART_ACTIONS_UNLOCKED_KEY,
} from '@/services/profileSetup'
import { fetchSmartActionsRecommendations } from '@/services/smartActions'

const router = useRouter()

const postcode = ref('')
const houseMaterial = ref('')
const selectedDevices = ref<string[]>([])
const submitLoading = ref(false)
const submitError = ref('')
const forcePostcodeInput = ref(false)

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
  const raw = sessionStorage.getItem(PROFILE_SETUP_STORAGE_KEY)
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
    sessionStorage.removeItem(PROFILE_SETUP_STORAGE_KEY)
  }
}

const persistSetupToSession = () => {
  sessionStorage.setItem(
    PROFILE_SETUP_STORAGE_KEY,
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

const resolvePostcodeFromCoords = async (coords: { lat: number; lon: number }) => {
  const reverseUrl = new URL('https://nominatim.openstreetmap.org/reverse')
  reverseUrl.searchParams.set('format', 'jsonv2')
  reverseUrl.searchParams.set('lat', String(coords.lat))
  reverseUrl.searchParams.set('lon', String(coords.lon))
  reverseUrl.searchParams.set('zoom', '18')
  reverseUrl.searchParams.set('addressdetails', '1')

  const response = await fetch(reverseUrl.toString())
  if (!response.ok) {
    throw new Error('Unable to resolve postcode from current location')
  }

  const data = (await response.json()) as {
    address?: { postcode?: string }
  }
  const rawPostcode = data.address?.postcode?.trim() ?? ''
  const onlyDigits = rawPostcode.replace(/\D/g, '')
  if (!/^\d{4}$/.test(onlyDigits)) {
    throw new Error('Could not detect a valid VIC postcode from current location')
  }
  return onlyDigits
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

const submitProfile = async () => {
  if (!setupReady.value) return

  submitLoading.value = true
  submitError.value = ''

  try {
    if (!postcode.value.trim() && locationStatus.value === 'granted' && locationCoords.value) {
      try {
        postcode.value = await resolvePostcodeFromCoords(locationCoords.value)
      } catch {
        forcePostcodeInput.value = true
        throw new Error('Please enter postcode manually before submitting.')
      }
    }

    persistSetupToSession()
    const setup = loadStoredProfileSetup()
    if (!setup) {
      throw new Error('Unable to read profile setup')
    }

    const payload = mapToSmartActionsPayload(setup)
    if (!payload.wall_type || payload.appliances.length === 0 || !payload.postcode) {
      throw new Error('Selected devices/material are not compatible with recommendations API')
    }

    const response = await fetchSmartActionsRecommendations({
      wall_type: payload.wall_type,
      appliances: payload.appliances,
      postcode: payload.postcode,
    })

    sessionStorage.setItem(SMART_ACTIONS_RESPONSE_KEY, JSON.stringify(response))
    sessionStorage.setItem(SMART_ACTIONS_UNLOCKED_KEY, 'true')

    await router.push('/smart-actions')
  } catch (error) {
    if (error instanceof Error) {
      submitError.value = error.message
    } else {
      submitError.value = 'Unable to submit profile setup right now.'
    }
  } finally {
    submitLoading.value = false
  }
}

onMounted(async () => {
  restoreSetupFromSession()
  const shared = loadSharedLocationState()
  if (shared?.status === 'granted' && shared.coords) {
    locationStatus.value = 'granted'
    locationCoords.value = shared.coords
  }
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
              v-if="locationStatus === 'denied' || locationStatus === 'unavailable' || forcePostcodeInput"
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

          <div class="mt-6 flex items-center justify-center">
            <Button
              type="button"
              class="h-11 bg-[var(--gb-electric)] px-8 text-white hover:bg-[#4CBB17] hover:text-white"
              :disabled="!setupReady || submitLoading"
              @click="submitProfile"
            >
              {{ submitLoading ? 'Submitting...' : 'Submit Profile Setup' }}
            </Button>
          </div>
          <p v-if="submitError" class="mt-3 text-center text-sm font-semibold text-red-600">{{ submitError }}</p>
        </div>
      </section>
    </main>

    <SiteFooter />
  </div>
</template>
