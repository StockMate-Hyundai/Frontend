import { deepMerge } from '@antfu/utils'
import { themeConfig } from '@themeConfig'
import { createVuetify } from 'vuetify'
import { VBtn } from 'vuetify/components/VBtn'
import defaults from './defaults'
import { icons } from './icons'
import { staticPrimaryColor, staticPrimaryDarkenColor, themes } from './theme'

// Styles
import '@core/scss/template/libs/vuetify/index.scss'
import { parse } from 'cookie-es'
import { destr } from 'destr'
import 'vuetify/styles'

function getCookieValue(key, defaultValue) {
  if (typeof document === 'undefined') return defaultValue
  const cookies = parse(document.cookie, {
    decode: val => destr(decodeURIComponent(val)),
  })
  const cookieKey = Object.keys(cookies).find(k => k.endsWith(`-${key}`))
  return cookieKey ? cookies[cookieKey] : defaultValue
}

export default function (app) {
  const cookieThemeValues = {
    defaultTheme: resolveVuetifyTheme(themeConfig.app.theme),
    themes: {
      light: {
        colors: {
          'primary': getCookieValue('lightThemePrimaryColor', staticPrimaryColor),
          'primary-darken-1': getCookieValue('lightThemePrimaryDarkenColor', staticPrimaryDarkenColor),
        },
      },
      dark: {
        colors: {
          'primary': getCookieValue('darkThemePrimaryColor', staticPrimaryColor),
          'primary-darken-1': getCookieValue('darkThemePrimaryDarkenColor', staticPrimaryDarkenColor),
        },
      },
    },
  }

  const optionTheme = deepMerge({ themes }, cookieThemeValues)

  const vuetify = createVuetify({
    aliases: {
      IconBtn: VBtn,
    },
    defaults,
    icons,
    theme: optionTheme,
  })

  app.use(vuetify)
}
