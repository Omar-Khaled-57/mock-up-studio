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
 * Merged Background panel (v0.3.0 IA): the `themes` (background editor) and
 * `theme-presets` tabs stack here in order. Canvas Size moved back to its own
 * `canvas` tab (post-5e polish).
 */
export default function BackgroundPanel() {
  return (
    <div className="space-y-5">
      <Section title="Background">
        <ThemesPanel />
      </Section>
      <Divider />
      <Section title="Theme Presets">
        <ThemePresetsPanel />
      </Section>
    </div>
  )
}
