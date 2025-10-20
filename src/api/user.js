// src/api/user.js
import { http } from './http'

/* =========================================================
 * 공통: enum/가드
 * ======================================================= */
export const VALID_STATUSES = ['ACTIVE', 'PENDING', 'DISABLED']
export const VALID_ROLES = ['USER', 'ADMIN', 'SUPER_ADMIN']

function assertNumber(n, name = 'value') {
  if (!Number.isFinite(n)) throw new Error(`${name}는 숫자여야 합니다.`)
}

/* =========================================================
 * 조회 계열
 * ======================================================= */
// GET /api/v1/user/all?page={0-base}&size={n}
export async function apiGetUsersPublic({ page = 0, size = 20 } = {}) {
  const { data } = await http.get('/api/v1/user/all', { params: { page, size } })

  // 서버 응답: { status, success, message, data: { totalElements, totalPages, page, size, pending, active, disabled, content[], last } }
  const payload = data?.data ?? {}
  
  return {
    totalElements: payload.totalElements ?? 0,
    totalPages: payload.totalPages ?? 0,
    page: payload.page ?? page,
    size: payload.size ?? size,
    pending: payload.pending ?? 0,
    active: payload.active ?? 0,
    disabled: payload.disabled ?? 0,
    content: Array.isArray(payload.content) ? payload.content : [],
    last: !!payload.last,
  }
}

// GET /api/v1/user/{memberId}
export async function apiGetUserByMemberIdPublic(memberId) {
  assertNumber(memberId, 'memberId')

  const { data } = await http.get(`/api/v1/user/${memberId}`)
  
  return data?.data ?? null
}

// GET /api/v1/user/my (토큰 필요)
export async function apiGetMyUser() {
  const { data } = await http.get('/api/v1/user/my')
  
  return data?.data ?? null
}

// GET /api/v1/user/health-check
export async function apiUserHealthCheck() {
  const { data } = await http.get('/api/v1/user/health-check')
  
  return { ok: !!data?.success, raw: data }
}

// POST /api/v1/user/batch
// body: { memberIds: number[] }
export async function apiGetUsersByMemberIds(memberIds = []) {
  if (!Array.isArray(memberIds) || memberIds.length === 0)
    throw new Error('memberIds는 비어있지 않은 숫자 배열이어야 합니다.')
  memberIds.forEach((id, i) => assertNumber(id, `memberIds[${i}]`))

  const { data } = await http.post('/api/v1/user/batch', { memberIds })

  // 서버 응답: { status, success, message, data: Array<UserBatchResponseDTO> }
  return Array.isArray(data?.data) ? data.data : []
}

/* =========================================================
 * 변경 계열 (권한 필요)
 * ======================================================= */
// PUT /api/v1/user/status
// body: { memberId: number, status: 'ACTIVE' | 'PENDING' | 'DISABLED' }

export async function apiChangeUserStatus({ memberId, status }) {
  assertNumber(memberId, 'memberId')
  if (!VALID_STATUSES.includes(status))
    throw new Error(`status는 ${VALID_STATUSES.join(' | ')} 중 하나여야 합니다.`)

  const { data } = await http.put('/api/v1/user/status', { memberId, status })
  
  return data // { status, success, message, data: null }
}

// PUT /api/v1/user/role
// body: { memberId: number, role: 'USER' | 'ADMIN' | 'SUPER_ADMIN' }

export async function apiChangeUserRole({ memberId, role }) {
  assertNumber(memberId, 'memberId')
  if (!VALID_ROLES.includes(role))
    throw new Error(`role은 ${VALID_ROLES.join(' | ')} 중 하나여야 합니다.`)

  const { data } = await http.put('/api/v1/user/role', { memberId, role })
  
  return data // { status, success, message, data: null }
}

/* =========================================================
 * UI 헬퍼 (verified/role 라벨 & 칩 컬러)
 * ======================================================= */
// 서버 모델: verified: 'ACTIVE' | 'PENDING' | 'DISABLED'
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

// Vuetify VChip color helper
export function resolveUserStatusVariant(verified) {
  switch (verified) {
  case 'ACTIVE': return 'success'
  case 'PENDING': return 'warning'
  case 'DISABLED': return 'secondary'
  default: return undefined
  }
}

/* =========================================================
 * (선택) 정규화 유틸
 * - 리스트/단건 공통 필드 누락 방지
 * ======================================================= */
export function normalizeUser(u = {}) {
  return {
    id: u.id ?? null,
    memberId: u.memberId ?? null,
    email: u.email ?? '',
    owner: u.owner ?? '',
    address: u.address ?? '',
    storeName: u.storeName ?? '',
    businessNumber: u.businessNumber ?? '',
    role: u.role ?? 'USER',
    verified: u.verified ?? 'PENDING',
    latitude: typeof u.latitude === 'number' ? u.latitude : null,
    longitude: typeof u.longitude === 'number' ? u.longitude : null,
    createdAt: u.createdAt ?? null,
    updatedAt: u.updatedAt ?? null,
  }
}
