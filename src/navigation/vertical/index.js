import stock from './stock'
import user from './user'

export default [
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

  // {
  //   title: '일정표',
  //   to: { name: 'second-page' },
  //   icon: { icon: 'bx-file-blank' },
  // },
  // {
  //   title: '부품 요청',
  //   to: { name: 'parts-request' },
  //   icon: { icon: 'bx-package' },
  // },
  // {
  //   title: '보고서',
  //   to: { name: 'second-page' },
  //   icon: { icon: 'bx-file-blank' },
  // },
]
