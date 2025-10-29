<script setup>
definePage({
  meta: {
    title: '주문 목록',
    icon: 'bx-list-ul',
    requiresAuth: true,
  },
})

import { cancelOrder as apiCancelOrder, deleteOrder as apiDeleteOrder, fetchOrdersForTable, ORDER_STATUS } from '@/api/order'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import AppExportButton from '@/components/common/ExportToExcel.vue'

/* 엑셀 설정 */
const exportFilename = computed(() => {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  
  return `주문목록_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.xlsx`
})

const exportFields = [
  { key: 'orderId',       label: '주문ID' },
  { key: 'orderNumber',   label: '주문번호' },
  { key: 'createdAt',     label: '주문일자' },
  { key: 'customer',      label: '고객명' },
  { key: 'email',         label: '이메일' },
  { key: 'orderStatus',   label: '상태' },
  { key: 'totalPrice',    label: '총가격' },
]

const fmtDate = d => !d ? '-' : new Date(d).toLocaleDateString()
const fmtCurrency = v => (v ?? v === 0) ? new Intl.NumberFormat().format(v) : '-'

/* 내보내기용 변환 */
const exportTransform = row => ({
  orderId: row.orderId,
  orderNumber: row.orderNumber || `#${row.orderId}`,
  createdAt: fmtDate(row.createdAt),
  customer: row.customer,
  email: row.email,
  orderStatus: resolveOrderStatus(row.orderStatus).text,
  totalPrice: Number(row.totalPrice ?? 0),
})

const exportItemsCurrent = computed(() => orders.value)

/* 전체 데이터 수집 */
async function fetchAllForExport() {
  const first = await fetchOrdersForTable({
    page: 1,
    itemsPerPage: 100,
    filters: currentFilters.value,
  })

  const totalPages = Math.ceil(first.total / 100)
  let all = [...(first.rows ?? [])]

  for (let p = 2; p <= totalPages; p++) {
    const next = await fetchOrdersForTable({
      page: p,
      itemsPerPage: 100,
      filters: currentFilters.value,
    })

    all = all.concat(next.rows || [])
  }

  return all.map(it => {
    const u = it?.userInfo ?? {}
    const displayName = u.storeName || u.owner || u.email || '-'
    
    return {
      orderId: it.orderId,
      orderNumber: it.orderNumber || `#${it.orderId}`,
      createdAt: it.createdAt,
      orderStatus: it.orderStatus,
      totalPrice: it.totalPrice,
      customer: displayName,
      email: u.email || '',
      avatar: null,
      __raw: it,
    }
  })
}

/* 테이블 헤더 */
const headers = [
  { title: 'No.',       key: 'orderNumber' },
  { title: '주문일자',  key: 'createdAt' },
  { title: '고객',      key: 'customers' },
  { title: '주문내역',  key: 'orderItems' },
  { title: '상태',      key: 'orderStatus' },
  { title: '총가격',    key: 'totalPrice' },
  { title: 'Action',    key: 'actions', sortable: false },
]

/* 필터 상태 */
const filters = reactive({
  status: '',             // string (단일 선택)
  startDate: '',          // string
  endDate: '',            // string
})

/* 필터 토글 상태 */
const isFilterExpanded = ref(true)

/* 상태 선택지 */
const statusOptions = ref([
  { label: '주문 완료', value: 'ORDER_COMPLETED' },
  { label: '출고 대기', value: 'PENDING_SHIPPING' },
  { label: '배송중', value: 'SHIPPING' },
  { label: '주문 반려', value: 'REJECTED' },
  { label: '배송 완료', value: 'DELIVERED' },
  { label: '입고 완료', value: 'RECEIVED' },
  { label: '주문 취소', value: 'CANCELLED' },
])

function onSearch() {
  isFilterExpanded.value = false
  currentFilters.value = {
    status: filters.status || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
  }
  page.value = 1
  loadOrders()
}

function toggleStatus(s) {
  if (filters.status === s) {
    filters.status = '' // 같은 상태를 다시 클릭하면 선택 해제
  } else {
    filters.status = s // 다른 상태 선택
  }
}

function onReset() {
  filters.status = ''
  filters.startDate = ''
  filters.endDate = ''
  currentFilters.value = {}
  page.value = 1
  isFilterExpanded.value = true // 초기화 시 필터 토글 열기
  loadOrders()
}

/* 페이지네이션/정렬 */
const itemsPerPage = ref(20)
const page = ref(1)
const sortBy = ref()
const orderBy = ref()

const updateOptions = options => {
  sortBy.value = options.sortBy[0]?.key
  orderBy.value = options.sortBy[0]?.order
}

/* API 상태 */
const tableLoading = ref(false)
const ordersData = ref({ rows: [], total: 0, page: 1 })
const currentFilters = ref({})

async function loadOrders() {
  tableLoading.value = true
  try {
    const res = await fetchOrdersForTable({
      page: page.value,
      itemsPerPage: itemsPerPage.value,
      filters: currentFilters.value,
    })

    ordersData.value = res
  } catch (e) {
    console.error('[OrderList] loadOrders error:', e)
    ordersData.value = { rows: [], total: 0, page: 1 }
  } finally {
    tableLoading.value = false
  }
}

onMounted(loadOrders)
watch([page, itemsPerPage], loadOrders)

/* 화면 가공 */
const orders = computed(() => {
  const rows = (ordersData.value.rows ?? []).map(it => {
    const u = it?.userInfo ?? {}
    const displayName = u.storeName || u.owner || u.email || '-'
    
    return {
      orderId: it.orderId,
      orderNumber: it.orderNumber || `#${it.orderId}`,
      createdAt: it.createdAt,
      orderStatus: it.orderStatus,
      totalPrice: it.totalPrice,
      customer: displayName,
      email: u.email || '',
      avatar: null,
      __raw: it,
    }
  })

  let filtered = rows
  if (sortBy.value) {
    const key = sortBy.value
    const dir = orderBy.value === 'desc' ? -1 : 1

    filtered = [...filtered].sort((a, b) => {
      const va = a?.[key], vb = b?.[key]
      if (va == null && vb == null) return 0
      if (va == null) return -1 * dir
      if (vb == null) return  1 * dir
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      
      return String(va).localeCompare(String(vb)) * dir
    })
  }
  
  return filtered
})

/* 유틸 */
const totalOrder = computed(() => ordersData.value.total)

const resolveOrderStatus = s => {
  switch (s) {
  case ORDER_STATUS.ORDER_COMPLETED:  return { text: '주문 완료',  color: 'primary' }
  case ORDER_STATUS.PENDING_SHIPPING: return { text: '출고 대기',  color: 'warning' }
  case ORDER_STATUS.SHIPPING:         return { text: '배송중',    color: 'info' }
  case ORDER_STATUS.REJECTED:         return { text: '주문 반려',  color: 'error' }
  case ORDER_STATUS.DELIVERED:        return { text: '배송 완료',  color: 'success' }
  case ORDER_STATUS.RECEIVED:         return { text: '입고 완료',  color: 'secondary' }
  case ORDER_STATUS.CANCELLED:        return { text: '주문 취소',  color: 'error' }
  default:                            return { text: '연동 대기',  color: 'default' }
  }
}

/* 액션 */
const deleteOrder = async orderId => {
  await apiDeleteOrder(orderId)
  await loadOrders()
}

const cancelOrder = async orderId => {
  await apiCancelOrder(orderId)
  await loadOrders()
}

/* 표시 매핑 */
const avatarText = name =>
  (name ?? '?').trim().split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase()

/* 주문 내역 표시 함수들 */
const getFirstOrderItemName = item => {
  const orderItems = item.__raw?.orderItems || []
  if (orderItems.length === 0) return '주문내역 없음'
  
  const firstItem = orderItems[0]
  const partDetail = firstItem?.partDetail
  if (!partDetail) return '부품 정보 없음'
  
  // 한글명 우선, 없으면 영문명, 없으면 name
  return partDetail.korName || partDetail.engName || partDetail.name || '이름없음'
}

const getFirstOrderItemImage = item => {
  const orderItems = item.__raw?.orderItems || []
  if (orderItems.length === 0) return null
  
  const firstItem = orderItems[0]
  const partDetail = firstItem?.partDetail
  
  // 부품 이미지 URL 반환 (실제 API 구조에 맞게 조정 필요)
  return partDetail?.imageUrl || partDetail?.image || partDetail?.thumbnail || null
}

const getOrderItemsCount = item => {
  const orderItems = item.__raw?.orderItems || []
  
  return orderItems.length
}

const getOrderItemsCountText = item => {
  const count = getOrderItemsCount(item)
  if (count <= 1) return ''
  
  return `외 ${count - 1}건`
}
</script>

<template>
  <div class="page-container table-page">
    <!-- 필터 섹션 (고정) -->
    <div class="filter-section">
      <div class="d-flex align-center justify-space-between mb-0">
        <div class="d-flex align-center gap-3">
          <h6 class="text-h6 text-high-emphasis mb-0">
            주문 목록
          </h6>
          <VBtn
            size="small"
            variant="text"
            :icon="isFilterExpanded ? 'bx-chevron-up' : 'bx-chevron-down'"
            @click="isFilterExpanded = !isFilterExpanded"
          />
        </div>
        <div class="d-flex align-center gap-3" />
      </div>

      <VExpandTransition>
        <div
          v-show="isFilterExpanded"
          class="filter-content"
        >
          <div class="d-flex align-center gap-4 flex-wrap mb-3">
            <!-- 상태 필터 -->
            <div class="d-flex align-center gap-2">
              <span class="text-body-2 text-medium-emphasis filter-label">상태:</span>
              <div class="d-flex gap-1">
                <VChip
                  v-for="option in statusOptions"
                  :key="option.value"
                  size="small"
                  variant="tonal"
                  :color="filters.status === option.value ? 'primary' : undefined"
                  @click="toggleStatus(option.value)"
                >
                  {{ option.label }}
                </VChip>
              </div>
            </div>
          </div>

          <!-- 날짜 필터 -->
          <div class="d-flex align-center gap-4 flex-wrap mb-3">
            <div class="d-flex align-center gap-2">
              <span class="text-body-2 text-medium-emphasis filter-label">시작일:</span>
              <VTextField
                v-model="filters.startDate"
                type="date"
                size="small"
                variant="outlined"
                density="compact"
                style="width: 150px;"
              />
            </div>
            <div class="d-flex align-center gap-2">
              <span class="text-body-2 text-medium-emphasis filter-label">종료일:</span>
              <VTextField
                v-model="filters.endDate"
                type="date"
                size="small"
                variant="outlined"
                density="compact"
                style="width: 150px;"
              />
            </div>
          </div>
        </div>
      </VExpandTransition>

      <!-- 고정 버튼 영역 -->
      <div class="filter-actions">
        <VBtn
          color="primary"
          variant="flat"
          size="small"
          :loading="tableLoading"
          @click="onSearch"
        >
          검색
        </VBtn>
        <VBtn
          variant="tonal"
          size="small"
          @click="onReset"
        >
          초기화
        </VBtn>
      </div>
    </div>

    <!-- 테이블 컨테이너: 헤더/본문(스크롤)/푸터(고정) -->
    <div class="table-container">
      <!-- 테이블 헤더 (고정) -->
      <div class="table-header">
        <div class="d-flex align-center justify-space-between">
          <span>전체 {{ totalOrder }}건</span>
          <div class="d-flex align-center gap-2">
            <AppExportButton
              :items="exportItemsCurrent"
              :fields="exportFields"
              :filename="exportFilename"
              sheet-name="Orders"
              :fetch-all="fetchAllForExport"
              :transform="exportTransform"
              variant="text"
            />
            <VIcon
              icon="bx-refresh"
              size="16"
              class="cursor-pointer"
              @click="loadOrders"
            />
          </div>
        </div>
      </div>

      <!-- 테이블 본문 (여기만 스크롤) -->
      <div class="table-body">
        <VDataTableServer
          v-model:items-per-page="itemsPerPage"
          v-model:page="page"
          :headers="headers"
          :loading="tableLoading"
          :items="orders"
          :items-length="totalOrder"
          class="erp-table"
          @update:options="updateOptions"
        >
          <!-- 열 폭 -->
          <template #colgroup>
            <col style="width: 10%">
            <col style="width: 15%">
            <col style="width: 16%">
            <col style="width: 21%">
            <col style="width: 12%">
            <col style="width: 10%">
            <col style="width: 10%">
          </template>

          <template #item.orderNumber="{ item }">
            <RouterLink
              :to="{ name: 'order-detail-id', params: { id: item.orderId } }"
              class="text-primary font-weight-medium order-number-link"
            >
              #{{ item.orderNumber }}
            </RouterLink>
          </template>

          <template #item.createdAt="{ item }">
            <span class="text-body-2">{{ fmtDate(item.createdAt) }}</span>
          </template>

          <template #item.customers="{ item }">
            <div class="d-flex align-center gap-x-3">
              <VAvatar
                size="32"
                :color="!item.avatar ? 'primary' : ''"
                :variant="!item.avatar ? 'tonal' : undefined"
              >
                <VImg
                  v-if="item.avatar"
                  :src="item.avatar"
                />
                <span
                  v-else
                  class="font-weight-medium text-sm"
                >{{ avatarText(item.customer) }}</span>
              </VAvatar>
              <div class="d-flex flex-column">
                <span class="text-body-2 font-weight-medium text-high-emphasis">{{ item.customer }}</span>
                <span class="text-caption text-medium-emphasis">{{ item.email }}</span>
              </div>
            </div>
          </template>

          <template #item.orderItems="{ item }">
            <div class="d-flex align-center gap-2 order-items-cell">
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
                <span class="text-body-2 font-weight-medium text-high-emphasis order-item-name">
                  {{ getFirstOrderItemName(item) }}
                </span>
                <span class="text-caption text-medium-emphasis order-item-count">
                  {{ getOrderItemsCountText(item) }}
                </span>
              </div>
            </div>
          </template>

          <template #item.orderStatus="{ item }">
            <VChip
              v-bind="resolveOrderStatus(item.orderStatus)"
              size="small"
              variant="tonal"
            />
          </template>

          <template #item.totalPrice="{ item }">
            <span class="text-body-2 font-weight-medium">{{ fmtCurrency(item.totalPrice) }}원</span>
          </template>

          <template #item.actions="{ item }">
            <div class="d-flex align-center gap-1">
              <VTooltip text="상세보기">
                <template #activator="{ props }">
                  <VBtn
                    v-bind="props"
                    icon
                    size="small"
                    variant="text"
                    :to="{ name: 'order-detail-id', params: { id: item.orderId } }"
                  >
                    <VIcon
                      icon="bx-link-external"
                      size="16"
                    />
                  </VBtn>
                </template>
              </VTooltip>

              <VTooltip text="삭제">
                <template #activator="{ props }">
                  <VBtn
                    v-bind="props"
                    icon
                    size="small"
                    variant="text"
                    color="error"
                    @click="deleteOrder(item.orderId)"
                  >
                    <VIcon
                      icon="bx-trash"
                      size="16"
                    />
                  </VBtn>
                </template>
              </VTooltip>
            </div>
          </template>
        </VDataTableServer>
      </div>

      <!-- 페이지네이션 (하단 고정) -->
      <div class="table-footer">
        <div class="d-flex align-center justify-space-between">
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalOrder"
          />
        </div>
      </div>
    </div>

    <div class="page-bottom-margin" />
  </div>
</template>

<style scoped>
.cursor-pointer { cursor: pointer; }

/* ERP 테이블 스타일 */
.erp-table {
  height: 100% !important;
  min-height: 400px !important; /* 최소 높이 고정 */
}

.erp-table :deep(.v-table__wrapper) {
  height: 100% !important;
  min-height: 400px !important;
}

.erp-table :deep(.v-table) {
  height: 100% !important;
  min-height: 400px !important;
}

.erp-table :deep(.v-table__body) {
  height: calc(100% - 68px) !important; /* 헤더 높이 제외 */
  min-height: 352px !important;
}

/* 테이블 행 호버 효과 */
.erp-table :deep(.v-table__body tr:hover) {
  background: var(--erp-bg-secondary) !important;
  transform: none !important;
}

/* 스크롤바 커스터마이징 */
.table-body {
  scrollbar-width: thin;
  scrollbar-color: var(--erp-border-medium) var(--erp-bg-secondary);
}

.table-body::-webkit-scrollbar {
  width: 6px;
}

.table-body::-webkit-scrollbar-track {
  background: var(--erp-bg-secondary);
}

.table-body::-webkit-scrollbar-thumb {
  background: var(--erp-border-medium);
  border-radius: 3px;
}

.table-body::-webkit-scrollbar-thumb:hover {
  background: var(--erp-secondary);
}

/* 테이블 푸터 고정 */
.table-footer {
  flex-shrink: 0;
  background: var(--erp-bg-secondary);
  border-top: 1px solid var(--erp-border-light);
  padding: 12px 24px;
}

/* 페이지 하단 마진 */
.page-bottom-margin {
  height: 24px;
  background: var(--erp-bg-primary);
}

/* 필터 섹션 */
.filter-section {
  padding: 14px 24px !important;
}
.filter-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 2px;
}
.filter-content { margin-bottom: 4px !important; }

/* 주문번호 스타일 */
.order-number-link {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  max-width: 100%;
}

/* 주문 내역 셀 스타일 */
.order-items-cell {
  min-width: 0;
  overflow: hidden;
  width: 100%;
}

.order-items-content {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.order-item-name {
  flex-shrink: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.order-item-count {
  flex-shrink: 0;
  white-space: nowrap;
}

.order-items-image-container {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.order-item-image {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  object-fit: cover;
}

.order-items-badge {
  position: absolute;
  bottom: 12px;
  right: 7px;
  z-index: 1;
}

.order-items-badge :deep(.v-badge__badge) {
  font-size: 10px !important;
  min-width: 16px !important;
  height: 16px !important;
  padding: 0 4px !important;
  background-color: rgba(60, 60, 60, 0.8) !important;
  color: white !important;
}

/* (옵션) 헤더 고정이 필요하면 함께 사용하세요 */
.erp-table :deep(thead th) {
  position: sticky;
  top: 0;
  z-index: 3;
  background: var(--erp-bg-primary);
}
</style>
