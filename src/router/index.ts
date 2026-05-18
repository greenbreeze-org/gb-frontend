import { createRouter, createWebHashHistory } from 'vue-router'
import AccessGateView from '@/views/AccessGateView.vue'
import AwarenessView from '@/views/AwarenessView.vue'
import ForecastView from '@/views/ForecastView.vue'
import HomeView from '@/views/HomeView.vue'
import ProfileSetupView from '@/views/ProfileSetupView.vue'
import SmartActionsView from '@/views/SmartActionsView.vue'

const ACCESS_KEY = 'gb_access_granted'

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
      path: '/login',
      name: 'login',
      component: AccessGateView,
    },
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
  ],
})

router.beforeEach((to) => {
  const isUnlocked = sessionStorage.getItem(ACCESS_KEY) === 'true'

  if (!isUnlocked && to.name !== 'login') {
    return {
      name: 'login',
      query: {
        redirect: to.fullPath,
      },
    }
  }

  if (isUnlocked && to.name === 'login') {
    return {
      name: 'home',
    }
  }

  return true
})

export default router
