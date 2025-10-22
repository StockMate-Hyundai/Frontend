// src/api/parts.js
import { http } from '@/api/http'

/**
 * Axios paramsSerializer용 유틸:
 * OpenAPI에 따르면 categoryName/trim/model는 배열 파라미터.
 * -> key=value&key=value 형태로 직렬화(대괄호 없이 반복).
 */
function toParamsString(params = {}) {
  const usp = new URLSearchParams()

  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return
    if (Array.isArray(v)) v.forEach(item => item !== undefined && item !== null && usp.append(k, String(item)))
    else usp.append(k, String(v))
  })
  
  return usp.toString()
}

/** 공통 페이지 payload 정규화 */
function normalizePagePayload(raw, fallbackSize) {
  const payload = raw?.data?.data ?? raw?.data ?? {}
  
  return {
    content: Array.isArray(payload.content) ? payload.content : [],
    page: payload.page ?? 0,
    size: payload.size ?? fallbackSize,
    totalElements: payload.totalElements ?? 0,
    totalPages: payload.totalPages ?? 0,
  }
}

/**
 * 🔎 부품 검색 (배열 파라미터 지원)
 * GET /api/v1/parts/search
 * - categoryName: string[]  (예: ['전기/램프','엔진/미션'])
 * - trim:         string[]  (예: ['SUV','중형'])
 * - model:        string[]  (예: ['LF소나타','투싼NX4'])
 * - page, size
 */
export async function searchParts({
  page = 0,
  size = 20,
  categoryName, // string | string[]
  trim,         // string | string[]
  model,        // string | string[]
} = {}) {
  // 문자열이 들어오면 배열로 변환
  const toArrayOrUndef = v =>
    v === undefined || v === null || v === '' ? undefined : (Array.isArray(v) ? v : [v])

  const params = {
    page,
    size,
    categoryName: toArrayOrUndef(categoryName),
    trim: toArrayOrUndef(trim),
    model: toArrayOrUndef(model),
  }

  const res = await http.get('/api/v1/parts/search', {
    params,
    paramsSerializer: toParamsString,
  })

  return normalizePagePayload(res, size)
}

/**
 * 📃 부품 전체 조회
 * GET /api/v1/parts/list
 * - page, size
 */
export async function getPartsList({
  page = 0,
  size = 20,
} = {}) {
  const res = await http.get('/api/v1/parts/list', {
    params: { page, size },
  })

  
  return normalizePagePayload(res, size)
}

/**
 * ⚠️ 부족 재고 조회
 * GET /api/v1/parts/lack
 * - amount(기본 5), page, size
 */
export async function getLackStock({
  amount = 10,
  page = 0,
  size = 20,
} = {}) {
  const res = await http.get('/api/v1/parts/lack', {
    params: { amount, page, size },
  })

  
  return normalizePagePayload(res, size)
}

/**
 * ✅ 헬스체크 (선택)
 * GET /api/v1/parts/health-check
 */
export async function partsHealthCheck() {
  const res = await http.get('/api/v1/parts/health-check')

  // 단순 boolean으로 반환
  const payload = res?.data ?? {}
  
  return {
    ok: payload?.success === true || res?.status === 200,
    raw: payload,
  }
}


/**
 * 📄 부품 상세 조회 (여러 개)
 * POST /api/v1/parts/detail
 * @param {Array<number|string>} ids - 부품 ID 배열
 * @returns {Array<PartsDto>}
 */
export async function getPartDetail(ids = []) {
  // 방어: 배열화 + 숫자/문자 모두 허용
  const arr = Array.isArray(ids) ? ids : [ids]
  if (!arr.length) return []

  const res = await http.post('/api/v1/parts/detail', arr)
  // 응답 스펙: ApiResponseListPartsDto -> data: PartsDto[]
  const payload = res?.data?.data ?? res?.data ?? []
  return Array.isArray(payload) ? payload : []
}

/**
 * 📄 부품 단건 상세 조회
 * 내부적으로 /parts/detail에 [id]로 요청
 * @param {number|string} id
 * @returns {PartsDto|null}
 */
export async function getPartById(id) {
  const list = await getPartDetail([id])
  return list?.[0] ?? null
}
