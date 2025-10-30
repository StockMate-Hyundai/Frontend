import { layoutConfig } from '@layouts/config'
import { AppContentLayoutNav } from '@layouts/enums'
import { useLayoutConfigStore } from '@layouts/stores/config'

export const openGroups = ref([])

/**
 * Return nav link props to use
 // @param {Object, String} item navigation routeName or route Object provided in navigation data
 */
export const getComputedNavLinkToProp = computed(() => link => {
  const props = {
    target: link.target,
    rel: link.rel,
  }


  // If route is string => it assumes string is route name => Create route object from route name
  // If route is not string => It assumes it's route object => returns passed route object
  if (link.to)
    props.to = typeof link.to === 'string' ? { name: link.to } : link.to
  else
    props.href = link.href
  
  return props
})

/**
 * Return route name for navigation link
 * If link is string then it will assume it is route-name
 * IF link is object it will resolve the object and will return the link
 // @param {Object, String} link navigation link object/string
 */
export const resolveNavLinkRouteName = (link, router) => {
  if (!link.to)
    return null
  if (typeof link.to === 'string')
    return link.to
  
  return router.resolve(link.to).name
}

/**
 * Check if nav-link is active
 * @param {object} link nav-link object
 */
export const isNavLinkActive = (link, router) => {
  // Matched routes array of current route
  const matchedRoutes = router.currentRoute.value.matched

  // Check if provided route matches route's matched route
  const resolveRoutedName = resolveNavLinkRouteName(link, router)
  if (!resolveRoutedName)
    return false
  
  return matchedRoutes.some(route => {
    return route.name === resolveRoutedName || route.meta.navActiveLink === resolveRoutedName
  })
}

/**
 * Check if nav group is active
 * @param {Array} children Group children
 */
export const isNavGroupActive = (children, router) => children.some(child => {
  // If child have children => It's group => Go deeper(recursive)
  if ('children' in child)
    return isNavGroupActive(child.children, router)

  // else it's link => Check for matched Route
  return isNavLinkActive(child, router)
})

/**
 * Change `dir` attribute based on direction
 * @param dir 'ltr' | 'rtl'
 */
export const _setDirAttr = dir => {
  // Check if document exists for SSR
  if (typeof document !== 'undefined')
    document.documentElement.setAttribute('dir', dir)
}

/**
 * Return dynamic i18n props based on i18n plugin is enabled or not
 * @param key i18n translation key
 * @param tag tag to wrap the translation with
 */
export const getDynamicI18nProps = (key, tag = 'span') => {
  if (!layoutConfig.app.i18n.enable)
    return {}
  
  return {
    keypath: key,
    tag,
    scope: 'global',
  }
}
