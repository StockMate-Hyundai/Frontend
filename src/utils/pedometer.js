/**
 * 안드로이드 걸음수 측정 유틸리티
 * Android 네이티브 센서 사용 (실제 걸음수 감지)
 * 웹 환경에서는 시뮬레이션 모드로 동작
 */

/**
 * 플랫폼 감지
 */
function isNativeAndroid() {
  try {
    // Android WebView에서 PedometerBridge가 있는지 확인
    const isNative = typeof window !== 'undefined' && 
                     window.PedometerBridge && 
                     typeof window.PedometerBridge.startTracking === 'function'
    
    return isNative
  } catch (error) {
    return false
  }
}

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
    this.isNative = isNativeAndroid()
  }

  /**
   * 초기화
   */
  async initialize() {
    if (this.isInitialized) {
      return true
    }

    // 네이티브 Android 환경인지 확인
    if (this.isNative) {
      // JavaScript 콜백 설정
      window.pedometerCallback = (stepCount, distance) => {
        this.stepCount = stepCount
        this.distance = distance
        
        if (this.onStepUpdateCallback) {
          this.onStepUpdateCallback(stepCount, distance)
        }
      }
    }

    this.isInitialized = true
    return true
  }

  /**
   * 걸음수 측정 시작
   * 네이티브 환경: 실제 Android 센서 사용
   * 웹 환경: 시뮬레이션 모드 (1초에 1걸음씩 증가)
   */
  async startTracking() {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (this.isTracking) {
      return
    }

    // 초기값 설정
    this.stepCount = 0
    this.distance = 0
    this.startTime = Date.now()
    this.isTracking = true
    
    // 네이티브 환경을 다시 확인 (WebView가 늦게 초기화될 수 있음)
    const isNativeNow = isNativeAndroid()
    this.isNative = isNativeNow
    
    if (this.isNative && window.PedometerBridge) {
      // Android 네이티브 센서 사용
      try {
        // 콜백이 설정되어 있는지 확인 (이미 initialize에서 설정했을 수 있음)
        if (!window.pedometerCallback) {
          window.pedometerCallback = (stepCount, distance) => {
            this.stepCount = stepCount
            this.distance = distance
            
            if (this.onStepUpdateCallback) {
              this.onStepUpdateCallback(stepCount, distance)
            }
          }
        }
        
        window.PedometerBridge.startTracking()
        
        // 초기값 콜백 호출
        if (this.onStepUpdateCallback) {
          this.onStepUpdateCallback(0, 0)
        }
      } catch (error) {
        // 실패 시 시뮬레이션 모드로 전환
        this.isNative = false
        this.startTrackingSimulation()
      }
    } else {
      // 웹 환경: 시뮬레이션 모드
      this.startTrackingSimulation()
    }
  }

  /**
   * 시뮬레이션 모드로 추적 시작
   */
  startTrackingSimulation() {
    // 초기값 콜백 호출
    if (this.onStepUpdateCallback) {
      this.onStepUpdateCallback(this.stepCount, this.distance)
    }
    
    // 1초마다 걸음수 증가
    this.interval = setInterval(() => {
      this.stepCount++
      this.distance = this.stepCount * 0.7 // 70cm per step
      
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

    if (this.isNative && window.PedometerBridge) {
      // Android 네이티브 센서 중지
      try {
        window.PedometerBridge.stopTracking()
      } catch (error) {
        // 에러 처리
      }
    }

    // 인터벌 중지 (시뮬레이션 모드)
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }

    this.isTracking = false
  }

  /**
   * 초기화
   */
  async resetTracking() {
    if (this.isNative && window.PedometerBridge) {
      try {
        window.PedometerBridge.resetTracking()
      } catch (error) {
        // 에러 처리
      }
    }

    this.stepCount = 0
    this.distance = 0
    this.startTime = null
  }

  /**
   * 걸음수 업데이트 콜백 설정
   */
  onStepUpdate(callback) {
    this.onStepUpdateCallback = callback
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
