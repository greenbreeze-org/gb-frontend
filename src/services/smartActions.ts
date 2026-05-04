import { apiPost } from '@/services/http'
import type { ApplianceType, WallType } from '@/services/profileSetup'

export interface SmartActionStep {
  step_number: number
  scheduled_time: string
  instruction: string
  target_temp: number | null
  duration_min: number | null
}

export interface SmartActionRecommendation {
  id: string
  appliance: string
  action: {
    action_type: string
    steps: SmartActionStep[]
    impact?: {
      avoided_kwh?: number
      avoided_emissions_kg_co2?: number
      peak_reduction_pct?: number
    }
  }
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  color: 'RED' | 'YELLOW' | 'GREEN'
  short_reason: string
  explanation: string
}

export interface SmartActionsResponse {
  wall_type: string
  insulation_label: string
  recommendations: SmartActionRecommendation[]
}

export interface SmartActionsPayload {
  wall_type: WallType
  appliances: ApplianceType[]
}

export const fetchSmartActionsRecommendations = async (
  payload: SmartActionsPayload,
): Promise<SmartActionsResponse> => {
  return apiPost<SmartActionsResponse>('/smart-actions/recommendations', payload)
}
