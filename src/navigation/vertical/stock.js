export default [
  { heading: '입/출고 관리' },
  {
    title: '재고 관리',
    icon: { icon: 'bx-package' },
    children: [
      { title: '전체 재고 조회', to: 'stock-list' },
      { title: '부족 재고 조회', to: 'stock-low-list' },
      { title: '지점별 재고 조회', to: 'branch-stock-list' },
    ],
  },
  {
    title: '주문 관리',
    icon: { icon: 'bx-cart' },
    children: [
      { title: '주문 목록 조회', to: 'order-list' },
      { title: '주문 승인', to: 'order-approval' },
      { title: '출고 대기', to: 'order-pending-shipping' },
      { title: '배송 시작', to: 'start-shipping' },
      { title: '입출고 히스토리', to: 'order-history' },
      { title: '입출고 히스토리 캘린더', to: 'order-history-calendar' },
    ],
  },
]
