/**
 * 플랫폼 감지 유틸리티
 * Capacitor 앱 환경인지 웹 환경인지 감지
 */

/**
 * Capacitor 네이티브 플랫폼인지 확인
 * @returns {boolean}
 */
export function isNativePlatform() {
  try {
    // 동적 import로 Capacitor 사용 (번들 크기 최적화)
    const Capacitor = require('@capacitor/core')
    return Capacitor?.Capacitor?.isNativePlatform() ?? false
  } catch {
    return false
  }
}

/**
 * 웹 환경인지 확인
 * @returns {boolean}
 */
export function isWebPlatform() {
  return !isNativePlatform()
}

/**
 * 앱 빌드 모드인지 확인 (환경 변수 기준)
 * Vite에서 BUILD_TARGET=app으로 설정된 경우 true
 * @returns {boolean}
 */
export function isAppBuild() {
  return import.meta.env.VITE_BUILD_TARGET === 'app' || 
         process.env.VITE_BUILD_TARGET === 'app' ||
         import.meta.env.MODE === 'app'
}


