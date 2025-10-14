export default [
  { heading: '입/출고 관리' },
  {
    title: '재고 관리',
    icon: { icon: 'bx-package' },
    children: [
      { title: '전체 재고 조회', to: 'stock-list' },
      { title: '부족 재고 조회', to: 'stock-low-list' },
    ],
  },
]
