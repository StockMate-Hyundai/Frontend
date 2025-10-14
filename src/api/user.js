// src/api/user.js (혹은 기존 파일에 이어서)
import { http } from './http'

/* ==========================
 * 조회 계열 (이미 있던 것 유지)
 * ========================== */

// GET /api/v1/user/all?page={0-base}&size={n}
export async function apiGetUsersPublic({ page = 0, size = 20 } = {}) {
  const { data } = await http.get('/api/v1/user/all', { params: { page, size } })

  // data.data = { totalElements, totalPages, page, size, pending, active, disabled, content[], last }
  return data.data
}

// GET /api/v1/user/{memberId}
export async function apiGetUserByMemberIdPublic(memberId) {
  const { data } = await http.get(`/api/v1/user/${memberId}`)
  
  return data.data
}

// GET /api/v1/user/my (토큰 필요)
export async function apiGetMyUser() {
  const { data } = await http.get('/api/v1/user/my')
  
  return data.data
}

// GET /api/v1/user/health-check
export async function apiUserHealthCheck() {
  const { data } = await http.get('/api/v1/user/health-check')

  // 성공 시 { status, success, message, data: null } 형태
  return { ok: !!data?.success, raw: data }
}

/* ==========================
 * 변경 계열 (ADMIN/SUPER_ADMIN 권한 필요)
 * ========================== */

// PUT /api/v1/user/status
// body: { memberId: number, status: 'ACTIVE' | 'PENDING' | 'DISABLED' }
const VALID_STATUSES = ['ACTIVE', 'PENDING', 'DISABLED']
export async function apiChangeUserStatus({ memberId, status }) {
  if (!Number.isFinite(memberId)) throw new Error('memberId는 숫자여야 합니다.')
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`status는 ${VALID_STATUSES.join(' | ')} 중 하나여야 합니다.`)
  }
  const { data } = await http.put('/api/v1/user/status', { memberId, status })
  
  return data // { status, success, message, data:null }
}

// PUT /api/v1/user/role
// body: { memberId: number, role: 'USER' | 'ADMIN' | 'SUPER_ADMIN' }
const VALID_ROLES = ['USER', 'ADMIN', 'SUPER_ADMIN']
export async function apiChangeUserRole({ memberId, role }) {
  if (!Number.isFinite(memberId)) throw new Error('memberId는 숫자여야 합니다.')
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`role은 ${VALID_ROLES.join(' | ')} 중 하나여야 합니다.`)
  }
  const { data } = await http.put('/api/v1/user/role', { memberId, role })
  
  return data // { status, success, message, data:null }
}

/* ==========================
 * (선택) UI 헬퍼: 라벨/색상 매핑
 * ========================== */

// 칩 라벨 (한글)
export const USER_STATUS_LABEL = {
  ACTIVE: '활성',
  PENDING: '대기',
  DISABLED: '비활성',
}

export const USER_ROLE_LABEL = {
  USER: '일반',
  ADMIN: '관리자',
  SUPER_ADMIN: '최고관리자',
}

// Vuetify VChip color helper (원하면 사용)
export function resolveUserStatusVariant(status) {
  switch (status) {
  case 'ACTIVE': return 'success'
  case 'PENDING': return 'warning'
  case 'DISABLED': return 'secondary'
  default: return undefined
  }
}
