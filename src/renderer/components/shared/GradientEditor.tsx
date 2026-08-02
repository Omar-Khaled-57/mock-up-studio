import { useState, useCallback, useMemo } from 'react'
import { useTheme } from '../../hooks/useTheme'
import { Trash2 } from 'lucide-react'
import SliderInput from '../shared/SliderInput'

export interface GradientStop {
  color: string
  position: number
}

export interface GradientValue {
  type: 'linear' | 'radial' | 'conic'
  stops: GradientStop[]
  angle: number
  radialShape: 'circle' | 'ellipse'
}

interface Props {
  value: GradientValue
  onChange: (gradient: GradientValue) => void
  presets?: GradientPreset[]
  className?: string
}

export interface GradientPreset {
  name: string
  label: string
  gradient: GradientValue
}

const DEFAULT_PRESETS: GradientPreset[] = [
  { name: 'sunset', label: 'Sunset', gradient: { type: 'linear', angle: 135, stops: [{ color: '#ff6b6b', position: 0 }, { color: '#feca57', position: 50 }, { color: '#ff9ff3', position: 100 }], radialShape: 'circle' } },
  { name: 'ocean', label: 'Ocean', gradient: { type: 'linear', angle: 180, stops: [{ color: '#0c2461', position: 0 }, { color: '#0a3d62', position: 50 }, { color: '#3dc1d3', position: 100 }], radialShape: 'circle' } },
  { name: 'forest', label: 'Forest', gradient: { type: 'linear', angle: 135, stops: [{ color: '#0d3b0d', position: 0 }, { color: '#1e7b1e', position: 50 }, { color: '#5cb85c', position: 100 }], radialShape: 'circle' } },
  { name: 'neon', label: 'Neon', gradient: { type: 'linear', angle: 90, stops: [{ color: '#ff00ff', position: 0 }, { color: '#00ffff', position: 100 }], radialShape: 'circle' } },
  { name: 'fire', label: 'Fire', gradient: { type: 'linear', angle: 0, stops: [{ color: '#1a0000', position: 0 }, { color: '#cc0000', position: 40 }, { color: '#ff6600', position: 70 }, { color: '#ffcc00', position: 100 }], radialShape: 'circle' } },
  { name: 'aurora', label: 'Aurora', gradient: { type: 'linear', angle: 135, stops: [{ color: '#0b1628', position: 0 }, { color: '#1a0533', position: 33 }, { color: '#0f3460', position: 66 }, { color: '#16213e', position: 100 }], radialShape: 'circle' } },
  { name: 'peach', label: 'Peach', gradient: { type: 'linear', angle: 135, stops: [{ color: '#ffecd2', position: 0 }, { color: '#fcb69f', position: 100 }], radialShape: 'circle' } },
  { name: 'midnight', label: 'Midnight', gradient: { type: 'linear', angle: 180, stops: [{ color: '#232526', position: 0 }, { color: '#414345', position: 100 }], radialShape: 'circle' } },
  { name: 'royal', label: 'Royal', gradient: { type: 'linear', angle: 135, stops: [{ color: '#1e1b4b', position: 0 }, { color: '#312e81', position: 50 }, { color: '#4338ca', position: 100 }], radialShape: 'circle' } },
  { name: 'candy', label: 'Candy', gradient: { type: 'radial', angle: 0, stops: [{ color: '#fa709a', position: 0 }, { color: '#fee140', position: 100 }], radialShape: 'circle' } },
  { name: 'steel', label: 'Steel', gradient: { type: 'linear', angle: 90, stops: [{ color: '#434343', position: 0 }, { color: '#000000', position: 100 }], radialShape: 'circle' } },
  { name: 'cosmic', label: 'Cosmic', gradient: { type: 'conic', angle: 0, stops: [{ color: '#ff00cc', position: 0 }, { color: '#3333cc', position: 50 }, { color: '#ff00cc', position: 100 }], radialShape: 'circle' } }
]

function buildCSSGradient(g: GradientValue): string {
  const stops = g.stops
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(', ')

  switch (g.type) {
    case 'linear':
      return `linear-gradient(${g.angle}deg, ${stops})`
    case 'radial':
      return `radial-gradient(${g.radialShape}, ${stops})`
    case 'conic':
      return `conic-gradient(from ${g.angle}deg, ${stops})`
    default:
      return `linear-gradient(${g.angle}deg, ${stops})`
  }
}

function generateRandomGradient(): GradientValue {
  const randomColor = () => '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
  const numStops = 2 + Math.floor(Math.random() * 3)
  const stops: GradientStop[] = []
  for (let i = 0; i < numStops; i++) {
    stops.push({
      color: randomColor(),
      position: numStops === 1 ? 50 : Math.round((i / (numStops - 1)) * 100)
    })
  }
  return {
    type: 'linear',
    angle: Math.round(Math.random() * 360),
    stops,
    radialShape: 'circle'
  }
}

export default function GradientEditor({ value, onChange, presets = DEFAULT_PRESETS, className = '' }: Props) {
  const { isLight, clsx, bg, text } = useTheme()
  const [showPresets, setShowPresets] = useState(false)

  const previewStyle = useMemo(() => ({ background: buildCSSGradient(value) }), [value])

  const updateStop = useCallback(
    (index: number, patch: Partial<GradientStop>) => {
      const stops = [...value.stops]
      stops[index] = { ...stops[index], ...patch }
      onChange({ ...value, stops })
    },
    [value, onChange]
  )

  const addStop = useCallback(() => {
    const stops = [...value.stops]
    const lastPos = stops[stops.length - 1]?.position ?? 100
    const newPos = Math.min(100, lastPos + 10)
    stops.push({ color: '#808080', position: newPos })
    onChange({ ...value, stops })
  }, [value, onChange])

  const removeStop = useCallback(
    (index: number) => {
      if (value.stops.length <= 2) return
      const stops = value.stops.filter((_, i) => i !== index)
      onChange({ ...value, stops })
    },
    [value, onChange]
  )

  const applyPreset = useCallback(
    (preset: GradientPreset) => {
      onChange({ ...preset.gradient })
      setShowPresets(false)
    },
    [onChange]
  )

  const handleRandomize = useCallback(() => {
    onChange(generateRandomGradient())
  }, [onChange])

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Preview */}
      <div className={clsx("w-full h-8 rounded border", "border-zinc-700")} style={previewStyle} />

      {/* Type selector */}
      <div>
        <label className={clsx("text-[10px] mb-1 block", text.secondary)}>Type</label>
        <div className="flex gap-1">
          {(['linear', 'radial', 'conic'] as const).map((type) => (
            <button
              key={type}
              onClick={() => onChange({ ...value, type })}
              className={clsx(
                "flex-1 px-2 py-1 text-[10px] rounded transition-colors",
                value.type === type ? bg.selected : bg.button
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Angle control */}
      {(value.type === 'linear' || value.type === 'conic') && (
        <SliderInput label="Angle" value={value.angle} min={0} max={360} unit="°" onChange={(v) => onChange({ ...value, angle: v })} />
      )}

      {/* Radial shape */}
      {value.type === 'radial' && (
        <div>
          <label className={clsx("text-[10px] mb-1 block", text.secondary)}>Shape</label>
          <div className="flex gap-1">
            {(['circle', 'ellipse'] as const).map((shape) => (
              <button
                key={shape}
                onClick={() => onChange({ ...value, radialShape: shape })}
                className={clsx(
                  "flex-1 px-2 py-1 text-[10px] rounded transition-colors",
                  value.radialShape === shape ? bg.selected : bg.button
                )}
              >
                {shape}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color stops */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={clsx("text-[10px]", text.secondary)}>Colors ({value.stops.length})</label>
          <div className="flex gap-1.5">
            <button onClick={handleRandomize} className={clsx("text-[10px]", text.muted, isLight ? "hover:text-zinc-900" : "hover:text-zinc-300")} title="Randomize">
              Random
            </button>
            <button onClick={addStop} className={clsx("text-[10px]", isLight ? "text-indigo-600 hover:text-indigo-700" : "text-indigo-400 hover:text-indigo-300")}>+ Add</button>
          </div>
        </div>

        <div className="space-y-1.5">
          {value.stops.map((stop, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <input
                type="color"
                value={stop.color}
                onChange={(e) => updateStop(idx, { color: e.target.value })}
                className={clsx("w-6 h-6 rounded border cursor-pointer bg-transparent shrink-0", "border-zinc-700")}
              />
              <input
                type="text"
                value={stop.color}
                onChange={(e) => updateStop(idx, { color: e.target.value })}
                className={clsx("w-16 px-1.5 py-0.5 text-[10px] font-mono rounded outline-none", bg.input)}
              />
              <input
                type="number"
                min={0}
                max={100}
                value={stop.position}
                onChange={(e) => updateStop(idx, { position: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)) })}
                className={clsx("w-12 px-1 py-0.5 text-[10px] rounded outline-none text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none", bg.input)}
              />
              <span className={clsx("text-[9px]", text.muted)}>%</span>
              {value.stops.length > 2 && (
                <button
                  onClick={() => removeStop(idx)}
                  className={clsx("p-1 rounded transition-colors", text.muted, isLight ? "hover:text-red-600 hover:bg-red-100" : "hover:text-red-400 hover:bg-red-900/20")}
                  title="Delete color"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div>
        <button
          onClick={() => setShowPresets(!showPresets)}
          className={clsx("text-[10px]", "text-indigo-500 hover:text-indigo-400")}
        >
          {showPresets ? 'Hide presets' : 'Show presets'}
        </button>
        {showPresets && (
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {presets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className={clsx("group relative rounded overflow-hidden border transition-colors", bg.button)}
                title={preset.label}
              >
                <div className="w-full h-8" style={{ background: buildCSSGradient(preset.gradient) }} />
                <span className={clsx("block text-[8px] py-0.5 text-center", text.muted)}>
                  {preset.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export { buildCSSGradient, DEFAULT_PRESETS }
