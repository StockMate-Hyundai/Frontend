/**
 * 안드로이드 걸음수 측정 유틸리티
 * @capawesome-team/capacitor-pedometer 사용
 */

import { Pedometer } from '@capawesome-team/capacitor-pedometer'

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
    this.listener = null
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

    try {
      // Pedometer 플러그인 사용 가능 여부 확인
      const { stepCounting } = await Pedometer.isAvailable()
      console.log('[Pedometer] 걸음수 카운팅 사용 가능:', stepCounting)
      
      if (!stepCounting) {
        console.warn('[Pedometer] 이 기기에서는 걸음수 카운팅을 사용할 수 없습니다')
        return false
      }

      this.isInitialized = true
      console.log('[Pedometer] 초기화 완료')
      return true
    } catch (error) {
      console.error('[Pedometer] 초기화 실패:', error)
      console.error('[Pedometer] 에러 메시지:', error.message)
      console.error('[Pedometer] 에러 스택:', error.stack)
      return false
    }
  }

  /**
   * 권한 확인
   */
  async checkPermissions() {
    try {
      const status = await Pedometer.checkPermissions()
      console.log('[Pedometer] 권한 상태:', status)
      return status.activityRecognition === 'granted'
    } catch (error) {
      console.error('[Pedometer] 권한 확인 실패:', error)
      return false
    }
  }

  /**
   * 권한 요청
   */
  async requestPermissions() {
    try {
      const status = await Pedometer.requestPermissions()
      console.log('[Pedometer] 권한 요청 결과:', status)
      return status.activityRecognition === 'granted'
    } catch (error) {
      console.error('[Pedometer] 권한 요청 실패:', error)
      return false
    }
  }

  /**
   * 걸음수 측정 시작
   */
  async startTracking() {
    console.log('[Pedometer] startTracking() 호출됨')
    
    if (!this.isInitialized) {
      console.log('[Pedometer] 초기화되지 않음. 초기화 시작...')
      const initialized = await this.initialize()
      if (!initialized) {
        throw new Error('걸음수 측정을 초기화할 수 없습니다')
      }
    }

    if (this.isTracking) {
      console.warn('[Pedometer] 이미 추적 중입니다')
      return
    }

    try {
      // 권한 확인 및 요청
      const hasPermission = await this.checkPermissions()
      if (!hasPermission) {
        console.log('[Pedometer] 권한 없음. 권한 요청 중...')
        const granted = await this.requestPermissions()
        if (!granted) {
          throw new Error('걸음수 측정 권한이 필요합니다')
        }
      }

      // 이벤트 리스너 등록
      this.listener = await Pedometer.addListener('measurement', (event) => {
        console.log('[Pedometer] [리스너] 걸음수 업데이트:', event)
        this.stepCount = event.numberOfSteps || 0
        this.distance = event.distance || 0
        
        if (this.onStepUpdateCallback) {
          this.onStepUpdateCallback(this.stepCount, this.distance)
        }
      })

      // 측정 시작
      await Pedometer.startMeasurementUpdates()
      console.log('[Pedometer] 측정 업데이트 시작')
      
      // 초기값 가져오기
      try {
        const measurement = await Pedometer.getMeasurement()
        this.stepCount = measurement.numberOfSteps || 0
        this.distance = measurement.distance || 0
        console.log('[Pedometer] 초기 걸음수:', this.stepCount, ', 거리:', this.distance)
      } catch (error) {
        console.warn('[Pedometer] 초기 측정값 가져오기 실패 (Android에서는 정상):', error)
        // Android에서는 getMeasurement()가 시간 범위를 요구하므로 초기값은 0으로 설정
        this.stepCount = 0
        this.distance = 0
      }
      
      this.startTime = Date.now()
      this.isTracking = true
      console.log('[Pedometer] 추적 상태 설정 완료. startTime:', this.startTime)
    } catch (error) {
      console.error('[Pedometer] 추적 시작 실패:', error)
      console.error('[Pedometer] 에러 메시지:', error.message)
      console.error('[Pedometer] 에러 스택:', error.stack)
      throw error
    }
  }

  /**
   * 현재 걸음수 가져오기
   */
  async getCurrentStepCount() {
    try {
      if (!this.isTracking) {
        return this.stepCount
      }

      // 실시간 업데이트는 리스너를 통해 받으므로 현재 저장된 값 반환
      return this.stepCount
    } catch (error) {
      console.error('[Pedometer] [getCurrentStepCount] 걸음수 가져오기 실패:', error)
      return this.stepCount
    }
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

    try {
      // 이벤트 리스너 제거
      if (this.listener) {
        await this.listener.remove()
        this.listener = null
      }

      // 측정 중지
      await Pedometer.stopMeasurementUpdates()
      console.log('[Pedometer] 측정 업데이트 중지')
    } catch (error) {
      console.error('[Pedometer] 추적 중지 실패:', error)
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
