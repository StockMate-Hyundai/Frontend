<!-- File: src/views/user/view/UserTabHistory.vue -->
<script setup>
import { getReceivingHistoryByMemberIdForAdmin } from '@/api/orderHistory'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  userData: { type: Object, required: true },
})

const router = useRouter()

const itemsPerPage = ref(20)
const page = ref(1)
const tableLoading = ref(false)
const historiesData = ref({ content: [], totalElements: 0, totalPages: 0 })

const headers = [
  { title: 'ID', key: 'id' },
  { title: '주문번호', key: 'orderNumber' },
  { title: '상태', key: 'status' },
  { title: '메시지', key: 'message' },
  { title: '등록일시', key: 'createdAt' },
]

async function loadHistories() {
  if (!props.userData?.memberId) return
  tableLoading.value = true
  try {
    const res = await getReceivingHistoryByMemberIdForAdmin(props.userData.memberId, {
      page: page.value - 1,
      size: itemsPerPage.value,
    })

    historiesData.value = res
  } catch (e) {
    console.error('[UserTabHistory] loadHistories error:', e)
    historiesData.value = { content: [], totalElements: 0, totalPages: 0 }
  } finally {
    tableLoading.value = false
  }
}

const histories = computed(() => historiesData.value.content || [])
const totalHistories = computed(() => historiesData.value.totalElements)

const fmtDateTime = s => {
  if (!s) return '-'
  const d = new Date(s)
  
  return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const resolveStatusLabel = s => ({ PENDING: '대기', APPROVED: '승인', REJECTED: '반려', COMPLETED: '완료', CANCELLED: '취소', RECEIVED: '입고', RELEASED: '출고' }[s] || s || '-')
const resolveStatusVariant = s => ({ PENDING: { color: 'warning' }, APPROVED: { color: 'info' }, REJECTED: { color: 'error' }, COMPLETED: { color: 'success' }, CANCELLED: { color: 'default' }, RECEIVED: { color: 'success' }, RELEASED: { color: 'error' } }[s] || { color: 'default' })

onMounted(loadHistories)
watch([page, itemsPerPage], loadHistories)
watch(() => props.userData?.memberId, loadHistories)
</script>

<template>
  <VRow>
    <VCol cols="12">
      <div class="table-scroll">
        <VDataTableServer
          v-model:items-per-page="itemsPerPage"
          v-model:page="page"
          :loading="tableLoading"
          :headers="headers"
          :items="histories"
          :items-length="totalHistories"
          class="erp-table"
          density="compact"
        >
          <template #item.id="{ item }">
            {{ item.id }}
          </template>

          <template #item.orderNumber="{ item }">
            <RouterLink :to="{ name: 'order-detail-id', params: { id: item.orderId || item.orderNumber } }">
              {{ item.orderNumber || '-' }}
            </RouterLink>
          </template>

          <template #item.status="{ item }">
            <VChip
              :color="resolveStatusVariant(item.status).color"
              size="x-small"
              variant="tonal"
            >
              {{ resolveStatusLabel(item.status) }}
            </VChip>
          </template>

          <template #item.message="{ item }">
            {{ item.message || '-' }}
          </template>

          <template #item.createdAt="{ item }">
            {{ fmtDateTime(item.createdAt) }}
          </template>
        </VDataTableServer>
      </div>
    </VCol>
  </VRow>
</template>

<style scoped>
.table-scroll {
  max-height: 75vh;
  overflow-y: auto;
}

.erp-table {
  height: 100% !important;
  font-size: 13px !important;
}
</style>

