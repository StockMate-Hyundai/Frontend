<!-- src/pages/parts-list.vue (예시) -->
<script setup>
import { getPartsList } from '@/api/parts'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import AppPartsFilters from '@/components/common/AppPartsFilters.vue'
import AppExportButton from '@/components/common/ExportToExcel.vue'

/* ==========================
   엑셀 내보내기 설정
========================== */
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

/* 화면에 보이는 데이터(필터 적용 후) */
const exportItemsCurrent = computed(() => products.value)

/* 전체 페이지 수집 + 동일 필터 재적용 (엑셀용) */
async function fetchAllForExport() {
  const first = await getPartsList({ page: 0, size: 100,
    categoryName: filters.categoryName || undefined,
    trim: filters.trim || undefined,
    model: filters.model || undefined,
  })

  const totalPages = first.totalPages ?? 1
  let all = [...(first.content ?? [])]

  for (let p = 1; p < totalPages; p++) {
    const next = await getPartsList({ page: p, size: 100,
      categoryName: filters.categoryName || undefined,
      trim: filters.trim || undefined,
      model: filters.model || undefined,
    })

    all = all.concat(next.content || [])
  }

  // 화면과 동일한 가공/검색 재적용
  const rows = all.map(p => {
    const kor = p.korName || ''
    const eng = p.engName || ''
    const displayName = kor || eng || p.name || '이름없음'
    const modelTrim = [p.model, p.trim].filter(Boolean).join(' / ')
    
    return {
      ...p,
      productName: displayName,
      productBrand: modelTrim,
      inStock: (p.amount ?? 0) > 0,
    }
  })

  let filtered = rows

  // 검색(클라이언트 검색)
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase()

    filtered = filtered.filter(r =>
      (r.productName || '').toLowerCase().includes(q) ||
      (r.engName || '').toLowerCase().includes(q) ||
      (r.model || '').toLowerCase().includes(q) ||
      (r.trim  || '').toLowerCase().includes(q),
    )
  }

  return filtered
}

/* ==========================
   테이블 헤더
========================== */
const headers = [
  { title: 'id',         key: 'id' },
  { title: '제품',       key: 'product' },
  { title: '카테고리',   key: 'categoryName' },
  { title: '가격',       key: 'price' },
  { title: '개수',       key: 'amount' },
  { title: '비고',       key: 'actions', sortable: false },
]

/* ==========================
   필터 상태 (공통 컴포넌트에서 emit)
========================== */
const filters = reactive({
  categoryName: undefined,
  trim: undefined,
  model: undefined,
  search: '',
})

/* 카테고리 선택지 (필요 시 API에서 유니크 추출로 교체) */
const categories = ref(['전기/램프', '엔진/미션', '하체/바디', '내장/외장', '기타소모품'])

function onSearch(payload) {
  Object.assign(filters, payload)
  page.value = 1
  loadParts()
}

/* ==========================
   서버 페이지네이션/정렬
========================== */
const itemsPerPage = ref(10)
const page = ref(1)
const sortBy = ref()
const orderBy = ref()

const updateOptions = options => {
  sortBy.value = options.sortBy[0]?.key
  orderBy.value = options.sortBy[0]?.order
}

/* ==========================
   API 호출 결과
========================== */
const tableLoading = ref(false)
const rawPage = ref({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 })

async function loadParts() {
  tableLoading.value = true
  try {
    const pageData = await getPartsList({
      page: page.value - 1,        // UI 1-base → 서버 0-base
      size: itemsPerPage.value,
      categoryName: filters.categoryName || undefined,
      trim: filters.trim || undefined,   // 백엔드가 지원하면 사용됨 (미지원이어도 무해)
      model: filters.model || undefined,
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

/* 페이지/사이즈 변경 시 재조회 */
watch([page, itemsPerPage], loadParts)

/* ==========================
   화면 표시용 가공/정렬/검색
========================== */
const products = computed(() => {
  const rows = rawPage.value.content.map(p => {
    const kor = p.korName || ''
    const eng = p.engName || ''
    const displayName = kor || eng || p.name || '이름없음'
    const modelTrim = [p.model, p.trim].filter(Boolean).join(' / ')
    
    return {
      ...p,
      productName: displayName,
      productBrand: modelTrim,
      image: p.image,
      categoryName: p.categoryName,
    }
  })

  let filtered = rows

  // 카테고리 (백엔드 + 안전망)
  // if (filters.categoryName)
  //   filtered = filtered.filter(r => r.categoryName === filters.categoryName)

  // 검색
  // if (filters.search?.trim()) {
  //   const q = filters.search.trim().toLowerCase()

  //   filtered = filtered.filter(r =>
  //     (r.productName || '').toLowerCase().includes(q) ||
  //     (r.engName || '').toLowerCase().includes(q) ||
  //     (r.model || '').toLowerCase().includes(q) ||
  //     (r.trim  || '').toLowerCase().includes(q),
  //   )
  // }

  // 로컬 정렬
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

/* ==========================
   유틸
========================== */
const formatKRW = val => {
  const n = Number(val)
  if (!Number.isFinite(n)) return '—'
  
  return new Intl.NumberFormat('ko-KR').format(n) + '원'
}

const totalProduct = computed(() => rawPage.value.totalElements)

const deleteProduct = async id => {
  console.warn('Delete is not provided by /api/v1/parts/list. Skipped. id=', id)
}

const resolveCategory = category => {
  if (!category) return { color: 'secondary', icon: 'bx-package' }
  const name = String(category).toLowerCase()
  if (name.includes('엔진')) return { color: 'primary', icon: 'bx-cog' }
  if (name.includes('하체')) return { color: 'error',   icon: 'bx-wrench' }
  if (name.includes('전기')) return { color: 'info',    icon: 'bx-bulb' }
  if (name.includes('내장')) return { color: 'success', icon: 'bx-chair' }
  
  return { color: 'secondary', icon: 'bx-package' }
}
</script>

<template>
  <div>
    <!-- 🔹 공통 필터 (VCard 포함 컴포넌트: 중복 카드 제거) -->
    <AppPartsFilters
      page-type="parts"
      :categories="categories"
      :initial="{ categoryName: filters.categoryName, trim: filters.trim, model: filters.model, search: filters.search }"
      :loading="tableLoading"
      @search="onSearch"
    >
      <!-- 우측 슬롯: 페이지당 개수 + 엑셀 내보내기 버튼 -->
      <template #right>
        <AppSelect
          v-model="itemsPerPage"
          :items="[5,10,20,25,50]"
        />
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

    <!-- 🔹 Datatable -->
    <VDataTableServer
      v-model:items-per-page="itemsPerPage"
      v-model:page="page"
      :headers="headers"
      :loading="tableLoading"
      :items="products"
      :items-length="totalProduct"
      class="text-no-wrap"
      @update:options="updateOptions"
    >
      <!-- product -->
      <template #item.product="{ item }">
        <div class="d-flex align-center gap-x-4">
          <VAvatar
            v-if="item.image"
            size="38"
            variant="tonal"
            rounded
            :image="item.image"
          />
          <div class="d-flex flex-column">
            <span class="text-body-1 font-weight-medium text-high-emphasis">{{ item.productName }}</span>
            <span class="text-body-2">{{ item.productBrand }}</span>
          </div>
        </div>
      </template>

      <!-- category -->
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

      <!-- price -->
      <template #item.price="{ item }">
        <span
          class="text-end d-inline-block"
          style="min-width: 90px;"
        >
          {{ formatKRW(item.price) }}
        </span>
      </template>

      <!-- actions -->
      <template #item.actions="{ item }">
        <IconBtn><VIcon icon="bx-edit" /></IconBtn>
        <IconBtn>
          <VIcon icon="bx-dots-vertical-rounded" />
          <VMenu activator="parent">
            <VList>
              <VListItem
                value="download"
                prepend-icon="bx-download"
              >
                Download
              </VListItem>
              <VListItem
                value="delete"
                prepend-icon="bx-trash"
                @click="deleteProduct(item.id)"
              >
                Delete
              </VListItem>
              <VListItem
                value="duplicate"
                prepend-icon="bx-copy"
              >
                Duplicate
              </VListItem>
            </VList>
          </VMenu>
        </IconBtn>
      </template>

      <!-- pagination -->
      <template #bottom>
        <TablePagination
          v-model:page="page"
          :items-per-page="itemsPerPage"
          :total-items="totalProduct"
        />
      </template>
    </VDataTableServer>
  </div>
</template>
