<script setup>
import { getPartsList } from '@/api/parts'
import { computed, onMounted, ref, watch } from 'vue'

import AppExportButton from '@/components/common/ExportToExcel.vue'

// 내보내기 파일명
const exportFilename = computed(() => {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  
  return `부품목록_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}.xlsx`
})

// 엑셀 컬럼 정의 (label 순서대로 출력)
const exportFields = [
  { key: 'id',           label: 'ID' },
  { key: 'korName',      label: '한글명' },
  { key: 'engName',      label: '영문명' },
  { key: 'displayName',  label: '표시명' },
  { key: 'model',        label: '모델' },
  { key: 'trim',         label: '트림' },
  { key: 'categoryName', label: '카테고리' },
  { key: 'price',        label: '가격' },      // 숫자 그대로 (엑셀에서 통화서식 가능)
  { key: 'amount',       label: '수량' },
  { key: 'image',        label: '이미지URL' },
]

// 한 행 변환 (컴포넌트의 transform prop)
const exportTransform = row => {
  // 화면 products(row) 구조/서버 raw 모두 대응
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

// 현재 화면(필터 적용 후) 데이터
const exportItemsCurrent = computed(() => products.value)

// 전체 페이지 수집 + 현재 필터 재적용
async function fetchAllForExport() {
  const first = await getPartsList({ page: 0, size: 100 })
  const totalPages = first.totalPages ?? 1
  let all = [...first.content]
  for (let p = 1; p < totalPages; p++) {
    const next = await getPartsList({ page: p, size: 100 })

    all = all.concat(next.content || [])
  }

  // 화면과 동일한 필터/가공 재적용
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
  if (selectedCategory.value)
    filtered = filtered.filter(r => r.categoryName === selectedCategory.value)

  // if (selectedStock.value !== undefined)
  //   filtered = filtered.filter(r => r.inStock === selectedStock.value)
  if (searchQuery.value?.trim()) {
    const q = searchQuery.value.trim().toLowerCase()

    filtered = filtered.filter(r =>
      (r.productName || '').toLowerCase().includes(q) ||
      (r.engName || '').toLowerCase().includes(q) ||
      (r.model || '').toLowerCase().includes(q) ||
      (r.trim || '').toLowerCase().includes(q),
    )
  }

  return filtered
}

/* ===== 위젯: 그대로 사용 ===== */
const widgetData = ref([
  { title: 'In-Store Sales', value: '$5,345', icon: 'bx-store-alt', desc: '5k orders', change: 5.7 },
  { title: 'Website Sales', value: '$74,347', icon: 'bx-laptop', desc: '21k orders', change: 12.4 },
  { title: 'Discount', value: '$14,235', icon: 'bx-gift', desc: '6k orders' },
  { title: 'Affiliate', value: '$8,345', icon: 'bx-wallet', desc: '150 orders', change: -3.5 },
])

/* ===== 테이블 헤더: API 스키마에 맞춰 재정의 =====
   id, name/korName/engName, price, image, model/trim, categoryName, amount
*/
const headers = [
  { title: 'id',      key: 'id' },                       // id를 SKU처럼 표기
  { title: '제품',  key: 'product' },                // korName/engName + model/trim
  { title: '카테고리', key: 'categoryName' },

  // { title: 'Stock',    key: 'inStock', sortable: false }, // amount>0
  { title: '가격',    key: 'price' },
  { title: '개수',      key: 'amount' },
  { title: '비고',  key: 'actions', sortable: false },
]

/* ===== 필터 상태 ===== */
const selectedCategory = ref()

// const selectedStock = ref()        // true(재고있음)/false(품절)
const searchQuery = ref('')
const selectedRows = ref([])

/* ===== 카테고리/스톡 선택지 (API 기반 가공) ===== */
const categories = ref(['전기/램프', '엔진/미션', '하체/바디', '내장/외장', '기타소모품'])         // API 결과에서 유니크 categoryName 추출

// const stockStatus = ref([
//   { title: 'In Stock',  value: true },
//   { title: 'Out of Stock', value: false },
// ])

/* ===== 서버 페이지네이션 / 정렬 파라미터 ===== */
const itemsPerPage = ref(10)   // -> size
const page = ref(1)            // UI 1-base -> 서버 0-base
const sortBy = ref()           // (서버 정렬 미제공: 로컬 정렬만 유지)
const orderBy = ref()

const updateOptions = options => {
  sortBy.value = options.sortBy[0]?.key
  orderBy.value = options.sortBy[0]?.order
}

/* ===== 파츠 API 호출 결과 =====
   GET /api/v1/parts/list?page=0&size=20
   -> { status, success, message, data: { content, page, size, totalElements, totalPages } }
*/
const tableLoading = ref(false)
const rawPage = ref({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 })

// 상단 import에 추가


async function loadParts() {
  tableLoading.value = true
  try {
    const pageData = await getPartsList({
      page: page.value - 1,        // UI 1-base → 서버 0-base
      size: itemsPerPage.value,
    })

    rawPage.value = {
      content: pageData.content,
      page: pageData.page,
      size: pageData.size,
      totalElements: pageData.totalElements,
      totalPages: pageData.totalPages,
    }

    // 카테고리 선택지 갱신
    const set = new Set(rawPage.value.content.map(it => it.categoryName).filter(Boolean))

    console.log(pageData)
  } catch (e) {
    console.error('[PartsList] loadParts error:', e)
    rawPage.value = { content: [], page: 0, size: itemsPerPage.value, totalElements: 0, totalPages: 0 }
  } finally {
    tableLoading.value = false
  }
}

onMounted(loadParts)
watch([page, itemsPerPage], loadParts)

/* ===== 테이블 아이템 가공 ===== */
const products = computed(() => {
  // 서버 페이지 단위에서 클라이언트 필터(카테고리/재고/검색)를 적용
  const rows = rawPage.value.content.map(p => {
    // 안전한 기본값
    const kor = p.korName || ''
    const eng = p.engName || ''
    const displayName = kor || eng || p.name || '이름없음'
    const modelTrim = [p.model, p.trim].filter(Boolean).join(' / ')
    
    return {
      ...p,
      productName: displayName,
      productBrand: modelTrim,        // 예제 UI의 서브텍스트 위치에 model/trim 표시
      image: p.image,
      categoryName: p.categoryName,

      // inStock: (p.amount ?? 0) > 0,
    }
  })

  let filtered = rows

  if (selectedCategory.value)
    filtered = filtered.filter(r => r.categoryName === selectedCategory.value)

  // if (selectedStock.value !== undefined)
  //   filtered = filtered.filter(r => r.inStock === selectedStock.value)

  if (searchQuery.value?.trim()) {
    const q = searchQuery.value.trim().toLowerCase()

    filtered = filtered.filter(r =>
      (r.productName || '').toLowerCase().includes(q) ||
      (r.engName || '').toLowerCase().includes(q) ||
      (r.model || '').toLowerCase().includes(q) ||
      (r.trim || '').toLowerCase().includes(q),
    )
  }

  // (옵션) 로컬 정렬
  if (sortBy.value) {
    const key = sortBy.value
    const dir = orderBy.value === 'desc' ? -1 : 1

    filtered = [...filtered].sort((a, b) => {
      const va = a?.[key]
      const vb = b?.[key]
      if (va == null && vb == null) return 0
      if (va == null) return -1 * dir
      if (vb == null) return  1 * dir
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      
      return String(va).localeCompare(String(vb)) * dir
    })
  }

  return filtered
})

const formatKRW = val => {
  const n = Number(val)
  if (!Number.isFinite(n)) return '—'
  
  return new Intl.NumberFormat('ko-KR').format(n) + '원'
}

const totalProduct = computed(() => rawPage.value.totalElements)

/* ===== 액션들 ===== */
// 서버에서 삭제 API 스펙은 없으므로 버튼은 남기되 실제 호출은 비활성/주석 처리
const deleteProduct = async id => {
  console.warn('Delete is not provided by /api/v1/parts/list. Skipped. id=', id)

  // 필요 시 별도 삭제 API 연동으로 교체
}

/* ===== 카테고리/아이콘 유틸 ===== */
const resolveCategory = category => {
  if (!category) return { color: 'secondary', icon: 'bx-package' }

  const name = String(category).toLowerCase()

  if (name.includes('엔진'))
    return { color: 'primary', icon: 'bx-cog' }

  if (name.includes('하체'))
    return { color: 'error', icon: 'bx-wrench' } 

  if (name.includes('전기'))
    return { color: 'info', icon: 'bx-bulb' }

  if (name.includes('내장'))
    return { color: 'success', icon: 'bx-chair' }

  return { color: 'secondary', icon: 'bx-package' }
}
</script>

<template>
  <div>
    <!-- 👉 widgets (그대로) -->

    <!-- 👉 Filters -->
    <VCard
      title="Filters"
      class="mb-6"
    >
      <VCardText class="pb-5">
        <VRow>
          <!-- ✅ Select Category (API 기반) -->
          <VCol
            cols="12"
            sm="6"
          >
            <AppSelect
              v-model="selectedCategory"
              placeholder="Category"
              :items="categories"
              clearable
              clear-icon="bx-x"
            />
          </VCol>

          <!-- ✅ Select Stock -->
          <!--
            <VCol
            cols="12"
            sm="6"
            >
            <AppSelect
            v-model="selectedStock"
            placeholder="Stock"
            :items="stockStatus"
            clearable
            clear-icon="bx-x"
            />
            </VCol> 
          -->
        </VRow>
      </VCardText>

      <VDivider />

      <div class="d-flex flex-wrap gap-4 pa-6">
        <div class="d-flex align-center">
          <!-- ✅ Search (클라이언트 필터) -->
          <AppTextField
            v-model="searchQuery"
            placeholder="Search Parts (이름/모델/트림)"
            style="inline-size: 280px;"
            class="me-3"
          />
        </div>

        <VSpacer />

        <div class="d-flex gap-4 flex-wrap align-center">
          <AppSelect
            v-model="itemsPerPage"
            :items="[5, 10, 20, 25, 50]"
          />

          <!-- ✅ 공통 엑셀 내보내기 버튼 -->
          <AppExportButton
            :items="exportItemsCurrent"  
            :fields="exportFields"
            :filename="exportFilename"
            sheet-name="Parts"
            :fetch-all="fetchAllForExport"  
            :transform="exportTransform"
          />
        </div>
      </div>

      <VDivider />

      <!-- 👉 Datatable -->
      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:model-value="selectedRows"
        v-model:page="page"
        :headers="headers"
        show-select
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

        <!-- stock -->
        <!--
          <template #item.inStock="{ item }">
          <VSwitch
          :model-value="item.inStock"
          disabled
          />
          </template> 
        -->
        <!-- price -->
        <template #item.price="{ item }">
          <span
            class="text-end d-inline-block"
            style="min-width: 90px;"
          >
            {{ formatKRW(item.price) }}
          </span>
        </template>
        <!--  amount / id는 기본 셀 사용 -->

        <!-- actions -->
        <template #item.actions="{ item }">
          <IconBtn>
            <VIcon icon="bx-edit" />
          </IconBtn>

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
    </VCard>
  </div>
</template>
