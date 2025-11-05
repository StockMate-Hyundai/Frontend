/**
 * 안드로이드 걸음수 측정 유틸리티
 * 시뮬레이션 모드: 1초에 1걸음씩 증가
 */

/**
 * 걸음수 측정 클래스
 */
export class PedometerManager {
  constructor() {
    this.isInitialized = false
    this.stepCount = 0
    this.distance = 0
    this.startTime = null
    this.isTracking = false
    this.interval = null
    this.onStepUpdateCallback = null
  }

  /**
   * 초기화
   */
  async initialize() {
    console.log('[Pedometer] initialize() 호출됨')
    if (this.isInitialized) {
      console.log('[Pedometer] 이미 초기화되어 있음')
      return true
    }

    // 시뮬레이션 모드이므로 항상 성공
    this.isInitialized = true
    console.log('[Pedometer] 초기화 완료 (시뮬레이션 모드)')
    return true
  }

  /**
   * 걸음수 측정 시작
   * 1초에 1걸음씩 증가
   */
  async startTracking() {
    console.log('[Pedometer] startTracking() 호출됨')
    
    if (!this.isInitialized) {
      console.log('[Pedometer] 초기화되지 않음. 초기화 시작...')
      await this.initialize()
    }

    if (this.isTracking) {
      console.warn('[Pedometer] 이미 추적 중입니다')
      return
    }

    // 시뮬레이션 모드: 초기값 설정
    this.stepCount = 0
    this.distance = 0
    this.startTime = Date.now()
    this.isTracking = true
    
    console.log('[Pedometer] 시뮬레이션 모드로 추적 시작')
    console.log('[Pedometer] 1초에 1걸음씩 증가')
    
    // 초기값 콜백 호출
    if (this.onStepUpdateCallback) {
      this.onStepUpdateCallback(this.stepCount, this.distance)
    }
    
    // 1초마다 걸음수 증가
    this.interval = setInterval(() => {
      this.stepCount++
      this.distance = this.stepCount * 0.7 // 70cm per step
      
      console.log('[Pedometer] [시뮬레이션] 걸음수:', this.stepCount, ', 거리:', this.distance.toFixed(2), 'm')
      
      if (this.onStepUpdateCallback) {
        this.onStepUpdateCallback(this.stepCount, this.distance)
      }
    }, 1000)
  }

  /**
   * 현재 걸음수 가져오기
   */
  async getCurrentStepCount() {
    return this.stepCount
  }

  /**
   * 현재 측정된 걸음수
   */
  async getSteps() {
    if (!this.isTracking) {
      return 0
    }

    return this.stepCount
  }

  /**
   * 추적 중지
   */
  async stopTracking() {
    if (!this.isTracking) return

    // 인터벌 중지
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }

    this.isTracking = false
    console.log('[Pedometer] 추적 중지')
  }

  /**
   * 걸음수 업데이트 콜백 설정
   */
  onStepUpdate(callback) {
    this.onStepUpdateCallback = callback
    console.log('[Pedometer] onStepUpdate 콜백 설정됨')
  }
  
  /**
   * 추적 중인지 확인 (getter)
   */
  get trackingStatus() {
    return this.isTracking
  }
}

// 싱글톤 인스턴스
let pedometerInstance = null

/**
 * 걸음수 측정 인스턴스 가져오기
 */
export function getPedometer() {
  if (!pedometerInstance) {
    pedometerInstance = new PedometerManager()
  }
  return pedometerInstance
}
