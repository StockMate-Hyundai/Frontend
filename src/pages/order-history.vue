<!-- File: src/pages/order-history.vue -->
<script setup>
import {
  getAllReceivingHistoryForAdmin,
  getReceivingHistoryByMemberIdForAdmin,
  getReceivingHistoryByOrderNumber,
} from '@/api/orderHistory'
import { getBranchList } from '@/api/parts'
import AppExportButton from '@/components/common/ExportToExcel.vue'
import { useResponsiveLeftSidebar } from '@core/composable/useResponsiveSidebar'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { PerfectScrollbar } from 'vue3-perfect-scrollbar'

definePage({
  meta: { title: '입출고 히스토리', icon: 'bx-history', requiresAuth: true },
})

/* =========================
   권한/레이아웃
========================= */
// 모든 사용자가 동일한 권한으로 볼 수 있도록 isAdmin 제거
// const userRole = computed(() => (getProfile().role || 'USER').toUpperCase())
// const isAdmin = computed(() => ['ADMIN', 'SUPER_ADMIN'].includes(userRole.value))
const { isLeftSidebarOpen } = useResponsiveLeftSidebar()
const router = useRouter()

/* =========================
   엑셀
========================= */
const exportFilename = computed(() => {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  
  return `입출고히스토리_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}.xlsx`
})

const exportFields = [
  { key: 'id',            label: 'ID' },
  { key: 'orderNumber',   label: '주문번호' },
  { key: 'storeName',     label: '가맹점명' },
  { key: 'status',        label: '상태' },
  { key: 'message',       label: '메시지' },
  { key: 'createdAt',     label: '등록일시' },
]

const exportTransform = row => {
  return {
    id: row.id || '-',
    orderNumber: row.orderNumber || '-',
    storeName: row.userInfo?.storeName || row.userInfo?.email || '-',
    status: resolveStatusLabel(row.status),
    message: row.message || '-',
    createdAt: fmtDateTime(row.createdAt),
  }
}

const exportItemsCurrent = computed(() => histories.value)

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
const headers = computed(() => {
  const base = [
    { title: 'ID',        key: 'id' },
    { title: '주문번호', key: 'orderNumber' },
    { title: '상태',     key: 'status' },
    { title: '메시지',   key: 'message' },
    { title: '등록일시', key: 'createdAt' },
  ]

  // 모든 사용자에게 가맹점 컬럼 표시
  base.splice(2, 0, { title: '가맹점', key: 'storeName' })
  
  return base
})

/* =========================
   필터/지점
========================= */
const orderNumberFilter = ref('')

const branches = ref([])
const selectedBranch = ref(null)
const branchLoading = ref(false)

async function loadBranches() {
  // 모든 사용자가 지점 목록 로드 가능
  branchLoading.value = true
  try {
    const list = unwrap(await getBranchList()) || []

    branches.value = [{ id: null, name: '전체', memberId: null }, ...list]
    if (!selectedBranch.value) selectedBranch.value = branches.value[0]
  } catch (e) {
    console.error('[OrderHistory] loadBranches error:', e)
    branches.value = [{ id: null, name: '전체', memberId: null }]
    selectedBranch.value = branches.value[0]
  } finally {
    branchLoading.value = false
  }
}

function selectBranch(b) {
  if (!b) return
  selectedBranch.value = b
  page.value = 1
  orderNumberFilter.value = ''
  loadHistories()
}

/* =========================
   페이지네이션 / 데이터
========================= */
const itemsPerPage = ref(20)
const page = ref(1)

const tableLoading = ref(false)
const historiesData = ref({ content: [], totalElements: 0, totalPages: 0 })

async function loadHistories() {
  tableLoading.value = true
  try {
    let res
    if (orderNumberFilter.value?.trim()) {
      res = await getReceivingHistoryByOrderNumber(orderNumberFilter.value.trim(), {
        page: page.value - 1,
        size: itemsPerPage.value,
      })
    } else {
      // 모든 사용자가 관리자 API 사용
      if (selectedBranch.value?.id) {
        res = await getReceivingHistoryByMemberIdForAdmin(selectedBranch.value.id, {
          page: page.value - 1,
          size: itemsPerPage.value,
        })
      } else {
        res = await getAllReceivingHistoryForAdmin({
          page: page.value - 1,
          size: itemsPerPage.value,
        })
      }
    }
    historiesData.value = unwrapList(res)
  } catch (e) {
    console.error('[OrderHistory] loadHistories error:', e)
    historiesData.value = { content: [], totalElements: 0, totalPages: 0 }
  } finally {
    tableLoading.value = false
  }
}

onMounted(async () => {
  await loadBranches()
  await loadHistories()
})
watch([page, itemsPerPage, selectedBranch], () => loadHistories())

/* =========================
   화면 가공/표시
========================= */
const histories = computed(() => {
  return (historiesData.value.content || []).map(item => {
    return {
      ...item,
      __raw: item,
    }
  })
})

const totalHistories = computed(() => historiesData.value.totalElements)

/* =========================
   행 확장 (아이템 리스트)
========================= */
const expandedRows = ref([])

const fmtDateTime = s => {
  if (!s) return '-'
  const d = new Date(s)
  
  return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const resolveTypeLabel = t => ({ INBOUND: '입고', OUTBOUND: '출고' }[t] || t || '-')
const resolveStatusLabel = s => ({ PENDING: '대기', APPROVED: '승인', REJECTED: '반려', COMPLETED: '완료', CANCELLED: '취소', RECEIVED: '입고', RELEASED: '출고' }[s] || s || '-')
const resolveTypeVariant = t => ({ INBOUND: { color: 'success', icon: 'bx-down-arrow-alt' }, OUTBOUND: { color: 'error', icon: 'bx-up-arrow-alt' } }[t] || { color: 'default', icon: 'bx-minus' })
const resolveStatusVariant = s => ({ PENDING: { color: 'warning' }, APPROVED: { color: 'info' }, REJECTED: { color: 'error' }, COMPLETED: { color: 'success' }, CANCELLED: { color: 'default' }, RECEIVED: { color: 'success' }, RELEASED: { color: 'error' } }[s] || { color: 'default' })

/* =========================
   검색/리셋
========================= */
function onSearch() {
  page.value = 1
  loadHistories()
}

function onReset() {
  orderNumberFilter.value = ''
  if (branches.value.length) selectedBranch.value = branches.value[0]
  page.value = 1
  loadHistories()
}

/* =========================
   엑셀 전체 수집
========================= */
async function fetchAllForExport() {
  let all = []
  let currentPage = 0
  while (true) {
    let res

    // 모든 사용자가 관리자 API 사용
    if (selectedBranch.value?.id) {
      res = await getReceivingHistoryByMemberIdForAdmin(selectedBranch.value.id, { page: currentPage, size: 100 })
    } else {
      res = await getAllReceivingHistoryForAdmin({ page: currentPage, size: 100 })
    }
    const { content, last } = unwrapList(res)

    all = all.concat(content || [])
    if (last || (content || []).length === 0) break
    currentPage++
  }
  
  return all
}
</script>

<template>
  <div class="order-history-page">
    <!-- 상단: 제목 및 필터 -->
    <div class="page-header">
      <div class="header-top">
        <h6 class="page-title">
          입출고 히스토리
        </h6>
        <VTextField
          v-model="orderNumberFilter"
          placeholder="주문번호 검색"
          density="compact"
          variant="outlined"
          hide-details
          class="search-field"
          @keyup.enter="onSearch"
        />
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

    <!-- 하단: 좌측 지점 선택 + 우측 테이블 -->
    <div class="page-content">
      <!-- 좌측: 지점 선택 (모든 사용자) -->
      <div class="branch-selector">
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
          <span class="table-count">전체 {{ totalHistories }}건</span>
          <div class="table-actions">
            <AppExportButton
              :items="exportItemsCurrent"
              :fields="exportFields"
              :filename="exportFilename"
              sheet-name="History"
              :fetch-all="fetchAllForExport"
              :transform="exportTransform"
              variant="text"
              size="small"
            />
            <IconBtn
              size="small"
              @click="loadHistories"
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
            v-model:expanded="expandedRows"
            :headers="headers"
            :loading="tableLoading"
            :items="histories"
            :items-length="totalHistories"
            class="erp-table"
            density="compact"
            item-value="id"
            show-expand
          >
            <template #colgroup>
              <col style="width: 6%">
              <col style="width: 12%">
              <col style="width: 12%">
              <col style="width: 10%">
              <col style="width: 35%">
              <col style="width: 25%">
            </template>

            <template #item.id="{ item }">
              <span class="id-text">{{ item.id || '-' }}</span>
            </template>

            <template #item.orderNumber="{ item }">
              <span
                v-if="item.orderNumber"
                class="order-number-link cursor-pointer"
                @click="router.push({ name: 'order-detail-id', params: { id: item.orderId } })"
              >
                #{{ item.orderNumber }}
              </span>
              <span
                v-else
                class="order-number-empty"
              >
                -
              </span>
            </template>

            <template #item.storeName="{ item }">
              <span
                v-if="item.userInfo?.memberId || item.memberId"
                class="store-name cursor-pointer"
                @click.stop="router.push({ name: 'user-detail-id', params: { id: String(item.userInfo?.memberId || item.memberId) } })"
              >
                {{ item.userInfo?.storeName || item.userInfo?.email || '-' }}
              </span>
              <span
                v-else
                class="store-name"
              >
                {{ item.userInfo?.storeName || item.userInfo?.email || '-' }}
              </span>
            </template>

            <template #item.status="{ item }">
              <VChip
                :color="resolveStatusVariant(item.status).color"
                size="small"
                variant="tonal"
              >
                {{ resolveStatusLabel(item.status) }}
              </VChip>
            </template>
            <template #item.message="{ item }">
              <span class="message-text">{{ item.message || '-' }}</span>
            </template>

            <template #item.createdAt="{ item }">
              <span class="date-text">{{ fmtDateTime(item.createdAt) }}</span>
            </template>

            <template #expanded-row="{ item }">
              <tr>
                <td :colspan="7">
                  <div class="expanded-content">
                    <!-- 상단 요약 -->
                    <div class="expanded-header">
                      <span class="expanded-title">
                        부품 목록
                        <VChip
                          size="x-small"
                          class="ml-2"
                          color="primary"
                          variant="tonal"
                        >
                          {{ (item.items || item.__raw?.items || []).length }}건
                        </VChip>
                      </span>
                      <span class="expanded-total">
                        총 수량
                        <VChip
                          size="x-small"
                          color="primary"
                          variant="flat"
                          class="ml-2"
                        >
                          {{
                            (item.items || item.__raw?.items || [])
                              .reduce((sum, it) => sum + (it.historyQuantity || 0), 0)
                          }}개
                        </VChip>
                      </span>
                    </div>

                    <!-- 목록 테이블 -->
                    <div
                      v-if="(item.items || item.__raw?.items || []).length"
                      class="expanded-table"
                    >
                      <!-- 헤더 -->
                      <div class="et-header">
                        <div class="col-thumb">
                          이미지
                        </div>
                        <div class="col-name">
                          부품명
                        </div>
                        <div class="col-id">
                          부품 ID
                        </div>
                        <div class="col-qty">
                          수량
                        </div>
                        <div class="col-action">
                          상세
                        </div>
                      </div>

                      <!-- 바디 -->
                      <div class="et-body">
                        <div
                          v-for="(it, idx) in (item.items || item.__raw?.items || [])"
                          :key="idx"
                          class="et-row"
                        >
                          <div class="col-thumb">
                            <VAvatar
                              v-if="it.image"
                              size="36"
                              rounded
                              :image="it.image"
                            />
                            <VAvatar
                              v-else
                              size="36"
                              color="secondary"
                              variant="tonal"
                            >
                              <VIcon
                                icon="bx-package"
                                size="18"
                              />
                            </VAvatar>
                          </div>

                          <div class="col-name">
                            <div
                              class="name-main"
                              :title="it.korName || it.engName || it.name"
                            >
                              {{ it.korName || it.engName || it.name || '이름 없음' }}
                            </div>
                            <div
                              v-if="it.spec || it.model"
                              class="name-sub"
                            >
                              {{ [it.model, it.spec].filter(Boolean).join(' · ') }}
                            </div>
                          </div>

                          <div class="col-id">
                            <code>#{{ it.id }}</code>
                          </div>

                          <div class="col-qty">
                            <span class="qty-chip">{{ it.historyQuantity || 0 }}</span>
                          </div>

                          <div class="col-action">
                            <VBtn
                              size="x-small"
                              variant="tonal"
                              color="primary"
                              @click.stop="router.push({ name: 'part-detail-id', params: { id: it.id } })"
                            >
                              보기
                            </VBtn>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 빈 상태 -->
                    <div
                      v-else
                      class="expanded-empty"
                    >
                      표시할 부품이 없습니다
                    </div>
                  </div>
                </td>
              </tr>
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
.order-history-page {
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

.order-number-link {
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
  text-decoration: none;
  font-size: 13px;
}

.order-number-link:hover {
  text-decoration: underline;
}

.order-number-empty {
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface-variant));
}

.store-name {
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface));
}

.count-text {
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface));
  font-weight: 500;
}

.quantity-text {
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface));
  font-weight: 500;
}

.message-text {
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface));
  display: inline-block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-text {
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface));
}

.cursor-pointer {
  cursor: pointer;
}

/* 확장 영역 스타일 */
.expanded-content {
  padding: 16px 20px;
}

.expanded-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.expanded-title {
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.expanded-total {
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
}

.expanded-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.expanded-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgb(var(--v-theme-surface));
  border-radius: 6px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  cursor: pointer;
  transition: all 0.2s ease;
}

.expanded-item:hover {
  background: rgba(var(--v-theme-primary), 0.08);
  border-color: rgb(var(--v-theme-primary));
}

.item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-part-name {
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}

.item-part-id {
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
}

.item-quantity {
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
  margin-left: 12px;
}

.expanded-empty {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface-variant));
}
/* ===== 확장 영역(미니 테이블) 개선 ===== */
.expanded-content { padding: 14px 16px; }

.expanded-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px; padding-bottom: 8px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.expanded-title { font-size: 14px; font-weight: 700; color: rgb(var(--v-theme-on-surface)); }
.expanded-total { font-size: 13px; font-weight: 600; color: rgb(var(--v-theme-on-surface)); }

.expanded-table {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px; overflow: hidden; background: rgb(var(--v-theme-surface));
}

/* 헤더 */
.et-header {
  display: grid;
  grid-template-columns: 60px 1fr 140px 100px 90px;
  gap: 0;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  font-size: 12px; font-weight: 700; color: rgb(var(--v-theme-on-surface));
}
.et-header > div { padding: 10px 12px; }

/* 바디 */
.et-body {
  max-height: 280px; /* 세로가 길면 내부 스크롤 */
  overflow: auto;
}

.et-row {
  display: grid;
  grid-template-columns: 60px 1fr 140px 100px 90px;
  align-items: center;
  font-size: 13px;
}

/* 줄무늬 + 호버 강조 */
.et-row:nth-child(odd) { background: rgba(var(--v-border-color), 0.06); }
.et-row:hover { background: rgba(var(--v-theme-primary), 0.10); }

.et-row > div { padding: 10px 12px; }

/* 컬럼별 디테일 */
.col-name .name-main {
  font-weight: 600; color: rgb(var(--v-theme-on-surface));
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.col-name .name-sub {
  font-size: 12px; 
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-top: 2px;
}

.col-id code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 12px; color: rgb(var(--v-theme-on-surface));
}

.qty-chip {
  display: inline-block; min-width: 36px; text-align: center;
  padding: 4px 8px; border-radius: 9999px;
  background: rgba(var(--v-theme-primary), .12);
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}

/* 빈 상태 */
.expanded-empty {
  padding: 22px; text-align: center; font-size: 13px;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>

