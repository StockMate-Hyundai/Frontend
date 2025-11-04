<!-- File: src/pages/order-history-calendar.vue -->
<script setup>
import {
  getAllReceivingHistoryForAdmin,
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
import { useDisplay } from 'vuetify'

definePage({
  meta: { title: '입출고 히스토리 캘린더', icon: 'bx-calendar', requiresAuth: true },
})

/* =========================
   권한/레이아웃
========================= */
// 모든 사용자가 동일한 권한으로 볼 수 있도록 isAdmin 제거
// const userRole = computed(() => (getProfile().role || 'USER').toUpperCase())
// const isAdmin = computed(() => ['ADMIN', 'SUPER_ADMIN'].includes(userRole.value))
const { isLeftSidebarOpen } = useResponsiveLeftSidebar()
const router = useRouter()
const { mdAndDown, smAndDown, xs } = useDisplay()

/* =========================
   캘린더 설정
========================= */
const calendarRef = ref()
const calendarApi = ref(null)

const calendarOptions = computed(() => {
  const isMobile = smAndDown.value
  
  return {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    locale: 'ko',
    headerToolbar: {
      left: isMobile ? 'prev,next' : 'prev,next today',
      center: 'title',
      right: isMobile ? '' : 'dayGridMonth',
    },
    height: 'auto',
    contentHeight: 'auto',
    editable: false,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: 3, // 하루에 최대 3개만 표시
    moreLinkClick: handleMoreLinkClick, // 더보기 버튼 클릭 핸들러
    moreLinkText: '건 더보기', // 더보기 버튼 텍스트
    weekends: true,
    eventClick: handleEventClick,
    dateClick: handleDateClick,
    datesSet: handleDatesSet,
    events: fetchEvents,
    eventContent: renderEventContent,
  }
})

/* =========================
   필터/지점
========================= */
const branches = ref([])
const selectedBranches = ref([]) // 배열로 변경
const branchLoading = ref(false)

// 지점별 색상 팔레트 (파스텔톤 16진수)
const BRANCH_COLORS = [
  '#FFB3BA',
  '#FFDFBA',
  '#FFFFBA',
  '#BAFFC9',
  '#BAE1FF',
  '#E6B3FF',
  '#FFB3D9',
  '#FFE6B3',
  '#B3E6FF',
  '#FFD9B3',
  '#C9FFB3',
  '#B3B3FF',
  '#FFB3E6',
  '#B3FFF0',
  '#FFF0B3',
]

async function loadBranches() {
  // 모든 사용자가 지점 목록 로드 가능
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

function getBranchColor(branch) {
  if (!branch || branch.id === null) return null
  const memberId = branch.memberId || branch.id
  
  return BRANCH_COLORS[memberId % BRANCH_COLORS.length]
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

    // 시작일과 종료일 사이의 모든 히스토리 가져오기 (모든 사용자)
    if (selectedBranches.value.length > 0) {
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
  // 지점별 색상 적용 (모든 사용자)
  const memberId = history?.userInfo?.memberId || history?.memberId
  if (memberId) {
    const branchColor = BRANCH_COLORS[memberId % BRANCH_COLORS.length]

    // 파스텔 색상에 RGB 값을 직접 더하여 진하게 만듦
    const rgb = hexToRgb(branchColor)
    if (rgb) {
      // 배경을 더 진하게 만들기 위해 RGB 값 증가
      const darkenFactor = 20
      
      return `rgb(${Math.min(255, rgb.r + darkenFactor)}, ${Math.min(255, rgb.g + darkenFactor)}, ${Math.min(255, rgb.b + darkenFactor)})`
    }
    
    return branchColor
  }
  
  // 기존 로직 (지점별 색상이 없는 경우)
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
  // 지점별 색상 적용 (모든 사용자)
  const memberId = history?.userInfo?.memberId || history?.memberId
  if (memberId) {
    const branchColor = BRANCH_COLORS[memberId % BRANCH_COLORS.length]

    // 파스텔 색상의 텍스트는 훨씬 더 어둡게 하기 위해 RGB를 크게 낮춤
    const rgb = hexToRgb(branchColor)
    if (rgb) {
      return `rgb(${Math.max(0, rgb.r - 120)}, ${Math.max(0, rgb.g - 120)}, ${Math.max(0, rgb.b - 120)})`
    }
    
    return branchColor
  }
  
  // 기존 로직 (지점별 색상이 없는 경우)
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

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null
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

function handleMoreLinkClick(info) {
  // 더보기 버튼 클릭 시 해당 날짜의 모든 이벤트를 사이드바에 표시
  const clickedDate = new Date(info.date)

  clickedDate.setHours(0, 0, 0, 0)
  
  // 해당 날짜의 모든 이벤트 가져오기
  if (calendarApi.value) {
    const events = calendarApi.value.getEvents().filter(event => {
      const eventDate = new Date(event.start)

      eventDate.setHours(0, 0, 0, 0)
      
      return eventDate.getTime() === clickedDate.getTime()
    })
    
    selectedDateForList.value = clickedDate
    selectedDateEvents.value = events.map(event => event.extendedProps.history)
    isEventListSidebarOpen.value = true
  }
  
  info.jsEvent.preventDefault()
}

/* =========================
   다이얼로그
========================= */
const isEditDialogVisible = ref(false)
const isDetailDialogVisible = ref(false)
const selectedDate = ref(null)
const selectedHistory = ref(null)
const editingHistory = ref(null)

/* =========================
   이벤트 리스트 사이드바
========================= */
const isEventListSidebarOpen = ref(false)
const selectedDateForList = ref(null)
const selectedDateEvents = ref([])

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

function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const weekday = weekdays[d.getDay()]
  
  return `${year}년 ${month}월 ${day}일 (${weekday})`
}

/* =========================
   초기화
========================= */
onMounted(async () => {
  // 모든 사용자가 브랜치를 먼저 로드
  await loadBranches()
  
  // 캘린더 API 초기화 (브랜치 로드 완료 후)
  await nextTick()
  
  if (calendarRef.value?.getApi) {
    calendarApi.value = calendarRef.value.getApi()
    
    // 초기 로드 시 선택된 브랜치가 있으면 이벤트 새로고침
    // (관리자: loadBranches 후 selectedBranches가 설정됨, 일반 사용자: fetchEvents에서 처리)
    if (selectedBranches.value.length > 0) {
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
      <!-- 좌측: 지점 선택 (모든 사용자) -->
      <div
        class="branch-selector"
        :class="{ 'branch-selector-mobile': smAndDown }"
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
                  <div
                    class="branch-color-indicator"
                    :class="{ 'branch-color-indicator-checked': isBranchSelected(b) }"
                    :style="{
                      backgroundColor: isBranchSelected(b) 
                        ? (getBranchColor(b) || '#696CFF') 
                        : (getBranchColor(b) || '#e5e7eb'),
                      opacity: isBranchSelected(b) ? 1 : 0.5
                    }"
                  >
                    <VIcon
                      v-if="isBranchSelected(b)"
                      icon="bx-check"
                      size="14"
                      color="white"
                      class="branch-check-icon"
                    />
                  </div>
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

    <!-- 이벤트 리스트 사이드바 -->
    <VNavigationDrawer
      v-model="isEventListSidebarOpen"
      location="end"
      temporary
      width="400"
      class="event-list-sidebar"
    >
      <div class="event-list-header">
        <VCardTitle class="d-flex align-center justify-space-between">
          <span class="text-h6">
            {{ selectedDateForList ? formatDate(selectedDateForList) : '일정 목록' }}
          </span>
          <VBtn
            icon
            variant="text"
            size="small"
            @click="isEventListSidebarOpen = false"
          >
            <VIcon icon="bx-x" />
          </VBtn>
        </VCardTitle>
      </div>

      <VDivider />

      <div class="event-list-content">
        <PerfectScrollbar
          :options="{ wheelPropagation: false, suppressScrollX: true }"
          class="event-list-scroll"
        >
          <VList
            v-if="selectedDateEvents.length > 0"
            class="pa-4"
          >
            <VListItem
              v-for="(history, index) in selectedDateEvents"
              :key="history.id || index"
              class="mb-2 event-list-item"
              :style="{
                borderLeft: `4px solid ${getEventColor(history)}`,
              }"
              @click="openDetailDialog(history)"
            >
              <VListItemTitle class="text-body-1 font-weight-medium mb-1">
                {{ getEventTitle(history) }}
              </VListItemTitle>
              <VListItemSubtitle class="text-caption">
                <div class="d-flex align-center gap-2">
                  <VIcon
                    :icon="history.type === 'INBOUND' ? 'bx-down-arrow' : 'bx-up-arrow'"
                    size="14"
                  />
                  <span>{{ history.orderNumber ? `주문번호: ${history.orderNumber}` : '주문번호 없음' }}</span>
                </div>
                <div
                  v-if="history.message"
                  class="mt-1"
                >
                  {{ history.message }}
                </div>
              </VListItemSubtitle>
            </VListItem>
          </VList>
          <div
            v-else
            class="d-flex flex-column align-center justify-center py-12"
          >
            <VIcon
              icon="bx-calendar-x"
              size="48"
              class="mb-4 text-medium-emphasis"
            />
            <div class="text-body-1 text-medium-emphasis">
              일정이 없습니다
            </div>
          </div>
        </PerfectScrollbar>
      </div>
    </VNavigationDrawer>
  </div>
</template>

<style scoped>
/* 페이지 레이아웃 */
.order-history-calendar-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
  min-height: calc(100vh - 100px);
  background: rgb(var(--v-theme-surface));
}

@media (max-width: 959.98px) {
  .order-history-calendar-page {
    height: auto;
    min-height: calc(100vh - 100px);
  }
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

@media (max-width: 959.98px) {
  .page-content {
    flex-direction: column;
    overflow-y: auto;
  }
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

@media (max-width: 959.98px) {
  .branch-selector {
    width: 100%;
    min-width: unset;
    max-width: 100%;
    border-right: none;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    max-height: 200px;
    flex-shrink: 1;
  }
  
  .branch-selector-mobile {
    max-height: 180px;
  }
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

.branch-color-indicator {
  width: 16px;
  height: 16px;
  min-width: 16px;
  min-height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.branch-color-indicator-checked {
  border-color: rgba(0, 0, 0, 0.3);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

.branch-check-icon {
  opacity: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
  font-weight: bold;
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

@media (max-width: 959.98px) {
  .calendar-section {
    padding: 12px;
    flex: 1;
    min-height: 500px;
  }
}

@media (max-width: 599.98px) {
  .calendar-section {
    padding: 8px;
  }
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

/* FullCalendar 기본 더보기 팝오버 숨기기 */
.full-calendar :deep(.fc-more-popover) {
  display: none !important;
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
  margin-block-end: 4px !important;
  margin-inline: 0 !important;
}

.full-calendar :deep(.fc-daygrid-day-events) {
  margin-block-end: 0;
}

.full-calendar :deep(.fc-event) {
  margin-block-end: 6px !important;
  padding-block: 2px !important;
  padding-inline: 6px !important;
}

/* 모바일 반응형 - FullCalendar 헤더 */
@media (max-width: 599.98px) {
  .full-calendar :deep(.fc-header-toolbar) {
    flex-direction: column;
    gap: 8px;
  }
  
  .full-calendar :deep(.fc-header-toolbar .fc-toolbar-chunk) {
    display: flex;
    justify-content: center;
    width: 100%;
  }
  
  .full-calendar :deep(.fc-button-group) {
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .full-calendar :deep(.fc-button) {
    font-size: 12px;
    padding: 4px 8px;
  }
  
  .full-calendar :deep(.fc-today-button) {
    font-size: 11px;
    padding: 4px 6px;
  }
  
  .full-calendar :deep(.fc-daygrid-day) {
    min-height: 80px;
  }
  
  .full-calendar :deep(.fc-daygrid-day-number) {
    font-size: 12px;
    padding: 2px;
  }
  
  .full-calendar :deep(.fc-event-title) {
    font-size: 10px;
  }
}

/* 테블릿 반응형 */
@media (min-width: 600px) and (max-width: 959.98px) {
  .full-calendar :deep(.fc-header-toolbar) {
    gap: 8px;
  }
  
  .full-calendar :deep(.fc-button) {
    font-size: 13px;
    padding: 6px 10px;
  }
  
  .full-calendar :deep(.fc-daygrid-day) {
    min-height: 100px;
  }
}

/* 지점 선택 모바일 스타일 개선 */
@media (max-width: 959.98px) {
  .branch-item {
    padding: 4px 0;
    min-height: 36px;
  }
  
  .branch-name {
    font-size: 12px;
  }
  
  .branch-title {
    font-size: 12px;
    padding-bottom: 8px;
  }
  
  .branch-header {
    padding: 8px 12px 0px 12px;
  }
  
  .branch-list-content {
    padding: 6px 12px;
  }
}

/* 이벤트 리스트 사이드바 */
.event-list-sidebar {
  z-index: 1500;
}

.event-list-header {
  padding: 16px;
}

.event-list-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: calc(100vh - 140px);
}

.event-list-scroll {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.event-list-item {
  border-radius: 8px;
  padding: 12px 16px;
  background: rgb(var(--v-theme-surface));
  cursor: pointer;
  transition: all 0.2s ease;
}

.event-list-item:hover {
  background: rgba(var(--v-theme-primary), 0.08);
  transform: translateX(4px);
}

.event-list-item .v-list-item-title {
  color: rgb(var(--v-theme-on-surface));
}

.event-list-item .v-list-item-subtitle {
  color: rgba(var(--v-theme-on-surface), 0.7);
}
</style>

