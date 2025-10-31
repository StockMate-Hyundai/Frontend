<!-- File: src/components/dialogs/HistoryDetailDialog.vue -->
<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { getProfile } from '@/api/http'

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
    PENDING: { color: 'warning', icon: 'bx-time-five' },
    APPROVED: { color: 'info', icon: 'bx-check-circle' },
    REJECTED: { color: 'error', icon: 'bx-x-circle' },
    COMPLETED: { color: 'success', icon: 'bx-check' },
    CANCELLED: { color: 'default', icon: 'bx-block' },
    RECEIVED: { color: 'success', icon: 'bx-down-arrow-alt' },
    RELEASED: { color: 'error', icon: 'bx-up-arrow-alt' },
  }
  return variants[s] || { color: 'default', icon: 'bx-circle' }
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
    @update:model-value="dialogModelValueUpdate"
    scrollable
  >
    <DialogCloseBtn @click="dialogModelValueUpdate(false)" />

    <VCard
      v-if="props.history"
      class="history-detail-card"
    >
      <!-- 헤더 -->
      <VCardTitle class="history-header">
        <div class="d-flex align-center gap-3">
          <div class="history-header-badge">
            <VChip
              size="small"
              :color="props.history.type === 'INBOUND' ? 'success' : 'error'"
              variant="tonal"
              class="type-chip"
            >
              <VIcon
                :icon="props.history.type === 'INBOUND' ? 'bx-down-arrow-alt' : 'bx-up-arrow-alt'"
                size="16"
                class="me-1"
              />
              {{ resolveTypeLabel(props.history.type) }}
            </VChip>
            <VChip
              size="small"
              :color="resolveStatusVariant(props.history.status).color"
              variant="tonal"
              class="status-chip"
            >
              <VIcon
                :icon="resolveStatusVariant(props.history.status).icon"
                size="14"
                class="me-1"
              />
              {{ resolveStatusLabel(props.history.status) }}
            </VChip>
          </div>
          <div class="history-header-info">
            <div class="text-h6">
              히스토리 상세 정보
            </div>
            <div class="text-caption text-medium-emphasis">
              ID: {{ props.history.id }}
            </div>
          </div>
        </div>
      </VCardTitle>

      <VDivider />

      <VCardText class="history-content">
        <!-- 기본 정보 섹션 -->
        <div class="info-section">
          <div class="section-title">
            기본 정보
          </div>
          <VRow dense>
            <VCol
              v-if="props.history.orderNumber"
              cols="12"
              md="6"
            >
              <div class="info-item">
                <div class="info-label">
                  <VIcon
                    icon="bx-receipt"
                    size="18"
                    class="me-1"
                  />
                  주문번호
                </div>
                <div class="info-value">
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
            </VCol>

            <VCol
              v-if="props.history.userInfo && isAdmin"
              cols="12"
              md="6"
            >
              <div class="info-item">
                <div class="info-label">
                  <VIcon
                    icon="bx-store"
                    size="18"
                    class="me-1"
                  />
                  가맹점
                </div>
                <div class="info-value">
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
            </VCol>

            <VCol cols="12">
              <div class="info-item">
                <div class="info-label">
                  <VIcon
                    icon="bx-time"
                    size="18"
                    class="me-1"
                  />
                  등록일시
                </div>
                <div class="info-value">
                  {{ fmtDateTime(props.history.createdAt) }}
                </div>
              </div>
            </VCol>

            <VCol
              v-if="props.history.message"
              cols="12"
            >
              <div class="info-item">
                <div class="info-label">
                  <VIcon
                    icon="bx-message"
                    size="18"
                    class="me-1"
                  />
                  메시지
                </div>
                <div class="info-value message-text">
                  {{ props.history.message }}
                </div>
              </div>
            </VCol>
          </VRow>
        </div>

        <!-- 부품 목록 섹션 -->
        <VDivider class="my-4" />
        <div class="parts-section">
          <div class="section-header">
            <div class="section-title">
              부품 목록
            </div>
            <VChip
              size="small"
              color="primary"
              variant="tonal"
            >
              {{ items.length }}건
            </VChip>
            <VChip
              size="small"
              color="success"
              variant="tonal"
            >
              총 {{ totalQuantity }}개
            </VChip>
          </div>

          <div
            v-if="items.length === 0"
            class="empty-state"
          >
            <VIcon
              icon="bx-package"
              size="48"
              class="empty-icon"
            />
            <div class="text-body-1 text-medium-emphasis">
              등록된 부품이 없습니다
            </div>
          </div>

          <div
            v-else
            class="parts-grid"
          >
            <VCard
              v-for="(item, index) in items"
              :key="index"
              variant="outlined"
              class="part-card"
              @click="router.push({ name: 'part-detail-id', params: { id: item.id } })"
            >
              <VCardText class="part-card-content">
                <div class="d-flex align-start gap-3">
                  <VAvatar
                    v-if="item.image"
                    :image="item.image"
                    size="56"
                    rounded
                    class="part-avatar"
                  />
                  <VAvatar
                    v-else
                    size="56"
                    color="secondary"
                    variant="tonal"
                    rounded
                    class="part-avatar"
                  >
                    <VIcon
                      icon="bx-package"
                      size="28"
                    />
                  </VAvatar>

                  <div class="part-info flex-grow-1">
                    <div class="part-name">
                      {{ item.korName || item.engName || item.name || '이름 없음' }}
                    </div>
                    <div class="part-meta">
                      <span class="part-id">ID: {{ item.id }}</span>
                      <span
                        v-if="item.model || item.spec"
                        class="part-spec"
                      >
                        {{ [item.model, item.spec].filter(Boolean).join(' · ') }}
                      </span>
                    </div>
                  </div>

                  <div class="part-quantity">
                    <VChip
                      size="small"
                      color="primary"
                      variant="flat"
                      class="quantity-chip"
                    >
                      {{ item.historyQuantity || item.quantity || 0 }}개
                    </VChip>
                  </div>
                </div>
              </VCardText>
            </VCard>
          </div>
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="history-actions">
        <VSpacer />
        <VBtn
          color="primary"
          variant="flat"
          @click="dialogModelValueUpdate(false)"
        >
          닫기
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.history-detail-card {
  border-radius: 12px;
}

.history-header {
  padding: 20px 24px;
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.08) 0%, rgba(var(--v-theme-primary), 0.02) 100%);
}

.history-header-badge {
  display: flex;
  gap: 8px;
  align-items: center;
}

.type-chip,
.status-chip {
  font-weight: 600;
}

.history-header-info {
  flex: 1;
}

.history-content {
  padding: 24px;
}

.info-section,
.parts-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.info-item {
  margin-bottom: 16px;
}

.info-label {
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 6px;
}

.info-value {
  font-size: 15px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
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

.parts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.part-card {
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 8px;
}

.part-card:hover {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 2px 8px rgba(var(--v-theme-primary), 0.15);
  transform: translateY(-2px);
}

.part-card-content {
  padding: 16px !important;
}

.part-avatar {
  flex-shrink: 0;
}

.part-info {
  min-width: 0;
}

.part-name {
  font-size: 15px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  margin-bottom: 6px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.part-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.part-id {
  font-family: monospace;
}

.part-spec {
  color: rgba(var(--v-theme-on-surface), 0.5);
}

.part-quantity {
  display: flex;
  align-items: flex-start;
  flex-shrink: 0;
}

.quantity-chip {
  font-weight: 600;
}

.history-actions {
  padding: 16px 24px;
}
</style>
