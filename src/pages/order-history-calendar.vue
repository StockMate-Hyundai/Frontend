<!-- File: src/pages/order-history-calendar.vue -->
<script setup>
import { getProfile } from '@/api/http'
import {
  getAllReceivingHistoryForAdmin,
  getMyReceivingHistory,
  getReceivingHistoryByMemberIdForAdmin,
} from '@/api/orderHistory'
import { getBranchList } from '@/api/parts'
import { useResponsiveLeftSidebar } from '@core/composable/useResponsiveSidebar'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/vue3'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { PerfectScrollbar } from 'vue3-perfect-scrollbar'

definePage({
  meta: { title: '입출고 히스토리 캘린더', icon: 'bx-calendar', requiresAuth: true },
})

/* =========================
   권한/레이아웃
========================= */
const userRole = computed(() => (getProfile().role || 'USER').toUpperCase())
const isAdmin = computed(() => ['ADMIN', 'SUPER_ADMIN'].includes(userRole.value))
const { isLeftSidebarOpen } = useResponsiveLeftSidebar()
const router = useRouter()

/* =========================
   캘린더 설정
========================= */
const calendarRef = ref()
const calendarApi = ref(null)

const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  locale: 'ko',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth',
  },
  height: 'auto',
  contentHeight: 'auto',
  editable: false,
  selectable: true,
  selectMirror: true,
  dayMaxEvents: true,
  weekends: true,
  eventClick: handleEventClick,
  dateClick: handleDateClick,
  datesSet: handleDatesSet,
  events: fetchEvents,
  eventContent: renderEventContent,
}))

/* =========================
   필터/지점
========================= */
const branches = ref([])
const selectedBranches = ref([]) // 배열로 변경
const branchLoading = ref(false)

async function loadBranches() {
  if (!isAdmin.value) return
  branchLoading.value = true
  try {
    const list = unwrap(await getBranchList()) || []

    branches.value = [{ id: null, name: '전체', memberId: null }, ...list]

    // 초기값: 전체 선택
    if (selectedBranches.value.length === 0) {
      selectedBranches.value = [branches.value[0]]
    } else {
      // 이미 선택된 값이 있으면 branches에 맞춰 업데이트 (객체 참조 문제 방지)
      const currentIds = selectedBranches.value.map(br => br.id)

      selectedBranches.value = branches.value.filter(br => currentIds.includes(br.id))
      
      // 선택된 것이 없거나 유효하지 않으면 전체 선택
      if (selectedBranches.value.length === 0) {
        selectedBranches.value = [branches.value[0]]
      }
    }
  } catch (e) {
    console.error('[OrderHistoryCalendar] loadBranches error:', e)
    branches.value = [{ id: null, name: '전체', memberId: null }]
    if (selectedBranches.value.length === 0) {
      selectedBranches.value = [branches.value[0]]
    }
  } finally {
    branchLoading.value = false
  }
}

function toggleBranch(b) {
  if (!b) return
  
  // 전체 선택 처리
  if (b.id === null) {
    // 전체를 클릭하면 전체만 선택되거나 전체 해제
    const allSelected = selectedBranches.value.some(br => br.id === null)
    if (allSelected) {
      // 전체 해제 시 아무것도 선택 안 됨 - 방지: 전체는 항상 하나만 유지
      return
    } else {
      // 전체 선택 시 다른 선택 모두 제거
      selectedBranches.value = [b]
    }
  } else {
    // 특정 지점 선택/해제
    const index = selectedBranches.value.findIndex(br => br.id === b.id)
    if (index >= 0) {
      // 해제
      selectedBranches.value.splice(index, 1)

      // 선택된 지점이 없으면 전체 선택
      if (selectedBranches.value.length === 0) {
        const allBranch = branches.value.find(br => br.id === null)
        if (allBranch) {
          selectedBranches.value = [allBranch]
        }
      }
    } else {
      // 선택 - 전체가 선택되어 있으면 제거하고 해당 지점만 선택
      if (selectedBranches.value.some(br => br.id === null)) {
        selectedBranches.value = [b]
      } else {
        // 다른 지점들이 선택되어 있으면 추가
        selectedBranches.value.push(b)
      }
    }
  }
  
  if (calendarApi.value) {
    calendarApi.value.refetchEvents()
  }
}

function isBranchSelected(b) {
  if (!b) return false
  
  return selectedBranches.value.some(br => br.id === b.id)
}

/* =========================
   히스토리 데이터
========================= */
const currentStartDate = ref(null)
const currentEndDate = ref(null)
const loading = ref(false)

const unwrap = r => (r && r.data) ? r.data : r

async function fetchEvents(info, successCallback, failureCallback) {
  loading.value = true
  currentStartDate.value = info.start
  currentEndDate.value = info.end
  
  try {
    let allHistories = []
    let currentPage = 0
    const pageSize = 100

    // 시작일과 종료일 사이의 모든 히스토리 가져오기
    if (isAdmin.value && selectedBranches.value.length > 0) {
      const hasAll = selectedBranches.value.some(br => br.id === null)
      
      if (hasAll) {
        // 전체 선택인 경우
        while (true) {
          const res = await getAllReceivingHistoryForAdmin({
            page: currentPage,
            size: pageSize,
          })

          const { content, last } = unwrapList(res)

          allHistories = allHistories.concat(content || [])
          if (last || (content || []).length === 0) break
          currentPage++
        }
      } else {
        // 특정 지점들만 선택된 경우 - 각 지점별로 가져와서 합침
        const branchIds = selectedBranches.value.map(br => br.id).filter(id => id !== null)

        const allPromises = branchIds.map(async branchId => {
          const branchHistories = []
          let page = 0
          while (true) {
            const res = await getReceivingHistoryByMemberIdForAdmin(branchId, {
              page,
              size: pageSize,
            })

            const { content, last } = unwrapList(res)

            branchHistories.push(...(content || []))
            if (last || (content || []).length === 0) break
            page++
          }
          
          return branchHistories
        })
        
        const results = await Promise.all(allPromises)

        allHistories = results.flat()
      }
    } else {
      // 일반 사용자
      while (true) {
        const res = await getMyReceivingHistory({
          page: currentPage,
          size: pageSize,
        })

        const { content, last } = unwrapList(res)

        allHistories = allHistories.concat(content || [])
        if (last || (content || []).length === 0) break
        currentPage++
      }
    }

    // 날짜 범위 필터링 및 이벤트 변환
    const events = allHistories
      .filter(h => {
        if (!h.createdAt) return false
        const date = new Date(h.createdAt)
        
        return date >= info.start && date < info.end
      })
      .map(h => ({
        id: String(h.id),
        title: getEventTitle(h),
        start: h.createdAt,
        allDay: true,
        extendedProps: {
          history: h,
        },
        color: getEventColor(h),
        textColor: getEventTextColor(h),
        borderColor: getEventTextColor(h),
      }))

    successCallback(events)
  } catch (e) {
    console.error('[OrderHistoryCalendar] fetchEvents error:', e)
    failureCallback(e)
  } finally {
    loading.value = false
  }
}

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

function getEventTitle(history) {
  const typeLabel = history.type === 'INBOUND' ? '입고' : history.type === 'OUTBOUND' ? '출고' : ''
  const statusLabel = resolveStatusLabel(history.status)
  const orderNum = history.orderNumber ? `#${history.orderNumber}` : ''
  const message = history.message ? ` - ${history.message}` : ''
  
  return `${typeLabel} ${statusLabel} ${orderNum}${message}`.trim()
}

function getEventColor(history) {
  if (history.type === 'INBOUND') {
    return '#d1fae5' // 입고 - 연한 초록 배경
  } else if (history.type === 'OUTBOUND') {
    return '#fee2e2' // 출고 - 연한 빨강 배경
  }
  
  const statusColor = {
    PENDING: '#fef3c7', // 연한 노랑
    APPROVED: '#cffafe', // 연한 파랑
    REJECTED: '#fee2e2', // 연한 빨강
    COMPLETED: '#d1fae5', // 연한 초록
    CANCELLED: '#e5e7eb', // 연한 회색
    RECEIVED: '#d1fae5', // 연한 초록
    RELEASED: '#fee2e2', // 연한 빨강
  }
  
  return statusColor[history.status] || '#e5e7eb'
}

function getEventTextColor(history) {
  if (history.type === 'INBOUND') {
    return '#065f46' // 입고 - 진한 초록 텍스트
  } else if (history.type === 'OUTBOUND') {
    return '#991b1b' // 출고 - 진한 빨강 텍스트
  }
  
  const textColor = {
    PENDING: '#92400e', // 진한 노랑
    APPROVED: '#155e75', // 진한 파랑
    REJECTED: '#991b1b', // 진한 빨강
    COMPLETED: '#065f46', // 진한 초록
    CANCELLED: '#374151', // 진한 회색
    RECEIVED: '#065f46', // 진한 초록
    RELEASED: '#991b1b', // 진한 빨강
  }
  
  return textColor[history.status] || '#374151'
}

function resolveStatusLabel(s) {
  const labels = {
    PENDING: '대기',
    APPROVED: '승인',
    REJECTED: '반려',
    COMPLETED: '완료',
    CANCELLED: '취소',
    RECEIVED: '입고',
    RELEASED: '출고',
  }

  
  return labels[s] || s || '-'
}

function renderEventContent(eventInfo) {
  const history = eventInfo.event.extendedProps.history
  const typeIcon = history.type === 'INBOUND' ? '⬇️' : history.type === 'OUTBOUND' ? '⬆️' : '•'
  const title = eventInfo.event.title
  
  return {
    html: `<div style="padding: 2px 4px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
      <span>${title}</span>
    </div>`,
  }
}

function handleEventClick(info) {
  const history = info.event.extendedProps.history

  selectedHistory.value = history
  isDetailDialogVisible.value = true
}

function handleDateClick(info) {
  // 날짜 클릭 시 히스토리 등록 기능 비활성화
  // selectedDate.value = info.dateStr
  // isEditDialogVisible.value = true
  // editingHistory.value = null
}

function handleDatesSet(info) {
  // 날짜 변경 시 이벤트 자동으로 다시 로드됨
}

/* =========================
   다이얼로그
========================= */
const isEditDialogVisible = ref(false)
const isDetailDialogVisible = ref(false)
const selectedDate = ref(null)
const selectedHistory = ref(null)
const editingHistory = ref(null)

function openEditDialog(date, history = null) {
  selectedDate.value = date
  editingHistory.value = history
  isEditDialogVisible.value = true
}

function openDetailDialog(history) {
  selectedHistory.value = history
  isDetailDialogVisible.value = true
}

function closeEditDialog() {
  isEditDialogVisible.value = false
  selectedDate.value = null
  editingHistory.value = null
}

function closeDetailDialog() {
  isDetailDialogVisible.value = false
  selectedHistory.value = null
}

function onHistorySaved() {
  closeEditDialog()
  closeDetailDialog()
  if (calendarApi.value) {
    calendarApi.value.refetchEvents()
  }
}

function onHistoryDeleted() {
  closeDetailDialog()
  if (calendarApi.value) {
    calendarApi.value.refetchEvents()
  }
}

function onHistoryUpdated(history) {
  closeDetailDialog()
  editingHistory.value = history
  selectedDate.value = history?.createdAt ? new Date(history.createdAt).toISOString().split('T')[0] : null
  isEditDialogVisible.value = true
}

/* =========================
   초기화
========================= */
onMounted(async () => {
  // 관리자인 경우 브랜치를 먼저 로드
  if (isAdmin.value) {
    await loadBranches()
  }
  
  // 캘린더 API 초기화 (브랜치 로드 완료 후)
  await nextTick()
  
  if (calendarRef.value?.getApi) {
    calendarApi.value = calendarRef.value.getApi()
    
    // 초기 로드 시 선택된 브랜치가 있으면 이벤트 새로고침
    // (관리자: loadBranches 후 selectedBranches가 설정됨, 일반 사용자: fetchEvents에서 처리)
    if (isAdmin.value && selectedBranches.value.length > 0) {
      // 약간의 지연을 두어 캘린더가 완전히 렌더링된 후 이벤트 로드
      await nextTick()
      calendarApi.value.refetchEvents()
    }
  }
})

watch(selectedBranches, () => {
  if (calendarApi.value) {
    calendarApi.value.refetchEvents()
  }
}, { deep: true })
</script>

<template>
  <div class="order-history-calendar-page">
    <!-- 하단 컨텐츠 -->
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

              <template v-else-if="branches.length">
                <div
                  v-for="b in branches"
                  :key="b.id ?? 'all'"
                  class="branch-item"
                  :class="{ selected: isBranchSelected(b) }"
                  @click="toggleBranch(b)"
                >
                  <VCheckbox
                    :model-value="isBranchSelected(b)"
                    density="compact"
                    hide-details
                    class="branch-checkbox"
                    @click.stop="toggleBranch(b)"
                  />
                  <span class="branch-name">{{ b.name }}</span>
                </div>
              </template>

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

      <!-- 우측: 캘린더 -->
      <div class="calendar-section">
        <div
          v-if="loading"
          class="calendar-loading"
        >
          <VProgressCircular
            indeterminate
            color="primary"
            size="48"
          />
        </div>
        <FullCalendar
          ref="calendarRef"
          :options="calendarOptions"
          class="full-calendar"
        />
      </div>
    </div>

    <!-- 히스토리 등록/수정 다이얼로그 -->
    <HistoryEditDialog
      v-model:is-dialog-visible="isEditDialogVisible"
      :date="selectedDate"
      :history="editingHistory"
      :member-id="selectedBranches.length === 1 && selectedBranches[0]?.id ? selectedBranches[0].id : null"
      @saved="onHistorySaved"
      @close="closeEditDialog"
    />

    <!-- 히스토리 상세 다이얼로그 -->
    <HistoryDetailDialog
      v-model:is-dialog-visible="isDetailDialogVisible"
      :history="selectedHistory"
      @deleted="onHistoryDeleted"
      @updated="onHistoryUpdated"
      @close="closeDetailDialog"
    />
  </div>
</template>

<style scoped>
/* 페이지 레이아웃 */
.order-history-calendar-page {
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
  justify-content: space-between;
  gap: 12px;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  margin: 0;
}

/* 하단 컨텐츠 */
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
  padding: 1px 0;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.branch-checkbox {
  flex-shrink: 0;
  margin: 0;
  padding: 0;
}

.branch-checkbox :deep(.v-selection-control) {
  min-height: auto;
}

.branch-checkbox :deep(.v-selection-control__wrapper) {
  margin-inline-end: 0;
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

/* 우측: 캘린더 */
.calendar-section {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
  position: relative;
  padding: 20px;
  overflow-y: auto;
}

.calendar-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  background: rgba(var(--v-theme-surface), 0.8);
  border-radius: 8px;
  padding: 20px;
}

.full-calendar {
  width: 100%;
}

/* FullCalendar 내부 스크롤러 제거하여 잘림 방지 */
.full-calendar :deep(.fc-scroller) {
  overflow: visible !important;
}

.full-calendar :deep(.fc-scroller-liquid-absolute) {
  overflow: visible !important;
}

.full-calendar :deep(.fc-daygrid-body) {
  overflow: visible !important;
}

.full-calendar :deep(.fc-view-harness) {
  overflow: visible !important;
  height: auto !important;
}

.full-calendar :deep(.fc-daygrid) {
  height: auto !important;
}

/* 이벤트 간격 줄이기 */
.full-calendar :deep(.fc-daygrid-event) {
  margin-block-end: 2px !important;
  margin-inline: 0 !important;
}

.full-calendar :deep(.fc-daygrid-day-events) {
  margin-block-end: 0;
}

.full-calendar :deep(.fc-event) {
  margin-block-end: 2px !important;
  padding-block: 2px !important;
  padding-inline: 6px !important;
}
</style>

