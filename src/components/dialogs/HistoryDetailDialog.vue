<!-- File: src/components/dialogs/HistoryDetailDialog.vue -->
<script setup>
import { getProfile } from '@/api/http'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  history: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'deleted',
  'updated',
  'close',
])

const router = useRouter()
const userRole = computed(() => (getProfile().role || 'USER').toUpperCase())
const isAdmin = computed(() => ['ADMIN', 'SUPER_ADMIN'].includes(userRole.value))

function dialogModelValueUpdate(val) {
  emit('update:isDialogVisible', val)
  if (!val) {
    emit('close')
  }
}

function fmtDateTime(s) {
  if (!s) return '-'
  const d = new Date(s)
  
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function resolveTypeLabel(t) {
  const labels = { INBOUND: '입고', OUTBOUND: '출고' }
  
  return labels[t] || t || '-'
}

function resolveStatusLabel(s) {
  const labels = {
    PENDING: '대기',
    APPROVED: '승인',
    REJECTED: '반려',
    COMPLETED: '완료',
    CANCELLED: '취소',
    RECEIVED: '입고',
    RELEASED: '출고',
  }

  
  return labels[s] || s || '-'
}

function resolveStatusVariant(s) {
  const variants = {
    PENDING: { color: 'warning' },
    APPROVED: { color: 'info' },
    REJECTED: { color: 'error' },
    COMPLETED: { color: 'success' },
    CANCELLED: { color: 'default' },
    RECEIVED: { color: 'success' },
    RELEASED: { color: 'error' },
  }

  
  return variants[s] || { color: 'default' }
}

const items = computed(() => props.history?.items || [])

const totalQuantity = computed(() => {
  return items.value.reduce((sum, item) => sum + (item.historyQuantity || item.quantity || 0), 0)
})
</script>

<template>
  <VDialog
    :width="$vuetify.display.smAndDown ? 'auto' : 900"
    :model-value="props.isDialogVisible"
    scrollable
    class="history-detail-dialog"
    @update:model-value="dialogModelValueUpdate"
  >
    <DialogCloseBtn @click="dialogModelValueUpdate(false)" />

    <VCard
      v-if="props.history"
      class="history-detail-card"
    >
      <!-- 헤더 -->
      <div class="compact-header">
        <div class="d-flex justify-space-between align-center flex-wrap gap-y-2">
          <div>
            <div class="d-flex gap-2 align-center mb-1 flex-wrap">
              <h6 class="text-subtitle-1 text-high-emphasis">
                히스토리 #{{ props.history.id }}
              </h6>
              <VChip
                :color="props.history.type === 'INBOUND' ? 'success' : 'error'"
                variant="tonal"
                label
                size="x-small"
              >
                {{ resolveTypeLabel(props.history.type) }}
              </VChip>
              <VChip
                :color="resolveStatusVariant(props.history.status).color"
                variant="tonal"
                label
                size="x-small"
              >
                {{ resolveStatusLabel(props.history.status) }}
              </VChip>
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ fmtDateTime(props.history.createdAt) }}
            </div>
          </div>
        </div>
      </div>

      <VDivider />

      <!-- 메인 콘텐츠 -->
      <VCardText class="history-content">
        <div class="history-grid">
          <!-- 좌측: 기본 정보 -->
          <VCard
            variant="outlined"
            class="info-card"
          >
            <VCardTitle class="text-subtitle-2 text-high-emphasis d-flex align-center">
              <VIcon
                icon="bx-info-circle"
                size="18"
                class="me-2"
              />
              기본 정보
            </VCardTitle>
            <VDivider />
            <VCardText>
              <div class="info-section">
                <div
                  v-if="props.history.orderNumber"
                  class="info-row"
                >
                  <div class="info-label">
                    주문번호
                  </div>
                  <div class="info-content">
                    <VBtn
                      v-if="props.history.orderId"
                      variant="text"
                      color="primary"
                      size="small"
                      class="link-btn"
                      @click="router.push({ name: 'order-detail-id', params: { id: props.history.orderId } })"
                    >
                      #{{ props.history.orderNumber }}
                      <VIcon
                        icon="bx-link-external"
                        size="14"
                        class="ms-1"
                      />
                    </VBtn>
                    <span v-else>#{{ props.history.orderNumber }}</span>
                  </div>
                </div>

                <div
                  v-if="props.history.userInfo && isAdmin"
                  class="info-row"
                >
                  <div class="info-label">
                    가맹점
                  </div>
                  <div class="info-content">
                    <VBtn
                      v-if="props.history.userInfo.memberId"
                      variant="text"
                      color="primary"
                      size="small"
                      class="link-btn"
                      @click="router.push({ name: 'user-detail-id', params: { id: String(props.history.userInfo.memberId) } })"
                    >
                      {{ props.history.userInfo.storeName || props.history.userInfo.email }}
                      <VIcon
                        icon="bx-link-external"
                        size="14"
                        class="ms-1"
                      />
                    </VBtn>
                    <span v-else>{{ props.history.userInfo.storeName || props.history.userInfo.email }}</span>
                  </div>
                </div>

                <div
                  v-if="props.history.message"
                  class="info-row"
                >
                  <div class="info-label">
                    메시지
                  </div>
                  <div class="info-content ">
                    {{ props.history.message }}
                  </div>
                </div>
              </div>
            </VCardText>
          </VCard>

          <!-- 우측: 부품 목록 -->
          <VCard
            variant="outlined"
            class="parts-card"
          >
            <VCardTitle class="text-subtitle-2 text-high-emphasis d-flex align-center justify-space-between">
              <div class="d-flex align-center">
                <VIcon
                  icon="bx-package"
                  size="18"
                  class="me-2"
                />
                부품 목록
              </div>
              <div class="d-flex gap-2">
                <VChip
                  size="x-small"
                  color="primary"
                  variant="tonal"
                >
                  {{ items.length }}건
                </VChip>
                <VChip
                  size="x-small"
                  color="success"
                  variant="tonal"
                >
                  총 {{ totalQuantity }}개
                </VChip>
              </div>
            </VCardTitle>
            <VDivider />
            <VCardText>
              <div class="card-scroll">
                <div
                  v-if="items.length === 0"
                  class="empty-state"
                >
                  <VIcon
                    icon="bx-package"
                    size="48"
                    class="empty-icon"
                  />
                  <div class="text-body-2 text-medium-emphasis">
                    등록된 부품이 없습니다
                  </div>
                </div>

                <div
                  v-else
                  class="parts-list"
                >
                  <div
                    v-for="(item, index) in items"
                    :key="index"
                    class="part-item"
                    @click="router.push({ name: 'part-detail-id', params: { id: item.id } })"
                  >
                    <div class="d-flex align-center gap-3">
                      <VAvatar
                        v-if="item.image"
                        :image="item.image"
                        size="48"
                        rounded
                      />
                      <VAvatar
                        v-else
                        size="48"
                        color="secondary"
                        variant="tonal"
                        rounded
                      >
                        <VIcon
                          icon="bx-package"
                          size="24"
                        />
                      </VAvatar>

                      <div class="part-info flex-grow-1">
                        <div class="part-name">
                          {{ item.korName || item.engName || item.name || '이름 없음' }}
                        </div>
                        <div class="part-meta">
                          <span class="text-caption text-medium-emphasis">ID: {{ item.id }}</span>
                          <span
                            v-if="item.model || item.spec"
                            class="text-caption text-medium-emphasis ml-2"
                          >
                            {{ [item.model, item.spec].filter(Boolean).join(' · ') }}
                          </span>
                        </div>
                      </div>

                      <VChip
                        size="small"
                        color="primary"
                        variant="flat"
                      >
                        {{ item.historyQuantity || item.quantity || 0 }}개
                      </VChip>
                    </div>
                  </div>
                </div>
              </div>
            </VCardText>
          </VCard>
        </div>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.history-detail-card {
  border-radius: 12px;
}

.compact-header {
  padding: 20px 24px;
}

.history-content {
  padding: 24px;
}

.history-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 16px;
}

.info-card,
.parts-card {
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--erp-border-light);
}

.info-section {
  padding-top: 8px;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  min-width: 80px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--erp-text-secondary);
  flex-shrink: 0;
}

.info-content {
  flex: 1;
  display: flex;
  align-items: center;
  word-break: break-word;
}

.link-btn {
  text-transform: none;
  font-weight: 500;
  padding: 0;
  height: auto;
  min-height: auto;
}

.message-text {
  padding: 12px;
  background: rgba(var(--v-theme-surface), 0.5);
  border-radius: 8px;
  border-left: 3px solid rgb(var(--v-theme-primary));
  font-size: 0.875rem;
}

.card-scroll {
  max-height: 400px;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  color: rgba(var(--v-theme-on-surface), 0.3);
  margin-bottom: 16px;
}

.parts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.part-item {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--erp-border-light);
  cursor: pointer;
  transition: all 0.2s ease;
}

.part-item:hover {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.04);
}

.part-info {
  min-width: 0;
}

.part-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  margin-bottom: 4px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.part-meta {
  display: flex;
  align-items: center;
  gap: 4px;
}

.history-actions {
  padding: 16px 24px;
}

@media (max-width: 960px) {
  .history-grid {
    grid-template-columns: 1fr;
  }
}

/* 히스토리 상세 다이얼로그가 항상 최상위에 표시되도록 */
.history-detail-dialog :deep(.v-overlay__content) {
  z-index: 2001 !important;
}

.history-detail-dialog :deep(.v-overlay) {
  z-index: 2000 !important;
}
</style>
