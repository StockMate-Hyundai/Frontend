import { http, setProfile, setTokens } from './http'

/**
 * 로그인 API
 * POST /api/v1/auth/login
 * @param {Object} credentials - 로그인 정보
 * @param {string} credentials.email - 이메일
 * @param {string} credentials.password - 비밀번호
 * @returns {Promise<{accessToken: string, refreshToken: string, role: string}>} 토큰 및 역할 정보
 */
export async function apiLogin({ email, password }) {
  const { data } = await http.post('/api/v1/auth/login', { email, password })
  const payload = data?.data || {}

  setTokens(payload.accessToken || null, payload.refreshToken || null)
  setProfile(email, payload.role || null)
  
  return payload // { accessToken, refreshToken, role }
}

/**
 * 회원가입 API
 * POST /api/v1/auth/register
 * @param {Object} payload - 회원가입 정보
 * @returns {Promise<{status: number, success: boolean, message: string, data: null}>} 응답 데이터
 */
export async function apiRegister(payload) {
  const { data } = await http.post('/api/v1/auth/register', payload)
  
  return data // { status, success, message, data:null }
}

/**
 * 헬스체크 API
 * GET /api/v1/auth/health-check
 * @returns {Promise<Object>} 헬스체크 응답 데이터
 */
export async function apiHealthCheck() {
  const { data } = await http.get('/api/v1/auth/health-check')
  
  return data
}
