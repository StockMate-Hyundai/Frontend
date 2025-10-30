<script setup>
import { getOrderListByMemberId } from '@/api/order'
import { ORDER_STATUS, resolveOrderStatus } from '@/utils/orderStatus'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

/* ==========================
   상태
========================== */
const searchQuery = ref('')
const selectedStatus = ref()

// Data table options
const itemsPerPage = ref(10)
const page = ref(1)
const sortBy = ref()
const orderBy = ref()
const isLoading = ref(false)

const updateOptions = options => {
  sortBy.value = options.sortBy[0]?.key
  orderBy.value = options.sortBy[0]?.order
}

/* ==========================
   테이블 헤더 (서버 필드와 동일한 key)
========================== */
const headers = [
  { title: 'No.',            key: 'orderNumber' },
  { title: '상태',       key: 'orderStatus', sortable: false },
  { title: '금액',        key: 'totalPrice' },
  { title: '주문일',  key: 'createdAt' },
  { title: '비고',      key: 'actions', sortable: false },
]

/* ==========================
   멤버 ID (유저 디테일 [id]에서 사용)
========================== */
const route = useRoute()
const memberId = computed(() => Number(route.params.id))

/* ==========================
   서버 데이터
========================== */
const tableState = ref({ rows: [], total: 0 })

function formatCurrencyKRW(n) {
  const v = Number(n ?? 0)
  
  return `₩${v.toLocaleString()}`
}
function formatDateTime(s) {
  // createdAt이 ISO면 그대로 표시하거나 필요 시 포맷터 사용
  return s.split("T")[0] ?? ''
}

const fetchInvoices = async () => {
  isLoading.value = true
  try {
    const serverPage = Math.max(0, Number(page.value) - 1)
    const serverSize = itemsPerPage.value === -1 ? 1000 : (Number(itemsPerPage.value) || 20)

    // const dto = await fetchOrdersForTable({
    //   page: serverPage,
    //   size: serverSize,
    //   q: (searchQuery.value || '').trim(),
    //   status: selectedStatus.value || '',
    //   sortBy: sortBy.value,
    //   orderBy: orderBy.value,
    //   memberId: memberId.value,
    // })

    const dto = await getOrderListByMemberId({ memberId: memberId.value, page: serverPage, size: serverSize })
    const content = Array.isArray(dto?.content) ? dto.content : []
    const total   = Number(dto?.totalElements ?? content.length)

    // ✅ 서버 필드명 그대로 매핑
    const rows = content.map(o => ({
      orderNumber: o.orderNumber ?? o.id ?? o.orderId,
      orderId: o.orderId ?? 0,
      orderStatus: o.orderStatus ?? o.status ?? ORDER_STATUS.PENDING_SHIPPING,
      totalPrice: o.totalPrice ?? o.total ?? o.totalAmount ?? 0,
      createdAt: o.createdAt ?? o.orderedAt ?? '',

      // 필요하면 추가: customerName, memo 등
      raw: o,
    }))

    tableState.value = { rows, total }
  } catch (e) {
    console.error('[fetchInvoices] error:', e)
    tableState.value = { rows: [], total: 0 }
  } finally {
    isLoading.value = false
  }
}

/* ==========================
   computed / watch
========================== */
const invoices = computed(() => tableState.value.rows)
const totalInvoices = computed(() => tableState.value.total)

watch(
  [searchQuery, selectedStatus, itemsPerPage, page, sortBy, orderBy, memberId],
  fetchInvoices,
  { deep: true },
)

await fetchInvoices()

/* ==========================
   표시 유틸 (주문 상태용)
========================== */
// resolveOrderStatus는 utils/orderStatus.js에서 통합 관리

const computedMoreList = computed(() => {
  return orderNo => [
    { title: 'Download',  value: 'download',  prependIcon: 'bx-download' },
    { title: 'Edit',      value: 'edit',      prependIcon: 'bx-pencil', to: { name: 'order-detail-id', params: { id: orderNo } } },
    { title: 'Duplicate', value: 'duplicate', prependIcon: 'bx-duplicate' },
  ]
})

const deleteInvoice = async id => {
  console.warn('주문 삭제 API 연결 필요: deleteInvoice(id)')
  await fetchInvoices()
}
</script>

<template>
  <section v-if="invoices">
    <div id="invoice-list">
      <!-- SECTION Datatable -->
      <div class="table-scroll">
        <VDataTableServer
          v-model:items-per-page="itemsPerPage"
          v-model:page="page"
          :loading="isLoading"
          :items-length="totalInvoices"
          :headers="headers"
          :items="invoices"
          item-value="orderNumber"
          class="text-no-wrap text-sm rounded-0 erp-table"
          @update:options="updateOptions"
        >
          <!-- orderNumber -->
          <template #item.orderNumber="{ item }">
            <RouterLink :to="{ name: 'order-detail-id', params: { id: item.orderId } }">
              #{{ item.orderNumber }}
            </RouterLink>
          </template>

          <!-- orderStatus -->
          <template #item.orderStatus="{ item }">
            <VTooltip>
              <template #activator="{ props }">
                <VAvatar
                  :size="28"
                  v-bind="props"
                  :color="resolveOrderStatus(item.orderStatus).color"
                  variant="tonal"
                >
                  <VIcon
                    :size="16"
                    :icon="resolveOrderStatus(item.orderStatus).icon"
                  />
                </VAvatar>
              </template>
              <p class="mb-0">
                {{ resolveOrderStatus(item.orderStatus).text }}
              </p>
            </VTooltip>
          </template>

          <!-- totalPrice -->
          <template #item.totalPrice="{ item }">
            {{ formatCurrencyKRW(item.totalPrice) }}
          </template>

          <!-- createdAt -->
          <template #item.createdAt="{ item }">
            {{ formatDateTime(item.createdAt) }}
          </template>

          <!-- Actions -->
          <template #item.actions="{ item }">
            <!--
              <IconBtn @click="deleteInvoice(item.orderNumber)">
              <VIcon icon="bx-trash" />
              </IconBtn> 
            -->

            <IconBtn :to="{ name: 'order-detail-id', params: { id: item.orderId } }">
              <VIcon icon="bx-show" />
            </IconBtn>

            <MoreBtn
              :menu-list="computedMoreList(item.orderId)"
              item-props
              class="text-medium-emphasis"
            />
          </template>
        </VDataTableServer>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
#invoice-list {
  .invoice-list-actions { inline-size: 8rem; }
  .invoice-list-search  { inline-size: 12rem; }
}

/* 테이블 스크롤 컨테이너 */
.table-scroll {
  max-height: 73vh;
  overflow-y: auto;
  border-radius: 8px;
}

/* 테이블 스타일 개선 */
.erp-table :deep(.v-table__wrapper) { 
  max-height: none; 
  overflow: visible; 
  border-radius: 8px;
  border: none; /* 외곽 border 제거 */
}

.erp-table :deep(.v-data-table) {
  border: none; /* 데이터 테이블 border 제거 */
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

/* 테이블 간격 개선 */
.erp-table :deep(.v-table__body tr) {
  height: 60px !important;
}

.erp-table :deep(.v-table__body td) {
  padding: 12px 16px !important;
  vertical-align: middle !important;
}

.erp-table :deep(.v-table__body tr:hover) {
  background-color: var(--erp-bg-secondary) !important;
}
</style>
