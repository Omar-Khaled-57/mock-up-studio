import { useCallback, useRef, useMemo } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useTheme } from '../../hooks/useTheme'
import type { Background } from '@shared/types'
import { BACKGROUND_PRESETS, type BackgroundPresetName } from '../../lib/constants'
import { useDebouncedHistory } from '../../hooks/useDebouncedHistory'
import GradientEditor from '../shared/GradientEditor'
import type { GradientValue } from '../shared/GradientEditor'
import SliderInput from '../shared/SliderInput'
import ColorInput from '../shared/ColorInput'

const BG_TYPES: { value: Background['type']; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'image', label: 'Image' },
  { value: 'preset', label: 'Preset' }
]

function bgToGradientValue(bg: Background): GradientValue {
  return {
    type: 'linear',
    stops: (bg.gradient?.colors ?? ['#1e1b4b', '#312e81']).map((color, i, arr) => ({
      color,
      position: arr.length === 1 ? 50 : Math.round((i / (arr.length - 1)) * 100),
      opacity: 100
    })),
    angle: bg.gradient?.angle ?? 135,
    radialShape: 'circle'
  }
}

function gradientValueToBg(g: GradientValue): { colors: string[]; angle: number } {
  const sorted = [...g.stops].sort((a, b) => a.position - b.position)
  return {
    colors: sorted.map((s) => s.color),
    angle: g.angle
  }
}

export default function ThemesPanel() {
  const { isLight, clsx } = useTheme()
  const scene = useStore(safeScene)
  const updateBackground = useStore((s) => s.updateBackground)
  const pushHistory = useStore((s) => s.pushHistory)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bg = scene.background

  const pushHistoryDebounced = useDebouncedHistory()

  const gradientValue = useMemo(() => bgToGradientValue(bg), [bg])

  const setType = useCallback(
    (type: Background['type']) => {
      updateBackground({ type })
      pushHistory(`Background: ${type}`)
    },
    [updateBackground, pushHistory]
  )

  const setSolidColor = useCallback(
    (color: string) => {
      updateBackground({ color })
      pushHistoryDebounced('Background color')
    },
    [updateBackground, pushHistoryDebounced]
  )

  const setGradient = useCallback(
    (g: GradientValue) => {
      const { colors, angle } = gradientValueToBg(g)
      updateBackground({ gradient: { colors, angle } })
      pushHistoryDebounced('Gradient')
    },
    [updateBackground, pushHistoryDebounced]
  )

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const src = reader.result as string
        updateBackground({
          type: 'image',
          image: { src, blur: 0, dim: 0, overlayColor: '#000000' }
        })
        pushHistory('Upload background image')
      }
      reader.readAsDataURL(file)
      e.target.value = ''
    },
    [updateBackground, pushHistory]
  )

  const setImageBlur = useCallback(
    (blur: number) => {
      if (!bg.image) return
      updateBackground({ image: { ...bg.image, blur } })
      pushHistoryDebounced('Background blur')
    },
    [bg.image, updateBackground, pushHistoryDebounced]
  )

  const setImageDim = useCallback(
    (dim: number) => {
      if (!bg.image) return
      updateBackground({ image: { ...bg.image, dim } })
      pushHistoryDebounced('Background dim')
    },
    [bg.image, updateBackground, pushHistoryDebounced]
  )

  const setImageOverlayColor = useCallback(
    (overlayColor: string) => {
      if (!bg.image) return
      updateBackground({ image: { ...bg.image, overlayColor } })
      pushHistoryDebounced('Background tint')
    },
    [bg.image, updateBackground, pushHistoryDebounced]
  )

  const selectPreset = useCallback(
    (presetName: BackgroundPresetName) => {
      updateBackground({ type: 'preset', presetName })
      pushHistory(`Background preset: ${presetName}`)
    },
    [updateBackground, pushHistory]
  )

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Type Selector */}
      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", isLight ? "text-zinc-600" : "text-zinc-400")}>Background Type</h3>
        <div className="grid grid-cols-2 gap-1">
          {BG_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`px-2 py-1.5 text-xs rounded-lg transition-all duration-150 ${
                bg.type === t.value ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : clsx(isLight ? 'bg-zinc-100 text-zinc-600 border border-transparent hover:bg-zinc-200' : 'bg-zinc-800/60 text-zinc-400 border border-transparent hover:bg-zinc-700/80')
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Solid Controls */}
      {bg.type === 'solid' && (
        <div>
          <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", isLight ? "text-zinc-600" : "text-zinc-400")}>Color</h3>
          <ColorInput label="" value={bg.color ?? '#18181b'} onChange={setSolidColor} />
        </div>
      )}

      {/* Gradient Controls — Advanced Gradient Editor */}
      {bg.type === 'gradient' && (
        <GradientEditor value={gradientValue} onChange={setGradient} />
      )}

      {/* Image Controls */}
      {bg.type === 'image' && (
        <div className="space-y-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className={clsx("w-full px-3 py-2 text-xs rounded border transition-colors", isLight ? "bg-zinc-100 text-zinc-700 border-zinc-300 hover:bg-zinc-200" : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700")}
          >
            {bg.image?.src ? 'Replace Image' : 'Upload Image'}
          </button>

          {bg.image?.src && (
            <>
              <div className={clsx("w-full h-16 rounded border overflow-hidden", isLight ? "border-zinc-200" : "border-zinc-800")}>
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${bg.image.src})`,
                    filter: `blur(${bg.image.blur}px)`
                  }}
                />
              </div>

              <SliderInput
                label="Blur"
                value={bg.image.blur}
                min={0}
                max={20}
                unit="px"
                onChange={setImageBlur}
              />
              <SliderInput
                label="Dim"
                value={bg.image.dim}
                min={0}
                max={100}
                unit="%"
                onChange={setImageDim}
              />
              <ColorInput
                label="Tint"
                value={bg.image.overlayColor}
                onChange={setImageOverlayColor}
              />
            </>
          )}
        </div>
      )}

      {/* Preset Gallery */}
      {bg.type === 'preset' && (
        <div className="space-y-3">
          <div>
            <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", isLight ? "text-zinc-600" : "text-zinc-400")}>Animated</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {BACKGROUND_PRESETS.filter((p) => p.category === 'animated').map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => selectPreset(preset.name)}
                  className={clsx("group relative rounded overflow-hidden border transition-colors", bg.presetName === preset.name ? 'border-indigo-500 ring-1 ring-indigo-500' : isLight ? 'border-zinc-200 hover:border-zinc-400' : 'border-zinc-800 hover:border-zinc-600')}
                >
                  <div
                    className="w-full h-14"
                    style={{ background: preset.thumbnail }}
                  />
                  <span className={clsx("block text-[10px] py-1 px-1.5 text-left", isLight ? "text-zinc-600 group-hover:text-zinc-900" : "text-zinc-400 group-hover:text-zinc-200")}>
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", isLight ? "text-zinc-600" : "text-zinc-400")}>Static</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {BACKGROUND_PRESETS.filter((p) => p.category === 'static').map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => selectPreset(preset.name)}
                  className={clsx("group relative rounded overflow-hidden border transition-colors", bg.presetName === preset.name ? 'border-indigo-500 ring-1 ring-indigo-500' : isLight ? 'border-zinc-200 hover:border-zinc-400' : 'border-zinc-800 hover:border-zinc-600')}
                >
                  <div
                    className="w-full h-14"
                    style={{ background: preset.thumbnail }}
                  />
                  <span className={clsx("block text-[10px] py-1 px-1.5 text-left", isLight ? "text-zinc-600 group-hover:text-zinc-900" : "text-zinc-400 group-hover:text-zinc-200")}>
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
