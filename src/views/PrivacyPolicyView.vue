<script setup lang="ts">
import SiteFooter from '@/components/layout/SiteFooter.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
</script>

<template>
  <SiteHeader />

  <main class="mx-auto w-full max-w-5xl px-6 py-10 text-slate-900 lg:px-10">
    <h1 class="text-4xl font-extrabold tracking-tight text-[var(--gb-grid)]">Privacy Policy</h1>
    <p class="mt-2 text-sm font-semibold text-slate-600">Last updated: May 2026</p>

    <p class="mt-8 text-base leading-7">
      This Privacy Policy explains what data GreenBreeze may collect, how it is used, and how user privacy is
      protected within the prototype.
    </p>

    <section class="mt-8 space-y-3">
      <h2 class="text-2xl font-extrabold">Who We Are</h2>
      <p class="text-base leading-7">
        GreenBreeze is not a commercial product and it is not operated by a company. We designed it to help
        households make smarter energy-related decisions, reduce emissions, save money, and better understand the
        impact of their daily actions.
      </p>
    </section>

    <section class="mt-8 space-y-3">
      <h2 class="text-2xl font-extrabold">What We Collect</h2>
      <p class="text-base leading-7">
        GreenBreeze only collects information needed to provide personalised recommendations and impact estimates.
        This may include:
      </p>
      <ul class="list-disc space-y-2 pl-6 text-base leading-7">
        <li>
          Postcode and location data. This data is used to provide location-relevant energy and environmental
          insights.
        </li>
        <li>
          Home and appliance preferences. This may include information such as home type, cooling or heating devices,
          and general household energy-use context.
        </li>
        <li>
          Completed actions data. This may include information about whether you have completed recommended actions.
        </li>
        <li>
          Mode preferences data. This may include whether you choose to view results in Climate Mode or Money Mode.
        </li>
      </ul>
      <p class="text-base leading-7">
        GreenBreeze does not intentionally collect government identifiers, email address, or payment details. Because
        this is a prototype, some experiences may rely on local browser storage or shared demo records rather than
        full production-style user accounts.
      </p>
    </section>

    <section class="mt-8 space-y-3">
      <h2 class="text-2xl font-extrabold">How We Use This Data</h2>
      <p class="text-base leading-7">
        The data in this prototype is used to generate features such as smart action recommendations, climate impact,
        savings projections, everyday equivalents, and to support prototype testing and improvement.
      </p>
    </section>

    <section class="mt-8 space-y-3">
      <h2 class="text-2xl font-extrabold">Where Data May Be Stored</h2>
      <p class="text-base leading-7">
        GreenBreeze is designed to minimise data collection and storage, data may be stored in browser storage on your
        device.
      </p>
    </section>

    <section class="mt-8 space-y-3">
      <h2 class="text-2xl font-extrabold">Data Sharing</h2>
      <p class="text-base leading-7">
        Your information is not shared with advertisers or unrelated third parties. If external data sources are used,
        such as weather or emissions data, they are used to provide general environmental information and do not
        require personal identification.
      </p>
    </section>

    <section class="mt-8 space-y-3">
      <h2 class="text-2xl font-extrabold">Your Choices</h2>
      <p class="text-base leading-7">
        You can choose not to allow location access and can enter a postcode manually and complete or uncheck
        recommended actions. You can also clear your browser data if you want to remove locally stored prototype
        information.
      </p>
    </section>

    <section class="mt-8 space-y-3">
      <h2 class="text-2xl font-extrabold">Limitations of the Prototype</h2>
      <p class="text-base leading-7">
        GreenBreeze is not intended to be a fully deployed commercial system. Some features may use simplified data
        models, shared demo records, or browser-only storage. As a result, privacy and deletion may not yet match the
        standards of a full consumer product. The estimates shown in GreenBreeze, including CO2 savings, money
        savings, and everyday equivalents, are approximate and are provided for educational and decision-support
        purposes only.
      </p>
    </section>

    <section class="mt-8 space-y-3">
      <h2 class="text-2xl font-extrabold">Contact</h2>
      <p class="text-base leading-7">
        For questions about this prototype or its privacy approach, you can contact the GreenBreeze project team.
      </p>
    </section>
  </main>

  <SiteFooter />
</template>
