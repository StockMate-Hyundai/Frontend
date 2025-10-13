// 인증/인터셉터 일절 없는 순수 퍼블릭 클라이언트
import axios from 'axios'

export const httpPublic = axios.create({
  baseURL: 'https://api.stockmate.site',
  timeout: 15000,
  withCredentials: false,
})

// 혹시 전역 axios 인터셉터가 있다면 방지용(권장)
httpPublic.interceptors.request.use(config => {
  // Authorization 등 민감 헤더가 실수로 섞이지 않도록 확실히 제거
  if (config.headers) {
    delete config.headers.Authorization
    delete config.headers['Authorization-Refresh']
  }
  
  return config
})
