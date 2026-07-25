import { TitleText, TextGradient, TextGlow, TextShadow } from '@shared/types'

export const THEME_COLORS = {
  dark: { bezel: '#27272a', border: '#09090b' },
  light: { bezel: '#e4e4e7', border: '#d4d4d8' },
  'space-gray': { bezel: '#525252', border: '#3f3f46' },
  midnight: { bezel: '#1c1917', border: '#0c0a09' },
  custom: { bezel: '#27272a', border: '#09090b' }
} as const

export type ThemeKey = keyof typeof THEME_COLORS

export function resolveThemeColors(
  colorTheme: string,
  customBezel?: string,
  customBorder?: string
): { bezel: string; border: string } {
  const base = THEME_COLORS[colorTheme as ThemeKey] ?? THEME_COLORS.dark
  if (colorTheme === 'custom') {
    return { bezel: customBezel ?? base.bezel, border: customBorder ?? base.border }
  }
  return base
}

export function buildTextStyle(t: Pick<TitleText, 'fontSize' | 'fontFamily' | 'fontWeight' | 'color' | 'gradient' | 'glow' | 'shadow' | 'textAlign'>): React.CSSProperties {
  const style: React.CSSProperties = {
    fontSize: t.fontSize,
    fontFamily: t.fontFamily,
    fontWeight: t.fontWeight,
    lineHeight: 1.1,
    color: t.color
  }

  if (t.gradient?.enabled) {
    style.background = `linear-gradient(${t.gradient.angle}deg, ${t.gradient.color1}, ${t.gradient.color2})`
    style.WebkitBackgroundClip = 'text'
    style.backgroundClip = 'text'
    style.WebkitTextFillColor = 'transparent'
    style.color = 'transparent'
  }

  if (t.glow?.enabled) {
    style.textShadow = `0 0 ${t.glow.blur}px ${t.glow.color}`
  }

  if (t.shadow?.enabled) {
    const existing = style.textShadow || ''
    const shadow = `${t.shadow.offsetX}px ${t.shadow.offsetY}px ${t.shadow.blur}px ${t.shadow.color}`
    style.textShadow = existing ? `${existing}, ${shadow}` : shadow
  }

  return style
}
