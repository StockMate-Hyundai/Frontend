<script setup>
import { searchParts } from '@/api/parts' // ✅ 변경
import { computed, onMounted, reactive, ref, watch } from 'vue'

import AppPartsFilters from '@/components/common/AppPartsFilters.vue' // ✅ 멀티칩 버전 사용
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
  { title: '카테고리',   key: 'categoryName' },
  { title: '가격',       key: 'price' },
  { title: '개수',       key: 'amount' },
  { title: '비고',       key: 'actions', sortable: false },
]

/* ✅ 필터 상태: 배열 기반 */
const filters = reactive({
  categoryName: [],   // string[]
  trim: [],           // string[]
  model: [],          // string[]
  search: '',         // (지금은 서버 미사용, 필요시 쿼리추가)
})

/* 카테고리 선택지 */
const categories = ref(['전기/램프', '엔진/미션', '하체/바디', '내장/외장', '기타소모품'])

function onSearch(payload) {
  // payload: { categoryName?: string[], trim?: string[], model?: string[] }
  filters.categoryName = payload.categoryName || []
  filters.trim         = payload.trim || []
  filters.model        = payload.model || []
  page.value = 1
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
  <div>
    <!-- ✅ 공통 필터 (멀티칩) -->
    <AppPartsFilters
      page-type="parts"
      :categories="categories"
      :loading="tableLoading"
      @search="onSearch"
    >
      <template #right>
        <div style="inline-size: 120px;">
          <AppSelect 
            v-model="itemsPerPage"
            :items="[5,10,20,25,50]"
          />
        </div>

        <AppExportButton
          :items="exportItemsCurrent"
          :fields="exportFields"
          :filename="exportFilename"
          sheet-name="Parts"
          :fetch-all="fetchAllForExport"
          :transform="exportTransform"
        />
      </template>
    </AppPartsFilters>

    <!-- 데이터 테이블 -->
    <VDataTableServer
      v-model:items-per-page="itemsPerPage"
      v-model:page="page"
      :headers="headers"
      :loading="tableLoading"
      :items="products"
      :items-length="totalProduct"
      class="text-no-wrap table-fixed center-others"
      @update:options="updateOptions"
    >
      <!-- 열 순서에 맞춰 width 지정 (합계 100%) -->
      <template #colgroup>
        <col style="width: 5%">
        <col style="width: 45%">  
        <col style="width: 15%">
        <col style="width: 12%">
        <col style="width: 8%">
        <col style="width: 15%">
      </template>

      <template #item.product="{ item }">
        <div class="d-flex align-center gap-x-4">
          <VAvatar
            v-if="item.image"
            size="38"
            variant="tonal"
            rounded
            :image="item.image"
            class="cursor-pointer"
            :title="item.productName || '이미지 보기'"
            @click="openImagePreview(item.image, item.productName)"
          />
          <div class="d-flex flex-column">
            <span class="text-body-1 font-weight-medium text-high-emphasis">{{ item.productName }}</span>
            <span class="text-body-2">{{ item.productBrand }}</span>
          </div>
        </div>
      </template>
      <template #item.categoryName="{ item }">
        <VAvatar
          size="30"
          variant="tonal"
          :color="resolveCategory(item.categoryName)?.color"
          class="me-4"
        >
          <VIcon
            :icon="resolveCategory(item.categoryName)?.icon"
            size="18"
          />
        </VAvatar>
        <span class="text-body-1 text-high-emphasis">{{ item.categoryName || '—' }}</span>
      </template>

      <!-- 가격도 중앙 정렬해야 하므로 text-end 제거 -->
      <template #item.price="{ item }">
        <span
          class="d-inline-block"
          style="min-width: 90px;"
        >
          {{ formatKRW(item.price) }}
        </span>
      </template>

      <template #item.actions="{ item }">
        <IconBtn><VIcon icon="bx-edit" /></IconBtn>
        <IconBtn><VIcon icon="bx-download" /></IconBtn>
        <IconBtn><VIcon icon="bx-trash" /></IconBtn>
      </template>

      <template #bottom>
        <TablePagination
          v-model:page="page"
          :items-per-page="itemsPerPage"
          :total-items="totalProduct"
        />
      </template>
    </VDataTableServer>
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
.cursor-pointer { cursor: pointer; }
</style>
