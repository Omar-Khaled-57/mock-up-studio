import { useCallback } from 'react'
import { useTheme } from '../../hooks/useTheme'
import type { ShadowLayer } from '@shared/types'
import ColorInput from '../shared/ColorInput'
import SliderInput from '../shared/SliderInput'
import ToggleSwitch from '../shared/ToggleSwitch'

interface Props {
  value: ShadowLayer[]
  onChange: (shadows: ShadowLayer[]) => void
  className?: string
}

// eslint-disable-next-line react-refresh/only-export-components
export const SHADOW_PRESETS: { name: string; shadows: ShadowLayer[] }[] = [
  {
    name: 'Soft',
    shadows: [{ enabled: true, color: '#000000', offsetX: 0, offsetY: 4, blur: 12, spread: 0, opacity: 25, inset: false }]
  },
  {
    name: 'Hard',
    shadows: [{ enabled: true, color: '#000000', offsetX: 4, offsetY: 4, blur: 0, spread: 0, opacity: 50, inset: false }]
  },
  {
    name: 'Depth',
    shadows: [
      { enabled: true, color: '#000000', offsetX: 0, offsetY: 2, blur: 4, spread: 0, opacity: 30, inset: false },
      { enabled: true, color: '#000000', offsetX: 0, offsetY: 8, blur: 24, spread: 0, opacity: 20, inset: false }
    ]
  },
  {
    name: 'Neon',
    shadows: [{ enabled: true, color: '#6366f1', offsetX: 0, offsetY: 0, blur: 20, spread: 4, opacity: 60, inset: false }]
  },
  {
    name: 'Inset',
    shadows: [{ enabled: true, color: '#000000', offsetX: 0, offsetY: 2, blur: 4, spread: 0, opacity: 30, inset: true }]
  }
]

const DEFAULT_SHADOW: ShadowLayer = { enabled: true, color: '#000000', offsetX: 0, offsetY: 4, blur: 8, spread: 0, opacity: 25, inset: false }

export default function ShadowEditor({ value, onChange, className = '' }: Props) {
  const { isLight, clsx } = useTheme()
  const updateLayer = useCallback(
    (index: number, patch: Partial<ShadowLayer>) => {
      const layers = [...value]
      layers[index] = { ...layers[index], ...patch }
      onChange(layers)
    },
    [value, onChange]
  )

  const addLayer = useCallback(() => {
    onChange([...value, { ...DEFAULT_SHADOW }])
  }, [value, onChange])

  const removeLayer = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index))
    },
    [value, onChange]
  )

  const applyPreset = useCallback(
    (preset: typeof SHADOW_PRESETS[number]) => {
      onChange(preset.shadows)
    },
    [onChange]
  )

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Presets */}
      <div className="flex flex-wrap gap-1">
        {SHADOW_PRESETS.map((preset) => (
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
            <ToggleSwitch label={`Shadow ${idx + 1}`} checked={layer.enabled} onChange={(v) => updateLayer(idx, { enabled: v })} />
            {value.length > 1 && (
              <button onClick={() => removeLayer(idx)} className={clsx("text-[10px]", isLight ? "text-zinc-400 hover:text-red-600" : "text-zinc-600 hover:text-red-400")}>Remove</button>
            )}
          </div>
          {layer.enabled && (
            <>
              <ColorInput label="Color" value={layer.color} onChange={(c) => updateLayer(idx, { color: c })} />
              <SliderInput label="X" value={layer.offsetX} min={-50} max={50} unit="px" onChange={(v) => updateLayer(idx, { offsetX: v })} />
              <SliderInput label="Y" value={layer.offsetY} min={-50} max={50} unit="px" onChange={(v) => updateLayer(idx, { offsetY: v })} />
              <SliderInput label="Blur" value={layer.blur} min={0} max={100} unit="px" onChange={(v) => updateLayer(idx, { blur: v })} />
              <SliderInput label="Spread" value={layer.spread} min={-50} max={50} unit="px" onChange={(v) => updateLayer(idx, { spread: v })} />
              <SliderInput label="Alpha" value={layer.opacity} min={0} max={100} unit="%" onChange={(v) => updateLayer(idx, { opacity: v })} />
              <ToggleSwitch label="Inset" checked={layer.inset} onChange={(v) => updateLayer(idx, { inset: v })} />
            </>
          )}
        </div>
      ))}

      <button onClick={addLayer} className={clsx("text-[10px]", isLight ? "text-indigo-600 hover:text-indigo-500" : "text-indigo-400 hover:text-indigo-300")}>+ Add Shadow Layer</button>
    </div>
  )
}
