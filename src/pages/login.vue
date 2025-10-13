<script setup>
import { apiLogin } from '@/api/auth'
import authV2LoginIllustration from '@images/pages/auth-v2-login-illustration.png'
import { VNodeRenderer } from '@layouts/components/VNodeRenderer'
import { themeConfig } from '@themeConfig'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const refVForm = ref(null)
const route = useRoute()
const router = useRouter()

definePage({
  meta: {
    layout: 'blank',
    public: true,
  },
})

const form = ref({
  email: '',
  password: '',
  remember: false,
})

const isPasswordVisible = ref(false)
const loading = ref(false)
const serverError = ref('')

// 간단한 인라인 검증(프로젝트의 requiredValidator, emailValidator 쓰고 싶으면 교체해도 됨)
const rules = {
  required: v => !!v || '필수 입력입니다.',
  email: v => /.[^\n\r@\u2028\u2029]*@.+\..+/.test(v) || '이메일 형식이 아닙니다.',
}

const onSubmit = () => {
  refVForm.value?.validate().then(({ valid }) => {
    if (valid) login()
  })
}

const login = async () => {
  serverError.value = ''
  loading.value = true
  try {
    // 스펙: POST /api/v1/auth/login { email, password }
    await apiLogin({ email: form.value.email, password: form.value.password })

    // 리다이렉트: redirect 또는 to 쿼리 지원
    const raw = route.query.redirect ?? route.query.to ?? '/'
    const redirect = Array.isArray(raw) ? (raw[0] || '/') : (typeof raw === 'string' ? raw : '/')

    router.replace(redirect)
  } catch (err) {
    // 서버가 주는 메시지 우선 노출
    console.log(err)

    const msg =
      err?.response?.data?.message ||
      err?.message ||
      '로그인 중 오류가 발생했습니다.'

    serverError.value = msg
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <a href="javascript:void(0)">
    <div class="auth-logo d-flex align-center gap-x-2">
      <VNodeRenderer :nodes="themeConfig.app.logo" />
      <VNodeRenderer :nodes="themeConfig.app.title" />
    </div>
  </a>

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
            :src="authV2LoginIllustration"
            class="auth-illustration"
          />
        </div>
      </div>
    </VCol>

    <VCol
      cols="12"
      md="4"
      class="auth-card-v2 d-flex align-center justify-center"
    >
      <VCard
        flat
        :max-width="500"
        class="mt-12 mt-sm-0 pa-6"
      >
        <VCardText>
          <h4 class="text-h4 mb-1">
            <span class="text-capitalize mr-1">
              <VNodeRenderer :nodes="themeConfig.app.title" />
            </span>에 어서오세요 !
          </h4>
          <p class="mb-0">
            서비스를 이용하기 위해 로그인 해주세요
          </p>
        </VCardText>

        <VCardText>
          <VForm
            ref="refVForm"
            @submit.prevent="onSubmit"
          >
            <VRow>
              <!-- email -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.email"
                  :rules="[rules.required, rules.email]"
                  label="이메일"
                  type="email"
                  placeholder="이메일을 입력해주세요"
                  autocomplete="username"
                />
              </VCol>

              <!-- password -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.password"
                  :rules="[rules.required]"
                  label="비밀번호"
                  placeholder="비밀번호를 입력해주세요"
                  :type="isPasswordVisible ? 'text' : 'password'"
                  autocomplete="current-password"
                  :append-inner-icon="isPasswordVisible ? 'bx-hide' : 'bx-show'"
                  @click:append-inner="isPasswordVisible = !isPasswordVisible"
                />

                <div
                  v-if="serverError"
                  class="text-error mt-3"
                >
                  {{ serverError }}
                </div>

                <div class="d-flex align-center flex-wrap justify-space-between my-6">
                  <!--
                    remember me 필요시 활성화
                    <VCheckbox v-model="form.remember" label="Remember me" />
                  -->
                </div>

                <VBtn
                  block
                  type="submit"
                  :loading="loading"
                  :disabled="loading"
                >
                  로그인
                </VBtn>
              </VCol>

              <!-- create account -->
              <VCol
                cols="12"
                class="text-body-1 text-center"
              >
                <span class="d-inline-block">계정이 없으신가요 ?</span>
                <RouterLink
                  class="text-primary ms-1 d-inline-block text-body-1"
                  :to="{ name: 'register' }"
                >
                  회원가입
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
