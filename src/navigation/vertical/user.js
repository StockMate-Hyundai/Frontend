export default [
  { heading: '시스템 관리' },
  {
    title: '사용자',
    icon: { icon: 'bx-user' },
    children: [
      { title: '사용자 관리', to: 'user-list' },
      { title: '지점 관리', to: 'branch-management' },
    ],
  },
]
