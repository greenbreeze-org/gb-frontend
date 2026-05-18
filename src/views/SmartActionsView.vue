<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Droplets, Sun, Thermometer, Wind } from 'lucide-vue-next'

import { DotLottieVue } from '@lottiefiles/dotlottie-vue'
import type { DotLottieVueInstance } from '@lottiefiles/dotlottie-vue'

import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { apiGet, apiPost } from '@/services/http'
import { fetchForecastSnapshot, type ForecastSnapshot } from '@/services/forecast'
import {
  loadSharedLocationState,
  loadStoredProfileSetup,
  mapToSmartActionsPayload,
  SMART_ACTIONS_RESPONSE_KEY,
  SMART_ACTIONS_UNLOCKED_KEY,
} from '@/services/profileSetup'
import {
  fetchSmartActionsRecommendations,
  type SmartActionRecommendation,
  type SmartActionsResponse,
} from '@/services/smartActions'

const loading = ref(false)
const errorMessage = ref('')
const showImpactSummary = ref(false)
const impactPreludeActive = ref(false)
const impactPreludeDone = ref(false)
const impactPreludeIndex = ref(0)
const apiResponse = ref<SmartActionsResponse | null>(null)
const flippedCards = ref<boolean[]>([])
const selectedActionItems = ref<string[]>([])
const impactMode = ref<'climate' | 'money'>('climate')
const impactAnimationProgress = ref(0)
let impactAnimationFrame: number | null = null
let impactPreludeInterval: number | null = null
let impactPreludeFinishTimeout: number | null = null
let revealObserver: IntersectionObserver | null = null

const locationStatus = ref<'checking' | 'granted' | 'denied' | 'unavailable'>('checking')
const locationCoords = ref<{ lat: number; lon: number } | null>(null)
const activeFallbackPostcode = ref('3000')
const forecastSnapshot = ref<ForecastSnapshot | null>(null)
const heroLoading = ref(true)
const chartHourlyFromApi = ref<Array<{ time: string; tempC: number }>>([])
const awsTodayMinMax = ref<{ minC: number; maxC: number } | null>(null)
const HEATWAVE_THRESHOLD_C = 35
const FORCE_NIGHT_VIDEO = false
const route = useRoute()

interface LocationResolveResponse {
  lat?: number
  lon?: number
  coordinates?: {
    lat?: number
    lon?: number
  }
}

interface ForecastWeatherResponse {
  today?: {
    minC?: number
    maxC?: number
  }
  hourly?: Array<{
    time?: string
    tempC?: number
  }>
}

type Equivalent = { label: string; value: number; unit: string }
type ActionImpactExtended = {
  avoided_kwh?: number
  avoided_emissions_kg_co2?: number
  peak_reduction_pct?: number
  estimated_savings_aud?: number
  real_world_equivalents?: Equivalent[]
  money_equivalents?: Equivalent[]
}

type SmartActionRecommendationExtended = SmartActionRecommendation & {
  action_code?: string
  context_explanation?: string | null
  action: SmartActionRecommendation['action'] & {
    impact?: ActionImpactExtended
    steps: Array<SmartActionRecommendation['action']['steps'][number] & { impact?: ActionImpactExtended }>
  }
}

type SmartActionsResponseExtended = Omit<SmartActionsResponse, 'recommendations'> & {
  house_material?: string
  recommendations: SmartActionRecommendationExtended[]
}

const STATIC_SMART_ACTIONS_RESPONSE: SmartActionsResponseExtended = {
  house_material: 'brick_veneer',
  insulation_label: 'moderately_insulated',
  recommendations: [
    {
      id: '9a4044f2-2ce8-4db9-89c8-e92303006b71',
      action_code: 'pre_condition_reverse_cycle_split',
      appliance: 'reverse_cycle_split',
      action: {
        action_type: 'pre_condition',
        steps: [
          {
            step_number: 1,
            scheduled_time: '2026-05-18T21:30:00+10:00',
            instruction:
              'Turn on your reverse-cycle split system for heating at 21:30. Set to 20°C. Allow ~12 min to reach comfort before the peak at 23:00.',
            target_temp: 20,
            duration_min: 12,
            impact: {
              avoided_kwh: 0.3,
              avoided_emissions_kg_co2: 0.237,
              peak_reduction_pct: 2.9,
              estimated_savings_aud: 0.09,
              real_world_equivalents: [
                { label: 'tree-days of CO₂ absorbed', value: 3.9, unit: 'tree-days' },
                { label: 'km not driven by car', value: 1.1, unit: 'km' },
                { label: 'smartphone charges saved', value: 23.7, unit: 'charges' },
                { label: 'hours of LED lighting', value: 39.5, unit: 'hours' },
              ],
              money_equivalents: [
                { label: 'cups of coffee', value: 0.02, unit: 'coffees' },
                { label: 'public transport trips', value: 0.03, unit: 'trips' },
                { label: 'days of streaming', value: 0.2, unit: 'days' },
                { label: 'loaves of bread', value: 0.03, unit: 'loaves' },
              ],
            },
          },
          {
            step_number: 2,
            scheduled_time: '2026-05-19T11:30:00+10:00',
            instruction:
              'Turn on your reverse-cycle split system for heating at 11:30. Set to 20°C. Allow ~12 min to reach comfort before the peak at 13:00.',
            target_temp: 20,
            duration_min: 12,
            impact: {
              avoided_kwh: 0.3,
              avoided_emissions_kg_co2: 0.237,
              peak_reduction_pct: 20,
              estimated_savings_aud: 0.09,
              real_world_equivalents: [
                { label: 'tree-days of CO₂ absorbed', value: 3.9, unit: 'tree-days' },
                { label: 'km not driven by car', value: 1.1, unit: 'km' },
                { label: 'smartphone charges saved', value: 23.7, unit: 'charges' },
                { label: 'hours of LED lighting', value: 39.5, unit: 'hours' },
              ],
              money_equivalents: [
                { label: 'cups of coffee', value: 0.02, unit: 'coffees' },
                { label: 'public transport trips', value: 0.03, unit: 'trips' },
                { label: 'days of streaming', value: 0.2, unit: 'days' },
                { label: 'loaves of bread', value: 0.03, unit: 'loaves' },
              ],
            },
          },
        ],
        impact: {
          avoided_kwh: 0.6,
          avoided_emissions_kg_co2: 0.474,
          peak_reduction_pct: 5,
          estimated_savings_aud: 0,
          real_world_equivalents: [
            { label: 'tree-days of CO₂ absorbed', value: 7.9, unit: 'tree-days' },
            { label: 'km not driven by car', value: 2.3, unit: 'km' },
            { label: 'smartphone charges saved', value: 47.4, unit: 'charges' },
            { label: 'hours of LED lighting', value: 79, unit: 'hours' },
          ],
          money_equivalents: [],
        },
      },
      priority: 'MEDIUM',
      color: 'YELLOW',
      short_reason: "Pre-heating with your reverse-cycle split system by 21:30 before 23:00 peak",
      explanation:
        'Start your reverse-cycle split system 1.5 h before the 23:00 peak. Your moderately insulated brick veneer home holds temperature well, so the reverse-cycle split system can rest during grid stress. Shifts ~0.60 kWh off-peak, saving ~0.47 kg CO₂.',
      context_explanation: null,
    },
    {
      id: '60268441-bdf1-4af9-83d9-3293b42351f8',
      action_code: 'peak_time_reverse_cycle_split',
      appliance: 'reverse_cycle_split',
      action: {
        action_type: 'peak_time',
        steps: [
          {
            step_number: 1,
            scheduled_time: '2026-05-18T23:00:00+10:00',
            instruction:
              'Peak started at 23:00. Raise your reverse-cycle split system setpoint to 18°C until 06:00. Stored warmth keeps you comfortable.',
            target_temp: 18,
            duration_min: null,
            impact: {
              avoided_kwh: 5.25,
              avoided_emissions_kg_co2: 4.147,
              peak_reduction_pct: 50,
              estimated_savings_aud: 0,
              real_world_equivalents: [
                { label: 'tree-days of CO₂ absorbed', value: 69.1, unit: 'tree-days' },
                { label: 'km not driven by car', value: 19.7, unit: 'km' },
                { label: 'smartphone charges saved', value: 414.7, unit: 'charges' },
                { label: 'hours of LED lighting', value: 691.2, unit: 'hours' },
              ],
              money_equivalents: [],
            },
          },
          {
            step_number: 2,
            scheduled_time: '2026-05-19T13:00:00+10:00',
            instruction:
              'Peak started at 13:00. Raise your reverse-cycle split system setpoint to 18°C until 14:00. Stored warmth keeps you comfortable.',
            target_temp: 18,
            duration_min: null,
            impact: {
              avoided_kwh: 0.75,
              avoided_emissions_kg_co2: 0.593,
              peak_reduction_pct: 50,
              estimated_savings_aud: 0,
              real_world_equivalents: [
                { label: 'tree-days of CO₂ absorbed', value: 9.9, unit: 'tree-days' },
                { label: 'km not driven by car', value: 2.8, unit: 'km' },
                { label: 'smartphone charges saved', value: 59.3, unit: 'charges' },
                { label: 'hours of LED lighting', value: 98.8, unit: 'hours' },
              ],
              money_equivalents: [],
            },
          },
        ],
        impact: {
          avoided_kwh: 6,
          avoided_emissions_kg_co2: 4.74,
          peak_reduction_pct: 50,
          estimated_savings_aud: 0,
          real_world_equivalents: [
            { label: 'tree-days of CO₂ absorbed', value: 79, unit: 'tree-days' },
            { label: 'km not driven by car', value: 22.6, unit: 'km' },
            { label: 'smartphone charges saved', value: 474, unit: 'charges' },
            { label: 'hours of LED lighting', value: 790, unit: 'hours' },
          ],
          money_equivalents: [],
        },
      },
      priority: 'MEDIUM',
      color: 'YELLOW',
      short_reason: 'Ease your reverse-cycle split system load during the peak windows',
      explanation:
        "During each peak window, reduce your reverse-cycle split system's load to ease grid stress. This avoids ~6.00 kWh and ~4.74 kg CO₂.",
      context_explanation: null,
    },
  ],
}

const isUnlocked = computed(() => sessionStorage.getItem(SMART_ACTIONS_UNLOCKED_KEY) === 'true')
const hasSelection = computed(() => selectedActionItems.value.length > 0)
const selectedCount = computed(() => selectedActionItems.value.length)

const hasBrowserLocation = computed(() => Boolean(locationCoords.value))
const hasValidActiveFallbackPostcode = computed(() => {
  return /^\d{4}$/.test(activeFallbackPostcode.value.trim())
})

const setupReady = computed(() => {
  const usingBrowserLocation = locationStatus.value === 'granted' && hasBrowserLocation.value
  const usingPostcode = !usingBrowserLocation && hasValidActiveFallbackPostcode.value

  return usingBrowserLocation || usingPostcode
})

const colorClass = (color: SmartActionRecommendation['color']) => {
  if (color === 'RED') return 'rec-tone-red'
  if (color === 'YELLOW') return 'rec-tone-yellow'
  return 'rec-tone-green'
}

const priorityBadgeClass = (priority: SmartActionRecommendation['priority']) => {
  if (priority === 'HIGH') return 'bg-red-900 text-white'
  if (priority === 'MEDIUM') return 'bg-yellow-700 text-white'
  return 'bg-emerald-900 text-white'
}

const recommendationTitle = (rec: SmartActionRecommendation) => {
  return rec.short_reason?.trim() || rec.appliance.replaceAll('_', ' ')
}

const recommendationPreview = (rec: SmartActionRecommendation) => {
  const title = recommendationTitle(rec).trim()
  if (!title) return 'Smart Action'
  return title
}

const recommendationFingerprint = (rec: SmartActionRecommendation) => {
  return recommendationTitle(rec).toLowerCase()
}

const dedupedRecommendations = computed(() => {
  const seen = new Set<string>()
  const unique: SmartActionRecommendation[] = []

  for (const rec of apiResponse.value?.recommendations ?? []) {
    const key = recommendationFingerprint(rec)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(rec)
  }

  return unique
})

type ActionStepItem = {
  id: string
  recommendationId: string
  recommendationTitle: string
  actionType: string
  priority: SmartActionRecommendation['priority']
  stepNumber: number
  scheduledTime: string
  instruction: string
  impact: {
    kwh: number
    co2: number
    peak: number
    money: number
    realWorld: Equivalent[]
    moneyEquivalents: Equivalent[]
  }
}

const actionItems = computed(() =>
  (dedupedRecommendations.value as SmartActionRecommendationExtended[]).flatMap((rec) =>
    (rec.action.steps ?? []).map((step) => {
      const stepImpact = (step as SmartActionRecommendationExtended['action']['steps'][number]).impact
      return {
        id: `${rec.id}-step-${step.step_number}`,
        recommendationId: rec.id,
        recommendationTitle: recommendationTitle(rec),
        actionType: rec.action.action_type,
        priority: rec.priority,
        stepNumber: step.step_number,
        scheduledTime: step.scheduled_time,
        instruction: step.instruction,
        impact: {
          kwh: stepImpact?.avoided_kwh ?? 0,
          co2: stepImpact?.avoided_emissions_kg_co2 ?? 0,
          peak: stepImpact?.peak_reduction_pct ?? 0,
          money: stepImpact?.estimated_savings_aud ?? 0,
          realWorld: stepImpact?.real_world_equivalents ?? [],
          moneyEquivalents: stepImpact?.money_equivalents ?? [],
        },
      } satisfies ActionStepItem
    }),
  ),
)

const completionRate = computed(() => {
  const total = actionItems.value.length
  if (!total) return 0
  return selectedActionItems.value.length / total
})

const selectedStepItems = computed(() =>
  actionItems.value.filter((item) => selectedActionItems.value.includes(item.id)),
)

const groupedActionItems = computed(() => {
  const groups = new Map<
    string,
    {
      recommendationId: string
      title: string
      priority: SmartActionRecommendation['priority']
      steps: ActionStepItem[]
      completed: number
      total: number
      isComplete: boolean
    }
  >()

  for (const item of actionItems.value) {
    const existing = groups.get(item.recommendationId)
    if (existing) {
      existing.steps.push(item)
    } else {
      groups.set(item.recommendationId, {
        recommendationId: item.recommendationId,
        title: item.recommendationTitle,
        priority: item.priority,
        steps: [item],
        completed: 0,
        total: 0,
        isComplete: false,
      })
    }
  }

  const result = Array.from(groups.values())
  for (const group of result) {
    group.steps.sort((a, b) => a.stepNumber - b.stepNumber)
    group.total = group.steps.length
    group.completed = group.steps.filter((s) => selectedActionItems.value.includes(s.id)).length
    group.isComplete = group.total > 0 && group.completed === group.total
  }

  return result
})

const potentialImpact = computed(() => {
  return actionItems.value.reduce(
    (acc, rec) => {
      acc.kwh += rec.impact.kwh
      acc.co2 += rec.impact.co2
      acc.money += rec.impact.money
      acc.peak += rec.impact.peak
      return acc
    },
    { kwh: 0, co2: 0, money: 0, peak: 0 },
  )
})

const realizedImpact = computed(() => {
  const totals = selectedStepItems.value.reduce(
    (acc, rec) => {
      acc.kwh += rec.impact.kwh
      acc.co2 += rec.impact.co2
      acc.money += rec.impact.money
      acc.peak += rec.impact.peak
      return acc
    },
    { kwh: 0, co2: 0, money: 0, peak: 0 },
  )
  return {
    kwh: totals.kwh,
    co2: totals.co2,
    money: totals.money,
    peak: totals.peak,
  }
})

const missedImpact = computed(() => ({
  kwh: potentialImpact.value.kwh - realizedImpact.value.kwh,
  co2: potentialImpact.value.co2 - realizedImpact.value.co2,
  money: potentialImpact.value.money - realizedImpact.value.money,
  peak: potentialImpact.value.peak - realizedImpact.value.peak,
}))

const monthlySeries = computed(() => {
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const byDate = new Map<string, { co2: number; money: number }>()
  for (const step of actionItems.value) {
    const d = new Date(step.scheduledTime)
    if (Number.isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const current = byDate.get(key) ?? { co2: 0, money: 0 }
    current.co2 += step.impact.co2
    current.money += step.impact.money
    byDate.set(key, current)
  }

  const series = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const current = byDate.get(key) ?? { co2: 0, money: 0 }
    return {
      label: dayLabels[d.getDay()],
      value: impactMode.value === 'climate' ? current.co2 : current.money,
    }
  })

  const max = Math.max(...series.map((s) => s.value), 1)
  return series.map((s) => ({
    label: s.label,
    value: Number(s.value.toFixed(2)),
    heightPct: Math.max(16, Math.round((s.value / max) * 100)),
  }))
})

const yesterdayBaseline = {
  climate: {
    co2: 2.9,
    peak: 24,
    kwh: 4.1,
    missedCo2: 1.8,
  },
  money: {
    saved: 6.2,
    potential: 9.1,
    missed: 2.9,
    completionPct: 68,
  },
}

const animatedClimateCards = computed(() => [
  {
    label: 'Achieved CO2',
    raw: realizedImpact.value.co2,
    unit: 'kg',
    value: `${(realizedImpact.value.co2 * impactAnimationProgress.value).toFixed(2)} kg`,
    delta: ((realizedImpact.value.co2 - yesterdayBaseline.climate.co2) / Math.max(yesterdayBaseline.climate.co2, 0.01)) * 100,
  },
  {
    label: 'Potential CO2',
    raw: potentialImpact.value.co2,
    unit: 'kg',
    value: `${(potentialImpact.value.co2 * impactAnimationProgress.value).toFixed(2)} kg`,
    delta: ((potentialImpact.value.co2 - (yesterdayBaseline.climate.co2 + yesterdayBaseline.climate.missedCo2)) / Math.max(yesterdayBaseline.climate.co2 + yesterdayBaseline.climate.missedCo2, 0.01)) * 100,
  },
  {
    label: 'Missed CO2',
    raw: missedImpact.value.co2,
    unit: 'kg',
    value: `${(missedImpact.value.co2 * impactAnimationProgress.value).toFixed(2)} kg`,
    delta: ((missedImpact.value.co2 - yesterdayBaseline.climate.missedCo2) / Math.max(yesterdayBaseline.climate.missedCo2, 0.01)) * 100,
  },
  {
    label: 'Completion Efficiency',
    raw: Math.round(completionRate.value * 100),
    unit: '%',
    value: `${Math.round(completionRate.value * 100 * impactAnimationProgress.value)}%`,
    delta: ((Math.round(completionRate.value * 100) - yesterdayBaseline.money.completionPct) / Math.max(yesterdayBaseline.money.completionPct, 0.01)) * 100,
  },
])

const animatedMoneyCards = computed(() => [
  {
    label: 'Achieved Savings',
    raw: realizedImpact.value.money,
    unit: '$',
    value: `$${(realizedImpact.value.money * impactAnimationProgress.value).toFixed(2)}`,
    delta: ((realizedImpact.value.money - yesterdayBaseline.money.saved) / Math.max(yesterdayBaseline.money.saved, 0.01)) * 100,
  },
  {
    label: 'Potential if all done',
    raw: potentialImpact.value.money,
    unit: '$',
    value: `$${(potentialImpact.value.money * impactAnimationProgress.value).toFixed(2)}`,
    delta: ((potentialImpact.value.money - yesterdayBaseline.money.potential) / Math.max(yesterdayBaseline.money.potential, 0.01)) * 100,
  },
  {
    label: 'Savings missed today',
    raw: missedImpact.value.money,
    unit: '$',
    value: `$${(missedImpact.value.money * impactAnimationProgress.value).toFixed(2)}`,
    delta: ((missedImpact.value.money - yesterdayBaseline.money.missed) / Math.max(yesterdayBaseline.money.missed, 0.01)) * 100,
  },
  {
    label: 'Actions completion',
    raw: Math.round(completionRate.value * 100),
    unit: '%',
    value: `${Math.round(completionRate.value * 100 * impactAnimationProgress.value)}%`,
    delta: ((Math.round(completionRate.value * 100) - yesterdayBaseline.money.completionPct) / Math.max(yesterdayBaseline.money.completionPct, 0.01)) * 100,
  },
])

const impactEquivalents = computed(() => {
  const aggregate = new Map<string, { label: string; unit: string; value: number }>()
  for (const step of selectedStepItems.value) {
    const items = step.impact.realWorld
    for (const eq of items) {
      const key = `${eq.label}|${eq.unit}`
      const existing = aggregate.get(key) ?? { label: eq.label, unit: eq.unit, value: 0 }
      existing.value += eq.value
      aggregate.set(key, existing)
    }
  }

  return Array.from(aggregate.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)
})

const moneyEquivalents = computed(() => {
  const aggregate = new Map<string, { label: string; unit: string; value: number }>()
  for (const step of selectedStepItems.value) {
    const items = step.impact.moneyEquivalents
    for (const eq of items) {
      const key = `${eq.label}|${eq.unit}`
      const existing = aggregate.get(key) ?? { label: eq.label, unit: eq.unit, value: 0 }
      existing.value += eq.value
      aggregate.set(key, existing)
    }
  }

  return Array.from(aggregate.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)
})

const impactInsightLine = computed(() => {
  const captured = Math.round(completionRate.value * 100)
  if (impactMode.value === 'money') {
    return `You captured ${captured}% of today's savings opportunity. Completing remaining actions could unlock an extra $${missedImpact.value.money.toFixed(2)}.`
  }
  return `You captured ${captured}% of today's climate opportunity. Completing remaining actions could avoid another ${missedImpact.value.co2.toFixed(2)} kg CO2.`
})

const equivalentIconForLabel = (label: string, mode: 'climate' | 'money') => {
  const key = label.toLowerCase()
  if (mode === 'money') {
    if (key.includes('coffee')) return '/impact-icons/coffee.png'
    if (key.includes('transport') || key.includes('trip')) return '/impact-icons/myki.png'
    if (key.includes('stream')) return '/impact-icons/netflix.png'
    if (key.includes('bread')) return '/impact-icons/bread.png'
    return '/impact-icons/dollar.png'
  }
  if (key.includes('tree')) return '/impact-icons/tree.png'
  if (key.includes('km') || key.includes('driven')) return '/impact-icons/car.png'
  if (key.includes('co2')) return '/impact-icons/carbon.png'
  if (key.includes('charge')) return '/impact-icons/phone.png'
  if (key.includes('led') || key.includes('light')) return '/impact-icons/led.png'
  return '/impact-icons/leaf.png'
}

const moneyTimeSplit = computed(() => {
  let peak = 0
  let shifting = 0
  let offpeak = 0

  for (const step of selectedStepItems.value) {
    const actionType = step.actionType
    const value = step.impact.money
    if (actionType === 'peak_time') {
      peak += value
    } else if (actionType === 'pre_condition') {
      shifting += value
    } else {
      offpeak += value
    }
  }

  return {
    peak,
    shifting,
    offpeak,
  }
})

const formatDelta = (delta: number) => {
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}% vs yesterday`
}

const impactIconForCard = (label: string, mode: 'climate' | 'money') => {
  const key = label.toLowerCase()

  if (mode === 'climate') {
    if (key.includes('achieved')) return '/impact-icons/achieved.png'
    if (key.includes('potential')) return '/impact-icons/potential.png'
    if (key.includes('missed')) return '/impact-icons/missed.png'
    if (key.includes('efficiency')) return '/impact-icons/completed.png'
    return '/impact-icons/achieved.png'
  }

  if (key.includes('achieved')) return '/impact-icons/achieved.png'
  if (key.includes('potential')) return '/impact-icons/potential.png'
  if (key.includes('missed')) return '/impact-icons/missed.png'
  if (key.includes('completion')) return '/impact-icons/completed.png'
  return '/impact-icons/dollar.png'
}

const startImpactAnimation = () => {
  if (impactAnimationFrame) cancelAnimationFrame(impactAnimationFrame)
  impactAnimationProgress.value = 0
  const started = performance.now()
  const duration = 900

  const tick = (now: number) => {
    const t = Math.min(1, (now - started) / duration)
    const eased = 1 - Math.pow(1 - t, 3)
    impactAnimationProgress.value = eased
    if (t < 1) {
      impactAnimationFrame = requestAnimationFrame(tick)
    } else {
      impactAnimationFrame = null
    }
  }
  impactAnimationFrame = requestAnimationFrame(tick)
}

const checkBrowserLocationPermission = async () => {
  const setup = loadStoredProfileSetup()
  const setupPostcode = setup?.postcode?.trim()
  if (setupPostcode && /^\d{4}$/.test(setupPostcode)) {
    activeFallbackPostcode.value = setupPostcode
  } else {
    activeFallbackPostcode.value = '3000'
  }

  const shared = loadSharedLocationState()
  if (shared?.status === 'granted' && shared.coords) {
    locationStatus.value = 'granted'
    locationCoords.value = shared.coords
    return
  }

  locationStatus.value = shared?.status === 'checking' ? 'denied' : (shared?.status ?? 'denied')
  locationCoords.value = null
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

const weatherCodeToLabel = (code: number, isDay: boolean) => {
  if (code === 0) return isDay ? 'Clear Sky' : 'Clear Night'
  if (code === 1) return isDay ? 'Mainly Sunny' : 'Mainly Clear'
  if (code === 2) return 'Partly Cloudy'
  if (code === 3) return 'Overcast'
  if ([45, 48].includes(code)) return 'Foggy'
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain Showers'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow'
  if ([95, 96, 99].includes(code)) return 'Thunderstorm'
  return 'Weather'
}

const moodKey = computed(() => {
  if (FORCE_NIGHT_VIDEO) return 'cloud'

  const code = forecastSnapshot.value?.weatherCode ?? 1
  const isDay = forecastSnapshot.value?.isDay ?? true

  if ([95, 96, 99].includes(code)) return 'storm'
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow'
  if (!isDay) return 'night'
  if ([45, 48].includes(code)) return 'fog'
  if ([2, 3].includes(code)) return 'cloud'
  return 'sun'
})

const moodVideoSrc = computed(() => {
  switch (moodKey.value) {
    case 'storm':
      return '/weather-bg/storm.mp4'
    case 'rain':
      return '/weather-bg/rain.mp4'
    case 'snow':
      return '/weather-bg/cloud.mp4'
    case 'night':
      return '/weather-bg/night.mp4'
    case 'fog':
      return '/weather-bg/cloud.mp4'
    case 'cloud':
      return '/weather-bg/cloud.mp4'
    default:
      return '/weather-bg/sun.mp4'
  }
})

const dashboardToneClass = computed(() => {
  switch (moodKey.value) {
    case 'storm':
      return 'from-slate-950/40 via-indigo-900/35 to-slate-900/50'
    case 'rain':
      return 'from-slate-900/30 via-sky-900/30 to-slate-900/45'
    case 'snow':
      return 'from-slate-900/20 via-sky-900/24 to-slate-800/35'
    case 'night':
      return 'from-indigo-950/45 via-slate-900/40 to-slate-900/50'
    case 'fog':
      return 'from-slate-800/22 via-slate-700/26 to-slate-800/35'
    case 'cloud':
      return 'from-slate-800/24 via-slate-700/30 to-slate-800/38'
    default:
      return 'from-amber-700/24 via-sky-700/26 to-emerald-900/32'
  }
})

const glassCardClass = 'bg-black/22 border-white/18 shadow-[0_12px_22px_rgba(15,23,42,0.22)]'
const glassTileClass = 'bg-black/20 border-white/16 shadow-[0_6px_12px_rgba(15,23,42,0.16)]'

const uvValue = computed(() => {
  return Math.max(0, Math.min(11, forecastSnapshot.value?.uvIndex ?? 0))
})

const uvLabel = computed(() => {
  const uv = uvValue.value
  if (uv < 3) return 'Low'
  if (uv < 6) return 'Moderate'
  if (uv < 8) return 'High'
  if (uv < 11) return 'Very High'
  return 'Extreme'
})

const uvIndicatorClass = computed(() => {
  const uv = uvValue.value
  if (uv < 3) return 'text-emerald-400'
  if (uv < 6) return 'text-yellow-400'
  if (uv < 8) return 'text-orange-400'
  if (uv < 11) return 'text-rose-400'
  return 'text-fuchsia-400'
})

const uvRing = computed(() => {
  const radius = 30
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(11, uvValue.value))
  const progress = clamped / 11
  const dashOffset = circumference * (1 - progress)

  return { radius, circumference, dashOffset }
})

const conditionLabel = computed(() => {
  if (!forecastSnapshot.value) return 'Weather'
  if (isHeatwaveTomorrow.value && [95, 96, 99].includes(forecastSnapshot.value.weatherCode)) {
    return 'Severe Heat + Storm Risk'
  }
  return weatherCodeToLabel(forecastSnapshot.value.weatherCode, forecastSnapshot.value.isDay)
})

const displayTodayMinC = computed(() => {
  if (awsTodayMinMax.value) return awsTodayMinMax.value.minC
  return forecastSnapshot.value?.todayMinC ?? 0
})

const displayTodayMaxC = computed(() => {
  if (awsTodayMinMax.value) return awsTodayMinMax.value.maxC
  return forecastSnapshot.value?.todayMaxC ?? 0
})

const displayHumidityPct = computed(() => forecastSnapshot.value?.humidityPct ?? 0)
const displayWindKph = computed(() => Math.round(forecastSnapshot.value?.windKph ?? 0))

const fetchChartHourlyFromWeatherApi = async () => {
  let lat = locationCoords.value?.lat
  let lon = locationCoords.value?.lon

  if ((lat === undefined || lon === undefined) && hasValidActiveFallbackPostcode.value) {
    const resolved = await apiPost<LocationResolveResponse>('/location/resolve', {
      postcode: activeFallbackPostcode.value.trim(),
    })
    lat = resolved.coordinates?.lat ?? resolved.lat
    lon = resolved.coordinates?.lon ?? resolved.lon
  }

  if (lat === undefined || lon === undefined) {
    awsTodayMinMax.value = null
    chartHourlyFromApi.value = []
    return
  }

  const response = await apiGet<ForecastWeatherResponse>('/forecast/weather', {
    lat: String(lat),
    lon: String(lon),
  })

  const minC = Number(response.today?.minC)
  const maxC = Number(response.today?.maxC)
  awsTodayMinMax.value = Number.isFinite(minC) && Number.isFinite(maxC) ? { minC, maxC } : null

  chartHourlyFromApi.value = (response.hourly ?? [])
    .map((entry) => ({
      time: entry.time ?? '',
      tempC: Number(entry.tempC ?? 0),
    }))
    .filter((entry) => Boolean(entry.time) && Number.isFinite(entry.tempC))
}

const next12Hourly = computed(() => {
  const source = chartHourlyFromApi.value.map((entry) => ({
    time: entry.time,
    tempC: entry.tempC,
  }))
  if (!source.length) return []

  const now = new Date()
  now.setMinutes(0, 0, 0)
  const startMs = now.getTime()

  const startIndex = source.findIndex((h) => {
    const ms = new Date(h.time).getTime()
    return !Number.isNaN(ms) && ms >= startMs
  })

  if (startIndex === -1) return source.slice(0, 12)
  return source.slice(startIndex, startIndex + 12)
})

const outlookPoints = computed(() => {
  const source = next12Hourly.value
  if (!source.length) return []

  const pointIndices = [0, 3, 6]

  return pointIndices.flatMap((index, idx) => {
    const point = source[index]
    if (!point) return []
    return [
      {
        label: idx === 0 ? 'Now' : `+${idx * 3}h`,
        tempC: Math.round(point.tempC),
      },
    ]
  })
})

const outlookDelta = computed(() => {
  const points = outlookPoints.value
  if (points.length < 2) return 0
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return 0
  return last.tempC - first.tempC
})

const outlookDirection = computed<'warming' | 'cooling' | 'steady'>(() => {
  if (outlookDelta.value > 0) return 'warming'
  if (outlookDelta.value < 0) return 'cooling'
  return 'steady'
})

const loadForecastBlocks = async () => {
  if (!setupReady.value) {
    forecastSnapshot.value = null
    heroLoading.value = false
    return
  }

  try {
    const fallbackPostcode =
      !locationCoords.value?.lat || !locationCoords.value?.lon
        ? activeFallbackPostcode.value.trim()
        : undefined

    const snapshot = await fetchForecastSnapshot({
      lat: locationCoords.value?.lat,
      lon: locationCoords.value?.lon,
      postcode: fallbackPostcode,
    })

    forecastSnapshot.value = snapshot
    try {
      await fetchChartHourlyFromWeatherApi()
    } catch {
      awsTodayMinMax.value = null
      chartHourlyFromApi.value = []
    }
  } catch {
    forecastSnapshot.value = null
  } finally {
    heroLoading.value = false
  }
}

const scrollToActionFlow = () => {
  const section = document.getElementById('recommendations-banner')
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const scrollToRecommendationCards = () => {
  const section = document.getElementById('recommendation-cards')
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const scrollToActionItems = () => {
  const section = document.getElementById('action-items-list')
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const scrollToActionItemsBanner = () => {
  const section = document.getElementById('action-items-banner')
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const scrollToImpactSummary = () => {
  const section = document.getElementById('impact-summary-main')
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const scrollToNoSelectionState = () => {
  const section = document.getElementById('impact-no-selection')
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const setupRevealObserver = () => {
  revealObserver?.disconnect()
  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        revealObserver?.unobserve(entry.target)
      })
    },
    {
      threshold: 0.16,
      rootMargin: '0px 0px -8% 0px',
    },
  )
}

const refreshRevealTargets = () => {
  if (!revealObserver) setupRevealObserver()
  const revealTargets = document.querySelectorAll<HTMLElement>('.reveal-on-scroll')
  revealTargets.forEach((el) => {
    if (el.classList.contains('is-visible')) return
    revealObserver?.observe(el)
  })
}

const scrollToImpactPrelude = () => {
  const section = document.getElementById('impact-prelude')
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const impactPreludeMessages = [
  'Setting up your impact engine...',
  'Module almost done...',
  'Ready to go...',
]

const clearImpactPreludeTimers = () => {
  if (impactPreludeInterval) {
    clearInterval(impactPreludeInterval)
    impactPreludeInterval = null
  }
  if (impactPreludeFinishTimeout) {
    clearTimeout(impactPreludeFinishTimeout)
    impactPreludeFinishTimeout = null
  }
}

const startImpactPreludeFlow = async () => {
  showImpactSummary.value = true
  if (!hasSelection.value) {
    await nextTick()
    scrollToNoSelectionState()
    return
  }

  clearImpactPreludeTimers()
  impactPreludeDone.value = false
  impactPreludeActive.value = true
  impactPreludeIndex.value = 0

  await nextTick()
  scrollToImpactPrelude()

  impactPreludeInterval = window.setInterval(() => {
    if (impactPreludeIndex.value < impactPreludeMessages.length - 1) {
      impactPreludeIndex.value += 1
    }
  }, 2000)

  impactPreludeFinishTimeout = window.setTimeout(() => {
    clearImpactPreludeTimers()
    impactPreludeActive.value = false
    impactPreludeDone.value = true
    nextTick(() => {
      scrollToImpactSummary()
    })
  }, impactPreludeMessages.length * 2000)
}

const toggleCardFlip = (index: number) => {
  flippedCards.value[index] = !flippedCards.value[index]
}

const toggleActionItem = (itemId: string, checked: boolean) => {
  if (checked) {
    if (!selectedActionItems.value.includes(itemId)) {
      selectedActionItems.value.push(itemId)
    }
    return
  }

  selectedActionItems.value = selectedActionItems.value.filter((v) => v !== itemId)
}

const selectAllActions = () => {
  selectedActionItems.value = actionItems.value.map((item) => item.id)
}

const clearAllActions = () => {
  selectedActionItems.value = []
  showImpactSummary.value = false
  impactPreludeActive.value = false
  impactPreludeDone.value = false
  impactPreludeIndex.value = 0
  clearImpactPreludeTimers()
}

const loadRecommendations = async () => {
  if (!isUnlocked.value) return

  const cached = sessionStorage.getItem(SMART_ACTIONS_RESPONSE_KEY)
  if (cached) {
    try {
      apiResponse.value = JSON.parse(cached) as SmartActionsResponse
      flippedCards.value = dedupedRecommendations.value.map(() => false)
      selectedActionItems.value = selectedActionItems.value.filter((id) =>
        actionItems.value.some((item) => item.id === id),
      )
      return
    } catch {
      sessionStorage.removeItem(SMART_ACTIONS_RESPONSE_KEY)
    }
  }

  const setup = loadStoredProfileSetup()
  if (!setup) {
    errorMessage.value = 'Home Profile Setup data not found. Please complete setup again.'
    apiResponse.value = STATIC_SMART_ACTIONS_RESPONSE as unknown as SmartActionsResponse
    flippedCards.value = dedupedRecommendations.value.map(() => false)
    return
  }

  const payload = mapToSmartActionsPayload(setup)
  if (!payload.house_material || payload.appliances.length === 0 || !payload.postcode) {
    errorMessage.value = 'Home Profile Setup is incomplete for Smart Actions.'
    apiResponse.value = STATIC_SMART_ACTIONS_RESPONSE as unknown as SmartActionsResponse
    flippedCards.value = dedupedRecommendations.value.map(() => false)
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const response = await fetchSmartActionsRecommendations({
      house_profile: {
        house_material: payload.house_material,
        appliances: payload.appliances,
      },
      postcode: payload.postcode,
    })

    apiResponse.value = response
    sessionStorage.setItem(SMART_ACTIONS_RESPONSE_KEY, JSON.stringify(response))
  } catch {
    errorMessage.value = 'Live recommendations unavailable. Showing fallback recommendations.'
    apiResponse.value = STATIC_SMART_ACTIONS_RESPONSE as unknown as SmartActionsResponse
  } finally {
    flippedCards.value = dedupedRecommendations.value.map(() => false)
    selectedActionItems.value = selectedActionItems.value.filter((id) =>
      actionItems.value.some((item) => item.id === id),
    )
    loading.value = false
  }
}

onMounted(async () => {
  const heroFlow = (async () => {
    await checkBrowserLocationPermission()
    await loadForecastBlocks()
  })()

  const deferredRecommendations = new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(async () => {
        await loadRecommendations()
        resolve()
      }, 0)
    })
  })

  await Promise.all([heroFlow, deferredRecommendations])

  await nextTick()
  setupRevealObserver()
  refreshRevealTargets()

  if (route.hash === '#recommendation-cards') {
    setTimeout(() => {
      scrollToRecommendationCards()
    }, 60)
  }
})

watch(
  () => apiResponse.value,
  (value) => {
    if (!value) return
    if (route.hash !== '#recommendation-cards') return
    setTimeout(() => {
      scrollToRecommendationCards()
    }, 60)
  },
)

watch(
  () => showImpactSummary.value,
  (open) => {
    if (open && hasSelection.value) startImpactAnimation()
    nextTick(() => {
      refreshRevealTargets()
    })
  },
)

watch(
  () => impactMode.value,
  () => {
    if (showImpactSummary.value && hasSelection.value) startImpactAnimation()
  },
)

watch(
  () => impactPreludeDone.value,
  () => {
    nextTick(() => {
      refreshRevealTargets()
    })
  },
)

onBeforeUnmount(() => {
  if (impactAnimationFrame) cancelAnimationFrame(impactAnimationFrame)
  clearImpactPreludeTimers()
  revealObserver?.disconnect()
  revealObserver = null
})
</script>

<template>
  <div class="min-h-screen bg-white text-slate-900">
    <Transition name="page-overlay-fade">
      <div
        v-if="heroLoading"
        class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/92"
      >
        <div class="text-center text-white">
          <div class="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white"></div>
          <p class="mt-4 text-sm font-semibold uppercase tracking-widest text-white/85">
            Loading Smart Actions
          </p>
        </div>
      </div>
    </Transition>

    <SiteHeader />

    <section class="reveal-on-scroll w-full pb-12">
      <Transition name="hero-fade">
        <Card
          v-if="forecastSnapshot"
          key="hero-weather"
          class="relative mx-auto w-full max-w-none overflow-visible rounded-none border-transparent bg-white p-0 shadow-none"
        >
          <div class="smart-actions-hero-surface relative min-h-184 w-full overflow-visible rounded-none">
            <div class="smart-actions-hero-bg" aria-hidden="true"></div>
            <div class="smart-actions-hero-overlay" aria-hidden="true"></div>

            <Card class="hero-card hero-temp-card hero-accent-orange float-card hero-top-left rounded-2xl p-4">
              <CardHeader class="p-0">
                <CardTitle
                  class="rounded-lg bg-slate-100/80 px-3 py-1.5 text-center text-sm font-semibold tracking-wide text-slate-800"
                >
                  {{ forecastSnapshot.locationLabel }}
                </CardTitle>
              </CardHeader>
              <CardContent class="mt-3 flex items-center justify-center p-0 text-center">
                <div>
                  <p class="text-5xl font-bold leading-none text-slate-900 lg:text-6xl">
                    {{ forecastSnapshot.currentTempC.toFixed(0) }}°
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card class="hero-card hero-accent-orange float-card-delay hero-top-right rounded-2xl p-4">
              <CardContent class="p-0 text-sm">
                <p class="hero-card-label text-center text-sm uppercase tracking-wide">Today</p>
                <Thermometer class="hero-card-icon mx-auto mt-2 h-5 w-5" />
                <p class="hero-card-value mt-2 text-center text-base">
                    {{ displayTodayMaxC.toFixed(0) }}° / {{ displayTodayMinC.toFixed(0) }}°
                </p>
              </CardContent>
            </Card>

            <Card class="hero-card hero-accent-green float-card-soft hero-mid-right rounded-2xl p-4">
              <CardContent class="p-0 text-sm">
                <p class="hero-card-label text-center text-sm uppercase tracking-wide">Tomorrow</p>
                <Sun class="hero-card-icon mx-auto mt-2 h-5 w-5" />
                <p class="hero-card-value mt-2 text-center text-base">{{ forecastSnapshot.tomorrowMaxC.toFixed(0) }}° max</p>
              </CardContent>
            </Card>

            <Card class="hero-card hero-accent-green float-card-delay hero-bottom-left rounded-2xl p-4">
              <CardContent class="p-0">
                <p class="hero-card-label text-center text-lg">UV Index</p>
                <div class="mt-2 flex justify-center">
                  <div class="h-24 w-24">
                    <svg viewBox="0 0 100 100" class="h-full w-full">
                      <circle cx="50" cy="50" :r="uvRing.radius" fill="none" stroke="rgba(71,85,105,0.25)" stroke-width="8" />
                      <circle
                        cx="50"
                        cy="50"
                        :r="uvRing.radius"
                        fill="none"
                        :class="uvIndicatorClass"
                        stroke="currentColor"
                        stroke-width="8"
                        stroke-linecap="round"
                        :stroke-dasharray="uvRing.circumference"
                        :stroke-dashoffset="uvRing.dashOffset"
                        transform="rotate(-90 50 50)"
                      />
                      <text x="50" y="47" text-anchor="middle" class="fill-sky-950 text-[14px] font-extrabold">
                        {{ uvValue.toFixed(1) }}
                      </text>
                      <text x="50" y="61" text-anchor="middle" class="fill-cyan-900 text-[11px] font-extrabold">
                        {{ uvLabel }}
                      </text>
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card class="hero-card hero-accent-orange float-card hero-mid-left rounded-2xl p-4">
              <CardContent class="p-0 text-center">
                <p class="hero-card-label text-sm uppercase tracking-wide">Humidity</p>
                <Droplets class="hero-card-icon mx-auto mt-2 h-5 w-5" />
                <p class="hero-card-value mt-2 text-base">{{ displayHumidityPct }}%</p>
              </CardContent>
            </Card>

            <Card class="hero-card hero-accent-green float-card-soft hero-bottom-mid rounded-2xl p-4">
              <CardContent class="p-0 text-center">
                <p class="hero-card-label text-sm uppercase tracking-wide">Wind</p>
                <Wind class="hero-card-icon mx-auto mt-2 h-5 w-5" />
                <p class="hero-card-value mt-2 text-base">{{ displayWindKph }} km/h</p>
              </CardContent>
            </Card>

            <Card class="hero-card hero-trend-card hero-accent-orange float-card-delay hero-bottom-right rounded-2xl p-4">
              <CardHeader class="p-0">
                <CardTitle class="hero-card-label text-sm uppercase tracking-widest">Next Hours Outlook</CardTitle>
              </CardHeader>
              <CardContent class="mt-3 p-0">
                <div class="grid grid-cols-3 gap-2">
                  <div
                    v-for="point in outlookPoints"
                    :key="point.label"
                    class="rounded-lg border border-slate-300/70 bg-white/70 px-2 py-3 text-center"
                  >
                    <p class="hero-card-label text-[11px] uppercase tracking-wide">{{ point.label }}</p>
                    <p class="hero-card-value mt-1 text-lg">{{ point.tempC }}°</p>
                  </div>
                </div>
                <p class="hero-card-label mt-3 text-center text-xs uppercase tracking-wide">
                  Trend:
                  <span
                    class="ml-1 font-extrabold"
                    :class="
                      outlookDirection === 'warming'
                        ? 'text-amber-700'
                        : outlookDirection === 'cooling'
                          ? 'text-cyan-700'
                          : 'text-slate-700'
                    "
                  >
                    {{
                      outlookDirection === 'warming'
                        ? `Warming by +${Math.abs(outlookDelta).toFixed(1)}°`
                        : outlookDirection === 'cooling'
                          ? `Cooling by ${outlookDelta.toFixed(1)}°`
                          : 'Steady'
                    }}
                  </span>
                </p>
              </CardContent>
            </Card>

            <div class="hero-center-quote">
              <h1 class="text-3xl font-extrabold leading-tight text-slate-900 lg:text-5xl">
                Smart Actions, <span class="text-[var(--gb-grid)]">Smarter Outcomes.</span>
              </h1>
              <p class="mx-auto mt-3 max-w-xl text-base text-slate-700 lg:text-lg">
                Every action you choose today helps reduce pressure on the grid and climate impact tomorrow.
              </p>
              <Button
                size="lg"
                class="mt-6 bg-[var(--gb-electric)] px-8 text-white hover:bg-[#4CBB17] hover:text-white"
                @click="scrollToActionFlow"
              >
                Act Now
              </Button>
            </div>

            <div class="hero-scroll-cue-wrap">
              <button type="button" class="hero-scroll-cue" @click="scrollToActionFlow">
                <span>Scroll to explore</span>
                <span class="hero-scroll-arrow" aria-hidden="true">↓</span>
              </button>
            </div>
          </div>
        </Card>

        <div
          v-else
          key="hero-fallback"
          class="relative mx-auto flex min-h-[730px] w-full items-center justify-center overflow-hidden bg-white text-center"
        >
          <div class="smart-actions-hero-surface absolute inset-0" aria-hidden="true">
            <div class="smart-actions-hero-bg"></div>
            <div class="smart-actions-hero-overlay"></div>
          </div>
          <div class="relative z-20 px-6 text-slate-900">
            <p class="text-3xl font-extrabold leading-tight lg:text-5xl">
              Smart Actions, <span class="text-[var(--gb-grid)]">Smarter Outcomes.</span>
            </p>
            <p class="mx-auto mt-3 max-w-xl text-base text-slate-700 lg:text-lg">
              Weather context is temporarily unavailable. You can still continue with Smart Actions.
            </p>
            <Button
              size="lg"
              class="mt-6 bg-[var(--gb-electric)] px-8 text-white hover:bg-[#4CBB17] hover:text-white"
              @click="scrollToActionFlow"
            >
              Act Now
            </Button>
          </div>
        </div>
      </Transition>
    </section>

    <main id="smart-actions-flow" class="mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-10 text-center lg:px-10">
      <Card
        v-if="!isUnlocked"
        class="setup-modern-card mt-10 w-full max-w-4xl overflow-hidden text-left"
      >
        <div class="grid items-stretch gap-0 md:grid-cols-[1.05fr_1.35fr]">
          <div class="setup-media-wrap relative h-full min-h-[220px]">
            <img
              src="/home-profile-card.jpg"
              alt="Home profile setup illustration"
              class="h-full w-full object-cover"
            />
            <div class="setup-media-glow" aria-hidden="true"></div>
          </div>

          <div class="setup-content p-6 md:p-8">
            <span class="setup-chip">Step 1 to Unlock Smart Actions</span>
            <CardTitle class="mt-3 text-3xl font-extrabold leading-tight text-[var(--gb-grid)]">
              Complete Home Profile Setup
            </CardTitle>
            <p class="mt-3 text-base font-medium text-slate-700">
              Add your home details once so GreenBreeze can generate smarter, personalized recommendations.
            </p>
            <div class="mt-5 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-700">
              <span class="setup-pill">Personalized actions</span>
              <span class="setup-pill">Faster insights</span>
              <span class="setup-pill">Higher accuracy</span>
            </div>
            <Button as-child class="mt-6 bg-[var(--gb-electric)] px-7 text-white hover:bg-[#4CBB17] hover:text-white">
              <RouterLink to="/profile-setup">Set Up My Home Profile</RouterLink>
            </Button>
          </div>
        </div>
      </Card>

      <template v-else>
        <p v-if="loading" class="mt-6 text-sm font-semibold text-slate-600">Loading smart actions...</p>
        <p v-if="errorMessage" class="mt-6 text-sm font-semibold text-red-600">{{ errorMessage }}</p>

        <div id="recommendations-banner" v-if="apiResponse" class="reveal-on-scroll full-bleed relative mt-8 min-h-[190px] bg-[var(--gb-grid)] flex items-center justify-center overflow-hidden">
          <div class="pointer-events-none absolute left-0 top-1/2 z-10 h-[120px] w-[120px] -translate-y-1/2 lg:h-[320px] lg:w-[320px]">
            <DotLottieVue
              src="/lottie/decor/cherry-flowers.lottie"
              :render-config="{ devicePixelRatio: 2, autoResize: true }"
              autoplay
              loop
              style="width: 100%; height: 100%"
            />
          </div>
          <h2 class="px-8 text-center text-3xl font-extrabold tracking-tight text-white lg:text-5xl">
            Recommendations
          </h2>
          <div class="pointer-events-none absolute right-20 top-1/2 z-10 h-[120px] w-[120px] -translate-y-[58%] lg:h-[170px] lg:w-[170px]">
            <DotLottieVue
              src="/lottie/decor/bulb.lottie"
              :render-config="{ devicePixelRatio: 2, autoResize: true }"
              autoplay
              loop
              style="width: 100%; height: 100%"
            />
          </div>
        </div>

        <section id="recommendation-cards" v-if="apiResponse" class="reveal-on-scroll mt-6 w-full">

          <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div
              v-for="(card, index) in dedupedRecommendations"
              :key="card.id"
              class="flip-card h-72 w-full text-left"
            >
              <div class="flip-card-inner h-full w-full" :class="{ 'is-flipped': flippedCards[index] }">
                <Card :class="colorClass(card.color)" class="flip-card-face flip-card-front rec-card-front border bg-white text-slate-900">
                  <CardHeader class="pb-2">
                    <div class="flex items-center justify-between gap-2">
                      <p class="rec-kicker">Recommended Action</p>
                      <span
                        class="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide"
                        :class="priorityBadgeClass(card.priority)"
                      >
                        {{ card.priority }}
                      </span>
                    </div>
                    <CardTitle class="mt-2 text-lg font-extrabold leading-snug text-[var(--gb-grid)]">{{ recommendationTitle(card) }}</CardTitle>
                  </CardHeader>
                  <CardContent class="flex h-full flex-col pt-0">
                    <div class="mt-1 flex flex-wrap gap-2">
                      <span class="rec-chip">Save Energy</span>
                      <span class="rec-chip">Lower Emissions</span>
                    </div>

                    <div class="rec-summary-space" aria-hidden="true"></div>

                    <div class="mt-auto flex justify-end">
                      <button
                        type="button"
                        class="rec-link cursor-pointer text-xs font-bold underline underline-offset-2"
                        @click.stop="toggleCardFlip(index)"
                      >
                        Learn more
                      </button>
                    </div>
                  </CardContent>
                </Card>

                <Card class="flip-card-face flip-card-back rec-card-back border border-slate-200 bg-white text-slate-900">
                  <CardHeader class="pb-2">
                    <div class="flex items-center justify-between gap-2">
                      <CardTitle class="text-lg font-extrabold">Why this matters</CardTitle>
                      <span
                        class="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide"
                        :class="priorityBadgeClass(card.priority)"
                      >
                        {{ card.priority }}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent class="flex h-full flex-col pt-0">
                    <p class="text-sm leading-relaxed text-slate-700">{{ card.explanation }}</p>
                    <div class="mt-auto flex justify-end">
                      <button
                        type="button"
                        class="rec-link cursor-pointer text-xs font-bold underline underline-offset-2"
                        @click.stop="toggleCardFlip(index)"
                      >
                        Go back
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <p v-if="apiResponse" class="mt-8 text-center text-sm font-semibold text-slate-700">
          Your actions are ready for today.
          <button
            type="button"
            class="ml-1 cursor-pointer font-bold text-blue-600 underline underline-offset-2 hover:text-blue-700"
            @click="scrollToActionItemsBanner"
          >
            Click here
          </button>
          to continue to Action Items.
        </p>

        <div id="action-items-banner" class="reveal-on-scroll full-bleed relative mt-12 min-h-[210px] bg-[var(--gb-grid)] flex items-center justify-center overflow-hidden">
        <div class="pointer-events-none absolute left-0 top-1/2 z-10 h-[130px] w-[130px] -translate-y-1/2 lg:h-[450px] lg:w-[450px]">
          <DotLottieVue
            src="/lottie/decor/cherry-flowers.lottie"
            :render-config="{ devicePixelRatio: 2, autoResize: true }"
            autoplay
            loop
            style="width: 100%; height: 100%"
          />
        </div>

        <h1 class="px-20 text-center text-3xl font-bold tracking-tight text-white lg:px-40 lg:text-5xl">
          Action items for Today
        </h1>

        <div class="pointer-events-none absolute right-25 top-1/2 z-10 h-[130px] w-[130px] -translate-y-[60%] lg:h-[200px] lg:w-[200px]">
          <DotLottieVue
            src="/lottie/decor/bulb.lottie"
            :render-config="{ devicePixelRatio: 2, autoResize: true }"
            autoplay
            loop
            style="width: 100%; height: 100%"
          />
        </div>
      </div>

        <section id="action-items-list" v-if="apiResponse" class="reveal-on-scroll mt-10 w-full">

          <div class="mx-auto mt-4 flex w-full max-w-2xl items-center justify-center gap-2">
            <button
              type="button"
              class="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              @click="selectAllActions"
            >
              Select all
            </button>
            <button
              type="button"
              class="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              @click="clearAllActions"
            >
              Clear all
            </button>
          </div>

          <div class="mx-auto mt-4 w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div class="overflow-x-auto">
              <table class="w-full min-w-[760px] text-left">
                <thead class="bg-slate-50">
                  <tr class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
                    <th class="px-4 py-3 font-bold">Select</th>
                    <th class="px-4 py-3 font-bold">Action Item</th>
                    <th class="px-4 py-3 font-bold">Priority</th>
                    <th class="px-4 py-3 font-bold">Status</th>
                    <th class="px-4 py-3 text-center font-bold">Completed</th>
                    <th class="px-4 py-3 text-center font-bold">Not Completed</th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="group in groupedActionItems" :key="group.recommendationId">
                    <tr class="border-b border-slate-200 bg-slate-50/70">
                      <td class="px-3 py-3"></td>
                      <td class="px-3 py-3 text-sm font-extrabold" :class="group.isComplete ? 'text-emerald-700' : 'text-slate-900'">
                        {{ group.title }}
                      </td>
                      <td class="px-4 py-3">
                        <span
                          class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide"
                          :class="priorityBadgeClass(group.priority)"
                        >
                          {{ group.priority }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-sm font-bold" :class="group.isComplete ? 'text-emerald-700' : 'text-slate-500'">
                        {{ group.completed }}/{{ group.total }} completed
                      </td>
                      <td class="px-4 py-3 text-center">
                        <span class="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-black" :class="group.isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'">
                          {{ group.isComplete ? '✓' : '✕' }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-center">
                        <span class="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-black" :class="group.isComplete ? 'bg-slate-100 text-slate-400' : 'bg-rose-100 text-rose-700'">
                          {{ group.isComplete ? '✕' : '✓' }}
                        </span>
                      </td>
                    </tr>

                    <tr
                      v-for="item in group.steps"
                      :key="item.id"
                      class="border-b border-slate-100 transition hover:bg-slate-50/70"
                    >
                      <td class="px-4 py-3">
                        <Checkbox
                          :model-value="selectedActionItems.includes(item.id)"
                          @update:model-value="(checked) => toggleActionItem(item.id, Boolean(checked))"
                        />
                      </td>
                      <td class="px-8 py-3 text-sm font-semibold text-slate-700">
                        <div class="flex items-start gap-3">
                          <span class="mt-0.5 rounded-md border border-rose-200 bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                            Step {{ item.stepNumber }}
                          </span>
                          <p class="flex-1 leading-snug">
                            {{ item.instruction }}
                          </p>
                        </div>
                      </td>
                      <td class="px-4 py-3"></td>
                      <td class="px-4 py-3 text-sm font-semibold">
                        <span :class="selectedActionItems.includes(item.id) ? 'text-emerald-700' : 'text-slate-500'">
                          {{ selectedActionItems.includes(item.id) ? 'Completed' : 'Pending' }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-center">
                        <span
                          class="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-black"
                          :class="
                            selectedActionItems.includes(item.id)
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-400'
                          "
                        >
                          {{ selectedActionItems.includes(item.id) ? '✓' : '✕' }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-center">
                        <span
                          class="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-black"
                          :class="
                            selectedActionItems.includes(item.id)
                              ? 'bg-slate-100 text-slate-400'
                              : 'bg-rose-100 text-rose-700'
                          "
                        >
                          {{ selectedActionItems.includes(item.id) ? '✕' : '✓' }}
                        </span>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>

          <button
            type="button"
            class="mt-8 rounded-lg bg-[var(--gb-electric)] px-6 py-2 text-sm font-bold text-white hover:bg-[#4CBB17] hover:text-white"
            @click="startImpactPreludeFlow"
          >
            Estimate Impact
          </button>

          <div
            id="impact-no-selection"
            v-if="showImpactSummary && !hasSelection"
            class="mx-auto mt-10 w-full max-w-5xl p-6 text-left md:p-8"
          >
            <div class="grid items-center gap-6 md:grid-cols-[1.3fr_1fr]">
              <div>
                <p class="text-2xl font-extrabold leading-tight text-rose-800 md:text-3xl">
                  You didn&apos;t even complete a single action? We are sad.
                </p>
                <p class="mt-4 text-base font-semibold text-slate-700">
                  Suggestion: Start with one quick action today and re-estimate impact to unlock your personalized climate and savings insights.
                </p>
              </div>
              <div class="mx-auto h-52 w-52 md:h-64 md:w-64">
                <DotLottieVue
                  src="/lottie/decor/sad-emotion.lottie"
                  :render-config="{ devicePixelRatio: 2, autoResize: true }"
                  autoplay
                  loop
                  style="width: 100%; height: 100%"
                />
              </div>
            </div>
          </div>
        </section>

        <section v-if="apiResponse && showImpactSummary && hasSelection" class="mt-10 w-full">

          <div class="full-bleed relative mt-12 min-h-[210px] bg-[var(--gb-grid)] flex items-center justify-center overflow-hidden">
            <div class="pointer-events-none absolute left-0 top-1/2 z-10 h-[130px] w-[130px] -translate-y-1/2 lg:h-[450px] lg:w-[450px]">
              <DotLottieVue
                src="/lottie/decor/cherry-flowers.lottie"
                :render-config="{ devicePixelRatio: 2, autoResize: true }"
                autoplay
                loop
                style="width: 100%; height: 100%"
              />
            </div>

            <h1 class="px-20 text-center text-3xl font-bold tracking-tight text-white lg:px-40 lg:text-5xl">
              Your Impact
            </h1>

            <div class="pointer-events-none absolute right-25 top-1/2 z-10 h-[130px] w-[130px] -translate-y-[60%] lg:h-[200px] lg:w-[200px]">
              <DotLottieVue
                src="/lottie/decor/bulb.lottie"
                :render-config="{ devicePixelRatio: 2, autoResize: true }"
                autoplay
                loop
                style="width: 100%; height: 100%"
              />
            </div>
          </div>

          <div
            id="impact-prelude"
            class="mx-auto mt-0 w-full max-w-6xl"
            v-if="impactPreludeActive || !impactPreludeDone"
          >
            <div class="grid min-h-[66vh] items-center gap-10 py-8 md:grid-cols-[1.2fr_1fr]">
              <div class="text-center md:text-left">
                <p class="text-4xl font-extrabold leading-[1.05] md:text-6xl">
                  <span class="text-slate-900">Your action</span>
                  <br />
                  <span class="text-[var(--gb-grid)]">from today</span>
                  <br />
                  <span class="text-slate-900">saves the</span>
                  <br />
                  <span class="text-[var(--gb-grid)]">climate</span>
                  <span class="text-slate-900"> of </span>
                  <span class="text-[var(--gb-electric)]">tomorrow.</span>
                </p>

                <div class="mt-10 max-w-xl space-y-1.5">
                  <p
                    v-for="(line, idx) in impactPreludeMessages"
                    :key="line"
                    class="text-lg font-semibold transition-all duration-500 md:text-xl"
                    :class="
                      idx === impactPreludeIndex
                        ? 'translate-y-0 text-slate-900 opacity-100'
                        : idx < impactPreludeIndex
                          ? '-translate-y-0.5 text-slate-400 opacity-55'
                          : 'translate-y-0.5 text-slate-500 opacity-70'
                    "
                  >
                    {{ line }}
                  </p>
                </div>
              </div>

              <div class="mx-auto h-[320px] w-[320px] md:h-[440px] md:w-[440px]">
                <DotLottieVue
                  src="/lottie/decor/impact-right.lottie"
                  :render-config="{ devicePixelRatio: 2, autoResize: true }"
                  autoplay
                  loop
                  style="width: 100%; height: 100%"
                />
              </div>
            </div>
          </div>
          
          <div id="impact-summary-main" class="mx-auto mt-12 w-full max-w-6xl" v-if="impactPreludeDone">
            <div class="flex flex-wrap items-center justify-center gap-4 py-10">
              <div class="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1.5">
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition"
                  :class="impactMode === 'climate' ? 'bg-[var(--gb-grid)] text-white' : 'text-slate-700 hover:bg-white'"
                  @click="impactMode = 'climate'"
                >
                  <img src="/impact-icons/climate-change.png" alt="Climate mode" class="h-4 w-4 object-contain" />
                  Climate Mode
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition"
                  :class="impactMode === 'money' ? 'bg-[var(--gb-electric)] text-white' : 'text-slate-700 hover:bg-white'"
                  @click="impactMode = 'money'"
                >
                  <img src="/impact-icons/dollar.png" alt="Money mode" class="h-4 w-4 object-contain" />
                  Money Mode
                </button>
              </div>
              <p class="inline-flex items-center justify-center gap-2 text-sm font-semibold text-slate-600">
                <img src="/impact-icons/completed.png" alt="Completed activities" class="h-4 w-4 object-contain" />
                {{ selectedCount }} of {{ actionItems.length }} actions completed
              </p>
            </div>

            <div class="mt-6 text-center">
              <p class="text-lg font-extrabold leading-snug md:text-2xl">
                <template v-if="impactMode === 'climate'">
                  <span class="text-slate-900">You captured </span>
                  <span class="text-[var(--gb-grid)]">{{ Math.round(completionRate * 100) }}%</span>
                  <span class="text-slate-900"> of today's climate opportunity. Completing remaining actions could avoid another </span>
                  <span class="text-[var(--gb-grid)]">{{ missedImpact.co2.toFixed(2) }} kg CO2</span>
                  <span class="text-slate-900">.</span>
                </template>
                <template v-else>
                  <span class="text-slate-900">You captured </span>
                  <span class="text-[var(--gb-electric)]">{{ Math.round(completionRate * 100) }}%</span>
                  <span class="text-slate-900"> of today's savings opportunity. Completing remaining actions could unlock an extra </span>
                  <span class="text-[var(--gb-electric)]">${{ missedImpact.money.toFixed(2) }}</span>
                  <span class="text-slate-900">.</span>
                </template>
              </p>
            </div>

            <div class="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div
                v-for="item in impactMode === 'climate' ? animatedClimateCards : animatedMoneyCards"
                :key="item.label"
                class="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.35)]"
              >
                <div class="mb-4 flex items-center gap-3">
                  <span
                    class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm"
                  >
                    <img
                      :src="impactIconForCard(item.label, impactMode)"
                      :alt="`${item.label} icon`"
                      class="h-full w-full object-contain"
                    />
                  </span>
                  <p class="text-center text-xs font-bold uppercase tracking-wide text-slate-500">{{ item.label }}</p>
                </div>
                <p class="text-center text-4xl font-extrabold text-slate-900">{{ item.value }}</p>
                <p
                  class="mt-2 text-center text-xs font-bold"
                  :class="item.delta >= 0 ? 'text-emerald-700' : 'text-rose-700'"
                >
                  {{ formatDelta(item.delta) }}
                </p>
              </div>
            </div>

            <div v-if="impactMode === 'money'" class="mt-8 grid gap-4 md:grid-cols-3">
              <Card class="border border-amber-200 bg-amber-50/70">
                <CardContent class="py-4 text-center">
                  <img src="/impact-icons/peak.png" alt="Peak split" class="mx-auto h-8 w-8 object-contain" />
                  <p class="text-xs font-bold uppercase tracking-wide text-amber-800">Peak Window Savings</p>
                  <p class="mt-1 text-2xl font-extrabold text-amber-900">${{ moneyTimeSplit.peak.toFixed(2) }}</p>
                </CardContent>
              </Card>
              <Card class="border border-teal-200 bg-teal-50/70">
                <CardContent class="py-4 text-center">
                  <img src="/impact-icons/shift.png" alt="Shift split" class="mx-auto h-8 w-8 object-contain" />
                  <p class="text-xs font-bold uppercase tracking-wide text-teal-800">Shifting Savings</p>
                  <p class="mt-1 text-2xl font-extrabold text-teal-900">${{ moneyTimeSplit.shifting.toFixed(2) }}</p>
                </CardContent>
              </Card>
              <Card class="border border-slate-200 bg-slate-50/80">
                <CardContent class="py-4 text-center">
                  <img src="/impact-icons/off-peak.png" alt="Off-peak split" class="mx-auto h-8 w-8 object-contain" />
                  <p class="text-xs font-bold uppercase tracking-wide text-slate-700">Off-Peak Savings</p>
                  <p class="mt-1 text-2xl font-extrabold text-slate-900">${{ moneyTimeSplit.offpeak.toFixed(2) }}</p>
                </CardContent>
              </Card>
            </div>

            <div class="mt-16">
              <div class="mb-5 flex flex-col items-center justify-center gap-1">
                <h4
                  class="text-center text-2xl font-extrabold tracking-tight md:text-3xl"
                  :class="impactMode === 'climate' ? 'text-[var(--gb-grid)]' : 'text-[var(--gb-electric)]'"
                >
                  {{ impactMode === 'climate' ? '7-Day Climate Impact (kg CO2)' : '7-Day Savings (AUD)' }}
                </h4>
                <p class="text-center text-xs font-semibold text-slate-500">
                  Based on your current completion rate
                </p>
              </div>
              <div class="grid grid-cols-7 gap-4">
                <div v-for="bar in monthlySeries" :key="bar.label" class="flex flex-col items-center gap-2">
                  <div
                    class="group relative flex h-48 w-full items-end rounded-xl border border-slate-100 bg-slate-50 p-1.5"
                    :title="`${bar.label}: ${bar.value} ${impactMode === 'climate' ? 'kg CO2' : 'AUD'}`"
                  >
                    <div
                      class="w-full rounded-lg"
                      :class="impactMode === 'climate' ? 'bg-gradient-to-t from-emerald-500 to-emerald-300' : 'bg-gradient-to-t from-amber-500 to-amber-300'"
                      :style="{ height: `${bar.heightPct}%` }"
                    ></div>
                    <span class="pointer-events-none absolute -top-8 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-bold text-white shadow-md group-hover:block">
                      {{ bar.label }}: {{ bar.value }} {{ impactMode === 'climate' ? 'kg CO2' : 'AUD' }}
                    </span>
                  </div>
                  <p class="text-[11px] font-bold text-slate-600">{{ bar.label }}</p>
                  <p class="text-[11px] font-semibold text-slate-500">{{ bar.value }}</p>
                </div>
              </div>
            </div>

            <div class="mt-16">
              <h4
                class="text-center text-2xl font-extrabold tracking-tight md:text-3xl"
                :class="impactMode === 'climate' ? 'text-[var(--gb-grid)]' : 'text-[var(--gb-electric)]'"
              >
                {{ impactMode === 'climate' ? "Climate Equivalents for Today's Actions" : "Money Equivalents for Today's Actions" }}
              </h4>

              <div
                v-if="impactMode === 'climate'"
                class="mt-4 grid gap-5 md:grid-cols-2"
              >
                <div
                  v-for="eq in impactEquivalents"
                  :key="`climate-${eq.label}`"
                  class="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-center shadow-[0_16px_32px_-18px_rgba(5,150,105,0.55)]"
                >
                  <div class="flex items-center justify-center gap-2">
                    <img
                      :src="equivalentIconForLabel(eq.label, 'climate')"
                      :alt="`${eq.label} icon`"
                      class="h-10 w-10 object-contain"
                    />
                    <p class="text-2xl font-extrabold text-emerald-900">{{ eq.value.toFixed(1) }} {{ eq.unit }}</p>
                  </div>
                  <p class="mt-2 text-sm font-semibold text-emerald-800">{{ eq.label }}</p>
                </div>
              </div>

              <div
                v-else
                class="mt-4 grid gap-5 md:grid-cols-2"
              >
                <div
                  v-for="eq in moneyEquivalents"
                  :key="`money-${eq.label}`"
                  class="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-center shadow-[0_16px_32px_-18px_rgba(217,119,6,0.5)]"
                >
                  <div class="flex items-center justify-center gap-2">
                    <img
                      :src="equivalentIconForLabel(eq.label, 'money')"
                      :alt="`${eq.label} icon`"
                      class="h-10 w-10 object-contain"
                    />
                    <p class="text-2xl font-extrabold text-amber-900">{{ eq.value.toFixed(2) }} {{ eq.unit }}</p>
                  </div>
                  <p class="mt-2 text-sm font-semibold text-amber-800">{{ eq.label }}</p>
                </div>
                <p v-if="!moneyEquivalents.length" class="text-sm font-semibold text-slate-500">
                  Money equivalents currently unavailable for selected actions.
                </p>
              </div>
            </div>

            <div class="mt-12 grid gap-6 lg:grid-cols-3">
              <Card :class="impactMode === 'money' ? 'border border-amber-200 bg-amber-50/70' : 'border border-emerald-200 bg-emerald-50/70'">
                <CardContent class="py-5 text-center">
                  <p
                    class="text-xs font-bold uppercase tracking-wide"
                    :class="impactMode === 'money' ? 'text-amber-700' : 'text-emerald-700'"
                  >
                    Missed Opportunity
                  </p>
                  <p class="mt-1 text-xl font-extrabold" :class="impactMode === 'money' ? 'text-amber-900' : 'text-emerald-900'">
                    {{ impactMode === 'climate' ? `${missedImpact.co2.toFixed(2)} kg CO2` : `$${missedImpact.money.toFixed(2)}` }}
                  </p>
                  <p class="mt-1 text-xs font-semibold" :class="impactMode === 'money' ? 'text-amber-800' : 'text-emerald-800'">Unlocked if all actions are completed.</p>
                </CardContent>
              </Card>
              <Card class="border border-slate-200 bg-white lg:col-span-2">
                <CardContent class="py-5 text-center">
                  <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Why this is valuable</p>
                  <p class="mt-1 text-sm font-semibold text-slate-700">
                    You are seeing both realized impact and opportunity gap. This helps you decide where one extra completed action gives the highest return for climate and cost.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </template>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.smart-actions-hero-surface {
  background: #ffffff;
}

.smart-actions-hero-bg {
  position: absolute;
  inset: 0;
  background-image: url('/smart-actions-doodle-bg.png');
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 1;
  z-index: 0;
}

.smart-actions-hero-overlay {
  position: absolute;
  inset: 0;
  background: transparent;
  z-index: 1;
}

.hero-card {
  position: absolute;
  width: min(17.5vw, 248px);
  z-index: 20;
  border: 1px solid rgba(47, 127, 121, 0.22);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  box-shadow:
    0 14px 32px rgba(15, 23, 42, 0.12),
    0 1px 0 rgba(255, 255, 255, 0.7) inset;
  transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
}

.hero-card-label {
  color: #0f3f5f;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.45);
}

.hero-card-value {
  color: #072f49;
  font-weight: 900;
  letter-spacing: 0.01em;
}

.hero-card-icon {
  color: #0b5e8a;
  filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.45));
}

.hero-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 14px;
  right: 14px;
  height: 3px;
  border-radius: 999px;
  opacity: 0.95;
}

.hero-card:hover {
  transform: translateY(-3px);
  box-shadow:
    0 18px 36px rgba(15, 23, 42, 0.16),
    0 1px 0 rgba(255, 255, 255, 0.75) inset;
}

.hero-accent-green::before {
  background: linear-gradient(90deg, #0ea5e9 0%, #2f7f79 100%);
}

.hero-accent-orange::before {
  background: linear-gradient(90deg, #f0aa3c 0%, #f59e0b 100%);
}

.hero-accent-green {
  background: rgba(14, 165, 233, 0.07);
  border-color: rgba(14, 165, 233, 0.2);
}

.hero-accent-orange {
  background: rgba(240, 170, 60, 0.13);
  border-color: rgba(240, 170, 60, 0.32);
}

.hero-primary-card {
  background: rgba(14, 165, 233, 0.1);
  border-color: rgba(14, 165, 233, 0.24);
  box-shadow:
    0 18px 38px rgba(15, 23, 42, 0.16),
    0 1px 0 rgba(255, 255, 255, 0.75) inset;
}

.hero-temp-card {
  width: min(22vw, 316px);
}

.hero-trend-card {
  width: min(22vw, 340px);
  min-height: 220px;
}

.hero-top-left {
  top: 16%;
  left: 6%;
}

.hero-top-right {
  top: 8%;
  right: 7%;
}

.hero-bottom-left {
  top: 60%;
  left: 7%;
}

.hero-mid-right {
  top: 8%;
  right: 42%;
}

.hero-mid-left {
  top: 73%;
  left: 30%;
}

.hero-bottom-mid {
  top: 77%;
  left: 55%;
}

.hero-bottom-right {
  top: 43%;
  right: 4%;
}

.hero-center-quote {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(56vw, 700px);
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 40;
}

.hero-scroll-cue-wrap {
  position: absolute;
  left: 50%;
  bottom: -28px;
  transform: translateX(-50%);
  z-index: 45;
}

.hero-scroll-cue {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  border: 1px solid rgb(15 23 42 / 0.08);
  background: rgb(255 255 255 / 0.78);
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: rgb(71 85 105);
  backdrop-filter: blur(6px);
  transition:
    border-color 200ms ease,
    background-color 200ms ease,
    color 200ms ease;
}

.hero-scroll-cue:hover {
  border-color: rgb(13 148 136 / 0.24);
  color: rgb(30 41 59);
  background: rgb(255 255 255 / 0.92);
}

.hero-scroll-arrow {
  display: inline-block;
  font-size: 12px;
  animation: cueBob 2.5s ease-in-out infinite;
}

.full-bleed {
  width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
}

@media (max-width: 1100px) {
  .hero-card {
    position: static;
    width: 100%;
  }

  .hero-center-quote {
    position: static;
    width: 100%;
    transform: none;
    margin-top: 1rem;
    margin-bottom: 1rem;
  }
}

.float-card {
  animation: cardFloat 5.2s ease-in-out infinite;
}

.float-card-delay {
  animation: cardFloat 6.1s ease-in-out infinite;
}

.float-card-soft {
  animation: cardFloat 7s ease-in-out infinite;
}

.flip-card {
  perspective: 1000px;
}

.flip-card-inner {
  position: relative;
  height: 100%;
  width: 100%;
  transform-style: preserve-3d;
  transition: transform 0.35s ease;
}

.flip-card-inner.is-flipped {
  transform: rotateY(180deg);
}

.flip-card-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
}

.flip-card-front,
.flip-card-back {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.flip-card-back {
  transform: rotateY(180deg);
}

.rec-card-front {
  position: relative;
  border-width: 1.5px;
  box-shadow:
    0 12px 26px rgba(15, 23, 42, 0.09),
    0 1px 0 rgba(255, 255, 255, 0.7) inset;
}

.rec-card-back {
  border-width: 1.5px;
  box-shadow:
    0 12px 24px rgba(15, 23, 42, 0.08),
    0 1px 0 rgba(255, 255, 255, 0.7) inset;
}

.rec-card-front::before {
  content: '';
  position: absolute;
  top: 0;
  left: 10px;
  right: 10px;
  height: 3px;
  border-top-left-radius: 0.75rem;
  border-top-right-radius: 0.75rem;
  opacity: 0.95;
}

.rec-tone-red {
  border-color: rgba(239, 68, 68, 0.35);
}

.rec-tone-red::before {
  background: linear-gradient(90deg, #ef4444 0%, #f97316 100%);
}

.rec-tone-yellow {
  border-color: rgba(245, 158, 11, 0.36);
}

.rec-tone-yellow::before {
  background: linear-gradient(90deg, #f59e0b 0%, #facc15 100%);
}

.rec-tone-green {
  border-color: rgba(6, 207, 6, 0.42);
  color: #067a06;
}

.rec-tone-green::before {
  background: linear-gradient(90deg, #4cbb17 0%, #06cf06 100%);
}

.rec-kicker {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #0f766e;
}

.rec-summary {
  color: #475569;
  font-weight: 600;
  line-height: 1.5;
}

.rec-summary-space {
  min-height: 3.25rem;
}

.rec-tone-green .rec-kicker,
.rec-tone-green .rec-link,
.rec-tone-green .rec-summary {
  color: #067a06;
}

.rec-chip {
  border-radius: 999px;
  border: 1px solid rgba(100, 116, 139, 0.25);
  background: rgba(248, 250, 252, 0.95);
  padding: 0.18rem 0.56rem;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #475569;
}

.rec-link {
  color: #0f5f8d;
}

.rec-link:hover {
  color: #0c4a6e;
}

.hero-fade-enter-active,
.hero-fade-leave-active {
  transition: opacity 380ms ease;
}

.hero-fade-enter-from,
.hero-fade-leave-to {
  opacity: 0;
}

.hero-fade-leave-active {
  position: absolute;
  inset: 0;
  z-index: 60;
}

.page-overlay-fade-enter-active,
.page-overlay-fade-leave-active {
  transition: opacity 320ms ease;
}

.page-overlay-fade-enter-from,
.page-overlay-fade-leave-to {
  opacity: 0;
}

.reveal-on-scroll {
  opacity: 0;
  transform: translateY(26px) scale(0.99);
  filter: blur(1px);
  transition:
    opacity 700ms ease,
    transform 700ms ease,
    filter 700ms ease;
  will-change: opacity, transform;
}

.reveal-on-scroll.is-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}

.setup-modern-card {
  border: 1px solid rgba(148, 163, 184, 0.28);
  background:
    linear-gradient(130deg, rgba(255, 255, 255, 0.97) 0%, rgba(241, 245, 249, 0.96) 100%);
  box-shadow:
    0 20px 48px rgba(15, 23, 42, 0.1),
    0 1px 0 rgba(255, 255, 255, 0.82) inset;
}

.setup-media-wrap {
  border-right: 1px solid rgba(148, 163, 184, 0.24);
  background: linear-gradient(135deg, rgba(240, 170, 60, 0.16), rgba(14, 165, 233, 0.14));
  overflow: hidden;
  min-height: 100%;
}

.setup-media-wrap img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: center;
  transform: scale(1);
  transform-origin: center;
}

.setup-media-glow {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 78% 15%, rgba(14, 165, 233, 0.22) 0%, rgba(14, 165, 233, 0) 48%),
    linear-gradient(180deg, rgba(2, 132, 199, 0.04) 0%, rgba(2, 132, 199, 0.14) 100%);
  pointer-events: none;
}

.setup-chip {
  display: inline-flex;
  border-radius: 999px;
  border: 1px solid rgba(47, 127, 121, 0.24);
  background: rgba(47, 127, 121, 0.1);
  padding: 0.3rem 0.7rem;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #0f766e;
}

.setup-pill {
  border-radius: 999px;
  border: 1px solid rgba(100, 116, 139, 0.25);
  background: rgba(248, 250, 252, 0.95);
  padding: 0.3rem 0.68rem;
}

@keyframes cardFloat {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@keyframes cueBob {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.9;
  }
  50% {
    transform: translateY(4px);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal-on-scroll {
    opacity: 1;
    transform: none;
    filter: none;
    transition: none;
  }
}
</style>
