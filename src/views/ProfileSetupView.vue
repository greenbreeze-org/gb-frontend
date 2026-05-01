<script setup lang="ts">
import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
</script>

<template>
  <div class="min-h-screen bg-white text-slate-900">
    <SiteHeader />

    <main class="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <section class="mx-auto max-w-5xl rounded-2xl border border-slate-200 p-8 lg:p-10">
        <h1 class="mb-8 text-center text-4xl font-bold tracking-tight">Profile Setup</h1>
      </section>
    </main>

    <SiteFooter />
  </div>
</template>
