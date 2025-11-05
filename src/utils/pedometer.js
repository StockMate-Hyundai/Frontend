/**
 * 안드로이드 걸음수 측정 유틸리티
 * 커스텀 Pedometer 플러그인 사용 (TYPE_STEP_DETECTOR 기반)
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
    this.nativePlugin = null
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
      // Capacitor 플랫폼 확인
      const { Capacitor } = await import('@capacitor/core')
      const { registerPlugin } = await import('@capacitor/core')
      const platform = Capacitor.getPlatform()
      const isNative = Capacitor.isNativePlatform()
      
      console.log('[Pedometer] Capacitor 플랫폼:', platform)
      console.log('[Pedometer] 네이티브 플랫폼 여부:', isNative)
      
      // 안드로이드 또는 iOS인 경우에만 초기화 시도
      if (platform === 'android' || platform === 'ios') {
        console.log('[Pedometer] 네이티브 플랫폼 감지됨:', platform)
        // Pedometer 플러그인 등록
        const result = await this.initializeNative(registerPlugin, Capacitor)
        console.log('[Pedometer] initializeNative() 결과:', result)
        return result
      } else if (!isNative && platform === 'web') {
        console.warn('[Pedometer] 웹 환경에서는 걸음수 측정을 사용할 수 없습니다')
        return false
      } else {
        console.warn('[Pedometer] 알 수 없는 플랫폼:', platform)
        return false
      }
    } catch (error) {
      console.error('[Pedometer] 초기화 실패:', error)
      console.error('[Pedometer] 에러 메시지:', error.message)
      console.error('[Pedometer] 에러 스택:', error.stack)
      return false
    }
  }

  /**
   * 네이티브 Pedometer 플러그인 초기화
   */
  async initializeNative(registerPlugin, Capacitor) {
    console.log('[Pedometer] initializeNative() 시작')
    try {
      const platform = Capacitor.getPlatform()
      
      console.log('[Pedometer] 현재 플랫폼:', platform)
      
      if (platform !== 'android') {
        console.warn('[Pedometer] 안드로이드 플랫폼이 아닙니다. 현재:', platform)
        return false
      }

      try {
        // Pedometer 플러그인 등록
        console.log('[Pedometer] Pedometer 플러그인 등록 시도...')
        
        let Pedometer
        if (platform === 'android' || platform === 'ios') {
          // 먼저 Capacitor.Plugins에서 찾기
          if (Capacitor.Plugins && Capacitor.Plugins.Pedometer) {
            console.log('[Pedometer] ✓ Capacitor.Plugins.Pedometer 발견!')
            Pedometer = Capacitor.Plugins.Pedometer
          } else {
            // registerPlugin로 등록
            console.log('[Pedometer] registerPlugin() 시도...')
            Pedometer = registerPlugin('Pedometer')
          }
        } else {
          // 웹 플랫폼에서는 웹 구현 사용
          Pedometer = registerPlugin('Pedometer', {
            web: () => import('./pedometer.web').then(m => new m.PedometerWeb()),
          })
        }
        
        console.log('[Pedometer] Pedometer 플러그인 객체:', Pedometer)
        
        // 플러그인이 실제로 등록되었는지 확인
        if (!Pedometer) {
          console.error('[Pedometer] 플러그인 객체가 null입니다')
          throw new Error('플러그인 객체가 null입니다')
        }
        
        // 플러그인 메서드 확인
        const hasStartTracking = typeof Pedometer.startTracking === 'function'
        const hasGetStepCount = typeof Pedometer.getStepCount === 'function'
        
        console.log('[Pedometer] startTracking 메서드 존재:', hasStartTracking)
        console.log('[Pedometer] getStepCount 메서드 존재:', hasGetStepCount)
        
        if (!hasStartTracking || !hasGetStepCount) {
          console.error('[Pedometer] 필수 메서드를 찾을 수 없습니다')
          throw new Error('필수 메서드를 찾을 수 없습니다. 플러그인이 제대로 등록되지 않았습니다.')
        }
        
        // 이벤트 리스너 등록
        Pedometer.addListener('stepUpdate', (data) => {
          console.log('[Pedometer] [리스너] 걸음수 업데이트:', data)
          this.stepCount = data.stepCount || 0
          this.distance = data.distance || 0
          
          if (this.onStepUpdateCallback) {
            this.onStepUpdateCallback(this.stepCount, this.distance)
          }
        })
        
        this.nativePlugin = Pedometer
        this.isInitialized = true
        console.log('[Pedometer] Pedometer 플러그인 등록 완료, 초기화 상태:', this.isInitialized)
        return true
      } catch (error) {
        console.error('[Pedometer] 플러그인 등록 실패:', error)
        console.error('[Pedometer] 에러 메시지:', error.message)
        console.error('[Pedometer] 에러 스택:', error.stack)
        this.isInitialized = false
        return false
      }
    } catch (error) {
      console.error('[Pedometer] 네이티브 초기화 실패:', error)
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
      if (!this.nativePlugin) {
        throw new Error('Pedometer 플러그인을 사용할 수 없습니다. 플러그인이 초기화되지 않았습니다.')
      }
      
      console.log('[Pedometer] startTracking() 호출 중...')
      const result = await this.nativePlugin.startTracking()
      
      console.log('[Pedometer] startTracking() 결과:', result)
      
      this.stepCount = result?.stepCount || 0
      this.distance = result?.distance || 0
      this.startTime = Date.now()
      this.isTracking = true
      
      console.log('[Pedometer] 추적 상태 설정 완료. startTime:', this.startTime)
      console.log('[Pedometer] 초기 걸음수:', this.stepCount, ', 거리:', this.distance)
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
      const { Capacitor } = await import('@capacitor/core')
      const platform = Capacitor.getPlatform()
      
      if (platform !== 'android') {
        console.log('[Pedometer] [getCurrentStepCount] 안드로이드 플랫폼이 아님:', platform)
        return this.stepCount
      }

      // Pedometer 플러그인 사용
      if (this.nativePlugin) {
        try {
          const result = await this.nativePlugin.getStepCount()
          this.stepCount = result?.stepCount || 0
          this.distance = result?.distance || 0
          console.log('[Pedometer] [getCurrentStepCount] 걸음수 가져오기 성공:', this.stepCount, ', 거리:', this.distance)
          return this.stepCount
        } catch (error) {
          console.error('[Pedometer] [getCurrentStepCount] 플러그인에서 걸음수 가져오기 실패:', error)
          console.error('[Pedometer] [getCurrentStepCount] 에러 메시지:', error.message)
          return this.stepCount
        }
      }
      
      // 플러그인이 없으면 현재 저장된 값 반환
      console.warn('[Pedometer] [getCurrentStepCount] 플러그인이 없음, 저장된 값 반환')
      return this.stepCount
    } catch (error) {
      console.error('[Pedometer] [getCurrentStepCount] 걸음수 가져오기 실패:', error)
      console.error('[Pedometer] [getCurrentStepCount] 에러 메시지:', error.message)
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

    // 이벤트 리스너로 업데이트된 값을 반환
    return this.stepCount
  }

  /**
   * 추적 중지
   */
  async stopTracking() {
    if (!this.isTracking) return

    if (this.nativePlugin) {
      try {
        await this.nativePlugin.stopTracking()
        console.log('[Pedometer] 네이티브 추적 중지 완료')
      } catch (error) {
        console.error('[Pedometer] 네이티브 추적 중지 실패:', error)
      }
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
