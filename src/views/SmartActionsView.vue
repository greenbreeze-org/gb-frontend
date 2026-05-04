<script setup lang="ts">
import { computed, ref } from 'vue'
import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
 
const recommendations = [
  {
    title: 'Run Dishwasher After 9:30 PM',
    priority: 'High',
    colorClass: 'border-red-300 bg-red-50 text-red-800',
    badgeClass: 'bg-red-900 text-white',
    reason: 'Shifting this load outside peak hours reduces grid stress and evening emissions.',
  },
  {
    title: 'Pre-Cool Living Room at 4:30 PM',
    priority: 'Medium',
    colorClass: 'border-yellow-300 bg-yellow-50 text-yellow-800',
    badgeClass: 'bg-yellow-700 text-white',
    reason: 'Cooling early can lower compressor load during the highest demand window.',
  },
  {
    title: 'Delay Laundry to Midday on Sunny Days',
    priority: 'Medium',
    colorClass: 'border-yellow-300 bg-yellow-50 text-yellow-800',
    badgeClass: 'bg-yellow-700 text-white',
    reason: 'Midday usage better aligns with cleaner daytime generation in many regions.',
  },
  {
    title: 'Switch Off Idle Entertainment Devices',
    priority: 'Low',
    colorClass: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    badgeClass: 'bg-emerald-900 text-white',
    reason: 'Small standby reductions add up and improve daily efficiency habits.',
  },
]
 
const actionItems = ref([
  { id: 'dishwasher', label: 'I ran the dishwasher after 9:30 PM', checked: false },
  { id: 'precool', label: 'I pre-cooled the living room at 4:30 PM', checked: false },
  { id: 'laundry', label: 'I delayed laundry to midday on sunny days', checked: false },
  { id: 'idle', label: 'I switched off idle entertainment devices', checked: false },
])
 
type ImpactItem = { value: string; label: string }
 
const impactSummary = ref<ImpactItem[]>([])
const showImpactSummary = ref(false)
const flippedCards = ref<boolean[]>(recommendations.map(() => false))
 
const selectedCount = computed(() => actionItems.value.filter((item) => item.checked).length)
const hasSelection = computed(() => selectedCount.value > 0)
 
const toggleCardFlip = (index: number) => {
  flippedCards.value[index] = !flippedCards.value[index]
}
 
const selectAllActions = () => {
  actionItems.value.forEach((item) => (item.checked = true))
}
 
const clearAllActions = () => {
  actionItems.value.forEach((item) => (item.checked = false))
  showImpactSummary.value = false
  impactSummary.value = []
}
 
const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min
 
const buildImpactSummary = (count: number): ImpactItem[] => {
  const co2Saved = randomInRange(1.8, 2.7) * count
  const peakReduction = Math.min(35, Math.round(randomInRange(4, 8) * count))
  const shiftedLoad = randomInRange(0.4, 0.8) * count
  const treesEquivalent = co2Saved / 21
 
  return [
    { value: `${co2Saved.toFixed(1)} kg`, label: 'CO2 emissions avoided (est.)' },
    { value: `${peakReduction}%`, label: 'Peak-hour energy reduced (est.)' },
    { value: `${shiftedLoad.toFixed(1)} kWh`, label: 'Daily load shifted off-peak (est.)' },
    { value: `${treesEquivalent.toFixed(2)} trees`, label: 'Equivalent yearly tree absorption' },
  ]
}
 
const onEstimateImpact = () => {
  showImpactSummary.value = true
  if (!hasSelection.value) {
    impactSummary.value = []
    return
  }
  impactSummary.value = buildImpactSummary(selectedCount.value)
}
</script>
 
<template>
  <div class="min-h-screen bg-white text-slate-900">
    <SiteHeader />
 
    <main class="mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-10 text-center lg:px-10">
      <h1 class="text-3xl font-extrabold tracking-tight text-[var(--gb-grid)] lg:text-4xl">Smart Actions</h1>
 
      <section class="mt-8 w-full">
        <h2 class="text-2xl font-bold">Recommendations</h2>
 
        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <div
            v-for="(card, index) in recommendations"
            :key="card.title"
            class="flip-card h-44 w-full text-left"
          >
            <div class="flip-card-inner h-full w-full" :class="{ 'is-flipped': flippedCards[index] }">
              <Card :class="card.colorClass" class="flip-card-face flip-card-front border">
                <CardHeader>
                  <div class="flex items-start justify-between gap-2">
                    <CardTitle class="text-lg font-bold">{{ card.title }}</CardTitle>
                    <span
                      class="rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
                      :class="card.badgeClass"
                    >
                      {{ card.priority }}
                    </span>
                  </div>
                </CardHeader>
                <CardContent class="flex h-full flex-col pt-0">
                  <div class="mt-auto flex justify-end">
                    <button
                      type="button"
                      class="text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
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
                      :class="card.badgeClass"
                    >
                      {{ card.priority }}
                    </span>
                  </div>
                </CardHeader>
                <CardContent class="flex h-full flex-col pt-0">
                  <p class="text-sm text-slate-700">{{ card.reason }}</p>
                  <div class="mt-auto flex justify-end">
                    <button
                      type="button"
                      class="text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
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
 
      <section class="mt-10 w-full">
        <h2 class="text-2xl font-bold">Completed Actions</h2>
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
            :key="item.id"
            class="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <Checkbox v-model="item.checked" />
            <span class="text-sm font-medium text-slate-800">{{ item.label }}</span>
          </label>
        </div>
 
        <button
          type="button"
          class="mt-5 rounded-lg bg-[var(--gb-electric)] px-6 py-2 text-sm font-bold text-white hover:bg-amber-300"
          @click="onEstimateImpact"
        >
          Calculate My Impact
        </button>

 
        <p v-if="showImpactSummary && !hasSelection" class="mt-3 text-sm font-medium text-amber-700">
          No actions selected yet. Choose at least one completed action to calculate impact.
        </p>
      </section>
 
      <section v-if="showImpactSummary && hasSelection" class="mt-10 w-full">
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