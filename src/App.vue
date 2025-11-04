<script setup>
import ScrollToTop from '@core/components/ScrollToTop.vue'
import initCore from '@core/initCore'
import {
  initConfigStore,
  useConfigStore,
} from '@core/stores/config'
import { useNotificationsStore } from '@/@core/stores/notifications'
import { getTokens } from '@/api/http'
import { hexToRgb } from '@core/utils/colorConverter'
import { useTheme } from 'vuetify'

const { global } = useTheme()

// ℹ️ Sync current theme with initial loader theme
initCore()
initConfigStore()

const configStore = useConfigStore()
const notificationsStore = useNotificationsStore()

// 웹소켓 자동 연결 및 알림 로드
onMounted(async () => {
  // 로그인 상태 확인 후에만 API 호출
  const { accessToken } = getTokens()
  if (accessToken) {
    try {
      notificationsStore.connectWebSocket()
      // 서버에서 기존 알림 로드
      await notificationsStore.loadNotifications()
    } catch (error) {
      // 에러는 무시 (이미 인터셉터에서 처리됨)
      console.warn('[App] Failed to initialize notifications:', error)
    }
  }
})

onBeforeUnmount(() => {
  notificationsStore.disconnectWebSocket()
})
</script>

<template>
  <VLocaleProvider :rtl="configStore.isAppRTL">
    <!-- ℹ️ This is required to set the background color of active nav link based on currently active global theme's primary -->
    <VApp :style="`--v-global-theme-primary: ${hexToRgb(global.current.value.colors.primary)}`">
      <RouterView />
      <ScrollToTop />
    </VApp>
  </VLocaleProvider>
</template>
