<!-- File: src/views/user/view/UserTabStock.vue -->
<script setup>
import { getStorePartsList } from '@/api/parts'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  userData: { type: Object, required: true },
})

const router = useRouter()
const itemsPerPage = ref(20)
const page = ref(1)
const tableLoading = ref(false)
const stocksData = ref({ content: [], totalElements: 0, totalPages: 0 })

const headers = [
  { title: 'ID', key: 'id', width: '3%' },
  { title: '부품', key: 'product', width: '50%' },
  { title: '카테고리', key: 'categoryName', width: '14%' },
  { title: '재고', key: 'stock', width: '12%' },
  { title: '최소수량', key: 'limitAmount', width: '14%' },
]

async function loadStocks() {
  if (!props.userData?.memberId) return
  tableLoading.value = true
  try {
    const res = await getStorePartsList(props.userData.memberId, {
      page: page.value - 1,
      size: itemsPerPage.value,
    })

    stocksData.value = res
  } catch (e) {
    console.error('[UserTabStock] loadStocks error:', e)
    stocksData.value = { content: [], totalElements: 0, totalPages: 0 }
  } finally {
    tableLoading.value = false
  }
}

const stocks = computed(() => stocksData.value.content || [])
const totalStocks = computed(() => stocksData.value.totalElements)
const fmtCurrency = v => (v ?? v === 0) ? new Intl.NumberFormat('ko-KR').format(v) : '-'

onMounted(loadStocks)
watch([page, itemsPerPage], loadStocks)
watch(() => props.userData?.memberId, loadStocks)
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
          :items="stocks"
          :items-length="totalStocks"
          class="erp-table"
          density="compact"
        >
          <template #item.id="{ item }">
            <span class="id-text">{{ item.id || '-' }}</span>
          </template>

          <template #item.product="{ item }">
            <div class="d-flex align-center gap-x-3">
              <VAvatar
                v-if="item.image"
                size="28"
                variant="tonal"
                rounded
                :image="item.image"
                class="cursor-pointer"
                @click="router.push({ name: 'part-detail-id', params: { id: item.id } })"
              />
              <VAvatar
                v-else
                size="28"
                variant="tonal"
                color="secondary"
                class="cursor-pointer"
                @click="router.push({ name: 'part-detail-id', params: { id: item.id } })"
              >
                <VIcon
                  icon="bx-package"
                  size="18"
                />
              </VAvatar>
              <div
                class="d-flex flex-column cursor-pointer"
                @click="router.push({ name: 'part-detail-id', params: { id: item.id } })"
              >
                <span class="text-body-2 font-weight-medium">
                  {{ item.korName || item.engName || item.name || '이름 없음' }}
                </span>
                <span
                  v-if="item.model || item.trim"
                  class="text-caption text-medium-emphasis"
                >
                  {{ [item.model, item.trim].filter(Boolean).join(' / ') }}
                </span>
              </div>
            </div>
          </template>

          <template #item.categoryName="{ item }">
            <span class="category-text">{{ item.categoryName || '-' }}</span>
          </template>

          <template #item.stock="{ item }">
            <span class="stock-text">{{ item.amount ?? 0 }}</span>
          </template>

          <template #item.limitAmount="{ item }">
            <span class="limit-text">-</span>
          </template>

          <template #item.price="{ item }">
            <span class="price-text">₩{{ fmtCurrency(item.price) }}</span>
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
}

.erp-table :deep(.v-table th) {
  font-size: 12px;
  font-weight: 600;
  padding: 8px 12px;
}

.erp-table :deep(.v-table td) {
  padding: 8px 12px;
  font-size: 13px;
}

.id-text { font-size: 13px; color: rgb(var(--v-theme-on-surface)); font-family: monospace; }
.category-text { font-size: 13px; }
.stock-text { font-size: 13px; font-weight: 500; }
.limit-text { font-size: 13px; }
.price-text { font-size: 13px; font-weight: 500; }
.cursor-pointer { cursor: pointer; }
</style>

