// File: src/api/websocket.js
import { approveOrder } from './order'
import { apiGetMyUser } from './user'

/**
 * 주문 승인 웹소켓 관리 클래스
 */
export class OrderApprovalWebSocket {
  constructor() {
    this.websocket = null
    this.currentUser = null
    this.isConnected = false
    this.messageHandlers = new Map()
  }

  async loadCurrentUser() {
    try {
      this.currentUser = await apiGetMyUser()
      
      return this.currentUser
    } catch (e) {
      console.error('Failed to load current user:', e)
      throw e
    }
  }

  async connect() {
    if (!this.currentUser?.memberId) {
      await this.loadCurrentUser()
    }
    if (!this.currentUser?.memberId) throw new Error('User ID not found')

    const userId = this.currentUser.memberId
    const wsUrl = `ㄴㄴㄴwss://api.stockmate.site/ws/order?userId=${userId}`

    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(wsUrl)

        this.websocket.onopen = () => {
          this.isConnected = true
          this.emit('connected')
          resolve()
        }

        this.websocket.onmessage = event => {
          try {
            const data = JSON.parse(event.data)

            this.handleMessage(data)
          } catch (e) {
            this.emit('error', { type: 'parse_error', error: e })
          }
        }

        this.websocket.onerror = error => {
          this.isConnected = false
          this.emit('error', { type: 'connection_error', error })
          reject(error)
        }

        this.websocket.onclose = () => {
          this.isConnected = false
          this.websocket = null
          this.emit('disconnected')
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  handleMessage(data) {
    if (data?.type === 'ORDER_APPROVAL_RESPONSE') {
      this.emit('approval_response', data)
    } else {
      this.emit('message', data)
    }
  }

  on(event, handler) {
    if (!this.messageHandlers.has(event)) this.messageHandlers.set(event, [])
    this.messageHandlers.get(event).push(handler)
  }

  off(event, handler) {
    if (this.messageHandlers.has(event)) {
      const handlers = this.messageHandlers.get(event)
      const index = handlers.indexOf(handler)
      if (index > -1) handlers.splice(index, 1)
    }
  }

  emit(event, data) {
    if (this.messageHandlers.has(event)) {
      this.messageHandlers.get(event).forEach(handler => {
        try { handler(data) } catch (e) { console.error(`Error in handler for ${event}:`, e) }
      })
    }
  }

  disconnect() {
    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
      this.isConnected = false
    }
  }

  get connected() {
    return this.isConnected && this.websocket?.readyState === WebSocket.OPEN
  }
}

/** 인스턴스 생성 */
export function createOrderApprovalWebSocket() {
  return new OrderApprovalWebSocket()
}

/**
 * 대시보드 알림 웹소켓 관리 클래스
 */
export class DashboardWebSocket {
  constructor() {
    this.websocket = null
    this.currentUser = null
    this.isConnected = false
    this.messageHandlers = new Map()
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 3000
  }

  async loadCurrentUser() {
    try {
      this.currentUser = await apiGetMyUser()
      
      return this.currentUser
    } catch (e) {
      console.error('Failed to load current user:', e)
      throw e
    }
  }

  async connect() {
    if (!this.currentUser) {
      await this.loadCurrentUser()
    }

    // 역할에 따라 웹소켓 URL 결정
    const role = this.currentUser?.role
    let wsType = ''
    
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      wsType = 'admin'
    } else if (role === 'WAREHOUSE') {
      wsType = 'warehouse'
    } else {
      console.warn('Unknown role:', role, '- WebSocket connection skipped')
      
      return
    }

    const wsUrl = `ㄴㄴㄴwss://api.stockmate.site/ws/order/dashboard?type=${wsType}`

    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(wsUrl)

        this.websocket.onopen = () => {
          this.isConnected = true
          this.reconnectAttempts = 0
          this.emit('connected')
          console.log('[DashboardWebSocket] Connected')
          resolve()
        }

        this.websocket.onmessage = event => {
          try {
            const data = JSON.parse(event.data)

            this.handleMessage(data)
          } catch (e) {
            this.emit('error', { type: 'parse_error', error: e })
          }
        }

        this.websocket.onerror = error => {
          this.isConnected = false
          this.emit('error', { type: 'connection_error', error })
          console.error('[DashboardWebSocket] Connection error:', error)
          reject(error)
        }

        this.websocket.onclose = () => {
          this.isConnected = false
          this.websocket = null
          this.emit('disconnected')
          console.log('[DashboardWebSocket] Disconnected')
          
          // 자동 재연결 시도
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            console.log(`[DashboardWebSocket] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
            setTimeout(() => this.connect(), this.reconnectDelay)
          } else {
            console.error('[DashboardWebSocket] Max reconnection attempts reached')
          }
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  handleMessage(data) {
    if (data?.type === 'DASHBOARD_NOTIFICATION') {
      this.emit('notification', data)
    } else {
      this.emit('message', data)
    }
  }

  on(event, handler) {
    if (!this.messageHandlers.has(event)) this.messageHandlers.set(event, [])
    this.messageHandlers.get(event).push(handler)
  }

  off(event, handler) {
    if (this.messageHandlers.has(event)) {
      const handlers = this.messageHandlers.get(event)
      const index = handlers.indexOf(handler)
      if (index > -1) handlers.splice(index, 1)
    }
  }

  emit(event, data) {
    if (this.messageHandlers.has(event)) {
      this.messageHandlers.get(event).forEach(handler => {
        try { handler(data) } catch (e) { console.error(`Error in handler for ${event}:`, e) }
      })
    }
  }

  disconnect() {
    this.maxReconnectAttempts = 0 // 재연결 비활성화
    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
      this.isConnected = false
    }
  }

  get connected() {
    return this.isConnected && this.websocket?.readyState === WebSocket.OPEN
  }
}

/** 인스턴스 생성 */
export function createDashboardWebSocket() {
  return new DashboardWebSocket()
}

/**
 * 주문 승인 프로세스 실행
 * @param {number} orderId
 * @param {(msg:any)=>void} onMessage
 * @param {(err:any)=>void} onError
 * @param {(final:any)=>void} onComplete
 */
export async function executeOrderApproval(orderId, onMessage, onError, onComplete) {
  const ws = createOrderApprovalWebSocket()
  let timeoutId = null

  try {
    // 1) 연결
    await ws.connect()
    onMessage?.({ step: 'CONNECTED', message: '웹소켓 연결이 완료되었습니다.', orderId })

    // 2) 30초 타임아웃
    timeoutId = setTimeout(() => {
      onError?.({ message: '승인 처리 시간이 초과되었습니다.', orderId, step: 'ERROR', type: 'TIMEOUT' })
      ws.disconnect()
    }, 30_000)

    // 3) 콜백 등록
    ws.on('approval_response', data => {
      // 모든 메시지 전달 (주문ID 필터링은 페이지에서 처리)
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }
      onMessage?.(data)

      if (data?.step === 'COMPLETED' || data?.step === 'APPROVAL_SUCCESS') {
        onComplete?.(data)

        // 연결은 페이지가 모달 닫을 때 끊도록 유지
      } else if (data?.step === 'ERROR') {
        onError?.(data)
        ws.disconnect()
      }
    })
    ws.on('error', error => {
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }
      onError?.(error)
      ws.disconnect()
    })
    ws.on('disconnected', () => {
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }
    })

    // 4) API 호출
    await approveOrder(orderId)
    onMessage?.({ step: 'API_CALLED', message: 'API 호출이 완료되었습니다. 서버 응답을 기다리는 중...', orderId })

    return ws
  } catch (error) {
    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }
    onError?.(error)
    ws.disconnect()
    throw error
  }
}
