import App from '@/App.vue'
import { registerPlugins } from '@core/utils/plugins'
import { createApp } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

// Styles
import '@core/scss/template/index.scss'
import '@styles/styles.scss'

/**
 * Vue 애플리케이션 초기화
 */
const app = createApp(App)

// 플러그인 등록
registerPlugins(app)

// ApexCharts 플러그인 등록 (마운트 전에 등록해야 함)
app.use(VueApexCharts)

// 애플리케이션 마운트
app.mount('#app')
