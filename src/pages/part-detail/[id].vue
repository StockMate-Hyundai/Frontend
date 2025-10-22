<!-- File: src/pages/part-detail/[id].vue -->
<script setup>
import { getPartById } from '@/api/parts'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// 좌측 패널 / 우측 탭 컴포넌트
import PartBioPanel from '@/views/parts/view/PartBioPanel.vue'
import PartWarehouse3D from '@/views/parts/view/PartWarehouse3D.vue'

definePage({ meta: { public: true } })

/* 라우팅 */
const route  = useRoute('part-detail-id') // 파일 경로 기준 자동 생성된 네임
const router = useRouter()
const partId = computed(() => String(route.params.id ?? ''))

/* 상태 */
const loading = ref(true)
const errorMsg = ref('')
const part = ref(null)

/* 탭 */
const tab = ref(0)
const tabs = [
  { icon: 'bx-cube', title: '창고 위치 (3D)' },
  // 필요 시 탭을 더 추가 가능
]

/* 데이터 로드 */
async function load() {
  if (!partId.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const p = await getPartById(partId.value)
    if (!p) throw new Error('해당 ID의 부품을 찾을 수 없습니다.')
    part.value = p
  } catch (e) {
    console.error('[PartDetail] load error:', e)
    errorMsg.value = e?.message || '부품 상세 조회 중 오류가 발생했습니다.'
    part.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => route.params.id, load)

/* 액션 */
function goBack() {
  if (window.history.length > 1) router.back()
  else router.replace({ name: 'parts' }).catch(() => {})
}
</script>

<template>
  <div>
    <!-- 상단 바 -->
    <!-- <div class="d-flex align-center flex-wrap gap-3 mb-4">
      <VBtn variant="text" prepend-icon="bx-left-arrow-alt" @click="goBack">뒤로</VBtn>
      <VDivider vertical class="mx-2" />
      <div class="text-h6 text-high-emphasis">
        {{ (part?.korName || part?.engName || part?.name || `#${partId}`) ?? '' }}
      </div>
      <VSpacer />
    </div> -->

    <!-- 로딩/에러 -->
    <div v-if="loading">
      <VCard class="pa-6">
        <VSkeletonLoader type="article, list-item, list-item" />
      </VCard>
    </div>

    <VRow v-else-if="part">
      <!-- 좌측 정보 패널 -->
      <VCol cols="12" md="5" lg="4">
        <PartBioPanel :part="part" />
      </VCol>

      <!-- 우측 탭 영역 -->
      <VCol cols="12" md="7" lg="8">
        <VTabs v-model="tab" class="v-tabs-pill">
          <VTab v-for="t in tabs" :key="t.icon">
            <VIcon :size="18" :icon="t.icon" class="me-1" />
            <span>{{ t.title }}</span>
          </VTab>
        </VTabs>

        <VWindow v-model="tab" class="mt-6 disable-tab-transition" :touch="false">
          <!-- 창고 위치 (3D) -->
          <VWindowItem>
            <VCard class="pa-4">
              <PartWarehouse3D :location="part.location" />
            </VCard>
          </VWindowItem>
        </VWindow>
      </VCol>
    </VRow>

    <div v-else>
      <VAlert type="error" variant="tonal">
        부품(ID: {{ route.params.id }})을(를) 찾을 수 없습니다.<br />
        <span class="text-disabled">{{ errorMsg }}</span>
      </VAlert>
    </div>
  </div>
</template>
