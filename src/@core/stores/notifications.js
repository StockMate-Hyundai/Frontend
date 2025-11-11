import { getProfile } from '@/api/http'
import {
    getAllNotifications,
    getUnreadNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead
} from '@/api/order'
import { createDashboardWebSocket } from '@/api/websocket'

/**
 * 알림 상태 관리 store
 */
export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref([])
  const ws = ref(null)
  const maxNotifications = 100 // 최대 알림 개수
  
  // 알림 데이터를 UI 형태로 변환
  const transformNotification = (data) => {
    return {
      id: data.id,
      title: data.message || '',
      subtitle: data.orderNumber || '',
      time: formatNotificationTime(data.createdAt),
      isSeen: data.isRead || false,
      icon: 'bx-bell',
      color: 'primary',
      data: {
        orderId: data.orderId,
        orderNumber: data.orderNumber,
      },
    }
  }
  
  // 시간 포맷팅
  const formatNotificationTime = (dateTime) => {
    if (!dateTime) return '방금 전'
    
    const now = new Date()
    const time = new Date(dateTime)
    const diffMs = now - time
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return '방금 전'
    if (diffMins < 60) return `${diffMins}분 전`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}시간 전`
    
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}일 전`
    
    return time.toLocaleDateString('ko-KR')
  }
  
  // 역할에 따라 타입 결정
  const getNotificationType = () => {
    const { role } = getProfile()
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return 'admin'
    if (role === 'WAREHOUSE') return 'warehouse'
    return 'admin' // 기본값
  }

  // 알림 추가
  const addNotification = (notificationData) => {
    const notification = {
      id: Date.now() + Math.random(), // 유니크 ID 생성
      title: notificationData.message || '',
      subtitle: notificationData.data?.orderNumber || '',
      time: '방금 전',
      isSeen: false,
      icon: 'bx-bell',
      color: 'primary',
      data: notificationData.data || {},
    }
    
    notifications.value.unshift(notification)
    
    // 최대 개수 제한
    if (notifications.value.length > maxNotifications) {
      notifications.value = notifications.value.slice(0, maxNotifications)
    }
  }

  // 알림 읽음 처리
  const markRead = (notificationIds) => {
    notifications.value.forEach(item => {
      if (notificationIds.includes(item.id)) {
        item.isSeen = true
      }
    })
  }

  // 알림 읽음 취소
  const markUnread = (notificationIds) => {
    notifications.value.forEach(item => {
      if (notificationIds.includes(item.id)) {
        item.isSeen = false
      }
    })
  }

  // 알림 제거
  const removeNotification = (notificationId) => {
    const index = notifications.value.findIndex(item => item.id === notificationId)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  // 모든 알림 초기화
  const clearNotifications = () => {
    notifications.value = []
  }

  // 웹소켓 연결
  const connectWebSocket = async () => {
    try {
      // 이미 연결되어 있으면 리턴
      if (ws.value?.connected) {
        return
      }

      // 역할 확인
      const { role } = getProfile()
      if (!role || (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'WAREHOUSE')) {
        return
      }

      // 웹소켓 연결
      ws.value = createDashboardWebSocket()
      
      ws.value.on('connected', () => {
        // 연결 성공 (필요시 로깅)
      })

      ws.value.on('notification', (data) => {
        addNotification(data)
      })

      ws.value.on('error', (error) => {
        console.error('[NotificationsStore] WebSocket error:', error)
      })

      ws.value.on('disconnected', () => {
        // 연결 해제 (필요시 로깅)
      })

      await ws.value.connect()
    } catch (error) {
      console.error('[NotificationsStore] Failed to connect WebSocket:', error)
    }
  }

  // 웹소켓 연결 해제
  const disconnectWebSocket = () => {
    if (ws.value) {
      ws.value.disconnect()
      ws.value = null
    }
  }

  // 서버에서 알림 조회
  const loadNotifications = async () => {
    try {
      const type = getNotificationType()
      const result = await getAllNotifications(type)
      notifications.value = result.data.map(transformNotification)
    } catch (error) {
      console.error('[NotificationsStore] Failed to load notifications:', error)
    }
  }

  // 읽지 않은 알림만 조회
  const loadUnreadNotifications = async () => {
    try {
      const type = getNotificationType()
      const result = await getUnreadNotifications(type)
      notifications.value = result.data.map(transformNotification)
    } catch (error) {
      console.error('[NotificationsStore] Failed to load unread notifications:', error)
    }
  }

  // 서버에 읽음 처리
  const markReadOnServer = async (notificationIds) => {
    try {
      // 로컬 상태 먼저 업데이트
      markRead(notificationIds)
      
      // 서버에 요청
      await Promise.all(notificationIds.map(id => {
        // 클라이언트에서 생성한 ID가 아닌 경우에만 서버에 요청
        if (typeof id === 'number' || id < Date.now() - 86400000) { // 숫자이거나 24시간 이내가 아닌 경우
          return markNotificationAsRead(id).catch(err => {
            console.error(`[NotificationsStore] Failed to mark ${id} as read:`, err)
            // 실패하면 로컬 상태 롤백
            markUnread([id])
          })
        }
      }))
    } catch (error) {
      console.error('[NotificationsStore] Failed to mark as read:', error)
    }
  }

  // 서버에 전체 읽음 처리
  const markAllReadOnServer = async () => {
    try {
      const type = getNotificationType()
      await markAllNotificationsAsRead(type)
      
      // 로컬 상태 업데이트
      const allIds = notifications.value.map(n => n.id)
      markRead(allIds)
    } catch (error) {
      console.error('[NotificationsStore] Failed to mark all as read:', error)
    }
  }

  return {
    notifications,
    addNotification,
    markRead,
    markUnread,
    removeNotification,
    clearNotifications,
    connectWebSocket,
    disconnectWebSocket,
    loadNotifications,
    loadUnreadNotifications,
    markReadOnServer,
    markAllReadOnServer,
  }
})

