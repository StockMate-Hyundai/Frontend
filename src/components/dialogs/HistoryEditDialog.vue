<!-- File: src/components/dialogs/HistoryEditDialog.vue -->
<script setup>
import { registerReceivingHistory } from '@/api/orderHistory'
import { searchParts } from '@/api/parts'
import { getProfile } from '@/api/http'
import { computed, ref, watch, onMounted } from 'vue'

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    required: true,
  },
  date: {
    type: String,
    default: null,
  },
  history: {
    type: Object,
    default: null,
  },
  memberId: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits([
  'update:isDialogVisible',
  'saved',
  'close',
])

const userRole = computed(() => (getProfile().role || 'USER').toUpperCase())
const isAdmin = computed(() => ['ADMIN', 'SUPER_ADMIN'].includes(userRole.value))

/* =========================
   폼 데이터
========================= */
const formData = ref({
  memberId: null,
  orderNumber: '',
  message: '',
  status: 'PENDING',
  type: 'INBOUND',
  items: [],
})

const selectedDate = ref(props.date || new Date().toISOString().split('T')[0])

/* =========================
   부품 검색
========================= */
const partSearchQuery = ref('')
const partSearchResults = ref([])
const partSearchLoading = ref(false)

async function searchPartsFunc() {
  if (!partSearchQuery.value?.trim()) {
    partSearchResults.value = []
    return
  }

  partSearchLoading.value = true
  try {
    const result = await searchParts({
      page: 0,
      size: 20,
    })
    // 간단한 필터링 (실제로는 서버에서 검색해야 함)
    partSearchResults.value = (result.content || []).filter(p => {
      const query = partSearchQuery.value.toLowerCase()
      return (
        String(p.id).toLowerCase().includes(query) ||
        (p.korName || '').toLowerCase().includes(query) ||
        (p.engName || '').toLowerCase().includes(query) ||
        (p.model || '').toLowerCase().includes(query)
      )
    })
  } catch (e) {
    console.error('[HistoryEditDialog] searchParts error:', e)
    partSearchResults.value = []
  } finally {
    partSearchLoading.value = false
  }
}

function selectPart(part) {
  const existing = formData.value.items.find(item => item.id === part.id)
  if (existing) {
    existing.quantity = (existing.quantity || 0) + 1
  } else {
    formData.value.items.push({
      id: part.id,
      name: part.korName || part.engName || part.name,
      image: part.image,
      historyQuantity: 1,
    })
  }
  partSearchQuery.value = ''
  partSearchResults.value = []
}

function removeItem(index) {
  formData.value.items.splice(index, 1)
}

function updateItemQuantity(index, quantity) {
  if (quantity < 1) quantity = 1
  formData.value.items[index].historyQuantity = quantity
}

/* =========================
   저장
========================= */
const saving = ref(false)

async function save() {
  if (!formData.value.items.length) {
    alert('부품을 최소 1개 이상 추가해주세요.')
    return
  }

  saving.value = true
  try {
    await registerReceivingHistory({
      memberId: formData.value.memberId || props.memberId || undefined,
      orderId: formData.value.orderId || undefined,
      orderNumber: formData.value.orderNumber || undefined,
      message: formData.value.message || undefined,
      status: formData.value.status,
      type: formData.value.type,
      items: formData.value.items.map(item => ({
        partId: item.id,
        quantity: item.historyQuantity,
      })),
    })

    emit('saved')
  } catch (e) {
    console.error('[HistoryEditDialog] save error:', e)
    alert('히스토리 등록에 실패했습니다.')
  } finally {
    saving.value = false
  }
}

function cancel() {
  resetForm()
  emit('close')
}

function resetForm() {
  formData.value = {
    memberId: null,
    orderNumber: '',
    message: '',
    status: 'PENDING',
    type: 'INBOUND',
    items: [],
  }
  selectedDate.value = props.date || new Date().toISOString().split('T')[0]
  partSearchQuery.value = ''
  partSearchResults.value = []
}

function dialogModelValueUpdate(val) {
  emit('update:isDialogVisible', val)
  if (!val) {
    resetForm()
  }
}

function initializeForm() {
  if (props.history) {
    // 수정 모드
    formData.value = {
      memberId: props.history.memberId,
      orderNumber: props.history.orderNumber || '',
      message: props.history.message || '',
      status: props.history.status || 'PENDING',
      type: props.history.type || 'INBOUND',
      items: (props.history.items || []).map(item => ({
        id: item.id,
        name: item.korName || item.engName || item.name,
        image: item.image,
        historyQuantity: item.historyQuantity || 1,
      })),
    }
    if (props.history.createdAt) {
      selectedDate.value = new Date(props.history.createdAt).toISOString().split('T')[0]
    }
  } else {
    // 신규 등록 모드
    resetForm()
    if (props.date) {
      selectedDate.value = props.date
    }
    if (props.memberId) {
      formData.value.memberId = props.memberId
    }
  }
}

watch(() => props.isDialogVisible, (newVal) => {
  if (newVal) {
    initializeForm()
  }
})

watch(() => [props.history, props.date, props.memberId], () => {
  if (props.isDialogVisible) {
    initializeForm()
  }
})

onMounted(() => {
  if (props.isDialogVisible) {
    initializeForm()
  }
})
</script>

<template>
  <VDialog
    :width="$vuetify.display.smAndDown ? 'auto' : 800"
    :model-value="props.isDialogVisible"
    @update:model-value="dialogModelValueUpdate"
    scrollable
  >
    <DialogCloseBtn @click="dialogModelValueUpdate(false)" />

    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between">
        <span>{{ props.history ? '히스토리 수정' : '새 히스토리 등록' }}</span>
      </VCardTitle>

      <VDivider />

      <VCardText style="height: 70vh;">
        <VForm @submit.prevent="save">
          <VRow>
            <!-- 날짜 -->
            <VCol cols="12">
              <AppDateTimePicker
                v-model="selectedDate"
                label="날짜"
                placeholder="날짜 선택"
                :config="{ dateFormat: 'Y-m-d', enableTime: false, maxDate: new Date().toISOString().split('T')[0] }"
              />
            </VCol>

            <!-- 타입 -->
            <VCol cols="12">
              <VSelect
                v-model="formData.type"
                label="타입"
                :items="[
                  { title: '입고', value: 'INBOUND' },
                  { title: '출고', value: 'OUTBOUND' },
                ]"
                variant="outlined"
              />
            </VCol>

            <!-- 상태 -->
            <VCol cols="12">
              <VSelect
                v-model="formData.status"
                label="상태"
                :items="[
                  { title: '대기', value: 'PENDING' },
                  { title: '승인', value: 'APPROVED' },
                  { title: '반려', value: 'REJECTED' },
                  { title: '완료', value: 'COMPLETED' },
                  { title: '취소', value: 'CANCELLED' },
                  { title: '입고', value: 'RECEIVED' },
                  { title: '출고', value: 'RELEASED' },
                ]"
                variant="outlined"
              />
            </VCol>

            <!-- 주문번호 -->
            <VCol cols="12">
              <AppTextField
                v-model="formData.orderNumber"
                label="주문번호 (선택)"
                placeholder="주문번호를 입력하세요"
                variant="outlined"
              />
            </VCol>

            <!-- 메시지 -->
            <VCol cols="12">
              <AppTextarea
                v-model="formData.message"
                label="메시지"
                placeholder="메시지를 입력하세요"
                variant="outlined"
                rows="3"
              />
            </VCol>

            <!-- 부품 검색 -->
            <VCol cols="12">
              <div class="text-subtitle-2 mb-2">
                부품 추가
              </div>
              <VTextField
                v-model="partSearchQuery"
                placeholder="부품 ID, 이름, 모델로 검색"
                variant="outlined"
                density="compact"
                prepend-inner-icon="bx-search"
                @input="searchPartsFunc"
              />
              
              <!-- 검색 결과 -->
              <div
                v-if="partSearchResults.length > 0"
                class="part-search-results mt-2"
              >
                <VList density="compact">
                  <VListItem
                    v-for="part in partSearchResults"
                    :key="part.id"
                    @click="selectPart(part)"
                  >
                    <template #prepend>
                      <VAvatar
                        v-if="part.image"
                        :image="part.image"
                        size="32"
                        rounded
                      />
                      <VAvatar
                        v-else
                        size="32"
                        color="secondary"
                        variant="tonal"
                      >
                        <VIcon
                          icon="bx-package"
                          size="16"
                        />
                      </VAvatar>
                    </template>
                    <VListItemTitle>
                      {{ part.korName || part.engName || part.name }}
                    </VListItemTitle>
                    <VListItemSubtitle>
                      ID: {{ part.id }}
                    </VListItemSubtitle>
                  </VListItem>
                </VList>
              </div>
            </VCol>

            <!-- 선택된 부품 목록 -->
            <VCol cols="12">
              <div class="text-subtitle-2 mb-2">
                선택된 부품 ({{ formData.items.length }})
              </div>
              
              <div
                v-if="formData.items.length === 0"
                class="text-center py-8 text-medium-emphasis"
              >
                부품을 검색하여 추가해주세요
              </div>
              
              <VList
                v-else
                density="compact"
              >
                <VListItem
                  v-for="(item, index) in formData.items"
                  :key="index"
                >
                  <template #prepend>
                    <VAvatar
                      v-if="item.image"
                      :image="item.image"
                      size="40"
                      rounded
                    />
                    <VAvatar
                      v-else
                      size="40"
                      color="secondary"
                      variant="tonal"
                    >
                      <VIcon
                        icon="bx-package"
                        size="20"
                      />
                    </VAvatar>
                  </template>
                  
                  <VListItemTitle>
                    {{ item.name }}
                  </VListItemTitle>
                  <VListItemSubtitle>
                    ID: {{ item.id }}
                  </VListItemSubtitle>
                  
                  <template #append>
                    <div class="d-flex align-center gap-2">
                      <VTextField
                        :model-value="item.historyQuantity"
                        type="number"
                        min="1"
                        density="compact"
                        variant="outlined"
                        style="width: 80px;"
                        hide-details
                        @update:model-value="val => updateItemQuantity(index, Number(val))"
                      />
                      <VBtn
                        icon
                        size="small"
                        variant="text"
                        color="error"
                        @click="removeItem(index)"
                      >
                        <VIcon
                          icon="bx-trash"
                          size="20"
                        />
                      </VBtn>
                    </div>
                  </template>
                </VListItem>
              </VList>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <VDivider />

      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          @click="cancel"
        >
          취소
        </VBtn>
        <VBtn
          color="primary"
          :loading="saving"
          @click="save"
        >
          저장
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.part-search-results {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 4px;
}
</style>

