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
    console.log('[Pedometer] initialize() 호출됨')
    if (this.isInitialized) {
      console.log('[Pedometer] 이미 초기화되어 있음')
      return true
    }

    try {
      // Capacitor 플랫폼 확인
      const { Capacitor } = await import('@capacitor/core')
      console.log('[Pedometer] Capacitor 플랫폼:', Capacitor.getPlatform())
      console.log('[Pedometer] 네이티브 플랫폼 여부:', Capacitor.isNativePlatform())
      
      if (!Capacitor.isNativePlatform()) {
        console.warn('[Pedometer] 웹 환경에서는 걸음수 측정을 사용할 수 없습니다')
        return false
      }

      // 안드로이드 네이티브 Step Counter 직접 사용
      const result = await this.initializeNativeAndroid()
      console.log('[Pedometer] initializeNativeAndroid() 결과:', result)
      return result
    } catch (error) {
      console.error('[Pedometer] 초기화 실패:', error)
      console.error('[Pedometer] 에러 스택:', error.stack)
      return false
    }
  }

  /**
   * 안드로이드 네이티브 Step Counter 센서 사용
   */
  async initializeNativeAndroid() {
    console.log('[Pedometer] initializeNativeAndroid() 시작')
    try {
      const { Capacitor } = await import('@capacitor/core')
      const platform = Capacitor.getPlatform()
      console.log('[Pedometer] 현재 플랫폼:', platform)
      
      if (platform !== 'android') {
        console.warn('[Pedometer] 안드로이드 플랫폼이 아닙니다. 현재:', platform)
        return false
      }

      // Capacitor 플러그인 등록 및 사용
      const { registerPlugin } = await import('@capacitor/core')
      console.log('[Pedometer] registerPlugin 가져오기 완료')
      
      try {
        // StepCounter 플러그인 등록
        console.log('[Pedometer] StepCounter 플러그인 등록 시도...')
        const StepCounter = registerPlugin('StepCounter', {
          web: () => import('./pedometer.web').then(m => new m.StepCounterWeb()),
        })
        
        console.log('[Pedometer] StepCounter 플러그인 객체:', StepCounter)
        this.nativePlugin = StepCounter
        this.isInitialized = true
        console.log('[Pedometer] StepCounter 플러그인 등록 완료, 초기화 상태:', this.isInitialized)
        return true
      } catch (error) {
        console.error('[Pedometer] 플러그인 등록 실패:', error)
        console.error('[Pedometer] 에러 메시지:', error.message)
        console.error('[Pedometer] 에러 스택:', error.stack)
        this.isInitialized = true
        return true
      }
    } catch (error) {
      console.error('[Pedometer] 안드로이드 네이티브 초기화 실패:', error)
      console.error('[Pedometer] 에러 메시지:', error.message)
      console.error('[Pedometer] 에러 스택:', error.stack)
      return false
    }
  }

  /**
   * 걸음수 측정 시작
   */
  async startTracking() {
    console.log('[Pedometer] startTracking() 호출됨')
    console.log('[Pedometer] 초기화 상태:', this.isInitialized)
    console.log('[Pedometer] 추적 상태:', this.isTracking)
    
    if (!this.isInitialized) {
      console.log('[Pedometer] 초기화되지 않음. 초기화 시작...')
      const initialized = await this.initialize()
      console.log('[Pedometer] 초기화 결과:', initialized)
      if (!initialized) {
        const error = new Error('걸음수 측정을 초기화할 수 없습니다')
        console.error('[Pedometer] 초기화 실패 에러:', error)
        throw error
      }
    }

    if (this.isTracking) {
      console.warn('[Pedometer] 이미 추적 중입니다')
      return
    }

    try {
      console.log('[Pedometer] startNativeTracking() 호출...')
      // 네이티브 안드로이드 Step Counter 사용
      await this.startNativeTracking()
      console.log('[Pedometer] startNativeTracking() 완료')
    } catch (error) {
      console.error('[Pedometer] 추적 시작 실패:', error)
      console.error('[Pedometer] 에러 메시지:', error.message)
      console.error('[Pedometer] 에러 스택:', error.stack)
      throw error
    }
  }

  /**
   * 네이티브 안드로이드 추적 시작
   */
  async startNativeTracking() {
    console.log('[Pedometer] startNativeTracking() 시작')
    try {
      const { Capacitor } = await import('@capacitor/core')
      const platform = Capacitor.getPlatform()
      console.log('[Pedometer] 플랫폼:', platform)
      
      if (platform !== 'android') {
        const error = new Error('안드로이드 플랫폼만 지원됩니다. 현재: ' + platform)
        console.error('[Pedometer]', error.message)
        throw error
      }

      console.log('[Pedometer] nativePlugin 존재 여부:', !!this.nativePlugin)
      // Step Counter 플러그인 사용 시도
      if (this.nativePlugin) {
        try {
          console.log('[Pedometer] getSteps() 호출 중...')
          const result = await this.nativePlugin.getSteps()
          console.log('[Pedometer] getSteps() 결과:', result)
          this.initialStepCount = result?.steps || 0
          console.log('[Pedometer] 초기 걸음수 설정:', this.initialStepCount)
        } catch (error) {
          console.error('[Pedometer] 플러그인에서 초기 걸음수 가져오기 실패:', error)
          console.error('[Pedometer] 에러 메시지:', error.message)
          console.error('[Pedometer] 에러 스택:', error.stack)
          this.initialStepCount = 0
        }
      } else {
        // 플러그인이 없으면 0으로 시작
        console.warn('[Pedometer] 플러그인이 없어 0으로 시작')
        this.initialStepCount = 0
      }
      
      this.startTime = Date.now()
      this.isTracking = true
      console.log('[Pedometer] 추적 상태 설정 완료. startTime:', this.startTime)
      
      // 실시간 업데이트 (1초마다)
      console.log('[Pedometer] 업데이트 인터벌 설정 시작 (1초마다)')
      this.listener = setInterval(async () => {
        try {
          const current = await this.getCurrentStepCount()
          const steps = Math.max(0, current - this.initialStepCount)
          console.log('[Pedometer] [인터벌] 현재 총 걸음수:', current, ', 초기:', this.initialStepCount, ', 차이:', steps)
          if (this.onStepUpdate) {
            console.log('[Pedometer] [인터벌] onStepUpdate 콜백 호출, steps:', steps)
            this.onStepUpdate(steps)
          } else {
            console.warn('[Pedometer] [인터벌] onStepUpdate 콜백이 설정되지 않음')
          }
        } catch (error) {
          console.error('[Pedometer] [인터벌] 걸음수 업데이트 실패:', error)
          console.error('[Pedometer] [인터벌] 에러 메시지:', error.message)
        }
      }, 1000)
      console.log('[Pedometer] 업데이트 인터벌 설정 완료')
      
      console.log('[Pedometer] 네이티브 추적 시작 완료, 초기 걸음수:', this.initialStepCount)
    } catch (error) {
      console.error('[Pedometer] 네이티브 추적 시작 실패:', error)
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
      const { Capacitor } = await import('@capacitor/core')
      const platform = Capacitor.getPlatform()
      
      if (platform !== 'android') {
        console.log('[Pedometer] [getCurrentStepCount] 안드로이드 플랫폼이 아님:', platform)
        return 0
      }

      // Step Counter 플러그인 사용
      if (this.nativePlugin) {
        try {
          const result = await this.nativePlugin.getSteps()
          const steps = result?.steps || 0
          console.log('[Pedometer] [getCurrentStepCount] 걸음수 가져오기 성공:', steps)
          return steps
        } catch (error) {
          console.error('[Pedometer] [getCurrentStepCount] 플러그인에서 걸음수 가져오기 실패:', error)
          console.error('[Pedometer] [getCurrentStepCount] 에러 메시지:', error.message)
          return 0
        }
      }
      
      // 플러그인이 없으면 0 반환
      console.warn('[Pedometer] [getCurrentStepCount] 플러그인이 없음')
      return 0
    } catch (error) {
      console.error('[Pedometer] [getCurrentStepCount] 걸음수 가져오기 실패:', error)
      console.error('[Pedometer] [getCurrentStepCount] 에러 메시지:', error.message)
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

