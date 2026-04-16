<script setup lang="ts">
import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
</script>


<template>
    <!-- Shared navbar -->
    <SiteHeader />

     <!-- Hero -->
    <section
      class="relative flex w-full min-h-[320px] items-center justify-center overflow-hidden px-6 py-10 lg:min-h-[600px] lg:px-10"
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

<!-- Shared footer -->
    <SiteFooter />
</template>