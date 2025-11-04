import { injectionKeyIsVerticalNavHovered } from '@layouts/symbols'
import { _setDirAttr } from '@layouts/utils'

// ℹ️ We should not import themeConfig here but in urgency we are doing it for now
import { layoutConfig } from '@themeConfig'

export const namespaceConfig = str => `${layoutConfig.app.title}-${str}`
export const cookieRef = (key, defaultValue) => {
  return useCookie(namespaceConfig(key), { default: () => defaultValue })
}

export const useLayoutConfigStore = defineStore('layoutConfig', () => {
  const route = useRoute()
  
  // useDisplay 대신 useMediaQuery 사용 (vuetify 의존성 제거)
  const lgAndUpRef = ref(false)
  watchEffect(() => {
    lgAndUpRef.value = useMediaQuery('(min-width: 1264px)').value // Vuetify lg breakpoint
  })
  const lgAndUp = computed(() => lgAndUpRef.value)

  // 👉 Navbar Type
  const navbarType = ref(layoutConfig.navbar.type)

  // 👉 Navbar Type
  const isNavbarBlurEnabled = cookieRef('isNavbarBlurEnabled', layoutConfig.navbar.navbarBlur)

  // 👉 Vertical Nav Collapsed
  // 테블릿 사이즈에서도 기본적으로 펼쳐진 상태로 설정
  const getDefaultCollapsedState = () => {
    // 쿠키에 저장된 값이 있으면 우선 사용
    const cookie = useCookie(namespaceConfig('isVerticalNavCollapsed'))
    if (cookie.value !== null && cookie.value !== undefined) {
      return cookie.value
    }
    // 모든 사이즈에서 기본적으로 펼쳐진 상태(false = 열림)
    return false
  }
  
  const isVerticalNavCollapsed = cookieRef('isVerticalNavCollapsed', getDefaultCollapsedState())
  
  // 화면 크기 변경 감지는 유지하되 자동 접힘 기능은 비활성화
  // 사용자가 직접 접었다 펼칠 수 있도록 함

  // 👉 App Content Width
  const appContentWidth = cookieRef('appContentWidth', layoutConfig.app.contentWidth)

  // 👉 App Content Layout Nav
  const appContentLayoutNav = ref(layoutConfig.app.contentLayoutNav)


  // 👉 Footer Type
  const footerType = ref(layoutConfig.footer.type)

  // 👉 Misc
  const breakpointRef = ref(false)


  // Sync with `useMediaQuery`
  watchEffect(() => {
    breakpointRef.value = useMediaQuery(`(max-width: ${layoutConfig.app.overlayNavFromBreakpoint}px)`).value
  })

  const isLessThanOverlayNavBreakpoint = computed({
    get() {
      return breakpointRef.value // Getter for reactive state
    },
    set(value) {
      breakpointRef.value = value // Allow manual mutation
    },
  })


  // 👉 Layout Classes
  const _layoutClasses = computed(() => {
    const { y: windowScrollY } = useWindowScroll()
    
    return [
      `layout-nav-type-${appContentLayoutNav.value}`,
      `layout-navbar-${navbarType.value}`,
      `layout-footer-${footerType.value}`,
      {
        'layout-vertical-nav-collapsed': isVerticalNavCollapsed.value
                    && appContentLayoutNav.value === 'vertical'
                    && !isLessThanOverlayNavBreakpoint.value,
      },
      `layout-content-width-${appContentWidth.value}`,
      { 'layout-overlay-nav': isLessThanOverlayNavBreakpoint.value },
      { 'window-scrolled': unref(windowScrollY) },
      route.meta.layoutWrapperClasses ? route.meta.layoutWrapperClasses : null,
    ]
  })


  // 👉 RTL
  // const isAppRTL = ref(layoutConfig.app.isRTL)
  const isAppRTL = ref(false)

  watch(isAppRTL, val => {
    _setDirAttr(val ? 'rtl' : 'ltr')
  })


  // 👉 Is Vertical Nav Mini
  /*
      This function will return true if current state is mini. Mini state means vertical nav is:
        - Collapsed
        - Isn't hovered by mouse
        - nav is not less than overlay breakpoint (hence, isn't overlay menu)
  
      ℹ️ We are getting `isVerticalNavHovered` as param instead of via `inject` because
          we are using this in `VerticalNav.vue` component which provide it and I guess because
          same component is providing & injecting we are getting undefined error
    */
  const isVerticalNavMini = (isVerticalNavHovered = null) => {
    const isVerticalNavHoveredLocal = isVerticalNavHovered || inject(injectionKeyIsVerticalNavHovered) || ref(false)
    
    return computed(() => isVerticalNavCollapsed.value && !isVerticalNavHoveredLocal.value && !isLessThanOverlayNavBreakpoint.value)
  }

  return {
    appContentWidth,
    appContentLayoutNav,
    navbarType,
    isNavbarBlurEnabled,
    isVerticalNavCollapsed,
    footerType,
    isLessThanOverlayNavBreakpoint,
    isAppRTL,
    _layoutClasses,
    isVerticalNavMini,
  }
})
