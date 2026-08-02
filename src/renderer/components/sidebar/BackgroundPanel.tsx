import { type ReactNode } from 'react'
import { useTheme } from '../../hooks/useTheme'
import ThemesPanel from './ThemesPanel'
import ThemePresetsPanel from './ThemePresetsPanel'

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { clsx, text } = useTheme()
  return (
    <section>
      <h2 className={clsx('text-xs font-semibold uppercase tracking-wider mb-2', text.secondary)}>{title}</h2>
      {children}
    </section>
  )
}

function Divider() {
  const { clsx, border } = useTheme()
  return <div className={clsx('border-t', border.primary)} />
}

/**
 * Merged Theme panel (v0.3.0 IA): the theme (scene background) editor and the
 * theme-preset gallery stack here in order. Canvas Size moved back to its own
 * `canvas` tab (post-5e polish). The rail tab id stays `'background'` for
 * stored-state compatibility; only the user-facing label reads "Theme".
 */
export default function BackgroundPanel() {
  return (
    <div className="space-y-5">
      <Section title="Theme">
        <ThemesPanel />
      </Section>
      <Divider />
      <Section title="Theme Presets">
        <ThemePresetsPanel />
      </Section>
    </div>
  )
}
