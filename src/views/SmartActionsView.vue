<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
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
const apiResponse = ref<SmartActionsResponse | null>(null)
const flippedCards = ref<boolean[]>([])
const selectedActionItems = ref<string[]>([])

const isUnlocked = computed(() => sessionStorage.getItem(SMART_ACTIONS_UNLOCKED_KEY) === 'true')
const hasSelection = computed(() => selectedActionItems.value.length > 0)
const selectedCount = computed(() => selectedActionItems.value.length)

const colorClass = (color: SmartActionRecommendation['color']) => {
  if (color === 'RED') return 'border-red-300 bg-red-50 text-red-800'
  if (color === 'YELLOW') return 'border-yellow-300 bg-yellow-50 text-yellow-800'
  return 'border-emerald-300 bg-emerald-50 text-emerald-800'
}

const priorityBadgeClass = (priority: SmartActionRecommendation['priority']) => {
  if (priority === 'HIGH') return 'bg-red-900 text-white'
  if (priority === 'MEDIUM') return 'bg-yellow-700 text-white'
  return 'bg-emerald-900 text-white'
}

const recommendationTitle = (rec: SmartActionRecommendation) => {
  return rec.short_reason?.trim() || rec.appliance.replaceAll('_', ' ')
}

const actionItems = computed(() =>
  (apiResponse.value?.recommendations ?? []).map((rec) => recommendationTitle(rec)),
)

const impactSummary = computed(() => {
  const recommendations = apiResponse.value?.recommendations ?? []
  const selectedRecommendations = recommendations.filter((rec) =>
    selectedActionItems.value.includes(recommendationTitle(rec)),
  )

  const totalKwh = selectedRecommendations.reduce(
    (sum, rec) => sum + (rec.action.impact?.avoided_kwh ?? 0),
    0,
  )
  const totalCo2 = selectedRecommendations.reduce(
    (sum, rec) => sum + (rec.action.impact?.avoided_emissions_kg_co2 ?? 0),
    0,
  )
  const peakReduction = selectedRecommendations.reduce(
    (sum, rec) => sum + (rec.action.impact?.peak_reduction_pct ?? 0),
    0,
  )

  return [
    { value: `${totalCo2.toFixed(2)} kg`, label: 'CO2 emissions avoided' },
    { value: `${peakReduction.toFixed(1)}%`, label: 'Peak load reduction' },
    { value: `${totalKwh.toFixed(2)} kWh`, label: 'Energy shifted off-peak' },
    { value: `${selectedRecommendations.length}`, label: 'Recommendations completed' },
  ]
})

const toggleCardFlip = (index: number) => {
  flippedCards.value[index] = !flippedCards.value[index]
}

const toggleActionItem = (item: string, checked: boolean) => {
  if (checked) {
    if (!selectedActionItems.value.includes(item)) {
      selectedActionItems.value.push(item)
    }
    return
  }

  selectedActionItems.value = selectedActionItems.value.filter((v) => v !== item)
}

const selectAllActions = () => {
  selectedActionItems.value = [...actionItems.value]
}

const clearAllActions = () => {
  selectedActionItems.value = []
  showImpactSummary.value = false
}

const loadRecommendations = async () => {
  if (!isUnlocked.value) return

  const cached = sessionStorage.getItem(SMART_ACTIONS_RESPONSE_KEY)
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as SmartActionsResponse
      apiResponse.value = parsed
      flippedCards.value = parsed.recommendations.map(() => false)
      return
    } catch {
      sessionStorage.removeItem(SMART_ACTIONS_RESPONSE_KEY)
    }
  }

  const setup = loadStoredProfileSetup()
  if (!setup) {
    errorMessage.value = 'Profile setup data not found. Please complete setup again.'
    return
  }

  const payload = mapToSmartActionsPayload(setup)
  if (!payload.wall_type || payload.appliances.length === 0 || !payload.postcode) {
    errorMessage.value = 'Profile setup is incomplete for Smart Actions.'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const response = await fetchSmartActionsRecommendations({
      wall_type: payload.wall_type,
      appliances: payload.appliances,
      postcode: payload.postcode,
    })
    apiResponse.value = response
    flippedCards.value = response.recommendations.map(() => false)
    sessionStorage.setItem(SMART_ACTIONS_RESPONSE_KEY, JSON.stringify(response))
  } catch {
    errorMessage.value = 'Unable to load smart actions recommendations right now.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadRecommendations()
})
</script>

<template>
  <div class="min-h-screen bg-white text-slate-900">
    <SiteHeader />

    <main class="mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-10 text-center lg:px-10">
      <h1 class="text-3xl font-extrabold tracking-tight text-[var(--gb-grid)] lg:text-4xl">Smart Actions</h1>

      <Card
        v-if="!isUnlocked"
        class="mt-10 w-full max-w-xl border border-amber-200 bg-amber-50 text-center"
      >
        <CardHeader>
          <CardTitle class="text-2xl font-bold text-amber-900">Complete Profile Setup First</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-amber-800">
            You need to complete and submit your profile setup before Smart Actions can be generated.
          </p>
          <Button as-child class="mt-5 bg-[var(--gb-electric)] text-white hover:bg-amber-300">
            <RouterLink to="/profile-setup">Go to Profile Setup</RouterLink>
          </Button>
        </CardContent>
      </Card>

      <template v-else>
        <p v-if="loading" class="mt-6 text-sm font-semibold text-slate-600">Loading smart actions...</p>
        <p v-if="errorMessage" class="mt-6 text-sm font-semibold text-red-600">{{ errorMessage }}</p>

        <section v-if="apiResponse" class="mt-8 w-full">
          <h2 class="text-2xl font-bold">Recommendations</h2>

          <div class="mt-5 grid gap-4 md:grid-cols-2">
            <div
              v-for="(card, index) in apiResponse.recommendations"
              :key="card.id"
              class="flip-card h-52 w-full text-left"
            >
              <div class="flip-card-inner h-full w-full" :class="{ 'is-flipped': flippedCards[index] }">
                <Card :class="colorClass(card.color)" class="flip-card-face flip-card-front border">
                  <CardHeader>
                    <div class="flex items-start justify-between gap-2">
                      <CardTitle class="text-lg font-bold">{{ recommendationTitle(card) }}</CardTitle>
                      <span
                        class="rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
                        :class="priorityBadgeClass(card.priority)"
                      >
                        {{ card.priority }}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent class="flex h-full flex-col pt-0">
                    <div class="mt-auto flex justify-end">
                      <button
                        type="button"
                        class="cursor-pointer text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
                        @click.stop="toggleCardFlip(index)"
                      >
                        Learn more
                      </button>
                    </div>
                  </CardContent>
                </Card>

                <Card class="flip-card-face flip-card-back border border-slate-200 bg-white text-slate-900">
                  <CardHeader>
                    <div class="flex items-start justify-between gap-2">
                      <CardTitle class="text-lg font-bold">Why this matters</CardTitle>
                      <span
                        class="rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
                        :class="priorityBadgeClass(card.priority)"
                      >
                        {{ card.priority }}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent class="flex h-full flex-col pt-0">
                    <p class="text-sm text-slate-700">{{ card.explanation }}</p>
                    <div class="mt-auto flex justify-end">
                      <button
                        type="button"
                        class="cursor-pointer text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
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

        <section v-if="apiResponse" class="mt-10 w-full">
          <h2 class="text-2xl font-bold">Action Items</h2>
          <p class="mx-auto mt-2 max-w-2xl text-sm text-slate-700">
            Select only the actions you completed today (choose any that apply).
          </p>

          <div class="mx-auto mt-4 flex w-full max-w-2xl items-center justify-end gap-2">
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

          <div class="mx-auto mt-3 flex w-full max-w-2xl flex-col gap-3 text-left">
            <label
              v-for="item in actionItems"
              :key="item"
              class="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <Checkbox
                :model-value="selectedActionItems.includes(item)"
                @update:model-value="(checked) => toggleActionItem(item, Boolean(checked))"
              />
              <span class="text-sm font-medium text-slate-800">{{ item }}</span>
            </label>
          </div>

          <button
            type="button"
            class="mt-5 rounded-lg bg-[var(--gb-electric)] px-6 py-2 text-sm font-bold text-white hover:bg-amber-300"
            @click="showImpactSummary = true"
          >
            Estimate Impact
          </button>

          <div
            v-if="showImpactSummary && !hasSelection"
            class="mx-auto mt-4 w-full max-w-2xl rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-left"
          >
            <p class="text-sm font-semibold text-amber-700">
              No actions selected yet. Choose at least one completed action to calculate impact.
            </p>
            <p class="mt-1 text-sm font-bold text-emerald-900">
              Suggestion: Next time, pre-cool your living room 60-90 minutes before peak hours to reduce emissions and peak load.
            </p>
          </div>
        </section>

        <section v-if="apiResponse && showImpactSummary && hasSelection" class="mt-10 w-full">
          <h2 class="text-2xl font-bold">Impact Summary</h2>
          <p class="mt-2 text-sm text-slate-700">
            Impact calculated for {{ selectedCount }} selected action<span v-if="selectedCount > 1">s</span>.
          </p>

          <div class="mx-auto mt-4 grid w-full max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              v-for="item in impactSummary"
              :key="item.label"
              class="border border-slate-200 bg-slate-50 text-center"
            >
              <CardContent class="py-6">
                <p class="text-4xl font-extrabold text-slate-900">{{ item.value }}</p>
                <p class="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{{ item.label }}</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </template>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
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
</style>
