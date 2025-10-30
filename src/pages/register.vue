<script setup>
import { apiRegister } from '@/api/auth'
import authV2RegisterIllustration from '@images/pages/auth-v2-register-illustration.png'
import { VNodeRenderer } from '@layouts/components/VNodeRenderer'
import { themeConfig } from '@themeConfig'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { VForm } from 'vuetify/components/VForm'

definePage({
  meta: {
    layout: 'blank',
    public: true,               // 가드에서 보호 안 받도록
    unauthenticatedOnly: true,  // 로그인 상태면 접근 제한하려면 가드에서 사용
  },
})

const router = useRouter()

// ── 폼 상태 (API DTO에 맞춰 필드 구성)
const form = ref({
  owner: '',            // 대표자명 (was: username)
  storeName: '',        // 매장명   (was: id)
  email: '',
  password: '',
  address: '',
  businessNumber: '',
  privacyPolicies: false,
})

const isPasswordVisible = ref(false)
const loading = ref(false)
const serverError = ref('')
const refVForm = ref(null)

// ── 제출 핸들러
const onSubmit = async () => {
  serverError.value = ''

  const { valid } = await refVForm.value.validate()
  if (!valid) return
  if (!form.value.privacyPolicies) {
    serverError.value = '개인정보 정책 및 약관에 동의해 주세요.'
    
    return
  }

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

    const res = await apiRegister(payload) // { status, success, message, data:null }
    if (res?.success) {
      // 가입 성공 → 로그인 화면으로
      const msg = res?.message || '회원가입이 완료되었습니다. 로그인해 주세요.'


      // 알림 UI가 있으면 그걸로 대체
      alert(msg)
      router.replace({ name: 'login' })
    } else {
      serverError.value = res?.message || '회원가입에 실패했습니다.'
    }
  } catch (e) {
    serverError.value = e?.response?.data?.message || '회원가입 요청 중 오류가 발생했습니다.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <RouterLink to="/">
    <div class="auth-logo d-flex align-center gap-x-2">
      <VNodeRenderer :nodes="themeConfig.app.logo" />
      <VNodeRenderer :nodes="themeConfig.app.title" />
    </div>
  </RouterLink>

  <VRow
    no-gutters
    class="auth-wrapper bg-surface"
  >
    <VCol
      md="8"
      class="d-none d-md-flex"
    >
      <div class="position-relative bg-background w-100 pa-8">
        <div class="d-flex align-center justify-center w-100 h-100">
          <VImg
            max-width="700"
            :src="authV2RegisterIllustration"
            class="auth-illustration"
          />
        </div>
      </div>
    </VCol>

    <VCol
      cols="12"
      md="4"
      class="auth-card-v2 d-flex align-center justify-center"
      style="background-color: rgb(var(--v-theme-surface))"
    >
      <VCard
        flat
        :max-width="500"
        class="mt-12 mt-sm-0 pa-6"
      >
        <VCardText>
          <h4 class="text-h4 mb-1">
            회원가입
          </h4>
          <p class="mb-0">
            계정을 생성하세요 !
          </p>
        </VCardText>

        <VCardText>
          <VForm
            ref="refVForm"
            @submit.prevent="onSubmit"
          >
            <VRow>
              <!-- 대표자명 -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.owner"
                  :rules="[requiredValidator]"
                  label="대표자명"
                  placeholder="이름(대표자명)을 입력해주세요"
                  autocomplete="name"
                />
              </VCol>

              <!-- 매장명 -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.storeName"
                  :rules="[requiredValidator]"
                  label="매장명"
                  placeholder="매장명을 입력해주세요"
                  autocomplete="organization"
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
                  autocomplete="email"
                />
              </VCol>

              <!-- 비밀번호 -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.password"
                  :rules="[requiredValidator]"
                  label="비밀번호"
                  placeholder="비밀번호를 입력해주세요."
                  :type="isPasswordVisible ? 'text' : 'password'"
                  autocomplete="new-password"
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
                  autocomplete="street-address"
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

              <!-- 약관 동의 -->
              <VCol cols="12">
                <div class="d-flex align-center my-2">
                  <VCheckbox
                    id="privacy-policy"
                    v-model="form.privacyPolicies"
                    inline
                  />
                  <VLabel
                    for="privacy-policy"
                    style="opacity: 1"
                  >
                    <a
                      href="javascript:void(0)"
                      class="text-primary"
                    >개인정보 정책 및 약관</a>
                    <span class="me-1 text-high-emphasis">에 동의합니다</span>
                  </VLabel>
                </div>

                <!-- 서버 에러 -->
                <div
                  v-if="serverError"
                  class="text-error mb-3"
                >
                  {{ serverError }}
                </div>

                <VBtn
                  block
                  type="submit"
                  :loading="loading"
                  :disabled="loading"
                >
                  회원가입
                </VBtn>
              </VCol>

              <!-- 로그인 링크 -->
              <VCol
                cols="12"
                class="text-center text-base"
              >
                <span class="d-inline-block">이미 계정이 있으신가요 ?</span>
                <RouterLink
                  class="text-primary ms-1 d-inline-block"
                  :to="{ name: 'login' }"
                >
                  로그인하기
                </RouterLink>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>

<style lang="scss">
@use "@core/scss/template/pages/page-auth";
</style>
