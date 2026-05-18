<script setup lang="ts">
// Imports
import { DotLottieVue } from '@lottiefiles/dotlottie-vue'
import type { DotLottieVueInstance } from '@lottiefiles/dotlottie-vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { Button } from '@/components/ui/button'
import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'

// Hero lottie refs
const earthLottieRef = ref<DotLottieVueInstance | null>(null)
const houseLottieRef = ref<DotLottieVueInstance | null>(null)
const cleanupFns: Array<() => void> = []
const storySectionRef = ref<HTMLElement | null>(null)
let revealObserver: IntersectionObserver | null = null

const scrollToStorySection = () => {
  storySectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

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

  const revealTargets = document.querySelectorAll<HTMLElement>('.reveal-on-scroll')
  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        revealObserver?.unobserve(entry.target)
      })
    },
    {
      threshold: 0.18,
      rootMargin: '0px 0px -8% 0px',
    },
  )

  revealTargets.forEach((el) => revealObserver?.observe(el))

})

// Cleanup event listeners
onBeforeUnmount(() => {
  cleanupFns.forEach((fn) => fn())
  cleanupFns.length = 0
  revealObserver?.disconnect()
  revealObserver = null
})
</script>

<template>
  <!-- Page wrapper -->
  <div class="min-h-screen bg-white text-slate-900">
    <!-- Shared navbar -->
    <SiteHeader />

    <!-- Hero section -->
    <section class="hero-shell w-full reveal-on-scroll">
      <div
        class="hero-content mx-auto grid max-w-7xl gap-10 px-6 pb-8 pt-8 lg:grid-cols-2 lg:items-center lg:px-10"
      >
        <!-- Hero: text content -->
        <div class="p-2 text-slate-900 lg:pr-12">
          <h1 class="mt-4 text-2xl font-extrabold text-[#000] leading-tight lg:text-[55px] lg:leading-[1.05]">
            Smarter Comfort for Every Season.
            <span class="block text-[var(--gb-grid)]">
              Protect the <span class="electric-flicker text-[var(--gb-electric)]">Grid</span>.
              Preserve Climate.
            </span>
          </h1>

          <div class="mt-7 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              class="bg-[var(--gb-electric)] px-7 hover:bg-[#4CBB17] hover:text-white"
              as-child
            >
              <RouterLink to="/smart-actions">Set Up My Home Profile</RouterLink>
            </Button>
            <Button
              size="lg"
              variant="outline"
              class="px-7 hover:border-[#016601] hover:text-[#016601] hover:bg-[#f3f4f6]"
              as-child
            >
              <RouterLink to="/awareness">Make myself aware</RouterLink>
            </Button>
          </div>

          <p class="mt-4 text-sm font-semibold text-slate-600">
            New here? Start with your Home Profile Setup.
          </p>
        </div>

        <!-- Hero: animation composition -->
        <div class="relative mx-auto h-[320px] w-full max-w-[560px] lg:h-[470px] xl:h-[500px]">
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

      <div class="hero-scroll-cue-wrap">
        <button type="button" class="hero-scroll-cue" @click="scrollToStorySection">
          <span>Scroll to explore</span>
          <span class="hero-scroll-arrow" aria-hidden="true">↓</span>
        </button>
      </div>

      <div class="hero-bottom-fade" aria-hidden="true"></div>
    </section>

    <!-- Story section: cause and impact chain -->
    <section ref="storySectionRef" class="w-full py-4 reveal-on-scroll">
      <!-- Story section: heading -->
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
          How Peak Electricity Use Affects Climate
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

      <div class="mx-auto mt-10 max-w-7xl px-6 lg:px-10">
        <!-- Story section: 3 rows (text + animation), middle row reversed -->
        <div class="space-y-6">
          <!-- Story row 1: text left, animation right -->
          <article class="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h3 class="mt-2 text-2xl font-bold lg:text-4xl">Peak-Time Appliance Usage Rises</h3>
              <p class="mt-3 text-[20px]">
                Households run appliances heavily during the hottest or coolest hours, especially in
                thermally inefficient homes.
              </p>
              <RouterLink
                to="/smart-actions"
                class="mt-5 inline-flex items-center gap-1 text-base font-semibold text-blue-700 underline-offset-4 transition-colors hover:text-blue-800 hover:underline"
              >
                -> Get Smart Actions
              </RouterLink>
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
              <RouterLink
                to="/awareness"
                class="mt-5 inline-flex items-center gap-1 text-base font-semibold text-blue-700 underline-offset-4 transition-colors hover:text-blue-800 hover:underline"
              >
                -> Explore Awareness Dashboard
              </RouterLink>
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
              <RouterLink
                to="/awareness"
                class="mt-5 inline-flex items-center gap-1 text-base font-semibold text-blue-700 underline-offset-4 transition-colors hover:text-blue-800 hover:underline"
              >
                -> View Chart Analysis
              </RouterLink>
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
    <section class="w-full py-6 reveal-on-scroll">
      <div class="relative w-full bg-[var(--gb-grid)] min-h-[240px] flex items-center justify-center overflow-hidden mb-20">
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
          Why GreenBreeze Exists
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
          <Button class="mt-6 bg-[var(--gb-electric)] px-7 hover:bg-[#4CBB17] hover:text-white" as-child>
            <RouterLink to="/smart-actions">See Recommended Actions</RouterLink>
          </Button>
        </div>
      </div>
    </section>

    <!-- How it works section: curved split layout -->
    <section class="w-full mt-[6rem] reveal-on-scroll">
      <div class="relative overflow-hidden bg-white pb-20 pt-10 min-h-[760px] lg:pb-28 lg:pt-14 lg:min-h-[650px]">
        <div class="relative z-20 mx-auto max-w-7xl px-6 lg:px-10">
          <h1 class="text-center text-3xl font-bold tracking-tight lg:text-5xl">How It Works</h1>
        </div>

        <svg
          class="pointer-events-none absolute inset-x-0 top-[16%] z-0 h-[88%] w-full"
          viewBox="0 0 1440 620"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,210 C150,85 280,-10 460,220 C640,500 790,470 930,330 C1090,120 1260,60 1440,185 L1440,620 L0,620 Z"
            fill="var(--gb-grid)"
          />
        </svg>

        <div
          class="relative z-20 mx-auto mt-14 grid max-w-7xl gap-10 px-6 md:grid-cols-3 lg:mt-16 lg:px-10"
        >
          <article class="text-center md:translate-y-24 -translate-x-[120px]">
            <div class="mx-auto h-[220px] w-[220px] lg:h-[250px] lg:w-[250px]">
              <img
                src="/how-it-works/settings.svg"
                alt="Set location and home profile"
                class="h-full w-full object-contain"
              />
            </div>
            <h3 class="mt-4 text-xl font-bold text-white lg:text-2xl">Set Location + Home Profile</h3>
          </article>

          <article class="text-center md:-translate-y-8">
            <div class="mx-auto h-[220px] w-[220px] lg:h-[250px] lg:w-[250px]">
              <img
                src="/how-it-works/forecast.svg"
                alt="Get forecast and heatwave alerts"
                class="h-full w-full object-contain"
              />
            </div>
            <h3 class="mt-4 text-xl font-bold lg:text-2xl">
              Get Smart Actions + Weather Guidance
            </h3>
          </article>

          <article class="text-center md:translate-y-24 translate-x-[120px]">
            <div class="mx-auto h-[220px] w-[220px] lg:h-[250px] lg:w-[250px]">
              <img
                src="/how-it-works/awareness.svg"
                alt="View energy demand and emissions awareness"
                class="h-full w-full object-contain"
              />
            </div>
            <h3 class="mt-4 text-xl font-bold text-white lg:text-2xl">
              View Predictive Analysis
            </h3>
          </article>
        </div>
      </div>
    </section>

    <!-- CTA section -->
    <section
      class="reveal-on-scroll relative w-full overflow-hidden py-20 lg:py-45"
      style="
        background-image:
          linear-gradient(rgba(15, 23, 42, 0.5), rgba(15, 23, 42, 0.5)), url('/cta.jpg');
        background-size: cover;
        background-position: center;
      "
    >
      <div class="mx-auto max-w-5xl px-6 text-center lg:px-10">
        <h2 class="text-3xl font-bold tracking-tight text-white lg:text-5xl">
          Ready to Turn Daily Choices Into Climate Impact?
        </h2>
        <p class="mx-auto mt-4 max-w-3xl text-[20px] text-[#fef3c7]">
          Complete your Home Profile Setup, follow smart actions, and check your predictive analysis before
          exploring long-term awareness trends.
        </p>

        <div class="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" class="bg-[var(--gb-electric)] px-8 hover:bg-[#4CBB17] hover:text-white" as-child>
            <RouterLink to="/smart-actions">Start Smart Actions</RouterLink>
          </Button>
          <Button
            size="lg"
            variant="outline"
            class="border-white/70 bg-white/10 px-8 text-white hover:border-[#016601] hover:bg-[#f3f4f6] hover:text-[#016601]"
            as-child
          >
            <RouterLink to="/forecast">View Predictive Analysis</RouterLink>
          </Button>
        </div>
      </div>
    </section>

    <!-- Shared footer -->
    <SiteFooter />
  </div>
</template>

<style scoped>
:global(html) {
  scroll-behavior: smooth;
}

.hero-shell {
  position: relative;
  min-height: calc(100svh - 80px);
}

.hero-content {
  min-height: calc(100svh - 150px);
}

.hero-scroll-cue-wrap {
  position: absolute;
  left: 50%;
  bottom: 10px;
  transform: translateX(-50%);
  z-index: 40;
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

.hero-bottom-fade {
  pointer-events: none;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 96px;
  background: linear-gradient(180deg, rgb(255 255 255 / 0) 0%, rgb(255 255 255 / 1) 100%);
}

.reveal-on-scroll {
  opacity: 0;
  transform: translateY(20px);
  transition:
    opacity 760ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 760ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
}

.reveal-on-scroll.is-visible {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .reveal-on-scroll {
    opacity: 1;
    transform: none;
    transition: none;
  }

  .hero-scroll-arrow {
    animation: none;
  }
}

@media (max-width: 1023px) {
  .hero-shell {
    min-height: auto;
  }

  .hero-content {
    min-height: auto;
    padding-bottom: 5.5rem;
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
