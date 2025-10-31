<!-- File: src/pages/branch-stock-list.vue -->
<script setup>
import { getProfile } from '@/api/http'
import { getBranchList, getStorePartsList } from '@/api/parts'
import AppExportButton from '@/components/common/ExportToExcel.vue'
import { useResponsiveLeftSidebar } from '@core/composable/useResponsiveSidebar'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { PerfectScrollbar } from 'vue3-perfect-scrollbar'

definePage({
  meta: { title: '지점별 재고 조회', icon: 'bx-store', requiresAuth: true },
})

/* =========================
   권한/레이아웃
========================= */
const userRole = computed(() => (getProfile().role || 'USER').toUpperCase())
const isAdmin = computed(() => ['ADMIN', 'SUPER_ADMIN'].includes(userRole.value))
const { isLeftSidebarOpen } = useResponsiveLeftSidebar()
const router = useRouter()

/* =========================
   엑셀
========================= */
const exportFilename = computed(() => {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  
  return `지점재고_${selectedBranch.value?.name || '전체'}_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}.xlsx`
})

const exportFields = [
  { key: 'id',           label: 'ID' },
  { key: 'korName',     label: '한글명' },
  { key: 'engName',     label: '영문명' },
  { key: 'name',        label: '이름' },
  { key: 'categoryName', label: '카테고리' },
  { key: 'trim',        label: '트림' },
  { key: 'model',       label: '모델' },
  { key: 'stock',       label: '재고' },
  { key: 'limitAmount', label: '최소수량' },
  { key: 'price',       label: '가격' },
  { key: 'isLack',      label: '부족여부' },
]

const exportTransform = row => {
  return {
    id: row.id || '-',
    korName: row.korName || '-',
    engName: row.engName || '-',
    name: row.name || '-',
    categoryName: row.categoryName || '-',
    trim: row.trim || '-',
    model: row.model || '-',
    stock: row.stock ?? row.amount ?? 0,
    limitAmount: row.limitAmount ?? 0,
    price: row.price ?? 0,
    isLack: row.isLack ? '부족' : '정상',
  }
}

const exportItemsCurrent = computed(() => stocks.value)

/* =========================
   공통 유틸 (API 언래핑)
========================= */
const unwrap = r => (r && r.data) ? r.data : r

const unwrapList = r => {
  const d = unwrap(r) || {}
  
  return {
    content: d.content || [],
    totalElements: d.totalElements ?? 0,
    totalPages: d.totalPages ?? 0,
    currentPage: d.currentPage ?? 0,
    pageSize: d.pageSize ?? 0,
    last: d.last ?? true,
  }
}

/* =========================
   헤더
========================= */
const headers = computed(() => [
  { title: 'ID',        key: 'id', width: '6%' },
  { title: '부품',      key: 'product', width: '50%' },
  { title: '카테고리',  key: 'categoryName', width: '12%' },
  { title: '재고',      key: 'stock', width: '10%' },
  { title: '최소수량',  key: 'limitAmount', width: '12%' },
  { title: '가격',      key: 'price', width: '10%' },
])

/* =========================
   필터/지점
========================= */
const branches = ref([])
const selectedBranch = ref(null)
const branchLoading = ref(false)

async function loadBranches() {
  if (!isAdmin.value) return
  branchLoading.value = true
  try {
    const list = unwrap(await getBranchList()) || []

    branches.value = list.filter(b => b.id) // '전체' 제거, 실제 지점만 표시
    if (branches.value.length && !selectedBranch.value) {
      selectedBranch.value = branches.value[0]
    }
  } catch (e) {
    console.error('[BranchStock] loadBranches error:', e)
    branches.value = []
  } finally {
    branchLoading.value = false
  }
}

function selectBranch(b) {
  if (!b) return
  selectedBranch.value = b
  page.value = 1
  loadStocks()
}

/* =========================
   페이지네이션 / 데이터
========================= */
const itemsPerPage = ref(20)
const page = ref(1)

const tableLoading = ref(false)
const stocksData = ref({ content: [], totalElements: 0, totalPages: 0 })

async function loadStocks() {
  tableLoading.value = true
  try {
    let res
    if (isAdmin.value && selectedBranch.value?.id) {
      // 관리자이고 특정 지점 선택 시: /api/v1/parts/list/{storeId}

      res = await getStorePartsList(selectedBranch.value.id, {
        page: page.value - 1,
        size: itemsPerPage.value,
      })
    } 
    console.log(selectedBranch.value?.id, res)
    stocksData.value = unwrapList(res)
  } catch (e) {
    console.error('[BranchStock] loadStocks error:', e)
    stocksData.value = { content: [], totalElements: 0, totalPages: 0 }
  } finally {
    tableLoading.value = false
  }
}

onMounted(async () => {
  if (isAdmin.value) await loadBranches()
  await loadStocks()
})
watch([page, itemsPerPage, selectedBranch], () => loadStocks())

/* =========================
   화면 가공/표시
========================= */
const stocks = computed(() => {
  return (stocksData.value.content || []).map(item => ({
    ...item,
    __raw: item,
  }))
})

const totalStocks = computed(() => stocksData.value.totalElements)

const fmtCurrency = v => (v ?? v === 0) ? new Intl.NumberFormat('ko-KR').format(v) : '-'

/* =========================
   검색/리셋
========================= */
function onSearch() {
  page.value = 1
  loadStocks()
}

function onReset() {
  if (isAdmin.value && branches.value.length) selectedBranch.value = branches.value[0]
  page.value = 1
  loadStocks()
}

/* =========================
   엑셀 전체 수집
========================= */
async function fetchAllForExport() {
  if (!isAdmin.value || !selectedBranch.value?.id) {
    return []
  }

  let all = []
  let currentPage = 0
  while (true) {
    const res = await getStorePartsList(selectedBranch.value.id, { page: currentPage, size: 100 })
    const { content, last } = unwrapList(res)

    all = all.concat(content || [])
    if (last || (content || []).length === 0) break
    currentPage++
  }
  
  return all
}
</script>

<template>
  <div class="branch-stock-page">
    <!-- 상단: 제목 및 필터 -->
    <div class="page-header">
      <div class="header-top">
        <h6 class="page-title">
          지점별 재고 조회
        </h6>
      </div>
    </div>

    <!-- 하단: 좌측 지점 선택 + 우측 테이블 -->
    <div class="page-content">
      <!-- 좌측: 지점 선택 (관리자만) -->
      <div
        v-if="isAdmin"
        class="branch-selector"
      >
        <div class="branch-header">
          <span class="branch-title">지점</span>
        </div>
        <div class="branch-list-container">
          <PerfectScrollbar
            :options="{ wheelPropagation:false, suppressScrollX:true }"
            class="branch-list-scroll"
          >
            <div class="branch-list-content">
              <!-- 로딩 -->
              <div
                v-if="branchLoading"
                class="d-flex align-center justify-center py-8"
              >
                <VProgressCircular
                  indeterminate
                  color="primary"
                  size="20"
                />
              </div>

              <!-- 목록 -->
              <template v-else-if="branches.length">
                <div
                  v-for="b in branches"
                  :key="b.id ?? 'all'"
                  class="branch-item"
                  :class="{ selected: selectedBranch?.id === b.id }"
                  @click="selectBranch(b)"
                >
                  <div class="radio-dot" />
                  <span class="branch-name">{{ b.name }}</span>
                </div>
              </template>

              <!-- 빈 상태 -->
              <div
                v-else
                class="d-flex flex-column align-center justify-center py-8 text-center"
              >
                <VIcon
                  icon="bx-store"
                  size="32"
                  class="mb-2 text-medium-emphasis"
                />
                <div class="text-caption text-medium-emphasis">
                  지점 목록이 없습니다
                </div>
              </div>
            </div>
          </PerfectScrollbar>
        </div>
      </div>

      <!-- 우측: 테이블 -->
      <div class="table-section">
        <div class="table-header">
          <span class="table-count">전체 {{ totalStocks }}건</span>
          <div class="table-actions">
            <AppExportButton
              :items="exportItemsCurrent"
              :fields="exportFields"
              :filename="exportFilename"
              sheet-name="Stock"
              :fetch-all="fetchAllForExport"
              :transform="exportTransform"
              variant="text"
              size="small"
            />
            <IconBtn
              size="small"
              @click="loadStocks"
            >
              <VIcon
                icon="bx-refresh"
                size="18"
              />
            </IconBtn>
          </div>
        </div>

        <div class="table-body">
          <VDataTableServer
            v-model:items-per-page="itemsPerPage"
            v-model:page="page"
            :headers="headers"
            :loading="tableLoading"
            :items="stocks"
            :items-length="totalStocks"
            class="erp-table"
            density="compact"
          >
            <template #colgroup>
              <col style="width: 6%">
              <col style="width: 30%">
              <col style="width: 12%">
              <col style="width: 10%">
              <col style="width: 10%">
              <col style="width: 8%">
              <col style="width: 10%">
            </template>

            <template #item.id="{ item }">
              <span class="id-text">{{ item.id || '-' }}</span>
            </template>

            <template #item.product="{ item }">
              <div class="d-flex align-center gap-x-3">
                <VAvatar
                  v-if="item.image"
                  size="36"
                  variant="tonal"
                  rounded
                  :image="item.image"
                  class="cursor-pointer"
                  @click="router.push({ name: 'part-detail-id', params: { id: item.id } })"
                />
                <VAvatar
                  v-else
                  size="36"
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

            <template #item.isLack="{ item }">
              <VChip
                color="info"
                size="small"
                variant="tonal"
              >
                -
              </VChip>
            </template>

            <template #item.price="{ item }">
              <span class="price-text">₩{{ fmtCurrency(item.price) }}</span>
            </template>
          </VDataTableServer>
        </div>
        <div class="table-footer" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 페이지 레이아웃 */
.branch-stock-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
  background: rgb(var(--v-theme-surface));
}

/* 상단 헤더 */
.page-header {
  padding: 12px 20px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
  flex-shrink: 0;
}

.header-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  margin: 0;
  margin-right: auto;
}

.search-field {
  max-width: 200px;
  flex-shrink: 0;
}

/* 하단 컨텐츠: 좌측 지점 선택 + 우측 테이블 */
.page-content {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 좌측: 지점 선택 */
.branch-selector {
  width: 200px;
  min-width: 200px;
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.branch-header {
  padding: 10px 14px 0px 14px;
}

.branch-title {
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.branch-list-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.branch-list-scroll {
  flex: 1;
  min-height: 0;
}

.branch-list-content {
  padding: 8px 14px;
}

.branch-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.radio-dot {
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  box-sizing: border-box;
  border: 2px solid rgba(0, 0, 0, 0.38);
  position: relative;
  flex-shrink: 0;
}

.branch-item.selected .radio-dot {
  border-color: rgb(var(--v-theme-primary));
}

.branch-item.selected .radio-dot::after {
  content: "";
  position: absolute;
  inset: 2px;
  border-radius: 9999px;
  background: rgb(var(--v-theme-primary));
}

.branch-name {
  font-size: 13px;
  line-height: 1.4;
  color: rgb(var(--v-theme-on-surface));
  user-select: none;
}

.branch-item.selected .branch-name {
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
}

/* 우측: 테이블 */
.table-section {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
}

.table-header {
  padding: 8px 16px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgb(var(--v-theme-surface));
  flex-shrink: 0;
}

.table-count {
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface));
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.table-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.erp-table {
  height: 100% !important;
}

.erp-table :deep(.v-table) {
  font-size: 13px;
}

.erp-table :deep(.v-table th) {
  font-size: 12px;
  font-weight: 600;
  padding: 8px 12px;
  background: rgb(var(--v-theme-surface));
}

.erp-table :deep(.v-table td) {
  padding: 8px 12px;
  font-size: 13px;
}

.erp-table :deep(.v-table__body tr:hover) {
  background: rgba(var(--v-theme-primary), 0.04) !important;
}

/* 테이블 셀 스타일 */
.id-text {
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface));
  font-family: monospace;
}

.category-text {
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface));
}

.stock-text {
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}

.limit-text {
  font-size: 13px;
}

.price-text {
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}

.cursor-pointer {
  cursor: pointer;
}
</style>
