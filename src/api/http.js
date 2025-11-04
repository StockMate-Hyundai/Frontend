import axios from 'axios'
import { getActivePinia } from 'pinia'

export const API_BASE_URL = 'https://api.stockmate.site'

// ── Token 저장소 (메모리 + localStorage)
let accessToken = localStorage.getItem('sm_accessToken')
let refreshToken = localStorage.getItem('sm_refreshToken')

// 사용자 프로필(이메일/역할)도 로컬에 같이 저장해서 새로고침 복원
let profileEmail = localStorage.getItem('sm_email')
let profileRole = localStorage.getItem('sm_role')

export function setTokens(at, rt) {
  accessToken = at ?? null
  refreshToken = rt ?? null
  if (accessToken) localStorage.setItem('sm_accessToken', accessToken)
  else localStorage.removeItem('sm_accessToken')
  if (refreshToken) localStorage.setItem('sm_refreshToken', refreshToken)
  else localStorage.removeItem('sm_refreshToken')
}

export function setProfile(email, role) {
  profileEmail = email ?? null
  profileRole = role ?? null
  if (profileEmail) localStorage.setItem('sm_email', profileEmail)
  else localStorage.removeItem('sm_email')
  if (profileRole) localStorage.setItem('sm_role', profileRole)
  else localStorage.removeItem('sm_role')
}

export function getTokens() {
  // 항상 최신 값을 반환하기 위해 localStorage에서 직접 읽기 (앱 환경 대응)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      accessToken = localStorage.getItem('sm_accessToken')
      refreshToken = localStorage.getItem('sm_refreshToken')
    }
  } catch (e) {
    console.warn('[getTokens] localStorage access error:', e)
  }
  return { accessToken, refreshToken }
}
export function getProfile() {
  // 항상 최신 값을 반환하기 위해 localStorage에서 직접 읽기 (앱 환경 대응)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      profileEmail = localStorage.getItem('sm_email')
      profileRole = localStorage.getItem('sm_role')
    }
  } catch (e) {
    console.warn('[getProfile] localStorage access error:', e)
  }
  return { email: profileEmail, role: profileRole }
}
// 리다이렉트 중복 방지 플래그
let isRedirecting = false

export function clearSession() {
  setTokens(null, null)
  setProfile(null, null)
}

// ── axios 인스턴스
export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 1500000,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

// 요청 인터셉터: Authorization 주입
http.interceptors.request.use(config => {
  if (accessToken) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  
  return config
})

// 응답 인터셉터: 401 → 로그인으로
http.interceptors.response.use(
  res => res,
  err => {
    const status = err?.response?.status
    const original = err?.config
    if (status === 401 && original && !original._smRetried) {
      original._smRetried = true
      clearSession()

      // 웹소켓 연결 해제
      try {
        const pinia = getActivePinia()
        const notificationsStore = pinia?._s?.get('notifications')
        if (notificationsStore) {
          notificationsStore.disconnectWebSocket()
        }
      } catch (e) {
        console.warn('[HttpInterceptor] Failed to disconnect WebSocket:', e)
      }

      // 이미 리다이렉트 중이거나 로그인 페이지에 있으면 리다이렉트하지 않음 (무한 루프 방지)
      if (isRedirecting) {
        return Promise.reject(err)
      }

      const currentPath = location.pathname
      if (currentPath === '/login' || currentPath.startsWith('/login/')) {
        // 이미 로그인 페이지에 있으므로 리다이렉트하지 않고 에러만 반환
        return Promise.reject(err)
      }

      // 리다이렉트 플래그 설정
      isRedirecting = true

      const redirectTo = encodeURIComponent(location.pathname + location.search)

      // 이유를 reason 쿼리로 넘겨서 토스트 등 처리
      location.replace(`/login?redirect=${redirectTo}&reason=unauthorized`)

      // 플래그는 3초 후 자동으로 리셋 (안전장치)
      setTimeout(() => {
        isRedirecting = false
      }, 3000)

      // 여기서 흐름 종료
    }
    
    return Promise.reject(err)
  },
)
