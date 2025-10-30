<script setup>
import TablePagination from '@/@core/components/TablePagination.vue'
import { apiChangeUserRole, apiChangeUserStatus, apiGetUsersPublic } from '@/api/user'
import RoleStatusEditDialog from '@/components/dialogs/RoleStatusEditDialog.vue'
import AddNewUserDrawer from '@/views/user/list/AddNewUserDrawer.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

// 페이지 메타
definePage({
  meta: {
    title: '사용자 관리',
    icon: 'bx-group',
    requiresAuth: true,
  },
})

/* ==========================
   상태
========================== */
const searchQuery = ref('')
const selectedRole = ref()
const selectedPlan = ref()
const selectedStatus = ref()
const isEditDialogVisible = ref(false)
const editingUser = ref(null)
const isFilterExpanded = ref(true) // 필터 토글 상태

// Data table options
const itemsPerPage = ref(10)   // 서버 size
const page = ref(1)            // UI 1-base → 서버 0-base
const sortBy = ref()
const orderBy = ref()
const selectedRows = ref([])

const tableLoading = ref(false)
const usersData = ref({ users: [], totalUsers: 0 })
const stats = ref({ total: 0, active: 0, inactive: 0, pending: 0 })

// 필터 토글 함수들
const toggleRole = role => {
  selectedRole.value = selectedRole.value === role ? null : role

  // 즉시 검색하지 않음 - 검색 버튼을 눌러야 검색됨
}

const toggleStatus = status => {
  selectedStatus.value = selectedStatus.value === status ? null : status

  // 즉시 검색하지 않음 - 검색 버튼을 눌러야 검색됨
}

const onSearch = () => {
  isFilterExpanded.value = false
  fetchUsers()
}

const onReset = () => {
  searchQuery.value = ''
  selectedRole.value = null
  selectedStatus.value = null
  isFilterExpanded.value = true // 초기화 시 필터 토글 열기
  fetchUsers()
}

const openEdit = user => {
  editingUser.value = user
  isEditDialogVisible.value = true
}

const router = useRouter()

// memberId 우선 → 없으면 id fallback
const getMemberId = u => u?.raw?.memberId ?? u?.memberId ?? u?.id

const goUserDetail = item => {
  const id = getMemberId(item)
  if (id == null) return
  router.push({ name: 'user-detail-id', params: { id: String(id) } })
}

/* ==========================
   테이블 헤더
========================== */
const headers = [
  { title: '유저',    key: 'user' },
  { title: '역할',    key: 'role' },
  { title: '지점', key: 'storeName' },
  { title: '사업자번호', key: 'businessNumber' },
  { title: '상태',  key: 'status' },
  { title: '관리', key: 'actions', sortable: false },
]

// 엑셀 컬럼 매핑 (원하는 순서/이름으로 바꿔도 됨)
const excelFields = [
  { key: 'fullName',       label: '이름' },
  { key: 'email',          label: '이메일' },
  { key: 'storeName',      label: '지점' },
  { key: 'businessNumber', label: '사업자번호' },
  { key: 'role',           label: '역할' },
  { key: 'status',         label: '상태' },
]


/* ==========================
   서버 정렬 미지원 → 클라에서만 기억
========================== */
const updateOptions = options => {
  sortBy.value  = options.sortBy[0]?.key
  orderBy.value = options.sortBy[0]?.order
  fetchUsers()
}

/* ==========================
   서버 호출 + 클라 필터/정렬
========================== */
const submitEdit = async ({ role, status }) => {
  if (!editingUser.value) return
  try {
    const prevRole = editingUser.value.role
    const prevStatus = editingUser.value.status

    const memberId =
      editingUser.value?.raw?.memberId ??
      editingUser.value?.memberId ??
      editingUser.value?.id

    // 변경된 값만 호출
    if (role && role !== prevRole)
      await apiChangeUserRole({ memberId, role })

    if (status && status !== prevStatus)
      await apiChangeUserStatus({ memberId, status })

    isEditDialogVisible.value = false
    await fetchUsers()
  } catch (err) {
    console.error('[submitEdit] 실패:', err)
  }
}

const fetchUsers = async () => {
  tableLoading.value = true
  try {
    const serverPage = Math.max(0, Number(page.value) - 1)
    const serverSize = itemsPerPage.value === -1 ? 1000 : (Number(itemsPerPage.value) || 20)

    // 🔸 퍼블릭 API (헤더 없이)
    const dto = await apiGetUsersPublic({ page: serverPage, size: serverSize })
    const content = Array.isArray(dto?.content) ? dto.content : []


    // 표시용 매핑 (서버에 role/plan/status/billing 없음 → 기본값)
    let list = content.map(u => ({
      id: u.id,
      fullName: u.owner || '(무명)',
      email: u.email,
      avatar: null,
      businessNumber: u.businessNumber,
      storeName: u.storeName,
      role: u.role,
      status: u.verified,
      raw: u,
    }))

    // 클라이언트 필터/검색
    const q    = (searchQuery.value || '').toLowerCase().trim()
    const role = selectedRole.value?.value  || selectedRole.value  || ''
    const plan = selectedPlan.value?.value  || selectedPlan.value  || ''
    const stat = selectedStatus.value?.value|| selectedStatus.value|| ''

    if (q) {
      list = list.filter(it =>
        it.fullName.toLowerCase().includes(q) ||
        it.email.toLowerCase().includes(q) ||
        (it.raw?.storeName || '').toLowerCase().includes(q),
      )
    }
    if (role) list = list.filter(it => it.role === role)
    if (plan) list = list.filter(it => it.currentPlan === plan)
    if (stat) list = list.filter(it => it.status === stat)

    // 클라이언트 정렬
    if (sortBy.value) {
      const key = sortBy.value
      const dir = orderBy.value === 'desc' ? -1 : 1

      list = list.slice().sort((a, b) => {
        const av = (a[key] ?? '').toString().toLowerCase()
        const bv = (b[key] ?? '').toString().toLowerCase()
        if (av < bv) return -1 * dir
        if (av > bv) return  1 * dir
        
        return 0
      })
    }

    // 총 개수
    // const totalFromServer  = Number(dto?.totalElements ?? 0)
    const totalFromServer = Number(dto?.totalElements ?? content.length)
    const active = Number(dto?.active)
    const inactive = Number(dto?.disabled)
    const pending = Number(dto?.pending)
    const totalAfterFilter = list.length
    const totalUsersCalc = (q || role || plan || stat) ? totalAfterFilter : totalFromServer


    stats.value = { total: totalFromServer, active, inactive, pending }
    
    usersData.value = { users: list, totalUsers: totalUsersCalc }
  } catch (e) {
    console.error('[fetchUsers] error', e)
    usersData.value = { users: [], totalUsers: 0 }
  } finally {
    tableLoading.value = false
  }
}

/* ==========================
   computed / watch / lifecycle
========================== */
const users = computed(() => usersData.value.users)
const totalUsers = computed(() => usersData.value.totalUsers)

watch(
  [itemsPerPage, page, sortBy, orderBy],
  fetchUsers,
  { deep: true },
)

onMounted(fetchUsers)

/* ==========================
   필터 옵션 + 표시 유틸
========================== */
const roles = [
  { title: '슈퍼어드민',     value: 'SUPER_ADMIN' },
  { title: '창고관리자',     value: 'WAREHOUSE' },
  { title: '어드민', value: 'ADMIN' },
  { title: '유저',      value: 'USER' },

  // { title: '지점장', value: '지점장' },
  // { title: '매니저',     value: '매니저' },
]

const plans = [
  { title: 'Basic',      value: 'basic' },
  { title: 'Company',    value: 'company' },
  { title: 'Enterprise', value: 'enterprise' },
  { title: 'Team',       value: 'team' },
]

const status = [
  { title: '활성',   value: 'ACTIVE' },
  { title: '대기',  value: 'PENDING' },
  { title: '비활성', value: 'DISABLED' },
]

const STATUS_LABELS = {
  ACTIVE: '활성',
  DISABLED: '비활성',
  PENDING: '대기',
}

const ROLE_LABELS = {
  SUPER_ADMIN: '슈퍼어드민',
  ADMIN: '어드민',
  WAREHOUSE: '창고관리자',
  USER: '사용자',
}

const resolveUserRoleVariant = role => {
  const r = String(role || '').toLowerCase()
  if (r === 'user')        return { color: 'primary', icon: 'bx-user' }         // or 'bx-user-circle'
  if (r === 'admin')       return { color: 'warning', icon: 'bx-badge-check' }       // or 'bx-badge-check'
  if (r === 'super_admin') return { color: 'error',   icon: 'bx-crown' } 
  if (r === 'warehouse') return { color: 'info', icon: 'bx-home-alt' }

  // if (r === '지점장')     return { color: 'warning',  icon: 'bx-edit' }
  // if (r === '매니저')     return { color: 'error',    icon: 'bx-desktop' }
  
  return { color: 'primary', icon: 'bx-user' }
}

const resolveUserStatusVariant = stat => {
  const s = String(stat || '').toUpperCase()
  if (s === 'PENDING')  return 'warning'
  if (s === 'ACTIVE')   return 'success'
  if (s === 'DISABLED') return 'secondary'
  
  return 'primary'
}

const prefixWithPlus = n => (Number(n) > 0 ? `+${n}` : String(n))
const avatarText = name => (name || '').trim().slice(0, 2).toUpperCase()

/* ==========================
   드로어/추가/삭제 (API 미제공이므로 UX 유지용)
========================== */
const isAddNewUserDrawerVisible = ref(false)

const addNewUser = async userData => {
  // TODO: 백엔드 생성 API 나오면 연결
  await fetchUsers()
}

const deleteUser = async id => {
  console.warn('삭제 API 미제공')

  const idx = selectedRows.value.findIndex(row => row === id)
  if (idx !== -1) selectedRows.value.splice(idx, 1)
  await fetchUsers()
}

/* ==========================
   위젯 (데모)
========================== */
function isNum(n) { return typeof n === 'number' && Number.isFinite(n) }
function classifyStatus(u) {
  if (!u?.storeName || !u?.businessNumber) return 'pending'
  if (!isNum(u?.latitude) || !isNum(u?.longitude)) return 'inactive'
  
  return 'active'
}

const widgetData = computed(() => [
  { title: '전체',        value: stats.value.total.toLocaleString(),     change: 0,  desc: '모든 상태의 유저',         icon: 'bx-group',      iconColor: 'primary' },
  { title: '활성화 유저', value: stats.value.active.toLocaleString(),    change: 0,  desc: '활성화 된 유저',     icon: 'bx-user-check', iconColor: 'success' },
  { title: '비활성화 유저', value: stats.value.inactive.toLocaleString(), change: 0,  desc: '비활성화 된 유저',      icon: 'bx-user-x',     iconColor: 'error' },
  { title: '대기중인 유저', value: stats.value.pending.toLocaleString(),  change: 0,  desc: '권한 요청 대기 중인 유저', icon: 'bx-time',       iconColor: 'warning' },
])
</script>

<template>
  <div class="page-container table-page">
    <!-- 헤더 섹션 -->
    <div class="filter-section">
      <div class="d-flex align-center justify-space-between mb-0">
        <div class="d-flex align-center gap-3">
          <h6 class="text-h6 text-high-emphasis mb-0">
            사용자 관리
          </h6>
          <VBtn
            size="small"
            variant="text"
            :icon="isFilterExpanded ? 'bx-chevron-up' : 'bx-chevron-down'"
            @click="isFilterExpanded = !isFilterExpanded"
          />
        </div>
        <div class="d-flex align-center gap-3">
          <!-- 내보내기 버튼은 테이블 헤더로 이동 -->
        </div>
      </div>
      
      <!-- 필터 내용 (토글 가능) -->
      <VExpandTransition>
        <div
          v-show="isFilterExpanded"
          class="filter-content"
        >
          <div class="d-flex align-center gap-4 flex-wrap mb-3">
            <!-- 역할 필터 -->
            <div class="d-flex align-center gap-2">
              <span class="text-body-2 text-medium-emphasis filter-label">역할:</span>
              <div class="d-flex gap-1">
                <VChip
                  v-for="role in roles"
                  :key="role.value"
                  size="small"
                  variant="tonal"
                  :color="selectedRole === role.value ? 'primary' : undefined"
                  @click="toggleRole(role.value)"
                >
                  {{ role.title }}
                </VChip>
              </div>
            </div>
            
            <!-- 상태 필터 -->
            <div class="d-flex align-center gap-2">
              <span class="text-body-2 text-medium-emphasis filter-label">상태:</span>
              <div class="d-flex gap-1 flex-wrap">
                <VChip
                  v-for="stat in status"
                  :key="stat.value"
                  size="small"
                  variant="tonal"
                  :color="selectedStatus === stat.value ? 'primary' : undefined"
                  @click="toggleStatus(stat.value)"
                >
                  {{ stat.title }}
                </VChip>
              </div>
            </div>
          </div>
          
          <!-- 검색 필터 -->
          <div class="d-flex align-center gap-4 flex-wrap mb-3">
            <div class="d-flex align-center gap-2">
              <span class="text-body-2 text-medium-emphasis filter-label">검색:</span>
              <VTextField
                v-model="searchQuery"
                placeholder="사용자 검색..."
                density="compact"
                variant="outlined"
                prepend-inner-icon="bx-search"
                style="width: 300px;"
              />
            </div>
          </div>
        </div>
      </VExpandTransition>
      
      <!-- 고정 버튼 영역 -->
      <div class="filter-actions">
        <VBtn
          color="primary"
          variant="flat"
          size="small"
          :loading="tableLoading"
          @click="onSearch"
        >
          검색
        </VBtn>
        
        <VBtn
          variant="tonal"
          size="small"
          @click="onReset"
        >
          초기화
        </VBtn>
      </div>
    </div>

    <!-- 테이블 컨테이너 -->
    <div class="table-container">
      <!-- 테이블 헤더 -->
      <div class="table-header">
        <div class="d-flex align-center justify-space-between">
          <span>전체 {{ totalUsers }}명</span>
          <div class="d-flex align-center gap-2">
            <ExportToExcel
              :items="users"
              :fields="excelFields"
              :transform="transformForExcel"
              filename="사용자목록.xlsx"
              sheet-name="Users"
              size="small"
              variant="flat"
            />
            <VIcon
              icon="bx-refresh"
              size="16"
              class="cursor-pointer"
              @click="fetchUsers"
            />
          </div>
        </div>
      </div>
      
      <!-- 테이블 본체 -->
      <div class="table-body">
        <VDataTableServer
          v-model:items-per-page="itemsPerPage"
          v-model:model-value="selectedRows"
          v-model:page="page"
          :items="users"
          item-value="id"
          :items-length="totalUsers"
          :headers="headers"
          class="erp-table"
          show-select
          :loading="tableLoading"
          @update:options="updateOptions"
        >
          <!-- 열 폭 -->
          <template #colgroup>
            <col style="width: 5%">
            <col style="width: 20%">
            <col style="width: 15%">
            <col style="width: 15%">
            <col style="width: 10%">
            <col style="width: 10%">
            <col style="width: 15%">
          </template>
          <!-- User -->
          <template #item.user="{ item }">
            <div class="d-flex align-center gap-x-4">
              <VAvatar
                size="32"
                :variant="!item.avatar ? 'tonal' : undefined"
                :color="!item.avatar ? resolveUserRoleVariant(item.role).color : undefined"
                class="cursor-pointer"
                @click="goUserDetail(item)"
              >
                <VImg
                  v-if="item.avatar"
                  :src="item.avatar"
                />
                <span v-else>{{ avatarText(item.fullName) }}</span>
              </VAvatar>
              <div class="d-flex flex-column">
                <div class="text-body-2 font-weight-medium">
                  <RouterLink
                    :to="{ name: 'user-detail-id', params: { id: String(getMemberId(item)) } }"
                    class="text-link"
                    @click.stop
                  >
                    {{ item.fullName }}
                  </RouterLink>
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  {{ item.email }}
                </div>
              </div>
            </div>
          </template>

          <!-- 👉 Role -->
          <template #item.role="{ item }">
            <div class="d-flex align-center gap-x-2">
              <VIcon
                :size="18"
                :icon="resolveUserRoleVariant(item.role).icon"
                :color="resolveUserRoleVariant(item.role).color"
              />
              <div class="text-capitalize text-high-emphasis text-body-2">
                {{ ROLE_LABELS[item.role] || item.role }}
              </div>
            </div>
          </template>

          <!-- Plan -->
          <template #item.plan="{ item }">
            <div class="text-body-2 text-high-emphasis text-capitalize">
              {{ item.currentPlan }}
            </div>
          </template>

          <!-- Status -->
          <template #item.status="{ item }">
            <VChip
              :color="resolveUserStatusVariant(item.status)"
              size="small"
              variant="tonal"
              class="text-capitalize"
            >
              {{ STATUS_LABELS[item.status] }}
            </VChip>
          </template>

          <!-- Actions -->
          <template #item.actions="{ item }">
            <IconBtn @click="deleteUser(item.id)">
              <VIcon icon="bx-trash" />
            </IconBtn>

            <IconBtn
              title="상세 보기"
              @click="goUserDetail(item)"
            >
              <VIcon icon="bx-show" />
            </IconBtn>

            <!-- 🔹 수정 아이콘: 모달 오픈 -->
            <IconBtn
              title="역할/상태 수정"
              @click="openEdit(item)"
            >
              <VIcon icon="bx-pencil" />
            </IconBtn>

            <VBtn
              icon
              variant="text"
              color="medium-emphasis"
              hidden
            >
              <VIcon icon="bx-dots-vertical-rounded" />
              <VMenu activator="parent">
                <VList>
                  <VListItem :to="{ name: 'second-page' }">
                    <template #prepend>
                      <VIcon icon="bx-show" />
                    </template>
                    <VListItemTitle>View</VListItemTitle>
                  </VListItem>

                  <!-- 메뉴에서도 수정 가능 -->
                  <VListItem
                    link
                    @click="openEdit(item)"
                  >
                    <template #prepend>
                      <VIcon icon="bx-pencil" />
                    </template>
                    <VListItemTitle>Edit</VListItemTitle>
                  </VListItem>
                </VList>
              </VMenu>
            </VBtn>
          </template>
        </VDataTableServer>
      </div>
      
      <!-- 페이지네이션 (하단 고정) -->
      <div class="table-footer">
        <div class="d-flex align-center justify-space-between">
          <div class="text-body-2 text-medium-emphasis">
            총 {{ totalUsers }}명 중 {{ (page - 1) * itemsPerPage + 1 }}-{{ Math.min(page * itemsPerPage, totalUsers) }}명 표시
          </div>
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalUsers"
          />
        </div>
      </div>
    </div>
    
    <!-- 페이지 하단 마진 -->
    <div class="page-bottom-margin" />
  </div>

  <!-- 👉 Add New User -->
  <AddNewUserDrawer
    v-model:is-drawer-open="isAddNewUserDrawerVisible"
    @user-data="addNewUser"
  />
  
  <RoleStatusEditDialog
    v-if="editingUser"
    v-model:is-dialog-visible="isEditDialogVisible"
    :user="editingUser"
    :roles="roles"
    :statuses="status"
    @submit="submitEdit"
  />
</template>

<style scoped>
.cursor-pointer { cursor: pointer; }

/* === 페이지 바깥 스크롤 차단 + 화면 기준 레이아웃 === */
.page-container.table-page {
  display: flex;
  flex-direction: column;
  height: 100vh;        /* 뷰포트 기준 */
  overflow: hidden;     /* 바깥 스크롤 차단 */
}

/* === 테이블 컨테이너: 헤더(고정) + 본문(스크롤) + 푸터(고정) === */
.table-container {
  flex: 1 1 auto;
  min-height: 0;               /* 자식 스크롤 허용 핵심 */
  display: flex;
  flex-direction: column;
}

/* 헤더 영역(고정) */
.table-header {
  flex: 0 0 auto;
}

/* 본문만 스크롤 */
.table-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;              /* ← 유일한 스크롤 영역 */
  scrollbar-width: thin;
  scrollbar-color: var(--erp-border-medium) var(--erp-bg-secondary);
}
.table-body::-webkit-scrollbar { width: 6px; }
.table-body::-webkit-scrollbar-track { background: var(--erp-bg-secondary); }
.table-body::-webkit-scrollbar-thumb { background: var(--erp-border-medium); border-radius: 3px; }
.table-body::-webkit-scrollbar-thumb:hover { background: var(--erp-secondary); }

/* 푸터(페이지네이션) 고정: 테이블 밖 하단 */
.table-footer {
  flex: 0 0 auto;
  background: var(--erp-bg-secondary);
  padding: 5px 24px;
  z-index: 2;
  position: relative;
  width: 100%;
}

/* === 컬럼 헤더 sticky (스크롤 시 상단 고정) === */
.erp-table :deep(thead th) {
  position: sticky;
  top: 0;
  z-index: 3;
  background: var(--erp-bg-primary);
}
.erp-table :deep(thead) {
  box-shadow: 0 1px 0 var(--erp-border-light) inset;
}

/* Vuetify 내부 래퍼의 overflow/강제 높이 제거 → sticky 정상화 */
.erp-table,
.erp-table :deep(.v-table__wrapper),
.erp-table :deep(.v-table),
.erp-table :deep(.v-table__body) {
  height: auto !important;
  min-height: unset !important;
  overflow: visible !important;
}

/* 행 호버 */
.erp-table :deep(.v-table__body tr:hover) {
  background: var(--erp-bg-secondary) !important;
  transform: none !important;
}

/* 필터 섹션 */
.filter-section {
  padding: 14px 24px !important;
}
.filter-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 2px;
}
.filter-content { margin-bottom: 4px !important; }

/* (옵션) 페이지 하단 마진 */
.page-bottom-margin {
  height: 24px;
  background: var(--erp-bg-primary);
}
</style>
