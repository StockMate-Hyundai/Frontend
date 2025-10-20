// File: src/api/order.js
import { http } from '@/api/http'

/**
 * 주문 상태 Enum (서버 스펙과 동일)
 * @type {const}
 */
export const ORDER_STATUS = {
  ORDER_COMPLETED: 'ORDER_COMPLETED',
  PENDING_SHIPPING: 'PENDING_SHIPPING',
  SHIPPING: 'SHIPPING',
  REJECTED: 'REJECTED',
  DELIVERED: 'DELIVERED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
}

/** 내부: 빈값 방지용 기본 응답 */
function normalizeOrderList(payload = {}) {
  const data = payload?.data ?? payload ?? {}
  const content = Array.isArray(data.content) ? data.content : []

  return {
    totalElements: Number(data.totalElements ?? 0),
    totalPages: Number(data.totalPages ?? 0),
    page: Number(data.page ?? 0),               // 서버 0-base
    size: Number(data.size ?? 0),
    content,
    last: Boolean(data.last ?? (data.page + 1 >= data.totalPages)),
  }
}

/**
 * Health Check
 * GET /api/v1/order/health-check
 */
export async function healthCheck() {
  const res = await http.get('/api/v1/order/health-check')
  
  return {
    status: res?.data?.status ?? 200,
    success: !!(res?.data?.success ?? true),
    message: res?.data?.message,
  }
}

/**
 * 주문 생성
 * POST /api/v1/order
 */
export async function makeOrder(params) {
  const body = {
    orderItems: Array.isArray(params?.orderItems) ? params.orderItems : [],
    requestedShippingDate: params?.requestedShippingDate ?? undefined,
    etc: params?.etc ?? undefined,
  }

  const res = await http.post('/api/v1/order', body)
  
  return {
    status: res?.data?.status ?? 200,
    success: !!(res?.data?.success ?? true),
    message: res?.data?.message,
  }
}

/**
 * 주문 취소
 * PUT /api/v1/order/{orderId}/cancel
 */
export async function cancelOrder(orderId) {
  if (orderId == null) throw new Error('orderId is required')
  const res = await http.put(`/api/v1/order/${orderId}/cancel`)
  
  return {
    status: res?.data?.status ?? 200,
    success: !!(res?.data?.success ?? true),
    message: res?.data?.message,
  }
}

/**
 * 주문 물리 삭제
 * DELETE /api/v1/order/{orderId}
 */
export async function deleteOrder(orderId) {
  if (orderId == null) throw new Error('orderId is required')
  const res = await http.delete(`/api/v1/order/${orderId}`)
  
  return {
    status: res?.data?.status ?? 200,
    success: !!(res?.data?.success ?? true),
    message: res?.data?.message,
  }
}

/**
 * 주문 리스트 조회 (관리자용)
 * POST /api/v1/order/list
 */
export async function getOrderList(opts = {}) {
  const {
    status,
    partId,
    memberId,
    startDate,
    endDate,
    page = 1,     // UI 1-base
    size = 10,
  } = opts

  const body = {
    status: status ?? undefined,
    partId: partId ?? undefined,
    memberId: memberId ?? undefined,
    startDate: startDate ?? undefined,
    endDate: endDate ?? undefined,
    page: Math.max(0, Number(page) - 1), // 서버 0-base
    size: Number(size),
  }

  const res = await http.post('/api/v1/order/list', body)
  
  return normalizeOrderList(res?.data?.data ?? res?.data)
}

/**
 * 주문 상세 조회
 * GET /api/v1/order/detail?orderId=123
 * (본인 주문 또는 ADMIN/SUPER_ADMIN)
 * @param {number|string} orderId
 * @returns {Promise<import('./types').OrderDetailResponseDTO>}
 */
export async function getOrderDetail(orderId) {
  if (orderId == null || orderId === '') throw new Error('orderId is required')
  const res = await http.get('/api/v1/order/detail', { params: { orderId } })

  // 서버 공통 래퍼: { status, success, message, data }
  return (res?.data?.data ?? res?.data ?? {})
}

/* ==========================
   UI 헬퍼
========================== */

/**
 * DataTableServer에 바로 물리기 편한 헬퍼
 * - UI page는 1-base로 유지
 * - rows: 주문 배열
 * - total: 전체 개수
 */
export async function fetchOrdersForTable({ page = 1, itemsPerPage = 10, filters = {} } = {}) {
  const data = await getOrderList({
    page,
    size: itemsPerPage,
    ...filters,
  })

  return {
    rows: data.content,
    total: data.totalElements,
    page, // 그대로 1-base
  }
}

export async function getOrderListByMemberId({
  memberId,
  page = 1,
  size = 10,
  status,
  partId,
  startDate,
  endDate,
} = {}) {
  if (memberId == null) throw new Error('memberId is required')

  // 기존 정규화 로직을 가진 getOrderList를 재사용
  return await getOrderList({
    memberId,
    page,
    size,
    status,
    partId,
    startDate,
    endDate,
  })
}
