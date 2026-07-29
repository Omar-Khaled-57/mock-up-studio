import { useCallback } from 'react'
import { useTheme } from '../../hooks/useTheme'
import type { GlowLayer } from '@shared/types'
import ColorInput from '../shared/ColorInput'
import SliderInput from '../shared/SliderInput'
import ToggleSwitch from '../shared/ToggleSwitch'

interface Props {
  value: GlowLayer[]
  onChange: (glows: GlowLayer[]) => void
  className?: string
}

// eslint-disable-next-line react-refresh/only-export-components
export const GLOW_PRESETS: { name: string; glows: GlowLayer[] }[] = [
  {
    name: 'Subtle',
    glows: [{ enabled: true, color: '#6366f1', blur: 8, spread: 0, opacity: 40 }]
  },
  {
    name: 'Bright',
    glows: [{ enabled: true, color: '#6366f1', blur: 16, spread: 4, opacity: 60 }]
  },
  {
    name: 'Neon',
    glows: [{ enabled: true, color: '#ff00ff', blur: 20, spread: 8, opacity: 70 }]
  },
  {
    name: 'Dual',
    glows: [
      { enabled: true, color: '#6366f1', blur: 12, spread: 0, opacity: 50 },
      { enabled: true, color: '#ec4899', blur: 24, spread: 4, opacity: 30 }
    ]
  },
  {
    name: 'Warm',
    glows: [{ enabled: true, color: '#f59e0b', blur: 16, spread: 4, opacity: 50 }]
  }
]

const DEFAULT_GLOW: GlowLayer = { enabled: true, color: '#6366f1', blur: 12, spread: 0, opacity: 50 }

export default function GlowEditor({ value, onChange, className = '' }: Props) {
  const { isLight, clsx } = useTheme()
  const updateLayer = useCallback(
    (index: number, patch: Partial<GlowLayer>) => {
      const layers = [...value]
      layers[index] = { ...layers[index], ...patch }
      onChange(layers)
    },
    [value, onChange]
  )

  const addLayer = useCallback(() => {
    onChange([...value, { ...DEFAULT_GLOW }])
  }, [value, onChange])

  const removeLayer = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index))
    },
    [value, onChange]
  )

  const applyPreset = useCallback(
    (preset: typeof GLOW_PRESETS[number]) => {
      onChange(preset.glows)
    },
    [onChange]
  )

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Presets */}
      <div className="flex flex-wrap gap-1">
        {GLOW_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => applyPreset(preset)}
            className={clsx("px-1.5 py-0.5 text-[9px] rounded transition-colors", isLight ? "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-800" : "bg-zinc-800/60 text-zinc-400 rounded hover:bg-zinc-700/80 hover:text-zinc-300")}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Layers */}
      {value.map((layer, idx) => (
        <div key={idx} className={clsx("p-2 rounded border space-y-1.5", isLight ? "bg-zinc-50 border-zinc-200" : "bg-zinc-800/30 border-zinc-800/50")}>
          <div className="flex items-center justify-between">
            <ToggleSwitch label={`Glow ${idx + 1}`} checked={layer.enabled} onChange={(v) => updateLayer(idx, { enabled: v })} />
            {value.length > 1 && (
              <button onClick={() => removeLayer(idx)} className={clsx("text-[10px]", isLight ? "text-zinc-400 hover:text-red-600" : "text-zinc-600 hover:text-red-400")}>Remove</button>
            )}
          </div>
          {layer.enabled && (
            <>
              <ColorInput label="Color" value={layer.color} onChange={(c) => updateLayer(idx, { color: c })} />
              <SliderInput label="Blur" value={layer.blur} min={0} max={100} unit="px" onChange={(v) => updateLayer(idx, { blur: v })} />
              <SliderInput label="Spread" value={layer.spread} min={0} max={50} unit="px" onChange={(v) => updateLayer(idx, { spread: v })} />
              <SliderInput label="Alpha" value={layer.opacity} min={0} max={100} unit="%" onChange={(v) => updateLayer(idx, { opacity: v })} />
            </>
          )}
        </div>
      ))}

      <button onClick={addLayer} className={clsx("text-[10px]", isLight ? "text-indigo-600 hover:text-indigo-500" : "text-indigo-400 hover:text-indigo-300")}>+ Add Glow Layer</button>
    </div>
  )
}
