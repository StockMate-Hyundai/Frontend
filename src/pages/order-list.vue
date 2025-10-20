<script setup>
import { cancelOrder as apiCancelOrder, deleteOrder as apiDeleteOrder, fetchOrdersForTable, ORDER_STATUS } from '@/api/order'
import { computed, onMounted, ref, watch } from 'vue'

/* ========== 위젯 (그대로) ========== */
const widgetData = ref([
  { title: '총 주문', value: 56, icon: 'bx-calendar' },
  { title: '새로운 주문', value: 12689, icon: 'bx-check-double' },
  { title: '배송중', value: 124, icon: 'bx-wallet' },
  { title: '취소', value: 32, icon: 'bx-error-alt' },
])

/* ========== 테이블 상태 ========== */
const itemsPerPage  = ref(10)
const page          = ref(1)
const sortBy        = ref()
const orderBy       = ref()
const selectedRows  = ref([])
const tableLoading  = ref(false)

const updateOptions = options => {
  sortBy.value  = options.sortBy[0]?.key
  orderBy.value = options.sortBy[0]?.order
}

/* ========== 헤더 ========== */
const headers = [
  { title: 'No.',       key: 'orderNumber' },
  { title: '주문일자',  key: 'createdAt' },
  { title: '고객',      key: 'customers' },
  { title: '상태',      key: 'orderStatus' },
  { title: '총가격',    key: 'totalPrice' },
  { title: 'Action',    key: 'actions', sortable: false },
]

/* ========== 상태 칩 (한글 라벨) ========== */
const resolveOrderStatus = s => {
  switch (s) {
  case ORDER_STATUS.ORDER_COMPLETED:  return { text: '주문 완료',  color: 'primary' }
  case ORDER_STATUS.PENDING_SHIPPING: return { text: '출고 대기',  color: 'warning' }
  case ORDER_STATUS.SHIPPING:         return { text: '배송중',    color: 'info' }
  case ORDER_STATUS.REJECTED:         return { text: '출고 반려',  color: 'error' }
  case ORDER_STATUS.DELIVERED:        return { text: '배송 완료',  color: 'success' }
  case ORDER_STATUS.RECEIVED:         return { text: '입고 완료',  color: 'secondary' }
  case ORDER_STATUS.CANCELLED:        return { text: '주문 취소',  color: 'error' }
  default:                            return { text: '연동 대기',  color: 'default' }
  }
}

/* ========== 공통 필터 → API 필터 상태 ========== */
/** AppPartsFilters가 enableStatus/enableDate를 기준으로
 *  { status?, startDate?, endDate? } 형태만 보내줌 */
const currentFilters = ref({}) // { status, startDate, endDate } (필요 시 memberId/partId 추가)

/* ========== 데이터 로딩 ========== */
const ordersData = ref({ rows: [], total: 0, page: 1 })

async function loadOrders () {
  tableLoading.value = true
  try {
    const res = await fetchOrdersForTable({
      page: page.value,
      itemsPerPage: itemsPerPage.value,
      filters: currentFilters.value,
    })

    console.log(res)
    ordersData.value = res
  } finally {
    tableLoading.value = false
  }
}

onMounted(loadOrders)
watch([page, itemsPerPage], loadOrders)

/* ========== 표시 매핑 ========== */
const avatarText = name =>
  (name ?? '?').trim().split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase()

const orders = computed(() =>
  (ordersData.value.rows ?? []).map(it => {
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
  }),
)

const totalOrder = computed(() => ordersData.value.total)

/* ========== 액션 ========== */
const deleteOrder = async orderId => {
  await apiDeleteOrder(orderId)

  const i = selectedRows.value.findIndex(v => v === orderId)
  if (i !== -1) selectedRows.value.splice(i, 1)
  await loadOrders()
}

const cancelOrder = async orderId => {
  await apiCancelOrder(orderId)
  await loadOrders()
}

/* ========== 포맷터 ========== */
const fmtDate = d => !d ? '-' : new Date(d).toLocaleDateString()
const fmtCurrency = v => (v ?? v === 0) ? new Intl.NumberFormat().format(v) : '-'

/* ========== 필터 핸들러 (공통 → 주문 API) ========== */
function handleSearch(payload) {
  // payload: { status?, memberId?, partId?, startDate?, endDate? } 중 켜진 것만 옴
  currentFilters.value = { ...payload }
  page.value = 1
  loadOrders()
}
</script>

<template>
  <div>
    <!-- 위젯 -->
    <!--
      <VCard class="mb-6">
      <VCardText class="px-3">
      <VRow>
      <template
      v-for="(data, id) in widgetData"
      :key="id"
      >
      <VCol
      cols="12"
      sm="6"
      md="3"
      class="px-6"
      >
      <div
      class="d-flex justify-space-between"
      :class="$vuetify.display.xs
      ? id !== widgetData.length - 1 ? 'border-b pb-4' : ''
      : $vuetify.display.sm
      ? id < (widgetData.length / 2) ? 'border-b pb-4' : ''
      : ''"
      >
      <div class="d-flex flex-column">
      <h4 class="text-h4">
      {{ data.value }}
      </h4>
      <div class="text-body-1">
      {{ data.title }}
      </div>
      </div>
      <VAvatar
      variant="tonal"
      rounded
      size="42"
      >
      <VIcon
      :icon="data.icon"
      size="24"
      class="text-high-emphasis"
      />
      </VAvatar>
      </div>
      </VCol>

      <VDivider
      v-if="$vuetify.display.mdAndUp ? id !== widgetData.length - 1
      : $vuetify.display.smAndUp ? id % 2 === 0
      : false"
      vertical
      inset
      length="60"
      />
      </template>
      </VRow>
      </VCardText>
      </VCard> 
    -->

    <!-- ✅ 공통 필터: 주문 페이지용으로 필요한 것만 ON -->
    <AppPartsFilters
      page-type="orders"
      :loading="tableLoading"
      :enable-categories="false"
      :enable-trim="false"
      :enable-model="false"
      :enable-member="false"
      :enable-part="false"
      :enable-status="true"
      :enable-date="true"
      :status-options="[
        { label: '주문 완료', value: 'ORDER_COMPLETED' },
        { label: '출고 대기', value: 'PENDING_SHIPPING' },
        { label: '배송중', value: 'SHIPPING' },
        { label: '출고 반려', value: 'REJECTED' },
        { label: '배송 완료', value: 'DELIVERED' },
        { label: '입고 완료', value: 'RECEIVED' },
        { label: '주문 취소', value: 'CANCELLED' },
      ]"
      @search="handleSearch"
    >
      <template #right>
        <div class="d-flex justify-sm-space-between justify-start flex-wrap gap-4">
          <div class="d-flex gap-x-4 align-center">
            <AppSelect
              v-model="itemsPerPage"
              style="min-inline-size: 6.25rem;"
              :items="[5, 10, 20, 50, 100]"
            />
            <VBtn
              variant="tonal"
              color="secondary"
              prepend-icon="bx-export"
              text="Export"
            />
          </div>
        </div>
      </template>
    </AppPartsFilters>
    <!-- 주문 테이블 -->
    <VCard>
      <!-- 상단 도구 -->
      <!--
        <VCardText>
        <div class="d-flex justify-sm-space-between justify-start flex-wrap gap-4">
        <div class="d-flex gap-x-4 align-center">
        <AppSelect
        v-model="itemsPerPage"
        style="min-inline-size: 6.25rem;"
        :items="[5, 10, 20, 50, 100]"
        />
        <VBtn
        variant="tonal"
        color="secondary"
        prepend-icon="bx-export"
        text="Export"
        />
        </div>
        </div>
        </VCardText> 
      -->

      <VDivider />

      <!-- 테이블 -->
      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:model-value="selectedRows"
        v-model:page="page"
        item-value="orderId"
        :headers="headers"
        :items="orders"
        :items-length="totalOrder"
        :loading="tableLoading"
        class="text-no-wrap"
        @update:options="updateOptions"
      >
        <template #item.orderNumber="{ item }">
          <RouterLink :to="{ name: 'order-detail-id', params: { id: item.orderId } }">
            #{{ item.orderNumber }}
          </RouterLink>
        </template>

        <template #item.createdAt="{ item }">
          {{ fmtDate(item.createdAt) }}
        </template>

        <template #item.customers="{ item }">
          <div class="d-flex align-center gap-x-3">
            <VAvatar
              size="34"
              :color="!item.avatar ? 'primary' : ''"
              :variant="!item.avatar ? 'tonal' : undefined"
            >
              <VImg
                v-if="item.avatar"
                :src="item.avatar"
              />
              <span
                v-else
                class="font-weight-medium"
              >{{ avatarText(item.customer) }}</span>
            </VAvatar>
            <div class="d-flex flex-column">
              <div class="text-body-1 font-weight-medium">
                {{ item.customer }}
              </div>
              <div class="text-body-2">
                {{ item.email }}
              </div>
            </div>
          </div>
        </template>

        <template #item.orderStatus="{ item }">
          <VChip
            v-bind="resolveOrderStatus(item.orderStatus)"
            label
            size="small"
          />
        </template>

        <template #item.totalPrice="{ item }">
          ₩ {{ fmtCurrency(item.totalPrice) }}원
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex align-center gap-1">
            <VTooltip text="Detail">
              <template #activator="{ props }">
                <VBtn
                  v-bind="props"
                  icon
                  size="small"
                  variant="text"
                  :to="{ name: 'order-detail-id', params: { id: item.orderId } }"
                >
                  <VIcon icon="bx-link-external" />
                </VBtn>
              </template>
            </VTooltip>

            <VTooltip text="Delete">
              <template #activator="{ props }">
                <VBtn
                  v-bind="props"
                  icon
                  size="small"
                  variant="text"
                  color="error"
                  @click="deleteOrder(item.orderId)"
                >
                  <VIcon icon="bx-trash" />
                </VBtn>
              </template>
            </VTooltip>
          </div>
        </template>

        <template #bottom>
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalOrder"
          />
        </template>
      </VDataTableServer>
    </VCard>
  </div>
</template>

<style lang="scss" scoped>
.customer-title:hover { color: rgba(var(--v-theme-primary)) !important; }
.product-widget { border-block-end: 1px solid rgba(var(--v-theme-on-surface), var(--v-border-opacity)); padding-block-end: 1rem; }
</style>
