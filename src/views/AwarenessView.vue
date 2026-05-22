<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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
import { ThermometerSun, Zap } from 'lucide-vue-next'

import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  fetchDemandInsights,
  fetchEmissionInsights,
  fetchLiveGridSummary,
  type DemandInsights,
  type EmissionInsights,
  type LiveGridSummary,
} from '@/services/awareness'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

type LiveMetric = 'total' | 'renewables' | 'intensity'
type EmissionMetric = 'intensity' | 'emissions'
type DemandMetric = 'energy' | 'temperature' | 'combined'

const liveHours = ref<8 | 16 | 24>(24)
const historicalDays = ref<14 | 30 | 60>(30)
const liveMetric = ref<LiveMetric>('total')
const emissionMetric = ref<EmissionMetric>('intensity')
const demandMetric = ref<DemandMetric>('combined')

const loading = ref(false)

const liveSummary = ref<LiveGridSummary | null>(null)
const demandInsights = ref<DemandInsights | null>(null)
const emissionsInsights = ref<EmissionInsights | null>(null)

const round = (value: number, digits = 2) => Number(value.toFixed(digits))

const toSignal = (intensity: number) => {
  if (intensity < 550) return 'GREEN'
  if (intensity < 820) return 'AMBER'
  return 'RED'
}

const buildFallbackLiveSummary = (hours: number): LiveGridSummary => {
  const now = Date.now()
  const series: LiveGridSummary['series'] = Array.from({ length: hours }, (_, index) => {
    const hoursAgo = hours - index - 1
    const timestamp = new Date(now - hoursAgo * 60 * 60 * 1000).toISOString()
    const phase = (index / Math.max(hours - 1, 1)) * Math.PI * 2
    const total = 5300 + Math.sin(phase * 1.25) * 640 + Math.cos(phase * 0.6) * 210
    const renewablesPct = Math.max(14, Math.min(58, 30 + Math.sin(phase + 0.8) * 12))
    const fossilPct = 100 - renewablesPct
    const fossil = total * (fossilPct / 100)
    const renewables = total * (renewablesPct / 100)
    const emissionsIntensity = 980 - renewablesPct * 6.4 + Math.cos(phase * 1.8) * 38

    return {
      timestamp,
      coal_mwh: round(fossil * 0.85),
      gas_mwh: round(fossil * 0.15),
      solar_mwh: round(renewables * 0.28),
      wind_mwh: round(renewables * 0.52),
      hydro_mwh: round(renewables * 0.15),
      battery_mwh: round(Math.sin(phase * 2.2) * 120 - 30),
      total_mwh: round(total),
      renewables_pct: round(renewablesPct),
      fossil_pct: round(fossilPct),
      emissions_intensity: round(emissionsIntensity),
      grid_signal: toSignal(emissionsIntensity),
    }
  })

  const totals = series.map((point) => point.total_mwh ?? 0)
  const renewables = series.map((point) => point.renewables_pct ?? 0)
  const latest = series[series.length - 1] ?? null

  return {
    window_hours: hours,
    latest,
    average_total_mwh: totals.length ? round(totals.reduce((a, b) => a + b, 0) / totals.length) : null,
    peak_total_mwh: totals.length ? round(Math.max(...totals)) : null,
    min_total_mwh: totals.length ? round(Math.min(...totals)) : null,
    average_renewables_pct: renewables.length
      ? round(renewables.reduce((a, b) => a + b, 0) / renewables.length)
      : null,
    current_signal: latest?.grid_signal ?? null,
    series,
  }
}

const buildFallbackDemandInsights = (days: number): DemandInsights => {
  const now = Date.now()
  const pointCount = Math.min(Math.max(days * 6, 72), 360)
  const demandSeries = Array.from({ length: pointCount }, (_, index) => {
    const hoursAgo = pointCount - index - 1
    const timestamp = new Date(now - hoursAgo * 60 * 60 * 1000).toISOString()
    const cycle = (index / Math.max(pointCount - 1, 1)) * Math.PI * 8
    const energy = 6350 + Math.sin(cycle) * 940 + Math.cos(cycle * 0.45) * 320
    const temperature = 16 + Math.sin(cycle + 0.7) * 6 + Math.cos(cycle * 0.3) * 1.4
    return {
      timestamp,
      energy_mwh: round(Math.max(3950, energy)),
      temperature_c: round(temperature, 1),
      is_demand_peak: energy > 7350,
    }
  })

  const current = demandSeries[demandSeries.length - 1]
  const avgEnergy =
    demandSeries.reduce((sum, point) => sum + point.energy_mwh, 0) / Math.max(demandSeries.length, 1)
  const avgTemp =
    demandSeries.reduce((sum, point) => sum + (point.temperature_c ?? 0), 0) /
    Math.max(demandSeries.length, 1)
  const peak = demandSeries.reduce((best, point) =>
    point.energy_mwh > best.energy_mwh ? point : best,
  )
  const low = demandSeries.reduce((best, point) => (point.energy_mwh < best.energy_mwh ? point : best))
  const peakCount = demandSeries.filter((point) => point.is_demand_peak).length

  return {
    lookback_days: days,
    current_energy_mwh: current ? round(current.energy_mwh) : null,
    average_energy_mwh: round(avgEnergy),
    peak_hour: peak?.timestamp ?? null,
    peak_energy_mwh: peak ? round(peak.energy_mwh) : null,
    low_hour: low?.timestamp ?? null,
    low_energy_mwh: low ? round(low.energy_mwh) : null,
    avg_temperature_c: round(avgTemp, 1),
    peak_hour_ratio_pct: round((peakCount / Math.max(demandSeries.length, 1)) * 100, 2),
    demand_series: demandSeries,
  }
}

const buildFallbackEmissionInsights = (
  days: number,
  sourceDemand: DemandInsights['demand_series'],
): EmissionInsights => {
  const demandSeries = sourceDemand ?? []
  const emissionSeries = demandSeries.map((point, index) => {
    const cycle = (index / Math.max(demandSeries.length - 1, 1)) * Math.PI * 8
    const intensity = 700 + Math.cos(cycle + 0.45) * 165 + Math.sin(cycle * 0.35) * 55
    const emissionsT = (point.energy_mwh * intensity) / 1000
    return {
      timestamp: point.timestamp,
      emissions_t: round(Math.max(2200, emissionsT)),
      emission_intensity: round(Math.max(320, intensity), 2),
      is_dirty_grid: intensity > 770,
    }
  })

  const current = emissionSeries[emissionSeries.length - 1]
  const avgIntensity =
    emissionSeries.reduce((sum, point) => sum + point.emission_intensity, 0) /
    Math.max(emissionSeries.length, 1)
  const avgEmissions =
    emissionSeries.reduce((sum, point) => sum + point.emissions_t, 0) / Math.max(emissionSeries.length, 1)
  const cleanest = emissionSeries.reduce((best, point) =>
    point.emission_intensity < best.emission_intensity ? point : best,
  )
  const dirtiest = emissionSeries.reduce((best, point) =>
    point.emission_intensity > best.emission_intensity ? point : best,
  )
  const dirtyRatio =
    emissionSeries.filter((point) => point.is_dirty_grid).length / Math.max(emissionSeries.length, 1)

  return {
    lookback_days: days,
    current_emission_intensity: current ? round(current.emission_intensity, 2) : null,
    average_emission_intensity: round(avgIntensity, 2),
    current_emissions_t: current ? round(current.emissions_t, 2) : null,
    average_emissions_t: round(avgEmissions, 2),
    cleanest_hour: cleanest?.timestamp ?? null,
    cleanest_intensity: cleanest ? round(cleanest.emission_intensity, 2) : null,
    dirtiest_hour: dirtiest?.timestamp ?? null,
    dirtiest_intensity: dirtiest ? round(dirtiest.emission_intensity, 2) : null,
    dirty_grid_ratio_pct: round(dirtyRatio * 100, 2),
    emission_series: emissionSeries,
  }
}

const scrollToId = (id: string) => {
  const target = document.getElementById(id)
  if (!target) return
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const parseNumber = (value: number | null | undefined, digits = 0) => {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A'
  return value.toLocaleString('en-AU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

const parsePct = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A'
  return `${value.toFixed(1)}%`
}

const formatHourLabel = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-AU', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Australia/Melbourne',
  })
}

const shortTimeLabel = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Australia/Melbourne',
  })
}

const loadAwarenessData = async () => {
  loading.value = true

  try {
    const [live, demand, emissions] = await Promise.all([
      fetchLiveGridSummary(liveHours.value),
      fetchDemandInsights(historicalDays.value),
      fetchEmissionInsights(historicalDays.value),
    ])

    liveSummary.value = live
    demandInsights.value = demand
    emissionsInsights.value = emissions
  } catch (error) {
    console.warn('Awareness API request failed; using static fallback dataset.', error)

    const fallbackLive = buildFallbackLiveSummary(liveHours.value)
    const fallbackDemand = buildFallbackDemandInsights(historicalDays.value)
    const fallbackEmissions = buildFallbackEmissionInsights(
      historicalDays.value,
      fallbackDemand.demand_series,
    )

    liveSummary.value = fallbackLive
    demandInsights.value = fallbackDemand
    emissionsInsights.value = fallbackEmissions
  } finally {
    loading.value = false
  }
}

const signalToneClass = computed(() => {
  const signal = (liveSummary.value?.current_signal ?? liveSummary.value?.latest?.grid_signal ?? '').toUpperCase()
  if (signal === 'GREEN') return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  if (signal === 'AMBER' || signal === 'YELLOW') return 'text-amber-700 bg-amber-50 border-amber-200'
  if (signal === 'RED') return 'text-red-700 bg-red-50 border-red-200'
  return 'text-slate-700 bg-slate-50 border-slate-200'
})

const liveLabels = computed(() => (liveSummary.value?.series ?? []).map((point) => shortTimeLabel(point.timestamp)))

const liveChartData = computed<ChartData<'line'>>(() => {
  const series = liveSummary.value?.series ?? []

  const datasetMap: Record<LiveMetric, { label: string; values: Array<number | null>; color: string }> = {
    total: {
      label: 'Total Grid Energy (MWh)',
      values: series.map((point) => point.total_mwh ?? null),
      color: 'rgba(14, 165, 233, 1)',
    },
    renewables: {
      label: 'Renewables Share (%)',
      values: series.map((point) => point.renewables_pct ?? null),
      color: 'rgba(22, 163, 74, 1)',
    },
    intensity: {
      label: 'Emissions Intensity',
      values: series.map((point) => point.emissions_intensity ?? null),
      color: 'rgba(239, 68, 68, 1)',
    },
  }

  const active = datasetMap[liveMetric.value]

  return {
    labels: liveLabels.value,
    datasets: [
      {
        label: active.label,
        data: active.values,
        borderColor: active.color,
        borderWidth: 2.5,
        tension: 0.28,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBorderWidth: 0,
        pointBackgroundColor: active.color,
        backgroundColor: (ctx) => {
          const { chart } = ctx
          const area = chart.chartArea
          if (!area) return 'rgba(14,165,233,0.16)'
          const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
          gradient.addColorStop(0, active.color.replace('1)', '0.32)'))
          gradient.addColorStop(1, active.color.replace('1)', '0.04)'))
          return gradient
        },
      },
    ],
  }
})

const liveChartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        title: (items) => {
          const idx = items[0]?.dataIndex ?? 0
          const point = liveSummary.value?.series?.[idx]
          return point ? formatHourLabel(point.timestamp) : items[0]?.label ?? ''
        },
      },
    },
  },
  scales: {
    x: {
      ticks: { color: 'rgba(51,65,85,0.95)', maxTicksLimit: 8 },
      grid: { display: false },
    },
    y: {
      ticks: { color: 'rgba(51,65,85,0.95)' },
      grid: { color: 'rgba(148,163,184,0.22)' },
      beginAtZero: true,
    },
  },
}))

const demandSeries = computed(() => demandInsights.value?.demand_series ?? [])
const demandLabels = computed(() => demandSeries.value.map((point) => shortTimeLabel(point.timestamp)))

const demandChartData = computed<ChartData<'line'>>(() => ({
  labels: demandLabels.value,
  datasets: [
    ...(demandMetric.value === 'energy' || demandMetric.value === 'combined'
      ? [
          {
            label: 'Energy (MWh)',
            data: demandSeries.value.map((point) => point.energy_mwh),
            borderColor: 'rgba(14, 116, 144, 1)',
            borderWidth: 2.4,
            tension: 0.24,
            yAxisID: 'y',
            fill: true,
            pointRadius: demandSeries.value.map((point) => (point.is_demand_peak ? 5 : 2.5)),
            pointHoverRadius: 6,
            pointBorderWidth: 0,
            pointBackgroundColor: demandSeries.value.map((point) =>
              point.is_demand_peak ? 'rgba(239, 68, 68, 1)' : 'rgba(14, 116, 144, 1)',
            ),
            backgroundColor: (ctx: any) => {
              const { chart } = ctx
              const area = chart.chartArea
              if (!area) return 'rgba(14, 165, 233, 0.14)'
              const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
              gradient.addColorStop(0, 'rgba(14, 165, 233, 0.33)')
              gradient.addColorStop(1, 'rgba(14, 165, 233, 0.05)')
              return gradient
            },
          },
        ]
      : []),
    ...(demandMetric.value === 'temperature' || demandMetric.value === 'combined'
      ? [
          {
            label: 'Temperature (°C)',
            data: demandSeries.value.map((point) => point.temperature_c),
            borderColor: 'rgba(245, 158, 11, 0.95)',
            borderWidth: 2,
            borderDash: [6, 4],
            tension: 0.22,
            yAxisID: 'y1',
            pointRadius: 0,
            pointHoverRadius: 4,
          },
        ]
      : []),
  ],
}))

const demandChartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      position: 'top',
      labels: {
        usePointStyle: true,
        boxWidth: 8,
      },
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        title: (items) => {
          const idx = items[0]?.dataIndex ?? 0
          const point = demandSeries.value[idx]
          return point ? formatHourLabel(point.timestamp) : items[0]?.label ?? ''
        },
      },
    },
  },
  scales: {
    x: {
      ticks: {
        color: 'rgba(51,65,85,0.95)',
        maxTicksLimit: 10,
      },
      grid: { display: false },
    },
    y: {
      title: { display: true, text: 'MWh' },
      ticks: { color: 'rgba(51,65,85,0.95)' },
      grid: { color: 'rgba(148,163,184,0.22)' },
      beginAtZero: false,
    },
    y1: {
      display: demandMetric.value === 'temperature' || demandMetric.value === 'combined',
      position: 'right',
      title: { display: true, text: '°C' },
      ticks: { color: 'rgba(120,53,15,0.85)' },
      grid: { drawOnChartArea: false },
      beginAtZero: false,
    },
  },
}))

const emissionsSeries = computed(() => emissionsInsights.value?.emission_series ?? [])
const emissionsLabels = computed(() => emissionsSeries.value.map((point) => shortTimeLabel(point.timestamp)))

const emissionsChartData = computed<ChartData<'line'>>(() => {
  const isIntensity = emissionMetric.value === 'intensity'
  const color = isIntensity ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)'

  return {
    labels: emissionsLabels.value,
    datasets: [
      {
        label: isIntensity ? 'Emission Intensity' : 'Emissions (t)',
        data: emissionsSeries.value.map((point) =>
          isIntensity ? point.emission_intensity : point.emissions_t,
        ),
        borderColor: color,
        borderWidth: 2.5,
        tension: 0.24,
        fill: true,
        pointRadius: emissionsSeries.value.map((point) => (point.is_dirty_grid ? 4.8 : 2.5)),
        pointHoverRadius: 6,
        pointBorderWidth: 0,
        pointBackgroundColor: emissionsSeries.value.map((point) =>
          point.is_dirty_grid ? 'rgba(239, 68, 68, 1)' : color,
        ),
        backgroundColor: (ctx) => {
          const { chart } = ctx
          const area = chart.chartArea
          if (!area) return 'rgba(16, 185, 129, 0.13)'
          const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
          gradient.addColorStop(0, color.replace('1)', '0.30)'))
          gradient.addColorStop(1, color.replace('1)', '0.05)'))
          return gradient
        },
      },
    ],
  }
})

const emissionsChartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        title: (items) => {
          const idx = items[0]?.dataIndex ?? 0
          const point = emissionsSeries.value[idx]
          return point ? formatHourLabel(point.timestamp) : items[0]?.label ?? ''
        },
      },
    },
  },
  scales: {
    x: {
      ticks: {
        color: 'rgba(51,65,85,0.95)',
        maxTicksLimit: 10,
      },
      grid: { display: false },
    },
    y: {
      ticks: { color: 'rgba(51,65,85,0.95)' },
      grid: { color: 'rgba(148,163,184,0.22)' },
      beginAtZero: false,
    },
  },
}))

onMounted(async () => {
  await loadAwarenessData()
})

watch(liveHours, async () => {
  await loadAwarenessData()
})

watch(historicalDays, async () => {
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
          <span>Less <span class="text-amber-900">waste.</span></span>
        </h1>

        <div class="mt-7 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            class="bg-[var(--gb-grid)] px-6 text-white hover:bg-[#0b5f57]"
            @click="scrollToId('live-grid-section')"
          >
            View Live Grid
          </Button>
          <Button
            type="button"
            variant="outline"
            class="border-[var(--gb-grid)] px-6 text-[var(--gb-grid)] hover:bg-emerald-50"
            @click="scrollToId('demand-section')"
          >
            Jump To Demand
          </Button>
        </div>
      </div>

      <div class="relative mx-auto h-[380px] w-full max-w-[620px] lg:h-[520px]">
        <div class="absolute bottom-[30%] -left-[20%] h-[170px] w-[170px] lg:h-[220px] lg:w-[220px]">
          <DotLottieVue src="/lottie/awareness/single.lottie" autoplay loop style="width: 190%; height: 180%" />
        </div>

        <div class="absolute left-1/2 top-[0%] h-[170px] w-[170px] -translate-x-1/2 lg:h-[220px] lg:w-[220px]">
          <DotLottieVue src="/lottie/awareness/chart.lottie" autoplay loop style="width: 130%; height: 130%" />
        </div>

        <div class="absolute bottom-[37%] right-[0%] h-[170px] w-[170px] lg:h-[220px] lg:w-[220px]">
          <DotLottieVue src="/lottie/awareness/factory.lottie" autoplay loop style="width: 190%; height: 190%" />
        </div>
      </div>
    </div>
  </section>

  <main class="mx-auto max-w-7xl space-y-8 px-6 py-8 pb-40 lg:px-10">

    <div id="live-grid-section" class="full-bleed relative mt-6 min-h-[200px] bg-[var(--gb-grid)] flex items-center justify-center overflow-hidden">
      <div class="pointer-events-none absolute left-0 top-1/2 z-10 h-[120px] w-[120px] -translate-y-1/2 lg:h-[320px] lg:w-[320px]">
        <DotLottieVue
          src="/lottie/decor/cherry-flowers.lottie"
          :render-config="{ devicePixelRatio: 2, autoResize: true }"
          autoplay
          loop
          style="width: 100%; height: 100%"
        />
      </div>
      <h2 class="px-8 text-center text-3xl font-extrabold tracking-tight text-white lg:text-5xl">Live Grid</h2>
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

    <section class="space-y-5">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card class="metric-card border border-slate-200 bg-white shadow-sm">
          <CardContent class="py-5">
            <p class="metric-kicker">Grid Signal</p>
            <div class="mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-extrabold uppercase tracking-wide" :class="signalToneClass">
              <Zap class="h-3.5 w-3.5" />
              {{ liveSummary?.current_signal || liveSummary?.latest?.grid_signal || 'N/A' }}
            </div>
          </CardContent>
        </Card>

        <Card class="metric-card border border-slate-200 bg-white shadow-sm">
          <CardContent class="py-5">
            <p class="metric-kicker">Total MWh</p>
            <p class="metric-value">{{ parseNumber(liveSummary?.latest?.total_mwh, 0) }}</p>
          </CardContent>
        </Card>

        <Card class="metric-card border border-slate-200 bg-white shadow-sm">
          <CardContent class="py-5">
            <p class="metric-kicker">Renewables %</p>
            <p class="metric-value text-emerald-700">{{ parsePct(liveSummary?.latest?.renewables_pct) }}</p>
          </CardContent>
        </Card>

        <Card class="metric-card border border-slate-200 bg-white shadow-sm">
          <CardContent class="py-5">
            <p class="metric-kicker">Emissions Intensity</p>
            <p class="metric-value text-rose-700">{{ parseNumber(liveSummary?.latest?.emissions_intensity, 2) }}</p>
          </CardContent>
        </Card>
      </div>

      <Card class="border border-slate-200 bg-white shadow-sm">
        <CardHeader class="pb-2">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <CardTitle class="text-xl font-extrabold">{{ liveHours }}h Grid Series</CardTitle>
            <div class="flex flex-wrap items-center gap-2">
              <div class="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                <button
                  v-for="option in [8, 16, 24]"
                  :key="`live-hours-${option}`"
                  type="button"
                  class="rounded-full px-3 py-1.5 text-xs font-bold transition"
                  :class="liveHours === option ? 'bg-[var(--gb-grid)] text-white' : 'text-slate-700 hover:bg-white'"
                  @click="liveHours = option as 8 | 16 | 24"
                >
                  {{ option }}h
                </button>
              </div>
              <div class="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  class="rounded-full px-3 py-1.5 text-xs font-bold transition"
                  :class="liveMetric === 'total' ? 'bg-sky-600 text-white' : 'text-slate-700 hover:bg-white'"
                  @click="liveMetric = 'total'"
                >
                  Total MWh
                </button>
                <button
                  type="button"
                  class="rounded-full px-3 py-1.5 text-xs font-bold transition"
                  :class="liveMetric === 'renewables' ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-white'"
                  @click="liveMetric = 'renewables'"
                >
                  Renewables %
                </button>
                <button
                  type="button"
                  class="rounded-full px-3 py-1.5 text-xs font-bold transition"
                  :class="liveMetric === 'intensity' ? 'bg-rose-600 text-white' : 'text-slate-700 hover:bg-white'"
                  @click="liveMetric = 'intensity'"
                >
                  Intensity
                </button>
              </div>
            </div>
          </div>
          <p class="text-sm font-semibold text-slate-600">
            Live snapshot: Victoria-wide grid mix and intensity over the last {{ liveHours }} hours (Australia/Melbourne time).
          </p>
        </CardHeader>
        <CardContent>
          <div class="h-[340px]">
            <Line :data="liveChartData" :options="liveChartOptions" />
          </div>
        </CardContent>
      </Card>
    </section>

    <div id="demand-section" class="full-bleed relative mt-6 min-h-[200px] bg-[var(--gb-grid)] flex items-center justify-center overflow-hidden">
      <div class="pointer-events-none absolute left-0 top-1/2 z-10 h-[120px] w-[120px] -translate-y-1/2 lg:h-[320px] lg:w-[320px]">
        <DotLottieVue
          src="/lottie/decor/cherry-flowers.lottie"
          :render-config="{ devicePixelRatio: 2, autoResize: true }"
          autoplay
          loop
          style="width: 100%; height: 100%"
        />
      </div>
      <h2 class="px-8 text-center text-3xl font-extrabold tracking-tight text-white lg:text-5xl">Demand</h2>
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

    <section class="space-y-5">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card class="metric-card border border-slate-200 bg-white shadow-sm">
          <CardContent class="py-5">
            <p class="metric-kicker">Current Energy</p>
            <p class="metric-value">{{ parseNumber(demandInsights?.current_energy_mwh, 2) }}</p>
          </CardContent>
        </Card>
        <Card class="metric-card border border-slate-200 bg-white shadow-sm">
          <CardContent class="py-5">
            <p class="metric-kicker">Average Energy</p>
            <p class="metric-value">{{ parseNumber(demandInsights?.average_energy_mwh, 2) }}</p>
          </CardContent>
        </Card>
        <Card class="metric-card border border-slate-200 bg-white shadow-sm">
          <CardContent class="py-5">
            <p class="metric-kicker">Peak Energy</p>
            <p class="metric-value text-rose-700">{{ parseNumber(demandInsights?.peak_energy_mwh, 2) }}</p>
            <p class="mt-1 text-xs font-semibold text-slate-500">{{ demandInsights?.peak_hour ? formatHourLabel(demandInsights.peak_hour) : 'N/A' }}</p>
          </CardContent>
        </Card>
        <Card class="metric-card border border-slate-200 bg-white shadow-sm">
          <CardContent class="py-5">
            <p class="metric-kicker">Low Energy</p>
            <p class="metric-value text-emerald-700">{{ parseNumber(demandInsights?.low_energy_mwh, 2) }}</p>
            <p class="mt-1 text-xs font-semibold text-slate-500">{{ demandInsights?.low_hour ? formatHourLabel(demandInsights.low_hour) : 'N/A' }}</p>
          </CardContent>
        </Card>
        <Card class="metric-card border border-slate-200 bg-white shadow-sm">
          <CardContent class="py-5">
            <p class="metric-kicker">Peak Frequency</p>
            <p class="metric-value">{{ parsePct(demandInsights?.peak_hour_ratio_pct) }}</p>
          </CardContent>
        </Card>
      </div>

      <Card class="border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <CardTitle class="text-xl font-extrabold">Demand + Temperature Context</CardTitle>
            <div class="flex flex-wrap items-center gap-2">
              <div class="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                <button
                  v-for="option in [14, 30, 60]"
                  :key="`demand-days-${option}`"
                  type="button"
                  class="rounded-full px-3 py-1.5 text-xs font-bold transition"
                  :class="historicalDays === option ? 'bg-[var(--gb-grid)] text-white' : 'text-slate-700 hover:bg-white'"
                  @click="historicalDays = option as 14 | 30 | 60"
                >
                  {{ option }}d
                </button>
              </div>
              <div class="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  class="rounded-full px-3 py-1.5 text-xs font-bold transition"
                  :class="demandMetric === 'combined' ? 'bg-sky-600 text-white' : 'text-slate-700 hover:bg-white'"
                  @click="demandMetric = 'combined'"
                >
                  Combined
                </button>
                <button
                  type="button"
                  class="rounded-full px-3 py-1.5 text-xs font-bold transition"
                  :class="demandMetric === 'energy' ? 'bg-cyan-700 text-white' : 'text-slate-700 hover:bg-white'"
                  @click="demandMetric = 'energy'"
                >
                  Energy
                </button>
                <button
                  type="button"
                  class="rounded-full px-3 py-1.5 text-xs font-bold transition"
                  :class="demandMetric === 'temperature' ? 'bg-amber-600 text-white' : 'text-slate-700 hover:bg-white'"
                  @click="demandMetric = 'temperature'"
                >
                  Temperature
                </button>
              </div>
              <div class="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                <ThermometerSun class="h-4 w-4" />
                Avg Temp: {{ parseNumber(demandInsights?.avg_temperature_c, 1) }}°C
              </div>
            </div>
          </div>
          <p class="text-sm font-semibold text-slate-600">
            Historical dataset: Victoria-wide demand trends over the last {{ historicalDays }} days (Australia/Melbourne time).
          </p>
        </CardHeader>
        <CardContent>
          <div class="h-[360px]">
            <Line :data="demandChartData" :options="demandChartOptions" />
          </div>
        </CardContent>
      </Card>
    </section>

    <div id="emissions-section" class="full-bleed relative mt-6 min-h-[200px] bg-[var(--gb-grid)] flex items-center justify-center overflow-hidden">
      <div class="pointer-events-none absolute left-0 top-1/2 z-10 h-[120px] w-[120px] -translate-y-1/2 lg:h-[320px] lg:w-[320px]">
        <DotLottieVue
          src="/lottie/decor/cherry-flowers.lottie"
          :render-config="{ devicePixelRatio: 2, autoResize: true }"
          autoplay
          loop
          style="width: 100%; height: 100%"
        />
      </div>
      <h2 class="px-8 text-center text-3xl font-extrabold tracking-tight text-white lg:text-5xl">Emissions</h2>
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

    <section class="space-y-5 pb-8">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card class="metric-card border border-slate-200 bg-white shadow-sm">
          <CardContent class="py-5">
            <p class="metric-kicker">Current Intensity</p>
            <p class="metric-value">{{ parseNumber(emissionsInsights?.current_emission_intensity, 2) }}</p>
          </CardContent>
        </Card>
        <Card class="metric-card border border-slate-200 bg-white shadow-sm">
          <CardContent class="py-5">
            <p class="metric-kicker">Average Intensity</p>
            <p class="metric-value">{{ parseNumber(emissionsInsights?.average_emission_intensity, 2) }}</p>
          </CardContent>
        </Card>
        <Card class="metric-card border border-slate-200 bg-white shadow-sm">
          <CardContent class="py-5">
            <p class="metric-kicker">Current Emissions (t)</p>
            <p class="metric-value text-rose-700">{{ parseNumber(emissionsInsights?.current_emissions_t, 2) }}</p>
          </CardContent>
        </Card>
        <Card class="metric-card border border-slate-200 bg-white shadow-sm">
          <CardContent class="py-5">
            <p class="metric-kicker">Average Emissions (t)</p>
            <p class="metric-value text-emerald-700">{{ parseNumber(emissionsInsights?.average_emissions_t, 2) }}</p>
          </CardContent>
        </Card>
        <Card class="metric-card border border-slate-200 bg-white shadow-sm">
          <CardContent class="py-5">
            <p class="metric-kicker">Dirty Grid Ratio</p>
            <p class="metric-value">{{ parsePct(emissionsInsights?.dirty_grid_ratio_pct) }}</p>
          </CardContent>
        </Card>
      </div>

      <div class="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <Card class="border border-slate-200 bg-white shadow-sm">
          <CardHeader class="pb-2">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <CardTitle class="text-xl font-extrabold">Emission Trend</CardTitle>
              <div class="flex flex-wrap items-center gap-2">
                <div class="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                  <button
                    v-for="option in [14, 30, 60]"
                    :key="`emission-days-${option}`"
                    type="button"
                    class="rounded-full px-3 py-1.5 text-xs font-bold transition"
                    :class="historicalDays === option ? 'bg-[var(--gb-grid)] text-white' : 'text-slate-700 hover:bg-white'"
                    @click="historicalDays = option as 14 | 30 | 60"
                  >
                    {{ option }}d
                  </button>
                </div>
                <div class="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    class="rounded-full px-3 py-1.5 text-xs font-bold transition"
                    :class="emissionMetric === 'intensity' ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-white'"
                    @click="emissionMetric = 'intensity'"
                  >
                    Intensity
                  </button>
                  <button
                    type="button"
                    class="rounded-full px-3 py-1.5 text-xs font-bold transition"
                    :class="emissionMetric === 'emissions' ? 'bg-rose-600 text-white' : 'text-slate-700 hover:bg-white'"
                    @click="emissionMetric = 'emissions'"
                  >
                    Emissions (t)
                  </button>
                </div>
              </div>
            </div>
            <p class="text-sm font-semibold text-slate-600">
              Historical dataset: Victoria-wide emissions trends over the last {{ historicalDays }} days (Australia/Melbourne time).
            </p>
          </CardHeader>
          <CardContent>
            <div class="h-[360px]">
              <Line :data="emissionsChartData" :options="emissionsChartOptions" />
            </div>
          </CardContent>
        </Card>

        <Card class="border border-slate-200 bg-slate-50 shadow-sm">
          <CardHeader>
            <CardTitle class="text-lg font-extrabold">Cleanest vs Dirtiest</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p class="text-xs font-extrabold uppercase tracking-wide text-emerald-700">Cleanest Period</p>
              <p class="mt-1 text-base font-bold text-emerald-900">{{ emissionsInsights?.cleanest_hour ? formatHourLabel(emissionsInsights.cleanest_hour) : 'N/A' }}</p>
              <p class="text-sm font-semibold text-emerald-800">{{ parseNumber(emissionsInsights?.cleanest_intensity, 2) }} intensity</p>
            </div>
            <div class="rounded-xl border border-rose-200 bg-rose-50 p-3">
              <p class="text-xs font-extrabold uppercase tracking-wide text-rose-700">Dirtiest Period</p>
              <p class="mt-1 text-base font-bold text-rose-900">{{ emissionsInsights?.dirtiest_hour ? formatHourLabel(emissionsInsights.dirtiest_hour) : 'N/A' }}</p>
              <p class="text-sm font-semibold text-rose-800">{{ parseNumber(emissionsInsights?.dirtiest_intensity, 2) }} intensity</p>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">
              Red points in the trend chart indicate dirty-grid periods from the API.
            </div>
          </CardContent>
        </Card>
      </div>
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

.full-bleed {
  width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
}

.metric-card {
  box-shadow:
    0 12px 28px rgba(15, 23, 42, 0.08),
    0 1px 0 rgba(255, 255, 255, 0.75) inset;
}

.metric-kicker {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #64748b;
}

.metric-value {
  margin-top: 0.35rem;
  font-size: clamp(1.35rem, 2vw, 2rem);
  line-height: 1.1;
  font-weight: 900;
  color: #0f172a;
}

</style>
