/**
 * 주문 이력 관련 API
 * 입출고 히스토리 조회 및 등록 기능을 제공합니다.
 */
import { http } from '@/api/http'

/**
 * 페이지네이션 응답 정규화
 * @param {Object} payload - 서버 응답 데이터
 * @returns {Object} 정규화된 히스토리 목록 데이터
 */
function normalizeHistoryList(payload = {}) {
  const data = payload?.data ?? payload ?? {}
  
  return {
    totalElements: Number(data.totalElements ?? 0),
    totalPages: Number(data.totalPages ?? 0),
    currentPage: Number(data.currentPage ?? 0),
    pageSize: Number(data.pageSize ?? 0),
    last: Boolean(data.last ?? false),
    content: Array.isArray(data.content) ? data.content : [],
  }
}

/**
 * 입출고 히스토리 등록
 * POST /api/v1/information/order-history
 * 
 * ReceivingHistoryRequestDTO:
 * - memberId?: integer (int64)
 * - orderId?: integer (int64)
 * - orderNumber?: string
 * - message?: string
 * - status?: string
 * - type?: string
 * - items?: HistoryItemDTO[]
 *   - partId: integer (int64)
 *   - quantity: integer (int32)
 */
export async function registerReceivingHistory(params) {
  const body = {
    memberId: params?.memberId ?? undefined,
    orderId: params?.orderId ?? undefined,
    orderNumber: params?.orderNumber || undefined,
    message: params?.message || undefined,
    status: params?.status,
    type: params?.type,
    items: Array.isArray(params?.items) ? params.items.map(item => ({
      partId: Number(item.partId ?? item.id),
      quantity: Number(item.quantity ?? item.historyQuantity ?? 0),
    })) : [],
  }

  const res = await http.post('/api/v1/information/order-history', body)
  
  return {
    status: res?.data?.status ?? 200,
    success: !!(res?.data?.success ?? true),
    message: res?.data?.message,
    data: res?.data?.data ?? null,
  }
}

/**
 * 주문별 입출고 히스토리 조회
 * GET /api/v1/information/order-history/order/{orderNumber}
 */
export async function getReceivingHistoryByOrderNumber(orderNumber, { page = 0, size = 20 } = {}) {
  if (!orderNumber) throw new Error('orderNumber is required')
  
  const res = await http.get(`/api/v1/information/order-history/order/${orderNumber}`, {
    params: { page, size },
  })
  
  return normalizeHistoryList(res?.data?.data ?? res?.data)
}

/**
 * 가맹점별 입출고 히스토리 조회 (가맹점 전용)
 * GET /api/v1/information/order-history/my
 */
export async function getMyReceivingHistory({ page = 0, size = 20 } = {}) {
  const res = await http.get('/api/v1/information/order-history/my', {
    params: { page, size },
  })
  
  return normalizeHistoryList(res?.data?.data ?? res?.data)
}

/**
 * 관리자용 특정 가맹점 입출고 히스토리 조회
 * GET /api/v1/information/order-history/admin/member/{memberId}
 */
export async function getReceivingHistoryByMemberIdForAdmin(memberId, { page = 0, size = 20 } = {}) {
  if (!memberId) throw new Error('memberId is required')
  
  const res = await http.get(`/api/v1/information/order-history/admin/member/${memberId}`, {
    params: { page, size },
  })
  
  return normalizeHistoryList(res?.data?.data ?? res?.data)
}

/**
 * 관리자용 전체 입출고 히스토리 조회
 * GET /api/v1/information/order-history/admin/all
 */
export async function getAllReceivingHistoryForAdmin({ page = 0, size = 20 } = {}) {
  const res = await http.get('/api/v1/information/order-history/admin/all', {
    params: { page, size },
  })
  
  return normalizeHistoryList(res?.data?.data ?? res?.data)
}

