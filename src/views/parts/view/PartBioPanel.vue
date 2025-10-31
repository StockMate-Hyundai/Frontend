<!-- File: src/views/parts/view/PartBioPanel.vue -->
<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  part: { type: Object, required: true },
})

const imgError = ref(false)

const displayName = computed(() =>
  props.part.korName || props.part.engName || props.part.name || `#${props.part.id}`,
)

const modelTrim = computed(() =>
  [props.part.model, props.part.trim].filter(Boolean).join(' / '),
)

const hasImage = computed(() => !!props.part.image)

const formatKRW = val => {
  const n = Number(val)
  if (!Number.isFinite(n)) return '—'
  
  return new Intl.NumberFormat('ko-KR').format(n) + '원'
}

const resolveCategory = category => {
  if (!category) return { color: 'secondary', icon: 'bx-package' }
  const name = String(category).toLowerCase()
  if (name.includes('엔진')) return { color: 'primary', icon: 'bx-cog' }
  if (name.includes('하체')) return { color: 'error', icon: 'bx-wrench' }
  if (name.includes('전기')) return { color: 'info', icon: 'bx-bulb' }
  if (name.includes('내장')) return { color: 'success', icon: 'bx-chair' }
  
  return { color: 'secondary', icon: 'bx-package' }
}

function copyCode() {
  const code = props.part?.code
  if (!code) return
  navigator.clipboard?.writeText(String(code))
}
</script>

<template>
  <VCard class="overflow-hidden elevation-1">
    <!-- 상단: 이미지 + 이름 + 카테고리 -->
    <div class="d-flex flex-column align-center pa-6 pt-7 pb-10">
      <VImg
        v-if="hasImage && !imgError"
        :src="part.image"
        :alt="displayName"
        width="200"
        height="200"
        cover
        eager
        class="rounded-lg mb-5"
      />
      <div
        v-else
        class="d-flex align-center justify-center mb-4 text-medium-emphasis"
      >
        <VIcon
          icon="bx-image-alt"
          size="32"
          class="me-2"
        />
        이미지가 없습니다
      </div>

      <div class="text-h5 text-center mb-4 font-weight-bold">
        {{ displayName }}
      </div>

      <div class="d-flex align-center justify-center gap-2 flex-wrap mb-2">
        <VChip
          v-if="part.categoryName"
          size="small"
          :color="resolveCategory(part.categoryName).color"
          variant="tonal"
        >
          <VIcon
            start
            :icon="resolveCategory(part.categoryName).icon"
            size="16"
          />
          {{ part.categoryName }}
        </VChip>

        <VBtn
          v-if="part.code"
          variant="text"
          size="small"
          color="primary"
          prepend-icon="bx-copy"
          @click="copyCode"
        >
          코드 복사
        </VBtn>
      </div>

      <div class="text-caption text-medium-emphasis">
        ID: {{ part.id }}
        <span
          v-if="part.code"
          class="ms-2"
        >· 코드: <strong>{{ part.code }}</strong></span>
      </div>
    </div>

    <VDivider />

    <!-- 주요 수치 -->
    <VCardText class="pt-4 pb-10">
      <div class="d-flex flex-column gap-3">
        <div class="d-flex align-center justify-space-between">
          <span class="text-medium-emphasis ">트림</span>
          <span class="font-weight-regular font-weight-bold">{{ part.trim }}</span>
        </div>
        <div class="d-flex align-center justify-space-between">
          <span class="text-medium-emphasis ">모델</span>
          <span class="font-weight-regular font-weight-bold">{{ part.model }}</span>
        </div>

        <div class="d-flex align-center justify-space-between">
          <span class="text-medium-emphasis">재고 위치</span>
          <span class="font-weight-bold">{{ part.location || '—' }}</span>
        </div>

        <div class="d-flex align-center justify-space-between">
          <span class="text-medium-emphasis">재고 수량</span>
          <span class="font-weight-medium font-weight-bold">{{ part.amount ?? 0 }} 개</span>
        </div>

        <VDivider class="my-2" />

        <div class="d-flex align-center justify-space-between">
          <span class="text-medium-emphasis">원가</span>
          <span class="font-weight-bold">{{ formatKRW(part.cost) }}</span>
        </div>
        <div class="d-flex align-center justify-space-between">
          <span class="text-medium-emphasis">판매가</span>
          <span class="text-primary font-weight-bold">{{ formatKRW(part.price) }}</span>
        </div>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.text-primary {
  color: rgb(var(--v-theme-primary)) !important;
}
</style>
