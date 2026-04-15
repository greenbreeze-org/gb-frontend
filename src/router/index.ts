import { createRouter, createWebHistory } from 'vue-router'
import AwarenessView from '@/views/AwarenessView.vue'
import ForecastView from '@/views/ForecastView.vue'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
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
      path: '/awareness',
      name: 'awareness',
      component: AwarenessView,
    },
  ],
})

export default router
