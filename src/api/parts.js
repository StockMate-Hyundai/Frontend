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
 * Perform a health check against the parts service.
 * @returns {{ok: boolean, raw: Object}} `ok` is true if the service reports success (`payload.success === true`) or the HTTP status is 200; `raw` is the response payload.
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
 * Fetches details for one or more parts by their IDs.
 * @param {Array<number|string>|number|string} ids - One or more part IDs (number or string). A single ID may be passed instead of an array.
 * @returns {Array<PartsDto>} An array of part detail objects; an empty array if no details are returned.
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
 * Fetches the detail for a single part by its identifier.
 * @param {number|string} id - The part identifier.
 * @returns {PartsDto|null} The part detail object, or `null` if not found.
 */
export async function getPartById(id) {
  const list = await getPartDetail([id])
  
  return list?.[0] ?? null
}

/**
 * 🏢 지점 목록 조회 (사용자 목록에서 가져오기)
 * GET /api/v1/user/all
 * @returns {Promise<Array>} 지점 목록 (사용자 정보를 지점 형태로 변환)
 */
export async function getBranchList() {
  try {
    // 모든 페이지의 사용자를 가져오기
    const firstPage = await http.get('/api/v1/user/all', { params: { page: 0, size: 0 } })
    const payload = firstPage?.data?.data ?? {}
    let allUsers = Array.isArray(payload.content) ? payload.content : []
    
    // 전체 페이지 수만큼 추가로 가져오기
    const totalPages = payload.totalPages ?? 1
    for (let p = 1; p < totalPages; p++) {
      const nextPage = await http.get('/api/v1/user/all', { params: { page: p, size: 100 } })
      const nextPayload = nextPage?.data?.data ?? {}
      const nextContent = Array.isArray(nextPayload.content) ? nextPayload.content : []

      allUsers = allUsers.concat(nextContent)
    }
    
    // 모든 사용자를 지점 목록에 표시 (필터링 없음)
    const branches = allUsers.map(user => ({
      id: user.memberId ?? user.id,
      memberId: user.memberId,
      name: user.storeName || user.email || `지점 ${user.memberId}`,
      address: user.address || '',
      phone: user.businessNumber || '',
      email: user.email || '',
      role: user.role,
    }))
    
    console.log('[getBranchList] 전체 지점 수:', branches.length)
    
    return branches
  } catch (error) {
    console.error('[getBranchList] error:', error)
    console.error('[getBranchList] error response:', error.response?.data)
    
    return []
  }
}

/**
 * 🏢 지점별 재고 조회
 * GET /api/v1/store/search
 * @param {number|string} memberId - 지점 Member ID (현재는 사용하지 않지만 호환성을 위해 유지)
 * @param {Object} options - 검색 옵션
 * @param {number} options.page - 페이지 번호 (0부터 시작)
 * @param {number} options.size - 페이지 크기
 * @param {string|string[]} options.categoryName - 카테고리명
 * @param {string|string[]} options.trim - 트림
 * @param {string|string[]} options.model - 모델
 * @returns {Promise} 페이지네이션된 재고 목록
 */
export async function getBranchStock(branchId, {
  page = 0,
  size = 20,
  categoryName,
  trim,
  model,
} = {}) {
  if (!branchId) {
    return { content: [], page: 0, size, totalElements: 0, totalPages: 0 }
  }

  const toArrayOrUndef = v =>
    v === undefined || v === null || v === '' ? undefined : (Array.isArray(v) ? v : [v])

  const params = {
    page,
    size,
    categoryName: toArrayOrUndef(categoryName),
    trim: toArrayOrUndef(trim),
    model: toArrayOrUndef(model),
    // memberId를 파라미터로 추가 (API가 지원하는 경우)
    memberId: branchId,
  }

  try {
    console.log('[getBranchStock] 조회 시작 - branchId:', branchId)
    console.log('[getBranchStock] 파라미터:', params)
    
    // /api/v1/store/search에 memberId 파라미터 추가 시도
    // 만약 API가 memberId를 지원하지 않으면 현재 사용자 재고만 반환됨
    const res = await http.get('/api/v1/store/search', {
      params,
      paramsSerializer: toParamsString,
    })
    
    console.log('[getBranchStock] API 응답:', res?.data)
    
    // StorePartsDto는 PartsDto와 약간 다릅니다 (stock, amount, limitAmount, isLack 필드가 추가)
    const normalized = normalizePagePayload(res, size)
    
    // StorePartsDto의 stock을 amount로 매핑 (기존 코드 호환성)
    return {
      ...normalized,
      content: normalized.content.map(item => ({
        ...item,
        amount: item.stock ?? item.amount ?? 0, // StorePartsDto는 stock 필드를 사용
      })),
    }
  } catch (error) {
    console.error('[getBranchStock] error:', error)
    console.error('[getBranchStock] error response:', error.response?.data)
    
    return { content: [], page: 0, size, totalElements: 0, totalPages: 0 }
  }
}

/**
 * 🏪 지점 재고 조회 (새 API)
 * GET /api/v1/store/search
 * @param {Object} options - 검색 옵션
 * @param {number} options.page - 페이지 번호 (0부터 시작)
 * @param {number} options.size - 페이지 크기
 * @param {string|string[]} options.categoryName - 카테고리명
 * @param {string|string[]} options.trim - 트림
 * @param {string|string[]} options.model - 모델
 * @returns {Promise} 페이지네이션된 재고 목록 (StorePartsDto)
 */
export async function getStoreInventories({
  page = 0,
  size = 20,
  categoryName,
  trim,
  model,
} = {}) {
  const toArrayOrUndef = v =>
    v === undefined || v === null || v === '' ? undefined : (Array.isArray(v) ? v : [v])

  const params = {
    page,
    size,
    categoryName: toArrayOrUndef(categoryName),
    trim: toArrayOrUndef(trim),
    model: toArrayOrUndef(model),
  }

  const res = await http.get('/api/v1/store/search', {
    params,
    paramsSerializer: toParamsString,
  })

  return normalizePagePayload(res, size)
}

/**
 * 🔍 부품명으로 지점 재고 검색
 * GET /api/v1/store/find-name
 * @param {string} name - 부품명
 * @param {Object} options - 검색 옵션
 * @param {number} options.page - 페이지 번호 (0부터 시작)
 * @param {number} options.size - 페이지 크기
 * @returns {Promise} 페이지네이션된 재고 목록
 */
export async function findStoreInventoryByName(name, {
  page = 0,
  size = 20,
} = {}) {
  if (!name || !name.trim()) {
    return { content: [], page: 0, size, totalElements: 0, totalPages: 0 }
  }

  const res = await http.get('/api/v1/store/find-name', {
    params: { name: name.trim(), page, size },
  })

  return normalizePagePayload(res, size)
}

/**
 * 🏪 지점 부품 전체 조회 (관리자용)
 * GET /api/v1/parts/list/{storeId}
 * @param {number|string} storeId - 지점 ID (memberId)
 * @param {Object} options - 검색 옵션
 * @param {number} options.page - 페이지 번호 (0부터 시작)
 * @param {number} options.size - 페이지 크기
 * @returns {Promise} 페이지네이션된 부품 목록 (PartsDto)
 */
export async function getStorePartsList(storeId, {
  page = 0,
  size = 20,
} = {}) {
  if (!storeId) {
    return { content: [], page: 0, size, totalElements: 0, totalPages: 0 }
  }

  const res = await http.get(`/api/v1/parts/list/${storeId}`, {
    params: { page, size },
  })

  return normalizePagePayload(res, size)
}

/**
 * 📊 부품 분포 조회 API
 * GET /api/v1/parts/distribution/{partId}
 * @param {number|string} partId - 부품 ID
 * @param {Object} options - 검색 옵션
 * @param {number} options.page - 페이지 번호 (0부터 시작)
 * @param {number} options.size - 페이지 크기
 * @returns {Promise} 부품 분포 정보 (PartDistributionResponseDTO)
 */
export async function getPartDistribution(partId, {
  page = 0,
  size = 20,
} = {}) {
  if (!partId) {
    return null
  }

  const res = await http.get(`/api/v1/parts/distribution/${partId}`, {
    params: { page, size },
  })

  // 응답 스펙: ApiResponsePartDistributionResponseDTO -> data: PartDistributionResponseDTO
  return res?.data?.data ?? null
}
