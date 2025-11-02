<script setup>
import navItems from '@/navigation/vertical'
import { themeConfig } from '@themeConfig'

// Components
import NavbarThemeSwitcher from '@/layouts/components/NavbarThemeSwitcher.vue'
import UserProfile from '@/layouts/components/UserProfile.vue'
import NavBarI18n from '@core/components/I18n.vue'
import NavigationHistoryTabs from '@core/components/NavigationHistoryTabs.vue'
import NavBarNotifications from '@/layouts/components/NavBarNotifications.vue'

// @layouts plugin
import { useConfigStore } from '@/@core/stores/config'
import { VerticalNavLayout } from '@layouts'

const configStore = useConfigStore()

// ℹ️ Provide animation name for vertical nav collapse icon.
const verticalNavHeaderActionAnimationName = ref(null)

watch([
  () => configStore.isVerticalNavCollapsed,
  () => configStore.isAppRTL,
], val => {
  if (configStore.isAppRTL)
    verticalNavHeaderActionAnimationName.value = val[0] ? 'rotate-back-180' : 'rotate-180'
  else
    verticalNavHeaderActionAnimationName.value = val[0] ? 'rotate-180' : 'rotate-back-180'
}, { immediate: true })

const actionArrowInitialRotation = configStore.isVerticalNavCollapsed ? '180deg' : '0deg'
</script>

<template>
  <VerticalNavLayout :nav-items="navItems">
    <!-- 👉 navbar -->
    <template #navbar="{ toggleVerticalOverlayNavActive }">
      <div class="navbar-main d-flex h-100 align-center">
        <IconBtn
          id="vertical-nav-toggle-btn"
          class="ms-n3 d-lg-none"
          @click="toggleVerticalOverlayNavActive(true)"
        >
          <VIcon
            size="26"
            icon="bx-menu"
          />
        </IconBtn>

        <NavbarThemeSwitcher />
        <!-- 👉 네비게이션 히스토리 탭 -->
        <div class="navbar-tabs">
          <NavigationHistoryTabs />
        </div>
        <VSpacer />

        <NavBarI18n
          v-if="themeConfig.app.i18n.enable && themeConfig.app.i18n.langConfig?.length"
          :languages="themeConfig.app.i18n.langConfig"
        />
        <NavBarNotifications />
        <UserProfile />
      </div>
    </template>

    <!-- 👉 Pages -->
    <slot />

    <!-- 👉 Customizer -->
    <!-- <TheCustomizer /> -->
  </VerticalNavLayout>
</template>

<style lang="scss">
@use "@layouts/styles/mixins" as layoutsMixins;

.navbar-main {
  flex-shrink: 0;
}

.navbar-tabs {
  flex-shrink: 0;
}

.layout-vertical-nav {
  // ℹ️ Nav header circle on the right edge
  .nav-header {
    position: relative;
    overflow: visible !important;

    &::after {
      --diameter: 36px; // 36px에서 48px로 크기 증가

      position: absolute;
      z-index: -1;
      aspect-ratio: 1;
      background: rgba(var(--v-theme-surface), 1); // 흰색 배경 복원
      border-radius: 50%; // 원형으로 만들기
      content: "";
      inline-size: var(--diameter);
      inset-block-start: calc(50% - var(--diameter) / 2);
      inset-inline-end: -18px; // 위치 조정 (18px에서 24px로)

      @at-root {
        // Change background color of nav header circle when vertical nav is in overlay mode
        .layout-overlay-nav {
          --app-header-container-bg: rgb(var(--v-theme-surface));

          // ℹ️ Only transition in overlay mode
          .nav-header::after {
            transition: opacity 0.2s ease-in-out;
          }
        }

        .layout-vertical-nav-collapsed .layout-vertical-nav:not(.hovered) {
          .nav-header::after,
          .nav-header .header-action {
            opacity: 0;
          }
        }
      }
    }
  }

  // Don't show nav header circle when vertical nav is in overlay mode and not visible
  &.overlay-nav:not(.visible) .nav-header::after {
    opacity: 0;
  }
}

// ℹ️ Nav header action buttons styles
@keyframes rotate-180 {
  from {
    transform: rotate(0deg) scaleX(var(--app-header-actions-scale-x));
  }

  to {
    transform: rotate(180deg) scaleX(var(--app-header-actions-scale-x));
  }
}

@keyframes rotate-back-180 {
  from {
    transform: rotate(180deg) scaleX(var(--app-header-actions-scale-x));
  }

  to {
    transform: rotate(0deg) scaleX(var(--app-header-actions-scale-x));
  }
}

/* stylelint-disable-next-line no-duplicate-selectors */
.layout-vertical-nav {
  /* stylelint-disable-next-line no-duplicate-selectors */
  .nav-header {
    .header-action {
      // ℹ️ We need to create this CSS variable for reusing value in animation
      --app-header-actions-scale-x: 1;

      // 원형 버튼 스타일 직접 정의 - !important로 강제 적용
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      background-color: rgb(var(--v-global-theme-primary)) !important;
      height: 1.375rem !important;
      width: 1.375rem !important;
      border-radius: 50% !important;
      min-width: 1.375rem !important;
      min-height: 1.375rem !important;
      max-width: 1.375rem !important;
      max-height: 1.375rem !important;
      
      position: absolute;
      animation-duration: 0.35s;
      animation-fill-mode: forwards;
      animation-name: v-bind(verticalNavHeaderActionAnimationName);
      color: white;
      inset-inline-end: 0;
      inset-inline-end: -11px;
      /* stylelint-disable-next-line value-keyword-case */
      transform: rotate(v-bind(actionArrowInitialRotation)) scaleX(var(--app-header-actions-scale-x));
      transition: opacity 0.2s ease-in-out;

      @include layoutsMixins.rtl {
        --app-header-actions-scale-x: -1;
      }

      @at-root {
        .layout-nav-type-vertical.layout-overlay-nav .layout-vertical-nav:not(.visible) .nav-header .header-action {
          opacity: 0;
        }
      }
    }
  }
}

// 더 강력한 선택자로 header-action 버튼 강제 원형화
.layout-wrapper.layout-nav-type-vertical .layout-vertical-nav .nav-header .header-action,
.layout-vertical-nav .nav-header .header-action,
.header-action {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background-color: rgb(var(--v-global-theme-primary)) !important;
  height: 1.375rem !important;
  width: 1.375rem !important;
  border-radius: 50% !important;
  min-width: 1.375rem !important;
  min-height: 1.375rem !important;
  max-width: 1.375rem !important;
  max-height: 1.375rem !important;
  box-sizing: border-box !important;
}
</style>
