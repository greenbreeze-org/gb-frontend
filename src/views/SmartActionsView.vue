<script setup lang="ts">
import { ref } from 'vue'
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

const actionItems = [
  'Run Dishwasher After 9:30 PM',
  'Pre-Cool Living Room at 4:30 PM',
  'Delay Laundry to Midday on Sunny Days',
  'Switch Off Idle Entertainment Devices',
]

const impactSummary = [
  { value: '9%', label: 'CO2 emissions saved' },
  { value: '12%', label: 'Peak-hour energy reduced' },
  { value: '2.1 kWh', label: 'Daily load shifted off-peak' },
  { value: '4', label: 'Actions completed today' },
]

const flippedCards = ref<boolean[]>(recommendations.map(() => false))
const showImpactSummary = ref(false)

const toggleCardFlip = (index: number) => {
  flippedCards.value[index] = !flippedCards.value[index]
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
                Learn more
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</section>

      <section class="mt-10 w-full">
        <h2 class="text-2xl font-bold">Action Items</h2>
        <div class="mx-auto mt-4 flex w-full max-w-2xl flex-col gap-3 text-left">
          <label
            v-for="item in actionItems"
            :key="item"
            class="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <Checkbox />
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
      </section>

      <section v-if="showImpactSummary" class="mt-10 w-full">
        <h2 class="text-2xl font-bold">Impact Summary</h2>
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