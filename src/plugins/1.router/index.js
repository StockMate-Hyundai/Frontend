import { getTokens } from '@/api/http' // ← 우리가 만든 토큰 유틸(JS 버전)
import { setupLayouts } from 'virtual:meta-layouts'
import { createRouter, createWebHistory } from 'vue-router/auto'

function recursiveLayouts(route) {
  if (route.children) {
    for (let i = 0; i < route.children.length; i++)
      route.children[i] = recursiveLayouts(route.children[i])
    
    return route
  }
  
  return setupLayouts([route])[0]
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, behavior: 'smooth', top: 60 }
    
    return { top: 0 }
  },
  extendRoutes: pages => [
    ...[...pages].map(route => recursiveLayouts(route)),

    // 팁) 사실 아래처럼 더 간단히도 가능: extendRoutes: pages => setupLayouts(pages)
  ],
})

/** ✅ 인증 가드 */
router.beforeEach(to => {
  // 로그인/회원가입 같은 공개 페이지는 meta.public: true 로 표시
  const isPublic = to.matched.some(r => r.meta?.public === true)
  const needsAuth = to.matched.some(r => r.meta?.requiresAuth === true)

  if (!needsAuth || isPublic) return

  const { accessToken } = getTokens()
  if (!accessToken) {
    return {
      path: '/login',
      query: { redirect: to.fullPath, reason: 'unauthorized' },
    }
  }
})

export { router }
export default function (app) {
  app.use(router)
}
