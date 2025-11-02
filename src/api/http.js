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
  return { accessToken, refreshToken }
}
export function getProfile() {
  return { email: profileEmail, role: profileRole }
}
export function clearSession() {
  setTokens(null, null)
  setProfile(null, null)
}

// ── axios 인스턴스
export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 1500000,
  withCredentials: false,
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

      const redirectTo = encodeURIComponent(location.pathname + location.search)


      // 이유를 reason 쿼리로 넘겨서 토스트 등 처리
      location.replace(`/login?redirect=${redirectTo}&reason=unauthorized`)

      // 여기서 흐름 종료
    }
    
    return Promise.reject(err)
  },
)
