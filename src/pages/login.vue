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
  <div class="modern-login-page">
    <!-- 배경 -->
    <div class="animated-bg">
      <div class="gradient-shape shape-1" />
      <div class="gradient-shape shape-2" />
      <div class="gradient-shape shape-3" />
    </div>

    <!-- 로고 -->
    <div class="top-logo">
      <RouterLink to="/">
        <div class="logo-flex">
          <div class="logo-badge">
            <VNodeRenderer :nodes="themeConfig.app.logo" />
          </div>
          <VNodeRenderer :nodes="themeConfig.app.title" />
        </div>
      </RouterLink>
    </div>

    <!-- 메인 컨텐츠 -->
    <div class="login-main">
      <div class="login-grid">
        <!-- 왼쪽: 일러스트 (데스크톱만) -->
        <div class="illustration-side">
          <div class="illustration-content">
            <div class="img-container">
              <VImg
                :src="authV2LoginIllustration"
                class="hero-image"
                max-width="600"
              />
            </div>
            <div class="hero-text">
              <h1 class="hero-title">
                Stock Mate에<br>
                오신 것을 환영합니다
              </h1>
              <p class="hero-description">
                효율적인 창고 관리 시스템으로<br>
                비즈니스를 한 단계 업그레이드하세요
              </p>
            </div>
          </div>
        </div>

        <!-- 오른쪽: 로그인 폼 -->
        <div class="form-side">
          <VCard
            class="login-form-card"
            elevation="0"
          >
            <VCardText class="form-header">
              <h2 class="form-title">
                로그인
              </h2>
              <p class="form-description">
                계정에 로그인하여 시작하세요
              </p>
            </VCardText>

            <VCardText class="form-content">
              <VForm
                ref="refVForm"
                @submit.prevent="onSubmit"
              >
                <div class="form-inputs">
                  <AppTextField
                    v-model="form.email"
                    :rules="[rules.required, rules.email]"
                    label="이메일"
                    type="email"
                    placeholder="이메일을 입력하세요"
                    autocomplete="username"
                    prepend-inner-icon="bx-envelope"
                    class="modern-input"
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
                    class="modern-input"
                    @click:append-inner="isPasswordVisible = !isPasswordVisible"
                  />

                  <Transition name="fade-up">
                    <div
                      v-if="serverError"
                      class="error-wrapper"
                    >
                      <VIcon
                        icon="bx-error-circle"
                        size="18"
                        color="error"
                      />
                      <span>{{ serverError }}</span>
                    </div>
                  </Transition>

                  <VBtn
                    block
                    type="submit"
                    :loading="loading"
                    :disabled="loading"
                    size="large"
                    class="submit-btn-modern"
                  >
                    로그인
                  </VBtn>
                </div>
              </VForm>
            </VCardText>
          </VCard>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use "@core/scss/template/pages/page-auth";

.modern-login-page {
  min-height: 100vh;
  position: relative;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

// 애니메이션 배경
.animated-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
}

.gradient-shape {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.6;
  animation: morph-shape 20s infinite ease-in-out;
}

.shape-1 {
  width: 500px;
  height: 500px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  top: -150px;
  left: -150px;
  animation-delay: 0s;
}

.shape-2 {
  width: 600px;
  height: 600px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  bottom: -200px;
  right: -200px;
  animation-delay: -7s;
}

.shape-3 {
  width: 400px;
  height: 400px;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation-delay: -14s;
}

@keyframes morph-shape {
  0%, 100% {
    transform: translate(0, 0) scale(1) rotate(0deg);
  }
  33% {
    transform: translate(30px, -30px) scale(1.1) rotate(120deg);
  }
  66% {
    transform: translate(-30px, 30px) scale(0.9) rotate(240deg);
  }
}

// 로고
.top-logo {
  position: relative;
  z-index: 10;
  padding: 2rem;
  
  @media (max-width: 959px) {
    padding: 1.5rem;
  }
}

.logo-flex {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

// 메인 콘텐츠
.login-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  position: relative;
  z-index: 1;
  min-height: calc(100vh - 100px);
  
  @media (max-width: 959px) {
    padding: 1rem;
    min-height: calc(100vh - 80px);
  }
}

.login-grid {
  display: flex;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
  
  @media (max-width: 959px) {
    flex-direction: column;
    border-radius: 20px;
    max-width: 500px;
  }
}

// 왼쪽: 일러스트
.illustration-side {
  flex: 0 0 60%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 4rem 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  
  @media (max-width: 959px) {
    display: none;
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      radial-gradient(circle at 30% 40%, rgba(255, 255, 255, 0.2) 0%, transparent 60%),
      radial-gradient(circle at 70% 70%, rgba(255, 255, 255, 0.15) 0%, transparent 60%);
    pointer-events: none;
  }
}

.illustration-content {
  position: relative;
  z-index: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 3rem;
  align-items: center;
  text-align: center;
}

.img-container {
  width: 100%;
  display: flex;
  justify-content: center;
}

.hero-image {
  filter: drop-shadow(0 30px 70px rgba(0, 0, 0, 0.3));
}

.hero-text {
  color: white;
}

.hero-title {
  font-size: 2.75rem;
  font-weight: 800;
  line-height: 1.2;
  margin: 0 0 1rem 0;
  color: white;
  letter-spacing: -0.03em;
}

.hero-description {
  font-size: 1.125rem;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  font-weight: 400;
}

// 오른쪽: 폼
.form-side {
  flex: 0 0 40%;
  background: white;
  padding: 4rem 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 600px;
  
  @media (max-width: 959px) {
    flex: 1;
    min-height: auto;
    padding: 3rem 2rem;
  }
  
  @media (max-width: 599px) {
    padding: 2.5rem 1.5rem;
  }
}

.login-form-card {
  width: 100%;
  max-width: 100%;
  background: transparent;
  box-shadow: none;
}

.form-header {
  padding: 0 0 2rem 0 !important;
  text-align: center;
}

.form-content {
  padding: 0 !important;
}

.form-title {
  font-size: 2.25rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.02em;
}

.form-description {
  font-size: 1rem;
  color: #64748b;
  margin: 0;
}

.form-inputs {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

// 입력 필드
.modern-login-page :deep(.modern-input) {
  .v-field {
    background: #f8fafc;
    border-radius: 12px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: 2px solid transparent;

    &:hover {
      background: #f1f5f9;
      border-color: #e2e8f0;
    }

    &.v-field--focused {
      background: white;
      border-color: #667eea;
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
      transform: translateY(-1px);
    }
  }

  .v-field__outline {
    display: none;
  }

  .v-field__prepend-inner {
    color: #64748b;
    padding-inline-start: 16px;
    transition: color 0.3s ease;
  }

  .v-field--focused .v-field__prepend-inner {
    color: #667eea;
  }

  .v-label {
    color: #475569;
    font-weight: 600;
    font-size: 0.875rem;
    padding-left: 16px;
  }

  .v-field--focused .v-label {
    color: #667eea;
  }

  .v-field__input {
    padding: 0 16px;
    color: #0f172a;
    font-size: 0.9375rem;
  }

  input::placeholder {
    color: #94a3b8;
  }
}

// 에러
.error-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border: 1px solid #fca5a5;
  border-radius: 12px;
  color: #dc2626;
  font-size: 0.875rem;
  font-weight: 500;
}

// 버튼
.submit-btn-modern {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  color: white !important;
  font-weight: 600 !important;
  font-size: 1rem !important;
  height: 54px !important;
  border-radius: 12px !important;
  text-transform: none !important;
  letter-spacing: 0.5px !important;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  margin-top: 0.5rem;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    transition: left 0.5s ease;
  }

  &:hover:not(:disabled) {
    box-shadow: 0 8px 30px rgba(102, 126, 234, 0.5) !important;
    transform: translateY(-2px);

    &::before {
      left: 100%;
    }
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.7;
  }
}

// 전환 효과
.fade-up-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-up-leave-active {
  transition: all 0.2s ease;
}

.fade-up-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-up-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

// 반응형
@media (max-width: 959px) {
  .hero-title {
    font-size: 2rem;
  }

  .hero-description {
    font-size: 1rem;
  }

  .form-title {
    font-size: 1.875rem;
  }
}

@media (max-width: 599px) {
  .top-logo {
    padding: 1rem;
  }

  .form-title {
    font-size: 1.75rem;
  }

  .form-inputs {
    gap: 1.25rem;
  }
}
</style>
