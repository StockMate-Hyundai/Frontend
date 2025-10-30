<template>
  <div class="navigation-history-tabs">
    <div class="tabs-container">
      <div
        v-for="(item, index) in history"
        :key="item.path"
        class="tab-item"
        :class="{ 'active': isCurrentPage(item.path) }"
        @click="navigateToPage(item.path)"
      >
        <VIcon
          :icon="item.icon"
          size="16"
          class="tab-icon"
        />
        <span class="tab-title">{{ item.title }}</span>
        <VIcon
          icon="bx-x"
          size="14"
          class="tab-close"
          @click.stop="removePage(item.path)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useNavigationHistoryStore } from '@/@core/stores/navigationHistory'
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()
const navigationHistoryStore = useNavigationHistoryStore()

const history = computed(() => [...navigationHistoryStore.getHistory].reverse())

// 라우터 변경 감지하여 히스토리에 추가
watch(() => route.path, (newPath, oldPath) => {
  if (newPath !== oldPath) {
    // 공개 페이지가 아닌 경우에만 히스토리에 추가
    const isPublic = route.matched.some(r => r.meta?.public === true)
    if (!isPublic) {
      navigationHistoryStore.addToHistory(route)
    }
  }
}, { immediate: true })

const isCurrentPage = path => {
  return route.path === path
}

const navigateToPage = path => {
  if (path !== route.path) {
    // 현재 활성 탭의 스타일을 즉시 제거하지 않고 라우터 이동 후 자연스럽게 변경되도록 함
    router.push(path)
  }
}

const removePage = path => {
  const isActive = route.path === path

  navigationHistoryStore.removeFromHistory(path)
  if (isActive) {
    const next = navigationHistoryStore.getCurrentPage

    router.push(next?.path || '/')
  }
}
</script>

<style lang="scss" scoped>
.navigation-history-tabs {
  background: white;
  padding: 8px 16px;
  overflow-x: auto;
  white-space: nowrap;
  flex-shrink: 0;
  will-change: scroll-position;
  max-width: 70vw; // 최대 가로 넓이 50vh로 제한

  .tabs-container {
    display: flex;
    gap: 4px;
    min-width: max-content;
    flex-wrap: nowrap;
    will-change: transform;
    width: 100%;
  }

  .tab-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
    background: white;
    cursor: pointer;
    min-width: fit-content;
    max-width: 200px;
    will-change: background-color, border-color, color;
    transform: translateZ(0); // 하드웨어 가속
    backface-visibility: hidden; // 뒤면 숨김

    &:hover {
      background: #f5f5f5;
      border-color: #d0d0d0;
    }

    &.active {
      background: #e3f2fd;
      border-color: #2196f3;
      color: #1976d2;
      transform: translateZ(0); // 하드웨어 가속 활성화
      backface-visibility: hidden; // 뒤면 숨김으로 깜빡임 방지

      .tab-icon,
      .tab-close {
        color: #1976d2;
      }
    }

    .tab-icon {
      color: #666;
      flex-shrink: 0;
    }

    .tab-title {
      font-size: 14px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }

    .tab-close {
      color: #999;
      flex-shrink: 0;
      padding: 2px;
      border-radius: 2px;
      transition: background-color 0.15s ease, color 0.15s ease;
      will-change: background-color, color;

      &:hover {
        background: rgba(0, 0, 0, 0.1);
        color: #666;
      }
    }
  }
}

// 스크롤바 스타일링
.navigation-history-tabs::-webkit-scrollbar {
  height: 4px;
}

.navigation-history-tabs::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.navigation-history-tabs::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 2px;
}

.navigation-history-tabs::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

// 스크롤 성능 최적화
.navigation-history-tabs {
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  transform: translateZ(0); // 하드웨어 가속
  backface-visibility: hidden; // 뒤면 숨김
}

// 탭 상태 변경 시 깜빡임 방지
.tab-item {
  // 활성 상태 변경 시 부드러운 전환
  &.active {
    transition: background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease;
  }
  
  // 비활성 상태로 변경 시 더 빠른 전환
  &:not(.active) {
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
}
</style>
