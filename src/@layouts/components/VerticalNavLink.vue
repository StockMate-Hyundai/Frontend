<script setup>
import { layoutConfig } from '@layouts'
import { can } from '@layouts/plugins/casl'
import { useLayoutConfigStore } from '@layouts/stores/config'
import {
  getComputedNavLinkToProp,
  getDynamicI18nProps,
  isNavLinkActive,
} from '@layouts/utils'

const props = defineProps({
  item: {
    type: null,
    required: true,
  },
  toggleIsOverlayNavActive: {
    type: Function,
    required: false,
    default: null,
  },
  isOverlayNavActive: {
    type: Boolean,
    required: false,
    default: false,
  },
})

const configStore = useLayoutConfigStore()
const hideTitleAndBadge = configStore.isVerticalNavMini()

// 네비게이션 링크 클릭 시 오버레이 닫기 (즉시 처리)
const handleLinkClick = () => {
  // 모바일 환경에서만 처리
  if (configStore.isLessThanOverlayNavBreakpoint.value && props.isOverlayNavActive && props.toggleIsOverlayNavActive) {
    // 즉시 닫기 - 동기적으로 여러 번 호출하여 확실하게
    props.toggleIsOverlayNavActive(false)
    
    // requestAnimationFrame으로도 처리 (브라우저 렌더링 사이클에 맞춰)
    requestAnimationFrame(() => {
      if (props.toggleIsOverlayNavActive) {
        props.toggleIsOverlayNavActive(false)
      }
    })
    
    // 추가로 setTimeout으로도 처리 (모든 경우 대비)
    setTimeout(() => {
      if (props.toggleIsOverlayNavActive) {
        props.toggleIsOverlayNavActive(false)
      }
    }, 0)
  }
}
</script>

<template>
  <li
    v-if="can(item.action, item.subject)"
    class="nav-link"
    :class="{ disabled: item.disable }"
  >
    <Component
      :is="item.to ? 'RouterLink' : 'a'"
      v-bind="getComputedNavLinkToProp(item)"
      :class="{ 'router-link-active router-link-exact-active': isNavLinkActive(item, $router) }"
      @click="handleLinkClick"
    >
      <Component
        :is="layoutConfig.app.iconRenderer || 'div'"
        v-bind="item.icon || layoutConfig.verticalNav.defaultNavItemIconProps"
        class="nav-item-icon"
      />
      <TransitionGroup name="transition-slide-x">
        <!-- 👉 Title -->
        <Component
          :is="layoutConfig.app.i18n.enable ? 'i18n-t' : 'span'"
          v-show="!hideTitleAndBadge"
          key="title"
          class="nav-item-title"
          v-bind="getDynamicI18nProps(item.title, 'span')"
        >
          {{ item.title }}
        </Component>

        <!-- 👉 Badge -->
        <Component
          :is="layoutConfig.app.i18n.enable ? 'i18n-t' : 'span'"
          v-if="item.badgeContent"
          v-show="!hideTitleAndBadge"
          key="badge"
          class="nav-item-badge"
          :class="item.badgeClass"
          v-bind="getDynamicI18nProps(item.badgeContent, 'span')"
        >
          {{ item.badgeContent }}
        </Component>
      </TransitionGroup>
    </Component>
  </li>
</template>

<style lang="scss">
.layout-vertical-nav {
  .nav-link a {
    display: flex;
    align-items: center;
  }
}
</style>
