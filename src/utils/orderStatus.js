/**
 * 주문 상태 Enum
 * 모든 주문 상태를 중앙에서 관리합니다.
 */
export const ORDER_STATUS = {
  ORDER_COMPLETED: 'ORDER_COMPLETED',           // 주문 완료
  PAY_COMPLETED: 'PAY_COMPLETED',               // 결제 완료
  PENDING_APPROVAL: 'PENDING_APPROVAL',         // 승인 대기 (재고 차감 및 결제 진행 중)
  FAILED: 'FAILED',                             // 결제 실패
  PENDING_SHIPPING: 'PENDING_SHIPPING',         // 출고 대기
  SHIPPING: 'SHIPPING',                         // 배송중
  PENDING_RECEIVING: 'PENDING_RECEIVING',       // 입고 대기
  REJECTED: 'REJECTED',                         // 출고 반려
  DELIVERED: 'DELIVERED',                       // 배송 완료
  RECEIVED: 'RECEIVED',                         // 입고 완료
  REFUNDED: 'REFUNDED',                         // 환불 완료
  REFUND_REJECTED: 'REFUND_REJECTED',           // 환불 반려
  CANCELLED: 'CANCELLED',                       // 주문 취소
}

/**
 * 주문 상태별 표시 정보
 */
export const ORDER_STATUS_INFO = {
  [ORDER_STATUS.ORDER_COMPLETED]: {
    label: '주문 완료',
    color: 'primary',
    description: '주문이 완료되었습니다.'
  },
  [ORDER_STATUS.PAY_COMPLETED]: {
    label: '결제 완료',
    color: 'success',
    description: '결제가 완료되었습니다.'
  },
  [ORDER_STATUS.PENDING_APPROVAL]: {
    label: '승인 대기',
    color: 'warning',
    description: '재고 차감 및 결제 진행 중입니다.'
  },
  [ORDER_STATUS.FAILED]: {
    label: '결제 실패',
    color: 'error',
    description: '결제 처리에 실패했습니다.'
  },
  [ORDER_STATUS.PENDING_SHIPPING]: {
    label: '출고 대기',
    color: 'warning',
    description: '출고 준비 중입니다.'
  },
  [ORDER_STATUS.SHIPPING]: {
    label: '배송중',
    color: 'info',
    description: '배송이 진행 중입니다.'
  },
  [ORDER_STATUS.PENDING_RECEIVING]: {
    label: '입고 대기',
    color: 'warning',
    description: '입고 대기 중입니다.'
  },
  [ORDER_STATUS.REJECTED]: {
    label: '주문 반려',
    color: 'error',
    description: '주문이 반려되었습니다.'
  },
  [ORDER_STATUS.DELIVERED]: {
    label: '배송 완료',
    color: 'success',
    description: '배송이 완료되었습니다.'
  },
  [ORDER_STATUS.RECEIVED]: {
    label: '입고 완료',
    color: 'secondary',
    description: '입고가 완료되었습니다.'
  },
  [ORDER_STATUS.REFUNDED]: {
    label: '환불 완료',
    color: 'info',
    description: '환불이 완료되었습니다.'
  },
  [ORDER_STATUS.REFUND_REJECTED]: {
    label: '환불 반려',
    color: 'error',
    description: '환불이 반려되었습니다.'
  },
  [ORDER_STATUS.CANCELLED]: {
    label: '주문 취소',
    color: 'error',
    description: '주문이 취소되었습니다.'
  }
}

/**
 * 주문 상태 선택지 (필터용)
 */
export const ORDER_STATUS_OPTIONS = [
  { label: '주문 완료', value: ORDER_STATUS.ORDER_COMPLETED },
  { label: '결제 완료', value: ORDER_STATUS.PAY_COMPLETED },
  { label: '승인 대기', value: ORDER_STATUS.PENDING_APPROVAL },
  { label: '결제 실패', value: ORDER_STATUS.FAILED },
  { label: '출고 대기', value: ORDER_STATUS.PENDING_SHIPPING },
  { label: '배송중', value: ORDER_STATUS.SHIPPING },
  { label: '입고 대기', value: ORDER_STATUS.PENDING_RECEIVING },
  { label: '주문 반려', value: ORDER_STATUS.REJECTED },
  { label: '배송 완료', value: ORDER_STATUS.DELIVERED },
  { label: '입고 완료', value: ORDER_STATUS.RECEIVED },
  { label: '환불 완료', value: ORDER_STATUS.REFUNDED },
  { label: '환불 반려', value: ORDER_STATUS.REFUND_REJECTED },
  { label: '주문 취소', value: ORDER_STATUS.CANCELLED }
]

/**
 * 주문 상태 해결 함수
 * @param {string} status - 주문 상태
 * @returns {object} - { text, color, description }
 */
export const resolveOrderStatus = (status) => {
  const info = ORDER_STATUS_INFO[status]
  if (info) return { text: info.label, color: info.color, description: info.description }
  return { text: '알 수 없음', color: 'error', description: '알 수 없는 상태입니다.' }
}
