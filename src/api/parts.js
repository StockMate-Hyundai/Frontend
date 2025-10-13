// src/api/parts.js
import { http } from '@/api/http' // 경로는 프로젝트 맞게 조정

/** 부품 목록 조회 (서버 0-base page) */
export async function getPartsList({ page = 0, size = 20 } = {}) {
  const res = await http.get('/api/v1/parts/list', {
    params: { page, size },
  })


  // 서버 응답이 { data: { content, page, size, totalElements, totalPages } } 형태
  const payload = res?.data?.data ?? res?.data ?? {}
  
  return {
    content: Array.isArray(payload.content) ? payload.content : [],
    page: payload.page ?? 0,
    size: payload.size ?? size,
    totalElements: payload.totalElements ?? 0,
    totalPages: payload.totalPages ?? 0,
  }
}

/** (선택) 부족재고 */
export async function getUnderLimitInventories({ userId, page = 0, size = 20 }) {
  const res = await http.get('/api/v1/inventory/under-limit', {
    params: { userId, page, size },
  })

  return res?.data?.data ?? res?.data ?? {}
}

/** (선택) 카테고리 점유율 */
export async function getCategoryShare({ userId }) {
  const res = await http.get('/api/v1/inventory/dashboard/category-share', {
    params: { userId },
  })

  
  return res?.data?.data ?? []
}

/** (선택) 재고 분석 (서버 페이지) */
export async function getInventoryAnalysis({ q, page = 0, size = 20 } = {}) {
  const res = await http.get('/api/v1/inventory/analysis', {
    params: { q, page, size },
  })

  
  return res?.data?.data ?? {}
}

/** (선택) 분석 Export (csv/xlsx 등) */
export async function exportInventoryAnalysis({ q, format = 'csv' } = {}) {
  const res = await http.get('/api/v1/inventory/analysis/export', {
    params: { q, format },
    responseType: 'blob',
  })

  
  return res.data
}
