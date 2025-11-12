<script setup>
import { apiLogin } from '@/api/auth'
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
  <div class="login-page">
    <!-- 로고 -->
    <div class="login-header">
      <RouterLink to="/" class="logo-link">
        <VNodeRenderer :nodes="themeConfig.app.logo" />
        <VNodeRenderer :nodes="themeConfig.app.title" />
      </RouterLink>
    </div>

    <!-- 메인 컨텐츠 -->
    <div class="login-container">
      <VCard class="login-card" elevation="0">
        <VCardText class="card-content">
          <div class="form-header">
            <h1 class="form-title">로그인</h1>
            <p class="form-subtitle">계정에 로그인하여 시작하세요</p>
          </div>

          <VForm
            ref="refVForm"
            @submit.prevent="onSubmit"
            class="login-form"
          >
            <AppTextField
              v-model="form.email"
              :rules="[rules.required, rules.email]"
              label="이메일"
              type="email"
              placeholder="이메일을 입력하세요"
              autocomplete="username"
              prepend-inner-icon="bx-envelope"
              variant="outlined"
              density="comfortable"
              class="form-field"
            />

            <AppTextField
              v-model="form.password"
              :rules="[rules.required]"
              label="비밀번호"
              placeholder="비밀번호를 입력하세요"
              :type="isPasswordVisible ? 'text' : 'password'"
              autocomplete="current-password"
              :append-inner-icon="isPasswordVisible ? 'bx-hide' : 'bx-show'"
              prepend-inner-icon="bx-lock-alt"
              variant="outlined"
              density="comfortable"
              class="form-field"
              @click:append-inner="isPasswordVisible = !isPasswordVisible"
            />

            <Transition name="fade">
              <VAlert
                v-if="serverError"
                type="error"
                variant="tonal"
                density="compact"
                class="error-alert"
              >
                {{ serverError }}
              </VAlert>
            </Transition>

            <VBtn
              block
              type="submit"
              :loading="loading"
              :disabled="loading"
              size="large"
              color="primary"
              class="login-button"
            >
              로그인
            </VBtn>
          </VForm>
        </VCardText>
      </VCard>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
}

.login-header {
  padding: 1.5rem 2rem;
  
  @media (max-width: 599px) {
    padding: 1rem 1.5rem;
  }
}

.logo-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  color: inherit;
}

.login-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  
  @media (max-width: 599px) {
    padding: 1rem;
  }
}

.login-card {
  width: 100%;
  max-width: 420px;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card-content {
  padding: 3rem !important;
  
  @media (max-width: 599px) {
    padding: 2rem !important;
  }
}

.form-header {
  text-align: center;
  margin-bottom: 2rem;
}

.form-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.02em;
}

.form-subtitle {
  font-size: 0.9375rem;
  color: #64748b;
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-field {
  :deep(.v-field) {
    border-radius: 8px;
  }
}

.error-alert {
  margin-top: 0.5rem;
}

.login-button {
  margin-top: 0.5rem;
  text-transform: none;
  font-weight: 600;
  letter-spacing: 0.5px;
}

// 전환 효과
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
