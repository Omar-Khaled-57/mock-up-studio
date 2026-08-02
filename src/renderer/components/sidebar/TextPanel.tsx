import { useState, useCallback, useMemo } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useTheme } from '../../hooks/useTheme'
import { useDebouncedHistory } from '../../hooks/useDebouncedHistory'
import { ICON } from '../../lib/icons'
import { Plus, AlignLeft, AlignCenter, AlignRight, Eye, EyeOff, Lock, Unlock, Trash2, Copy } from 'lucide-react'
import ToggleSwitch from '../shared/ToggleSwitch'

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

/** Neutral fallback style shown when no text box is selected. */
const NEUTRAL_STYLE = {
  fontSize: 48,
  fontFamily: 'Inter',
  fontWeight: 600,
  color: '#ffffff',
  textAlign: 'center' as const,
  lineHeight: 1.3,
  letterSpacing: 0,
  wordSpacing: 0,
  textTransform: 'none' as const,
  strokeColor: '#ffffff',
  strokeWidth: 0,
  gradient: null,
  glow: null,
  shadow: null,
  wrap: true
}

export default function TextPanel() {
  const { clsx, bg, text, border } = useTheme()
  const scene = useStore(safeScene)
  const textBoxes = scene.textBoxes
  const selectedIds = useStore((s) => s.selectedIds)
  const select = useStore((s) => s.select)
  const addDefaultTextBox = useStore((s) => s.addDefaultTextBox)
  const updateTextBox = useStore((s) => s.updateTextBox)
  const removeTextBox = useStore((s) => s.removeTextBox)
  const duplicateSelected = useStore((s) => s.duplicateSelected)
  const pushHistory = useStore((s) => s.pushHistory)
  const pushHistoryDebounced = useDebouncedHistory()

  const selectedTextBox = useMemo(() => {
    if (selectedIds.length !== 1) return null
    return textBoxes.find((t) => t.id === selectedIds[0]) ?? null
  }, [selectedIds, textBoxes])

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const activeStyle = useMemo(() => {
    if (!selectedTextBox) return NEUTRAL_STYLE
    return {
      fontSize: selectedTextBox.fontSize,
      fontFamily: selectedTextBox.fontFamily,
      fontWeight: selectedTextBox.fontWeight,
      color: selectedTextBox.color,
      textAlign: selectedTextBox.textAlign,
      lineHeight: selectedTextBox.lineHeight,
      letterSpacing: selectedTextBox.letterSpacing,
      wordSpacing: selectedTextBox.wordSpacing,
      textTransform: selectedTextBox.textTransform,
      strokeColor: selectedTextBox.strokeColor,
      strokeWidth: selectedTextBox.strokeWidth,
      gradient: selectedTextBox.gradient,
      glow: selectedTextBox.glow,
      shadow: selectedTextBox.shadow,
      wrap: selectedTextBox.wrap
    }
  }, [selectedTextBox])

  const handleAddText = useCallback(() => {
    addDefaultTextBox()
  }, [addDefaultTextBox])

  const handleToggleVisibility = useCallback(
    (id: string) => {
      const tb = textBoxes.find((t) => t.id === id)
      if (tb) updateTextBox(id, { visible: !tb.visible })
    },
    [textBoxes, updateTextBox]
  )

  const handleToggleLock = useCallback(
    (id: string) => {
      const tb = textBoxes.find((t) => t.id === id)
      if (tb) updateTextBox(id, { locked: !tb.locked })
    },
    [textBoxes, updateTextBox]
  )

  const handleDelete = useCallback(
    (id: string) => {
      pushHistory('Delete text box')
      removeTextBox(id)
    },
    [removeTextBox, pushHistory]
  )

  const handleDuplicate = useCallback(
    (id: string) => {
      pushHistory('Duplicate text')
      duplicateSelected([id])
    },
    [duplicateSelected, pushHistory]
  )

  const startRename = useCallback((id: string, currentName: string) => {
    setRenamingId(id)
    setRenameValue(currentName)
  }, [])

  const commitRename = useCallback(() => {
    if (!renamingId) return
    const trimmed = renameValue.trim()
    if (trimmed) {
      pushHistory('Rename text')
      updateTextBox(renamingId, { name: trimmed })
    }
    setRenamingId(null)
  }, [renamingId, renameValue, updateTextBox, pushHistory])

  const cancelRename = useCallback(() => {
    setRenamingId(null)
  }, [])

  const patch = useCallback(
    (field: string, value: unknown) => {
      if (!selectedTextBox) return
      updateTextBox(selectedTextBox.id, { [field]: value })
      pushHistoryDebounced(`Text ${field}`)
    },
    [selectedTextBox, updateTextBox, pushHistoryDebounced]
  )

  const patchNested = useCallback(
    (field: 'gradient' | 'glow' | 'shadow', subField: string, value: unknown) => {
      if (!selectedTextBox) return
      const current = activeStyle[field]
      const updated = { ...current, [subField]: value }
      updateTextBox(selectedTextBox.id, { [field]: updated })
      pushHistoryDebounced(`Text ${field}.${subField}`)
    },
    [selectedTextBox, activeStyle, updateTextBox, pushHistoryDebounced]
  )

  const enableGradient = useCallback(() => {
    const was = activeStyle.gradient?.enabled ?? false
    const g = was
      ? activeStyle.gradient!
      : { enabled: true, color1: '#ffffff', color2: '#a855f7', angle: 135 }
    patch('gradient', { ...g, enabled: !was })
  }, [activeStyle.gradient, patch])

  const enableGlow = useCallback(() => {
    const was = activeStyle.glow?.enabled ?? false
    const g = was
      ? activeStyle.glow!
      : { enabled: true, color: '#818cf8', blur: 20 }
    patch('glow', { ...g, enabled: !was })
  }, [activeStyle.glow, patch])

  const enableShadow = useCallback(() => {
    const was = activeStyle.shadow?.enabled ?? false
    const s = was
      ? activeStyle.shadow!
      : { enabled: true, color: '#00000080', offsetX: 2, offsetY: 4, blur: 8 }
    patch('shadow', { ...s, enabled: !was })
  }, [activeStyle.shadow, patch])

  const ALIGN_ICONS = {
    left: AlignLeft,
    center: AlignCenter,
    right: AlignRight
  } as const

  return (
    <div className="space-y-4">
      {/* Add Text */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className={clsx("text-xs font-semibold uppercase tracking-wider", text.secondary)}>Text Boxes ({textBoxes.length})</h3>
          <button
            onClick={handleAddText}
            className={clsx("flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-all", bg.button)}
          >
            <Plus size={ICON.micro} strokeWidth={2} />
            Add
          </button>
        </div>
        {textBoxes.length === 0 ? (
          <p className={clsx("text-[11px]", text.muted)}>No text boxes yet — click Add to create one</p>
        ) : (
          <div className="space-y-0.5">
            {textBoxes.map((tb) => (
              <div
                key={tb.id}
                onClick={() => { if (renamingId !== tb.id) select(tb.id) }}
                className={clsx("group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150", selectedTextBox?.id === tb.id ? 'bg-indigo-500/10 border border-indigo-500/20' : clsx('bg.hover', 'border border-transparent'))}
              >
                {renamingId === tb.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') cancelRename()
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={clsx("flex-1 px-1 py-0.5 text-xs rounded border outline-none min-w-0", bg.input)}
                  />
                ) : (
                  <span
                    className={clsx("flex-1 truncate", !tb.visible ? text.muted : text.primary)}
                    onDoubleClick={(e) => { e.stopPropagation(); startRename(tb.id, tb.name) }}
                  >
                    {tb.name}
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleVisibility(tb.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors", text.muted)}
                  title={tb.visible ? 'Hide' : 'Show'}
                >
                  {tb.visible ? <Eye size={ICON.micro} /> : <EyeOff size={ICON.micro} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleLock(tb.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors", text.muted)}
                  title={tb.locked ? 'Unlock' : 'Lock'}
                >
                  {tb.locked ? <Lock size={ICON.micro} /> : <Unlock size={ICON.micro} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDuplicate(tb.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors", text.muted)}
                  title="Duplicate"
                >
                  <Copy size={ICON.micro} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(tb.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors text-red-400 hover:text-red-500")}
                  title="Delete"
                >
                  <Trash2 size={ICON.micro} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTextBox ? (
        <>
      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Font</h3>
        <select
          value={activeStyle.fontFamily}
          onChange={(e) => patch('fontFamily', e.target.value)}
          className={clsx("w-full px-2 py-1.5 text-sm rounded border outline-none", bg.input)}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <div className="mt-2">
          <label className={clsx("text-[10px] mb-1 block", text.secondary)}>Weight: {activeStyle.fontWeight}</label>
          <input
            type="range"
            min={300}
            max={900}
            step={100}
            value={activeStyle.fontWeight}
            onChange={(e) => patch('fontWeight', parseInt(e.target.value, 10))}
            className="w-full accent-indigo-500"
          />
            <div className={clsx("flex justify-between text-[9px]", text.muted)}>
            {FONT_WEIGHTS.map((w) => (
              <span key={w.value}>{w.label.split(' ')[0]}</span>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Size & Spacing</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={clsx("text-[10px] mb-0.5 block", text.secondary)}>Size</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={activeStyle.fontSize ?? 48}
                onChange={(e) => {
                  const v = Math.max(1, Number(e.target.value) || 1)
                  patch('fontSize', v)
                }}
                className={clsx("w-full px-1.5 py-1 text-xs rounded border outline-none", bg.input)}
              />
              <span className={clsx("text-xs shrink-0", text.muted)}>px</span>
            </div>
          </div>

          <div>
            <label className={clsx("text-[10px] mb-0.5 block", text.secondary)}>Align</label>
            <div className="flex gap-0.5">
              {(['left', 'center', 'right'] as const).map((align) => {
                const Icon = ALIGN_ICONS[align]
                return (
                  <button
                    key={align}
                    onClick={() => patch('textAlign', align)}
              className={clsx(
                "flex-1 flex items-center justify-center py-1.5 rounded-lg transition-all duration-150",
                activeStyle.textAlign === align ? bg.selected : bg.button
              )}
                  >
                    <Icon size={14} strokeWidth={1.5} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={clsx("text-[10px] w-10 shrink-0", text.secondary)}>Height</span>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.1}
              value={activeStyle.lineHeight ?? 1.2}
              onChange={(e) => patch('lineHeight', parseFloat(e.target.value))}
              className="flex-1 h-1 accent-indigo-500"
            />
            <span className={clsx("text-[10px] w-8 text-right", text.tertiary)}>{(activeStyle.lineHeight ?? 1.2).toFixed(1)}</span>
          </div>
          <ToggleSwitch
            label="Wrap text"
            checked={activeStyle.wrap ?? true}
            onChange={(v) => patch('wrap', v)}
          />
          <div className="flex items-center gap-2">
            <span className={clsx("text-[10px] w-10 shrink-0", text.secondary)}>Letters</span>
            <input
              type="range"
              min={-5}
              max={20}
              step={0.5}
              value={activeStyle.letterSpacing ?? 0}
              onChange={(e) => patch('letterSpacing', parseFloat(e.target.value))}
              className="flex-1 h-1 accent-indigo-500"
            />
            <span className={clsx("text-[10px] w-8 text-right", text.tertiary)}>{activeStyle.letterSpacing ?? 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={clsx("text-[10px] w-10 shrink-0", text.secondary)}>Words</span>
            <input
              type="range"
              min={0}
              max={20}
              step={0.5}
              value={activeStyle.wordSpacing ?? 0}
              onChange={(e) => patch('wordSpacing', parseFloat(e.target.value))}
              className="flex-1 h-1 accent-indigo-500"
            />
            <span className={clsx("text-[10px] w-8 text-right", text.tertiary)}>{activeStyle.wordSpacing ?? 0}</span>
          </div>
        </div>
        <div className="mt-2">
          <label className={clsx("text-[10px] mb-0.5 block", text.secondary)}>Transform</label>
          <div className="flex gap-0.5">
            {(['none', 'uppercase', 'lowercase', 'capitalize'] as const).map((t) => (
              <button
                key={t}
                onClick={() => patch('textTransform', t)}
                className={clsx(
                  "flex-1 px-1 py-1 text-[9px] rounded transition-colors",
                  (activeStyle.textTransform ?? 'none') === t ? bg.selected : bg.button
                )}
              >
                {t === 'none' ? 'Aa' : t === 'uppercase' ? 'AA' : t === 'lowercase' ? 'aa' : 'Ab'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2">
          <label className={clsx("text-[10px] mb-0.5 block", text.secondary)}>Stroke</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={activeStyle.strokeColor ?? '#ffffff'}
              onChange={(e) => patch('strokeColor', e.target.value)}
              className={clsx("w-6 h-6 rounded border cursor-pointer bg-transparent", border.secondary)}
            />
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={activeStyle.strokeWidth ?? 0}
              onChange={(e) => patch('strokeWidth', parseFloat(e.target.value))}
              className="flex-1 h-1 accent-indigo-500"
            />
            <span className={clsx("text-[10px] w-8 text-right", text.tertiary)}>{activeStyle.strokeWidth ?? 0}px</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Color</h3>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={activeStyle.color}
            onChange={(e) => patch('color', e.target.value)}
            className={clsx("w-8 h-8 rounded border cursor-pointer bg-transparent", border.secondary)}
          />
          <input
            value={activeStyle.color}
            onChange={(e) => patch('color', e.target.value)}
            className={clsx("flex-1 px-2 py-1 text-sm font-mono rounded outline-none", bg.input)}
          />
        </div>
      </div>

      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Gradient</h3>
        <button
          onClick={enableGradient}
          className={clsx(
            "w-full px-2 py-1.5 text-xs rounded transition-colors mb-2",
            activeStyle.gradient?.enabled ? bg.selected : bg.button
          )}
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
                className={clsx("w-6 h-6 rounded border cursor-pointer bg-transparent", border.secondary)}
              />
              <input
                type="color"
                value={activeStyle.gradient.color2}
                onChange={(e) => patchNested('gradient', 'color2', e.target.value)}
                className={clsx("w-6 h-6 rounded border cursor-pointer bg-transparent", border.secondary)}
              />
              <span className={clsx("text-[10px]", text.secondary)}>Angle</span>
              <input
                type="number"
                min={0}
                max={360}
                value={activeStyle.gradient.angle}
                onChange={(e) => patchNested('gradient', 'angle', parseInt(e.target.value, 10) || 0)}
                className={clsx("flex-1 px-1.5 py-0.5 text-xs rounded border outline-none", bg.input)}
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Glow</h3>
        <button
          onClick={enableGlow}
          className={clsx(
            "w-full px-2 py-1.5 text-xs rounded transition-colors mb-2",
            activeStyle.glow?.enabled ? bg.selected : bg.button
          )}
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
                className={clsx("w-6 h-6 rounded border cursor-pointer bg-transparent", border.secondary)}
              />
              <span className={clsx("text-[10px]", text.secondary)}>Blur</span>
              <input
                type="range"
                min={0}
                max={80}
                value={activeStyle.glow.blur}
                onChange={(e) => patchNested('glow', 'blur', parseInt(e.target.value, 10))}
                className="flex-1 accent-indigo-500"
              />
              <span className={clsx("text-[10px] w-6 text-right", text.tertiary)}>{activeStyle.glow.blur}</span>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Shadow</h3>
        <button
          onClick={enableShadow}
          className={clsx(
            "w-full px-2 py-1.5 text-xs rounded transition-colors mb-2",
            activeStyle.shadow?.enabled ? bg.selected : bg.button
          )}
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
                className={clsx("w-6 h-6 rounded border cursor-pointer bg-transparent", border.secondary)}
              />
              <span className={clsx("text-[10px]", text.secondary)}>X</span>
              <input
                type="number"
                value={activeStyle.shadow.offsetX}
                onChange={(e) => patchNested('shadow', 'offsetX', parseInt(e.target.value, 10) || 0)}
                className={clsx("w-12 px-1.5 py-0.5 text-xs rounded border outline-none", bg.input)}
              />
              <span className={clsx("text-[10px]", text.secondary)}>Y</span>
              <input
                type="number"
                value={activeStyle.shadow.offsetY}
                onChange={(e) => patchNested('shadow', 'offsetY', parseInt(e.target.value, 10) || 0)}
                className={clsx("w-12 px-1.5 py-0.5 text-xs rounded border outline-none", bg.input)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className={clsx("text-[10px] w-10", text.secondary)}>Blur</span>
              <input
                type="range"
                min={0}
                max={80}
                value={activeStyle.shadow.blur}
                onChange={(e) => patchNested('shadow', 'blur', parseInt(e.target.value, 10))}
                className="flex-1 accent-indigo-500"
              />
              <span className={clsx("text-[10px] w-6 text-right", text.tertiary)}>{activeStyle.shadow.blur}</span>
            </div>
          </div>
        )}
      </div>
        </>
      ) : (
        <p className={clsx("text-[11px]", text.muted)}>Select a text box to edit its style.</p>
      )}
    </div>
  )
}
