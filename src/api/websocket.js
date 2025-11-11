/**
 * 웹소켓 관련 API
 * 주문 승인 및 대시보드 알림을 위한 웹소켓 연결을 관리합니다.
 */
import { approveOrder } from './order'
import { apiGetMyUser } from './user'

/**
 * 주문 승인 웹소켓 관리 클래스
 * 주문 승인 프로세스 중 실시간 통신을 담당합니다.
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
    const wsUrl = `wss://api.stockmate.site/ws/order?userId=${userId}`

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

/**
 * 주문 승인 웹소켓 인스턴스 생성
 * @returns {OrderApprovalWebSocket} 웹소켓 인스턴스
 */
export function createOrderApprovalWebSocket() {
  return new OrderApprovalWebSocket()
}

/**
 * 대시보드 알림 웹소켓 관리 클래스
 * 대시보드 알림을 위한 웹소켓 연결을 관리하며 자동 재연결 기능을 제공합니다.
 */
export class DashboardWebSocket {
  /**
   * 대시보드 웹소켓 생성자
   * 자동 재연결 기능을 포함합니다.
   * Exponential Backoff + Jitter 전략을 사용하여 재연결 시도를 최적화합니다.
   */
  constructor() {
    this.websocket = null
    this.currentUser = null
    this.isConnected = false
    this.messageHandlers = new Map()
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.baseDelay = 1000 // 초기 지연 시간 (1초)
    this.maxDelay = 30000 // 최대 지연 시간 (30초)
    this.jitterRatio = 0.3 // Jitter 비율 (30%)
    this.reconnectTimer = null // 재연결 타이머 (취소 가능하도록)
  }

  /**
   * Exponential Backoff + Jitter를 사용한 재연결 지연 시간 계산
   * Exponential Backoff: baseDelay * 2^(attempts - 1)
   * Jitter: Exponential Backoff에 랜덤 요소 추가 (Thundering Herd 문제 해결)
   * 
   * Equal Jitter 방식 사용:
   * - baseDelay = exponentialDelay / 2
   * - jitter = random(0, exponentialDelay / 2)
   * - 최종 지연 시간 = baseDelay + jitter
   * 
   * @returns {number} 재연결 지연 시간 (밀리초)
   */
  calculateReconnectDelay() {
    if (this.reconnectAttempts === 0) {
      // 첫 번째 재시도는 Jitter 없이 기본 지연 시간 사용
      return this.baseDelay
    }
    
    // Exponential Backoff: baseDelay * 2^(attempts - 1)
    const exponentialDelay = this.baseDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    // 최대 지연 시간 제한
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay)
    
    // Equal Jitter: exponentialDelay / 2 + random(0, exponentialDelay / 2)
    // 이 방식은 최소 지연 시간을 보장하면서도 랜덤 요소를 추가합니다
    const baseJitterDelay = cappedDelay / 2
    const jitterRange = cappedDelay / 2
    const jitter = Math.random() * jitterRange
    
    // 최종 지연 시간 = baseJitterDelay + jitter
    // 범위: [cappedDelay / 2, cappedDelay]
    const finalDelay = Math.round(baseJitterDelay + jitter)
    
    return finalDelay
  }

  /**
   * 현재 사용자 정보 로드
   * @returns {Promise<Object>} 사용자 정보
   */
  async loadCurrentUser() {
    try {
      this.currentUser = await apiGetMyUser()
      
      return this.currentUser
    } catch (e) {
      console.error('Failed to load current user:', e)
      throw e
    }
  }

  /**
   * 웹소켓 연결
   * 역할에 따라 적절한 웹소켓 URL로 연결합니다.
   * @returns {Promise<void>}
   */
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

    const wsUrl = `wss://api.stockmate.site/ws/order/dashboard?type=${wsType}`

    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(wsUrl)

        this.websocket.onopen = () => {
          this.isConnected = true
          
          // 재연결 성공 시 카운터 리셋 및 타이머 취소
          if (this.reconnectAttempts > 0) {
            console.log('[DashboardWebSocket] 재연결 성공! Exponential Backoff + Jitter 카운터 리셋')
          }
          this.reconnectAttempts = 0
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
          }
          
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
          console.error('[DashboardWebSocket] Connection error:', error)
          reject(error)
        }

        this.websocket.onclose = () => {
          this.isConnected = false
          this.websocket = null
          this.emit('disconnected')
          
          // Exponential Backoff를 사용한 자동 재연결 시도
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            const delay = this.calculateReconnectDelay()
            
            console.log(
              `[DashboardWebSocket] 재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts} ` +
              `(지연: ${delay}ms, Exponential Backoff + Jitter 적용)`
            )
            
            // 기존 타이머가 있으면 취소 (중복 재연결 방지)
            if (this.reconnectTimer) {
              clearTimeout(this.reconnectTimer)
            }
            
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null
              this.connect().catch(error => {
                console.error('[DashboardWebSocket] 재연결 실패:', error)
              })
            }, delay)
          } else {
            console.error('[DashboardWebSocket] 최대 재연결 시도 횟수 도달')
            this.emit('error', { 
              type: 'max_reconnect_attempts_reached', 
              message: '최대 재연결 시도 횟수를 초과했습니다.' 
            })
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
    // 재연결 타이머 취소
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
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

/**
 * 대시보드 웹소켓 인스턴스 생성
 * @returns {DashboardWebSocket} 웹소켓 인스턴스
 */
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
