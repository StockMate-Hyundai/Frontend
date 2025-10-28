// File: src/api/websocket.js
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

  /**
   * 현재 사용자 정보 로드
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
   */
  async connect() {
    if (!this.currentUser?.memberId) {
      await this.loadCurrentUser()
    }

    if (!this.currentUser?.memberId) {
      throw new Error('User ID not found')
    }

    const userId = this.currentUser.memberId
    const wsUrl = `wss://api.stockmate.site/ws/order?userId=${userId}`
    
    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(wsUrl)
        
        this.websocket.onopen = () => {
          console.log('WebSocket connected')
          this.isConnected = true
          this.emit('connected')
          resolve()
        }
        
        this.websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.handleMessage(data)
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e)
            this.emit('error', { type: 'parse_error', error: e })
          }
        }
        
        this.websocket.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.isConnected = false
          this.emit('error', { type: 'connection_error', error })
          reject(error)
        }
        
        this.websocket.onclose = () => {
          console.log('WebSocket disconnected')
          this.isConnected = false
          this.websocket = null
          this.emit('disconnected')
        }
      } catch (e) {
        console.error('Failed to create WebSocket:', e)
        reject(e)
      }
    })
  }

  /**
   * 웹소켓 메시지 처리
   */
  handleMessage(data) {
    console.log('WebSocket message:', data)
    
    if (data.type === 'ORDER_APPROVAL_RESPONSE') {
      this.emit('approval_response', data)
    } else {
      this.emit('message', data)
    }
  }

  /**
   * 이벤트 리스너 등록
   */
  on(event, handler) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, [])
    }
    this.messageHandlers.get(event).push(handler)
  }

  /**
   * 이벤트 리스너 제거
   */
  off(event, handler) {
    if (this.messageHandlers.has(event)) {
      const handlers = this.messageHandlers.get(event)
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * 이벤트 발생
   */
  emit(event, data) {
    if (this.messageHandlers.has(event)) {
      this.messageHandlers.get(event).forEach(handler => {
        try {
          handler(data)
        } catch (e) {
          console.error(`Error in event handler for ${event}:`, e)
        }
      })
    }
  }

  /**
   * 웹소켓 연결 해제
   */
  disconnect() {
    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
      this.isConnected = false
    }
  }

  /**
   * 연결 상태 확인
   */
  get connected() {
    return this.isConnected && this.websocket?.readyState === WebSocket.OPEN
  }
}

/**
 * 주문 승인 웹소켓 인스턴스 생성 및 관리
 */
export function createOrderApprovalWebSocket() {
  return new OrderApprovalWebSocket()
}

/**
 * 주문 승인 프로세스 실행
 * @param {number} orderId - 주문 ID
 * @param {Function} onMessage - 메시지 핸들러
 * @param {Function} onError - 에러 핸들러
 * @param {Function} onComplete - 완료 핸들러
 */
export async function executeOrderApproval(orderId, onMessage, onError, onComplete) {
  const ws = createOrderApprovalWebSocket()
  
  try {
    // 웹소켓 연결
    await ws.connect()
    
    // 이벤트 핸들러 등록
    ws.on('approval_response', (data) => {
      onMessage(data)
      
      if (data.step === 'COMPLETED') {
        onComplete(data)
        ws.disconnect()
      } else if (data.step === 'ERROR') {
        onError(data)
        ws.disconnect()
      }
    })
    
    ws.on('error', (error) => {
      onError(error)
      ws.disconnect()
    })
    
    ws.on('disconnected', () => {
      console.log('WebSocket disconnected')
    })
    
    return ws
  } catch (error) {
    onError(error)
    ws.disconnect()
    throw error
  }
}
