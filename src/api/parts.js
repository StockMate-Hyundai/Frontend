// src/api/parts.js
import { http } from '@/api/http'

// ✅ categoryName, model 전달 추가
export async function getPartsList({ page = 0, size = 20, categoryName, model } = {}) {
  const params = { page, size }
  if (categoryName) params.categoryName = categoryName
  if (model) params.model = model

  const res = await http.get('/api/v1/parts/search', { params })

  const payload = res?.data?.data ?? res?.data ?? {}
  
  return {
    content: Array.isArray(payload.content) ? payload.content : [],
    page: payload.page ?? 0,
    size: payload.size ?? size,
    totalElements: payload.totalElements ?? 0,
    totalPages: payload.totalPages ?? 0,
  }
}
