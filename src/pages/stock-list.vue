<script setup>
definePage({
  meta: {
    title: '부품 목록',
    icon: 'bx-package',
    requiresAuth: true,
  },
})

import { searchParts } from '@/api/parts' // ✅ 변경
import { computed, onMounted, reactive, ref, watch } from 'vue'

import AppExportButton from '@/components/common/ExportToExcel.vue'

/* 엑셀 설정 (동일) */
const exportFilename = computed(() => {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  
  return `부품목록_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.xlsx`
})

const exportFields = [
  { key: 'id',           label: 'ID' },
  { key: 'korName',      label: '한글명' },
  { key: 'engName',      label: '영문명' },
  { key: 'displayName',  label: '표시명' },
  { key: 'model',        label: '모델' },
  { key: 'trim',         label: '트림' },
  { key: 'categoryName', label: '카테고리' },
  { key: 'price',        label: '가격' },
  { key: 'amount',       label: '수량' },
  { key: 'image',        label: '이미지URL' },
]

const exportTransform = row => {
  const kor = row.korName || ''
  const eng = row.engName || ''
  const displayName = row.productName || kor || eng || row.name || '이름없음'
  
  return {
    id: row.id,
    korName: kor,
    engName: eng,
    displayName,
    model: row.model ?? '',
    trim: row.trim ?? '',
    categoryName: row.categoryName ?? '',
    price: Number(row.price ?? 0),
    amount: Number(row.amount ?? 0),
    image: row.image ?? '',
  }
}

const exportItemsCurrent = computed(() => products.value)

/* ✅ 동일 필터로 전 페이지 수집 (searchParts 사용) */
async function fetchAllForExport() {
  const first = await searchParts({
    page: 0,
    size: 100,
    categoryName: filters.categoryName?.length ? filters.categoryName : undefined,
    trim: filters.trim?.length ? filters.trim : undefined,
    model: filters.model?.length ? filters.model : undefined,
  })

  const totalPages = first.totalPages ?? 1
  let all = [...(first.content ?? [])]

  for (let p = 1; p < totalPages; p++) {
    const next = await searchParts({
      page: p,
      size: 100,
      categoryName: filters.categoryName?.length ? filters.categoryName : undefined,
      trim: filters.trim?.length ? filters.trim : undefined,
      model: filters.model?.length ? filters.model : undefined,
    })

    all = all.concat(next.content || [])
  }

  return all.map(p => {
    const kor = p.korName || ''
    const eng = p.engName || ''
    const displayName = kor || eng || p.name || '이름없음'
    const modelTrim = [p.model, p.trim].filter(Boolean).join(' / ')
    
    return { ...p, productName: displayName, productBrand: modelTrim, inStock: (p.amount ?? 0) > 0 }
  })
}

/* 테이블 헤더 */
const headers = [
  { title: 'id',         key: 'id' },
  { title: '제품',       key: 'product' },
  { title: '제품코드',       key: 'code' },
  { title: '카테고리',   key: 'categoryName' },
  { title: '원가',       key: 'cost' },
  { title: '판매가',       key: 'price' },
  { title: '개수',       key: 'amount' },
  { title: '위치',       key: 'location' },

  // { title: '비고',       key: 'actions', sortable: false },
]

/* ✅ 필터 상태: 배열 기반 */
const filters = reactive({
  categoryName: [],   // string[]
  trim: [],           // string[]
  model: [],          // string[]
  search: '',         // (지금은 서버 미사용, 필요시 쿼리추가)
})

/* 선택된 모델들 (트림별로 관리) */
const selectedModels = reactive({})

/* 필터 토글 상태 */
const isFilterExpanded = ref(true)

/* 카테고리 선택지 */
const categories = ref(['전기/램프', '엔진/미션', '하체/바디', '내장/외장', '기타소모품'])

/* 트림과 모델 관계 정의 */
const vehicles = ref([
  { trim: '준중형/소형', model: '아반떼MD' },
  { trim: '준중형/소형', model: '아반떼AD' },
  { trim: '준중형/소형', model: '아반떼CN7' },
  { trim: '준중형/소형', model: 'I30' },
  { trim: '준중형/소형', model: '엑센트' },
  { trim: '준중형/소형', model: '아이오닉' },
  { trim: '준중형/소형', model: '벨로스터' },
  { trim: '준중형/소형', model: '캐스퍼' },
  { trim: '중형', model: 'NF소나타' },
  { trim: '중형', model: 'YF소나타' },
  { trim: '중형', model: 'LF소나타' },
  { trim: '중형', model: 'DN8소나타' },
  { trim: '중형', model: '그랜저TG' },
  { trim: '중형', model: '그랜저HG' },
  { trim: '중형', model: '그랜저IG' },
  { trim: '중형', model: '그랜저GN7' },
  { trim: '중형', model: 'I40' },
  { trim: '대형', model: '제네시스BH' },
  { trim: '대형', model: '에쿠스' },
  { trim: 'SUV', model: '베뉴' },
  { trim: 'SUV', model: '코나OS' },
  { trim: 'SUV', model: '코나SX2' },
  { trim: 'SUV', model: '투싼IX' },
  { trim: 'SUV', model: '투싼TL' },
  { trim: 'SUV', model: '투싼NX4' },
  { trim: 'SUV', model: '싼타페CM' },
  { trim: 'SUV', model: '싼타페DM' },
  { trim: 'SUV', model: '싼타페TM' },
  { trim: 'SUV', model: '싼타페MX5' },
  { trim: 'SUV', model: '맥스크루즈' },
  { trim: 'SUV', model: '베라크루즈' },
  { trim: 'SUV', model: '팰리세이드LX2' },
  { trim: 'SUV', model: '팰리세이드LX3' },
  { trim: '화물/트럭/승합', model: '스타렉스' },
  { trim: '화물/트럭/승합', model: '그랜드스타렉스' },
  { trim: '화물/트럭/승합', model: '스타리아' },
  { trim: '화물/트럭/승합', model: '포터2' },
  { trim: '화물/트럭/승합', model: '쏠라티' },
  { trim: '화물/트럭/승합', model: '마이티' },
  { trim: '화물/트럭/승합', model: '메가트럭' },
  { trim: '화물/트럭/승합', model: '카운티' },
  { trim: '수소/전기', model: '아이오닉5' },
  { trim: '수소/전기', model: '아이오닉6' },
  { trim: '수소/전기', model: '아이오닉9' },
  { trim: '수소/전기', model: '넥쏘FE' },
  { trim: '수소/전기', model: '넥쏘NH2' },
])

/* 트림 선택지 */
const trims = computed(() => Array.from(new Set(vehicles.value.map(v => v.trim))))

/* 선택된 트림의 모델들 */
const modelsByTrim = computed(() => {
  const map = {}
  for (const v of vehicles.value) {
    if (!map[v.trim]) map[v.trim] = []
    map[v.trim].push(v.model)
  }
  
  return map
})

function onSearch() {
  // 선택된 모델들을 하나의 배열로 합치기
  const allModels = Object.values(selectedModels).flatMap(arr => arr || [])

  filters.model = Array.from(new Set(allModels))
  
  // 필터 토글 닫기
  isFilterExpanded.value = false
  
  page.value = 1
  loadParts()
}

// 필터 토글 함수들
function toggleCategory(c) {
  const i = filters.categoryName.indexOf(c)
  if (i >= 0) filters.categoryName.splice(i, 1)
  else filters.categoryName.push(c)
}

function toggleTrim(t) {
  const i = filters.trim.indexOf(t)
  if (i >= 0) {
    filters.trim.splice(i, 1)
    selectedModels[t] = [] // 트림 해제 시 해당 모델들도 초기화
  } else {
    filters.trim.push(t)
    if (!selectedModels[t]) selectedModels[t] = []
  }
}

function toggleModel(t, m) {
  if (!selectedModels[t]) selectedModels[t] = []
  const i = selectedModels[t].indexOf(m)
  if (i >= 0) selectedModels[t].splice(i, 1)
  else selectedModels[t].push(m)
}

const isModelSelected = (t, m) => (selectedModels[t] || []).includes(m)

function onReset() {
  filters.categoryName = []
  filters.trim = []
  filters.model = []
  Object.keys(selectedModels).forEach(k => selectedModels[k] = [])
  page.value = 1
  isFilterExpanded.value = true // 초기화 시 필터 토글 열기
  loadParts()
}

/* 페이지네이션/정렬 */
const itemsPerPage = ref(20)
const page = ref(1)
const sortBy = ref()
const orderBy = ref()

const updateOptions = options => {
  sortBy.value = options.sortBy[0]?.key
  orderBy.value = options.sortBy[0]?.order
}

/* API 결과 */
const tableLoading = ref(false)
const rawPage = ref({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 })

async function loadParts() {
  tableLoading.value = true
  try {
    const pageData = await searchParts({
      page: page.value - 1, // UI 1-base → 서버 0-base
      size: itemsPerPage.value,
      categoryName: filters.categoryName?.length ? filters.categoryName : undefined,
      trim: filters.trim?.length ? filters.trim : undefined,
      model: filters.model?.length ? filters.model : undefined,
    })

    rawPage.value = {
      content: pageData.content,
      page: pageData.page,
      size: pageData.size,
      totalElements: pageData.totalElements,
      totalPages: pageData.totalPages,
    }
  } catch (e) {
    console.error('[PartsList] loadParts error:', e)
    rawPage.value = { content: [], page: 0, size: itemsPerPage.value, totalElements: 0, totalPages: 0 }
  } finally {
    tableLoading.value = false
  }
}

onMounted(loadParts)
watch([page, itemsPerPage], loadParts)

/* 화면 가공 */
const products = computed(() => {
  const rows = rawPage.value.content.map(p => {
    const kor = p.korName || ''
    const eng = p.engName || ''
    const displayName = kor || eng || p.name || '이름없음'
    const modelTrim = [p.model, p.trim].filter(Boolean).join(' / ')
    
    return { ...p, productName: displayName, productBrand: modelTrim, image: p.image, categoryName: p.categoryName }
  })

  // 로컬 정렬
  let filtered = rows
  if (sortBy.value) {
    const key = sortBy.value
    const dir = orderBy.value === 'desc' ? -1 : 1

    filtered = [...filtered].sort((a, b) => {
      const va = a?.[key], vb = b?.[key]
      if (va == null && vb == null) return 0
      if (va == null) return -1 * dir
      if (vb == null) return  1 * dir
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      
      return String(va).localeCompare(String(vb)) * dir
    })
  }
  
  return filtered
})

/* 유틸 */
const formatKRW = val => {
  const n = Number(val)
  if (!Number.isFinite(n)) return '—'
  
  return new Intl.NumberFormat('ko-KR').format(n) + '원'
}

const totalProduct = computed(() => rawPage.value.totalElements)
const deleteProduct = async id => console.warn('Delete not provided. id=', id)

const resolveCategory = category => {
  if (!category) return { color: 'secondary', icon: 'bx-package' }
  const name = String(category).toLowerCase()
  if (name.includes('엔진')) return { color: 'primary', icon: 'bx-cog' }
  if (name.includes('하체')) return { color: 'error',   icon: 'bx-wrench' }
  if (name.includes('전기')) return { color: 'info',    icon: 'bx-bulb' }
  if (name.includes('내장')) return { color: 'success', icon: 'bx-chair' }
  
  return { color: 'secondary', icon: 'bx-package' }
}

// 이미지 상세보기
const previewImage = ref({
  open: false,
  url: '',
  title: '',
})

function openImagePreview(url, title = '') {
  if (!url) return
  previewImage.value.open = true
  previewImage.value.url = url
  previewImage.value.title = title
}
function closeImagePreview() {
  previewImage.value.open = false
  previewImage.value.url = ''
  previewImage.value.title = ''
}
</script>

<template>
  <div class="page-container table-page">
    <!-- 필터 섹션 (고정) -->
    <div class="filter-section">
      <div class="d-flex align-center justify-space-between mb-0">
        <div class="d-flex align-center gap-3">
          <h6 class="text-h6 text-high-emphasis mb-0">
            부품 목록
          </h6>
          <VBtn
            size="small"
            variant="text"
            :icon="isFilterExpanded ? 'bx-chevron-up' : 'bx-chevron-down'"
            @click="isFilterExpanded = !isFilterExpanded"
          />
        </div>
        <div class="d-flex align-center gap-3">
          <!-- 내보내기 버튼은 테이블 헤더로 이동 -->
        </div>
      </div>
      
      <!-- 필터 내용 (토글 가능) -->
      <VExpandTransition>
        <div
          v-show="isFilterExpanded"
          class="filter-content"
        >
          <div class="d-flex align-center gap-4 flex-wrap mb-3">
            <!-- 카테고리 필터 -->
            <div class="d-flex align-center gap-2">
              <span class="text-body-2 text-medium-emphasis">카테고리:</span>
              <div class="d-flex gap-1">
                <VChip
                  v-for="c in categories"
                  :key="c"
                  size="small"
                  variant="tonal"
                  :color="filters.categoryName.includes(c) ? 'primary' : undefined"
                  @click="toggleCategory(c)"
                >
                  {{ c }}
                </VChip>
              </div>
            </div>
            
            <!-- 트림 필터 -->
            <div class="d-flex align-center gap-2">
              <span class="text-body-2 text-medium-emphasis">분류:</span>
              <div class="d-flex gap-1 flex-wrap">
                <VChip
                  v-for="t in (trims || [])"
                  :key="t"
                  size="small"
                  variant="tonal"
                  :color="filters.trim.includes(t) ? 'primary' : undefined"
                  @click="toggleTrim(t)"
                >
                  {{ t }}
                </VChip>
              </div>
            </div>
          </div>
          
          <!-- 모델 필터 (선택된 트림이 있을 때만 표시) -->
          <div
            v-if="filters.trim.length > 0"
            class="d-flex align-start gap-2 mb-1"
          >
            <span class="text-body-2 text-medium-emphasis">모델:</span>
            <div class="d-flex flex-column gap-2">
              <div
                v-for="t in filters.trim"
                :key="`${t}-models`"
                class="d-flex flex-column gap-1"
              >
                <div class="d-flex align-center gap-2">
                  <span class="text-caption font-weight-medium">{{ t }}</span>
                  <VChip
                    size="x-small"
                    variant="outlined"
                    class="opacity-70"
                  >
                    {{ (selectedModels[t] || []).length }} / {{ (modelsByTrim[t] || []).length }}
                  </VChip>
                </div>
                <div class="d-flex gap-1 flex-wrap">
                  <VChip
                    v-for="m in (modelsByTrim[t] || [])"
                    :key="`${t}-${m}`"
                    size="small"
                    variant="tonal"
                    :color="isModelSelected(t, m) ? 'primary' : undefined"
                    @click="toggleModel(t, m)"
                  >
                    {{ m }}
                  </VChip>
                </div>
              </div>
            </div>
          </div>
        </div>
      </VExpandTransition>
      
      <!-- 고정 버튼 영역 -->
      <div class="filter-actions">
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

    <!-- 테이블 컨테이너 -->
    <div class="table-container">
      <!-- 테이블 헤더 -->
      <div class="table-header">
        <div class="d-flex align-center justify-space-between">
          <span>전체 {{ totalProduct }}건</span>
          <div class="d-flex align-center gap-2">
            <AppExportButton
              :items="exportItemsCurrent"
              :fields="exportFields"
              :filename="exportFilename"
              sheet-name="Parts"
              :fetch-all="fetchAllForExport"
              :transform="exportTransform"
              size="small"
              variant="flat"
            />
            <VIcon
              icon="bx-refresh"
              size="16"
              class="cursor-pointer"
              @click="loadParts"
            />
          </div>
        </div>
      </div>
      
      <!-- 테이블 본체 -->
      <div class="table-body">
        <VDataTableServer
          v-model:items-per-page="itemsPerPage"
          v-model:page="page"
          :headers="headers"
          :loading="tableLoading"
          :items="products"
          :items-length="totalProduct"
          class="erp-table"
          @update:options="updateOptions"
        >
          <!-- 열 순서에 맞춰 width 지정 (합계 100%) -->
          <template #colgroup>
            <col style="width: 2%">
            <col style="width: 30%">
            <col style="width: 10%">
            <col style="width: 10%">
            <col style="width: 8%">
            <col style="width: 8%">
            <col style="width: 5%">
            <col style="width: 7%">
          </template>

          <!-- product 셀 -->
          <template #item.product="{ item }">
            <div class="d-flex align-center gap-x-3 product-cell">
              <VAvatar
                v-if="item.image"
                size="32"
                variant="tonal"
                rounded
                :image="item.image"
                class="cursor-pointer"
                :title="item.productName || '이미지 보기'"
                @click="openImagePreview(item.image, item.productName)"
              />
              <div
                class="d-flex flex-column product-text cursor-pointer"
                @click="$router.push({ name: 'part-detail-id', params: { id: item.id } })"
              >
                <span class="text-body-2 font-weight-medium text-high-emphasis">
                  {{ item.productName }}
                </span>
                <span class="text-caption text-medium-emphasis">{{ item.productBrand }}</span>
              </div>
            </div>
          </template>

          <template #item.categoryName="{ item }">
            <div class="d-flex align-center gap-2">
              <VAvatar
                size="24"
                variant="tonal"
                :color="resolveCategory(item.categoryName)?.color"
              >
                <VIcon
                  :icon="resolveCategory(item.categoryName)?.icon"
                  size="14"
                />
              </VAvatar>
              <span class="text-body-2 text-high-emphasis">{{ item.categoryName || '—' }}</span>
            </div>
          </template>
          
          <template #item.cost="{ item }">
            <span class="text-body-2">{{ formatKRW(item.cost) }}</span>
          </template>

          <template #item.price="{ item }">
            <span class="text-body-2 font-weight-medium">{{ formatKRW(item.price) }}</span>
          </template>

          <template #item.amount="{ item }">
            <VChip
              size="small"
              variant="tonal"
              :color="item.amount > 10 ? 'success' : item.amount > 0 ? 'warning' : 'error'"
            >
              {{ item.amount }}
            </VChip>
          </template>

          <template #item.location="{ item }">
            <span class="text-body-2 text-medium-emphasis">{{ item.location || '—' }}</span>
          </template>
        </VDataTableServer>
      </div>
      
      <!-- 페이지네이션 (하단 고정) -->
      <div class="table-footer">
        <div class="d-flex align-center justify-space-between">
          <div class="text-body-2 text-medium-emphasis">
            총 {{ totalProduct }}건 중 {{ (page - 1) * itemsPerPage + 1 }}-{{ Math.min(page * itemsPerPage, totalProduct) }}건 표시
          </div>
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalProduct"
          />
        </div>
      </div>
    </div>
    
    <!-- 페이지 하단 마진 -->
    <div class="page-bottom-margin" />
  </div>
  <!-- 🖼 이미지 프리뷰 다이얼로그 -->
  <VDialog
    v-model="previewImage.open"
    max-width="800"
    persistent
  >
    <VCard class="pa-2">
      <div class="d-flex align-center px-3 pt-2 pb-1">
        <div class="text-subtitle-2 text-medium-emphasis">
          {{ previewImage.title || '이미지 미리보기' }}
        </div>
        <VSpacer />
        <VBtn
          icon="bx-x"
          variant="text"
          @click="closeImagePreview"
        />
      </div>

      <VCardText class="pt-1">
        <VImg
          :src="previewImage.url"
          :alt="previewImage.title || '이미지'"
          contain
          class="rounded-lg"
          style="max-block-size: 50vh;"
        />
      </VCardText>

      <VCardActions class="justify-end">
        <VBtn
          variant="tonal"
          @click="closeImagePreview"
        >
          닫기
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.cursor-pointer { 
  cursor: pointer; 
}

/* ERP 테이블 스타일 */
.erp-table {
  height: 100% !important;
  min-height: 400px !important; /* 최소 높이 고정 */
}

.erp-table :deep(.v-table__wrapper) {
  height: 100% !important;
  min-height: 400px !important;
}

.erp-table :deep(.v-table) {
  height: 100% !important;
  min-height: 400px !important;
}

.erp-table :deep(.v-table__body) {
  height: calc(100% - 48px) !important; /* 헤더 높이 제외 */
  min-height: 352px !important;
}

.erp-table :deep(.product-cell) {
  white-space: normal !important;
}

.erp-table :deep(.product-text) {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* 테이블 푸터 고정 */
.table-footer {
  flex-shrink: 0;
  background: var(--erp-bg-secondary);
  padding: 5px 24px;
}

/* 페이지 하단 마진 */
.page-bottom-margin {
  height: 24px;
  background: var(--erp-bg-primary);
}

/* 필터 섹션 스타일 - 매우 얇게 */
.filter-section {
  padding: 14px 24px !important; /* 더 많이 축소 */
  
  .v-chip {
    transition: all 0.2s ease;
    
    &:hover {
      transform: translateY(-1px);
    }
  }
}

/* 필터 액션 버튼 고정 - 매우 얇게 */
.filter-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 2px; /* 더 많이 축소 */
  /* margin-bottom: 10px; */
}

/* 필터 내용 간격 줄이기 */
.filter-content {
  margin-bottom: 4px !important; /* 더 많이 축소 */
}

/* 테이블 행 호버 효과 */
.erp-table :deep(.v-table__body tr:hover) {
  background: var(--erp-bg-secondary) !important;
  transform: none !important;
}

/* 스크롤바 커스터마이징 */
.table-body {
  scrollbar-width: thin;
  scrollbar-color: var(--erp-border-medium) var(--erp-bg-secondary);
}

.table-body::-webkit-scrollbar {
  width: 6px;
}

.table-body::-webkit-scrollbar-track {
  background: var(--erp-bg-secondary);
}

.table-body::-webkit-scrollbar-thumb {
  background: var(--erp-border-medium);
  border-radius: 3px;
}

.table-body::-webkit-scrollbar-thumb:hover {
  background: var(--erp-secondary);
}
/* 헤더 고정 */
.erp-table :deep(.v-table__wrapper) {
  /* 이미 높이/스크롤 설정이 있으면 유지해도 됨 */
  overflow-y: auto;           /* 본문 스크롤 */
}

.erp-table :deep(thead th) {
  position: sticky;
  top: 0;                     /* 상단 고정 */
  z-index: 3;                 /* 본문 셀 위로 */
  background: var(--erp-bg-primary); /* 스크롤 시 배경 덮개 */
  /* 필요 시 보더/그라데이션로 구분감 추가 가능 */
}
</style>
