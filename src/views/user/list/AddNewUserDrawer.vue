<script setup>
import { apiRegister } from '@/api/auth'
import { nextTick, ref } from 'vue'
import { PerfectScrollbar } from 'vue3-perfect-scrollbar'

const props = defineProps({
  isDrawerOpen: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits([
  'update:isDrawerOpen',
  'userData',
])

const isFormValid = ref(false)
const refForm = ref()
const loading = ref(false)
const serverError = ref('')

// 회원가입 폼 필드
const form = ref({
  email: '',
  password: '',
  owner: '',
  address: '',
  storeName: '',
  businessNumber: '',
})

const isPasswordVisible = ref(false)

// 👉 drawer close
const closeNavigationDrawer = () => {
  serverError.value = ''
  emit('update:isDrawerOpen', false)
  nextTick(() => {
    refForm.value?.reset()
    refForm.value?.resetValidation()
  })
}

const onSubmit = async () => {
  serverError.value = ''
  
  const { valid } = await refForm.value?.validate()
  if (!valid) return

  loading.value = true
  try {
    // 스펙: MemberRegisterRequestDTO { email, password, owner, address, storeName, businessNumber }
    const payload = {
      email: form.value.email,
      password: form.value.password,
      owner: form.value.owner || undefined,
      address: form.value.address || undefined,
      storeName: form.value.storeName || undefined,
      businessNumber: form.value.businessNumber || undefined,
    }

    const res = await apiRegister(payload)
    if (res?.success) {
      const msg = res?.message || '사용자가 추가되었습니다.'
      alert(msg)
      emit('userData', payload)
      closeNavigationDrawer()
    } else {
      serverError.value = res?.message || '사용자 추가에 실패했습니다.'
    }
  } catch (e) {
    serverError.value = e?.response?.data?.message || '사용자 추가 중 오류가 발생했습니다.'
  } finally {
    loading.value = false
  }
}

const handleDrawerModelValueUpdate = val => {
  emit('update:isDrawerOpen', val)
}
</script>

<template>
  <VNavigationDrawer
    data-allow-mismatch
    temporary
    :width="400"
    location="end"
    border="none"
    class="scrollable-content"
    :model-value="props.isDrawerOpen"
    @update:model-value="handleDrawerModelValueUpdate"
  >
    <!-- 👉 Title -->
    <AppDrawerHeaderSection
      title="새 사용자 추가"
      @cancel="closeNavigationDrawer"
    />

    <VDivider />

    <PerfectScrollbar :options="{ wheelPropagation: false }">
      <VCard flat>
        <VCardText>
          <!-- 👉 Form -->
          <VForm
            ref="refForm"
            v-model="isFormValid"
            @submit.prevent="onSubmit"
          >
            <VRow>
              <!-- 대표자명 -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.owner"
                  :rules="[requiredValidator]"
                  label="대표자명"
                  placeholder="대표자명을 입력해주세요"
                />
              </VCol>

              <!-- 매장명 -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.storeName"
                  :rules="[requiredValidator]"
                  label="매장명"
                  placeholder="매장명을 입력해주세요"
                />
              </VCol>

              <!-- 이메일 -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.email"
                  :rules="[requiredValidator, emailValidator]"
                  label="이메일"
                  type="email"
                  placeholder="이메일을 입력해주세요"
                />
              </VCol>

              <!-- 비밀번호 -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.password"
                  :rules="[requiredValidator]"
                  label="비밀번호"
                  placeholder="비밀번호를 입력해주세요"
                  :type="isPasswordVisible ? 'text' : 'password'"
                  :append-inner-icon="isPasswordVisible ? 'bx-hide' : 'bx-show'"
                  @click:append-inner="isPasswordVisible = !isPasswordVisible"
                />
              </VCol>

              <!-- 주소 -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.address"
                  label="주소"
                  placeholder="주소를 입력해주세요"
                />
              </VCol>

              <!-- 사업자등록번호 -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.businessNumber"
                  label="사업자등록번호"
                  placeholder="123-45-67890"
                />
              </VCol>

              <!-- 서버 에러 -->
              <VCol cols="12">
                <div
                  v-if="serverError"
                  class="text-error mb-3"
                >
                  {{ serverError }}
                </div>
              </VCol>

              <!-- 👉 Submit and Cancel -->
              <VCol cols="12">
                <VBtn
                  type="submit"
                  class="me-4"
                  :loading="loading"
                  :disabled="loading"
                >
                  추가
                </VBtn>
                <VBtn
                  type="reset"
                  variant="tonal"
                  color="error"
                  @click="closeNavigationDrawer"
                >
                  취소
                </VBtn>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </PerfectScrollbar>
  </VNavigationDrawer>
</template>
