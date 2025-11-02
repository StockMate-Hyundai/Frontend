<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { clearSession } from '@/api/http'
import { useNotificationsStore } from '@/@core/stores/notifications'
import { useRouter } from 'vue-router'

const LS = { role: 'sm_role', email: 'sm_email', isLogin: 'isLogin', avatar: 'sm_avatar' }
const raw = ref(null)
const notificationsStore = useNotificationsStore()
const router = useRouter()

function readUser () {
  if (typeof window === 'undefined') return
  const role = localStorage.getItem(LS.role) || null
  const email = localStorage.getItem(LS.email) || null
  const isLoginStr = localStorage.getItem(LS.isLogin)
  const isLogin = isLoginStr === true || isLoginStr === 'true'
  const avatarUrl = localStorage.getItem(LS.avatar) || null

  raw.value = { role, email, isLogin, avatarUrl }
}

const onStorage = e => {
  if (!e || e.storageArea !== localStorage) return
  if ([LS.role, LS.email, LS.isLogin, LS.avatar].includes(e.key)) readUser()
}

onMounted(() => { readUser(); window.addEventListener('storage', onStorage) })
onBeforeUnmount(() => window.removeEventListener('storage', onStorage))

const displayRole  = computed(() => (raw.value?.role || 'USER').toUpperCase())
const displayEmail = computed(() => raw.value?.email || '')
const avatarSrc    = computed(() => raw.value?.avatarUrl || '')   // URL 있으면 이미지 사용
const badgeColor   = computed(() => (raw.value?.isLogin ? 'success' : 'grey'))

/** 앞 두 글자(한글 포함) 안전 추출 */
function toInitials(source, email) {
  // 1) 기준 문자열: 닉네임/이름 → 이메일 로컬파트 → GUEST
  const base = (source || (email ? email.split('@')[0] : '') || 'GUEST')
    .replace(/\s+/g, '')                       // 공백 제거
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '') // 이모지 제거

  const chars = Array.from(base)               // 그래핀 기준 분리(한글/이모지 안전)
  const firstTwo = chars.slice(0, 2).join('')
  
  return firstTwo.toUpperCase()
}
const initials = computed(() => toInitials(displayEmail.value, displayEmail.value))

/** 역할별 아바타 칼라 그대로 사용하고 싶으면 여기 매핑 */
function roleColor(role) {
  const r = String(role || '').toLowerCase()
  if (r === 'super_admin') return 'error'
  if (r === 'admin')       return 'warning'
  
  return 'primary'
}

/** 로그아웃 처리 */
function handleLogout() {
  // 웹소켓 연결 해제
  notificationsStore.disconnectWebSocket()
  
  // 세션 클리어
  clearSession()
  
  // 로그인 페이지로 이동
  router.push('/login')
}
</script>

<template>
  <VBadge
    dot
    bordered
    location="bottom right"
    offset-x="3"
    offset-y="3"
    :color="badgeColor"
  >
    <VAvatar
      class="cursor-pointer"
      :color="roleColor(displayRole)"
      variant="tonal"
      size="small"
    >
      <!-- 이미지가 있으면 이미지, 없으면 앞 두 글자 -->
      <VImg
        v-if="avatarSrc"
        :src="avatarSrc"
      />
      <span
        v-else
        class="text-subtitle-2 font-weight-medium"
      >{{ initials }}</span>

      <VMenu
        activator="parent"
        width="230"
        location="bottom end"
        offset="14px"
      >
        <VList>
          <VListItem>
            <template #prepend>
              <VListItemAction start>
                <VBadge
                  dot
                  location="bottom right"
                  offset-x="3"
                  offset-y="3"
                  :color="badgeColor"
                >
                  <VAvatar
                    :color="roleColor(displayRole)"
                    variant="tonal"
                    size="x-small"
                  >
                    <VImg
                      v-if="avatarSrc"
                      :src="avatarSrc"
                    />
                    <span
                      v-else
                      class="text-subtitle-2 font-weight-medium"
                    >{{ initials }}</span>
                  </VAvatar>
                </VBadge>
              </VListItemAction>
            </template>

            <VListItemTitle class="font-weight-semibold">
              {{ displayEmail }}
            </VListItemTitle>
            <VListItemSubtitle>
              {{ displayRole }}
            </VListItemSubtitle>
          </VListItem>

          <VDivider class="my-2" />

          <VListItem link>
            <template #prepend>
              <VIcon
                class="me-2"
                icon="bx-user"
                size="22"
              />
            </template>
            <VListItemTitle>Profile</VListItemTitle>
          </VListItem>

          <VListItem link>
            <template #prepend>
              <VIcon
                class="me-2"
                icon="bx-cog"
                size="22"
              />
            </template>
            <VListItemTitle>Settings</VListItemTitle>
          </VListItem>

          <VListItem link>
            <template #prepend>
              <VIcon
                class="me-2"
                icon="bx-dollar"
                size="22"
              />
            </template>
            <VListItemTitle>Pricing</VListItemTitle>
          </VListItem>

          <VListItem link>
            <template #prepend>
              <VIcon
                class="me-2"
                icon="bx-help-circle"
                size="22"
              />
            </template>
            <VListItemTitle>FAQ</VListItemTitle>
          </VListItem>

          <VDivider class="my-2" />

          <VListItem @click="handleLogout">
            <template #prepend>
              <VIcon
                class="me-2"
                icon="bx-log-out"
                size="22"
              />
            </template>
            <VListItemTitle>Logout</VListItemTitle>
          </VListItem>
        </VList>
      </VMenu>
    </VAvatar>
  </VBadge>
</template>
