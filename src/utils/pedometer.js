/**
 * 안드로이드 걸음수 측정 유틸리티
 * Capacitor Health 플러그인 또는 Activity Recognition 사용
 */

/**
 * 걸음수 측정 클래스
 */
export class Pedometer {
  constructor() {
    this.isInitialized = false
    this.initialStepCount = 0
    this.startTime = null
    this.isTracking = false
    this.nativePlugin = null
    this.listener = null
  }

  /**
   * 초기화
   */
  async initialize() {
    if (this.isInitialized) return

    try {
      // Capacitor 플랫폼 확인
      const { Capacitor } = await import('@capacitor/core')
      
      if (!Capacitor.isNativePlatform()) {
        console.warn('[Pedometer] 웹 환경에서는 걸음수 측정을 사용할 수 없습니다')
        return false
      }

      // 안드로이드 네이티브 Step Counter 직접 사용
      return await this.initializeNativeAndroid()
    } catch (error) {
      console.error('[Pedometer] 초기화 실패:', error)
      return false
    }
  }

  /**
   * 안드로이드 네이티브 Step Counter 센서 사용
   */
  async initializeNativeAndroid() {
    try {
      const { Capacitor } = await import('@capacitor/core')
      
      if (Capacitor.getPlatform() !== 'android') {
        console.warn('[Pedometer] 안드로이드 플랫폼이 아닙니다')
        return false
      }

      // Capacitor 플러그인 등록 및 사용
      const { registerPlugin } = await import('@capacitor/core')
      
      try {
        // StepCounter 플러그인 등록
        const StepCounter = registerPlugin('StepCounter', {
          web: () => import('./pedometer.web').then(m => new m.StepCounterWeb()),
        })
        
        this.nativePlugin = StepCounter
        this.isInitialized = true
        console.log('[Pedometer] StepCounter 플러그인 등록 완료')
        return true
      } catch (error) {
        console.warn('[Pedometer] 플러그인 등록 실패, 네이티브 브릿지 사용:', error)
        this.isInitialized = true
        return true
      }
    } catch (error) {
      console.error('[Pedometer] 안드로이드 네이티브 초기화 실패:', error)
      return false
    }
  }

  /**
   * 걸음수 측정 시작
   */
  async startTracking() {
    if (!this.isInitialized) {
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
      // 네이티브 안드로이드 Step Counter 사용
      await this.startNativeTracking()
    } catch (error) {
      console.error('[Pedometer] 추적 시작 실패:', error)
      throw error
    }
  }

  /**
   * 네이티브 안드로이드 추적 시작
   */
  async startNativeTracking() {
    try {
      const { Capacitor } = await import('@capacitor/core')
      
      if (Capacitor.getPlatform() !== 'android') {
        throw new Error('안드로이드 플랫폼만 지원됩니다')
      }

      // Step Counter 플러그인 사용 시도
      if (this.nativePlugin) {
        try {
          const result = await this.nativePlugin.getSteps()
          this.initialStepCount = result?.steps || 0
          console.log('[Pedometer] 초기 걸음수:', this.initialStepCount)
        } catch (error) {
          console.warn('[Pedometer] 플러그인에서 초기 걸음수 가져오기 실패:', error)
          this.initialStepCount = 0
        }
      } else {
        // 플러그인이 없으면 0으로 시작
        console.warn('[Pedometer] 플러그인이 없어 0으로 시작')
        this.initialStepCount = 0
      }
      
      this.startTime = Date.now()
      this.isTracking = true
      
      // 실시간 업데이트 (1초마다)
      this.listener = setInterval(async () => {
        try {
          const current = await this.getCurrentStepCount()
          const steps = Math.max(0, current - this.initialStepCount)
          if (this.onStepUpdate) {
            this.onStepUpdate(steps)
          }
        } catch (error) {
          console.error('[Pedometer] 걸음수 업데이트 실패:', error)
        }
      }, 1000)
      
      console.log('[Pedometer] 네이티브 추적 시작, 초기 걸음수:', this.initialStepCount)
    } catch (error) {
      console.error('[Pedometer] 네이티브 추적 시작 실패:', error)
      throw error
    }
  }

  /**
   * 현재 걸음수 가져오기
   */
  async getCurrentStepCount() {
    try {
      const { Capacitor } = await import('@capacitor/core')
      
      if (Capacitor.getPlatform() !== 'android') {
        return 0
      }

      // Step Counter 플러그인 사용
      if (this.nativePlugin) {
        try {
          const result = await this.nativePlugin.getSteps()
          return result?.steps || 0
        } catch (error) {
          console.error('[Pedometer] 플러그인에서 걸음수 가져오기 실패:', error)
          return 0
        }
      }
      
      // 플러그인이 없으면 0 반환
      return 0
    } catch (error) {
      console.error('[Pedometer] 걸음수 가져오기 실패:', error)
      return 0
    }
  }

  /**
   * 현재 측정된 걸음수 (시작 이후)
   */
  async getSteps() {
    if (!this.isTracking) {
      return 0
    }

    try {
      const current = await this.getCurrentStepCount()
      return Math.max(0, current - this.initialStepCount)
    } catch (error) {
      console.error('[Pedometer] 걸음수 계산 실패:', error)
      return 0
    }
  }

  /**
   * 추적 중지
   */
  stopTracking() {
    if (!this.isTracking) return

    if (this.listener) {
      clearInterval(this.listener)
      this.listener = null
    }

    this.isTracking = false
    console.log('[Pedometer] 추적 중지')
  }

  /**
   * 걸음수 업데이트 콜백 설정
   */
  onStepUpdate(callback) {
    this.onStepUpdate = callback
  }
}

// 싱글톤 인스턴스
let pedometerInstance = null

/**
 * 걸음수 측정 인스턴스 가져오기
 */
export function getPedometer() {
  if (!pedometerInstance) {
    pedometerInstance = new Pedometer()
  }
  return pedometerInstance
}

