<script setup lang="ts">
// Imports
import { Home, LineChart, Leaf, UserRound } from 'lucide-vue-next'
import { computed } from 'vue'
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
</script>

<template>
  <!-- Shared navbar -->
  <header class="border-b border-emerald-100 bg-white/85 shadow-sm shadow-slate-200/60 backdrop-blur">
    <div class="mx-auto flex h-20 max-w-[1400px] items-center justify-between px-6 lg:px-10">
      <!-- Navbar: brand -->
      <RouterLink to="/" class="flex items-center gap-3">
        <img src="/logo.png" alt="GreenBreeze logo" class="h-10 w-10 rounded-md object-contain" />
        <div>
          <p class="text-[25px] font-extrabold tracking-tight text-[var(--gb-grid)]">GreenBreeze</p>
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

        <Button
          as-child
          :variant="isActive('/profile-setup') ? 'default' : 'outline'"
          class="h-11 w-11 rounded-full p-0"
        >
          <RouterLink to="/profile-setup" aria-label="Open profile setup">
            <UserRound class="h-5 w-5" />
          </RouterLink>
        </Button>
      </nav>
    </div>
  </header>
</template>
