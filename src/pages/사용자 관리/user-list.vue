<script setup>
import { apiGetUsersPublic } from '@/api/user'
import AddNewUserDrawer from '@/views/user/list/AddNewUserDrawer.vue'
import { computed, onMounted, ref, watch } from 'vue'

// 페이지 메타(비로그인 접근 허용)
definePage({ meta: { public: true } })

/* ==========================
   상태
========================== */
const searchQuery = ref('')
const selectedRole = ref()
const selectedPlan = ref()
const selectedStatus = ref()

// Data table options
const itemsPerPage = ref(10)   // 서버 size
const page = ref(1)            // UI 1-base → 서버 0-base
const sortBy = ref()
const orderBy = ref()
const selectedRows = ref([])

const tableLoading = ref(false)
const usersData = ref({ users: [], totalUsers: 0 })
const stats = ref({ total: 0, active: 0, inactive: 0, pending: 0 })

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
const fetchUsers = async () => {
  tableLoading.value = true
  try {
    const serverPage = Math.max(0, Number(page.value) - 1)
    const serverSize = itemsPerPage.value === -1 ? 1000 : (Number(itemsPerPage.value) || 20)

    // 🔸 퍼블릭 API (헤더 없이)
    const dto = await apiGetUsersPublic({ page: serverPage, size: serverSize })
    const content = Array.isArray(dto?.content) ? dto.content : []

    console.log(dto)

    // 표시용 매핑 (서버에 role/plan/status/billing 없음 → 기본값)
    let list = content.map(u => ({
      id: u.id,
      fullName: u.owner || '(무명)',
      email: u.email,
      avatar: null,
      businessNumber: u.businessNumber,
      storeName: u.storeName,
      role: u.role,
      currentPlan: 'basic',
      status: '활성',
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
    const totalAfterFilter = list.length
    const totalUsersCalc = (q || role || plan || stat) ? totalAfterFilter : totalFromServer

        
    // 🔹 통계 집계
    let active = 0, inactive = 0, pending = 0
    for (const u of content) {
      const s = classifyStatus(u)
      if (s === 'active') active++
      else if (s === 'inactive') inactive++
      else pending++
    }
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
  [searchQuery, selectedRole, selectedPlan, selectedStatus, itemsPerPage, page, sortBy, orderBy],
  fetchUsers,
  { deep: true },
)

onMounted(fetchUsers)

/* ==========================
   필터 옵션 + 표시 유틸
========================== */
const roles = [
  { title: '슈퍼어드민',     value: 'SUPER_ADMIN' },
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
  { title: '활성',   value: '활성' },
  { title: '대기',  value: '대기' },
  { title: '비활성', value: '비활성' },
]

const resolveUserRoleVariant = role => {
  const r = String(role || '').toLowerCase()
  if (r === 'user') return { color: 'primary',  icon: 'bx-user' }
  if (r === 'super_admin') return { color: 'error',     icon: 'bx-pie-chart-alt' }
  if (r === 'admin')      return { color: 'warning',  icon: 'bx-crown' }

  // if (r === '지점장')     return { color: 'warning',  icon: 'bx-edit' }
  // if (r === '매니저')     return { color: 'error',    icon: 'bx-desktop' }
  
  return { color: 'primary', icon: 'bx-user' }
}

const resolveUserStatusVariant = stat => {
  const s = String(stat || '').toLowerCase()
  if (s === '대기')  return 'warning'
  if (s === '활성')   return 'success'
  if (s === '비활성') return 'secondary'
  
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
  <section>
    <!-- 👉 Widgets -->
    <div class="d-flex mb-6">
      <VRow>
        <template
          v-for="(data, id) in widgetData"
          :key="id"
        >
          <VCol
            cols="12"
            md="3"
            sm="6"
          >
            <VCard>
              <VCardText>
                <div class="d-flex justify-space-between">
                  <div class="d-flex flex-column gap-y-1">
                    <div class="text-body-1 text-high-emphasis">
                      {{ data.title }}
                    </div>
                    <div class="d-flex gap-x-2 align-center">
                      <h4 class="text-h4">
                        {{ data.value }}
                      </h4>
                      <!--
                        <div
                        class="text-base"
                        :class="data.change > 0 ? 'text-success' : 'text-error'"
                        >
                        ({{ prefixWithPlus(data.change) }}%)
                        </div> 
                      -->
                    </div>
                    <div class="text-sm">
                      {{ data.desc }}
                    </div>
                  </div>
                  <VAvatar
                    :color="data.iconColor"
                    variant="tonal"
                    rounded
                    size="40"
                  >
                    <VIcon
                      :icon="data.icon"
                      size="24"
                    />
                  </VAvatar>
                </div>
              </VCardText>
            </VCard>
          </VCol>
        </template>
      </VRow>
    </div>

    <VCard class="mb-6">
      <VCardItem class="pb-4">
        <VCardTitle>Filters</VCardTitle>
      </VCardItem>

      <VCardText>
        <VRow>
          <!-- 👉 Select Role -->
          <VCol
            cols="12"
            sm="4"
          >
            <AppSelect
              v-model="selectedRole"
              placeholder="역할을 선택하세요"
              :items="roles"
              clearable
              clear-icon="bx-x"
            />
          </VCol>

          <!-- 👉 Select Plan -->
          <VCol
            cols="12"
            sm="4"
          >
            <AppSelect
              v-model="selectedPlan"
              placeholder="지점을 선택하세요"
              :items="plans"
              clearable
              clear-icon="bx-x"
            />
          </VCol>

          <!-- 👉 Select Status -->
          <VCol
            cols="12"
            sm="4"
          >
            <AppSelect
              v-model="selectedStatus"
              placeholder="상태를 선택하세요"
              :items="status"
              clearable
              clear-icon="bx-x"
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDivider />
      <VCardText class="d-flex flex-wrap gap-4">
        <div class="me-3 d-flex gap-3">
          <!-- 페이지 사이즈 선택 그대로 -->
          <AppSelect
            :model-value="itemsPerPage"
            :items="[
              { value: 10, title: '10' },
              { value: 25, title: '25' },
              { value: 50, title: '50' },
              { value: 100, title: '100' },
              { value: -1, title: 'All' },
            ]"
            style="inline-size: 6.25rem;"
            @update:model-value="itemsPerPage = parseInt($event, 10)"
          />
        </div>
        <VSpacer />

        <div class="app-user-search-filter d-flex align-center flex-wrap gap-4">
          <div style="inline-size: 15.625rem;">
            <AppTextField
              v-model="searchQuery"
              placeholder="유저를 검색하세요"
            />
          </div>

          <ExportToExcel
            :items="users"
            :fields="excelFields"
            :transform="transformForExcel"
            filename="유저리스트.xlsx"
            sheet-name="Users"
            @exported="({ filename, count }) => console.log('엑셀 내보내기 완료:', filename, count)"
            @error="err => console.error('엑셀 내보내기 오류:', err)"
          />
        </div>
      </VCardText>
      <VDivider />

      <!-- SECTION datatable -->
      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:model-value="selectedRows"
        v-model:page="page"
        :items="users"
        item-value="id"
        :items-length="totalUsers"
        :headers="headers"
        class="text-no-wrap"
        show-select
        :loading="tableLoading"
        @update:options="updateOptions"
      >
        <!-- User -->
        <template #item.user="{ item }">
          <div class="d-flex align-center gap-x-4">
            <VAvatar
              size="34"
              :variant="!item.avatar ? 'tonal' : undefined"
              :color="!item.avatar ? resolveUserRoleVariant(item.role).color : undefined"
            >
              <VImg
                v-if="item.avatar"
                :src="item.avatar"
              />
              <span v-else>{{ avatarText(item.fullName) }}</span>
            </VAvatar>
            <div class="d-flex flex-column">
              <h6 class="text-base">
                <RouterLink
                  :to="{ name: 'second-page' }"
                  class="font-weight-medium text-link"
                >
                  {{ item.fullName }}
                </RouterLink>
              </h6>
              <div class="text-sm">
                {{ item.email }}
              </div>
            </div>
          </div>
        </template>

        <!-- 👉 Role -->
        <template #item.role="{ item }">
          <div class="d-flex align-center gap-x-2">
            <VIcon
              :size="20"
              :icon="resolveUserRoleVariant(item.role).icon"
              :color="resolveUserRoleVariant(item.role).color"
            />
            <div class="text-capitalize text-high-emphasis text-body-1">
              {{ item.role }}
            </div>
          </div>
        </template>

        <!-- Plan -->
        <template #item.plan="{ item }">
          <div class="text-body-1 text-high-emphasis text-capitalize">
            {{ item.currentPlan }}
          </div>
        </template>

        <!-- Status -->
        <template #item.status="{ item }">
          <VChip
            :color="resolveUserStatusVariant(item.status)"
            size="small"
            label
            class="text-capitalize"
          >
            {{ item.status }}
          </VChip>
        </template>

        <!-- Actions -->
        <template #item.actions="{ item }">
          <IconBtn @click="deleteUser(item.id)">
            <VIcon icon="bx-trash" />
          </IconBtn>

          <IconBtn>
            <VIcon icon="bx-show" />
          </IconBtn>

          <VBtn
            icon
            variant="text"
            color="medium-emphasis"
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

                <VListItem link>
                  <template #prepend>
                    <VIcon icon="bx-pencil" />
                  </template>
                  <VListItemTitle>Edit</VListItemTitle>
                </VListItem>
              </VList>
            </VMenu>
          </VBtn>
        </template>

        <!-- pagination -->
        <template #bottom>
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalUsers"
          />
        </template>
      </VDataTableServer>
      <!-- SECTION -->
    </VCard>

    <!-- 👉 Add New User -->
    <AddNewUserDrawer
      v-model:is-drawer-open="isAddNewUserDrawerVisible"
      @user-data="addNewUser"
    />
  </section>
</template>
