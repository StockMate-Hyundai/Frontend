<!-- File: src/pages/part-detail/[id].vue -->
<script setup>
import { getPartById } from '@/api/parts'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// 좌측 패널 / 우측 탭 컴포넌트
import PartBioPanel from '@/views/parts/view/PartBioPanel.vue'
import PartWarehouse3D from '@/views/parts/view/PartWarehouse3D.vue'

definePage({
  meta: {
    title: '부품 상세',
    icon: 'bx-package',
    public: true,
  },
})

/* 라우팅 */
const route  = useRoute('part-detail-id') // 파일 경로 기준 자동 생성된 네임
const router = useRouter()
const partId = computed(() => String(route.params.id ?? ''))

/* 상태 */
const loading = ref(true)
const errorMsg = ref('')
const part = ref(null)

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
  <div class="page-container part-detail-page">
    <!-- 로딩/에러 -->
    <div v-if="loading">
      <VCard class="pa-6">
        <VSkeletonLoader type="article, list-item, list-item" />
      </VCard>
    </div>

    <div v-else-if="!part">
      <VAlert
        type="error"
        variant="tonal"
      >
        부품 ID {{ route.params.id }}를 찾을 수 없습니다.<br>
        <span class="text-disabled">{{ errorMsg }}</span>
      </VAlert>
    </div>

    <!-- 메인 콘텐츠 -->
    <div v-else>
      <div class="part-grid">
        <!-- 좌측 정보 패널 -->
        <div class="erp-info-card">
          <PartBioPanel :part="part" />
        </div>

        <!-- 우측 3D 창고 뷰어 -->
        <VCard class="erp-tabs-card">
          <VCardTitle class="erp-card-title">
            <VIcon
              icon="bx-cube"
              size="18"
              class="me-2"
            />
            창고 위치
          </VCardTitle>
          <VDivider />
          <VCardText class="erp-tabs-content">
            <div class="warehouse-container">
              <PartWarehouse3D :location="part.location" />
            </div>
          </VCardText>
        </VCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== 페이지 컨테이너 ===== */
.page-container.part-detail-page {
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
  min-height: 100vh;
}

/* ===== 메인 그리드 ===== */
.part-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 0.8fr 1.6fr;
  grid-template-rows: 1fr;
  grid-template-areas: "info warehouse";
  gap: 20px;
  min-height: 0;
  max-height: 85vh;
  height: 85vh;
}

/* ERP 정보 카드 */
.erp-info-card {
  grid-area: info;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  overflow-y: auto;
}

.erp-card-title {
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  padding: 16px 20px;
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
  display: flex;
  align-items: center;
}

.erp-tabs-card {
  grid-area: warehouse;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
}

.erp-tabs-content {
  flex: 1;
  padding: 0;
  overflow: hidden;
}

.warehouse-container {
  width: 100%;
  height: calc(85vh - 57px); /* 헤더 높이 제외 */
  padding: 20px;
}

/* 반응형 */
@media (max-width: 1200px) {
  .part-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    grid-template-areas: "info" "warehouse";
    gap: 16px;
    padding: 0 16px 20px 16px;
  }
  
  .erp-info-card,
  .erp-tabs-card {
    max-height: none;
    min-height: 50vh;
  }
  
  .warehouse-container {
    height: 60vh;
  }
}

@media (max-width: 768px) {
  .part-grid {
    gap: 12px;
    padding: 0 12px 16px 12px;
  }
  
  .erp-info-card,
  .erp-tabs-card {
    min-height: 40vh;
  }
  
  .warehouse-container {
    height: 40vh;
    padding: 12px;
  }
}
</style>
