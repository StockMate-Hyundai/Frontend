<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ORDER_STATUS_OPTIONS } from '@/utils/orderStatus'

/* =========================
   Props (후방호환 기본값)
========================= */
const props = defineProps({
  pageType: { type: String, default: 'parts' },
  categories: { type: Array, default: () => ['전기/램프', '엔진/미션', '하체/바디', '내장/외장', '기타소모품'] },
  loading: { type: Boolean, default: false },

  /* 🔧 섹션 토글 (기존 유지: 기본 true) */
  enableCategories: { type: Boolean, default: true },
  enableTrim: { type: Boolean, default: true },
  enableModel: { type: Boolean, default: true },

  /* 🧩 주문(API)용 섹션 (기본 끔: 기존 영향 X) */
  enableStatus: { type: Boolean, default: false },
  enableDate: { type: Boolean, default: false },
  enableMember: { type: Boolean, default: false },
  enablePart: { type: Boolean, default: false },

  /* 옵션 소스 */
  statusOptions: {
    type: Array,
    default: () => ORDER_STATUS_OPTIONS,
  },
  memberItems: { type: Array, default: () => [] }, // [{ title, value }]
  partItems: { type: Array, default: () => [] }, // [{ title, value }]
})

/* =========================
   Emits
========================= */
const emit = defineEmits(['search'])

/* =========================
   내부 상수 (기존)
========================= */
const vehicles = [
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
]

/* =========================
   파생 값 (기존)
========================= */
const trims = computed(() => Array.from(new Set(vehicles.map(v => v.trim))))

const modelsByTrim = computed(() => {
  const map = {}
  for (const v of vehicles) {
    if (!map[v.trim]) map[v.trim] = []
    map[v.trim].push(v.model)
  }
  
  return map
})

/* =========================
   UI 상태 (기존)
========================= */
const selectedCategories = ref([])
const selectedTrims = ref([])
const selectedModels = reactive({})

/* =========================
   UI 상태 (주문용 추가)
========================= */
const selectedStatus = ref()   // string | undefined
const dateRange = ref('')      // 'YYYY-MM-DD to YYYY-MM-DD'
const memberId = ref()         // number|string | undefined
const partId = ref()           // number|string | undefined

/* =========================
   토글 (기존)
========================= */
function toggleCategory(c) {
  const i = selectedCategories.value.indexOf(c)
  if (i >= 0) selectedCategories.value.splice(i, 1)
  else selectedCategories.value.push(c)
}
const isCategorySelected = c => selectedCategories.value.includes(c)
const selectAllCategories = () => { selectedCategories.value = [...props.categories] }
const clearAllCategories  = () => { selectedCategories.value = [] }


function toggleTrim(t) {
  const i = selectedTrims.value.indexOf(t)
  if (i >= 0) {
    selectedTrims.value.splice(i, 1)
    selectedModels[t] = []
  } else {
    selectedTrims.value.push(t)
    if (!selectedModels[t]) selectedModels[t] = []
  }
}
const isTrimSelected = t => selectedTrims.value.includes(t)

function toggleModel(t, m) {
  if (!selectedModels[t]) selectedModels[t] = []
  const i = selectedModels[t].indexOf(m)
  if (i >= 0) selectedModels[t].splice(i, 1)
  else selectedModels[t].push(m)
}
const isModelSelected = (t, m) => (selectedModels[t] || []).includes(m)

const selectAllModelsOfTrim = t => { selectedModels[t] = [...(modelsByTrim.value[t] || [])] }
const clearAllModelsOfTrim  = t => { selectedModels[t] = [] }

/* =========================
   유틸
========================= */
function parseDateRange(val) {
  if (!val) return [undefined, undefined]
  const [s, e] = String(val).split(' to ')
  
  return [s || undefined, e || undefined]
}

/* =========================
   Payload 빌드
========================= */
function buildPayload() {
  const out = {}

  // 🔹 기존(옵션): 카테고리/트림/모델
  if (props.enableCategories && selectedCategories.value.length)
    out.categoryName = [...selectedCategories.value]
  if (props.enableTrim && selectedTrims.value.length)
    out.trim = [...selectedTrims.value]
  if (props.enableModel) {
    const allModels = Object.values(selectedModels).flatMap(arr => arr || [])
    if (allModels.length) out.model = Array.from(new Set(allModels))
  }

  // 🔹 주문(API)용
  if (props.enableStatus && selectedStatus.value) out.status = selectedStatus.value
  if (props.enableMember && (memberId.value ?? '') !== '') out.memberId = memberId.value
  if (props.enablePart   && (partId.value   ?? '') !== '') out.partId   = partId.value

  if (props.enableDate) {
    const [startDate, endDate] = parseDateRange(dateRange.value)
    if (startDate) out.startDate = startDate
    if (endDate)   out.endDate   = endDate
  }

  return out
}

/* =========================
   Actions
========================= */
function onApply() { emit('search', buildPayload()) }

function onReset() {
  // 기존
  selectedCategories.value = []
  selectedTrims.value = []
  Object.keys(selectedModels).forEach(k => selectedModels[k] = [])

  // 주문용
  selectedStatus.value = undefined
  dateRange.value = ''
  memberId.value = undefined
  partId.value = undefined

  emit('search', buildPayload())
}

/* =========================
   pageType에 따른 기본 프리셋 (선택)
   - 명시 props가 우선이며, 여기선 자동 토글 안함.
   - 필요하면 아래 watch에서 pageType을 보고 안내만.
========================= */
watch(() => props.pageType, t => {
  // 안내용 로그 (원하면 실제 토글도 가능)
})
</script>

<template>
  <VCard class="mb-6">
    <VCardTitle class="px-6 pt-6 pb-2 text-subtitle-1 text-medium-emphasis" />
    <VCardText class="pt-0">
      <!-- 🗓 기간 -->
      <div
        v-if="enableDate"
        class="d-flex align-start mb-3"
      >
        <div class="label-col text-medium-emphasis">
          기간
        </div>
        <div class="flex-1">
          <AppDateTimePicker
            v-model="dateRange"
            placeholder="기간을 선택하세요."
            :config="{ mode: 'range' }"
            style="max-inline-size: 300px"
          />
        </div>
      </div>

      <VDivider
        v-if="enableDate"
        class="my-3"
      />

      <!-- 📦 카테고리 -->
      <div
        v-if="enableCategories"
        class="d-flex align-start mb-2"
      >
        <div class="label-col text-medium-emphasis">
          카테고리
        </div>
        <div class="flex-1">
          <div class="d-flex align-center flex-wrap gap-2 mb-2">
            <VBtn
              size="x-small"
              variant="flat"
              @click="selectAllCategories"
            >
              전체선택
            </VBtn>
            <VBtn
              size="x-small"
              variant="text"
              class="ms-1 me-2"
              @click="clearAllCategories"
            >
              전체해제
            </VBtn>
          </div>
          <div class="chip-wrap">
            <VChip
              v-for="c in categories"
              :key="c"
              label
              variant="tonal"
              size="small"
              class="me-2 mb-2"
              :color="isCategorySelected(c) ? 'primary' : undefined"
              @click="toggleCategory(c)"
            >
              {{ c }}
            </VChip>
          </div>
        </div>
      </div>

      <VDivider
        v-if="enableCategories && (enableTrim || enableStatus || enableMember || enablePart)"
        class="my-3"
      />

      <!-- 🚚 주문 상태 (칩 단일 선택) -->
      <div
        v-if="enableStatus"
        class="d-flex align-start mb-2"
      >
        <div class="label-col text-medium-emphasis">
          주문 상태
        </div>
        <div class="flex-1">
          <div class="chip-wrap">
            <VChip
              v-for="opt in statusOptions"
              :key="opt.value"
              label
              variant="tonal"
              size="small"
              class="me-2 mt-1"
              :color="selectedStatus === opt.value ? 'primary' : undefined"
              @click="selectedStatus = (selectedStatus === opt.value ? undefined : opt.value)"
            >
              {{ opt.label }}
            </VChip>
          </div>
        </div>
      </div>

      <VDivider
        v-if="enableStatus && (enableTrim || enableMember || enablePart)"
        class="my-3"
      />

      <!-- 🚗 Trim -->
      <div
        v-if="enableTrim"
        class="d-flex align-start mb-2"
      >
        <div class="label-col text-medium-emphasis">
          분류
        </div>
        <div class="flex-1">
          <div class="d-flex align-center flex-wrap gap-2 mb-2">
            <VBtn
              size="x-small"
              variant="flat"
              @click="selectedTrims = [...trims]; trims.forEach(t => selectedModels[t] ||= [])"
            >
              전체선택
            </VBtn>
            <VBtn
              size="x-small"
              variant="text"
              class="ms-1 me-2"
              @click="selectedTrims = []; Object.keys(selectedModels).forEach(k => selectedModels[k] = [])"
            >
              전체해제
            </VBtn>
          </div>

          <div class="chip-wrap">
            <VChip
              v-for="t in trims"
              :key="t"
              label
              variant="tonal"
              size="small"
              class="me-2 mb-2"
              :color="isTrimSelected(t) ? 'primary' : undefined"
              @click="toggleTrim(t)"
            >
              {{ t }}
            </VChip>
          </div>
        </div>
      </div>

      <VDivider
        v-if="enableTrim && enableModel"
        class="my-3"
      />

      <!-- 🏷 모델 -->
      <div
        v-if="enableModel"
        class="d-flex align-start"
      >
        <div class="label-col text-medium-emphasis">
          모델
        </div>
        <div class="flex-1">
          <div
            v-for="t in selectedTrims"
            :key="`${t}-models`"
            class="mb-3"
          >
            <div class="d-flex align-center mb-2">
              <div class="text-body-2 font-weight-medium me-2">
                {{ t }}
              </div>

              <VBtn
                size="x-small"
                variant="flat"
                class="me-1"
                @click="selectAllModelsOfTrim(t)"
              >
                전체선택
              </VBtn>
              <VBtn
                size="x-small"
                variant="text"
                @click="clearAllModelsOfTrim(t)"
              >
                전체해제
              </VBtn>

              <VSpacer />
              <VChip
                size="x-small"
                class="opacity-70"
                label
              >
                {{ (selectedModels[t] || []).length }} / {{ (modelsByTrim[t] || []).length }}
              </VChip>
            </div>

            <div class="chip-wrap chip-wrap--models">
              <VChip
                v-for="m in modelsByTrim[t]"
                :key="`${t}-${m}`"
                label
                variant="tonal"
                size="small"
                class="me-2 mb-2"
                :color="isModelSelected(t, m) ? 'primary' : undefined"
                @click="toggleModel(t, m)"
              >
                {{ m }}
              </VChip>
            </div>
          </div>

          <div
            v-if="!selectedTrims.length"
            class="text-medium-emphasis text-body-2 mt-1"
          >
            분류를 선택하면 해당 모델 목록이 아래에 표시됩니다.
          </div>
        </div>
      </div>

      <VDivider
        v-if="(enableMember || enablePart)"
        class="my-3"
      />

      <!-- 👤 memberId / 🔩 partId -->
      <div
        v-if="enableMember || enablePart"
        class="d-flex flex-wrap gap-4"
      >
        <VAutocomplete
          v-if="enableMember"
          v-model="memberId"
          :items="memberItems"
          item-title="title"
          item-value="value"
          clearable
          hide-details
          label="회원 (memberId)"
          density="comfortable"
          style="min-inline-size: 260px"
        />
        <VAutocomplete
          v-if="enablePart"
          v-model="partId"
          :items="partItems"
          item-title="title"
          item-value="value"
          clearable
          hide-details
          label="부품 (partId)"
          density="comfortable"
          style="min-inline-size: 260px"
        />
      </div>

      <VDivider class="my-4" />

      <!-- 하단 액션 -->
      <div class="d-flex flex-wrap gap-2">
        <VBtn
          color="primary"
          variant="flat"
          :loading="loading"
          :disabled="loading"
          @click="onApply"
        >
          검색
        </VBtn>
        <VBtn
          variant="tonal"
          :disabled="loading"
          @click="onReset"
        >
          초기화
        </VBtn>
        <VSpacer />

        <slot name="right" />
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.label-col { inline-size: 90px; padding-block-start: 4px; }
.flex-1 { flex: 1 1 auto; }
.chip-wrap { display: flex; flex-wrap: wrap; }
.chip-wrap--models { max-inline-size: 95%; }
</style>
