<!-- File: src/pages/order-detail/[id].vue -->
<script setup>
definePage({
  meta: {
    title: '주문 상세',
    icon: 'bx-file-blank',
    requiresAuth: true,
  },
})
import { deleteOrder as apiDeleteOrder, approveOrder, getOrderDetail, rejectOrder } from '@/api/order'
import { executeOrderApproval } from '@/api/websocket'
import { generateInvoicePDF, transformOrderDataForInvoice } from '@/utils/invoice'
import { ORDER_STATUS, resolveOrderStatus } from '@/utils/orderStatus'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/* 라우팅 */
const route  = useRoute()
const router = useRouter()
const orderId = computed(() => String(route.params.id ?? ''))

// 상태 칩 매핑은 utils/orderStatus.js에서 통합 관리

/* 상태/데이터 */
const loading = ref(false)
const errorMsg = ref('')

const summary = ref({
  orderNumber: `#${orderId.value}`,
  createdAt: '',
  status: null,
  requestedShippingDate: null,
  shippingDate: null,
  totalPrice: 0,
  carrier: '-',
  trackingNumber: '-',
  etc: '',
  rejectedMessage: '',
})

const customerInfo = ref({
  name: '-',
  email: '-',
  idLabel: `Order ID: ${orderId.value}`,
  ordersCount: 0,
  address: '-',
})

const lineItems = ref([])

/* 웹소켓 관련 상태 */
const websocket = ref(null)
const isApproving = ref(false)
const approvalMessage = ref('')

/* 반려 관련 상태 */
const showRejectDialog = ref(false)
const rejectReason = ref('')
const isRejecting = ref(false)

/* 유틸 */
const fmtCurrency = v => (v ?? v === 0) ? new Intl.NumberFormat().format(v) : '-'
const avatarText = name => (name ?? '?').trim().split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase()

/* 금액 계산 */
const totalAmount = computed(() => Number(summary.value.totalPrice) || 0)
const vatAmount = computed(() => Math.floor(totalAmount.value * 10 / 110))
const supplyAmount = computed(() => totalAmount.value - vatAmount.value)

/* 데이터 로드 */
async function loadDetail() {
  if (!orderId.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const d = await getOrderDetail(orderId.value)

    // 상단 요약
    summary.value = {
      orderNumber: d?.orderNumber ? d.orderNumber : `#${d?.orderId ?? orderId.value}`,
      createdAt: d?.createdAt || '',
      status: d?.orderStatus || null,
      requestedShippingDate: d?.requestedShippingDate || null,
      shippingDate: d?.shippingDate || null,
      totalPrice: d?.totalPrice ?? 0,
      carrier: d?.carrier || '-',
      trackingNumber: d?.trackingNumber || '-',
      etc: d?.etc || '',
      rejectedMessage: d?.rejectedMessage || '',
    }

    // 고객 정보
    const u = d?.userInfo ?? {}

    customerInfo.value = {
      name: u?.storeName || u?.owner || u?.email || '-',
      email: u?.email || '-',
      idLabel: `Order ID: ${d?.orderId ?? orderId.value}`,
      ordersCount: 0,
      address: u?.address || '-',
    }

    // 라인아이템
    const items = Array.isArray(d?.orderItems) ? d.orderItems : []

    lineItems.value = items.map(x => {
      const pd = x?.partDetail ?? {}
      const name = pd?.korName || pd?.name || pd?.engName || `#${x?.partId}`
      const price = pd?.price ?? 0
      const qty = x?.amount ?? 0
      // 이미지 URL 우선순위: imageUrl > image > thumbnail
      const image = pd?.imageUrl || pd?.image || pd?.thumbnail || null
      
      return {
        image,
        productName: name,
        productId: pd?.id,
        subtitle: pd?.categoryName,
        price,
        quantity: qty,
        total: (price * qty) || 0,
      }
    })
  } catch (e) {
    errorMsg.value = e?.message || '상세 조회 중 오류가 발생했습니다.'
  } finally {
    loading.value = false
  }
}
onMounted(loadDetail)
watch(() => route.params.id, loadDetail)

/* 주문 승인 처리 */
async function onApprove() {
  if (!orderId.value || isApproving.value) return
  
  try {
    isApproving.value = true
    approvalMessage.value = '승인 요청 중...'
    
    // 승인 API 호출
    await approveOrder(orderId.value)
    
    approvalMessage.value = '승인 요청 완료, 처리 중...'
    
    // 웹소켓을 통한 실시간 승인 처리
    websocket.value = await executeOrderApproval(
      orderId.value,

      // 메시지 핸들러
      data => {
        approvalMessage.value = data.message || '처리 중...'
      },

      // 에러 핸들러
      error => {
        console.error('Approval error:', error)
        isApproving.value = false
        approvalMessage.value = error.message || '승인 처리 중 오류가 발생했습니다.'
      },

      // 완료 핸들러
      data => {
        isApproving.value = false
        approvalMessage.value = '주문 승인이 완료되었습니다.'
        
        // 페이지 새로고침
        setTimeout(() => {
          loadDetail()
        }, 1000)
      },
    )
    
  } catch (e) {
    console.error('Approval failed:', e)
    isApproving.value = false
    approvalMessage.value = e?.message || '승인 요청 중 오류가 발생했습니다.'
  }
}

/* 반려 관련 함수들 */
function openRejectDialog() {
  showRejectDialog.value = true
  rejectReason.value = ''
}

function closeRejectDialog() {
  showRejectDialog.value = false
  rejectReason.value = ''
  isRejecting.value = false
}

async function onReject() {
  if (!orderId.value || isRejecting.value || !rejectReason.value.trim()) return
  
  try {
    isRejecting.value = true
    
    // 반려 API 호출
    await rejectOrder(orderId.value, rejectReason.value.trim())
    
    // 성공 시 다이얼로그 닫고 페이지 새로고침
    closeRejectDialog()
    loadDetail()
    
  } catch (e) {
    console.error('Reject failed:', e)
  } finally {
    isRejecting.value = false
  }
}

function disconnectWebSocket() {
  if (websocket.value) {
    websocket.value.disconnect()
    websocket.value = null
  }
}

onUnmounted(() => {
  disconnectWebSocket()
})

/* 액션 */
const loadingAction = ref(false)

async function onDelete() {
  if (!orderId.value) return
  loadingAction.value = true
  try {
    await apiDeleteOrder(Number(orderId.value))
    router.back()
  } catch (e) {
  } finally {
    loadingAction.value = false
  }
}

async function onDownloadInvoice() {
  if (!orderId.value) return
  try {
    // 주문 상세 조회
    const orderDetail = await getOrderDetail(orderId.value)
    
    // 인보이스 생성에 필요한 데이터 변환
    const invoiceData = transformOrderDataForInvoice(orderDetail)
    
    // 통화 포맷 함수 추가
    invoiceData.fmtCurrency = fmtCurrency
    invoiceData.resolveOrderStatus = resolveOrderStatus
    
    // PDF 생성
    const pdf = await generateInvoicePDF(invoiceData)
    
    // 다운로드
    pdf.save(`Invoice_${invoiceData.summary.orderNumber}.pdf`)
  } catch (e) {
    console.error('[Invoice Download] error:', e)
    alert('인보이스 다운로드 중 오류가 발생했습니다.')
  }
}

/* 표 헤더 */
const headers = [
  { title: '제품명',  key: 'productName' },
  { title: '가격',    key: 'price' },
  { title: '개수',    key: 'quantity' },
  { title: '총합',    key: 'total' },
]

/* 승인 가능한 상태인지 확인 */
const canApprove = computed(() => {
  return summary.value.status === ORDER_STATUS.PAY_COMPLETED && !isApproving.value
})

/* 반려 가능한 상태인지 확인 */
const canReject = computed(() => {
  return summary.value.status === ORDER_STATUS.PAY_COMPLETED && !isRejecting.value
})

/* 인보이스 다운로드 가능한 상태인지 확인 */
const canDownloadInvoice = computed(() => {
  return [ORDER_STATUS.APPROVAL_ORDER, ORDER_STATUS.PENDING_SHIPPING, ORDER_STATUS.SHIPPING, ORDER_STATUS.RECEIVED].includes(summary.value.status)
})

/* =============== Shipping Activity 타임라인 =============== */
const FLOW = [
  ORDER_STATUS.PAY_COMPLETED,
  ORDER_STATUS.APPROVAL_ORDER,
  ORDER_STATUS.PENDING_SHIPPING,
  ORDER_STATUS.SHIPPING,
  ORDER_STATUS.RECEIVED,
]

const timelineSteps = computed(() => {
  const s = summary.value
  const current = String(s.status || '')
  const idx = FLOW.indexOf(current)
  const rejected = current === ORDER_STATUS.REJECTED
  const cancelled = current === ORDER_STATUS.CANCELLED

  const dateMap = {
    [ORDER_STATUS.PAY_COMPLETED]: s.createdAt || null,
    [ORDER_STATUS.APPROVAL_ORDER]: null,
    [ORDER_STATUS.PENDING_SHIPPING]: s.requestedShippingDate || null,
    [ORDER_STATUS.SHIPPING]: s.shippingDate || null,
    [ORDER_STATUS.RECEIVED]: null,
  }

  const steps = FLOW.map((k, i) => ({
    key: k,
    title: resolveOrderStatus(k).text,
    date: dateMap[k],
    state: i < idx ? 'done' : i === idx ? 'current' : 'todo',
    dotColor: i < idx ? 'primary' : i === idx ? 'primary' : 'secondary',
  }))

  if (rejected || cancelled) {
    const info = resolveOrderStatus(current)

    steps.push({
      key: current,
      title: info.text,
      date: null,
      state: 'current',
      dotColor: info.color,
    })
  }
  
  return steps
})
</script>

<template>
  <div class="page-container order-detail-page">
    <!-- 에러 -->
    <VAlert
      v-if="errorMsg"
      type="error"
      class="mb-2"
      variant="tonal"
    >
      {{ errorMsg }}
    </VAlert>

    <!-- 승인 진행 상황 -->
    <VAlert
      v-if="isApproving || approvalMessage"
      type="info"
      class="mb-2"
      variant="tonal"
    >
      <div class="d-flex align-center gap-2">
        <VProgressCircular
          v-if="isApproving"
          indeterminate
          size="16"
          width="2"
        />
        {{ approvalMessage }}
      </div>
    </VAlert>

    <!-- 상단 헤더: 컴팩트 -->
    <div class="compact-header">
      <div class="d-flex justify-space-between align-center flex-wrap gap-y-2">
        <div>
          <div class="d-flex gap-2 align-center mb-1 flex-wrap">
            <h6 class="text-subtitle-1 text-high-emphasis">
              주문 {{ summary.orderNumber }}
            </h6>
            <VChip
              v-bind="resolveOrderStatus(summary.status)"
              variant="tonal"
              label
              size="x-small"
              class="status-chip"
            />
            <VChip
              v-if="summary.rejectedMessage"
              color="error"
              variant="tonal"
              label
              size="x-small"
              class="reject-message-chip"
            >
              <VIcon
                start
                icon="bx-x-circle"
                size="12"
              />
              {{ summary.rejectedMessage }}
            </VChip>
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ summary.createdAt ? new Date(summary.createdAt).toLocaleString() : '-' }}
          </div>
        </div>
        <div class="d-flex gap-2">
          <VBtn
            v-if="canDownloadInvoice"
            variant="flat"
            color="primary"
            size="small"
            @click="onDownloadInvoice"
          >
            <VIcon
              start
              icon="bx-download"
              size="16"
            />
            인보이스 다운로드
          </VBtn>
          <VBtn
            v-if="canApprove"
            variant="flat"
            color="success"
            size="small"
            :loading="isApproving"
            @click="onApprove"
          >
            <VIcon
              start
              icon="bx-check"
              size="16"
            />
            주문 승인
          </VBtn>
          <VBtn
            v-if="canReject"
            variant="flat"
            color="warning"
            size="small"
            :loading="isRejecting"
            @click="openRejectDialog"
          >
            <VIcon
              start
              icon="bx-x-circle"
              size="16"
            />
            주문 반려
          </VBtn>
          <VBtn
            variant="flat"
            color="error"
            size="small"
            :loading="loadingAction"
            @click="onDelete"
          >
            <VIcon
              start
              icon="bx-trash"
              size="16"
            />
            주문 삭제
          </VBtn>
        </div>
      </div>
    </div>

    <!-- 메인 그리드(페이지는 스크롤 없음, 카드 내부만 스크롤) -->
    <div class="order-grid">
      <!-- 주문 상세 테이블 -->
      <VCard class="order-detail-card">
        <VCardTitle class="text-subtitle-2 text-high-emphasis d-flex align-center">
          <VIcon
            icon="bx-package"
            size="18"
            class="me-2"
          /> 주문 상세
          <VSpacer />
        </VCardTitle>

        <div class="card-scroll">
          <VDataTable
            :headers="headers"
            :items="lineItems"
            :loading="loading"
            density="default"
            hide-default-footer
            class="erp-table"
            item-value="productName"
            fixed-header
          >
            <template #item.productName="{ item }">
              <div class="d-flex gap-x-3 align-center">
                <VAvatar
                  v-if="item.image"
                  size="28"
                  variant="tonal"
                  rounded
                  :image="item.image"
                  :title="item.productName || '이미지 보기'"
                />
                <div
                  class="d-flex flex-column align-start cursor-pointer"
                  @click="$router.push({ name: 'part-detail-id', params: { id: item.productId } })"
                >
                  <span class="text-body-2 font-weight-medium">{{ item.productName }}</span>
                  <span class="text-caption text-medium-emphasis">{{ item.subtitle }}</span>
                </div>
              </div>
            </template>
            <template #item.price="{ item }">
              <span class="text-body-2">₩{{ fmtCurrency(item.price) }}</span>
            </template>
            <template #item.total="{ item }">
              <span class="text-body-2 font-weight-medium">₩{{ fmtCurrency(item.total) }}</span>
            </template>
            <template #item.quantity="{ item }">
              <span class="text-body-2">{{ item.quantity }}</span>
            </template>
          </VDataTable>
        </div>

        <VDivider />
        <div class="px-4 py-3 d-flex justify-end">
          <table class="text-high-emphasis sum-table">
            <tbody>
              <tr><td>공급가액</td><td>₩{{ fmtCurrency(supplyAmount) }}</td></tr>
              <tr><td>부가세액</td><td>₩{{ fmtCurrency(vatAmount) }}</td></tr>
              <tr><td>배송비</td><td>₩0</td></tr>
              <tr class="em">
                <td>합계금액</td><td>₩{{ fmtCurrency(totalAmount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </VCard>

      <!-- 통합 정보 카드 -->
      <VCard class="info-card">
        <VCardText class="">
          <!-- 주문자 정보 -->
          <div class="info-section">
            <div class="info-row">
              <div class="info-label">
                주문자
              </div>
              <div class="info-content">
                <div class="d-flex align-center gap-x-3">
                  <div>
                    <div class="text-body-2 font-weight-medium">
                      {{ customerInfo.name }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <VDivider class="my-3" />
          <div class="info-section">
            <div class="info-row">
              <div class="info-label">
                이메일
              </div>
              <div class="info-content">
                <div class="d-flex align-center gap-x-3">
                  <div>
                    <div class="text-caption text-medium-emphasis">
                      {{ customerInfo.email }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <VDivider class="my-3" />

          <!-- 배송 주소 -->
          <div class="info-section">
            <div class="info-row">
              <div class="info-label">
                배송 주소
              </div>
              <div class="info-content">
                <div
                  class="text-body-2"
                  style="white-space: pre-line;"
                >
                  {{ customerInfo.address }}
                </div>
              </div>
            </div>
          </div>

          <!-- 요청사항 (있는 경우만) -->
          <div class="info-section">
            <VDivider class="my-3" />
            <div class="info-row">
              <div class="info-label">
                요청사항
              </div>
              <div
                v-if="summary.etc"
                class="info-content"
              >
                <div
                  class="text-body-2"
                  style="white-space: pre-line;"
                >
                  {{ summary.etc }}
                </div>
              </div>
            </div>
          </div>
        </VCardText>
      </VCard>

      <!-- 배송 현황 -->
      <VCard class="shipping-card">
        <VCardText class="pt-2 card-scroll">
          <VTimeline
            line-inset="9"
            side="end"
            density="compact"
            line-color="primary"
          >
            <VTimelineItem
              v-for="(st, i) in timelineSteps"
              :key="st.key + i"
              :dot-color="st.dotColor"
              size="x-small"
            >
              <div class="d-flex justify-space-between align-center">
                <div class="text-body-2 font-weight-medium">
                  {{ st.title }}
                  <span
                    v-if="st.state === 'done' || st.state === 'current'"
                    class="text-medium-emphasis"
                  > • 진행</span>
                </div>
                <div
                  v-if="st.state === 'current'"
                  class="text-caption text-medium-emphasis"
                >
                  {{ st.date ? new Date(st.date).toLocaleString() : '' }}
                </div>
              </div>
            </VTimelineItem>
          </VTimeline>
        </VCardText>
      </VCard>
    </div>

    <!-- 반려 다이얼로그 -->
    <VDialog
      v-model="showRejectDialog"
      max-width="500"
      persistent
    >
      <VCard>
        <VCardTitle class="text-h6">
          <VIcon
            start
            icon="bx-x-circle"
            color="error"
          />
          주문 반려
        </VCardTitle>
        
        <VCardText>
          <p class="text-body-2 mb-4">
            주문을 반려하시겠습니까? 반려 사유를 입력해주세요.
          </p>
          
          <VTextarea
            v-model="rejectReason"
            label="반려 사유"
            placeholder="반려 사유를 입력해주세요..."
            rows="4"
            variant="outlined"
            :disabled="isRejecting"
            :rules="[v => !!v || '반려 사유는 필수입니다']"
            required
          />
        </VCardText>
        
        <VCardActions class="justify-end">
          <VBtn
            variant="text"
            :disabled="isRejecting"
            @click="closeRejectDialog"
          >
            취소
          </VBtn>
          <VBtn
            color="error"
            variant="flat"
            :loading="isRejecting"
            :disabled="!rejectReason.trim()"
            @click="onReject"
          >
            반려하기
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
/* ===== 페이지 레벨: 스크롤 가능 ===== */
.page-container.order-detail-page {
  display: flex;
  flex-direction: column;
}

.compact-header { 
  padding: 0px 24px 0px 24px; 
  flex-shrink: 0;
}

/* ===== 메인 그리드 ===== */
.order-grid {
  flex: 1;
  padding-top: 16px;
  display: grid;
  grid-template-columns: 1.4fr 1fr;     /* 좌-우 폭 비율 조정 */
  grid-template-rows: auto 1fr;   /* 우측 카드 세로 배치 */
  grid-template-areas:
    "table  info"
    "table  shipping";
  gap: 16px;
  min-height: 0; /* 그리드 스크롤 허용 */
  max-height: 80vh;

}

/* 그리드 영역 매핑 */
.order-detail-card { 
  grid-area: table;    
  padding: 16px;  
  min-height: 0; 
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--erp-border-light);
}

.info-card { 
  grid-area: info; 
  padding: 16px;  
  height: 28vh; /* 고정 높이 */
  min-height: 0; 
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--erp-border-light);
  display: flex;
  flex-direction: column;
}

.shipping-card { 
  grid-area: shipping; 
  padding: 16px;  
  height: 47vh; /* 고정 높이 */
  min-height: 0; 
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--erp-border-light);
  display: flex;
  flex-direction: column;
}

/* 통합 정보 카드 스타일 */
.info-section {
  margin-bottom: 12px;
}

/* 좌우 레이아웃 스타일 */
.info-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.info-label {
  min-width: 80px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--erp-text-secondary);
  flex-shrink: 0;
}

.info-content {
  flex: 1;
  display: flex;
  align-items: center;
}

/* 카드 내부 스크롤 전용 클래스 */
.card-scroll {
  max-height: none;
  overflow: visible;
  flex: 1;
  overflow-y: auto;
}

/* 정보 카드 내부 스크롤 */
.info-card .v-card-text {
  flex: 1;
  padding: 13px;
}

/* 배송 현황 카드 내부 스크롤 */
.shipping-card .v-card-text {
  flex: 1;
  overflow-y: auto;
  padding: 13px;
}

/* 테이블: 카드 안에서만 스크롤 */
.erp-table :deep(.v-table__wrapper) { 
  max-height: 52vh; 
  overflow: auto; 
  border-radius: 8px;
}

.erp-table :deep(th), .erp-table :deep(td) { 
  padding: 8px 12px; 
  font-size: 0.875rem;
}

.erp-table :deep(.v-table__head th) {
  background: var(--erp-bg-tertiary);
  color: var(--erp-text-secondary);
  font-weight: 600;
  border-bottom: 1px solid var(--erp-border-light);
}

.erp-table :deep(.v-table__body tr:hover) {
  background: var(--erp-bg-secondary);
}

/* 합계 테이블 개선 */
.sum-table { 
  border-collapse: separate;
  border-spacing: 0;
}

.sum-table td { 
  padding: 3px 0 3px 16px; 
  font-size: 0.75rem;
}

.sum-table td:first-child { 
  color: var(--erp-text-secondary); 
  width: 100px; 
  font-weight: 500;
}

.sum-table td:last-child { 
  text-align: right;
  font-weight: 600;
  color: var(--erp-text-primary);
}

.sum-table tr.em td:first-child, 
.sum-table tr.em td:last-child { 
  font-weight: 700; 
  font-size: 0.8rem;
}

/* 상태 칩 개선 */
.status-chip { 
  font-weight: 600; 
  font-size: 0.75rem; 
  letter-spacing: 0.025em;
}

.reject-message-chip {
  font-weight: 600;
  font-size: 0.75rem;
  letter-spacing: 0.025em;
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 테이블 간격 개선 */
.erp-table :deep(.v-table__body tr) {
  height: 90px !important;
}

.erp-table :deep(.v-table__body td) {
  padding: 18px 20px !important;
  vertical-align: middle !important;
}

.erp-table :deep(.v-table__body tr:hover) {
  background-color: var(--erp-bg-secondary) !important;
}

/* 제품명 컬럼 텍스트 간격 개선 */
.erp-table :deep(.v-table__body .d-flex.flex-column) {
  gap: 4px !important;
}

.erp-table :deep(.v-table__body .d-flex.gap-x-3) {
  gap: 12px !important;
}

/* 반응형 */
@media (max-width: 1200px) {
  .order-grid {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto;
    grid-template-areas:
      "table table"
      "info shipping";
    gap: 12px;
    padding: 12px 16px 20px 16px;
  }
  
  .compact-header {
    padding: 10px 16px 6px 16px;
  }
}

@media (max-width: 768px) {
  .order-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    grid-template-areas:
      "table"
      "info"
      "shipping";
    gap: 12px;
    padding: 12px 12px 20px 12px;
  }
  
  .compact-header {
    padding: 8px 12px 4px 12px;
  }
  
  .erp-table :deep(.v-table__wrapper) {
    max-height: 200px;
  }
}
</style>
