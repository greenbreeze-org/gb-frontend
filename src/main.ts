import './style.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)

const isWindowsPlatform = () => {
  const uaDataPlatform = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData?.platform
  if (uaDataPlatform) return uaDataPlatform.toLowerCase().includes('windows')
  return /win/i.test(navigator.userAgent)
}

const isLikelyLowDprLaptop = () => {
  return window.innerWidth >= 1024 && window.devicePixelRatio <= 1.5
}

if (isWindowsPlatform()) {
  document.documentElement.classList.add('platform-windows')
  if (isLikelyLowDprLaptop()) {
    document.documentElement.classList.add('platform-windows-lowdpr')
  }
}

app.use(createPinia())
app.use(router)

app.mount('#app')
