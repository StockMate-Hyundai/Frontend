import { http, setProfile, setTokens } from './http'

// 로그인: POST /api/v1/auth/login
// 응답 래퍼: { status, success, message, data: { accessToken, refreshToken, role } }
export async function apiLogin({ email, password }) {
  const { data } = await http.post('/api/v1/auth/login', { email, password })
  const payload = data?.data || {}

  setTokens(payload.accessToken || null, payload.refreshToken || null)
  setProfile(email, payload.role || null)
  
  return payload // { accessToken, refreshToken, role }
}

// 회원가입: POST /api/v1/auth/register
export async function apiRegister(payload) {
  const { data } = await http.post('/api/v1/auth/register', payload)
  
  return data // { status, success, message, data:null }
}

// 헬스체크: GET /api/v1/auth/health-check
export async function apiHealthCheck() {
  const { data } = await http.get('/api/v1/auth/health-check')
  
  return data
}
