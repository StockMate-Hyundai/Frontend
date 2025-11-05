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
    
    console.log('[Pedometer] 네이티브 환경 체크:', {
      windowExists: typeof window !== 'undefined',
      bridgeExists: !!window?.PedometerBridge,
      startTrackingExists: typeof window?.PedometerBridge?.startTracking === 'function',
      isNative
    })
    
    return isNative
  } catch (error) {
    console.error('[Pedometer] 네이티브 환경 체크 오류:', error)
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
    console.log('[Pedometer] initialize() 호출됨')
    if (this.isInitialized) {
      console.log('[Pedometer] 이미 초기화되어 있음')
      return true
    }

    // 네이티브 Android 환경인지 확인
    if (this.isNative) {
      console.log('[Pedometer] Android 네이티브 센서 모드 감지')
      
      // JavaScript 콜백 설정 (실제 센서 감지 시에만 로그 남김)
      window.pedometerCallback = (stepCount, distance) => {
        // 실제 센서 감지 시에만 로그 출력
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('📍 [Pedometer] 스텝 감지! 현재 걸음수:', stepCount, '걸음')
        console.log('📏 [Pedometer] 누적 이동 거리:', distance.toFixed(2), 'm')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        
        this.stepCount = stepCount
        this.distance = distance
        
        if (this.onStepUpdateCallback) {
          this.onStepUpdateCallback(stepCount, distance)
        }
      }
    } else {
      console.log('[Pedometer] 웹 환경 감지 - 시뮬레이션 모드 사용 (로그 없음)')
    }

    this.isInitialized = true
    console.log('[Pedometer] 초기화 완료', this.isNative ? '(네이티브 모드)' : '(시뮬레이션 모드)')
    return true
  }

  /**
   * 걸음수 측정 시작
   * 네이티브 환경: 실제 Android 센서 사용
   * 웹 환경: 시뮬레이션 모드 (1초에 1걸음씩 증가)
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

    // 초기값 설정
    this.stepCount = 0
    this.distance = 0
    this.startTime = Date.now()
    this.isTracking = true
    
    // 네이티브 환경을 다시 확인 (WebView가 늦게 초기화될 수 있음)
    const isNativeNow = isNativeAndroid()
    this.isNative = isNativeNow
    
    console.log('[Pedometer] 네이티브 모드:', this.isNative)
    console.log('[Pedometer] window.PedometerBridge:', window.PedometerBridge)
    
    if (this.isNative && window.PedometerBridge) {
      // Android 네이티브 센서 사용
      console.log('[Pedometer] Android 네이티브 센서로 추적 시작')
      try {
        // 콜백이 설정되어 있는지 확인 (이미 initialize에서 설정했을 수 있음)
        if (!window.pedometerCallback) {
          window.pedometerCallback = (stepCount, distance) => {
            // 실제 센서 감지 시에만 로그 출력
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            console.log('📍 [Pedometer] 스텝 감지! 현재 걸음수:', stepCount, '걸음')
            console.log('📏 [Pedometer] 누적 이동 거리:', distance.toFixed(2), 'm')
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            
            this.stepCount = stepCount
            this.distance = distance
            
            if (this.onStepUpdateCallback) {
              this.onStepUpdateCallback(stepCount, distance)
            }
          }
        }
        
        window.PedometerBridge.startTracking()
        console.log('[Pedometer] 네이티브 센서 시작 완료 - 실제 걸음수 감지 시작')
        
        // 초기값 콜백 호출
        if (this.onStepUpdateCallback) {
          this.onStepUpdateCallback(0, 0)
        }
      } catch (error) {
        console.error('[Pedometer] 네이티브 센서 시작 실패:', error)
        console.error('[Pedometer] 에러 상세:', error.message, error.stack)
        // 실패 시 시뮬레이션 모드로 전환
        this.isNative = false
        this.startTrackingSimulation()
      }
    } else {
      // 웹 환경: 시뮬레이션 모드
      console.warn('[Pedometer] 네이티브 환경이 아니므로 시뮬레이션 모드로 추적 시작')
      console.warn('[Pedometer] window.PedometerBridge 존재 여부:', !!window.PedometerBridge)
      this.startTrackingSimulation()
    }
  }

  /**
   * 시뮬레이션 모드로 추적 시작
   */
  startTrackingSimulation() {
    console.log('[Pedometer] 시뮬레이션 모드 시작 (1초에 1걸음씩 증가) - 로그 없음')
    
    // 초기값 콜백 호출
    if (this.onStepUpdateCallback) {
      this.onStepUpdateCallback(this.stepCount, this.distance)
    }
    
    // 1초마다 걸음수 증가 (로그 없이 조용히 증가)
    this.interval = setInterval(() => {
      this.stepCount++
      this.distance = this.stepCount * 0.7 // 70cm per step
      
      // 시뮬레이션 모드에서는 로그를 남기지 않음
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

    console.log('[Pedometer] stopTracking() 호출됨')

    if (this.isNative && window.PedometerBridge) {
      // Android 네이티브 센서 중지
      try {
        window.PedometerBridge.stopTracking()
        console.log('[Pedometer] 네이티브 센서 중지 완료')
      } catch (error) {
        console.error('[Pedometer] 네이티브 센서 중지 실패:', error)
      }
    }

    // 인터벌 중지 (시뮬레이션 모드)
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }

    this.isTracking = false
    console.log('[Pedometer] 추적 중지 완료')
  }

  /**
   * 초기화
   */
  async resetTracking() {
    console.log('[Pedometer] resetTracking() 호출됨')

    if (this.isNative && window.PedometerBridge) {
      try {
        window.PedometerBridge.resetTracking()
        console.log('[Pedometer] 네이티브 센서 초기화 완료')
      } catch (error) {
        console.error('[Pedometer] 네이티브 센서 초기화 실패:', error)
      }
    }

    this.stepCount = 0
    this.distance = 0
    this.startTime = null
    console.log('[Pedometer] 초기화 완료')
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
