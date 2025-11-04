<!-- File: src/views/parts/view/PartBioPanel.vue -->
<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const props = defineProps({
  part: { type: Object, required: true },
  distribution: { type: Object, default: null },
  loadingDistribution: { type: Boolean, default: false },
  showDistributionOnly: { type: Boolean, default: false },
})

const imgError = ref(false)
const showDistribution = ref(false)

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

function goToStoreDetail(userId) {
  if (!userId) return
  router.push({ name: 'user-detail-id', params: { id: String(userId) } })
}
</script>

<template>
  <div
    v-if="showDistributionOnly"
    class="distribution-only"
  >
    <!-- 재고 분포만 표시 -->
    <div class="distribution-content">
      <div
        v-if="loadingDistribution"
        class="d-flex justify-center align-center py-8"
      >
        <VProgressCircular
          indeterminate
          size="32"
          width="3"
          color="primary"
        />
      </div>

      <div
        v-else-if="!distribution"
        class="text-center py-8 text-medium-emphasis"
      >
        분포 정보를 불러올 수 없습니다
      </div>

      <div
        v-else
      >
        <!-- 본사 재고 -->
        <div class="mb-4 pb-4 border-b">
          <div class="d-flex align-center justify-space-between mb-2">
            <span class="text-body-2 font-weight-medium">본사 창고</span>
            <span class="text-body-1 font-weight-bold">{{ distribution.headquartersQuantity ?? 0 }} 개</span>
          </div>
          <VProgressLinear
            :model-value="distribution.headquartersQuantity"
            :max="(distribution.headquartersQuantity ?? 0) + (distribution.stores?.content?.reduce((sum, store) => sum + (store.quantity ?? 0), 0) ?? 0)"
            height="8"
            color="primary"
            rounded
          />
        </div>

        <!-- 지점별 재고 -->
        <div
          v-if="distribution.stores?.content && distribution.stores.content.length > 0"
          class="d-flex flex-column gap-3"
        >
          <div
            v-for="store in distribution.stores.content"
            :key="store.userId"
            class="store-item"
          >
            <div class="d-flex align-center justify-space-between mb-2">
              <span
                class="text-body-2 font-weight-medium store-name"
                @click="goToStoreDetail(store.storeInfo?.memberId || store.userId)"
              >{{ store.storeInfo?.storeName || store.storeInfo?.email || `지점 #${store.userId}` }}</span>
              <span class="text-body-1 font-weight-bold">{{ store.quantity ?? 0 }} 개</span>
            </div>
            <VProgressLinear
              :model-value="store.quantity"
              :max="(distribution.headquartersQuantity ?? 0) + (distribution.stores?.content?.reduce((sum, s) => sum + (s.quantity ?? 0), 0) ?? 0)"
              height="6"
              color="success"
              rounded
            />
          </div>
        </div>

        <div
          v-else
          class="text-center py-4 text-caption text-medium-emphasis"
        >
          지점 재고 없음
        </div>
      </div>
    </div>
  </div>

  <VCard
    v-else
    class="overflow-hidden elevation-1"
  >
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

    <VDivider />

    <!-- 재고 분포 -->
    <VCardText class="pt-4 pb-6">
      <div
        class="d-flex align-center justify-space-between cursor-pointer"
        @click="showDistribution = !showDistribution"
      >
        <div class="d-flex align-center">
          <VIcon
            icon="bx-store"
            size="18"
            class="me-2"
          />
          <span class="text-medium-emphasis font-weight-medium">재고 분포</span>
        </div>
        <VIcon
          :icon="showDistribution ? 'bx-chevron-up' : 'bx-chevron-down'"
          size="20"
        />
      </div>

      <VExpandTransition>
        <div v-if="showDistribution">
          <div
            v-if="loadingDistribution"
            class="d-flex justify-center align-center py-4"
          >
            <VProgressCircular
              indeterminate
              size="24"
              width="2"
              color="primary"
            />
          </div>

          <div
            v-else-if="!distribution"
            class="text-center py-4 text-medium-emphasis"
          >
            분포 정보를 불러올 수 없습니다
          </div>

          <div
            v-else
            class="mt-3"
          >
            <!-- 본사 재고 -->
            <div class="mb-3 pb-3 border-b">
              <div class="d-flex align-center justify-space-between mb-2">
                <span class="text-caption text-medium-emphasis">본사 창고</span>
                <span class="text-body-2 font-weight-bold">{{ distribution.headquartersQuantity ?? 0 }} 개</span>
              </div>
              <VProgressLinear
                :model-value="distribution.headquartersQuantity"
                :max="(distribution.headquartersQuantity ?? 0) + (distribution.stores?.content?.reduce((sum, store) => sum + (store.quantity ?? 0), 0) ?? 0)"
                height="6"
                color="primary"
                rounded
              />
            </div>

            <!-- 지점별 재고 -->
            <div
              v-if="distribution.stores?.content && distribution.stores.content.length > 0"
              class="d-flex flex-column gap-2"
            >
              <div
                v-for="store in distribution.stores.content"
                :key="store.userId"
                class="store-item"
              >
                <div class="d-flex align-center justify-space-between mb-1">
                  <span
                    class="text-caption font-weight-medium store-name"
                    @click="goToStoreDetail(store.storeInfo?.memberId || store.userId)"
                  >{{ store.storeInfo?.storeName || store.storeInfo?.email || `지점 #${store.userId}` }}</span>
                  <span class="text-body-2 font-weight-bold">{{ store.quantity ?? 0 }} 개</span>
                </div>
                <VProgressLinear
                  :model-value="store.quantity"
                  :max="(distribution.headquartersQuantity ?? 0) + (distribution.stores?.content?.reduce((sum, s) => sum + (s.quantity ?? 0), 0) ?? 0)"
                  height="4"
                  color="success"
                  rounded
                />
              </div>
            </div>

            <div
              v-else
              class="text-center py-2 text-caption text-medium-emphasis"
            >
              지점 재고 없음
            </div>
          </div>
        </div>
      </VExpandTransition>
    </VCardText>
  </VCard>
</template>

<style scoped>
.text-primary {
  color: rgb(var(--v-theme-primary)) !important;
}

.border-b {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.store-item {
  padding: 4px 0;
}

.store-name {
  cursor: pointer;
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: text-decoration-color 0.2s;
}

.store-name:hover {
  text-decoration-color: rgb(var(--v-theme-primary));
  opacity: 0.8;
}

.cursor-pointer {
  cursor: pointer;
}

.cursor-pointer:hover {
  opacity: 0.8;
}

.distribution-only {
  width: 100%;
  height: 100%;
}

.distribution-content {
  padding: 24px;
}
</style>
