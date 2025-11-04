import { getProfile } from '@/api/http'
import stock from './stock'
import user from './user'

// 네비게이션 항목 생성 함수 (역할에 따라 필터링)
export function getNavigationItems() {
  const { role } = getProfile()
  const userRole = (role || 'USER').toUpperCase()
  
  // 창고관리자인 경우
  if (userRole === 'WAREHOUSE') {
    return [
      {
        title: '대시보드',
        to: { name: 'root' },
        icon: { icon: 'bx-home-alt' },
      },
      { heading: '입/출고 관리' },
      {
        title: '본사 재고 관리',
        icon: { icon: 'bx-package' },
        children: [
          { title: '전체 재고 조회', to: 'stock-list' },
          { title: '부족 재고 조회', to: 'stock-low-list' },
        ],
      },
      {
        title: '주문 관리',
        icon: { icon: 'bx-cart' },
        children: [
          { title: '출고 대기', to: 'order-pending-shipping' },
          { title: '배송 시작', to: 'start-shipping' },
          { title: '입출고 히스토리', to: 'order-history' },
          { title: '입출고 히스토리 캘린더', to: 'order-history-calendar' },
        ],
      },
      {
        title: '3D 뷰어',
        to: { name: 'warehouse-viewer' },
        icon: { icon: 'bx-cube' },
      },
    ]
  }
  
  // 기타 역할 (전체 네비게이션)
  return [
    {
      title: '대시보드',
      to: { name: 'root' },
      icon: { icon: 'bx-home-alt' },
    },
    {
      title: '리포트',
      to: { name: 'report' },
      icon: { icon: 'bx-bar-chart-alt-2' },
    },
    ...stock,
    ...user,
    {
      title: '3D 뷰어',
      to: { name: 'warehouse-viewer' },
      icon: { icon: 'bx-cube' },
    },
  ]
}

// 기본 export는 함수 호출 결과 (하위 호환성)
export default getNavigationItems()
