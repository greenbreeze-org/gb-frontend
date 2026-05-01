<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { DotLottieVue } from '@lottiefiles/dotlottie-vue'
import { Line } from 'vue-chartjs'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'

import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  fetchEmissionsSeries,
  fetchEnergyDemandSeries,
  type DemandPoint,
  type EmissionPoint,
} from '@/services/awareness'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

type RangeMode = 'daily' | 'monthly' | 'yearly' | 'custom'

const rangeMode = ref<RangeMode>('daily')
const selectedDate = ref('2025-04-12')
const selectedMonth = ref('2025-04')
const startYear = ref('2024')
const endYear = ref('2025')
const customFrom = ref('2025-04-12T00:00')
const customTo = ref('2025-04-12T23:59')

const demandSeries = ref<DemandPoint[]>([])
const emissionsSeries = ref<EmissionPoint[]>([])
const loading = ref(false)
const errorMessage = ref('')

const withOffset = (localDateTime: string) => `${localDateTime}:00+10:00`

const rangeParams = computed(() => {
  if (rangeMode.value === 'daily') {
    return {
      from: `${selectedDate.value}T00:00:00+10:00`,
      to: `${selectedDate.value}T23:59:59+10:00`,
    }
  }

  if (rangeMode.value === 'monthly') {
    const monthParts = selectedMonth.value.split('-')
    const year = Number(monthParts[0] ?? '2025')
    const month = Number(monthParts[1] ?? '04')
    const monthStart = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-01`
    const monthEndDate = new Date(year, month, 0).getDate()
    const monthEnd = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${monthEndDate
      .toString()
      .padStart(2, '0')}`

    return {
      from: `${monthStart}T00:00:00+10:00`,
      to: `${monthEnd}T23:59:59+10:00`,
    }
  }

  if (rangeMode.value === 'yearly') {
    const fromYear = Number(startYear.value)
    const toYear = Number(endYear.value)
    const minYear = Math.min(fromYear, toYear)
    const maxYear = Math.max(fromYear, toYear)

    return {
      from: `${String(minYear).padStart(4, '0')}-01-01T00:00:00+10:00`,
      to: `${String(maxYear).padStart(4, '0')}-12-31T23:59:59+10:00`,
    }
  }

  return {
    from: withOffset(customFrom.value),
    to: withOffset(customTo.value),
  }
})

const formatTimeLabel = (raw: string) => {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw

  if (rangeMode.value === 'daily') {
    return d.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Australia/Melbourne',
    })
  }

  if (rangeMode.value === 'monthly') {
    return d.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      timeZone: 'Australia/Melbourne',
    })
  }

  return d.toLocaleDateString('en-AU', {
    month: 'short',
    year: '2-digit',
    timeZone: 'Australia/Melbourne',
  })
}

const demandLabels = computed(() => demandSeries.value.map((point) => formatTimeLabel(point.time)))
const emissionsLabels = computed(() => emissionsSeries.value.map((point) => formatTimeLabel(point.time)))

const demandChartData = computed<ChartData<'line'>>(() => ({
  labels: demandLabels.value,
  datasets: [
    {
      label: 'Demand (MW)',
      data: demandSeries.value.map((point) => point.value),
      borderColor: 'rgba(14,116,144,1)',
      borderWidth: 2.5,
      tension: 0.28,
      fill: true,
      pointRadius: demandSeries.value.map((point) => (point.isPeak ? 7 : 5)),
      pointBackgroundColor: demandSeries.value.map((point) =>
        point.isPeak ? 'rgba(239,68,68,1)' : 'rgba(14,116,144,1)',
      ),
      pointBorderWidth: 0,
      backgroundColor: (ctx) => {
        const { chart } = ctx
        const area = chart.chartArea
        if (!area) return 'rgba(56,189,248,0.18)'
        const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
        gradient.addColorStop(0, 'rgba(14,165,233,0.35)')
        gradient.addColorStop(1, 'rgba(14,165,233,0.06)')
        return gradient
      },
    },
  ],
}))

const emissionsChartData = computed<ChartData<'line'>>(() => ({
  labels: emissionsLabels.value,
  datasets: [
    {
      label: 'Emissions Intensity',
      data: emissionsSeries.value.map((point) => point.value),
      borderColor: 'rgba(16,185,129,1)',
      borderWidth: 2.5,
      tension: 0.28,
      fill: true,
      pointRadius: emissionsSeries.value.map((point) => (point.isPeak ? 7 : 5)),
      pointBackgroundColor: emissionsSeries.value.map((point) =>
        point.isPeak ? 'rgba(239,68,68,1)' : 'rgba(16,185,129,1)',
      ),
      pointBorderWidth: 0,
      backgroundColor: (ctx) => {
        const { chart } = ctx
        const area = chart.chartArea
        if (!area) return 'rgba(34,197,94,0.18)'
        const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
        gradient.addColorStop(0, 'rgba(16,185,129,0.34)')
        gradient.addColorStop(1, 'rgba(16,185,129,0.06)')
        return gradient
      },
    },
  ],
}))

const buildChartOptions = (yAxisTitle: string): ChartOptions<'line'> => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { mode: 'index', intersect: false },
  },
  interaction: { mode: 'index', intersect: false },
  scales: {
    x: {
      title: {
        display: true,
        text: 'Time',
        color: 'rgba(15,23,42,0.9)',
        font: { size: 13, weight: 'bold' },
      },
      ticks: {
        maxTicksLimit: 8,
        color: 'rgba(51,65,85,0.9)',
      },
      grid: { display: false },
    },
    y: {
      title: {
        display: true,
        text: yAxisTitle,
        color: 'rgba(15,23,42,0.9)',
        font: { size: 13, weight: 'bold' },
      },
      ticks: {
        color: 'rgba(51,65,85,0.9)',
      },
      grid: {
        color: 'rgba(148,163,184,0.2)',
      },
    },
  },
})

const demandChartOptions = computed<ChartOptions<'line'>>(() => buildChartOptions('Demand (MW)'))
const emissionsChartOptions = computed<ChartOptions<'line'>>(() =>
  buildChartOptions('Emissions Intensity'),
)

const demandInsight = computed(() => {
  if (!demandSeries.value.length) return 'Demand data is currently unavailable for this range.'

  const sorted = [...demandSeries.value].sort((a, b) => b.value - a.value)
  const peak = sorted[0]!
  const low = sorted[sorted.length - 1]!

  return `Demand peaks around ${formatTimeLabel(peak.time)} (${peak.value.toFixed(
    0,
  )} MW) and is lowest near ${formatTimeLabel(low.time)} (${low.value.toFixed(
    0,
  )} MW). Shift heavy appliance use away from red peak points.`
})

const emissionsInsight = computed(() => {
  if (!emissionsSeries.value.length) return 'Emissions data is currently unavailable for this range.'

  const sorted = [...emissionsSeries.value].sort((a, b) => b.value - a.value)
  const peak = sorted[0]!
  const low = sorted[sorted.length - 1]!

  return `Emissions intensity is highest near ${formatTimeLabel(peak.time)} (${peak.value.toFixed(
    0,
  )}) and lowest near ${formatTimeLabel(low.time)} (${low.value.toFixed(
    0,
  )}). Favor lower periods to reduce carbon impact.`
})

const demandPeakCount = computed(() => demandSeries.value.filter((p) => p.isPeak).length)
const emissionsPeakCount = computed(() => emissionsSeries.value.filter((p) => p.isPeak).length)
const demandAverage = computed(() => {
  if (!demandSeries.value.length) return 0
  return demandSeries.value.reduce((sum, point) => sum + point.value, 0) / demandSeries.value.length
})
const emissionsAverage = computed(() => {
  if (!emissionsSeries.value.length) return 0
  return emissionsSeries.value.reduce((sum, point) => sum + point.value, 0) / emissionsSeries.value.length
})

const loadAwarenessData = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const [demand, emissions] = await Promise.all([
      fetchEnergyDemandSeries(rangeParams.value),
      fetchEmissionsSeries(rangeParams.value),
    ])

    demandSeries.value = demand
    emissionsSeries.value = emissions
    if (!demand.length && !emissions.length) {
      errorMessage.value = 'No awareness data available for the selected range.'
    }
  } catch (error) {
    if (error instanceof TypeError) {
      errorMessage.value =
        'Unable to reach awareness API (likely CORS/network). Please verify backend CORS settings.'
    } else {
      errorMessage.value = 'Unable to load awareness data right now. Please try another range.'
    }
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadAwarenessData()
})
</script>

<template>
  <SiteHeader />

  <section class="w-full bg-white">
    <div class="mx-auto grid max-w-7xl gap-10 px-6 pb-14 pt-10 lg:grid-cols-2 lg:items-center lg:px-10">
      <div class="p-2 text-slate-900 lg:pr-12">
        <h1 class="mt-4 text-2xl font-extrabold leading-tight text-[#000] lg:text-[55px]">
          <span class="electric-flicker text-[var(--gb-electric)]">Energy</span> Aware,
          <br />
          <span class="text-[var(--gb-grid)]">Climate Ready.</span>
          <br />
          <span>Smarter insights,</span> 
          <br />
          <span >Less <span class="text-amber-900">waste.</span></span>
        </h1>
      </div>

      <div class="relative mx-auto h-[380px] w-full max-w-[620px] lg:h-[520px]">
        <div class="absolute bottom-[30%] -left-[20%] h-[170px] w-[170px] lg:h-[220px] lg:w-[220px]">
          <DotLottieVue
            src="/lottie/awareness/single.lottie"
            autoplay
            loop
            style="width: 190%; height: 180%"
          />
        </div>

        <div class="absolute left-1/2 top-[0%] h-[170px] w-[170px] -translate-x-1/2 lg:h-[220px] lg:w-[220px]">
          <DotLottieVue
            src="/lottie/awareness/chart.lottie"
            autoplay
            loop
            style="width: 130%; height: 130%"
          />
        </div>

        <div class="absolute bottom-[37%] right-[0%] h-[170px] w-[170px] lg:h-[220px] lg:w-[220px]">
          <DotLottieVue
            src="/lottie/awareness/factory.lottie"
            autoplay
            loop
            style="width: 190%; height: 190%"
          />
        </div>
      </div>
    </div>
  </section>

  <div class="relative w-full bg-[var(--gb-grid)] min-h-[240px] flex items-center justify-center overflow-hidden">
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
      Energy Demand & Emissions Dashboard
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

    <main class="mx-auto max-w-7xl space-y-8 px-6 py-10 lg:px-10">
    <section class="rounded-2xl border border-slate-200 p-5 text-black shadow-sm lg:p-6">
      <div class="grid gap-4 lg:grid-cols-[1.2fr_3fr_auto] lg:items-end">
        <div>
          <Label for="range-mode" class="text-xs font-semibold uppercase tracking-wide text-black/90">Range</Label>
          <select
            id="range-mode"
            v-model="rangeMode"
            class="mt-1 h-10 w-full rounded-md border border-white/40 bg-white px-3 text-sm text-slate-900"
          >
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div class="grid gap-3 sm:grid-cols-2" v-if="rangeMode === 'daily'">
          <div>
            <Label for="daily-date" class="text-xs font-semibold uppercase tracking-wide text-slate-600">Date</Label>
            <Input id="daily-date" v-model="selectedDate" type="date" class="mt-1 h-10 bg-white text-slate-900" />
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2" v-else-if="rangeMode === 'monthly'">
          <div>
            <Label for="month" class="text-xs font-semibold uppercase tracking-wide text-slate-600">Month</Label>
            <Input id="month" v-model="selectedMonth" type="month" class="mt-1 h-10 bg-white text-slate-900" />
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2" v-else-if="rangeMode === 'yearly'">
          <div>
            <Label for="start-year" class="text-xs font-semibold uppercase tracking-wide text-slate-600">Start Year</Label>
            <Input id="start-year" v-model="startYear" type="number" min="2000" max="2100" class="mt-1 h-10 bg-white text-slate-900" />
          </div>
          <div>
            <Label for="end-year" class="text-xs font-semibold uppercase tracking-wide text-slate-600">End Year</Label>
            <Input id="end-year" v-model="endYear" type="number" min="2000" max="2100" class="mt-1 h-10 bg-white text-slate-900" />
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2" v-else>
          <div>
            <Label for="custom-from" class="text-xs font-semibold uppercase tracking-wide text-slate-600">From</Label>
            <Input id="custom-from" v-model="customFrom" type="datetime-local" class="mt-1 h-10 bg-white text-slate-900" />
          </div>
          <div>
            <Label for="custom-to" class="text-xs font-semibold uppercase tracking-wide text-slate-600">To</Label>
            <Input id="custom-to" v-model="customTo" type="datetime-local" class="mt-1 h-10 bg-white text-slate-900" />
          </div>
        </div>

        <Button
          type="button"
          class="h-10 bg-[var(--gb-electric)] px-5 text-white hover:bg-amber-300"
          :disabled="loading"
          @click="loadAwarenessData"
        >
          {{ loading ? 'Loading...' : 'Apply Range' }}
        </Button>
      </div>
      <p class="mt-3 text-xs font-medium text-slate-500">
        Peak periods are highlighted in red points. X-axis auto-adjusts to your selected range.
      </p>
      <p v-if="errorMessage" class="mt-2 text-sm font-semibold text-red-600">{{ errorMessage }}</p>
    </section>

        <section class="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
      <Card class="border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle class="text-xl font-bold">Energy Demand (VIC)</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="h-72">
            <Line :data="demandChartData" :options="demandChartOptions" />
          </div>
          <p class="mt-4 text-sm text-slate-700">{{ demandInsight }}</p>
        </CardContent>
      </Card>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <Card class="border border-slate-200 bg-slate-50">
          <CardContent class="py-5 text-center">
            <p class="text-5xl font-extrabold text-slate-900">{{ demandPeakCount }}</p>
            <p class="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Demand Peak Points</p>
          </CardContent>
        </Card>
        <Card class="border border-slate-200 bg-slate-50">
          <CardContent class="py-5 text-center">
            <p class="text-5xl font-extrabold text-slate-900">{{ demandAverage.toFixed(0) }}</p>
            <p class="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Average Demand (MW)</p>
          </CardContent>
        </Card>
      </div>
    </section>

    <section class="grid gap-4 lg:grid-cols-[1fr_1.7fr]">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <Card class="border border-slate-200 bg-slate-50">
          <CardContent class="py-5 text-center">
            <p class="text-5xl font-extrabold text-slate-900">{{ emissionsPeakCount }}</p>
            <p class="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Emission Peak Points</p>
          </CardContent>
        </Card>
        <Card class="border border-slate-200 bg-slate-50">
          <CardContent class="py-5 text-center">
            <p class="text-5xl font-extrabold text-slate-900">{{ emissionsAverage.toFixed(0) }}</p>
            <p class="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Avg Emission Intensity</p>
          </CardContent>
        </Card>
      </div>

      <Card class="border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle class="text-xl font-bold">Emissions Intensity (VIC)</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="h-72">
            <Line :data="emissionsChartData" :options="emissionsChartOptions" />
          </div>
          <p class="mt-4 text-sm text-slate-700">{{ emissionsInsight }}</p>
        </CardContent>
      </Card>
    </section>
  </main>

  <SiteFooter />
</template>

<style scoped>
.electric-flicker {
  animation: electricFlicker 2.4s linear infinite;
}

@keyframes electricFlicker {
  0%,
  18%,
  22%,
  62%,
  100% {
    opacity: 1;
  }
  20%,
  60% {
    opacity: 0.55;
  }
}
</style>
