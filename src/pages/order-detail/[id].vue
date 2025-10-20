<!-- File: src/pages/order-detail/[id].vue -->
<script setup>
import { cancelOrder as apiCancelOrder, deleteOrder as apiDeleteOrder, getOrderDetail } from '@/api/order'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/* 라우팅 */
const route  = useRoute()
const router = useRouter()
const orderId = computed(() => String(route.params.id ?? ''))

/* 상태 칩 매핑 (더 직관적인 컬러) */
const STATUS_UI = {
  ORDER_COMPLETED: { key: 'ORDER_COMPLETED',   text: '주문 완료',  color: 'primary' },
  PENDING_SHIPPING: { key: 'PENDING_SHIPPING',  text: '출고 대기',  color: 'warning' },
  SHIPPING: { key: 'SHIPPING',          text: '배송중',    color: 'info' },
  DELIVERED: { key: 'DELIVERED',         text: '배송 완료',  color: 'success' },
  RECEIVED: { key: 'RECEIVED',          text: '입고 완료',  color: 'secondary' },
  REJECTED: { key: 'REJECTED',          text: '출고 반려',  color: 'error' },
  CANCELLED: { key: 'CANCELLED',         text: '주문 취소',  color: 'secondary' },
}

const resolveOrderStatus = s => STATUS_UI[s] ?? { text: '연동 대기', color: 'default' }

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
})

const customerInfo = ref({
  name: '-',
  email: '-',
  idLabel: `Order ID: ${orderId.value}`,
  ordersCount: 0,
  address: '-',
})

const lineItems = ref([])

/* 유틸 */
const fmtCurrency = v => (v ?? v === 0) ? new Intl.NumberFormat().format(v) : '-'

const avatarText = name =>
  (name ?? '?').trim().split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase()

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
      const trimTxt  = pd?.trim  ? ` / ${pd.trim}`  : ''
      const modelTxt = pd?.model ? ` / ${pd.model}` : ''
      const price = pd?.price ?? 0
      const qty = x?.amount ?? 0

      return {
        image: pd?.image || null,                         // ✅ 썸네일
        productName: name,
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

/* 액션 */
const loadingAction = ref(false)
async function onCancel() {
  if (!orderId.value) return
  loadingAction.value = true
  try {
    await apiCancelOrder(Number(orderId.value))
    alert('주문이 취소되었습니다.')
    await loadDetail()
  } catch (e) {
    console.log(e)
    alert(e?.message || '취소 중 오류가 발생했습니다.')
  } finally {
    loadingAction.value = false
  }
}
async function onDelete() {
  if (!orderId.value) return
  loadingAction.value = true
  try {
    await apiDeleteOrder(Number(orderId.value))
    alert('주문이 삭제되었습니다.')
    router.back()
  } catch (e) {
    alert(e?.message || '삭제 중 오류가 발생했습니다.')
  } finally {
    loadingAction.value = false
  }
}

/* 표 헤더 */
const headers = [
  { title: '제품명',  key: 'productName' },
  { title: '가격',    key: 'price' },
  { title: '개수', key: 'quantity' },
  { title: '총합',    key: 'total' },
]

/* =============== Shipping Activity 타임라인 =============== */
/** 메인 플로우(성공 경로) */
const FLOW = ['ORDER_COMPLETED', 'PENDING_SHIPPING', 'SHIPPING', 'DELIVERED', 'RECEIVED']

/** 상태 → 타임라인 항목 생성기 */
const timelineSteps = computed(() => {
  const s = summary.value
  const current = String(s.status || '')
  const idx = FLOW.indexOf(current)
  const rejected = current === 'REJECTED'
  const cancelled = current === 'CANCELLED'

  // 날짜 매핑(있으면 표시)
  const dateMap = {
    ORDER_COMPLETED: s.createdAt || null,
    PENDING_SHIPPING: s.requestedShippingDate || null,
    SHIPPING: s.shippingDate || null,
    DELIVERED: null, // 스펙에 별도 전달 안됨
    RECEIVED: null, // 스펙에 별도 전달 안됨
  }

  const steps = FLOW.map((k, i) => ({
    key: k,
    title: STATUS_UI[k].text,
    date: dateMap[k],
    state: i < idx ? 'done' : i === idx ? 'current' : 'todo',
    dotColor: i < idx ? 'primary' : i === idx ? 'primary' : 'secondary',
  }))

  // 분기 처리(반려/취소)
  if (rejected || cancelled) {
    steps.push({
      key: current,
      title: STATUS_UI[current].text,
      date: null,
      state: 'current',
      dotColor: STATUS_UI[current].color,
    })
  }

  return steps
})
</script>

<template>
  <div>
    <!-- 에러 -->
    <VAlert
      v-if="errorMsg"
      type="error"
      class="mb-4"
      variant="tonal"
    >
      {{ errorMsg }}
    </VAlert>

    <!-- 상단 타이틀/상태/버튼 -->
    <div class="d-flex justify-space-between align-center flex-wrap gap-y-4 mb-6">
      <div>
        <div class="d-flex gap-2 align-center mb-1 flex-wrap">
          <h5 class="text-h5">
            주문 #{{ summary.orderNumber }}
          </h5>
          <VChip
            v-bind="resolveOrderStatus(summary.status)"
            variant="tonal"
            label
            size="small"
          />
        </div>
        <div class="text-body-1">
          {{ summary.createdAt ? new Date(summary.createdAt).toLocaleString() : '-' }}
        </div>
      </div>

      <div class="d-flex gap-3">
        <VBtn
          variant="tonal"
          color="warning"
          :loading="loadingAction"
          @click="onCancel"
        >
          주문 취소
        </VBtn>
        <VBtn
          variant="tonal"
          color="error"
          :loading="loadingAction"
          @click="onDelete"
        >
          주문 삭제
        </VBtn>
      </div>
    </div>

    <VRow>
      <!-- 좌: 주문 상세 -->
      <VCol
        cols="12"
        md="8"
      >
        <VCard class="mb-6">
          <VCardItem>
            <template #title>
              <h5 class="text-h5">
                주문 상세
              </h5>
            </template>
          </VCardItem>
          <VDivider />

          <VDataTable
            :headers="headers"
            :items="lineItems"
            :loading="loading"
            item-value="productName"
            class="text-no-wrap"
          >
            <template #item.productName="{ item }">
              <div class="d-flex gap-x-3 align-center">
                <!-- ✅ 썸네일/이니셜 -->
                <VAvatar
                  v-if="item.image"
                  size="38"
                  variant="tonal"
                  rounded
                  :image="item.image"
                  :title="item.productName || '이미지 보기'"
                />
                <div class="d-flex flex-column align-start">
                  <h6 class="text-h6">
                    {{ item.productName }}
                  </h6>
                  <span class="text-body-2">{{ item.subtitle }}</span>
                </div>
              </div>
            </template>

            <template #item.price="{ item }">
              <div class="text-body-1">
                ₩{{ fmtCurrency(item.price) }}
              </div>
            </template>
            <template #item.total="{ item }">
              <div class="text-body-1">
                ₩{{ fmtCurrency(item.total) }}
              </div>
            </template>
            <template #item.quantity="{ item }">
              <div class="text-body-1">
                {{ item.quantity }}
              </div>
            </template>

            <template #bottom />
          </VDataTable>

          <VDivider />
          <VCardText>
            <div class="d-flex align-end flex-column">
              <table class="text-high-emphasis">
                <tbody>
                  <tr>
                    <td width="200px">
                      총합:
                    </td>
                    <td class="font-weight-medium">
                      ₩{{ fmtCurrency(lineItems.reduce((s, i) => s + (i.total || 0), 0)) }}
                    </td>
                  </tr>
                  <tr>
                    <td>배송비:</td>
                    <td class="font-weight-medium">
                      ₩0
                    </td>
                  </tr>
                  <tr>
                    <td>세금:</td>
                    <td class="font-weight-medium">
                      ₩0
                    </td>
                  </tr>
                  <tr>
                    <td class="text-high-emphasis font-weight-medium">
                      결제금액:
                    </td>
                    <td class="font-weight-medium">
                      ₩{{ fmtCurrency(summary.totalPrice) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </VCardText>
        </VCard>

        <!-- ✅ Shipping Activity -->
        <VCard>         
          <template #title>
            <h5 class="text-h5">
              배송 현황
            </h5>
          </template>
          <VCardText>
            <VTimeline
              truncate-line="both"
              line-inset="9"
              side="end"
              line-color="primary"
              density="compact"
            >
              <VTimelineItem
                v-for="(st, i) in timelineSteps"
                :key="st.key + i"
                :dot-color="st.dotColor"
                size="x-small"
              >
                <div class="d-flex justify-space-between align-center">
                  <div class="app-timeline-title">
                    {{ st.title }}
                    <span v-if="st.state === 'done' || st.state === 'current'"> • 진행</span>
                  </div>
                  <div class="app-timeline-meta">
                    {{ st.date ? new Date(st.date).toLocaleString() : '' }}
                  </div>
                </div>
                <p class="app-timeline-text mb-0 mt-3">
                  <span v-if="st.key === 'ORDER_COMPLETED'">주문이 접수되었습니다.</span>
                  <span v-else-if="st.key === 'PENDING_SHIPPING'">출고 준비 중입니다.</span>
                  <span v-else-if="st.key === 'SHIPPING'">배송이 시작되었습니다.</span>
                  <span v-else-if="st.key === 'DELIVERED'">배송이 완료되었습니다.</span>
                  <span v-else-if="st.key === 'RECEIVED'">입고가 완료되었습니다.</span>
                  <span v-else-if="st.key === 'REJECTED'">출고가 반려되었습니다.</span>
                  <span v-else-if="st.key === 'CANCELLED'">주문이 취소되었습니다.</span>
                </p>
              </VTimelineItem>
            </VTimeline>
          </VCardText>
        </VCard>
      </VCol>

      <!-- 우: 고객/청구/배송지 -->
      <VCol
        cols="12"
        md="4"
      >
        <VCard class="mb-6">
          <VCardText class="d-flex flex-column gap-y-6">
            <h5 class="text-h5">
              주문자
            </h5>

            <div class="d-flex align-center gap-x-3">
              <VAvatar
                size="40"
                variant="tonal"
                :rounded="1"
              >
                <span class="font-weight-medium">{{ avatarText(customerInfo.name) }}</span>
              </VAvatar>
              <div>
                <h6 class="text-h6">
                  {{ customerInfo.name }}
                </h6>
                <div class="text-body-1">
                  {{ customerInfo.idLabel }}
                </div>
              </div>
            </div>

            <div class="d-flex gap-x-3 align-center">
              <VAvatar
                variant="tonal"
                color="success"
              >
                <VIcon icon="bx-cart" />
              </VAvatar>
              <h6 class="text-h6">
                주문 {{ customerInfo.ordersCount }} 번
              </h6>
            </div>

            <div class="d-flex flex-column gap-y-1">
              <div class="d-flex justify-space-between align-center" />
              <span>이메일  {{ customerInfo.email }}</span>
              <span>휴대전화   -</span>
            </div>
          </VCardText>
        </VCard>

        <VCard class="mb-6">
          <VCardItem>
            <VCardTitle>주소</VCardTitle>
          </VCardItem>
          <VCardText>
            <div
              class="text-body-1"
              style="white-space: pre-line;"
            >
              {{ customerInfo.address }}
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

<style scoped>
/* 필요시 커스텀 스타일 */
</style>
