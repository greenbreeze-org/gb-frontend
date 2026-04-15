<script setup lang="ts">
import { DotLottieVue } from '@lottiefiles/dotlottie-vue'
import type { DotLottieVueInstance } from '@lottiefiles/dotlottie-vue'
import { Home, LineChart, Leaf } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { Button } from '@/components/ui/button'

const route = useRoute()

const tabs = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Forecast', to: '/forecast', icon: LineChart },
  { label: 'Awareness', to: '/awareness', icon: Leaf },
]

const isActive = computed(() => (to: string) => route.path === to)

const earthLottieRef = ref<DotLottieVueInstance | null>(null)
const houseLottieRef = ref<DotLottieVueInstance | null>(null)
const cleanupFns: Array<() => void> = []

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

onMounted(() => {
  // Delay a tick to let the dotLottie instances initialize.
  setTimeout(() => {
    const earthCleanup = holdNearLastFrame(earthLottieRef, 2)
    const houseCleanup = holdNearLastFrame(houseLottieRef, 2)

    if (earthCleanup) cleanupFns.push(earthCleanup)
    if (houseCleanup) cleanupFns.push(houseCleanup)
  }, 80)
})

onBeforeUnmount(() => {
  cleanupFns.forEach((fn) => fn())
  cleanupFns.length = 0
})
</script>

<template>
  <div class="min-h-screen bg-white text-slate-900">
    <header class="border-b border-emerald-100 bg-white/85 shadow-sm shadow-slate-200/60 backdrop-blur">
      <div class="mx-auto flex h-20 max-w-[1400px] items-center justify-between px-6 lg:px-10">
        <RouterLink to="/" class="flex items-center gap-3">
          <img src="/logo.png" alt="GreenBreeze logo" class="h-10 w-10 rounded-md object-contain" />
          <div>
            <p class="text-lg font-extrabold tracking-tight text-[var(--gb-grid)]">GreenBreeze</p>
          </div>
        </RouterLink>

        <nav class="flex items-center gap-2">
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

    <section class="w-full">
      <div
        class="mx-auto grid max-w-7xl gap-10 px-6 pb-14 pt-10 lg:grid-cols-2 lg:items-center lg:px-10"
      >
        <div class="p-2 text-slate-900 lg:pr-12">
          <h1 class="mt-4 text-4xl font-extrabold leading-tight lg:text-6xl">
            Smarter Comfort for Every Season.
            <span class="block text-[var(--gb-grid)]">
              Protect the <span class="text-[var(--gb-electric)]">Grid</span>. Preserve Climate.
            </span>
          </h1>
        </div>

        <div class="relative mx-auto h-[380px] w-full max-w-[620px] lg:h-[520px]">
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
  </div>
</template>

<style scoped>
.float-soft {
  animation: floatSoft 4s ease-in-out infinite;
}

.float-soft-delay {
  animation: floatSoft 4.8s ease-in-out infinite;
}

.drift-cloud {
  animation: driftCloud 6s ease-in-out infinite;
}

.drift-cloud-delay {
  animation: driftCloud 7s ease-in-out infinite reverse;
}

@keyframes floatSoft {
  0%,
  100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-8px);
  }
}

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
</style>
