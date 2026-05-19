<template>
  <footer class="w-full border-t border-white/15 bg-[var(--gb-grid)] py-8 text-white">
    <div class="mx-auto grid max-w-7xl gap-6 px-6 lg:grid-cols-[1.2fr_1fr_1fr] lg:px-10">
      <div class="text-center lg:text-left">
        <p class="text-2xl  text-white/90 font-extrabold tracking-tight">GreenBreeze</p>
        <p class="mt-2 text-sm font-medium text-white/90">
          Smarter Heating & Cooling for Climate Action.
        </p>
      </div>

      <div class="text-center">
        <p class="text-xs font-bold uppercase tracking-[0.16em] text-white/75">Platform</p>
        <p class="mt-2 text-sm font-semibold text-white/95">Smart Actions</p>
        <p class="mt-1 text-sm font-semibold text-white/95">Awareness</p>
        <p class="mt-1 text-sm font-semibold text-white/95">Home Profile Setup</p>
      </div>

      <div class="text-center lg:text-right">
        <p class="text-xs font-bold uppercase tracking-[0.16em] text-white/75">Location</p>
        <p class="mt-2 text-sm font-semibold text-white/95">Melbourne, Victoria</p>
        <p class="mt-1 text-sm font-semibold text-white/95">Australia</p>
        <RouterLink
          to="/privacy-policy"
          class="mt-2 inline-block text-sm font-semibold text-white/95 underline underline-offset-4 transition hover:text-white"
        >
          Privacy Policy
        </RouterLink>
      </div>
    </div>

    <div class="mx-auto mt-6 max-w-7xl border-t border-white/20 px-6 pt-4 text-center lg:px-10">
      <p class="text-sm font-medium text-white/90">© 2026 GreenBreeze. All rights reserved.</p>
    </div>
  </footer>
</template>
