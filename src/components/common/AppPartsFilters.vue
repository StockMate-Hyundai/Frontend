<!-- AppPartsFiltersMulti.vue : JS버전 (카테고리 + 트림 다중선택 + 모델 항상 펼침) -->
<script setup>
import { computed, reactive, ref } from 'vue'

const props = defineProps({
  pageType: { type: String, default: 'parts' },
  categories: { type: Array, default: () => ['전기/램프', '엔진/미션', '하체/바디', '내장/외장', '기타소모품'] },
  loading: { type: Boolean, default: false },
})

/* ===== vehicles (내장) ===== */
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

/* ===== 데이터 가공 ===== */
const trims = computed(() => Array.from(new Set(vehicles.map(v => v.trim))))

const modelsByTrim = computed(() => {
  const map = {}
  for (const v of vehicles) {
    if (!map[v.trim]) map[v.trim] = []
    map[v.trim].push(v.model)
  }
  
  return map
})

/* ===== UI 상태 ===== */
const selectedCategories = ref([])
const selectedTrims = ref([])
const selectedModels = reactive({})

/* 카테고리 토글 */
function toggleCategory(c) {
  const i = selectedCategories.value.indexOf(c)
  if (i >= 0) selectedCategories.value.splice(i, 1)
  else selectedCategories.value.push(c)
}
const isCategorySelected = c => selectedCategories.value.includes(c)
const selectAllCategories = () => { selectedCategories.value = [...props.categories] }
const clearAllCategories = () => { selectedCategories.value = [] }

/* 트림/모델 토글 */
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
const clearAllModelsOfTrim = t => { selectedModels[t] = [] }
</script>

<template>
  <VCard class="mb-6">
    <VCardTitle class="px-6 pt-6 pb-2 text-subtitle-1 text-medium-emphasis" />
    <VCardText class="pt-0">
      <!-- 카테고리 -->
      <div class="d-flex align-start mb-2">
        <div class="label-col text-medium-emphasis">
          카테고리
        </div>
        <div class="flex-1">
          <div class="d-flex align-center flex-wrap gap-2 mb-2">
            <VBtn
              size="x-small"
              variant="tonal"
              @click="selectAllCategories"
            >
              ALL
            </VBtn>
            <VBtn
              size="x-small"
              variant="text"
              class="ms-1 me-2"
              @click="clearAllCategories"
            >
              [ 전체해제 ]
            </VBtn>
          </div>
          <div class="chip-wrap">
            <VChip
              v-for="c in props.categories"
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

      <VDivider class="my-3" />

      <!-- Trim -->
      <div class="d-flex align-start mb-2">
        <div class="label-col text-medium-emphasis">
          분류
        </div>
        <div class="flex-1">
          <div class="d-flex align-center flex-wrap gap-2 mb-2">
            <VBtn
              size="x-small"
              variant="tonal"
              @click="selectedTrims = [...trims]; trims.forEach(t => selectedModels[t] ||= [])"
            >
              ALL
            </VBtn>
            <VBtn
              size="x-small"
              variant="text"
              class="ms-1 me-2"
              @click="selectedTrims = []; Object.keys(selectedModels).forEach(k => selectedModels[k] = [])"
            >
              [ 전체해제 ]
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

      <VDivider class="my-3" />

      <!-- Model (항상 펼침) -->
      <div class="d-flex align-start">
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
                variant="tonal"
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

      <VDivider class="my-4" />

      <!-- 하단 액션 -->
      <div class="d-flex flex-wrap gap-2">
        <VBtn
          color="primary"
          variant="flat"
          :loading="props.loading"
          :disabled="props.loading"
        >
          검색
        </VBtn>
        <VBtn variant="tonal">
          초기화
        </VBtn>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.label-col { inline-size: 90px; padding-block-start: 4px; }
.flex-1 { flex: 1 1 auto; }
.chip-wrap { display: flex; flex-wrap: wrap; }
.chip-wrap--models {
  max-inline-size: 95%;  /* 원하는 픽셀로 변경 */
}
</style>
