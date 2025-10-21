<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'

// 실제 API
import { apiGetUserByMemberIdPublic, normalizeUser } from '@/api/user'

// 제공해주신 컴포넌트
import UserBioPanel from '@/views/user/view/UserBioPanel.vue'
import UserTabAccount from '@/views/user/view/UserTabAccount.vue'
import UserTabBillingsPlans from '@/views/user/view/UserTabBillingsPlans.vue'
import UserTabConnections from '@/views/user/view/UserTabConnections.vue'
import UserTabNotifications from '@/views/user/view/UserTabNotifications.vue'
import UserTabSecurity from '@/views/user/view/UserTabSecurity.vue'

definePage({ meta: { public: true } })

// 네임드 라우트: apps-user-view-id
const route = useRoute('apps-user-view-id')
const userTab = ref(0)
const userData = ref(null)
const loading = ref(true)
const errorMsg = ref('')

const tabs = [
  { icon: 'bx-user',     title: '주문내역' },
  // { icon: 'bx-lock-alt', title: 'Security' },
  // { icon: 'bx-detail',   title: 'Billing & Plan' },
  // { icon: 'bx-bell',     title: 'Notifications' },
  // { icon: 'bx-link',     title: 'Connections' },
]

async function fetchUser() {
  try {
    loading.value = true
    errorMsg.value = ''

    const id = Number(route.params.id)
    if (!Number.isFinite(id)) throw new Error('잘못된 사용자 ID 입니다.')

    const raw = await apiGetUserByMemberIdPublic(id)
    if (!raw) throw new Error('해당 사용자를 찾을 수 없습니다.')

    const u = normalizeUser(raw)

    // 컴포넌트에서 기대하는 최소 필드 셰이핑
    userData.value = {
      id: u.id ?? u.memberId ?? id,
      memberId: u.memberId ?? u.id ?? id,
      owner: u.owner || '(무명)',
      firstName: (u.owner || '').split(' ')[0] || u.owner || '',
      lastName: (u.owner || '').split(' ').slice(1).join(' ') || '',
      email: u.email || '',
      role: u.role || 'USER',
      verified: u.verified || 'PENDING',
      address: u.address || '',
      storeName: u.storeName || '',
      businessNumber: u.businessNumber || '',
      latitude: u.latitude ?? null,
      longitude: u.longitude ?? null,
      createdAt: u.createdAt || null,
      updatedAt: u.updatedAt || null,
      // 예: 결제/연결/알림 탭에서 사용할 수 있는 더미/확장 필드가 필요하면 여기에 추가
    }
  } catch (err) {
    console.error('[user view] fetch error:', err)
    errorMsg.value = err?.message || '사용자 정보를 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
}

await fetchUser()
</script>

<template>
  <div v-if="loading">
    <VCard class="pa-6">
      <VSkeletonLoader type="article, list-item, list-item" />
    </VCard>
  </div>

  <VRow v-else-if="userData">
    <VCol cols="12" md="5" lg="4">
      <UserBioPanel :user-data="userData" />
    </VCol>

    <VCol cols="12" md="7" lg="8">
      <VTabs v-model="userTab" class="v-tabs-pill">
        <VTab v-for="tab in tabs" :key="tab.icon">
          <VIcon :size="18" :icon="tab.icon" class="me-1" />
          <span>{{ tab.title }}</span>
        </VTab>
      </VTabs>

      <VWindow v-model="userTab" class="mt-6 disable-tab-transition" :touch="false">
        <VWindowItem>
          <UserTabAccount :user-data="userData" />
        </VWindowItem>

        <VWindowItem>
          <UserTabSecurity :user-data="userData" />
        </VWindowItem>

        <VWindowItem>
          <UserTabBillingsPlans :user-data="userData" />
        </VWindowItem>

        <VWindowItem>
          <UserTabNotifications :user-data="userData" />
        </VWindowItem>

        <VWindowItem>
          <UserTabConnections :user-data="userData" />
        </VWindowItem>
      </VWindow>
    </VCol>
  </VRow>

  <div v-else>
    <VAlert type="error" variant="tonal">
      User with ID {{ route.params.id }} not found!<br />
      <span class="text-disabled">{{ errorMsg }}</span>
    </VAlert>
  </div>
</template>
