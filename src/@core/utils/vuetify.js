import { parse } from 'cookie-es'
import { destr } from 'destr'

export const resolveVuetifyTheme = defaultTheme => {
  if (typeof document === 'undefined') return defaultTheme
  
  // 쿠키 직접 파싱 (composable 없이)
  const cookies = parse(document.cookie, {
    decode: val => destr(decodeURIComponent(val)),
  })
  
  // 쿠키 키 찾기: -theme 또는 -color-scheme으로 끝나는 키
  const themeKey = Object.keys(cookies).find(k => k.endsWith('-theme'))
  const colorSchemeKey = Object.keys(cookies).find(k => k.endsWith('-color-scheme'))
  
  const storedTheme = themeKey ? cookies[themeKey] : defaultTheme
  
  // 시스템 다크모드 감지 (브라우저 API 사용)
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  const cookieColorScheme = colorSchemeKey ? cookies[colorSchemeKey] : (prefersDark ? 'dark' : 'light')
  
  return storedTheme === 'system'
    ? cookieColorScheme === 'dark'
      ? 'dark'
      : 'light'
    : storedTheme
}
