<script setup>
import { useNotificationsStore } from '@/@core/stores/notifications'
import { useRouter } from 'vue-router'

const notificationsStore = useNotificationsStore()
const router = useRouter()

const notifications = computed(() => notificationsStore.notifications)

const removeNotification = notificationId => {
  notificationsStore.removeNotification(notificationId)
}

const markRead = async notificationIds => {
  // 전체 읽음인 경우 별도 처리
  const totalNotifications = notificationsStore.notifications.length
  if (notificationIds.length === totalNotifications && totalNotifications > 0) {
    await notificationsStore.markAllReadOnServer()
  } else {
    await notificationsStore.markReadOnServer(notificationIds)
  }
}

const markUnRead = notificationIds => {
  notificationsStore.markUnread(notificationIds)
}

const handleNotificationClick = async notification => {
  // 주문 알림인 경우 주문 상세 페이지로 이동
  if (notification.data?.orderId) {
    router.push(`/order-detail/${notification.data.orderId}`)
  }
  
  // 읽음 처리 (서버 동기화)
  if (!notification.isSeen) {
    await markRead([notification.id])
  }
}
</script>

<template>
  <Notifications
    :notifications="notifications"
    @remove="removeNotification"
    @read="markRead"
    @unread="markUnRead"
    @click:notification="handleNotificationClick"
  />
</template>
