export default [
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
      { title: '주문 목록 조회', to: 'order-list' },
      { title: '주문 승인', to: 'order-approval' },
    ],
  },
]
