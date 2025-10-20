<script setup>
import { ref } from 'vue'

const props = defineProps({
  userData: {
    type: Object,
    required: true,
  },
})

/* ==========================
   헬퍼 & 매핑
========================== */
const USER_ROLE_LABEL = {
  USER: '일반',
  ADMIN: '관리자',
  SUPER_ADMIN: '최고관리자',
}

const USER_STATUS_LABEL = {
  ACTIVE: '활성',
  PENDING: '대기',
  DISABLED: '비활성',
}

const resolveUserRoleVariant = role => {
  const r = String(role || '').toUpperCase()
  if (r === 'SUPER_ADMIN') return { color: 'error',   icon: 'bx-crown',        text: USER_ROLE_LABEL[r] }
  if (r === 'ADMIN')       return { color: 'warning', icon: 'bx-badge-check',  text: USER_ROLE_LABEL[r] }
  return { color: 'primary', icon: 'bx-user', text: USER_ROLE_LABEL[r] || '일반' }
}

const resolveUserStatusVariant = stat => {
  const s = String(stat || '').toUpperCase()
  if (s === 'ACTIVE')   return { color: 'success',   text: USER_STATUS_LABEL[s] }
  if (s === 'PENDING')  return { color: 'warning',   text: USER_STATUS_LABEL[s] }
  if (s === 'DISABLED') return { color: 'secondary', text: USER_STATUS_LABEL[s] }
  return { color: 'default', text: s || '-' }
}

const avatarText = name => (name || '').trim().slice(0, 2).toUpperCase()
const formatDate = s => (s ? new Date(s).toLocaleString() : '-')

/* ==========================
   데모용 플랜(텍스트만 한글화)
========================== */
const standardPlan = {
  plan: 'Standard',
  price: 99,
  benefits: ['10명 사용자', '최대 10GB 저장공간', '기본 지원'],
}

const isUserInfoEditDialogVisible = ref(false)
const isUpgradePlanDialogVisible = ref(false)
</script>

<template>
  <VRow>
    <!-- SECTION 사용자 상세 -->
    <VCol cols="12">
      <VCard v-if="props.userData">
        <VCardText class="text-center pt-12">
          <!-- 아바타 -->
          <VAvatar
            rounded
            :size="120"
            :color="!props.userData.avatar ? 'primary' : undefined"
            :variant="!props.userData.avatar ? 'tonal' : undefined"
          >
            <VImg
              v-if="props.userData.avatar"
              :src="props.userData.avatar"
            />
            <span v-else class="text-5xl font-weight-medium">
              {{ avatarText(props.userData.owner) }}
            </span>
          </VAvatar>

          <!-- 이름 -->
          <h5 class="text-h5 mt-4">
            {{ props.userData.owner }}
          </h5>

          <!-- 역할 칩 -->
          <div class="d-flex justify-center gap-2 mt-4">
            <VChip
              label
              size="small"
              class="text-capitalize"
              :color="resolveUserRoleVariant(props.userData.role).color"
            >
              <VIcon
                :icon="resolveUserRoleVariant(props.userData.role).icon"
                size="18"
                class="me-1"
              />
              {{ resolveUserRoleVariant(props.userData.role).text }}
            </VChip>

            <!-- 상태 칩 -->
            <VChip
              label
              size="small"
              :color="resolveUserStatusVariant(props.userData.verified).color"
            >
              {{ resolveUserStatusVariant(props.userData.verified).text }}
            </VChip>
          </div>
        </VCardText>

        <VCardText>
          <!-- 세부 정보 -->
          <h5 class="text-h5">기본 정보</h5>
          <VDivider class="my-4" />

          <VList class="card-list mt-2">
            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  사용자명:
                  <span class="text-body-1 d-inline-block">{{ props.userData.owner }}</span>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  이메일:
                  <span class="text-body-1 d-inline-block">{{ props.userData.email }}</span>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  지점:
                  <span class="text-body-1 d-inline-block">{{ props.userData.storeName || '-' }}</span>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  사업자번호:
                  <span class="text-body-1 d-inline-block">{{ props.userData.businessNumber || '-' }}</span>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  주소:
                  <span class="text-body-1 d-inline-block">{{ props.userData.address || '-' }}</span>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  역할:
                  <span class="text-body-1 d-inline-block">
                    {{ resolveUserRoleVariant(props.userData.role).text }}
                  </span>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  상태:
                  <span class="text-body-1 d-inline-block">
                    {{ resolveUserStatusVariant(props.userData.verified).text }}
                  </span>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  회원번호:
                  <span class="text-body-1 d-inline-block">#{{ props.userData.memberId }}</span>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  생성일:
                  <span class="text-body-1 d-inline-block">{{ formatDate(props.userData.createdAt) }}</span>
                </h6>
              </VListItemTitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>
                <h6 class="text-h6">
                  수정일:
                  <span class="text-body-1 d-inline-block">{{ formatDate(props.userData.updatedAt) }}</span>
                </h6>
              </VListItemTitle>
            </VListItem>
          </VList>
        </VCardText>

        <!-- 버튼 -->
        <VCardText class="d-flex justify-center gap-x-4">
          <VBtn variant="elevated" @click="isUserInfoEditDialogVisible = true">정보 수정</VBtn>
          <VBtn variant="tonal" color="error">계정 중지</VBtn>
        </VCardText>
      </VCard>
    </VCol>
    <!-- !SECTION -->

    <!-- SECTION 현재 플랜(데모) -->
    <VCol cols="12" hidden>
      <VCard class="current-plan">
        <VCardText class="d-flex">
          <VChip label color="primary" size="small" class="font-weight-medium">인기</VChip>
          <VSpacer />
          <div class="d-flex align-center">
            <sup class="text-h5 text-primary mt-1">₩</sup>
            <h1 class="text-h1 text-primary">{{ standardPlan.price }}</h1>
            <sub class="mt-3"><h6 class="text-h6 font-weight-regular mb-n1">/ 월</h6></sub>
          </div>
        </VCardText>

        <VCardText>
          <VList class="card-list">
            <VListItem v-for="benefit in standardPlan.benefits" :key="benefit">
              <div class="d-flex align-center gap-x-2">
                <VIcon size="6" color="secondary" icon="bx-bxs-circle" />
                <div class="text-medium-emphasis">{{ benefit }}</div>
              </div>
            </VListItem>
          </VList>

          <div class="my-6">
            <div class="d-flex justify-space-between mb-1">
              <h6 class="text-h6">이용 일수</h6>
              <h6 class="text-h6">30일 중 26일</h6>
            </div>
            <VProgressLinear rounded rounded-bar :model-value="65" color="primary" />
            <p class="mt-1 text-body-2 mb-0">4일 남음</p>
          </div>

          <div class="d-flex gap-4">
            <VBtn block @click="isUpgradePlanDialogVisible = true">플랜 업그레이드</VBtn>
          </div>
        </VCardText>
      </VCard>
    </VCol>
    <!-- !SECTION -->
  </VRow>

  <!-- 수정 다이얼로그 -->
  <UserInfoEditDialog
    v-model:is-dialog-visible="isUserInfoEditDialogVisible"
    :user-data="props.userData"
  />

  <!-- 업그레이드 다이얼로그 -->
  <UserUpgradePlanDialog v-model:is-dialog-visible="isUpgradePlanDialogVisible" />
</template>

<style lang="scss" scoped>
@use "@core/scss/template/mixins" as templateMixins;

.card-list { --v-card-list-gap: 0.5rem; }

.current-plan {
  border: 2px solid rgb(var(--v-theme-primary));
  @include templateMixins.custom-elevation(var(--v-theme-primary), "sm");
}

.text-capitalize { text-transform: capitalize !important; }
</style>
