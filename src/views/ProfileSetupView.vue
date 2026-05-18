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
const MELBOURNE_FALLBACK_POSTCODE = '3000'

const houseMaterialOptions = [
  { value: 'double_brick', label: 'Double brick' },
  { value: 'stone', label: 'Stone' },
  { value: 'insulated_frame', label: 'Insulated frame' },
  { value: 'brick_veneer', label: 'Brick veneer' },
  { value: 'cavity_brick', label: 'Cavity brick' },
  { value: 'light_timber', label: 'Light timber' },
  { value: 'uninsulated_frame', label: 'Uninsulated frame' },
]

const deviceOptions = [
  { value: 'reverse_cycle_split', label: 'Reverse-cycle split system' },
  { value: 'heat_pump', label: 'Heat pump' },
  { value: 'ducted_inverter', label: 'Ducted inverter system' },
  { value: 'evaporative_cooler', label: 'Evaporative cooler' },
  { value: 'ducted_non_inverter', label: 'Ducted non-inverter system' },
  { value: 'gas_heater', label: 'Gas heater' },
  { value: 'portable_electric', label: 'Portable electric heater' },
  { value: 'underfloor_heating', label: 'Electric underfloor heating' },
  { value: 'fan', label: 'Fan' },
]

const allowedHouseMaterialValues = new Set(houseMaterialOptions.map((option) => option.value))
const allowedDeviceValues = new Set(deviceOptions.map((option) => option.value))

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
    houseMaterial.value =
      parsed.houseMaterial && allowedHouseMaterialValues.has(parsed.houseMaterial)
        ? parsed.houseMaterial
        : ''
    selectedDevices.value = Array.isArray(parsed.selectedDevices)
      ? parsed.selectedDevices.filter((device) => allowedDeviceValues.has(device))
      : []
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
  if (!navigator.geolocation) {
    locationStatus.value = 'unavailable'
    locationCoords.value = null
    if (!postcode.value.trim()) postcode.value = MELBOURNE_FALLBACK_POSTCODE
    persistSharedLocationState('unavailable', null)
    return
  }

  const shared = loadSharedLocationState()
  if (!('permissions' in navigator)) {
    if (shared?.status === 'granted' && shared.coords) {
      locationStatus.value = 'granted'
      locationCoords.value = shared.coords
      return
    }
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
      locationCoords.value = null
      if (!postcode.value.trim()) postcode.value = MELBOURNE_FALLBACK_POSTCODE
      persistSharedLocationState('denied', null)
      return
    }

    if (shared?.status === 'granted' && shared.coords) {
      locationStatus.value = 'granted'
      locationCoords.value = shared.coords
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
      throw new Error('Unable to read home profile setup')
    }

    const payload = mapToSmartActionsPayload(setup)
    if (!payload.house_material || payload.appliances.length === 0 || !payload.postcode) {
      throw new Error('Selected devices/material are not compatible with recommendations API')
    }

    const response = await fetchSmartActionsRecommendations({
      house_profile: {
        house_material: payload.house_material,
        appliances: payload.appliances,
      },
      postcode: payload.postcode,
    })

    sessionStorage.setItem(SMART_ACTIONS_RESPONSE_KEY, JSON.stringify(response))
    sessionStorage.setItem(SMART_ACTIONS_UNLOCKED_KEY, 'true')

    await router.push({ path: '/smart-actions' })
  } catch (error) {
    if (error instanceof Error) {
      submitError.value = error.message
    } else {
      submitError.value = 'Unable to submit home profile setup right now.'
    }
  } finally {
    submitLoading.value = false
  }
}

onMounted(async () => {
  restoreSetupFromSession()
  if (!postcode.value.trim()) postcode.value = MELBOURNE_FALLBACK_POSTCODE
  await checkBrowserLocationPermission()
})
</script>

<template>
  <div class="min-h-screen bg-white text-slate-900">
    <Transition name="page-overlay-fade">
      <div
        v-if="submitLoading"
        class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/92"
      >
        <div class="text-center text-white">
          <div class="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white"></div>
          <p class="mt-4 text-sm font-semibold uppercase tracking-widest text-white/85">
            Setting Up Home Profile
          </p>
        </div>
      </div>
    </Transition>

    <SiteHeader />

    <main class="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <section class="profile-shell mx-auto max-w-6xl overflow-hidden rounded-2xl border border-slate-200">
        <div class="profile-hero grid gap-0 md:grid-cols-[1fr_1.35fr]">
          <div class="profile-hero-media relative min-h-[220px]">
            <img src="/home-profile-card.jpg" alt="Home profile setup" class="h-full w-full object-contain" />
          </div>
          <div class="profile-hero-copy p-8 lg:p-10">
            <p class="profile-chip">GreenBreeze Onboarding</p>
            <h1 class="mt-3 text-4xl font-extrabold tracking-tight text-[var(--gb-grid)]">Home Profile Setup</h1>
            <p class="mt-3 text-base text-slate-700">
              Set your home details once to unlock personalized Smart Actions and weather-linked recommendations.
            </p>
          </div>
        </div>

        <div class="mx-auto max-w-5xl p-8 pt-6 lg:p-10 lg:pt-8">
          <div class="mb-8 flex flex-wrap items-center justify-center gap-3">
            <span
              v-if="locationStatus === 'granted'"
              class="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white"
            >
              Location Granted
            </span>
            <span
              v-else-if="locationStatus === 'denied' || locationStatus === 'unavailable'"
              class="rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white"
            >
              Location Denied
            </span>
            <span
              v-else
              class="rounded-full bg-slate-600 px-4 py-1.5 text-sm font-semibold text-white"
            >
              Checking Location...
            </span>
          </div>

          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div class="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <Label for="house-material" class="text-base font-semibold"
                >House Material (Detached House)</Label
              >
              <select
                id="house-material"
                v-model="houseMaterial"
                class="border-input focus-visible:ring-ring/50 h-11 w-full rounded-md border bg-white px-4 text-base outline-none focus-visible:ring-[3px]"
              >
                <option value="">Select house material</option>
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
              class="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <Label for="postcode" class="text-base font-semibold"
                >Postcode (VIC only)</Label
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
            class="mt-6 mx-auto max-w-100 rounded-xl text-center bg-emerald-50 border border-emerald-800 px-4 py-3 text-sm text-emerald-800"
          >
            Profile setup is validated.
          </div>

          <div v-else class="mt-6 mx-auto max-w-600 text-center border border-amber-800 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Please complete all Home Profile Setup fields to unlock full Smart Actions insights.
          </div>

          <div class="mt-6 flex items-center justify-center">
            <Button
              type="button"
              class="h-11 bg-[var(--gb-electric)] px-8 text-white hover:bg-[#4CBB17] hover:text-white"
              :disabled="!setupReady || submitLoading"
              @click="submitProfile"
            >
              {{ submitLoading ? 'Submitting...' : 'Submit Home Profile Setup' }}
            </Button>
          </div>
          <p v-if="submitError" class="mt-3 text-center text-sm font-semibold text-red-600">{{ submitError }}</p>
        </div>
      </section>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.profile-shell {
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.08);
}

.profile-hero {
  border-bottom: 1px solid rgba(148, 163, 184, 0.24);
}

.profile-hero-media {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.16), rgba(240, 170, 60, 0.16));
}

.profile-hero-copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.profile-chip {
  display: inline-flex;
  border-radius: 999px;
  border: 1px solid rgba(47, 127, 121, 0.3);
  background: rgba(47, 127, 121, 0.1);
  padding: 0.28rem 0.72rem;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #0f766e;
}

.page-overlay-fade-enter-active,
.page-overlay-fade-leave-active {
  transition: opacity 320ms ease;
}

.page-overlay-fade-enter-from,
.page-overlay-fade-leave-to {
  opacity: 0;
}
</style>
