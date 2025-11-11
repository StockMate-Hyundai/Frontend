/**
 * 사용자 관련 API
 * 사용자 조회, 상태 변경, 역할 변경 등의 기능을 제공합니다.
 */
import { http } from './http'

/**
 * 유효한 사용자 상태 목록
 */
export const VALID_STATUSES = ['ACTIVE', 'PENDING', 'DISABLED']

/**
 * 유효한 사용자 역할 목록
 */
export const VALID_ROLES = ['USER', 'ADMIN', 'SUPER_ADMIN', 'WAREHOUSE']

/**
 * Ensure a value is a finite number and throw an error otherwise.
 *
 * @param {*} n - The value to validate as a finite number.
 * @param {string} [name='value'] - Label used in the thrown error message when validation fails.
 * @throws {Error} Throws an Error with message "<name>는 숫자여야 합니다." if `n` is not a finite number.
 */
function assertNumber(n, name = 'value') {
  if (!Number.isFinite(n)) throw new Error(`${name}는 숫자여야 합니다.`)
}

/**
 * 사용자 목록 조회
 * GET /api/v1/user/all
 * @param {Object} options - 조회 옵션
 * @param {number} options.page - 페이지 번호 (0부터 시작)
 * @param {number} options.size - 페이지 크기
 * @returns {Promise<Object>} 사용자 목록 및 페이지네이션 정보
 */
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

/**
 * 사용자 상세 조회
 * GET /api/v1/user/{memberId}
 * @param {number|string} memberId - 사용자 ID
 * @returns {Promise<Object|null>} 사용자 정보
 */
export async function apiGetUserByMemberIdPublic(memberId) {
  assertNumber(memberId, 'memberId')

  const { data } = await http.get(`/api/v1/user/${memberId}`)
  
  return data?.data ?? null
}

/**
 * 현재 로그인한 사용자 정보 조회
 * GET /api/v1/user/my
 * @returns {Promise<Object|null>} 현재 사용자 정보
 */
export async function apiGetMyUser() {
  const { data } = await http.get('/api/v1/user/my')
  
  return data?.data ?? null
}

/**
 * 사용자 서비스 헬스체크
 * GET /api/v1/user/health-check
 * @returns {Promise<{ok: boolean, raw: Object}>} 헬스체크 결과
 */
export async function apiUserHealthCheck() {
  const { data } = await http.get('/api/v1/user/health-check')
  
  return { ok: !!data?.success, raw: data }
}

/**
 * 여러 사용자 정보 일괄 조회
 * POST /api/v1/user/batch
 * @param {number[]} memberIds - 사용자 ID 배열
 * @returns {Promise<Array>} 사용자 정보 배열
 */
export async function apiGetUsersByMemberIds(memberIds = []) {
  if (!Array.isArray(memberIds) || memberIds.length === 0)
    throw new Error('memberIds는 비어있지 않은 숫자 배열이어야 합니다.')
  memberIds.forEach((id, i) => assertNumber(id, `memberIds[${i}]`))

  const { data } = await http.post('/api/v1/user/batch', { memberIds })

  // 서버 응답: { status, success, message, data: Array<UserBatchResponseDTO> }
  return Array.isArray(data?.data) ? data.data : []
}

/**
 * 사용자 상태 변경
 * PUT /api/v1/user/status
 * @param {Object} params - 변경 정보
 * @param {number} params.memberId - 사용자 ID
 * @param {string} params.status - 상태 ('ACTIVE' | 'PENDING' | 'DISABLED')
 * @returns {Promise<Object>} 응답 데이터
 */
export async function apiChangeUserStatus({ memberId, status }) {
  assertNumber(memberId, 'memberId')
  if (!VALID_STATUSES.includes(status))
    throw new Error(`status는 ${VALID_STATUSES.join(' | ')} 중 하나여야 합니다.`)

  const { data } = await http.put('/api/v1/user/status', { memberId, status })
  
  return data // { status, success, message, data: null }
}

/**
 * 사용자 역할 변경
 * PUT /api/v1/user/role
 * @param {Object} params - 변경 정보
 * @param {number} params.memberId - 사용자 ID
 * @param {string} params.role - 역할 ('USER' | 'ADMIN' | 'SUPER_ADMIN' | 'WAREHOUSE')
 * @returns {Promise<Object>} 응답 데이터
 */
export async function apiChangeUserRole({ memberId, role }) {
  assertNumber(memberId, 'memberId')
  if (!VALID_ROLES.includes(role))
    throw new Error(`role은 ${VALID_ROLES.join(' | ')} 중 하나여야 합니다.`)

  const { data } = await http.put('/api/v1/user/role', { memberId, role })
  
  return data // { status, success, message, data: null }
}

/**
 * 사용자 상태 라벨 매핑
 */
export const USER_STATUS_LABEL = {
  ACTIVE: '활성',
  PENDING: '대기',
  DISABLED: '비활성',
}

/**
 * 사용자 역할 라벨 매핑
 */
export const USER_ROLE_LABEL = {
  USER: '일반',
  ADMIN: '관리자',
  SUPER_ADMIN: '최고관리자',
  WAREHOUSE: '창고관리자',
}

/**
 * Vuetify VChip용 상태 색상 반환
 * @param {string} verified - 사용자 상태
 * @returns {string|undefined} Vuetify 색상 variant
 */
export function resolveUserStatusVariant(verified) {
  switch (verified) {
  case 'ACTIVE': return 'success'
  case 'PENDING': return 'warning'
  case 'DISABLED': return 'secondary'
  default: return undefined
  }
}

/**
 * 사용자 데이터 정규화
 * 리스트/단건 공통 필드 누락 방지를 위한 유틸리티
 * @param {Object} u - 사용자 객체
 * @returns {Object} 정규화된 사용자 객체
 */
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
