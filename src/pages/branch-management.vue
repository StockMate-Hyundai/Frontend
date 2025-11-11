<!-- File: src/pages/branch-management.vue -->
<script setup>
import { apiGetUsersPublic } from '@/api/user'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

/* ==========================
   페이지 메타
========================== */
definePage({
  meta: {
    title: '지점 관리',
    icon: 'bx-map',
    requiresAuth: true,
  },
})

/* ==========================
   상태
========================== */
const router = useRouter()

const mapContainer = ref(null)
const branchListContainer = ref(null)
let map = null
let markers = []               // 카카오 마커 배열
const mapLoading = ref(false)

const usersData = ref([])      // API 원본
const selectedUserId = ref(null)  // 선택된 지점 ID

// 검색/필터
const searchQuery = ref('')
const selectedRole = ref(null)
const selectedStatus = ref(null)

// Kakao APP KEY
const KAKAO_APP_KEY = '0aae18be49caa8fd1b6bc925b8e698d7'

/* ==========================
   Kakao SDK 로더 (1회만)
========================== */
let kakaoLoadPromise = null

const loadKakaoMapScript = () => {
  if (window.kakao?.maps) return Promise.resolve()
  if (kakaoLoadPromise) return kakaoLoadPromise

  kakaoLoadPromise = new Promise((resolve, reject) => {
    if (!KAKAO_APP_KEY || KAKAO_APP_KEY === 'YOUR_KAKAO_APP_KEY') {
      reject(new Error('카카오 지도 앱 키가 설정되지 않았습니다.'))
      
      return
    }

    const script = document.createElement('script')

    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&libraries=services,clusterer&autoload=false`
    script.async = true
    script.onload = () => {
      window.kakao.maps.load(() => resolve())
    }
    script.onerror = e => reject(new Error('카카오 지도 SDK 로드 실패(키 또는 네트워크 오류)'))
    document.head.appendChild(script)
  })
  
  return kakaoLoadPromise
}

/* ==========================
   지도 초기화
========================== */
const initMap = async () => {
  if (!mapContainer.value || map) return
  mapLoading.value = true
  try {
    await loadKakaoMapScript()

    const { kakao } = window

    const options = {
      center: new kakao.maps.LatLng(37.5665, 126.9780), // 서울 시청 근방
      level: 6,
    }

    map = new kakao.maps.Map(mapContainer.value, options)

    // 컨트롤
    const zoomControl = new kakao.maps.ZoomControl()

    map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT)

    // 클러스터러 비활성화 (초록색 오버레이 제거)
    // clusterer = null

    // 첫 마커 렌더
    addMarkers()
  } catch (err) {
    console.error('지도 초기화 실패:', err)
    alert('지도를 불러올 수 없습니다.\n' + err.message)
  } finally {
    mapLoading.value = false
  }
}

/* ==========================
   데이터 조회
========================== */
const fetchUsers = async () => {
  try {
    const dto = await apiGetUsersPublic({ page: 0, size: 1000 })

    usersData.value = Array.isArray(dto?.content) ? dto.content : []
  } catch (error) {
    console.error('[fetchUsers] error', error)
    usersData.value = []
  }
}

/* ==========================
   필터링된 사용자 목록
========================== */
const filteredUsers = computed(() => {
  let list = usersData.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()

    list = list.filter(u =>
      (u.storeName || '').toLowerCase().includes(q) ||
      (u.owner || '').toLowerCase().includes(q) ||
      (u.address || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q),
    )
  }
  if (selectedRole.value) {
    list = list.filter(u => (u.role || '').toUpperCase() === selectedRole.value)
  }
  if (selectedStatus.value) {
    list = list.filter(u => (u.verified || '').toUpperCase() === selectedStatus.value)
  }
  
  return list
})

/* ==========================
   마커 그리기
========================== */
const clearMarkers = () => {
  if (markers.length) {
    markers.forEach(m => m.setMap(null))
    markers = []
  }
}

const addMarkers = () => {
  if (!map) return
  clearMarkers()

  const { kakao } = window

  // 모든 지점을 지도에 표시 (필터링 없이)
  const list = usersData.value

  list.forEach(user => {
    if (!user.latitude || !user.longitude) return
    const pos = new kakao.maps.LatLng(user.latitude, user.longitude)

    // 상태별 마커 색상
    const markerColors = {
      ACTIVE: '#4CAF50',    // 초록
      PENDING: '#FF9800',   // 주황
      DISABLED: '#9E9E9E',  // 회색
    }

    const markerColor = markerColors[user.verified] || markerColors.DISABLED

    // 커스텀 마커 이미지
    const imageSrc = `data:image/svg+xml;base64,${btoa(`
      <svg width="30" height="40" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.7 0 0 6.7 0 15c0 11.5 15 25 15 25s15-13.5 15-25C30 6.7 23.3 0 15 0z" fill="${markerColor}"/>
        <circle cx="15" cy="15" r="8" fill="white"/>
      </svg>
    `)}`

    const imageSize = new kakao.maps.Size(30, 40)
    const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize)

    const marker = new kakao.maps.Marker({ 
      position: pos,
      image: markerImage,
    })

    // 심플 인포윈도우(hover) - 상태 표시
    const statusText = user.verified === 'ACTIVE' ? '🟢 활성' : user.verified === 'PENDING' ? '🟡 대기' : '🔴 비활성'
    const statusColor = user.verified === 'ACTIVE' ? '#4CAF50' : user.verified === 'PENDING' ? '#FF9800' : '#9E9E9E'

    const html = `
      <div style="padding:16px;min-width:200px;max-width:280px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <div style="width:8px;height:8px;border-radius:50%;background:${statusColor}"></div>
          <div style="font-weight:700;font-size:14px;color:#1a1a1a">
            ${user.storeName || '지점명 없음'}
          </div>
        </div>
        ${user.owner ? `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
            <span style="font-size:11px;color:#666;">대표자</span>
            <span style="font-size:12px;color:#333;font-weight:500">${user.owner}</span>
          </div>
        ` : ''}
        ${user.address ? `
          <div style="display:flex;align-items:start;gap:6px">
            <span style="font-size:11px;color:#666;">주소</span>
            <span style="font-size:11px;color:#555;line-height:1.4">${user.address}</span>
          </div>
        ` : ''}
      </div>`

    const iw = new kakao.maps.InfoWindow({ content: html, removable: false })

    marker.infoWindow = iw  // 마커에 인포윈도우 참조 저장

    kakao.maps.event.addListener(marker, 'mouseover', () => iw.open(map, marker))
    kakao.maps.event.addListener(marker, 'mouseout', () => iw.close())
    
    // 마커 클릭 시 인포윈도우 닫고 리스트에서 해당 지점 토글
    kakao.maps.event.addListener(marker, 'click', () => {
      iw.close()  // 인포윈도우 먼저 닫기
      selectBranch(user, true)  // fromMarker=true로 전달
    })

    markers.push(marker)
  })

  // 마커 추가 (클러스터 비활성화)
  markers.forEach(m => m.setMap(map))

  // 지도 범위
  if (markers.length) {
    const bounds = new window.kakao.maps.LatLngBounds()

    markers.forEach(m => bounds.extend(m.getPosition()))
    map.setBounds(bounds, 80)
  }
}

/* ==========================
   지점 선택 및 이동
========================== */
const selectBranch = (user, fromMarker = false) => {
  // 토글 로직: 같은 것을 클릭하면 닫기, 다른 것을 클릭하면 열기
  const userId = user.id || user.memberId
  if (selectedUserId.value === userId) {
    selectedUserId.value = null
    
    // 닫을 때도 마커에서 호출된 경우 인포윈도우 닫기
    if (fromMarker && map) {
      markers.forEach(m => {
        const infoWindow = m.infoWindow
        if (infoWindow) infoWindow.close()
      })
    }
  } else {
    selectedUserId.value = userId
  
    // 지도에서 해당 위치로 이동 (리스트에서 클릭한 경우에만)
    if (!fromMarker && map && user.latitude && user.longitude) {
      const position = new window.kakao.maps.LatLng(user.latitude, user.longitude)

      map.panTo(position)
      
      // 모든 인포윈도우 닫기 (리스트에서 클릭한 경우)
      markers.forEach(m => {
        const infoWindow = m.infoWindow
        if (infoWindow) infoWindow.close()
      })
    }
    
    // 리스트에서 해당 아이템이 보이도록 스크롤
    if (branchListContainer.value) {
      nextTick(() => {
        const itemElement = branchListContainer.value.querySelector(`[data-user-id="${userId}"]`)
        if (itemElement) {
          itemElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      })
    }
  }
}

const goToUserDetail = user => {
  const memberId = user.memberId || user.id
  if (!memberId) return
  router.push({ name: 'user-detail-id', params: { id: String(memberId) } })
}

/* ==========================
   필터 유틸
========================== */
const toggleRole = role => {
  selectedRole.value = selectedRole.value === role ? null : role
}

const toggleStatus = status => {
  selectedStatus.value = selectedStatus.value === status ? null : status
}

const onReset = () => {
  searchQuery.value = ''
  selectedRole.value = null
  selectedStatus.value = null
}

/* ==========================
   역할/상태 라벨 및 변형
========================== */
const ROLE_LABELS = {
  USER: '일반',
  ADMIN: '관리자',
  SUPER_ADMIN: '최고관리자',
  WAREHOUSE: '창고관리자',
}

const STATUS_LABELS = {
  ACTIVE: '활성',
  PENDING: '대기',
  DISABLED: '비활성',
}

const resolveRoleVariant = role => {
  const r = String(role || '').toLowerCase()
  if (r === 'admin') return { color: 'warning', icon: 'bx-badge-check' }
  if (r === 'super_admin') return { color: 'error', icon: 'bx-crown' }
  if (r === 'warehouse') return { color: 'info', icon: 'bx-home-alt' }
  
  return { color: 'primary', icon: 'bx-user' }
}

const resolveStatusVariant = status => {
  const s = String(status || '').toUpperCase()
  if (s === 'PENDING') return 'warning'
  if (s === 'ACTIVE') return 'success'
  if (s === 'DISABLED') return 'secondary'
  
  return 'primary'
}

const roles = [
  { title: '일반', value: 'USER' },
  { title: '관리자', value: 'ADMIN' },
  { title: '최고관리자', value: 'SUPER_ADMIN' },
  { title: '창고관리자', value: 'WAREHOUSE' },
]

const statuses = [
  { title: '활성', value: 'ACTIVE' },
  { title: '대기', value: 'PENDING' },
  { title: '비활성', value: 'DISABLED' },
]

/* ==========================
   리사이즈 중심 유지
========================== */
const keepCenterOnResize = () => {
  if (!map) return
  const c = map.getCenter()

  window.kakao.maps.event.trigger(map, 'resize')
  map.setCenter(c)
}

/* ==========================
   라이프사이클 & 반응
========================== */
onMounted(async () => {
  await fetchUsers()
  await initMap()
  window.addEventListener('resize', keepCenterOnResize)
})

onBeforeUnmount(() => {
  clearMarkers()
  window.removeEventListener('resize', keepCenterOnResize)
})

// 필터 변경 시 마커 재렌더 제거 - 이제 모든 지점을 항상 표시
</script>

<template>
  <div class="branch-management-page">
    <!-- 헤더 -->
    <div class="page-header">
      <h6 class="text-h6 text-high-emphasis mb-0">
        지점 관리
      </h6>
      <div class="d-flex align-center gap-2">
        <VIcon
          icon="bx-refresh"
          size="20"
          class="cursor-pointer"
          @click="fetchUsers"
        />
      </div>
    </div>

    <!-- 메인: 왼쪽 리스트 + 오른쪽 지도 -->
    <div class="main-content">
      <!-- 왼쪽: 지점 리스트 -->
      <VCard class="branch-list-panel">
        <VCardText>
          <div class="branch-list-header">
            <h6 class="text-h6 mb-0">
              지점 목록
            </h6>
            <div class="text-body-2 text-medium-emphasis">
              {{ filteredUsers.length }}개
            </div>
          </div>
          
          <!-- 검색 -->
          <div class="branch-search">
            <VTextField
              v-model="searchQuery"
              placeholder="지점명, 주소 검색..."
              density="compact"
              variant="outlined"
              prepend-inner-icon="bx-search"
              clearable
              hide-details
            />
          </div>

          <!-- 리스트 -->
          <div
            ref="branchListContainer"
            class="branch-list"
          >
            <div
              v-for="user in filteredUsers"
              :key="user.id || user.memberId"
              class="branch-item-wrapper"
              :data-user-id="user.id || user.memberId"
            >
              <!-- 기본 아이템 -->
              <div
                class="branch-item"
                :class="{ 'selected': selectedUserId === (user.id || user.memberId) }"
                @click="selectBranch(user)"
              >
                <div class="branch-item-icon">
                  <VIcon
                    size="24"
                    icon="bx-store"
                    :color="user.verified === 'ACTIVE' ? 'success' : user.verified === 'PENDING' ? 'warning' : 'secondary'"
                  />
                </div>
                <div class="branch-item-content">
                  <div class="branch-item-name">
                    {{ user.storeName || user.owner || '지점명 없음' }}
                  </div>
                  <div class="branch-item-location">
                    {{ user.address || '위치 정보 없음' }}
                  </div>
                </div>
                <div class="branch-item-arrow">
                  <VIcon
                    size="20"
                    :icon="selectedUserId === (user.id || user.memberId) ? 'bx-chevron-down' : 'bx-chevron-right'"
                    color="medium-emphasis"
                  />
                </div>
              </div>
              
              <!-- 확장된 상세 정보 -->
              <VExpandTransition>
                <div
                  v-if="selectedUserId === (user.id || user.memberId)"
                  class="branch-detail-expanded"
                >
                  <VDivider class="mb-3" />
                  
                  <div class="detail-info">
                    <div class="detail-row">
                      <div class="detail-label">
                        대표자
                      </div>
                      <div class="detail-value">
                        {{ user.owner || 'N/A' }}
                      </div>
                    </div>
                    <div class="detail-row">
                      <div class="detail-label">
                        이메일
                      </div>
                      <div class="detail-value">
                        {{ user.email || 'N/A' }}
                      </div>
                    </div>
                    <div class="detail-row">
                      <div class="detail-label">
                        사업자번호
                      </div>
                      <div class="detail-value">
                        {{ user.businessNumber || 'N/A' }}
                      </div>
                    </div>
                    <div class="detail-row">
                      <div class="detail-label">
                        역할
                      </div>
                      <VChip
                        :color="resolveRoleVariant(user.role).color"
                        size="small"
                        variant="tonal"
                      >
                        <VIcon
                          :size="16"
                          :icon="resolveRoleVariant(user.role).icon"
                          class="me-1"
                        />
                        {{ ROLE_LABELS[(user.role || '').toUpperCase()] || user.role }}
                      </VChip>
                    </div>
                    <div class="detail-row">
                      <div class="detail-label">
                        상태
                      </div>
                      <VChip
                        :color="resolveStatusVariant(user.verified)"
                        size="small"
                        variant="tonal"
                      >
                        {{ STATUS_LABELS[(user.verified || '').toUpperCase()] || user.verified }}
                      </VChip>
                    </div>
                    <div class="detail-row">
                      <div class="detail-label">
                        좌표
                      </div>
                      <div class="detail-value">
                        {{ user.latitude && user.longitude
                          ? `${Number(user.latitude).toFixed(6)}, ${Number(user.longitude).toFixed(6)}`
                          : 'N/A' }}
                      </div>
                    </div>
                  </div>
                  
                  <VBtn
                    color="primary"
                    size="small"
                    block
                    class="mt-3"
                    @click.stop="goToUserDetail(user)"
                  >
                    상세보기
                  </VBtn>
                </div>
              </VExpandTransition>
            </div>
          </div>
        </VCardText>
      </VCard>

      <!-- 오른쪽: 지도 -->
      <div class="map-wrapper">
        <div
          ref="mapContainer"
          class="map-container"
        />
        <div
          v-if="mapLoading"
          class="map-loading-overlay"
        >
          <VProgressCircular
            indeterminate
            color="primary"
          />
          <p class="mt-2">
            지도 로딩 중...
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.branch-management-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--erp-bg-primary);
}

/* 헤더 */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--erp-bg-secondary);
  border-bottom: 1px solid var(--erp-border-light);
  flex-shrink: 0;
}

/* 메인: 왼쪽 리스트 + 오른쪽 지도 */
.main-content {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  gap: 0;
  overflow: hidden;
  max-height: 80vh;
}

/* 왼쪽: 지점 리스트 패널 */
.branch-list-panel {
  flex: 0 0 320px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0;
}
.branch-list-panel :deep(.v-card-text) {
  display: flex;
  flex-direction: column;
  padding: 16px;
  height: 100%;
  overflow: hidden;
}

.branch-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.branch-search {
  margin-bottom: 12px;
  flex-shrink: 0;
}

.branch-list {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
}

.branch-item-wrapper {
  margin-bottom: 8px;
}

.branch-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}
.branch-item:hover {
  background: var(--erp-bg-secondary);
}
.branch-item.selected {
  background: var(--erp-bg-secondary);
}

.branch-item-icon {
  flex-shrink: 0;
}

.branch-item-content {
  flex: 1;
  min-width: 0;
}

.branch-item-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--erp-text-high-emphasis);
  margin-bottom: 4px;
}

.branch-item-location {
  font-size: 12px;
  color: var(--erp-text-medium-emphasis);
}

.branch-item-arrow {
  flex-shrink: 0;
}

/* 확장된 상세 정보 */
.branch-detail-expanded {
  padding: 16px 12px 12px;
}

.detail-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.detail-label {
  font-size: 12px;
  color: var(--erp-text-medium-emphasis);
  font-weight: 500;
  flex-shrink: 0;
}

.detail-value {
  font-size: 13px;
  color: var(--erp-text-high-emphasis);
  text-align: right;
  flex: 1;
}

/* 오른쪽: 지도 */
.map-wrapper {
  flex: 1 1 auto;
  position: relative;
  min-height: 0;
}
.map-container {
  width: 100%;
  height: 100%;
}

.map-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  z-index: 1000;
}
</style>
