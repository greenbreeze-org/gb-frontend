import { apiPost } from '@/services/http'
import type { ApplianceType, WallType } from '@/services/profileSetup'

export interface SmartActionEquivalent {
  label: string
  value: number
  unit: string
}

export interface SmartActionImpact {
  avoided_kwh?: number
  avoided_emissions_kg_co2?: number
  peak_reduction_pct?: number
  estimated_savings_aud?: number
  real_world_equivalents?: SmartActionEquivalent[]
  money_equivalents?: SmartActionEquivalent[]
}

export interface SmartActionStep {
  step_number: number
  scheduled_time: string
  instruction: string
  target_temp: number | null
  duration_min: number | null
  impact?: SmartActionImpact
}

export interface SmartActionRecommendation {
  id: string
  action_code?: string
  appliance: string
  action: {
    action_type: string
    steps: SmartActionStep[]
    impact?: SmartActionImpact
  }
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  color: 'RED' | 'YELLOW' | 'GREEN'
  short_reason: string
  explanation: string
  context_explanation?: string | null
}

export interface SmartActionsResponse {
  house_material: string
  insulation_label: string
  recommendations: SmartActionRecommendation[]
}

export interface SmartActionsPayload {
  house_profile: {
    house_material: WallType
    appliances: ApplianceType[]
  }
  postcode: string
}

export const fetchSmartActionsRecommendations = async (
  payload: SmartActionsPayload,
): Promise<SmartActionsResponse> => {
  return apiPost<SmartActionsResponse>('/smart-actions/recommendations', payload)
}
