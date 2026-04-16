<script setup lang="ts">
// Imports
import { DotLottieVue } from '@lottiefiles/dotlottie-vue'
import type { DotLottieVueInstance } from '@lottiefiles/dotlottie-vue'
import { Home, LineChart, Leaf } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { Button } from '@/components/ui/button'

// Router state
const route = useRoute()

// Navbar tabs
const tabs = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Forecast', to: '/forecast', icon: LineChart },
  { label: 'Awareness', to: '/awareness', icon: Leaf },
]

// Active tab helper
const isActive = computed(() => (to: string) => route.path === to)

// Hero lottie refs
const earthLottieRef = ref<DotLottieVueInstance | null>(null)
const houseLottieRef = ref<DotLottieVueInstance | null>(null)
const cleanupFns: Array<() => void> = []

// Hold one-time lottie animations on a visible frame (avoid ending on blank frame)
const holdNearLastFrame = (
  lottieRef: typeof earthLottieRef,
  holdOffset = 2,
): (() => void) | null => {
  const player = lottieRef.value?.getDotLottieInstance()
  if (!player) return null

  const onComplete = () => {
    const safeFrame = Math.max(player.totalFrames - holdOffset, 0)
    player.setFrame(safeFrame)
    player.pause()
  }

  player.addEventListener('complete', onComplete)

  return () => {
    player.removeEventListener('complete', onComplete)
  }
}

// Register lottie completion handlers
onMounted(() => {
  // Delay a tick to let the dotLottie instances initialize.
  setTimeout(() => {
    const earthCleanup = holdNearLastFrame(earthLottieRef, 2)
    const houseCleanup = holdNearLastFrame(houseLottieRef, 2)

    if (earthCleanup) cleanupFns.push(earthCleanup)
    if (houseCleanup) cleanupFns.push(houseCleanup)
  }, 80)
})

// Cleanup event listeners
onBeforeUnmount(() => {
  cleanupFns.forEach((fn) => fn())
  cleanupFns.length = 0
})
</script>

<template>
  <!-- Page wrapper -->
  <div class="min-h-screen bg-white text-slate-900">
    <!-- Navbar -->
    <header
      class="border-b border-emerald-100 bg-white/85 shadow-sm shadow-slate-200/60 backdrop-blur"
    >
      <div class="mx-auto flex h-20 max-w-[1400px] items-center justify-between px-6 lg:px-10">
        <!-- Navbar: brand -->
        <RouterLink to="/" class="flex items-center gap-3">
          <img src="/logo.png" alt="GreenBreeze logo" class="h-10 w-10 rounded-md object-contain" />
          <div>
            <p class="text-[25px] font-extrabold tracking-tight text-[var(--gb-grid)]">
              GreenBreeze
            </p>
          </div>
        </RouterLink>

        <!-- Navbar: tabs -->
        <nav class="flex items-center gap-4">
          <Button
            v-for="tab in tabs"
            :key="tab.to"
            as-child
            :variant="isActive(tab.to) ? 'default' : 'outline'"
            class="rounded-full px-5"
          >
            <RouterLink :to="tab.to" class="flex items-center gap-2">
              <component :is="tab.icon" class="h-4 w-4" />
              {{ tab.label }}
            </RouterLink>
          </Button>
        </nav>
      </div>
    </header>

    <!-- Hero section -->
    <section class="w-full">
      <div
        class="mx-auto grid max-w-7xl gap-10 px-6 pb-14 pt-10 lg:grid-cols-2 lg:items-center lg:px-10"
      >
        <!-- Hero: text content -->
        <div class="p-2 text-slate-900 lg:pr-12">
          <h1 class="mt-4 text-2xl font-extrabold text-[#000] leading-tight lg:text-[55px]">
            Smarter Comfort for Every Season.
            <span class="block text-[var(--gb-grid)]">
              Protect the <span class="electric-flicker text-[var(--gb-electric)]">Grid</span>.
              Preserve Climate.
            </span>
          </h1>
        </div>

        <!-- Hero: animation composition -->
        <div class="relative mx-auto h-[380px] w-full max-w-[620px] lg:h-[520px]">
          <!-- Hero animation: earth (plays once) -->
          <div
            class="absolute left-1/2 top-[52%] z-10 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 lg:h-[400px] lg:w-[400px]"
          >
            <DotLottieVue
              ref="earthLottieRef"
              src="/lottie/hero/earth-green.lottie"
              autoplay
              :loop="false"
              style="width: 100%; height: 100%"
            />
          </div>

          <!-- Hero animation: house (plays once) -->
          <div
            class="absolute bottom-[-35%] left-1/2 z-20 h-[280px] w-[280px] -translate-x-1/2 lg:h-[700px] lg:w-[700px]"
          >
            <DotLottieVue
              ref="houseLottieRef"
              src="/lottie/hero/wood-house.lottie"
              autoplay
              :loop="false"
              style="width: 100%; height: 100%"
            />
          </div>

          <!-- Hero animation: left tower (looping) -->
          <div
            class="float-soft absolute bottom-[10%] left-[-5%] z-20 h-[120px] w-[120px] lg:h-[168px] lg:w-[168px]"
          >
            <DotLottieVue
              src="/lottie/hero/tower-electricity.lottie"
              autoplay
              loop
              style="width: 100%; height: 100%"
            />
          </div>

          <!-- Hero animation: right energy icon (looping) -->
          <div
            class="float-soft-delay absolute bottom-[10%] right-[-5%] z-20 h-[120px] w-[120px] lg:h-[168px] lg:w-[168px]"
          >
            <DotLottieVue
              src="/lottie/hero/save-energy.lottie"
              autoplay
              loop
              style="width: 100%; height: 100%"
            />
          </div>

          <!-- Hero animation: top-left smog cloud (looping) -->
          <div
            class="drift-cloud absolute left-[9%] top-[10%] z-30 h-[95px] w-[95px] opacity-85 lg:h-[132px] lg:w-[132px]"
          >
            <DotLottieVue
              src="/lottie/hero/smog-cloud.lottie"
              autoplay
              loop
              style="width: 100%; height: 100%"
            />
          </div>

          <!-- Hero animation: top-right smog cloud (looping) -->
          <div
            class="drift-cloud-delay absolute right-[9%] top-[10%] z-30 h-[95px] w-[95px] opacity-85 lg:h-[132px] lg:w-[132px]"
          >
            <DotLottieVue
              src="/lottie/hero/smog-cloud.lottie"
              autoplay
              loop
              style="width: 100%; height: 100%"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Story section: cause and impact chain -->
    <section class="w-full py-16">
      <div class="mx-auto max-w-7xl px-6 lg:px-10">
        <!-- Story section: heading -->
        <div class="mb-10">
          <h1 class="text-3xl text-center font-bold mb-[5rem] tracking-tight lg:text-5xl">
            How Peak Electricity Use Affects Climate
          </h1>
        </div>

        <!-- Story section: 3 rows (text + animation), middle row reversed -->
        <div class="space-y-6">
          <!-- Story row 1: text left, animation right -->
          <article class="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h3 class="mt-2 text-2xl font-bold lg:text-4xl">Peak-Time Cooling Usage Rises</h3>
              <p class="mt-3 text-[20px]">
                Households run cooling appliances heavily during the hottest hours, especially in
                thermally inefficient homes.
              </p>
            </div>

            <div class="relative mx-auto h-[400px] w-full max-w-[500px]">
              <div class="absolute inset-0">
                <DotLottieVue
                  src="/lottie/home-story/ac.lottie"
                  autoplay
                  loop
                  style="width: 100%; height: 100%"
                />
              </div>
              <div class="absolute top-10 right-46 z-20 h-[118px] w-[118px]">
                <DotLottieVue
                  src="/lottie/home-story/time.lottie"
                  autoplay
                  loop
                  style="width: 100%; height: 100%"
                />
              </div>
            </div>
          </article>

          <!-- Story row 2: animation left, text right (reversed) -->
          <article class="grid items-center gap-8 md:grid-cols-2">
            <div class="relative mx-auto h-[400px] w-full max-w-[450px]">
              <div class="absolute inset-0">
                <DotLottieVue
                  src="/lottie/home-story/co2.lottie"
                  autoplay
                  loop
                  style="width: 100%; height: 100%"
                />
              </div>
              <div class="absolute top-40 left-20 inset-0 z-20">
                <DotLottieVue
                  src="/lottie/home-story/spark.lottie"
                  autoplay
                  loop
                  style="width: 80%; height: 80%"
                />
              </div>
            </div>

            <div>
              <h3 class="mt-2 text-2xl font-bold lg:text-4xl">
                Grid Stress and Emissions Increase
              </h3>
              <p class="mt-3 text-[20px]">
                During peak windows, electricity demand pressures the grid and can increase carbon
                intensity in the energy mix.
              </p>
            </div>
          </article>

          <!-- Story row 3: text left, animation right -->
          <article class="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h3 class="mt-2 text-2xl font-bold lg:text-4xl">Climate Impacts Worsen</h3>
              <p class="mt-3 text-[20px]">
                Rising emissions contribute to hotter conditions and more frequent extreme heat,
                creating a cycle that further increases cooling demand.
              </p>
            </div>

            <div class="mx-auto h-[500px] w-full max-w-[600px]">
              <DotLottieVue
                src="/lottie/home-story/temprising.lottie"
                autoplay
                loop
                style="width: 100%; height: 100%"
              />
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- Why section: one row, two columns -->
    <section class="w-full py-6">
      <h1 class="text-3xl text-center font-bold mb-[4rem] tracking-tight lg:text-5xl">
        Why GreenBreeze Exists
      </h1>

      <div class="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-2 lg:px-10">
        <!-- Why section: left image -->
        <div class="overflow-hidden rounded-[10px] border border-slate-200 shadow-sm">
          <img
            src="/home-control.jpg"
            alt="Smart home heating and cooling control interface"
            class="h-full w-full object-cover"
          />
        </div>

        <!-- Why section: right text -->
        <div>
          <h3 class="text-xl font-bold lg:text-3xl">
            Avoid worst peak windows. Keep homes comfortable. Reduce climate impact.
          </h3>
          <p class="mt-4 text-[20px]">
            GreenBreeze helps households make smarter heating and cooling choices during high-risk
            periods, balancing indoor comfort with lower grid pressure and lower emissions.
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Animation utility: floating motion (left tower) */
.float-soft {
  animation: floatSoft 4s ease-in-out infinite;
}

/* Animation utility: floating motion with slight delay (right icon) */
.float-soft-delay {
  animation: floatSoft 4.8s ease-in-out infinite;
}

/* Animation utility: cloud drift */
.drift-cloud {
  animation: driftCloud 6s ease-in-out infinite;
}

/* Animation utility: cloud drift opposite timing */
.drift-cloud-delay {
  animation: driftCloud 7s ease-in-out infinite reverse;
}

/* Text effect: electric flicker on the word "Grid" */
.electric-flicker {
  animation: electricFlicker 2.4s linear infinite;
  text-shadow:
    0 0 5px rgb(245 158 11 / 0.45),
    0 0 10px rgb(245 158 11 / 0.28);
}

/* Keyframes: vertical float */
@keyframes floatSoft {
  0%,
  100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-8px);
  }
}

/* Keyframes: horizontal cloud drift */
@keyframes driftCloud {
  0%,
  100% {
    transform: translateX(0px);
    opacity: 0.8;
  }
  50% {
    transform: translateX(8px);
    opacity: 1;
  }
}

/* Keyframes: bulb-like flicker */
@keyframes electricFlicker {
  0%,
  18%,
  22%,
  46%,
  55%,
  100% {
    opacity: 1;
    filter: brightness(1);
  }
  20%,
  52% {
    opacity: 0.7;
    filter: brightness(1.35);
  }
  21%,
  53% {
    opacity: 0.88;
    filter: brightness(1.15);
  }
}
</style>
