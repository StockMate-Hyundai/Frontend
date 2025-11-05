import { getProfile, getTokens } from '@/api/http'; // ← 우리가 만든 토큰 유틸(JS 버전)
import { setupLayouts } from 'virtual:meta-layouts';
import { createRouter, createWebHistory } from 'vue-router/auto';

// function recursiveLayouts(route) {
//   if (route.children) {
//     for (let i = 0; i < route.children.length; i++)
//       route.children[i] = recursiveLayouts(route.children[i])
    
//     return route
//   }
  
//   return setupLayouts([route])[0]
// }

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, behavior: 'smooth', top: 60 }
    
    return { top: 0 }
  },

  // extendRoutes: pages => [
  //   ...[...pages].map(route => recursiveLayouts(route)),
  // ],
  extendRoutes: pages => setupLayouts(pages),
})

// 창고관리자가 접근 가능한 페이지 목록
const WAREHOUSE_ALLOWED_ROUTES = [
  'root',                    // 대시보드
  'stock-list',              // 전체 재고 조회
  'stock-low-list',          // 부족 재고 조회
  'order-pending-shipping',  // 출고 대기
  'start-shipping',          // 배송 시작
  'order-history',           // 입출고 히스토리
  'order-history-calendar',  // 입출고 히스토리 캘린더
  'warehouse-viewer',        // 3D 뷰어
  'warehouse-navigation',    // 3D 네비게이션
]

/** ✅ 인증 가드 */
router.beforeEach((to, from) => {
  // 로그인/회원가입 같은 공개 페이지는 meta.public: true 로 표시
  const isPublic = to.matched.some(r => r.meta?.public === true)
  const needsAuth = to.matched.some(r => r.meta?.requiresAuth === true)

  if (!needsAuth || isPublic) return

  const { accessToken } = getTokens()
  if (!accessToken) {
    // 이미 로그인 페이지에 있거나 로그인 페이지로 가려고 하면 리다이렉트하지 않음 (무한 루프 방지)
    const isGoingToLogin = to.path === '/login' || to.path.startsWith('/login/')
    const isFromLogin = from.path === '/login' || from.path.startsWith('/login/')
    
    if (isGoingToLogin || isFromLogin) {
      return false // 네비게이션 취소
    }
    
    return {
      path: '/login',
      query: { redirect: to.fullPath, reason: 'unauthorized' },
    }
  }

  // 창고관리자 권한 체크
  const { role } = getProfile()
  const userRole = (role || 'USER').toUpperCase()
  
  if (userRole === 'WAREHOUSE') {
    const routeName = to.name
    // 허용된 페이지가 아니면 대시보드로 리다이렉트
    if (routeName && !WAREHOUSE_ALLOWED_ROUTES.includes(routeName)) {
      return {
        path: '/',
        query: { reason: 'forbidden' },
      }
    }
  }
})

/** ✅ 네비게이션 히스토리 관리 */
router.afterEach(to => {
  // 공개 페이지가 아닌 경우에만 히스토리에 추가
  const isPublic = to.matched.some(r => r.meta?.public === true)

  if (!isPublic) {
    // 스토어는 컴포넌트에서 사용하도록 하고, 여기서는 이벤트로 처리
    // 실제로는 NavigationHistoryTabs 컴포넌트에서 라우터 변경을 감지하여 처리
  }
})

export { router };
export default function (app) {
  app.use(router)
}
