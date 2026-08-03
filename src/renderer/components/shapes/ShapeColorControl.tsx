import { useCallback, useMemo } from 'react'
import { useTheme } from '../../hooks/useTheme'
import type { Shape } from '@shared/types'
import ColorInput from '../shared/ColorInput'
import GradientEditor from '../shared/GradientEditor'
import type { GradientValue } from '../shared/GradientEditor'

interface Props {
  shape: Shape
  onChange: (patch: Partial<Shape>) => void
}

/** Default gradient used when a shape has never had one configured. */
const DEFAULT_GRADIENT_STOPS = (color: string): string[] => [color, '#1e1b4b']

function shapeToGradientValue(shape: Shape): GradientValue {
  const colors = shape.gradient?.colors ?? DEFAULT_GRADIENT_STOPS(shape.color)
  const stops = colors.map((color, i, arr) => ({
    color,
    position: arr.length === 1 ? 50 : Math.round((i / (arr.length - 1)) * 100)
  }))
  return {
    type: shape.gradient?.type ?? 'linear',
    stops,
    angle: shape.gradient?.angle ?? 135,
    radialShape: shape.gradient?.radialShape ?? 'circle'
  }
}

function gradientValueToPatch(g: GradientValue): Partial<Shape> {
  const sorted = [...g.stops].sort((a, b) => a.position - b.position)
  return {
    gradient: {
      enabled: true,
      colors: sorted.map((s) => s.color),
      angle: g.angle,
      type: g.type,
      radialShape: g.radialShape
    }
  }
}

export default function ShapeColorControl({ shape, onChange }: Props) {
  const { clsx, bg, text } = useTheme()
  const gradientMode = !!shape.gradient?.enabled
  const gradientValue = useMemo(() => shapeToGradientValue(shape), [shape])

  const setMode = useCallback(
    (mode: 'solid' | 'gradient') => {
      if (mode === 'gradient') {
        onChange(gradientValueToPatch(shapeToGradientValue(shape)))
        return
      }
      // Keep the gradient config so switching back restores it; `enabled: false`
      // makes the renderer/rasterizer fall back to the solid color.
      const g = shape.gradient
      onChange({
        gradient: {
          enabled: false,
          colors: g?.colors ?? DEFAULT_GRADIENT_STOPS(shape.color),
          angle: g?.angle ?? 135,
          type: g?.type,
          radialShape: g?.radialShape
        }
      })
    },
    [shape, onChange]
  )

  const setSolidColor = useCallback((color: string) => onChange({ color }), [onChange])

  const setGradient = useCallback((g: GradientValue) => onChange(gradientValueToPatch(g)), [onChange])

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {(['solid', 'gradient'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setMode(mode)}
            aria-pressed={mode === 'gradient' ? gradientMode : !gradientMode}
            className={clsx(
              "flex-1 px-2 py-1 text-[10px] rounded transition-colors capitalize",
              (mode === 'gradient' ? gradientMode : !gradientMode) ? bg.selected : bg.button
            )}
          >
            {mode}
          </button>
        ))}
      </div>
      {gradientMode ? (
        <GradientEditor value={gradientValue} onChange={setGradient} />
      ) : (
        <div>
          <span className={clsx("block text-[11px] mb-1", text.secondary)}>Color</span>
          <ColorInput label="" value={shape.color} onChange={setSolidColor} />
        </div>
      )}
    </div>
  )
}
