import { createRouter, createWebHashHistory } from 'vue-router'
import AwarenessView from '@/views/AwarenessView.vue'
import ForecastView from '@/views/ForecastView.vue'
import HomeView from '@/views/HomeView.vue'
import PrivacyPolicyView from '@/views/PrivacyPolicyView.vue'
import ProfileSetupView from '@/views/ProfileSetupView.vue'
import SmartActionsView from '@/views/SmartActionsView.vue'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth',
      }
    }
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/forecast',
      name: 'forecast',
      component: ForecastView,
    },
    {
      path: '/profile-setup',
      name: 'profile-setup',
      component: ProfileSetupView,
    },
    {
      path: '/awareness',
      name: 'awareness',
      component: AwarenessView,
    },
    {
      path: '/smart-actions',
      name: 'smart-actions',
      component: SmartActionsView,
    },
    {
      path: '/privacy-policy',
      name: 'privacy-policy',
      component: PrivacyPolicyView,
    },
  ],
})

export default router
