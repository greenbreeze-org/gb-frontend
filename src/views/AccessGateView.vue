<script setup lang="ts">
// Imports
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Constants
const ACCESS_KEY = 'gb_access_granted'
const PROJECT_PASSWORD = 'FIT5120'

// State
const route = useRoute()
const router = useRouter()
const password = ref('')
const error = ref('')

// Redirect destination after successful unlock
const redirectPath = computed(() => {
  const raw = route.query.redirect
  return typeof raw === 'string' && raw.startsWith('/') ? raw : '/'
})

// Submit handler
const unlockWebsite = async () => {
  if (password.value.trim() !== PROJECT_PASSWORD) {
    error.value = 'Incorrect password. Please try again.'
    return
  }

  sessionStorage.setItem(ACCESS_KEY, 'true')
  error.value = ''
  await router.replace(redirectPath.value)
}
</script>

<template>
  <!-- Full-screen gate wrapper -->
  <main class="flex min-h-screen items-center justify-center bg-slate-100 px-6">
    <!-- Gate card -->
    <section class="max-w-[400px] rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 class="text-3xl font-bold tracking-tight">GreenBreeze Access</h1>
      <p class="mt-2 text-[16px]">Enter the project password to open the website.</p>

      <form class="mt-6 space-y-8" @submit.prevent="unlockWebsite">
        <div class="space-y-2">
          <Label for="site-password" class="text-base font-semibold">Password</Label>
          <Input
            id="site-password"
            v-model="password"
            type="password"
            placeholder="Enter password"
            class="h-11 text-base"
          />
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        </div>

        <Button class="h-11 w-full border border-amber-200 bg-[var(--gb-electric)] text-base text-slate-900 hover:bg-amber-300">
          Unlock Website
        </Button>
      </form>
    </section>
  </main>
</template>
