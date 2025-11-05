<!-- File: src/pages/warehouse-navigation.vue -->
<script setup>
import { fetchOrdersForTable } from '@/api/order'
import { calculateOptimalRoute, compareAllAlgorithms } from '@/api/parts'
import { calculateOptimalPath } from '@/utils/pathfinding'
import { getPedometer } from '@/utils/pedometer'
import PartWarehouse3D from '@/views/parts/view/PartWarehouse3D.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

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

// 최근 주문 목록
const recentOrders = ref([])
const loadingOrders = ref(false)

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
  } catch (e) {
    console.error('[calculateRoute] error:', e)
    errorMsg.value = e?.message || '경로 계산 중 오류가 발생했습니다.'
    navigationResult.value = null
  } finally {
    loading.value = false
  }
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
      pedometer.value.onStepUpdate((steps) => {
        stepCount.value = steps
        
        // 스탭에 따라 경로를 따라 이동
        if (warehouse3DRef.value) {
          warehouse3DRef.value.moveAlongPathBySteps(stepCount.value)
        }
        
        // 경로가 끝나면 정지
        if (warehouse3DRef.value && warehouse3DRef.value.isPathComplete()) {
          stopNavigation()
        }
      })
      
      // 스탭 초기화 및 네비게이션 시작
      stepCount.value = 0
      isNavigating.value = true
      
      // 시작 위치에 현재 위치 마커 표시
      warehouse3DRef.value.showCurrentPosition(true)
      
      // 걸음수 측정 시작
      await pedometer.value.startTracking()
      
      console.log('[startNavigation] 네비게이션 시작, 걸음수 측정 활성화')
    } catch (error) {
      console.error('[startNavigation] 네비게이션 시작 실패:', error)
      // 웹 환경이거나 플러그인을 사용할 수 없는 경우 폴백
      if (error.message.includes('초기화') || error.message.includes('사용할 수 없')) {
        // 폴백: 시간 기반 시뮬레이션
        console.warn('[startNavigation] 폴백 모드: 시간 기반 시뮬레이션 사용')
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
        alert('걸음수 측정을 시작할 수 없습니다. 앱 환경에서 실행해주세요.')
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
  // 시간 기반 인터벌 정리
  if (navigationInterval.value) {
    clearInterval(navigationInterval.value)
    navigationInterval.value = null
  }
  
  // 걸음수 측정 중지
  if (pedometer.value) {
    pedometer.value.stopTracking()
  }
  
  isNavigating.value = false
  if (warehouse3DRef.value) {
    warehouse3DRef.value.showCurrentPosition(false)
  }
  stepCount.value = 0
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
  <div class="page-container warehouse-navigation-page">
    <VRow>
      <!-- 좌측 컨트롤 패널 -->
      <VCol
        cols="12"
        md="4"
      >
        <VCard>
          <VCardTitle class="d-flex align-center">
            <VIcon
              icon="bx-navigation"
              class="me-2"
            />
            창고 네비게이션
          </VCardTitle>
          
          <VDivider />
          
          <VCardText>
            <!-- 주문 번호 입력 -->
            <div class="mb-4">
              <VLabel class="mb-2">
                주문 번호 입력
              </VLabel>
              <VTextField
                v-model="orderNumberInput"
                placeholder="주문 번호를 입력하세요 (예: SMO-1)"
                variant="outlined"
                density="compact"
                hide-details
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
            
            <!-- 선택된 주문 번호 목록 -->
            <div
              v-if="orderNumbers.length > 0"
              class="mb-4"
            >
              <VLabel class="mb-2">
                선택된 주문 번호 ({{ orderNumbers.length }})
              </VLabel>
              <VChipGroup>
                <VChip
                  v-for="num in orderNumbers"
                  :key="num"
                  closable
                  color="primary"
                  @click:close="removeOrderNumber(num)"
                >
                  {{ num }}
                </VChip>
              </VChipGroup>
              
              <VBtn
                class="mt-2"
                size="small"
                variant="text"
                color="error"
                @click="clearOrderNumbers"
              >
                전체 삭제
              </VBtn>
            </div>
            
            <!-- 최근 주문 목록 -->
            <div class="mb-4">
              <VLabel class="mb-2">
                최근 주문 목록
              </VLabel>
              <VList
                v-if="!loadingOrders && recentOrders.length > 0"
                density="compact"
                class="border rounded"
                style="max-height: 200px; overflow-y: auto;"
              >
                <VListItem
                  v-for="order in recentOrders"
                  :key="order.orderId"
                  :title="order.orderNumber"
                  @click="addOrderFromList(order.orderNumber)"
                >
                  <template #append>
                    <VIcon
                      icon="bx-plus"
                      size="small"
                    />
                  </template>
                </VListItem>
              </VList>
              <VProgressLinear
                v-else-if="loadingOrders"
                indeterminate
                color="primary"
              />
              <VAlert
                v-else
                type="info"
                variant="tonal"
                density="compact"
              >
                최근 주문이 없습니다.
              </VAlert>
            </div>
            
            <!-- 액션 버튼 -->
            <div class="d-flex gap-2 flex-wrap">
              <VBtn
                color="primary"
                :loading="loading"
                :disabled="orderNumbers.length === 0"
                @click="calculateRoute"
              >
                <VIcon
                  icon="bx-route"
                  class="me-2"
                />
                최적 경로 계산
              </VBtn>
              
              <VBtn
                color="secondary"
                variant="outlined"
                :loading="loading"
                :disabled="orderNumbers.length === 0"
                @click="compareAlgorithms"
              >
                <VIcon
                  icon="bx-bar-chart-alt-2"
                  class="me-2"
                />
                알고리즘 비교
              </VBtn>
            </div>
            
            <!-- 에러 메시지 -->
            <VAlert
              v-if="errorMsg"
              type="error"
              variant="tonal"
              density="compact"
              class="mt-4"
            >
              {{ errorMsg }}
            </VAlert>
            
            <!-- 경로 정보 -->
            <VCard
              v-if="navigationResult"
              class="mt-4"
              variant="tonal"
            >
              <VCardTitle class="text-h6">
                경로 정보
              </VCardTitle>
              <VCardText>
                <div class="d-flex flex-column gap-2">
                  <div>
                    <strong>알고리즘:</strong> {{ algorithmType }}
                  </div>
                  <div>
                    <strong>총 거리:</strong> {{ formatDistance(totalDistance) }}
                  </div>
                  <div>
                    <strong>예상 소요 시간:</strong> {{ formatTime(estimatedTime) }}
                  </div>
                  <div>
                    <strong>이동 시간:</strong> {{ formatTime(walkingTime) }}
                  </div>
                  <div>
                    <strong>피킹 시간:</strong> {{ formatTime(pickingTime) }}
                  </div>
                </div>
              </VCardText>
            </VCard>
          </VCardText>
        </VCard>
        
        <!-- 경로 단계 목록 -->
        <VCard
          v-if="routeSteps.length > 0"
          class="mt-4"
        >
          <VCardTitle class="d-flex align-center">
            <VIcon
              icon="bx-list-ul"
              class="me-2"
            />
            경로 단계
          </VCardTitle>
          
          <VDivider />
          
          <VCardText>
            <VTimeline
              side="end"
              align="start"
              density="compact"
            >
              <VTimelineItem
                v-for="step in routeSteps"
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
          </VCardText>
        </VCard>
      </VCol>
      
      <!-- 우측 3D 창고 뷰 -->
      <VCol
        cols="12"
        md="8"
      >
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
                    <div class="text-caption text-medium-emphasis">
                      경로 진행 중...
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
      </VCol>
    </VRow>
    
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
  padding: 20px;
}

.warehouse-container {
  width: 100%;
  height: 80vh;
  min-height: 500px;
}

@media (max-width: 960px) {
  .warehouse-container {
    height: 60vh;
    min-height: 400px;
  }
}
</style>
