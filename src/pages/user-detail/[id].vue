<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'

// 실제 API
import { getOrderListByMemberId } from '@/api/order'
import { apiGetUserByMemberIdPublic, normalizeUser } from '@/api/user'

// 제공해주신 컴포넌트
import UserTabAccount from '@/views/user/view/UserTabAccount.vue'

definePage({ meta: { public: true } })

// 네임드 라우트: apps-user-view-id
const route = useRoute('apps-user-view-id')
const userTab = ref(0)
const userData = ref(null)
const loading = ref(true)
const errorMsg = ref('')

const orderStats = ref({
  totalOrders: 0,
  totalAmount: 0,
  lastOrderDate: null,
})

const tabs = [
  { icon: 'bx-user',     title: '주문내역' },

  // { icon: 'bx-lock-alt', title: 'Security' },
  // { icon: 'bx-detail',   title: 'Billing & Plan' },
  // { icon: 'bx-bell',     title: 'Notifications' },
  // { icon: 'bx-link',     title: 'Connections' },
]

// 주문 통계 계산 함수
async function fetchOrderStats(memberId) {
  try {
    const dto = await getOrderListByMemberId({ 
      memberId: memberId, 
      page: 0, 
      size: 1000, // 모든 주문을 가져와서 통계 계산
    })
    
    const orders = Array.isArray(dto?.content) ? dto.content : []
    
    // 통계 계산
    const totalOrders = orders.length

    const totalAmount = orders.reduce((sum, order) => {
      return sum + (Number(order.totalPrice) || 0)
    }, 0)
    
    // 마지막 주문일 계산
    const lastOrderDate = orders.length > 0 
      ? orders.reduce((latest, order) => {
        const orderDate = new Date(order.createdAt)
        const latestDate = new Date(latest)
        
        return orderDate > latestDate ? order.createdAt : latest
      }, orders[0].createdAt)
      : null
    
    orderStats.value = {
      totalOrders,
      totalAmount,
      lastOrderDate,
    }
  } catch (error) {
    console.error('[fetchOrderStats] error:', error)
    orderStats.value = {
      totalOrders: 0,
      totalAmount: 0,
      lastOrderDate: null,
    }
  }
}

// 포맷팅 함수들
function formatCurrency(amount) {
  if (!amount || amount === 0) return '0'
  
  return `${Number(amount).toLocaleString()}`
}

function formatDate(dateString) {
  if (!dateString) return '-'
  
  return new Date(dateString).toLocaleDateString()
}

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

    // 주문 통계 가져오기
    await fetchOrderStats(userData.value.memberId)
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
  <div class="page-container user-detail-page">
    <!-- 로딩 상태 -->
    <div v-if="loading">
      <VCard class="pa-6">
        <VSkeletonLoader type="article, list-item, list-item" />
      </VCard>
    </div>

    <!-- 에러 상태 -->
    <div v-else-if="!userData">
      <VAlert
        type="error"
        variant="tonal"
      >
        User with ID {{ route.params.id }} not found!<br>
        <span class="text-disabled">{{ errorMsg }}</span>
      </VAlert>
    </div>

    <!-- 메인 콘텐츠 -->
    <div v-else>
      <!-- 메인 그리드 -->
      <div class="user-grid">
        <!-- 사용자 정보 카드 -->
        <VCard class="erp-info-card">
          <VCardTitle class="erp-card-title">
            <VIcon
              icon="bx-user"
              size="18"
              class="me-2"
            />
            기본 정보
          </VCardTitle>
          <VDivider />
          <VCardText class="erp-card-content">
            <!-- 사용자 프로필 섹션 -->
            <div class="erp-profile-section">
              <div class="erp-profile-avatar">
                <VAvatar
                  size="60"
                  :color="!userData.avatar ? 'primary' : undefined"
                  :variant="!userData.avatar ? 'tonal' : undefined"
                >
                  <VImg
                    v-if="userData.avatar"
                    :src="userData.avatar"
                  />
                  <span
                    v-else
                    class="text-h4 font-weight-medium"
                  >
                    {{ (userData.owner || '').trim().slice(0, 2).toUpperCase() }}
                  </span>
                </VAvatar>
              </div>
              <div class="erp-profile-info">
                <h3 class="erp-profile-name">
                  {{ userData.owner }}
                </h3>
                <div class="erp-profile-role">
                  <VChip
                    :color="userData.role === 'ADMIN' ? 'warning' : userData.role === 'SUPER_ADMIN' ? 'error' : 'primary'"
                    size="small"
                    variant="tonal"
                    class="me-2"
                  >
                    {{ userData.role === 'ADMIN' ? '관리자' : userData.role === 'SUPER_ADMIN' ? '최고관리자' : '일반사용자' }}
                  </VChip>
                  <VChip
                    :color="userData.verified === 'ACTIVE' ? 'success' : userData.verified === 'PENDING' ? 'warning' : 'secondary'"
                    size="small"
                    variant="tonal"
                  >
                    {{ userData.verified === 'ACTIVE' ? '활성' : userData.verified === 'PENDING' ? '대기' : '비활성' }}
                  </VChip>
                </div>
                <div class="erp-profile-id">
                  회원번호: #{{ userData.memberId }}
                </div>
              </div>
            </div>

            <!-- 정보 그리드 -->
            <div class="erp-info-grid">
              <div class="erp-info-section">
                <h4 class="erp-section-title">
                  연락처 정보
                </h4>
                <div class="erp-info-item">
                  <div class="erp-info-label">
                    <VIcon
                      icon="bx-envelope"
                      size="16"
                      class="me-2"
                    />
                    이메일
                  </div>
                  <div class="erp-info-value">
                    {{ userData.email || '-' }}
                  </div>
                </div>
                <div class="erp-info-item">
                  <div class="erp-info-label">
                    <VIcon
                      icon="bx-phone"
                      size="16"
                      class="me-2"
                    />
                    전화번호
                  </div>
                  <div class="erp-info-value">
                    {{ userData.phone || '-' }}
                  </div>
                </div>
              </div>

              <div class="erp-info-section">
                <h4 class="erp-section-title">
                  사업자 정보
                </h4>
                <div class="erp-info-item">
                  <div class="erp-info-label">
                    <VIcon
                      icon="bx-store"
                      size="16"
                      class="me-2"
                    />
                    지점명
                  </div>
                  <div class="erp-info-value">
                    {{ userData.storeName || '-' }}
                  </div>
                </div>
                <div class="erp-info-item">
                  <div class="erp-info-label">
                    <VIcon
                      icon="bx-id-card"
                      size="16"
                      class="me-2"
                    />
                    사업자번호
                  </div>
                  <div class="erp-info-value">
                    {{ userData.businessNumber || '-' }}
                  </div>
                </div>
                <div class="erp-info-item">
                  <div class="erp-info-label">
                    <VIcon
                      icon="bx-map"
                      size="16"
                      class="me-2"
                    />
                    주소
                  </div>
                  <div class="erp-info-value">
                    {{ userData.address || '-' }}
                  </div>
                </div>
              </div>

              <div class="erp-info-section">
                <h4 class="erp-section-title">
                  계정 정보
                </h4>
                <div class="erp-info-item">
                  <div class="erp-info-label">
                    <VIcon
                      icon="bx-calendar-plus"
                      size="16"
                      class="me-2"
                    />
                    가입일
                  </div>
                  <div class="erp-info-value">
                    {{ userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : '-' }}
                  </div>
                </div>
                <div class="erp-info-item">
                  <div class="erp-info-label">
                    <VIcon
                      icon="bx-edit"
                      size="16"
                      class="me-2"
                    />
                    수정일
                  </div>
                  <div class="erp-info-value">
                    {{ userData.updatedAt ? new Date(userData.updatedAt).toLocaleDateString() : '-' }}
                  </div>
                </div>
              </div>

              <div class="erp-info-section">
                <h4 class="erp-section-title">
                  통계 정보
                </h4>
                <div class="erp-stats-grid">
                  <div class="erp-stat-item">
                    <div class="erp-stat-value">
                      {{ orderStats.totalOrders }}
                    </div>
                    <div class="erp-stat-label">
                      총 주문수
                    </div>
                  </div>
                  <div class="erp-stat-item">
                    <div class="erp-stat-value">
                      {{ formatCurrency(orderStats.totalAmount) }}
                    </div>
                    <div class="erp-stat-label">
                      총 주문금액
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </VCardText>
        </VCard>

        <!-- 데이터 탭 카드 -->
        <VCard class="erp-tabs-card">
          <VCardTitle class="erp-card-title">
            <VIcon
              icon="bx-receipt"
              size="18"
              class="me-2"
            />
            주문 내역
          </VCardTitle>
          <VDivider />
          <VCardText class="erp-tabs-content">
            <!--
              <VTabs
              v-model="userTab"
              class="erp-tabs"
              >
              <VTab
              v-for="tab in tabs"
              :key="tab.icon"
              class="erp-tab"
              >
              <VIcon
              :size="16"
              :icon="tab.icon"
              class="me-2"
              />
              {{ tab.title }}
              </VTab>
              </VTabs> 
            -->

            <VWindow
              v-model="userTab"
              class="erp-tab-content pa-3"
              :touch="false"
            >
              <VWindowItem>
                <UserTabAccount :user-data="userData" />
              </VWindowItem>
              
              <!-- 나중에 다른 탭들 추가 가능 -->
              <!--
                <VWindowItem>
                <UserTabSecurity :user-data="userData" />
                </VWindowItem> 
              -->
            </VWindow>
          </VCardText>
        </VCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== ERP 페이지 레벨 ===== */
.page-container.user-detail-page {
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
  min-height: 100vh;
}

/* ERP 페이지 헤더 */
.erp-page-header {
  background: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  padding: 20px 24px;
  margin-bottom: 20px;
  
  .erp-page-title {
    font-size: 18px;
    font-weight: 600;
    color: #2c3e50;
    display: flex;
    align-items: center;
  }
  
  .erp-page-subtitle {
    font-size: 13px;
    color: #6c757d;
    margin-top: 8px;
  }
}

/* ERP 상태 칩 */
.erp-status-chip {
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ===== 메인 그리드 ===== */
.user-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 0.8fr 1.6fr;
  grid-template-rows: 1fr;
  grid-template-areas: "info order";
  gap: 20px;
  min-height: 0;
  max-height: 85vh;
  height: 85vh;
}

/* ERP 정보 카드 */
.erp-info-card {
  grid-area: info;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
}

.erp-card-title {
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  padding: 16px 20px;
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
  display: flex;
  align-items: center;
}

.erp-card-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

/* ERP 프로필 섹션 */
.erp-profile-section {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 24px;
  border: 1px solid #e9ecef;
}

.erp-profile-avatar {
  flex-shrink: 0;
}

.erp-profile-info {
  flex: 1;
}

.erp-profile-name {
  font-size: 20px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 8px 0;
}

.erp-profile-role {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.erp-profile-id {
  font-size: 13px;
  color: #6c757d;
  font-weight: 500;
}

/* ERP 정보 그리드 */
.erp-info-grid {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.erp-info-section {
  background: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 16px;
}

.erp-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #495057;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #e9ecef;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.erp-info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.erp-info-item:last-child {
  margin-bottom: 0;
}

.erp-info-label {
  font-size: 12px;
  font-weight: 600;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
}

.erp-info-value {
  font-size: 14px;
  color: #2c3e50;
  font-weight: 500;
  word-break: break-word;
  padding-left: 20px;
}

/* ERP 통계 그리드 */
.erp-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.erp-stat-item {
  text-align: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.erp-stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #007bff;
  margin-bottom: 4px;
}

.erp-stat-label {
  font-size: 12px;
  color: #6c757d;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ERP 탭 카드 */
.erp-tabs-card {
  grid-area: order;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
}

.erp-tabs-content {
  flex: 1;
  padding: 0;
  overflow: hidden;
}

.erp-tabs {
  border-bottom: 1px solid #e0e0e0;
}

.erp-tab {
  font-size: 13px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.erp-tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* 반응형 */
@media (max-width: 1200px) {
  .user-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    grid-template-areas: "info" "order";
    gap: 16px;
    padding: 0 16px 20px 16px;
  }
  
  .erp-page-header {
    padding: 16px 20px;
  }
  
  .erp-info-card,
  .erp-tabs-card {
    max-height: none;
    min-height: 50vh;
  }
}

@media (max-width: 768px) {
  .user-grid {
    gap: 12px;
    padding: 0 12px 16px 12px;
  }
  
  .erp-page-header {
    padding: 12px 16px;
  }
  
  .erp-page-title {
    font-size: 16px;
  }
  
  .erp-info-card,
  .erp-tabs-card {
    min-height: 40vh;
  }
}
</style>
