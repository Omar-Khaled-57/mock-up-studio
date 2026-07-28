import { useState, useCallback, useMemo } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useDebouncedHistory } from '../../hooks/useDebouncedHistory'
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react'

const FONT_FAMILIES = [
  'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins', 'Lato',
  'Raleway', 'Oswald', 'Playfair Display', 'Merriweather',
  'Source Code Pro', 'Fira Code', 'JetBrains Mono'
]

const FONT_WEIGHTS = [
  { label: 'Light', value: 300 },
  { label: 'Regular', value: 400 },
  { label: 'Medium', value: 500 },
  { label: 'Semi Bold', value: 600 },
  { label: 'Bold', value: 700 },
  { label: 'Extra Bold', value: 800 },
  { label: 'Black', value: 900 }
]

type Target = 'title' | 'slogan' | null

export default function TextPanel() {
  const titleText = useStore((s) => safeScene(s).titleText)
  const sloganText = useStore((s) => safeScene(s).sloganText)
  const updateTitleText = useStore((s) => s.updateTitleText)
  const updateSloganText = useStore((s) => s.updateSloganText)
  const selectedIds = useStore((s) => s.selectedIds)

  const scene = useStore(safeScene)

  const selectedTextBox = useMemo(() => {
    if (selectedIds.length !== 1) return null
    return scene.textBoxes.find((t) => t.id === selectedIds[0]) ?? null
  }, [selectedIds, scene.textBoxes])

  const updateTextBox = useStore((s) => s.updateTextBox)
  const pushHistoryDebounced = useDebouncedHistory()

  const [activeTarget, setActiveTarget] = useState<Target>('title')

  const activeStyle = useMemo(() => {
    if (activeTarget === 'title') return titleText
    if (activeTarget === 'slogan') return sloganText
    if (selectedTextBox) {
      return {
        fontSize: selectedTextBox.fontSize,
        fontFamily: selectedTextBox.fontFamily,
        fontWeight: selectedTextBox.fontWeight,
        color: selectedTextBox.color,
        textAlign: selectedTextBox.textAlign,
        lineHeight: selectedTextBox.lineHeight,
        letterSpacing: selectedTextBox.letterSpacing,
        gradient: selectedTextBox.gradient,
        glow: selectedTextBox.glow,
        shadow: selectedTextBox.shadow
      }
    }
    return titleText
  }, [activeTarget, titleText, sloganText, selectedTextBox])

  const patch = useCallback(
    (field: string, value: unknown) => {
      if (activeTarget === 'title') {
        updateTitleText({ [field]: value })
      } else if (activeTarget === 'slogan') {
        updateSloganText({ [field]: value })
      } else if (selectedTextBox) {
        updateTextBox(selectedTextBox.id, { [field]: value })
      }
      pushHistoryDebounced(`Text ${field}`)
    },
    [activeTarget, selectedTextBox, updateTitleText, updateSloganText, updateTextBox, pushHistoryDebounced]
  )

  const patchNested = useCallback(
    (field: 'gradient' | 'glow' | 'shadow', subField: string, value: unknown) => {
      const current = activeStyle[field]
      const updated = { ...current, [subField]: value }
      if (activeTarget === 'title') {
        updateTitleText({ [field]: updated })
      } else if (activeTarget === 'slogan') {
        updateSloganText({ [field]: updated })
      } else if (selectedTextBox) {
        updateTextBox(selectedTextBox.id, { [field]: updated })
      }
      pushHistoryDebounced(`Text ${field}.${subField}`)
    },
    [activeTarget, activeStyle, selectedTextBox, updateTitleText, updateSloganText, updateTextBox, pushHistoryDebounced]
  )

  const enableGradient = useCallback(() => {
    const g = activeStyle.gradient?.enabled
      ? activeStyle.gradient
      : { enabled: true, color1: '#ffffff', color2: '#a855f7', angle: 135 }
    patch('gradient', { ...g, enabled: !g.enabled })
  }, [activeStyle.gradient, patch])

  const enableGlow = useCallback(() => {
    const g = activeStyle.glow?.enabled
      ? activeStyle.glow
      : { enabled: true, color: '#818cf8', blur: 20 }
    patch('glow', { ...g, enabled: !g.enabled })
  }, [activeStyle.glow, patch])

  const enableShadow = useCallback(() => {
    const s = activeStyle.shadow?.enabled
      ? activeStyle.shadow
      : { enabled: true, color: '#00000080', offsetX: 2, offsetY: 4, blur: 8 }
    patch('shadow', { ...s, enabled: !s.enabled })
  }, [activeStyle.shadow, patch])

  const targetButtons: { id: Target; label: string }[] = [
    { id: 'title', label: 'Title' },
    { id: 'slogan', label: 'Slogan' },
    ...(selectedTextBox ? [{ id: null, label: `Text: ${selectedTextBox.content.slice(0, 12) || 'Empty'}` } as const] : [])
  ]

  const ALIGN_ICONS = {
    left: AlignLeft,
    center: AlignCenter,
    right: AlignRight
  } as const

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Edit Target</h3>
        <div className="flex gap-1">
          {targetButtons.map((btn) => (
            <button
              key={btn.label}
              onClick={() => setActiveTarget(btn.id)}
              className={`flex-1 px-2 py-1.5 text-xs rounded-lg transition-all duration-150 ${
                activeTarget === btn.id
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'bg-zinc-800/60 text-zinc-400 border border-transparent hover:bg-zinc-700/80'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Font</h3>
        <select
          value={activeStyle.fontFamily}
          onChange={(e) => patch('fontFamily', e.target.value)}
          className="w-full px-2 py-1.5 text-sm bg-zinc-800 text-zinc-200 rounded border border-zinc-700 focus:border-indigo-500 outline-none"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <div className="mt-2">
          <label className="text-[10px] text-zinc-500 mb-1 block">Weight: {activeStyle.fontWeight}</label>
          <input
            type="range"
            min={300}
            max={900}
            step={100}
            value={activeStyle.fontWeight}
            onChange={(e) => patch('fontWeight', parseInt(e.target.value, 10))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-[9px] text-zinc-600">
            {FONT_WEIGHTS.map((w) => (
              <span key={w.value}>{w.label.split(' ')[0]}</span>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Size & Spacing</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-zinc-500 mb-0.5 block">Size</label>
            <input
              type="number"
              min={8}
              max={400}
              value={activeStyle.fontSize}
              onChange={(e) => patch('fontSize', parseInt(e.target.value, 10) || 16)}
              className="w-full px-2 py-1.5 text-sm bg-zinc-800/60 text-zinc-200 rounded-lg border border-zinc-700/50 focus:border-indigo-500/50 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 mb-0.5 block">Align</label>
            <div className="flex gap-0.5">
              {(['left', 'center', 'right'] as const).map((align) => {
                const Icon = ALIGN_ICONS[align]
                return (
                  <button
                    key={align}
                    onClick={() => patch('textAlign', align)}
                    className={`flex-1 flex items-center justify-center py-1.5 rounded-lg transition-all duration-150 ${
                      activeStyle.textAlign === align
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-zinc-800/60 text-zinc-400 border border-transparent hover:bg-zinc-700/80'
                    }`}
                  >
                    <Icon size={14} strokeWidth={1.5} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Color</h3>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={activeStyle.color}
            onChange={(e) => patch('color', e.target.value)}
            className="w-8 h-8 rounded border border-zinc-700 cursor-pointer bg-transparent"
          />
          <input
            value={activeStyle.color}
            onChange={(e) => patch('color', e.target.value)}
            className="flex-1 px-2 py-1 text-sm font-mono bg-zinc-800 text-zinc-200 rounded border border-zinc-700 focus:border-indigo-500 outline-none"
          />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Gradient</h3>
        <button
          onClick={enableGradient}
          className={`w-full px-2 py-1.5 text-xs rounded transition-colors mb-2 ${
            activeStyle.gradient?.enabled ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          {activeStyle.gradient?.enabled ? 'Gradient On' : 'Gradient Off'}
        </button>
        {activeStyle.gradient?.enabled && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={activeStyle.gradient.color1}
                onChange={(e) => patchNested('gradient', 'color1', e.target.value)}
                className="w-6 h-6 rounded border border-zinc-700 cursor-pointer bg-transparent"
              />
              <input
                type="color"
                value={activeStyle.gradient.color2}
                onChange={(e) => patchNested('gradient', 'color2', e.target.value)}
                className="w-6 h-6 rounded border border-zinc-700 cursor-pointer bg-transparent"
              />
              <span className="text-[10px] text-zinc-500">Angle</span>
              <input
                type="number"
                min={0}
                max={360}
                value={activeStyle.gradient.angle}
                onChange={(e) => patchNested('gradient', 'angle', parseInt(e.target.value, 10) || 0)}
                className="flex-1 px-1.5 py-0.5 text-xs bg-zinc-800 text-zinc-200 rounded border border-zinc-700 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Glow</h3>
        <button
          onClick={enableGlow}
          className={`w-full px-2 py-1.5 text-xs rounded transition-colors mb-2 ${
            activeStyle.glow?.enabled ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          {activeStyle.glow?.enabled ? 'Glow On' : 'Glow Off'}
        </button>
        {activeStyle.glow?.enabled && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={activeStyle.glow.color}
                onChange={(e) => patchNested('glow', 'color', e.target.value)}
                className="w-6 h-6 rounded border border-zinc-700 cursor-pointer bg-transparent"
              />
              <span className="text-[10px] text-zinc-500">Blur</span>
              <input
                type="range"
                min={0}
                max={80}
                value={activeStyle.glow.blur}
                onChange={(e) => patchNested('glow', 'blur', parseInt(e.target.value, 10))}
                className="flex-1 accent-indigo-500"
              />
              <span className="text-[10px] text-zinc-400 w-6 text-right">{activeStyle.glow.blur}</span>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Shadow</h3>
        <button
          onClick={enableShadow}
          className={`w-full px-2 py-1.5 text-xs rounded transition-colors mb-2 ${
            activeStyle.shadow?.enabled ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          {activeStyle.shadow?.enabled ? 'Shadow On' : 'Shadow Off'}
        </button>
        {activeStyle.shadow?.enabled && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={activeStyle.shadow.color}
                onChange={(e) => patchNested('shadow', 'color', e.target.value)}
                className="w-6 h-6 rounded border border-zinc-700 cursor-pointer bg-transparent"
              />
              <span className="text-[10px] text-zinc-500">X</span>
              <input
                type="number"
                value={activeStyle.shadow.offsetX}
                onChange={(e) => patchNested('shadow', 'offsetX', parseInt(e.target.value, 10) || 0)}
                className="w-12 px-1.5 py-0.5 text-xs bg-zinc-800 text-zinc-200 rounded border border-zinc-700 outline-none"
              />
              <span className="text-[10px] text-zinc-500">Y</span>
              <input
                type="number"
                value={activeStyle.shadow.offsetY}
                onChange={(e) => patchNested('shadow', 'offsetY', parseInt(e.target.value, 10) || 0)}
                className="w-12 px-1.5 py-0.5 text-xs bg-zinc-800 text-zinc-200 rounded border border-zinc-700 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-10">Blur</span>
              <input
                type="range"
                min={0}
                max={80}
                value={activeStyle.shadow.blur}
                onChange={(e) => patchNested('shadow', 'blur', parseInt(e.target.value, 10))}
                className="flex-1 accent-indigo-500"
              />
              <span className="text-[10px] text-zinc-400 w-6 text-right">{activeStyle.shadow.blur}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
