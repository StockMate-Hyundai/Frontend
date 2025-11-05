<!-- File: src/pages/warehouse-navigation.vue -->
<script setup>
import { fetchOrdersForTable } from '@/api/order'
import { calculateOptimalRoute, compareAllAlgorithms } from '@/api/parts'
import { calculateOptimalPath } from '@/utils/pathfinding'
import { getPedometer } from '@/utils/pedometer'
import PartWarehouse3D from '@/views/parts/view/PartWarehouse3D.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { PerfectScrollbar } from 'vue3-perfect-scrollbar'

definePage({
  meta: {
    title: '창고 네비게이션',
    icon: 'bx-navigation',
    requiresAuth: true,
  },
})

/* =========================
   상태
========================= */
const loading = ref(false)
const errorMsg = ref('')
const orderNumbers = ref([])
const orderNumberInput = ref('')
const navigationResult = ref(null)
const comparisonResult = ref(null)
const showComparison = ref(false)
const warehouse3DRef = ref(null)
const isAnimating = ref(false)
const isStepAnimationActive = ref(false)
const currentStepIndex = ref(-1)
const highlightLocations = ref([]) // 하이라이트할 위치 목록
const pathfindingGrid = ref(null) // 경로 탐색 그리드 데이터
const stepCount = ref(0) // 스탭 카운터
const isNavigating = ref(false) // 네비게이션 진행 중 여부
const navigationInterval = ref(null) // 스탭 증가 인터벌
const pedometer = ref(null) // 걸음수 측정 인스턴스
const pedometerConnectionStatus = ref({
  text: '연결 확인 중...',
  class: 'text-warning',
}) // 걸음수 측정 연결 상태

// 최근 주문 목록
const recentOrders = ref([])
const loadingOrders = ref(false)

// 경로 정보 탭 관리
const expandedTabs = ref([]) // 확장된 탭들의 인덱스 배열
const routeTabs = ref([]) // 경로 정보 탭 데이터 배열

function toggleTab(index) {
  const idx = expandedTabs.value.indexOf(index)
  if (idx > -1) {
    expandedTabs.value.splice(idx, 1)
  } else {
    expandedTabs.value.push(index)
  }
}

function isTabExpanded(index) {
  return expandedTabs.value.includes(index)
}

/* =========================
   최근 주문 목록 로드
========================= */
async function loadRecentOrders() {
  loadingOrders.value = true
  try {
    const result = await fetchOrdersForTable({
      page: 1,
      itemsPerPage: 50,
      filters: {},
    })
    
    recentOrders.value = (result.rows || []).map(order => ({
      orderId: order.orderId,
      orderNumber: order.orderNumber || `#${order.orderId}`,
      createdAt: order.createdAt,
      customer: order.customer || '-',
    }))
  } catch (e) {
    console.error('[loadRecentOrders] error:', e)
    recentOrders.value = []
  } finally {
    loadingOrders.value = false
  }
}

/* =========================
   주문 번호 관리
========================= */
function addOrderNumber() {
  const num = orderNumberInput.value.trim()
  if (!num) return
  
  if (!orderNumbers.value.includes(num)) {
    orderNumbers.value.push(num)
  }
  orderNumberInput.value = ''
}

function removeOrderNumber(num) {
  const index = orderNumbers.value.indexOf(num)
  if (index > -1) {
    orderNumbers.value.splice(index, 1)
  }
}

function addOrderFromList(orderNumber) {
  if (!orderNumbers.value.includes(orderNumber)) {
    orderNumbers.value.push(orderNumber)
  }
}

function clearOrderNumbers() {
  orderNumbers.value = []
  navigationResult.value = null
  comparisonResult.value = null
  highlightLocations.value = []
  routeTabs.value = []
  expandedTabs.value = []
}

/* =========================
   최적 경로 계산
========================= */
async function calculateRoute() {
  if (orderNumbers.value.length === 0) {
    errorMsg.value = '주문 번호를 입력해주세요.'
    
    return
  }
  
  loading.value = true
  errorMsg.value = ''
  navigationResult.value = null
  
  try {
    // API에서 주문 정보 가져오기
    console.log('[calculateRoute] API 호출 시작:', orderNumbers.value)
    
    let apiResult = null
    try {
      apiResult = await calculateOptimalRoute(orderNumbers.value)
      console.log('[calculateRoute] API 응답 (raw):', apiResult)
      console.log('[calculateRoute] API 응답 타입:', typeof apiResult)
      console.log('[calculateRoute] API 응답 구조:', {
        optimizedRoute: apiResult?.optimizedRoute,
        locations: apiResult?.locations,
        orderItems: apiResult?.orderItems,
        keys: apiResult ? Object.keys(apiResult) : [],
      })
    } catch (apiError) {
      console.error('[calculateRoute] API 호출 실패:', apiError)
      console.error('[calculateRoute] API 에러 응답:', apiError?.response?.data)
      throw new Error(`API 호출 실패: ${apiError?.message || '알 수 없는 오류'}`)
    }
    
    if (!apiResult) {
      throw new Error('API 응답이 없습니다.')
    }
    
    // API 응답에서 location 배열 추출
    let locations = []
    
    // API 응답 구조 확인 및 location 추출
    if (apiResult?.optimizedRoute && Array.isArray(apiResult.optimizedRoute)) {
      console.log('[calculateRoute] optimizedRoute에서 locations 추출')
      locations = apiResult.optimizedRoute
        .filter(step => {
          const loc = typeof step === 'string' ? step : step.location
          
          return loc && loc !== '문' && loc !== '포장대'
        })
        .map(step => {
          const loc = typeof step === 'string' ? step : step.location

          // "-" 전까지만 추출 (예: "A0-1" -> "A0")
          return loc ? loc.split('-')[0] : loc
        })
    } else if (apiResult?.locations && Array.isArray(apiResult.locations)) {
      console.log('[calculateRoute] locations 필드에서 추출')

      // locations 필드가 직접 있는 경우
      locations = apiResult.locations
        .map(loc => {
          // "-" 전까지만 추출 (예: "A0-1" -> "A0")
          return loc ? loc.split('-')[0] : loc
        })
        .filter(loc => loc && loc !== '문' && loc !== '포장대')
    } else if (apiResult?.orderItems && Array.isArray(apiResult.orderItems)) {
      console.log('[calculateRoute] orderItems에서 locations 추출')

      // orderItems에서 location 추출
      locations = apiResult.orderItems
        .map(item => {
          const loc = item?.partDetail?.location || item?.location

          // "-" 전까지만 추출 (예: "A0-1" -> "A0")
          return loc ? loc.split('-')[0] : loc
        })
        .filter(loc => loc && loc !== '문' && loc !== '포장대')
    } else {
      console.warn('[calculateRoute] 알 수 없는 API 응답 구조:', apiResult)

      // 마지막 시도: 모든 필드를 확인
      for (const key in apiResult) {
        if (Array.isArray(apiResult[key])) {
          console.log(`[calculateRoute] 배열 필드 발견: ${key}`, apiResult[key])

          // 배열의 첫 번째 항목 구조 확인
          if (apiResult[key].length > 0) {
            const firstItem = apiResult[key][0]

            console.log(`[calculateRoute] ${key}[0] 구조:`, firstItem)
            if (typeof firstItem === 'string' || firstItem?.location) {
              locations = apiResult[key]
                .map(item => {
                  const loc = typeof item === 'string' ? item : item.location
                  
                  return loc ? loc.split('-')[0] : loc
                })
                .filter(loc => loc && loc !== '문' && loc !== '포장대')
              break
            }
          }
        }
      }
    }
    
    console.log('[calculateRoute] 추출된 locations:', locations)
     
    if (locations.length === 0) {
      console.warn('[calculateRoute] locations가 비어있습니다. API 응답 전체:', JSON.stringify(apiResult, null, 2))
    }
    
    // 프론트엔드 경로 탐색 알고리즘으로 경로 재계산 ('x' 장애물 처리)
    if (locations.length > 0) {
      console.log('[calculateRoute] 경로 탐색 시작')

      const pathResult = calculateOptimalPath(locations)

      console.log('[calculateRoute] 경로 탐색 결과:', pathResult)
      
      // API 결과와 프론트엔드 경로 결과 병합
      navigationResult.value = {
        ...apiResult,
        optimizedRoute: pathResult.optimizedRoute,
        totalDistance: pathResult.totalDistance,
        fullPath: pathResult.fullPath,
      }
      
      // 그리드 데이터를 3D 뷰에 전달
      console.log('[calculateRoute] 그리드 데이터 전달:', pathResult.grid)
      console.log('[calculateRoute] 그리드 타입:', typeof pathResult.grid, Array.isArray(pathResult.grid))
      if (pathResult.grid) {
        console.log('[calculateRoute] 그리드 크기:', pathResult.grid.length, 'x', pathResult.grid[0]?.length)
      }
      pathfindingGrid.value = pathResult.grid
      console.log('[calculateRoute] pathfindingGrid.value 설정됨:', pathfindingGrid.value)
      
      // DOM 업데이트 후 그리드 다시 그리기
      await nextTick()
    } else {
      console.warn('[calculateRoute] locations가 없어 API 결과를 그대로 사용')
      navigationResult.value = apiResult
    }
    
    // 3D 뷰에 하이라이트 표시
    await nextTick()
    
    // 하이라이트할 locations: API에서 추출한 원본 locations + 경로 탐색 결과의 locations
    const highlightSet = new Set()
    
    // 1. API에서 추출한 원본 locations (모든 방문할 위치)
    if (locations && locations.length > 0) {
      locations.forEach(loc => {
        if (loc && loc !== '문' && loc !== '포장대') {
          // "A0" 형식이면 "A0-1"로 변환, 이미 "A0-1" 형식이면 그대로 사용
          const formattedLoc = loc.includes('-') ? loc : `${loc}-1`

          highlightSet.add(formattedLoc)
        }
      })
    }
    
    // 2. 경로 탐색 결과의 optimizedRoute에서도 추출
    if (navigationResult.value?.optimizedRoute) {
      navigationResult.value.optimizedRoute.forEach(step => {
        const loc = step.location || step
        if (loc && loc !== '문' && loc !== '포장대') {
          // "A0" 형식이면 "A0-1"로 변환, 이미 "A0-1" 형식이면 그대로 사용
          const formattedLoc = loc.includes('-') ? loc : `${loc}-1`

          highlightSet.add(formattedLoc)
        }
      })
    }
    
    // 3. API 응답의 orderItems에서도 location 추출 (추가 보장)
    if (apiResult?.orderItems && Array.isArray(apiResult.orderItems)) {
      apiResult.orderItems.forEach(item => {
        const loc = item?.partDetail?.location || item?.location
        if (loc && loc !== '문' && loc !== '포장대') {
          // "-" 전까지만 추출 (예: "A0-1" -> "A0")
          const baseLoc = loc.split('-')[0]
          const formattedLoc = `${baseLoc}-1`

          highlightSet.add(formattedLoc)
        }
      })
    }
    
    highlightLocations.value = Array.from(highlightSet)
    console.log('[calculateRoute] 하이라이트 locations (중복 제거):', highlightLocations.value)
    console.log('[calculateRoute] 하이라이트 locations 개수:', highlightLocations.value.length)
    
    // 경로 표시 확인
    console.log('[calculateRoute] 최종 navigationResult:', navigationResult.value)
    console.log('[calculateRoute] optimizedRoute:', navigationResult.value?.optimizedRoute)
    
    // 경로 정보 탭 생성
    createRouteTabs()
  } catch (e) {
    console.error('[calculateRoute] error:', e)
    errorMsg.value = e?.message || '경로 계산 중 오류가 발생했습니다.'
    navigationResult.value = null
    routeTabs.value = []
  } finally {
    loading.value = false
  }
}

/* =========================
   경로 정보 탭 생성
========================= */
function createRouteTabs() {
  if (!navigationResult.value) {
    routeTabs.value = []
    
    return
  }
  
  // 각 주문별로 탭 생성 또는 전체 경로를 하나의 탭으로 생성
  const tabs = []
  
  // 전체 경로 정보 탭
  tabs.push({
    id: 'overview',
    title: '전체 경로 정보',
    type: 'overview',
    data: navigationResult.value,
  })
  
  // 경로 단계별 탭
  if (navigationResult.value.optimizedRoute && navigationResult.value.optimizedRoute.length > 0) {
    tabs.push({
      id: 'route-steps',
      title: '경로 단계',
      type: 'steps',
      data: navigationResult.value.optimizedRoute,
    })
  }
  
  // 주문별 상세 정보 탭
  if (navigationResult.value.orderItems && navigationResult.value.orderItems.length > 0) {
    const orderGroups = {}

    navigationResult.value.orderItems.forEach(item => {
      const orderNum = item.orderNumber || '미지정'
      if (!orderGroups[orderNum]) {
        orderGroups[orderNum] = []
      }
      orderGroups[orderNum].push(item)
    })
    
    Object.entries(orderGroups).forEach(([orderNum, items]) => {
      tabs.push({
        id: `order-${orderNum}`,
        title: `주문 ${orderNum}`,
        type: 'order',
        data: { orderNumber: orderNum, items },
      })
    })
  }
  
  routeTabs.value = tabs

  // 기본적으로 첫 번째 탭만 확장
  expandedTabs.value = [0]
}

/* =========================
   알고리즘 비교
========================= */
async function compareAlgorithms() {
  if (orderNumbers.value.length === 0) {
    errorMsg.value = '주문 번호를 입력해주세요.'
    
    return
  }
  
  loading.value = true
  errorMsg.value = ''
  comparisonResult.value = null
  
  try {
    const result = await compareAllAlgorithms(orderNumbers.value)

    comparisonResult.value = result
    showComparison.value = true
  } catch (e) {
    console.error('[compareAlgorithms] error:', e)
    errorMsg.value = e?.message || '알고리즘 비교 중 오류가 발생했습니다.'
    comparisonResult.value = null
  } finally {
    loading.value = false
  }
}

/* =========================
   애니메이션 컨트롤
========================= */
function startAnimation() {
  if (warehouse3DRef.value) {
    warehouse3DRef.value.startPathAnimation()
    isAnimating.value = true
  }
}

function stopAnimation() {
  if (warehouse3DRef.value) {
    warehouse3DRef.value.stopPathAnimation()
    isAnimating.value = false
  }
}

// 기존 경유지별 이동 기능 (수동 이동)
function startStepAnimation() {
  if (warehouse3DRef.value) {
    warehouse3DRef.value.startStepAnimation()
    isStepAnimationActive.value = true
    
    // 현재 상태 업데이트를 위한 간격 체크
    const checkStatus = setInterval(() => {
      if (warehouse3DRef.value) {
        isStepAnimationActive.value = warehouse3DRef.value.getIsStepAnimationActive()
        currentStepIndex.value = warehouse3DRef.value.getCurrentStepIndex()
        if (!isStepAnimationActive.value) {
          clearInterval(checkStatus)
        }
      }
    }, 100)
  }
}

// 새로운 스탭 기반 네비게이션 기능
async function startNavigation() {
  if (warehouse3DRef.value) {
    try {
      // 걸음수 측정 초기화
      pedometer.value = getPedometer()
      await pedometer.value.initialize()
      
      // 걸음수 업데이트 콜백 설정
      pedometer.value.onStepUpdate(steps => {
        console.log('[startNavigation] [콜백] 걸음수 업데이트:', steps)
        stepCount.value = steps
        console.log('[startNavigation] [콜백] stepCount.value 업데이트:', stepCount.value)
        
        // 첫 번째 걸음수 업데이트 시 연결 성공으로 표시
        if (pedometerConnectionStatus.value.text !== '✓ 센서 연결됨' && steps >= 0) {
          pedometerConnectionStatus.value = {
            text: '✓ 센서 연결됨 (데이터 수신 중)',
            class: 'text-success',
          }
          console.log('[startNavigation] [콜백] ✓ 센서 데이터 수신 확인, 첫 걸음수:', steps)
        }
        
        // 스탭에 따라 경로를 따라 이동
        if (warehouse3DRef.value) {
          console.log('[startNavigation] [콜백] moveAlongPathBySteps 호출, steps:', stepCount.value)
          warehouse3DRef.value.moveAlongPathBySteps(stepCount.value)
        } else {
          console.warn('[startNavigation] [콜백] warehouse3DRef.value가 없음')
        }
        
        // 경로가 끝나면 정지
        if (warehouse3DRef.value && warehouse3DRef.value.isPathComplete()) {
          console.log('[startNavigation] [콜백] 경로 완료, 네비게이션 중지')
          stopNavigation()
        }
      })
      
      // 스탭 초기화 및 네비게이션 시작
      stepCount.value = 0
      isNavigating.value = true
      
      // 시작 위치에 현재 위치 마커 표시
      warehouse3DRef.value.showCurrentPosition(true)
      
      // 걸음수 측정 시작
      console.log('[startNavigation] startTracking() 호출 전')
      pedometerConnectionStatus.value = {
        text: '센서 연결 시도 중...',
        class: 'text-warning',
      }
      
      try {
        await pedometer.value.startTracking()
        console.log('[startNavigation] startTracking() 완료')
        console.log('[startNavigation] 네비게이션 시작, 걸음수 측정 활성화')
        
        // 연결 성공 확인을 위해 잠시 대기 후 상태 확인
        setTimeout(() => {
          if (pedometer.value && pedometer.value.trackingStatus) {
            pedometerConnectionStatus.value = {
              text: '✓ 센서 연결됨',
              class: 'text-success',
            }
            console.log('[startNavigation] ✓ 센서 연결 확인 완료')
          } else {
            pedometerConnectionStatus.value = {
              text: '⚠ 센서 연결 실패 (데이터 수신 대기 중...)',
              class: 'text-warning',
            }
            console.warn('[startNavigation] ⚠ 센서 데이터 수신 대기 중...')
          }
        }, 2000)
      } catch (trackingError) {
        pedometerConnectionStatus.value = {
          text: '✗ 센서 연결 오류',
          class: 'text-error',
        }
        console.error('[startNavigation] 센서 연결 오류:', trackingError)
        throw trackingError
      }
    } catch (error) {
      console.error('[startNavigation] 네비게이션 시작 실패:', error)
      console.error('[startNavigation] 에러 메시지:', error.message)
      console.error('[startNavigation] 에러 스택:', error.stack)
      
      // 플랫폼 확인
      const { Capacitor } = await import('@capacitor/core')
      const platform = Capacitor.getPlatform()
      const isNative = Capacitor.isNativePlatform()
      
      console.error('[startNavigation] 현재 플랫폼:', platform)
      console.error('[startNavigation] 네이티브 여부:', isNative)

      // 웹 환경이거나 플러그인을 사용할 수 없는 경우 폴백
      const errorMessage = error.message || ''
      const isWebEnvironment = !isNative || platform === 'web'
      const isInitializationError = errorMessage.includes('초기화') || errorMessage.includes('사용할 수 없') || errorMessage.includes('플러그인')
      
      if (isWebEnvironment || isInitializationError) {
        // 폴백: 시간 기반 시뮬레이션
        console.warn('[startNavigation] 폴백 모드: 시간 기반 시뮬레이션 사용')
        console.warn('[startNavigation] 이유 - 플랫폼:', platform, ', 네이티브:', isNative, ', 에러:', errorMessage)
        
        pedometerConnectionStatus.value = {
          text: '⚠ 시뮬레이션 모드 (실제 센서 사용 불가)',
          class: 'text-warning',
        }
        stepCount.value = 0
        isNavigating.value = true
        warehouse3DRef.value.showCurrentPosition(true)
        
        navigationInterval.value = setInterval(() => {
          stepCount.value++
          
          if (warehouse3DRef.value) {
            warehouse3DRef.value.moveAlongPathBySteps(stepCount.value)
          }
          
          if (warehouse3DRef.value && warehouse3DRef.value.isPathComplete()) {
            stopNavigation()
          }
        }, 1000)
      } else {
        const alertMessage = `걸음수 측정을 시작할 수 없습니다.\n\n플랫폼: ${platform}\n네이티브: ${isNative}\n에러: ${errorMessage}\n\n앱 환경에서 실행해주세요.`
        console.error('[startNavigation]', alertMessage)
        alert(alertMessage)
      }
    }
  }
}


function nextStep() {
  if (warehouse3DRef.value && isStepAnimationActive.value) {
    warehouse3DRef.value.nextStep()
    setTimeout(() => {
      if (warehouse3DRef.value) {
        currentStepIndex.value = warehouse3DRef.value.getCurrentStepIndex()
        isStepAnimationActive.value = warehouse3DRef.value.getIsStepAnimationActive()
      }
    }, 100)
  }
}

function previousStep() {
  if (warehouse3DRef.value && isStepAnimationActive.value) {
    warehouse3DRef.value.previousStep()
    setTimeout(() => {
      if (warehouse3DRef.value) {
        currentStepIndex.value = warehouse3DRef.value.getCurrentStepIndex()
      }
    }, 100)
  }
}

function stopStepAnimation() {
  if (warehouse3DRef.value) {
    warehouse3DRef.value.stopStepAnimation()
    isStepAnimationActive.value = false
    currentStepIndex.value = -1
  }
}

function stopNavigation() {
  console.log('[stopNavigation] 네비게이션 중지 시작')
  
  // 시간 기반 인터벌 정리
  if (navigationInterval.value) {
    clearInterval(navigationInterval.value)
    navigationInterval.value = null
    console.log('[stopNavigation] 인터벌 정리 완료')
  }
  
  // 걸음수 측정 중지
  if (pedometer.value) {
    pedometer.value.stopTracking()
    console.log('[stopNavigation] 걸음수 측정 중지')
  }
  
  isNavigating.value = false
  if (warehouse3DRef.value) {
    warehouse3DRef.value.showCurrentPosition(false)
  }
  stepCount.value = 0
  
  // 연결 상태 초기화
  pedometerConnectionStatus.value = {
    text: '연결 확인 중...',
    class: 'text-warning',
  }
  
  console.log('[stopNavigation] 네비게이션 중지 완료')
}

function resetCamera() {
  if (warehouse3DRef.value) {
    warehouse3DRef.value.resetCamera()
  }
}

/* =========================
   초기화
========================= */
onMounted(() => {
  loadRecentOrders()
})

onBeforeUnmount(() => {
  // 컴포넌트 언마운트 시 정리
  stopNavigation()
  if (pedometer.value) {
    pedometer.value.stopTracking()
  }
})

/* =========================
   계산된 속성
========================= */
const totalDistance = computed(() => navigationResult.value?.totalDistance || 0)
const estimatedTime = computed(() => navigationResult.value?.estimatedTimeSeconds || 0)
const walkingTime = computed(() => navigationResult.value?.walkingTimeSeconds || 0)
const pickingTime = computed(() => navigationResult.value?.pickingTimeSeconds || 0)
const algorithmType = computed(() => navigationResult.value?.algorithmType || '')
const routeSteps = computed(() => navigationResult.value?.optimizedRoute || [])

const formatTime = seconds => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) {
    return `${mins}분 ${secs}초`
  }
  
  return `${secs}초`
}

const formatDistance = distance => {
  return `${distance}m`
}
</script>

<template>
  <div class="warehouse-navigation-page">
    <div class="page-content">
      <!-- 좌측: 주문 선택 사이드바 -->
      <div class="order-selector">
        <div class="order-header">
          <span class="order-title">주문 선택</span>
        </div>
        
        <div class="order-input-section">
          <VTextField
            v-model="orderNumberInput"
            placeholder="주문 번호 입력"
            variant="outlined"
            density="compact"
            hide-details
            class="order-input-field"
            @keyup.enter="addOrderNumber"
          >
            <template #append-inner>
              <VBtn
                icon="bx-plus"
                size="small"
                variant="text"
                @click="addOrderNumber"
              />
            </template>
          </VTextField>
        </div>
        
        <!-- 선택된 주문 목록 -->
        <div
          v-if="orderNumbers.length > 0"
          class="selected-orders-section"
        >
          <div class="selected-orders-header">
            <span class="selected-orders-title">선택된 주문 ({{ orderNumbers.length }})</span>
            <VBtn
              icon
              size="x-small"
              variant="text"
              color="error"
              @click="clearOrderNumbers"
            >
              <VIcon size="16">
                bx-trash
              </VIcon>
            </VBtn>
          </div>
          <div class="selected-orders-chips">
            <VChip
              v-for="num in orderNumbers"
              :key="num"
              closable
              size="small"
              color="primary"
              variant="tonal"
              class="order-chip"
              @click:close="removeOrderNumber(num)"
            >
              {{ num }}
            </VChip>
          </div>
        </div>
        
        <!-- 액션 버튼 -->
        <div class="action-buttons">
          <VBtn
            color="primary"
            block
            :loading="loading"
            :disabled="orderNumbers.length === 0"
            @click="calculateRoute"
          >
            최적 경로 계산
          </VBtn>
          
          <VBtn
            color="secondary"
            variant="outlined"
            block
            class="mt-2"
            :loading="loading"
            :disabled="orderNumbers.length === 0"
            @click="compareAlgorithms"
          >
            알고리즘 비교
          </VBtn>
        </div>
        
        <!-- 에러 메시지 -->
        <VAlert
          v-if="errorMsg"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-2"
        >
          {{ errorMsg }}
        </VAlert>
        
        <!-- 최근 주문 목록 -->
        <div class="recent-orders-section">
          <div class="recent-orders-header">
            <span class="recent-orders-title">최근 주문</span>
          </div>
          <div class="recent-orders-container">
            <PerfectScrollbar
              :options="{ wheelPropagation: false, suppressScrollX: true }"
              class="recent-orders-scroll"
            >
              <div class="recent-orders-content">
                <div
                  v-if="loadingOrders"
                  class="d-flex align-center justify-center py-8"
                >
                  <VProgressCircular
                    indeterminate
                    color="primary"
                    size="20"
                  />
                </div>
                
                <template v-else-if="recentOrders.length > 0">
                  <div
                    v-for="order in recentOrders"
                    :key="order.orderId"
                    class="order-item"
                    :class="{ selected: orderNumbers.includes(order.orderNumber) }"
                    @click="addOrderFromList(order.orderNumber)"
                  >
                    <div class="order-item-dot" />
                    <span class="order-item-name">{{ order.orderNumber }}</span>
                  </div>
                </template>
                
                <div
                  v-else
                  class="d-flex flex-column align-center justify-center py-8 text-center"
                >
                  <VIcon
                    icon="bx-package"
                    size="32"
                    class="mb-2 text-medium-emphasis"
                  />
                  <div class="text-caption text-medium-emphasis">
                    최근 주문이 없습니다
                  </div>
                </div>
              </div>
            </PerfectScrollbar>
          </div>
        </div>
      </div>
      
      <!-- 우측: 3D 뷰 및 경로 정보 -->
      <div class="main-content">
        <!-- 3D 창고 뷰 -->
        <div class="warehouse-view-section">
          <VCard>
            <VCardTitle class="d-flex align-center">
              <VIcon
                icon="bx-cube"
                class="me-2"
              />
              3D 창고 뷰
            </VCardTitle>
            
            <VDivider />
            
            <VCardText
              class="pa-0"
              style="position: relative;"
            >
              <div class="warehouse-container">
                <PartWarehouse3D 
                  ref="warehouse3DRef" 
                  :highlight-locations="highlightLocations"
                  :optimized-route="routeSteps"
                  :full-path="navigationResult?.fullPath || []"
                  :show-grid="false"
                  :grid-cols="25"
                  :grid-rows="38"
                  :pathfinding-grid="pathfindingGrid"
                />
                
                <!-- 애니메이션 컨트롤 -->
                <div
                  class="animation-controls"
                  style="position: absolute; top: 10px; right: 10px; z-index: 1000; background: white; padding: 12px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);"
                >
                  <!-- 일반 애니메이션 컨트롤 -->
                  <div
                    v-if="!isStepAnimationActive"
                    class="d-flex align-center gap-2 mb-2 flex-wrap"
                  >
                    <VBtn
                      size="small"
                      color="primary"
                      :disabled="isAnimating"
                      @click="startAnimation"
                    >
                      경로 재생
                    </VBtn>
                    <VBtn
                      size="small"
                      color="error"
                      :disabled="!isAnimating"
                      @click="stopAnimation"
                    >
                      중지
                    </VBtn>
                    <VBtn
                      v-if="routeSteps.length > 0"
                      size="small"
                      color="secondary"
                      :disabled="isAnimating || isNavigating"
                      @click="startStepAnimation"
                    >
                      경유지별 이동
                    </VBtn>
                    <VBtn
                      v-if="routeSteps.length > 0"
                      size="small"
                      color="success"
                      :disabled="isAnimating || isStepAnimationActive || isNavigating"
                      @click="startNavigation"
                    >
                      네비게이션 시작
                    </VBtn>
                    <VBtn
                      size="small"
                      color="info"
                      :disabled="isNavigating"
                      @click="resetCamera"
                    >
                      카메라 리셋
                    </VBtn>
                  </div>
                  
                  <!-- 경유지별 이동 컨트롤 -->
                  <div
                    v-if="isStepAnimationActive && !isNavigating"
                    class="d-flex flex-column gap-2"
                  >
                    <div class="text-caption text-center mb-1">
                      경유지 {{ currentStepIndex + 1 }} / {{ routeSteps.length }}
                    </div>
                    <div class="d-flex align-center gap-2 flex-wrap">
                      <VBtn
                        size="small"
                        color="primary"
                        :disabled="currentStepIndex <= 0"
                        @click="previousStep"
                      >
                        <VIcon>mdi-chevron-left</VIcon>
                        이전
                      </VBtn>
                      <VBtn
                        size="small"
                        color="primary"
                        :disabled="currentStepIndex >= routeSteps.length - 1"
                        @click="nextStep"
                      >
                        다음
                        <VIcon>mdi-chevron-right</VIcon>
                      </VBtn>
                      <VBtn
                        size="small"
                        color="error"
                        @click="stopStepAnimation"
                      >
                        <VIcon start>
                          mdi-stop
                        </VIcon>
                        종료
                      </VBtn>
                    </div>
                  </div>
                  
                  <!-- 네비게이션 진행 중 컨트롤 -->
                  <div
                    v-if="isNavigating"
                    class="d-flex flex-column gap-2"
                  >
                    <!-- 스탭 카운터 표시 -->
                    <div
                      class="d-flex flex-column align-center mb-2 pa-2"
                      style="background: #f5f5f5; border-radius: 8px;"
                    >
                      <div class="text-h6 text-primary mb-1">
                        {{ stepCount }} 스탭
                      </div>
                      <div class="text-caption text-medium-emphasis mb-1">
                        경로 진행 중...
                      </div>
                      <div class="text-caption" :class="pedometerConnectionStatus.class">
                        {{ pedometerConnectionStatus.text }}
                      </div>
                    </div>
                    
                    <VBtn
                      size="small"
                      color="error"
                      @click="stopNavigation"
                    >
                      <VIcon start>
                        mdi-stop
                      </VIcon>
                      네비게이션 중지
                    </VBtn>
                    
                    <!-- 네비게이션 모드에서 카메라 리셋 버튼 -->
                    <VBtn
                      size="small"
                      color="info"
                      variant="outlined"
                      @click="resetCamera"
                    >
                      <VIcon start>
                        mdi-camera-control
                      </VIcon>
                      카메라 리셋
                    </VBtn>
                  </div>
                  
                  <!-- 경유지별 이동 모드에서 카메라 리셋 버튼 -->
                  <div
                    v-if="isStepAnimationActive && !isNavigating"
                    class="d-flex justify-center mt-2"
                  >
                    <VBtn
                      size="small"
                      color="info"
                      variant="outlined"
                      @click="resetCamera"
                    >
                      <VIcon start>
                        mdi-camera-control
                      </VIcon>
                      카메라 리셋
                    </VBtn>
                  </div>
                </div>
              </div>
            </VCardText>
          </VCard>
        </div>
        
        <!-- 경로 정보 탭들 -->
        <div
          v-if="routeTabs.length > 0"
          class="route-tabs-section"
        >
          <VCard>
            <VCardText class="pa-0">
              <div class="route-tabs-container">
                <div
                  v-for="(tab, index) in routeTabs"
                  :key="tab.id"
                  class="route-tab-item"
                >
                  <div
                    class="route-tab-header"
                    @click="toggleTab(index)"
                  >
                    <div class="route-tab-title">
                      <VIcon
                        :icon="isTabExpanded(index) ? 'bx-chevron-down' : 'bx-chevron-right'"
                        size="20"
                        class="me-2"
                      />
                      <span>{{ tab.title }}</span>
                    </div>
                  </div>
                  
                  <VExpandTransition>
                    <div
                      v-if="isTabExpanded(index)"
                      class="route-tab-content"
                    >
                      <!-- 전체 경로 정보 -->
                      <div
                        v-if="tab.type === 'overview'"
                        class="route-overview"
                      >
                        <div class="route-info-grid">
                          <div class="route-info-item">
                            <span class="route-info-label">알고리즘:</span>
                            <span class="route-info-value">{{ algorithmType }}</span>
                          </div>
                          <div class="route-info-item">
                            <span class="route-info-label">총 거리:</span>
                            <span class="route-info-value">{{ formatDistance(totalDistance) }}</span>
                          </div>
                          <div class="route-info-item">
                            <span class="route-info-label">예상 소요 시간:</span>
                            <span class="route-info-value">{{ formatTime(estimatedTime) }}</span>
                          </div>
                          <div class="route-info-item">
                            <span class="route-info-label">이동 시간:</span>
                            <span class="route-info-value">{{ formatTime(walkingTime) }}</span>
                          </div>
                        </div>
                      </div>
                      
                      <!-- 경로 단계 -->
                      <div
                        v-if="tab.type === 'steps'"
                        class="route-steps"
                      >
                        <VTimeline
                          side="end"
                          align="start"
                          density="compact"
                        >
                          <VTimelineItem
                            v-for="step in tab.data"
                            :key="step.sequence"
                            :dot-color="step.location === '문' || step.location === '포장대' ? 'success' : 'primary'"
                            size="small"
                          >
                            <div class="d-flex justify-space-between align-center">
                              <div>
                                <div class="font-weight-medium">
                                  {{ step.sequence }}. {{ step.location }}
                                </div>
                                <div
                                  v-if="step.description"
                                  class="text-caption text-medium-emphasis"
                                >
                                  {{ step.description }}
                                </div>
                                <div
                                  v-if="step.orderNumber"
                                  class="text-caption text-primary"
                                >
                                  주문: {{ step.orderNumber }}
                                </div>
                              </div>
                              <div class="text-caption text-medium-emphasis">
                                {{ formatDistance(step.cumulativeDistance) }}
                              </div>
                            </div>
                          </VTimelineItem>
                        </VTimeline>
                      </div>
                      
                      <!-- 주문별 상세 정보 -->
                      <div
                        v-if="tab.type === 'order'"
                        class="route-order-detail"
                      >
                        <div class="order-detail-header mb-3">
                          <VChip
                            color="primary"
                            variant="tonal"
                          >
                            {{ tab.data.orderNumber }}
                          </VChip>
                          <span class="text-caption text-medium-emphasis ms-2">
                            {{ tab.data.items.length }}개 부품
                          </span>
                        </div>
                        <VList density="compact">
                          <VListItem
                            v-for="(item, idx) in tab.data.items"
                            :key="idx"
                          >
                            <VListItemTitle>
                              {{ item.partDetail?.korName || item.partDetail?.engName || item.partDetail?.name || '이름 없음' }}
                            </VListItemTitle>
                            <VListItemSubtitle>
                              위치: {{ item.partDetail?.location || '-' }}
                            </VListItemSubtitle>
                            <template #append>
                              <VChip
                                size="small"
                                color="primary"
                                variant="tonal"
                              >
                                수량: {{ item.quantity || 0 }}
                              </VChip>
                            </template>
                          </VListItem>
                        </VList>
                      </div>
                    </div>
                  </VExpandTransition>
                </div>
              </div>
            </VCardText>
          </VCard>
        </div>
      </div>
    </div>
    
    <!-- 알고리즘 비교 다이얼로그 -->
    <VDialog
      v-model="showComparison"
      max-width="800"
    >
      <VCard v-if="comparisonResult">
        <VCardTitle class="d-flex align-center">
          <VIcon
            icon="bx-bar-chart-alt-2"
            class="me-2"
          />
          알고리즘 비교 결과
        </VCardTitle>
        
        <VDivider />
        
        <VCardText>
          <div class="mb-4">
            <div>
              <strong>부품 개수:</strong> {{ comparisonResult.partCount }}
            </div>
            <div>
              <strong>최적 거리:</strong> {{ formatDistance(comparisonResult.optimalDistance) }}
            </div>
            <div>
              <strong>최악 거리:</strong> {{ formatDistance(comparisonResult.worstDistance) }}
            </div>
            <div>
              <strong>추천 알고리즘:</strong> 
              <VChip
                color="success"
                size="small"
                class="ms-2"
              >
                {{ comparisonResult.recommendedAlgorithm }}
              </VChip>
            </div>
          </div>
          
          <VTable>
            <thead>
              <tr>
                <th>알고리즘</th>
                <th>총 거리</th>
                <th>실행 시간</th>
                <th>정확도</th>
                <th>최적</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(result, algorithm) in comparisonResult.results"
                :key="algorithm"
                :class="{ 'bg-success-lighten-5': result.optimal }"
              >
                <td>{{ result.algorithmName }}</td>
                <td>{{ formatDistance(result.totalDistance) }}</td>
                <td>{{ result.executionTimeMs }}ms</td>
                <td>{{ result.actualAccuracy?.toFixed(1) }}%</td>
                <td>
                  <VIcon
                    v-if="result.optimal"
                    icon="bx-check-circle"
                    color="success"
                  />
                  <span v-else>-</span>
                </td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
        
        <VDivider />
        
        <VCardActions>
          <VSpacer />
          <VBtn
            color="primary"
            @click="showComparison = false"
          >
            닫기
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.warehouse-navigation-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
  background: rgb(var(--v-theme-surface));
}

.page-content {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 좌측: 주문 선택 사이드바 */
.order-selector {
  width: 250px;
  min-width: 250px;
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.order-header {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.order-title {
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.order-input-section {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.order-input-field {
  width: 100%;
}

.selected-orders-section {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.selected-orders-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.selected-orders-title {
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.selected-orders-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.order-chip {
  font-size: 12px;
}

.action-buttons {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.recent-orders-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
}

.recent-orders-header {
  margin-bottom: 8px;
}

.recent-orders-title {
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.recent-orders-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.recent-orders-scroll {
  flex: 1;
  min-height: 0;
}

.recent-orders-content {
  padding: 4px 0;
}

.order-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.order-item:hover {
  background: rgba(var(--v-theme-primary), 0.08);
}

.order-item.selected {
  background: rgba(var(--v-theme-primary), 0.12);
}

.order-item.selected .order-item-dot {
  background: rgb(var(--v-theme-primary));
}

.order-item-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(var(--v-theme-on-surface), 0.3);
  flex-shrink: 0;
}

.order-item-name {
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface));
  user-select: none;
}

.order-item.selected .order-item-name {
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
}

/* 우측: 메인 컨텐츠 */
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.warehouse-view-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: hidden;
}

.warehouse-container {
  width: 100%;
  height: 100%;
  min-height: 500px;
}

.route-tabs-section {
  max-height: 400px;
  min-height: 100px;
  padding: 0 16px 16px 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.route-tabs-container {
  max-height: 350px;
  overflow-y: auto;
}

.route-tab-item {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.route-tab-item:last-child {
  border-bottom: none;
}

.route-tab-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  user-select: none;
}

.route-tab-header:hover {
  background: rgba(var(--v-theme-primary), 0.04);
}

.route-tab-title {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}

.route-tab-content {
  padding: 16px;
  background: rgba(var(--v-theme-surface), 0.5);
}

.route-overview {
  width: 100%;
}

.route-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.route-info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.route-info-label {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.route-info-value {
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}

.route-steps {
  max-height: 300px;
  overflow-y: auto;
}

.route-order-detail {
  max-height: 300px;
  overflow-y: auto;
}

.order-detail-header {
  display: flex;
  align-items: center;
}

@media (max-width: 960px) {
  .page-content {
    flex-direction: column;
  }
  
  .order-selector {
    width: 100%;
    min-width: unset;
    max-height: 250px;
    border-right: none;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  }
  
  .warehouse-view-section {
    padding: 12px;
  }
  
  .warehouse-container {
    min-height: 400px;
  }
  
  .route-tabs-section {
    max-height: 300px;
  }
}
</style>
