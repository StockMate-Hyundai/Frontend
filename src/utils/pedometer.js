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
      const platform = Capacitor.getPlatform()
      const isNative = Capacitor.isNativePlatform()
      
      console.log('[Pedometer] Capacitor 플랫폼:', platform)
      console.log('[Pedometer] 네이티브 플랫폼 여부:', isNative)
      console.log('[Pedometer] UserAgent:', navigator.userAgent)
      
      // 안드로이드 또는 iOS인 경우에만 초기화 시도
      if (platform === 'android' || platform === 'ios') {
        console.log('[Pedometer] 네이티브 플랫폼 감지됨:', platform)
        // 안드로이드 네이티브 Step Counter 직접 사용
        const result = await this.initializeNativeAndroid()
        console.log('[Pedometer] initializeNativeAndroid() 결과:', result)
        return result
      } else if (!isNative && platform === 'web') {
        console.warn('[Pedometer] 웹 환경에서는 걸음수 측정을 사용할 수 없습니다')
        console.warn('[Pedometer] 플랫폼:', platform, ', 네이티브:', isNative)
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
        
        // Capacitor 플러그인 등록 방식 시도
        let StepCounter
        const { Capacitor } = await import('@capacitor/core')
        
        // 네이티브 플랫폼에서는 Capacitor가 자동으로 등록한 플러그인 사용
        if (platform === 'android' || platform === 'ios') {
          // 방법 1: Capacitor.Plugins에서 직접 가져오기 (가장 확실한 방법)
          console.log('[Pedometer] [플러그인 등록] Capacitor.Plugins 확인 시작')
          console.log('[Pedometer] [플러그인 등록] Capacitor 객체:', Capacitor)
          console.log('[Pedometer] [플러그인 등록] Capacitor.Plugins:', Capacitor.Plugins)
          
          if (Capacitor.Plugins) {
            const pluginKeys = Object.keys(Capacitor.Plugins)
            console.log('[Pedometer] [플러그인 등록] Capacitor.Plugins 키 목록:', pluginKeys)
            console.log('[Pedometer] [플러그인 등록] 등록된 플러그인 개수:', pluginKeys.length)
            
            if (Capacitor.Plugins.StepCounter) {
              console.log('[Pedometer] [플러그인 등록] ✓ Capacitor.Plugins.StepCounter 발견!')
              StepCounter = Capacitor.Plugins.StepCounter
              console.log('[Pedometer] [플러그인 등록] ✓ Capacitor.Plugins.StepCounter 사용 성공')
            } else {
              console.log('[Pedometer] [플러그인 등록] ✗ Capacitor.Plugins.StepCounter 없음')
            }
          } else {
            console.log('[Pedometer] [플러그인 등록] ✗ Capacitor.Plugins가 null/undefined')
          }
          
          // Capacitor.Plugins에 없으면 registerPlugin 시도
          if (!StepCounter) {
            console.log('[Pedometer] [플러그인 등록] registerPlugin() 시도...')
            console.log('[Pedometer] [플러그인 등록] 주의: 네이티브 플랫폼에서는 웹 구현 없이 호출')
            
            try {
              // 네이티브 플랫폼에서는 웹 구현 없이 registerPlugin 호출
              // 그러면 Capacitor가 자동으로 Java 플러그인을 찾아야 합니다
              StepCounter = registerPlugin('StepCounter')
              console.log('[Pedometer] [플러그인 등록] registerPlugin() 호출 성공')
              console.log('[Pedometer] [플러그인 등록] StepCounter 객체:', StepCounter)
            } catch (regError) {
              console.error('[Pedometer] [플러그인 등록] registerPlugin() 실패:', regError)
              throw regError
            }
          }
        } else {
          // 웹 플랫폼에서는 웹 구현만 사용
          console.log('[Pedometer] [플러그인 등록] 웹 플랫폼: registerPlugin 사용 (웹 구현 포함)')
          StepCounter = registerPlugin('StepCounter', {
            web: () => import('./pedometer.web').then(m => new m.StepCounterWeb()),
          })
        }
        
        console.log('[Pedometer] StepCounter 플러그인 객체:', StepCounter)
        console.log('[Pedometer] StepCounter 타입:', typeof StepCounter)
        
        // 플러그인이 실제로 등록되었는지 확인
        if (!StepCounter) {
          console.error('[Pedometer] 플러그인 객체가 null입니다')
          throw new Error('플러그인 객체가 null입니다')
        }
        
        // 플러그인 메서드 확인
        const methods = Object.getOwnPropertyNames(StepCounter).concat(
          Object.getOwnPropertyNames(Object.getPrototypeOf(StepCounter || {}))
        )
        console.log('[Pedometer] StepCounter 플러그인 속성:', methods)
        
        // getSteps 메서드 확인 (다양한 방법 시도)
        const hasGetSteps = typeof StepCounter.getSteps === 'function' || 
                           (StepCounter.getSteps && typeof StepCounter.getSteps === 'object')
        
        console.log('[Pedometer] getSteps 메서드 존재:', hasGetSteps)
        console.log('[Pedometer] getSteps 타입:', typeof StepCounter.getSteps)
        
        if (!hasGetSteps) {
          console.error('[Pedometer] getSteps 메서드를 찾을 수 없습니다')
          console.error('[Pedometer] 사용 가능한 메서드:', methods.filter(m => typeof StepCounter[m] === 'function'))
          throw new Error('getSteps 메서드를 찾을 수 없습니다. 플러그인이 제대로 등록되지 않았습니다.')
        }
        
        this.nativePlugin = StepCounter
        this.isInitialized = true
        console.log('[Pedometer] StepCounter 플러그인 등록 완료, 초기화 상태:', this.isInitialized)
        return true
      } catch (error) {
        console.error('[Pedometer] 플러그인 등록 실패:', error)
        console.error('[Pedometer] 에러 메시지:', error.message)
        console.error('[Pedometer] 에러 스택:', error.stack)
        // 플러그인 등록 실패
        this.isInitialized = false
        return false
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
      console.log('[Pedometer] nativePlugin 타입:', typeof this.nativePlugin)
      
      // Step Counter 플러그인 사용 시도
      if (!this.nativePlugin) {
        const error = new Error('Step Counter 플러그인을 사용할 수 없습니다. 플러그인이 초기화되지 않았습니다.')
        console.error('[Pedometer]', error.message)
        throw error
      }
      
      // 플러그인 메서드 확인
      const hasStartTracking = typeof this.nativePlugin.startTracking === 'function'
      const hasGetSteps = typeof this.nativePlugin.getSteps === 'function'
      
      console.log('[Pedometer] startTracking 메서드 존재:', hasStartTracking)
      console.log('[Pedometer] getSteps 메서드 존재:', hasGetSteps)
      
      if (!hasStartTracking && !hasGetSteps) {
        const error = new Error('플러그인 메서드를 찾을 수 없습니다. startTracking 또는 getSteps 메서드가 필요합니다.')
        console.error('[Pedometer]', error.message)
        console.error('[Pedometer] 플러그인 객체:', this.nativePlugin)
        throw error
      }
      
      try {
        console.log('[Pedometer] startTracking() 호출 중...')
        
        // startTracking 메서드가 있으면 사용, 없으면 getSteps 사용
        let result
        if (hasStartTracking) {
          console.log('[Pedometer] startTracking() 메서드 호출')
          result = await this.nativePlugin.startTracking()
        } else {
          console.log('[Pedometer] startTracking() 없음, getSteps() 사용')
          // getSteps로 시작 (센서 리스너 등록)
          result = await this.nativePlugin.getSteps()
          // getSteps는 steps를 반환하므로 initialSteps로 설정
          if (result && result.steps !== undefined) {
            result = { initialSteps: result.steps, status: 'tracking_started' }
          }
        }
        
        console.log('[Pedometer] startTracking() 결과:', result)
        console.log('[Pedometer] 결과 타입:', typeof result)
        console.log('[Pedometer] 결과 키:', result ? Object.keys(result) : 'null')
        
        this.initialStepCount = result?.initialSteps || 0
        console.log('[Pedometer] 초기 걸음수 설정:', this.initialStepCount)
        console.log('[Pedometer] 추적 상태:', result?.status || 'unknown')
      } catch (error) {
        console.error('[Pedometer] 플러그인에서 추적 시작 실패:', error)
        console.error('[Pedometer] 에러 메시지:', error.message)
        console.error('[Pedometer] 에러 스택:', error.stack)
        console.error('[Pedometer] 에러 객체:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
        this.initialStepCount = 0
        throw error // 에러를 다시 throw하여 상위에서 처리
      }
      
      this.startTime = Date.now()
      this.isTracking = true
      console.log('[Pedometer] 추적 상태 설정 완료. startTime:', this.startTime)
      
      // 실시간 업데이트 (1초마다)
      // 주의: Step Counter 센서는 onSensorChanged로 자동 업데이트되므로,
      // 인터벌은 백업용으로만 사용 (센서가 작동하지 않을 때를 대비)
      console.log('[Pedometer] 업데이트 인터벌 설정 시작 (1초마다, 백업용)')
      this.listener = setInterval(async () => {
        try {
          const current = await this.getCurrentStepCount()
          const steps = Math.max(0, current - this.initialStepCount)
          console.log('[Pedometer] [인터벌] 현재 총 걸음수:', current, ', 초기:', this.initialStepCount, ', 차이:', steps)
          
          // 초기값이 아직 설정되지 않았으면 (센서가 아직 값을 반환하지 않음)
          if (this.initialStepCount === 0 && current > 0) {
            this.initialStepCount = current
            console.log('[Pedometer] [인터벌] 초기 걸음수 설정 (백업):', this.initialStepCount)
          }
          
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
    pedometerInstance = new Pedometer()
  }
  return pedometerInstance
}

