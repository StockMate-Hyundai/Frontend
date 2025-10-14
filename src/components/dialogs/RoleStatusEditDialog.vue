<!-- src/views/user/list/RoleStatusEditDialog.vue -->
<script setup>
import { computed, ref, toRaw, watch } from 'vue'

const props = defineProps({
  user: { type: Object, required: true },
  isDialogVisible: { type: Boolean, required: true },
  roles: { type: Array, required: true },     // ex) [{ title:'슈퍼어드민', value:'SUPER_ADMIN' }, ...]
  statuses: { type: Array, required: true },  // ex) [{ title:'활성', value:'ACTIVE' }, ...]
})

const emit = defineEmits(['submit', 'update:isDialogVisible'])

const local = ref({
  // 읽기 전용 필드
  name: '',
  email: '',
  memberId: '',
  storeName: '',
  businessNumber: '',
  address: '',
  latitude: '',
  longitude: '',

  // 수정 가능 필드
  role: 'USER',
  status: 'PENDING',
})

watch(
  () => props.user,
  () => {
    const u = toRaw(props.user) || {}

    local.value = {
      // 표시는 안전하게 문자열화
      name: u.fullName ?? u.owner ?? '',
      email: u.email ?? '',
      memberId: u.memberId ?? u.id ?? '',
      storeName: u.storeName ?? '',
      businessNumber: u.businessNumber ?? '',
      address: u.address ?? '',
      latitude: (u.latitude ?? '') === '' ? '' : String(u.latitude),
      longitude: (u.longitude ?? '') === '' ? '' : String(u.longitude),
      role: u.role ?? 'USER',
      status: u.status ?? u.verified ?? 'PENDING',
    }
  },
  { immediate: true },
)

const title = computed(() => `${local.value.name || '유저'} 정보 수정`)

const onClose = () => emit('update:isDialogVisible', false)

const onSubmit = () => {
  emit('submit', { role: local.value.role, status: local.value.status })
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    :width="$vuetify.display.smAndDown ? 'auto' : 840"
    @update:model-value="val => emit('update:isDialogVisible', val)"
  >
    <DialogCloseBtn @click="onClose" />

    <VCard class="pa-2 pa-sm-8">
      <VCardItem class="text-center">
        <VCardTitle>
          <h4 class="text-h5 mb-1">
            {{ title }}
          </h4>
        </VCardTitle>
        <p class="text-body-2 mb-0">
          유저 역할 및 상태 수정 가능합니다.
        </p>
      </VCardItem>

      <VCardText class="pt-6">
        <VForm @submit.prevent="onSubmit">
          <VRow>
            <!-- 이름 / 이메일 -->
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model="local.name"
                label="이름"
                readonly
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model="local.email"
                label="이메일"
                readonly
              />
            </VCol>

            <!-- 멤버ID / 사업자번호 -->
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model="local.memberId"
                label="멤버 ID"
                readonly
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model="local.businessNumber"
                label="사업자번호"
                readonly
              />
            </VCol>

            <!-- 지점 / 주소 -->
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model="local.storeName"
                label="지점명"
                readonly
              />
            </VCol>

            <!-- <VDivider class="my-4" /> -->

            <!-- 🔧 수정 가능: 역할 / 상태 -->
            <VCol
              cols="12"
              md="6"
            >
              <AppSelect
                v-model="local.role"
                label="역할"
                :items="props.roles"
                item-title="title"
                item-value="value"
                placeholder="역할 선택"
                clearable
                clear-icon="bx-x"
              />
            </VCol>

            <VCol
              cols="12"
              md="6"
            >
              <AppSelect
                v-model="local.status"
                label="상태"
                :items="props.statuses"
                item-title="title"
                item-value="value"
                placeholder="상태 선택"
                clearable
                clear-icon="bx-x"
              />
            </VCol>

            <!-- 액션 -->
            <VCol
              cols="12"
              class="text-center"
            >
              <VBtn
                class="me-3"
                type="submit"
              >
                Submit
              </VBtn>
              <VBtn
                color="secondary"
                variant="tonal"
                @click="onClose"
              >
                Cancel
              </VBtn>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>
