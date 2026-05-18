export const PROFILE_SETUP_STORAGE_KEY = 'forecast_setup_v2'
export const SMART_ACTIONS_UNLOCKED_KEY = 'smart_actions_unlocked_v1'
export const SMART_ACTIONS_RESPONSE_KEY = 'smart_actions_response_v1'
export const LOCATION_STATE_STORAGE_KEY = 'location_state_v1'

export type WallType =
  | 'double_brick'
  | 'stone'
  | 'insulated_frame'
  | 'brick_veneer'
  | 'cavity_brick'
  | 'light_timber'
  | 'uninsulated_frame'

export type ApplianceType =
  | 'reverse_cycle_split'
  | 'heat_pump'
  | 'ducted_inverter'
  | 'evaporative_cooler'
  | 'ducted_non_inverter'
  | 'gas_heater'
  | 'portable_electric'
  | 'underfloor_heating'
  | 'fan'

export interface StoredProfileSetup {
  postcode?: string
  houseMaterial?: string
  selectedDevices?: string[]
}

export type SharedLocationStatus = 'checking' | 'granted' | 'denied' | 'unavailable'

export interface SharedLocationState {
  status: SharedLocationStatus
  coords: { lat: number; lon: number } | null
}

const wallTypeMap: Record<string, WallType> = {
  double_brick: 'double_brick',
  stone: 'stone',
  insulated_frame: 'insulated_frame',
  brick_veneer: 'brick_veneer',
  cavity_brick: 'cavity_brick',
  light_timber: 'light_timber',
  uninsulated_frame: 'uninsulated_frame',
  'brick-veneer': 'brick_veneer',
  'double-brick': 'double_brick',
  'weatherboard-timber': 'light_timber',
  'lightweight-cladding': 'uninsulated_frame',
}

const applianceMap: Record<string, ApplianceType> = {
  reverse_cycle_split: 'reverse_cycle_split',
  heat_pump: 'heat_pump',
  ducted_inverter: 'ducted_inverter',
  evaporative_cooler: 'evaporative_cooler',
  ducted_non_inverter: 'ducted_non_inverter',
  gas_heater: 'gas_heater',
  portable_electric: 'portable_electric',
  underfloor_heating: 'underfloor_heating',
  fan: 'fan',
  ac_split: 'reverse_cycle_split',
  ac_ducted: 'ducted_inverter',
  evaporative: 'evaporative_cooler',
  fan_ceiling: 'fan',
  fan_portable: 'fan',
  electric_heater: 'portable_electric',
}

export const loadStoredProfileSetup = (): StoredProfileSetup | null => {
  const raw = sessionStorage.getItem(PROFILE_SETUP_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredProfileSetup
  } catch {
    sessionStorage.removeItem(PROFILE_SETUP_STORAGE_KEY)
    return null
  }
}

export const mapToSmartActionsPayload = (setup: StoredProfileSetup) => {
  const wallType = setup.houseMaterial ? wallTypeMap[setup.houseMaterial] : undefined
  const appliances = (setup.selectedDevices ?? [])
    .map((device) => applianceMap[device])
    .filter((value): value is ApplianceType => Boolean(value))
  const postcode = setup.postcode?.trim()

  return {
    wall_type: wallType,
    house_material: wallType,
    appliances: Array.from(new Set(appliances)),
    postcode: postcode && /^\d{4}$/.test(postcode) ? postcode : undefined,
  }
}

export const persistSharedLocationState = (
  status: SharedLocationStatus,
  coords: { lat: number; lon: number } | null,
) => {
  sessionStorage.setItem(
    LOCATION_STATE_STORAGE_KEY,
    JSON.stringify({
      status,
      coords,
    } satisfies SharedLocationState),
  )
}

export const loadSharedLocationState = (): SharedLocationState | null => {
  const raw = sessionStorage.getItem(LOCATION_STATE_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SharedLocationState
    if (!parsed || typeof parsed.status !== 'string') return null
    if (
      parsed.coords &&
      (typeof parsed.coords.lat !== 'number' || typeof parsed.coords.lon !== 'number')
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}
