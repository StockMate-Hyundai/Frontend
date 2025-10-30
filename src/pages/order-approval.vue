<!-- File: src/pages/order-approval.vue -->
<script setup>
definePage({
  meta: {
    title: '주문 승인',
    icon: 'bx-check-circle',
    requiresAuth: true,
  },
})
import TablePagination from '@/@core/components/TablePagination.vue'
import { getOrderList } from '@/api/order'
import { ORDER_STATUS } from '@/utils/orderStatus'
import { executeOrderApproval } from '@/api/websocket'
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

/* 라우팅 */
const router = useRouter()

/* 상태/데이터 */
const loading = ref(false)
const errorMsg = ref('')
const orders = ref([])
const totalItems = ref(0)
const page = ref(1)
const itemsPerPage = ref(20)

/* 승인/모달 상태 */
const approvingOrders = ref(new Set())          // 행별 로딩
const selectedOrders = ref([])                   // 체크된 주문 IDs
const showApprovalModal = ref(false)
const approvedOrderInfo = ref(null)
const showProcessingModal = ref(false)
const processingOrderInfo = ref(null)
const currentProcessingMessage = ref('')
const processingStep = ref('')                   // CONNECTING | PROCESSING | BATCH_* | COMPLETED | ERROR
const showConfirmButton = ref(false)
const currentProcessingOrderId = ref(null)

/* 일괄 승인 진행률 */
const batchProgress = ref({
  current: 0,
  total: 0,
  percentage: 0,
  failedOrders: [],
  failedMessages: [],
  isBatchMode: false,
})

/* 유틸 */
const fmtCurrency = v => (v ?? v === 0) ? new Intl.NumberFormat().format(v) : '-'
const avatarText = name => (name ?? '?').trim().split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase()

/* 테이블 헤더 */
const headers = [
  { title: '선택', key: 'select', sortable: false, width: '50px' },
  { title: '주문번호', key: 'orderNumber', sortable: false },
  { title: '주문일자', key: 'createdAt', sortable: false },
  { title: '고객', key: 'customer', sortable: false },
  { title: '주문내역', key: 'orderItems', sortable: false },
  { title: '총가격', key: 'totalPrice', sortable: false },
  { title: '승인', key: 'approve', sortable: false, width: '100px' },
]

/* ==============
   에러/성공 판정
=============== */
// ❗ 이제는 STOCK_DEDUCTION 은 "진행중"으로 취급 (에러 아님)
function isErrorPayload(p) {
  return (
    p?.type === 'ORDER_APPROVAL_RESPONSE' &&
    (p?.step === 'ERROR' || p?.status === ORDER_STATUS.REJECTED)
  )
}
function isCompletedPayload(p) {
  // 최종 성공 신호: step === COMPLETED (status: PENDING_SHIPPING)
  return (
    p?.type === 'ORDER_APPROVAL_RESPONSE' &&
    p?.step === 'COMPLETED'
  )
}

/* 주문 목록 로드 */
async function loadOrders() {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await getOrderList({
      status: ORDER_STATUS.PAY_COMPLETED,
      page: page.value,
      size: itemsPerPage.value,
    })

    const sortedContent = (data.content || []).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))

    orders.value = sortedContent
    totalItems.value = data.totalElements || 0
  } catch (e) {
    errorMsg.value = e?.message || '주문 목록 조회 중 오류가 발생했습니다.'
  } finally {
    loading.value = false
  }
}

/* 1건 승인 Promise (내부) */
function processOne(orderId, isBatchMode) {
  if (approvingOrders.value.has(orderId)) return Promise.resolve()

  approvingOrders.value.add(orderId)

  // 단건 모달 세팅
  if (!isBatchMode) {
    const order = orders.value.find(o => o.orderId === orderId)

    currentProcessingOrderId.value = orderId
    processingOrderInfo.value = {
      orderNumber: order?.orderNumber || orderId,
      customer: order?.customer?.name || '알 수 없음',
    }
    currentProcessingMessage.value = '웹소켓 연결 중...'
    processingStep.value = 'CONNECTING'
    showConfirmButton.value = false
    showProcessingModal.value = true
  }

  return new Promise(async (resolve, reject) => {
    let done = false

    const safeReject = err => {
      if (done) return
      done = true
      approvingOrders.value.delete(orderId)
      if (!isBatchMode && currentProcessingOrderId.value === orderId) {
        currentProcessingMessage.value = err?.message || '승인 처리 중 오류가 발생했습니다.'
        processingStep.value = 'ERROR'
        showConfirmButton.value = true
      }
      reject(err instanceof Error ? err : new Error(String(err?.message || err)))
    }

    const safeResolve = data => {
      if (done) return
      done = true
      approvingOrders.value.delete(orderId)

      if (!isBatchMode && currentProcessingOrderId.value === orderId) {
        const order = orders.value.find(o => o.orderId === orderId)

        showProcessingModal.value = false
        showApprovalModal.value = true
        approvedOrderInfo.value = {
          orderNumber: order?.orderNumber || orderId,
          customer: order?.customer?.name || '알 수 없음',
        }
        loadOrders()
        currentProcessingOrderId.value = null
      }
      resolve(data)
    }

    try {
      await executeOrderApproval(
        orderId,

        // onMessage
        data => {
          if (done) return

          // 혹시 다른 주문 메시지 섞임 방지
          if (data?.orderId && data.orderId !== orderId) return

          // 실패
          if (isErrorPayload(data)) {
            return safeReject(new Error(data?.message || '승인 실패'))
          }

          // 최종 성공
          if (isCompletedPayload(data)) {
            return safeResolve(data)
          }

          // 중간 진행(예: STOCK_DEDUCTION)
          if (!isBatchMode) {
            if (processingStep.value === 'ERROR' || processingStep.value === 'COMPLETED' || showConfirmButton.value) return
            currentProcessingMessage.value = data?.message || '승인 처리 중...'
            processingStep.value = 'PROCESSING'
          }
        },

        // onError
        error => {
          safeReject(error)
        },

        // onComplete (서버가 COMPLETED 후 자동 disconnect 라도 보호 차원)
        finalData => {
          // onMessage에서 COMPLETED를 잡아 resolve하므로 여기선 보조
          if (!done) safeResolve(finalData)
        },
      )
    } catch (e) {
      safeReject(e)
    }
  })
}

/* 단건/일괄 공통 실행 */
async function runApproval(orderIds = []) {
  const ids = (orderIds && orderIds.length ? orderIds : selectedOrders.value).slice()
  if (ids.length === 0) return

  // 오래된 순
  const sortedIds = ids
    .map(id => orders.value.find(o => o.orderId === id))
    .filter(Boolean)
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    .map(o => o.orderId)

  const isBatch = sortedIds.length > 1

  processingOrderInfo.value = {
    orderNumber: isBatch
      ? `${sortedIds.length}건 일괄 승인`
      : (orders.value.find(o => o.orderId === sortedIds[0])?.orderNumber || sortedIds[0]),
    customer: isBatch
      ? '일괄 처리'
      : (orders.value.find(o => o.orderId === sortedIds[0])?.customer?.name || '알 수 없음'),
  }
  currentProcessingMessage.value = isBatch ? '일괄 승인을 시작합니다...' : '웹소켓 연결 중...'
  processingStep.value = isBatch ? 'BATCH_START' : 'CONNECTING'
  showConfirmButton.value = false
  showProcessingModal.value = true

  batchProgress.value = {
    current: 0,
    total: sortedIds.length,
    percentage: 0,
    failedOrders: [],
    failedMessages: [],
    isBatchMode: isBatch,
  }

  let completedCount = 0
  let errorCount = 0

  for (let i = 0; i < sortedIds.length; i++) {
    const orderId = sortedIds[i]
    try {
      // 진행률
      batchProgress.value.current = i + 1
      batchProgress.value.percentage = Math.round(((i + 1) / sortedIds.length) * 100)

      const order = orders.value.find(o => o.orderId === orderId)

      processingOrderInfo.value = {
        orderNumber: order?.orderNumber || orderId,
        customer: order?.customer?.name || '알 수 없음',
      }
      currentProcessingMessage.value = isBatch ? `승인 중... (${i + 1}/${sortedIds.length})` : '승인 처리 중...'
      processingStep.value = isBatch ? 'BATCH_PROCESSING' : 'PROCESSING'

      await processOne(orderId, isBatch)
      completedCount++
      if (isBatch) await new Promise(r => setTimeout(r, 150))
    } catch (e) {
      errorCount++

      const order = orders.value.find(o => o.orderId === orderId)
      const orderNumber = order?.orderNumber || orderId

      batchProgress.value.failedOrders.push(orderNumber)
      batchProgress.value.failedMessages.push(e?.message || '알 수 없는 오류')
    }
  }

  // 배치 요약
  if (isBatch) {
    if (errorCount === 0) {
      currentProcessingMessage.value = `모든 주문이 성공적으로 승인되었습니다. (${completedCount}건 완료)`
      processingStep.value = 'COMPLETED'
    } else {
      const failedOrderNumbers = batchProgress.value.failedOrders.join(', ')
      const failedMessages = batchProgress.value.failedMessages.join('\n')

      currentProcessingMessage.value =
        `일괄 승인이 완료되었습니다. (성공: ${completedCount}건, 실패: ${errorCount}건)\n` +
        `실패한 주문: ${failedOrderNumbers}\n\n에러 내용:\n${failedMessages}`
      processingStep.value = 'ERROR'
    }
    showConfirmButton.value = true
    await loadOrders()
    batchProgress.value.isBatchMode = false
  }
}

/* 선택 토글 */
function toggleSelectAll() {
  if (selectedOrders.value.length === orders.value.length) selectedOrders.value = []
  else selectedOrders.value = orders.value.map(order => order.orderId)
}
function toggleSelect(orderId) {
  const i = selectedOrders.value.indexOf(orderId)
  if (i > -1) selectedOrders.value.splice(i, 1)
  else selectedOrders.value.push(orderId)
}

/* 주문 상세 이동 */
function viewOrderDetail(orderId) {
  router.push({ name: 'order-detail-id', params: { id: orderId } })
}

/* 주문내역 표시 */
function getFirstOrderItemName(order) {
  const orderItems = order?.orderItems || []
  if (orderItems.length === 0) return '주문내역 없음'
  const firstItem = orderItems[0]
  const partDetail = firstItem?.partDetail
  if (!partDetail) return '부품 정보 없음'
  
  return partDetail.korName || partDetail.engName || partDetail.name || '이름없음'
}

function getFirstOrderItemImage(order) {
  const orderItems = order?.orderItems || []
  if (orderItems.length === 0) return null
  const firstItem = orderItems[0]
  const partDetail = firstItem?.partDetail
  
  // 부품 이미지 URL 반환 (실제 API 구조에 맞게 조정 필요)
  return partDetail?.imageUrl || partDetail?.image || partDetail?.thumbnail || null
}

function getOrderItemsCount(order) {
  return (order?.orderItems || []).length
}

function getOrderItemsCountText(order) {
  const count = getOrderItemsCount(order)
  if (count <= 1) return ''
  
  return `외 ${count - 1}건`
}

/* 모달 */
function closeApprovalModal() {
  showApprovalModal.value = false
  approvedOrderInfo.value = null
  loadOrders()
}
function closeProcessingModal() {
  showProcessingModal.value = false
  processingOrderInfo.value = null
  currentProcessingMessage.value = ''
  processingStep.value = ''
  showConfirmButton.value = false
  batchProgress.value.isBatchMode = false
  loadOrders()
}

/* 라이프사이클 */
onMounted(loadOrders)
watch([page, itemsPerPage], loadOrders, { deep: true })
</script>

<template>
  <div class="page-container table-page">
    <VAlert
      v-if="errorMsg"
      type="error"
      class="mb-2"
      variant="tonal"
    >
      {{ errorMsg }}
    </VAlert>

    <div class="filter-section ">
      <div class="d-flex justify-space-between align-center">
        <h6 class="text-subtitle-1 text-high-emphasis mb-1">
          주문 승인 관리
        </h6>
        <div class="d-flex gap-2">
          <VBtn
            v-if="selectedOrders.length > 0"
            variant="flat"
            color="success"
            size="small"
            :disabled="selectedOrders.some(id => approvingOrders.has(id))"
            @click="runApproval"
          >
            <VIcon
              start
              icon="bx-check"
              size="16"
            /> 선택 승인 ({{ selectedOrders.length }})
          </VBtn>
          <VBtn
            variant="flat"
            color="primary"
            size="small"
            @click="loadOrders"
          >
            <VIcon
              start
              icon="bx-refresh"
              size="16"
            /> 새로고침
          </VBtn>
        </div>
      </div>
    </div>

    <div class="table-header">
      <div class="text-caption text-medium-emphasis">
        총 {{ totalItems }}건의 주문이 승인 대기 중입니다
      </div>
    </div>

    <div class="table-container">
      <div class="table-body">
        <VDataTableServer
          v-model:items-per-page="itemsPerPage"
          v-model:page="page"
          :headers="headers"
          :items="orders"
          :items-length="totalItems"
          :loading="loading"
          class="erp-table"
          item-value="orderId"
          fixed-header
        >
          <template #colgroup>
            <col style="width: 50px">
            <col style="width: 12%">
            <col style="width: 12%">
            <col style="width: 18%">
            <col style="width: 30%">
            <col style="width: 12%">
            <col style="width: 100px">
          </template>

          <template #item.select="{ item }">
            <VCheckbox
              :model-value="selectedOrders.includes(item.orderId)"
              @update:model-value="toggleSelect(item.orderId)"
            />
          </template>

          <template #item.orderNumber="{ item }">
            <RouterLink
              :to="{ name: 'order-detail-id', params: { id: item.orderId } }"
              class="text-primary text-decoration-none font-weight-medium"
            >
              {{ item.orderNumber }}
            </RouterLink>
          </template>

          <template #item.createdAt="{ item }">
            <span class="text-body-2">{{ item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-' }}</span>
          </template>

          <template #item.customer="{ item }">
            <div class="d-flex align-center gap-x-3">
              <VAvatar
                size="32"
                variant="tonal"
                :rounded="1"
              >
                <span class="font-weight-medium text-body-2">
                  {{ avatarText(item.userInfo?.storeName || item.userInfo?.owner || item.userInfo?.email) }}
                </span>
              </VAvatar>
              <div>
                <div class="text-body-2 font-weight-medium">
                  {{ item.userInfo?.storeName || item.userInfo?.owner || item.userInfo?.email || '-' }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ item.userInfo?.email || '-' }}
                </div>
              </div>
            </div>
          </template>

          <template #item.orderItems="{ item }">
            <div class="d-flex align-center gap-x-3 order-items-cell">
              <div class="order-items-image-container">
                <VImg
                  v-if="getFirstOrderItemImage(item)"
                  :src="getFirstOrderItemImage(item)"
                  :alt="getFirstOrderItemName(item)"
                  class="order-item-image"
                />
                <VAvatar
                  v-else
                  size="32"
                  variant="tonal"
                  color="primary"
                >
                  <VIcon
                    icon="bx-package"
                    size="16"
                  />
                </VAvatar>
                <VBadge
                  v-if="getOrderItemsCount(item) > 1"
                  :content="`+${getOrderItemsCount(item) - 1}`"
                  color="primary"
                  class="order-items-badge"
                />
              </div>
              <div class="order-items-content">
                <span class="text-body-2 font-weight-medium order-item-name">{{ getFirstOrderItemName(item) }}</span>
                <span class="text-caption text-medium-emphasis order-item-count">{{ getOrderItemsCountText(item) }}</span>
              </div>
            </div>
          </template>

          <template #item.totalPrice="{ item }">
            <span class="text-body-2 font-weight-medium">₩{{ fmtCurrency(item.totalPrice) }}</span>
          </template>

          <template #item.approve="{ item }">
            <VBtn
              variant="flat"
              color="success"
              size="x-small"
              :loading="approvingOrders.has(item.orderId)"
              :disabled="approvingOrders.has(item.orderId)"
              @click="runApproval([item.orderId])"
            >
              <VIcon
                start
                icon="bx-check"
                size="14"
              /> 승인
            </VBtn>
          </template>

          <template #header.select>
            <VCheckbox
              :model-value="selectedOrders.length === orders.length && orders.length > 0"
              :indeterminate="selectedOrders.length > 0 && selectedOrders.length < orders.length"
              @update:model-value="toggleSelectAll"
            />
          </template>
        </VDataTableServer>
      </div>

      <div class="table-footer">
        <TablePagination
          v-model:page="page"
          v-model:items-per-page="itemsPerPage"
          :total-items="totalItems"
        />
      </div>
    </div>

    <div class="page-bottom-margin" />

    <!-- 승인 완료 모달 -->
    <VDialog
      v-model="showApprovalModal"
      max-width="400"
      persistent
    >
      <VCard>
        <VCardTitle class="text-center pa-6">
          <VIcon
            icon="bx-check-circle"
            color="success"
            size="48"
            class="mb-3"
          />
          <div class="text-h6 text-success">
            주문 승인 완료
          </div>
        </VCardTitle>
        <VCardText class="text-center pa-6 pt-0">
          <div class="text-body-1">
            주문이 성공적으로 승인되었습니다.
          </div>
        </VCardText>
        <VCardActions class="justify-center pa-6 pt-0">
          <VBtn
            color="success"
            variant="flat"
            size="large"
            @click="closeApprovalModal"
          >
            확인
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- 승인 처리 중 모달 -->
    <VDialog
      v-model="showProcessingModal"
      max-width="400"
      persistent
    >
      <VCard>
        <VCardTitle class="text-center pa-6">
          <VProgressCircular
            v-if="!showConfirmButton"
            indeterminate
            color="primary"
            size="48"
            width="4"
            class="mb-3"
          />
          <VIcon
            v-else-if="processingStep === 'COMPLETED'"
            icon="bx-check-circle"
            color="success"
            size="48"
            class="mb-3"
          />
          <VIcon
            v-else-if="processingStep === 'ERROR'"
            icon="bx-error-circle"
            color="error"
            size="48"
            class="mb-3"
          />
          <div
            class="text-h6"
            :class="processingStep === 'COMPLETED' ? 'text-success' : processingStep === 'ERROR' ? 'text-error' : 'text-primary'"
          >
            {{ processingStep === 'COMPLETED' ? '주문 승인이 완료되었습니다' : processingStep === 'ERROR' ? '승인 처리 오류' : '주문 승인 처리 중' }}
          </div>
        </VCardTitle>

        <VCardText class="text-center pa-6 pt-0">
          <div
            v-if="batchProgress.isBatchMode && !showConfirmButton"
            class="mb-4"
          >
            <div class="text-body-2 mb-2">
              {{ batchProgress.current }}/{{ batchProgress.total }}개 처리 중 ({{ batchProgress.percentage }}%)
            </div>
            <VProgressLinear
              :model-value="batchProgress.percentage"
              color="primary"
              height="8"
              rounded
              class="mb-2"
            />
          </div>

          <div
            class="text-body-1 mb-4"
            style="white-space: pre-line;"
          >
            {{ currentProcessingMessage }}
          </div>
          <div
            v-if="!showConfirmButton && !batchProgress.isBatchMode"
            class="text-body-2 text-medium-emphasis"
          >
            잠시만 기다려주세요...
          </div>
        </VCardText>

        <VCardActions
          v-if="showConfirmButton"
          class="justify-center pa-6 pt-0"
        >
          <VBtn
            color="primary"
            variant="flat"
            size="large"
            @click="closeProcessingModal"
          >
            확인
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.table-container { display: flex; flex-direction: column; height: calc(100vh - 180px); padding: 0 24px; }
.table-body { flex: 1; min-height: 0; overflow: hidden; }
.erp-table :deep(.v-table__wrapper) { height: 100%; max-height: 100%; overflow: auto; }
.erp-table :deep(.v-table__body tr:hover) { background-color: var(--erp-bg-secondary) !important; }
 .order-items-cell { min-width: 0; overflow: hidden; width: 100%; }
 .order-items-content { min-width: 0; flex: 1; overflow: hidden; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
 .order-item-name { flex-shrink: 1; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
 .order-item-count { flex-shrink: 0; white-space: nowrap; }
 .order-items-image-container { position: relative; width: 32px; height: 32px; flex-shrink: 0; }
 .order-item-image { width: 32px; height: 32px; border-radius: 6px; object-fit: cover; }
 .order-items-badge { position: absolute; bottom: 12px; right: 7px; z-index: 1; }
 .order-items-badge :deep(.v-badge__badge) { 
   font-size: 10px !important; 
   min-width: 16px !important; 
   height: 16px !important; 
   padding: 0 4px !important;
   background-color: rgba(60, 60, 60, 0.8) !important;
   color: white !important;
 }
.erp-table :deep(.v-table__body)::-webkit-scrollbar { width: 6px; }
.erp-table :deep(.v-table__body)::-webkit-scrollbar-track { background: var(--erp-bg-secondary); border-radius: 3px; }
.erp-table :deep(.v-table__body)::-webkit-scrollbar-thumb { background: var(--erp-border-medium); border-radius: 3px; }
.erp-table :deep(.v-table__body)::-webkit-scrollbar-thumb:hover { background: var(--erp-secondary); }
.page-bottom-margin { height: 48px; flex-shrink: 0; background: var(--erp-bg-primary); }
.filter-section { padding: 14px 24px !important; }
</style>
