import { useCallback } from 'react'
import { useStore } from '../../store'
import { useTheme } from '../../hooks/useTheme'
import { THEME_PRESETS } from '../../lib/constants'

export default function ThemePresetsPanel() {
  const { isLight, clsx } = useTheme()
  const applyThemePreset = useStore((s) => s.applyThemePreset)
  const pushHistory = useStore((s) => s.pushHistory)

  const handleApply = useCallback(
    (presetId: string) => {
      const preset = THEME_PRESETS.find((p) => p.id === presetId)
      if (!preset) return
      applyThemePreset(preset)
      pushHistory(`Theme: ${preset.name}`)
    },
    [applyThemePreset, pushHistory]
  )

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5">
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handleApply(preset.id)}
            className={clsx("group rounded overflow-hidden border transition-colors text-left", isLight ? "border-zinc-200 hover:border-zinc-400" : "border-zinc-800 hover:border-zinc-600")}
            title={preset.description}
          >
            <div className="w-full h-14 flex items-end p-1.5" style={{
              background: preset.background.type === 'solid'
                ? preset.background.color
                : preset.background.type === 'gradient'
                  ? `linear-gradient(${preset.background.angle ?? 135}deg, ${(preset.background.colors ?? ['#000', '#fff']).join(', ')})`
                  : undefined,
              backgroundColor: preset.background.type === 'preset' ? '#0a0a0a' : undefined
            }}>
              <span
                className="text-[9px] font-semibold px-1 rounded"
                style={{ color: preset.titleColor, backgroundColor: `${preset.accentColor}40` }}
              >
                Aa
              </span>
            </div>
            <div className="px-1.5 py-1">
              <span className={clsx("block text-[10px]", isLight ? "text-zinc-600 group-hover:text-zinc-900" : "text-zinc-400 group-hover:text-zinc-200")}>{preset.name}</span>
              <span className={clsx("text-[8px]", isLight ? "text-zinc-400" : "text-zinc-600")}>{preset.description}</span>
            </div>
            <div className="flex gap-0.5 px-1.5 pb-1.5">
              {[preset.titleColor, preset.sloganColor, preset.accentColor].map((c, i) => (
                <div key={i} className={clsx("w-3 h-3 rounded-full border", isLight ? "border-zinc-300" : "border-zinc-700")} style={{ backgroundColor: c }} />
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}