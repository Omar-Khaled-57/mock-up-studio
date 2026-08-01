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
    type: bg.gradient?.type ?? 'linear',
    stops: (bg.gradient?.colors ?? ['#1e1b4b', '#312e81']).map((color, i, arr) => ({
      color,
      position: arr.length === 1 ? 50 : Math.round((i / (arr.length - 1)) * 100),
      opacity: 100
    })),
    angle: bg.gradient?.angle ?? 135,
    radialShape: bg.gradient?.radialShape ?? 'circle'
  }
}

function gradientValueToBg(g: GradientValue): { colors: string[]; angle: number; type?: string; radialShape?: string } {
  const sorted = [...g.stops].sort((a, b) => a.position - b.position)
  return {
    colors: sorted.map((s) => s.color),
    angle: g.angle,
    type: g.type,
    radialShape: g.radialShape
  }
}

export default function ThemesPanel() {
  const { isLight, clsx, bg: themeBg, text } = useTheme()
  const scene = useStore(safeScene)
  const updateBackground = useStore((s) => s.updateBackground)
  const pushHistory = useStore((s) => s.pushHistory)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currBg = scene.background

  const pushHistoryDebounced = useDebouncedHistory()

  const gradientValue = useMemo(() => bgToGradientValue(currBg), [currBg])

  const setType = useCallback(
    (type: Background['type']) => {
      pushHistory(`Background: ${type}`)
      updateBackground({ type })
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
      const { colors, angle, type, radialShape } = gradientValueToBg(g)
      updateBackground({ gradient: { colors, angle, type: type as 'linear' | 'radial' | 'conic' | undefined, radialShape: radialShape as 'circle' | 'ellipse' | undefined } })
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
        pushHistory('Upload background image')
        updateBackground({
          type: 'image',
          image: { src, blur: 0, dim: 0, overlayColor: '#000000' }
        })
      }
      reader.readAsDataURL(file)
      e.target.value = ''
    },
    [updateBackground, pushHistory]
  )

  const setImageBlur = useCallback(
    (blur: number) => {
      if (!currBg.image) return
      updateBackground({ image: { ...currBg.image, blur } })
      pushHistoryDebounced('Background blur')
    },
    [currBg.image, updateBackground, pushHistoryDebounced]
  )

  const setImageDim = useCallback(
    (dim: number) => {
      if (!currBg.image) return
      updateBackground({ image: { ...currBg.image, dim } })
      pushHistoryDebounced('Background dim')
    },
    [currBg.image, updateBackground, pushHistoryDebounced]
  )

  const setImageOverlayColor = useCallback(
    (overlayColor: string) => {
      if (!currBg.image) return
      updateBackground({ image: { ...currBg.image, overlayColor } })
      pushHistoryDebounced('Background tint')
    },
    [currBg.image, updateBackground, pushHistoryDebounced]
  )

  const selectPreset = useCallback(
    (presetName: BackgroundPresetName) => {
      pushHistory(`Background preset: ${presetName}`)
      updateBackground({ type: 'preset', presetName })
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
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Background Type</h3>
        <div className="grid grid-cols-2 gap-1">
          {BG_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={clsx(
                "px-2 py-1.5 text-xs rounded-lg transition-all duration-150",
                currBg.type === t.value ? themeBg.selected : themeBg.button
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Solid Controls */}
      {currBg.type === 'solid' && (
        <div>
          <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Color</h3>
          <ColorInput label="" value={currBg.color ?? '#18181b'} onChange={setSolidColor} />
        </div>
      )}

      {/* Gradient Controls — Advanced Gradient Editor */}
      {currBg.type === 'gradient' && (
        <GradientEditor value={gradientValue} onChange={setGradient} />
      )}

      {/* Image Controls */}
      {currBg.type === 'image' && (
        <div className="space-y-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className={clsx("w-full px-3 py-2 text-xs rounded transition-colors", themeBg.button)}
          >
            {currBg.image?.src ? 'Replace Image' : 'Upload Image'}
          </button>

          {currBg.image?.src && (
            <>
              <div className={clsx("w-full h-16 rounded border overflow-hidden", isLight ? "border-zinc-200" : "border-zinc-800")}>
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${currBg.image.src})`,
                    filter: `blur(${currBg.image.blur}px)`
                  }}
                />
              </div>

              <SliderInput
                label="Blur"
                value={currBg.image.blur}
                min={0}
                max={20}
                unit="px"
                onChange={setImageBlur}
              />
              <SliderInput
                label="Dim"
                value={currBg.image.dim}
                min={0}
                max={100}
                unit="%"
                onChange={setImageDim}
              />
              <ColorInput
                label="Tint"
                value={currBg.image.overlayColor}
                onChange={setImageOverlayColor}
              />
            </>
          )}
        </div>
      )}

      {/* Preset Gallery */}
      {currBg.type === 'preset' && (
        <div className="space-y-3">
          <div>
            <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Animated</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {BACKGROUND_PRESETS.filter((p) => p.category === 'animated').map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => selectPreset(preset.name)}
                  className={clsx("group relative rounded overflow-hidden border transition-colors", currBg.presetName === preset.name ? 'border-indigo-500 ring-1 ring-indigo-500' : themeBg.button)}
                >
                  <div
                    className="w-full h-14"
                    style={{ background: preset.thumbnail }}
                  />
                  <span className={clsx("block text-[10px] py-1 px-1.5 text-left", text.tertiary, "group-hover:text-indigo-300")}>
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Static</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {BACKGROUND_PRESETS.filter((p) => p.category === 'static').map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => selectPreset(preset.name)}
                  className={clsx("group relative rounded overflow-hidden border transition-colors", currBg.presetName === preset.name ? 'border-indigo-500 ring-1 ring-indigo-500' : themeBg.button)}
                >
                  <div
                    className="w-full h-14"
                    style={{ background: preset.thumbnail }}
                  />
                  <span className={clsx("block text-[10px] py-1 px-1.5 text-left", text.tertiary, "group-hover:text-indigo-300")}>
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
