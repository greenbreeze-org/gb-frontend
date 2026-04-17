<script setup lang="ts">
import { computed } from 'vue'

import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'

// Static fallback data (Victoria-only) for current iteration.
const demandSeries = [
  { time: '03:00', value: 5439.56 },
  { time: '04:00', value: 5371.69 },
  { time: '05:00', value: 5402.95 },
  { time: '06:00', value: 5423.87 },
  { time: '07:00', value: 4848.8 },
  { time: '08:00', value: 4427.2 },
  { time: '09:00', value: 4707.6 },
  { time: '10:00', value: 5250.51 },
  { time: '11:00', value: 5660.83 },
  { time: '12:00', value: 5958.35 },
]

const emissionsSeries = [
  { time: '03:00', value: 891.54 },
  { time: '04:00', value: 903.56 },
  { time: '05:00', value: 900.02 },
  { time: '06:00', value: 909.48 },
  { time: '07:00', value: 965.48 },
  { time: '08:00', value: 801.73 },
  { time: '09:00', value: 664.74 },
  { time: '10:00', value: 566.45 },
  { time: '11:00', value: 500.66 },
  { time: '12:00', value: 461.13 },
]

// Chart helpers
const demandMax = computed(() => Math.max(...demandSeries.map((p) => p.value), 1))
const emissionsMax = computed(() => Math.max(...emissionsSeries.map((p) => p.value), 1))

const demandBarHeight = (value: number) => `${(value / demandMax.value) * 100}%`
const emissionsBarHeight = (value: number) => `${(value / emissionsMax.value) * 100}%`
const demandBarColor = (value: number) =>
  isDemandPeak(value) ? 'var(--gb-electric)' : 'rgba(15, 118, 110, 0.8)'
const emissionsBarColor = (value: number) =>
  isEmissionsPeak(value) ? 'var(--gb-electric)' : 'rgba(14, 165, 165, 0.85)'

// Peak highlighting helpers (top 20% points)
const demandPeakThreshold = computed(() => {
  const sorted = [...demandSeries].sort((a, b) => b.value - a.value)
  const idx = Math.max(Math.floor(demandSeries.length * 0.2) - 1, 0)
  return sorted[idx]?.value ?? sorted[0]?.value ?? 0
})

const emissionsPeakThreshold = computed(() => {
  const sorted = [...emissionsSeries].sort((a, b) => b.value - a.value)
  const idx = Math.max(Math.floor(emissionsSeries.length * 0.2) - 1, 0)
  return sorted[idx]?.value ?? sorted[0]?.value ?? 0
})

const isDemandPeak = (value: number) => value >= demandPeakThreshold.value
const isEmissionsPeak = (value: number) => value >= emissionsPeakThreshold.value

// Insights from static data
const demandInsight = computed(() => {
  const first = demandSeries[0]
  if (!first) return 'Demand data is currently unavailable.'

  const peak = demandSeries.reduce((max, point) => (point.value > max.value ? point : max), first)
  const min = demandSeries.reduce((m, point) => (point.value < m.value ? point : m), first)

  return `Demand peaks around ${peak.time} (${peak.value.toFixed(0)} MW) and is lowest near ${min.time} (${min.value.toFixed(0)} MW). Shifting heavy heating/cooling use away from peak windows can reduce grid stress.`
})

const emissionsInsight = computed(() => {
  const first = emissionsSeries[0]
  if (!first) return 'Emissions data is currently unavailable.'

  const peak = emissionsSeries.reduce(
    (max, point) => (point.value > max.value ? point : max),
    first,
  )
  const min = emissionsSeries.reduce((m, point) => (point.value < m.value ? point : m), first)

  return `Emissions intensity is highest near ${peak.time} (${peak.value.toFixed(0)}), and lower by ${min.time} (${min.value.toFixed(0)}). Avoiding high-emission windows helps reduce carbon impact while maintaining comfort.`
})
</script>


<template>
    <!-- Shared navbar -->
    <SiteHeader />

     <!-- Hero -->
    <section
      class="relative flex w-full min-h-[320px] items-center justify-center overflow-hidden px-6 py-10 lg:h-[600px] lg:px-10"
      style="
        background-image: url('/awarness.jpg');
        background-size: 100% 100%;
        background-repeat: no-repeat;
        background-position: center top;
      "
    >
      <div class="text-center">
        <h1 class="text-3xl font-bold tracking-tight text-white lg:text-8xl">Awareness</h1>
        <p class="mt-3 text-[30px] text-white">
          Victoria-wide energy demand and emissions awareness.
        </p>
      </div>
    </section>

    <!-- Awareness page content -->
    <main class="mx-auto max-w-7xl space-y-10 px-6 py-10 lg:px-10">
      <!-- Demand chart section -->
      <section class="rounded-2xl border border-slate-200 p-6">
        <h2 class="text-2xl font-bold text-center">Energy Demand (Victoria)</h2>

        <div class="mt-5 h-64 rounded-xl border border-slate-200 p-4">
          <div class="flex h-full items-end gap-2">
            <div
              v-for="point in demandSeries"
              :key="`demand-${point.time}`"
              class="flex h-full min-w-[44px] flex-1 flex-col items-center justify-end"
            >
              <div
                class="w-full rounded-t-md transition-all"
                :style="{
                  height: demandBarHeight(point.value),
                  backgroundColor: demandBarColor(point.value),
                }"
              />
              <span class="mt-2 text-xs text-slate-600">{{ point.time }}</span>
            </div>
          </div>
        </div>

        <p class="mt-4 text-[18px]">{{ demandInsight }}</p>
      </section>

      <!-- Emissions chart section -->
      <section class="rounded-2xl border border-slate-200 p-6">
        <h2 class="text-2xl font-bold text-center">Emissions Intensity (Victoria)</h2>

        <div class="mt-5 h-64 rounded-xl border border-slate-200 p-4">
          <div class="flex h-full items-end gap-2">
            <div
              v-for="point in emissionsSeries"
              :key="`emissions-${point.time}`"
              class="flex h-full min-w-[44px] flex-1 flex-col items-center justify-end"
            >
              <div
                class="w-full rounded-t-md transition-all"
                :style="{
                  height: emissionsBarHeight(point.value),
                  backgroundColor: emissionsBarColor(point.value),
                }"
              />
              <span class="mt-2 text-xs text-slate-600">{{ point.time }}</span>
            </div>
          </div>
        </div>

        <p class="mt-4 text-[18px]">{{ emissionsInsight }}</p>
      </section>
    </main>

<!-- Shared footer -->
    <SiteFooter />
</template>