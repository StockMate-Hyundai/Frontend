import { defineStore } from 'pinia'

export const useNavigationHistoryStore = defineStore('navigationHistory', {
  state: () => ({
    history: [],
    maxHistory: 10, // 최대 히스토리 개수
  }),

  getters: {
    getHistory: state => state.history,
    getCurrentPage: state => state.history[state.history.length - 1],
  },

  actions: {
    // 페이지 히스토리에 추가
    addToHistory(route) {
      const existingIndex = this.history.findIndex(item => item.path === route.path)
      
      if (existingIndex !== -1) {
        // 이미 존재하는 페이지면 해당 위치로 이동
        this.history.splice(existingIndex, 1)
      }
      
      // 새 페이지를 히스토리에 추가
      this.history.push({
        path: route.path,
        name: route.name,
        title: route.meta?.title || route.name || 'Untitled',
        icon: route.meta?.icon || 'bx-file',
        timestamp: Date.now(),
      })
      
      // 최대 히스토리 개수 제한
      if (this.history.length > this.maxHistory) {
        this.history.shift()
      }
    },

    // 특정 페이지를 히스토리에서 제거
    removeFromHistory(path) {
      const index = this.history.findIndex(item => item.path === path)
      if (index !== -1) {
        this.history.splice(index, 1)
      }
    },

    // 히스토리 초기화
    clearHistory() {
      this.history = []
    },

    // 현재 페이지를 히스토리에서 제거 (뒤로가기 시)
    removeCurrentPage() {
      if (this.history.length > 0) {
        this.history.pop()
      }
    },
  },
})
