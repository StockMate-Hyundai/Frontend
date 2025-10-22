<!-- File: src/views/parts/view/PartBioPanel.vue -->
<script setup>
import { computed } from 'vue'

const props = defineProps({
  part: { type: Object, required: true },
})

const displayName = computed(() =>
  props.part.korName || props.part.engName || props.part.name || `#${props.part.id}`
)

const modelTrim = computed(() =>
  [props.part.model, props.part.trim].filter(Boolean).join(' / ')
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
  if (name.includes('하체')) return { color: 'error',   icon: 'bx-wrench' }
  if (name.includes('전기')) return { color: 'info',    icon: 'bx-bulb' }
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
  <VCard class="overflow-hidden">
    <VCardText class="pt-5">
      <!-- 이미지 -->
      <VImg
        v-if="hasImage"
        :src="part.image"
        :alt="displayName"
        class="rounded-lg mb-10 mx-auto"
        aspect-ratio="1"
        cover
        size="1"
        max-width="220" 
      />
      <div v-else class="d-flex align-center justify-center py-10 text-medium-emphasis">
        <VIcon icon="bx-image-alt" size="32" class="me-2" />
        이미지가 없습니다
      </div>

      <!-- 타이틀/코드 -->
      <div class="d-flex align-start justify-space-between gap-2 mb-2">
        <div class="text-subtitle-1 font-weight-medium">
          {{ displayName }}
        </div>
        <VChip
          v-if="part.categoryName"
          size="small"
          :color="resolveCategory(part.categoryName).color"
          variant="tonal"
        >
          <VIcon start :icon="resolveCategory(part.categoryName).icon" size="16" />
          {{ part.categoryName }}
        </VChip>
      </div>
      <div class="text-body-2 text-medium-emphasis mb-2">
        ID: {{ part.id }}
        <span v-if="part.code" class="ms-2">· 코드: <strong>{{ part.code }}</strong></span>
      </div>

      <!-- 기본 정보 -->
      <div class="d-flex flex-column gap-2 mb-4">
        <div class="d-flex align-center justify-space-between">
          <span class="text-medium-emphasis">모델/트림</span>
          <span>{{ modelTrim || '—' }}</span>
        </div>
        <div class="d-flex align-center justify-space-between">
          <span class="text-medium-emphasis">재고 위치</span>
          <span>{{ part.location || '—' }}</span>
        </div>
        <div class="d-flex align-center justify-space-between">
          <span class="text-medium-emphasis">재고 수량</span>
          <span>{{ part.amount ?? 0 }} 개</span>
        </div>
        <div class="d-flex align-center justify-space-between">
          <span class="text-medium-emphasis">원가</span>
          <span>{{ formatKRW(part.cost) }}</span>
        </div>
        <div class="d-flex align-center justify-space-between">
          <span class="text-medium-emphasis">판매가</span>
          <span class="font-weight-medium">{{ formatKRW(part.price) }}</span>
        </div>
      </div>

      <div class="d-flex gap-2">
        <VBtn v-if="part.code" variant="tonal" prepend-icon="bx-copy" @click="copyCode">
          코드 복사
        </VBtn>
      </div>
    </VCardText>
  </VCard>
</template>
