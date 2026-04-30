<script setup lang="ts">
import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'

const recommendations = [
  {
    title: 'Run Dishwasher After 9:30 PM',
    priority: 'High',
    colorClass: 'border-red-300 bg-red-50 text-red-800',
    reason: 'Shifting this load outside peak hours reduces grid stress and evening emissions.',
  },
  {
    title: 'Pre-Cool Living Room at 4:30 PM',
    priority: 'Moderate',
    colorClass: 'border-yellow-300 bg-yellow-50 text-yellow-800',
    reason: 'Cooling early can lower compressor load during the highest demand window.',
  },
  {
    title: 'Delay Laundry to Midday on Sunny Days',
    priority: 'Moderate',
    colorClass: 'border-yellow-300 bg-yellow-50 text-yellow-800',
    reason: 'Midday usage better aligns with cleaner daytime generation in many regions.',
  },
  {
    title: 'Switch Off Idle Entertainment Devices',
    priority: 'Low',
    colorClass: 'border-emerald-300 bg-emerald-50 text-emerald-800',
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
</script>

<template>
  <div class="min-h-screen bg-white text-slate-900">
    <SiteHeader />

    <main class="mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-10 text-center lg:px-10">
      <h1 class="text-3xl font-extrabold tracking-tight text-[var(--gb-grid)] lg:text-4xl">Smart Actions</h1>

      <section class="mt-8 w-full">
        <h2 class="text-2xl font-bold">Recommendations</h2>
        <p class="mx-auto mt-2 max-w-3xl text-sm font-medium text-slate-600">
          Flip cards to view explanations. Priority is color-coded: Red = urgent/high impact, Yellow = moderate, Green = low.
        </p>

        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <Card
            v-for="card in recommendations"
            :key="card.title"
            :class="card.colorClass"
            class="border text-left"
          >
            <CardHeader>
              <CardTitle class="text-lg font-bold">{{ card.title }}</CardTitle>
            </CardHeader>
            <CardContent class="pt-0">
              <p class="text-sm font-semibold">Priority: {{ card.priority }}</p>
              <p class="mt-2 text-sm">{{ card.reason }}</p>
            </CardContent>
          </Card>
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
      </section>

      <section class="mt-10 w-full">
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
