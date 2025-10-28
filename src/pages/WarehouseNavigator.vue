<template>
  <VContainer
    fluid
    class="pa-4"
  >
    <VRow>
      <VCol
        cols="12"
        md="4"
      >
        <VCard class="pa-4">
          <div class="text-h6 mb-3">
            출고 경로 안내
          </div>
          <div class="text-body-2 text-medium-emphasis mb-4">
            주문 부품의 창고 위치를 기반으로 최단 이동 동선을 안내합니다.
          </div>

          <VList density="compact">
            <VListItem
              v-for="(p, i) in orderList"
              :key="p.code"
              :title="`${i + 1}. ${p.name}`"
              :subtitle="`위치: ${p.location}`"
            >
              <template #prepend>
                <VAvatar
                  color="primary"
                  size="28"
                >
                  {{ i + 1 }}
                </VAvatar>
              </template>
            </VListItem>
          </VList>

          <VDivider class="my-3" />

          <div class="d-flex justify-space-between">
            <VBtn
              size="small"
              variant="tonal"
              :disabled="stepIndex<=0"
              @click="prevStep"
            >
              이전
            </VBtn>
            <VBtn
              size="small"
              variant="flat"
              color="primary"
              :disabled="stepIndex>=orderList.length"
              @click="nextStep"
            >
              다음
            </VBtn>
          </div>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="8"
      >
        <VCard>
          <VCardText>
            <div
              ref="canvasRef"
              style="width:100%; height:600px;"
            />
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </VContainer>
</template>

<script setup>
import { disposeWarehouse, focusNextPath, initWarehouseScene } from '@/utils/warehouseScene.js'
import { onBeforeUnmount, onMounted, ref } from 'vue'

// ✅ 데모용 주문 데이터
const orderList = ref([
  { code: 'P001', name: '엔진오일필터', location: 'B-5' },
  { code: 'P002', name: '점화플러그', location: 'D-2' },
  { code: 'P003', name: '브레이크패드', location: 'E-4' },
  { code: 'P004', name: '에어컨필터', location: 'A-3' },
])

const stepIndex = ref(0)
const canvasRef = ref(null)

onMounted(() => {
  initWarehouseScene(canvasRef.value, orderList.value)
})

onBeforeUnmount(() => {
  disposeWarehouse()
})

function nextStep() {
  if (stepIndex.value < orderList.value.length) {
    focusNextPath(stepIndex.value)
    stepIndex.value++
  }
}

function prevStep() {
  if (stepIndex.value > 0) {
    stepIndex.value--
    focusNextPath(stepIndex.value - 1)
  }
}
</script>
