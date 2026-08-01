import { useMemo, useCallback } from 'react'
import { useStore } from '../../store'
import { useTheme } from '../../hooks/useTheme'
import { safeScene } from '../../store/sceneSlice'
import type { Device, TextBox, ImageOverlay, Shape, BlendMode, ShadowLayer, GlowLayer, TextShadow, TextGlow } from '@shared/types'
import type { AlignmentDirection } from '../../store/selectionSlice'
import { DEVICE_ASPECT_RATIOS } from '../../lib/constants'
import { AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, Image as ImageIcon } from 'lucide-react'
import ShadowEditor from '../shared/ShadowEditor'
import GlowEditor from '../shared/GlowEditor'
import EffectsEditor from '../effects/EffectsEditor'

function toShadowLayers(ts: TextShadow | null): ShadowLayer[] {
  if (!ts) return []
  return [{
    enabled: ts.enabled,
    color: ts.color,
    offsetX: ts.offsetX,
    offsetY: ts.offsetY,
    blur: ts.blur,
    spread: 0,
    opacity: 100,
    inset: false
  }]
}

function fromShadowLayers(layers: ShadowLayer[]): TextShadow | null {
  if (layers.length === 0) return null
  const l = layers[0]
  return { enabled: l.enabled, color: l.color, offsetX: l.offsetX, offsetY: l.offsetY, blur: l.blur }
}

function toGlowLayers(tg: TextGlow | null): GlowLayer[] {
  if (!tg) return []
  return [{
    enabled: tg.enabled,
    color: tg.color,
    blur: tg.blur,
    spread: 0,
    opacity: 100
  }]
}

function fromGlowLayers(layers: GlowLayer[]): TextGlow | null {
  if (layers.length === 0) return null
  const l = layers[0]
  return { enabled: l.enabled, color: l.color, blur: l.blur }
}

const ALIGN_BUTTONS: { dir: AlignmentDirection; icon: typeof AlignStartVertical; label: string }[] = [
  { dir: 'left', icon: AlignStartVertical, label: 'Align Left' },
  { dir: 'center-x', icon: AlignCenterVertical, label: 'Align Center X' },
  { dir: 'right', icon: AlignEndVertical, label: 'Align Right' },
  { dir: 'top', icon: AlignStartHorizontal, label: 'Align Top' },
  { dir: 'center-y', icon: AlignCenterHorizontal, label: 'Align Center Y' },
  { dir: 'bottom', icon: AlignEndHorizontal, label: 'Align Bottom' }
]

export default function PropertiesPanel() {
  const selectedIds = useStore((s) => s.selectedIds)
  const updateDevice = useStore((s) => s.updateDevice)
  const updateTextBox = useStore((s) => s.updateTextBox)
  const updateImage = useStore((s) => s.updateImage)
  const updateEffects = useStore((s) => s.updateEffects)
  const resetEffects = useStore((s) => s.resetEffects)
  const propertiesPanelWidth = useStore((s) => s.propertiesPanelWidth)
  const { clsx, bg, text, border, shadow } = useTheme()

  const scene = useStore(safeScene)

  const selected = useMemo(() => {
    if (selectedIds.length !== 1) return null
    const id = selectedIds[0]
    const dev = scene.devices.find((d) => d.id === id)
    if (dev) return { kind: 'device' as const, data: dev }
    const tb = scene.textBoxes.find((t) => t.id === id)
    if (tb) return { kind: 'textbox' as const, data: tb }
    const img = scene.images.find((i) => i.id === id)
    if (img) return { kind: 'image' as const, data: img }
    const shape = scene.shapes.find((s) => s.id === id)
    if (shape) return { kind: 'shape' as const, data: shape }
    return null
  }, [selectedIds, scene.devices, scene.textBoxes, scene.images, scene.shapes])

  const masks = useMemo(
    () => scene.masks.filter((m) => m.targetId === (selected?.data.id ?? '')),
    [scene.masks, selected]
  )

  const patchX = useCallback(
    (v: number) => {
      if (!selected) return
      const { kind, data } = selected
      if (kind === 'device') updateDevice(data.id, { x: v })
      else if (kind === 'textbox') updateTextBox(data.id, { x: v })
      else if (kind === 'shape') useStore.getState().updateShape(data.id, { x: v })
      else updateImage(data.id, { x: v })
    },
    [selected, updateDevice, updateTextBox, updateImage]
  )

  const patchY = useCallback(
    (v: number) => {
      if (!selected) return
      const { kind, data } = selected
      if (kind === 'device') updateDevice(data.id, { y: v })
      else if (kind === 'textbox') updateTextBox(data.id, { y: v })
      else if (kind === 'shape') useStore.getState().updateShape(data.id, { y: v })
      else updateImage(data.id, { y: v })
    },
    [selected, updateDevice, updateTextBox, updateImage]
  )

  const patchW = useCallback(
    (v: number) => {
      if (!selected || v < 20) return
      const { kind, data } = selected
      if (kind === 'device') {
        const ratio = DEVICE_ASPECT_RATIOS[(data as Device).type] ?? 16 / 9
        updateDevice(data.id, { width: v, height: Math.round(v / ratio) })
      } else if (kind === 'textbox') {
        updateTextBox(data.id, { width: v })
      } else if (kind === 'shape') {
        useStore.getState().updateShape(data.id, { width: v })
      } else {
        const img = data as ImageOverlay
        const ratio = img.height / img.width
        updateImage(data.id, { width: v, height: Math.round(v * ratio) })
      }
    },
    [selected, updateDevice, updateTextBox, updateImage]
  )

  const patchH = useCallback(
    (v: number) => {
      if (!selected || v < 20) return
      const { kind, data } = selected
      if (kind === 'device') {
        const ratio = DEVICE_ASPECT_RATIOS[(data as Device).type] ?? 16 / 9
        updateDevice(data.id, { width: Math.round(v * ratio), height: v })
      } else if (kind === 'textbox') {
        updateTextBox(data.id, { height: v })
      } else if (kind === 'shape') {
        useStore.getState().updateShape(data.id, { height: v })
      } else {
        const img = data as ImageOverlay
        const ratio = img.width / img.height
        updateImage(data.id, { width: Math.round(v * ratio), height: v })
      }
    },
    [selected, updateDevice, updateTextBox, updateImage]
  )

  const patchRotation = useCallback(
    (v: number) => {
      if (!selected) return
      const { kind, data } = selected
      if (kind === 'device') updateDevice(data.id, { rotation: v })
      else if (kind === 'shape') useStore.getState().updateShape(data.id, { rotation: v })
      else if (kind === 'image') updateImage(data.id, { rotation: v })
    },
    [selected, updateDevice, updateImage]
  )

  const handleNumericInput = useCallback((value: string, patch: (v: number) => void) => {
    const n = parseInt(value, 10)
    if (!isNaN(n)) patch(n)
  }, [])

  if (!selected) {
    return (
      <aside className={clsx(
        "border-l p-3 space-y-3 overflow-y-auto",
        bg.panel,
        border.primary,
        shadow.sm
      )} style={{ width: propertiesPanelWidth }}>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Properties</h3>
        <p className={clsx("text-[11px]", text.muted)}>Select an element to edit its properties</p>
      </aside>
    )
  }

  const { kind, data } = selected
  const x = data.x
  const y = data.y
  const width = data.width
  const height = data.height
  const rotation = 'rotation' in data ? data.rotation : 0

  const addMask = () => {
    if (!selected) return
    const state = useStore.getState()
    state.pushHistory('Mask element')
    state.maskElement(selected.data.id, { width: selected.data.width, height: selected.data.height })
  }

  const reverseMask = () => {
    if (masks.length === 0) return
    const state = useStore.getState()
    state.pushHistory('Reverse mask')
    state.reverseMask(masks[0].id)
  }

  const removeMask = () => {
    if (!selected) return
    const state = useStore.getState()
    state.pushHistory('Remove mask')
    state.removeMaskFromElement(selected.data.id)
  }

  return (
    <aside className={clsx(
      "border-l p-3 space-y-3 overflow-y-auto",
      bg.panel,
      border.primary,
      shadow.md
    )} style={{ width: propertiesPanelWidth }}>
      <h3 className={clsx("text-xs font-semibold uppercase tracking-wider", text.primary)}>
        {kind === 'device' ? `Device: ${(data as Device).name}` : kind === 'textbox' ? 'Text Box' : kind === 'shape' ? `Shape: ${(data as Shape).kind}` : 'Image'}
      </h3>

      {/* Position */}
      <div>
        <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Position</label>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex items-center gap-1 min-w-0">
            <span className={clsx("text-[10px] w-3 shrink-0", text.secondary)}>X</span>
            <input
              type="number"
              value={Math.round(x)}
              onChange={(e) => handleNumericInput(e.target.value, patchX)}
              className={clsx("min-w-0 w-full px-1.5 py-1 text-xs rounded", bg.input, border.secondary, border.focus, "outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none")}
            />
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <span className={clsx("text-[10px] w-3 shrink-0", text.secondary)}>Y</span>
            <input
              type="number"
              value={Math.round(y)}
              onChange={(e) => handleNumericInput(e.target.value, patchY)}
              className={clsx("min-w-0 w-full px-1.5 py-1 text-xs rounded", bg.input, border.secondary, border.focus, "outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none")}
            />
          </div>
        </div>
      </div>

      {/* Size */}
      <div>
        <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Size</label>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex items-center gap-1 min-w-0">
            <span className={clsx("text-[10px] w-3 shrink-0", text.secondary)}>W</span>
            <input
              type="number"
              value={Math.round(width)}
              onChange={(e) => handleNumericInput(e.target.value, patchW)}
              className={clsx("min-w-0 w-full px-1.5 py-1 text-xs rounded", bg.input, border.secondary, border.focus, "outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none")}
            />
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <span className={clsx("text-[10px] w-3 shrink-0", text.secondary)}>H</span>
            <input
              type="number"
              value={Math.round(height)}
              onChange={(e) => handleNumericInput(e.target.value, patchH)}
              className={clsx("min-w-0 w-full px-1.5 py-1 text-xs rounded", bg.input, border.secondary, border.focus, "outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none")}
            />
          </div>
        </div>
      </div>

      {/* Rotation (devices + images + shapes) */}
      {kind !== 'textbox' && (
        <div>
          <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>
            Rotation: {rotation}°
          </label>
          <input
            type="range"
            min={0}
            max={360}
            value={rotation}
            onChange={(e) => patchRotation(parseInt(e.target.value, 10))}
            className="w-full accent-indigo-500"
          />
        </div>
      )}

      {/* Image-specific */}
      {kind === 'image' && (
        <>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>
              Opacity: {(data as ImageOverlay).opacity}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={(data as ImageOverlay).opacity}
              onChange={(e) => updateImage(data.id, { opacity: parseInt(e.target.value, 10) })}
              className="w-full accent-indigo-500"
            />
          </div>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>
              Corner Radius: {(data as ImageOverlay).borderRadius}px
            </label>
            <input
              type="range"
              min={0}
              max={60}
              value={(data as ImageOverlay).borderRadius}
              onChange={(e) => updateImage(data.id, { borderRadius: parseInt(e.target.value, 10) })}
              className="w-full accent-indigo-500"
            />
          </div>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Blend Mode</label>
            <select
              value={(data as ImageOverlay).blendMode}
              onChange={(e) => updateImage(data.id, { blendMode: e.target.value as BlendMode })}
              className={clsx("w-full px-2 py-1 text-xs rounded", bg.input, border.secondary, border.focus, "outline-none")}
            >
              {(['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion'] as const).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => updateImage(data.id, { flipX: !(data as ImageOverlay).flipX })}
              className={clsx(
                "flex-1 px-2 py-1 text-[10px] rounded transition-colors",
                (data as ImageOverlay).flipX ? bg.selected : bg.button
              )}
            >
              Flip X
            </button>
            <button
              onClick={() => updateImage(data.id, { flipY: !(data as ImageOverlay).flipY })}
              className={clsx(
                "flex-1 px-2 py-1 text-[10px] rounded transition-colors",
                (data as ImageOverlay).flipY ? bg.selected : bg.button
              )}
            >
              Flip Y
            </button>
          </div>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Blur: {(data as ImageOverlay).blur}px</label>
            <input
              type="range"
              min={0}
              max={20}
              value={(data as ImageOverlay).blur}
              onChange={(e) => updateImage(data.id, { blur: parseInt(e.target.value, 10) })}
              className="w-full accent-indigo-500"
            />
          </div>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Shadow</label>
            <ShadowEditor
              value={(data as ImageOverlay).shadow}
              onChange={(shadows) => updateImage(data.id, { shadow: shadows })}
            />
          </div>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Glow</label>
            <GlowEditor
              value={(data as ImageOverlay).glow}
              onChange={(glows) => updateImage(data.id, { glow: glows })}
            />
          </div>
        </>
      )}

      {/* Device-specific */}
      {kind === 'device' && (
        <>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Name</label>
            <input
              value={(data as Device).name}
              onChange={(e) => updateDevice(data.id, { name: e.target.value })}
              className={clsx("w-full px-2 py-1.5 text-xs rounded", bg.input, border.secondary, border.focus, "outline-none")}
            />
          </div>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>
              Width: {(data as Device).width}px
            </label>
            <input
              type="range"
              min={80}
              max={1200}
              value={(data as Device).width}
              onChange={(e) => {
                const w = parseInt(e.target.value, 10)
                const ratio = DEVICE_ASPECT_RATIOS[(data as Device).type] ?? 16 / 9
                updateDevice(data.id, { width: w, height: Math.round(w / ratio) })
              }}
              className="w-full accent-indigo-500"
            />
          </div>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Color Theme</label>
            <div className="grid grid-cols-3 gap-1">
              {(['dark', 'light', 'space-gray', 'midnight', 'custom'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => updateDevice(data.id, { colorTheme: theme })}
                  className={clsx(
                    "px-1 py-1 text-[10px] rounded transition-colors capitalize",
                    (data as Device).colorTheme === theme ? bg.selected : bg.button
                  )}
                >
                  {theme === 'space-gray' ? 'Space Gray' : theme === 'midnight' ? 'Midnight' : theme}
                </button>
              ))}
            </div>
          </div>
          {(data as Device).colorTheme === 'custom' && (
            <div className="space-y-2">
              <div>
                <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Bezel Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={(data as Device).customBezelColor ?? '#27272a'}
                    onChange={(e) => updateDevice(data.id, { customBezelColor: e.target.value })}
                    className={clsx("w-7 h-7 rounded cursor-pointer bg-transparent shrink-0", border.secondary)}
                  />
                  <input
                    value={(data as Device).customBezelColor ?? '#27272a'}
                    onChange={(e) => updateDevice(data.id, { customBezelColor: e.target.value })}
                    className={clsx("flex-1 px-2 py-1 text-[11px] font-mono rounded", bg.input, border.secondary, border.focus, "outline-none")}
                  />
                </div>
              </div>
              <div>
                <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Border Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={(data as Device).customBorderColor ?? '#09090b'}
                    onChange={(e) => updateDevice(data.id, { customBorderColor: e.target.value })}
                    className={clsx("w-7 h-7 rounded cursor-pointer bg-transparent shrink-0", border.secondary)}
                  />
                  <input
                    value={(data as Device).customBorderColor ?? '#09090b'}
                    onChange={(e) => updateDevice(data.id, { customBorderColor: e.target.value })}
                    className={clsx("flex-1 px-2 py-1 text-[11px] font-mono rounded", bg.input, border.secondary, border.focus, "outline-none")}
                  />
                </div>
              </div>
            </div>
          )}
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Object Fit</label>
            <div className="flex gap-1">
              {(['contain', 'cover', 'stretch'] as const).map((fit) => (
                <button
                  key={fit}
                  onClick={() => updateDevice(data.id, { objectFit: fit })}
                  className={clsx(
                    "flex-1 px-2 py-1 text-xs rounded transition-colors",
                    (data as Device).objectFit === fit ? bg.selected : bg.button
                  )}
                >
                  {fit}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>
              Rotation: {(data as Device).rotation}°
            </label>
            <input
              type="range"
              min={0}
              max={360}
              value={(data as Device).rotation}
              onChange={(e) => updateDevice(data.id, { rotation: parseInt(e.target.value, 10) })}
              className="w-full accent-indigo-500"
            />
          </div>
        </>
      )}

      {/* Text-specific */}
      {kind === 'textbox' && (
        <>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Font Size</label>
            <input
              type="number"
              min={8}
              max={400}
              value={(data as TextBox).fontSize}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10) || 16
                updateTextBox(data.id, { fontSize: v })
              }}
              className={clsx("w-full px-2 py-1 text-xs rounded", bg.input, border.secondary, border.focus, "outline-none")}
            />
          </div>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={(data as TextBox).color}
                onChange={(e) => updateTextBox(data.id, { color: e.target.value })}
                className={clsx("w-7 h-7 rounded cursor-pointer bg-transparent", border.secondary)}
              />
              <input
                value={(data as TextBox).color}
                onChange={(e) => updateTextBox(data.id, { color: e.target.value })}
                className={clsx("flex-1 px-2 py-1 text-[11px] font-mono rounded", bg.input, border.secondary, border.focus, "outline-none")}
              />
            </div>
          </div>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Background</label>
            <div className="flex gap-1">
              <button
                onClick={() => updateTextBox(data.id, { backgroundVisible: !(data as TextBox).backgroundVisible })}
                className={clsx(
                  "px-2 py-1 text-[10px] rounded transition-colors",
                  (data as TextBox).backgroundVisible ? bg.selected : bg.button
                )}
              >
                {(data as TextBox).backgroundVisible ? 'On' : 'Off'}
              </button>
              {(data as TextBox).backgroundVisible && (
                <input
                  type="color"
                  value={(data as TextBox).backgroundColor}
                  onChange={(e) => updateTextBox(data.id, { backgroundColor: e.target.value })}
                  className={clsx("w-7 h-7 rounded cursor-pointer bg-transparent", border.secondary)}
                />
              )}
            </div>
          </div>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Border</label>
            <div className="flex gap-1">
              <button
                onClick={() => updateTextBox(data.id, { borderVisible: !(data as TextBox).borderVisible })}
                className={clsx(
                  "px-2 py-1 text-[10px] rounded transition-colors",
                  (data as TextBox).borderVisible ? bg.selected : bg.button
                )}
              >
                {(data as TextBox).borderVisible ? 'On' : 'Off'}
              </button>
              {(data as TextBox).borderVisible && (
                <input
                  type="color"
                  value={(data as TextBox).borderColor}
                  onChange={(e) => updateTextBox(data.id, { borderColor: e.target.value })}
                  className={clsx("w-7 h-7 rounded cursor-pointer bg-transparent", border.secondary)}
                />
              )}
            </div>
          </div>
          {/* Shadow */}
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Shadow</label>
            <ShadowEditor
              value={toShadowLayers((data as TextBox).shadow)}
              onChange={(shadows) => updateTextBox(data.id, { shadow: fromShadowLayers(shadows) })}
            />
          </div>
          {/* Glow */}
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Glow</label>
            <GlowEditor
              value={toGlowLayers((data as TextBox).glow)}
              onChange={(glows) => updateTextBox(data.id, { glow: fromGlowLayers(glows) })}
            />
          </div>
        </>
      )}

      {/* Shape-specific */}
      {kind === 'shape' && (
        <>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={(data as Shape).color}
                onChange={(e) => useStore.getState().updateShape(data.id, { color: e.target.value })}
                className={clsx("w-7 h-7 rounded cursor-pointer bg-transparent", border.secondary)}
              />
              <input
                value={(data as Shape).color}
                onChange={(e) => useStore.getState().updateShape(data.id, { color: e.target.value })}
                className={clsx("flex-1 px-2 py-1 text-[11px] font-mono rounded", bg.input, border.secondary, border.focus, "outline-none")}
              />
            </div>
          </div>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Background Image</label>
            {(data as Shape).backgroundImage ? (
              <div className="space-y-1.5">
                <div className={clsx("w-full h-12 rounded overflow-hidden", border.secondary)}>
                  <img src={(data as Shape).backgroundImage!} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => document.getElementById(`shape-img-${data.id}`)?.click()}
                    className={clsx("flex-1 py-1 text-[10px] rounded transition-colors", bg.button)}
                  >
                    Replace
                  </button>
                  <button
                    onClick={() => useStore.getState().updateShape(data.id, { backgroundImage: null })}
                    className={clsx("flex-1 py-1 text-[10px] rounded transition-colors", bg.danger)}
                  >
                    Remove
                  </button>
                </div>
                <input
                  id={`shape-img-${data.id}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => { useStore.getState().updateShape(data.id, { backgroundImage: reader.result as string }) }
                    reader.readAsDataURL(file)
                    e.target.value = ''
                  }}
                />
              </div>
            ) : (
              <button
                onClick={() => document.getElementById(`shape-img-add-${data.id}`)?.click()}
                className={clsx("w-full py-1.5 text-[10px] rounded transition-colors flex items-center justify-center gap-1", bg.button)}
              >
                <ImageIcon size={10} /> Upload Image
              </button>
            )}
            <input
              id={`shape-img-add-${data.id}`}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = () => { useStore.getState().updateShape(data.id, { backgroundImage: reader.result as string }) }
                reader.readAsDataURL(file)
                e.target.value = ''
              }}
            />
          </div>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Opacity: {(data as Shape).opacity}%</label>
            <input
              type="range"
              min={0}
              max={100}
              value={(data as Shape).opacity}
              onChange={(e) => useStore.getState().updateShape(data.id, { opacity: parseInt(e.target.value, 10) })}
              className="w-full accent-indigo-500"
            />
          </div>
          {(data as Shape).kind === 'rectangle' && (
            <div>
              <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Corner Radius: {(data as Shape).cornerRadius}px</label>
              <input
                type="range"
                min={0}
                max={60}
                value={(data as Shape).cornerRadius}
                onChange={(e) => useStore.getState().updateShape(data.id, { cornerRadius: parseInt(e.target.value, 10) })}
                className="w-full accent-indigo-500"
              />
            </div>
          )}
          {(data as Shape).kind === 'triangle' && (
            <div className="space-y-1.5">
              <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Angles</label>
              {(['A', 'B', 'C'] as const).map((label, i) => {
                const angles = (data as Shape).angles ?? [60, 60, 60]
                const unchangedIdx = (i + 1) % 3
                const lastIdx = (i + 2) % 3
                const unchangedVal = angles[unchangedIdx]
                const maxAllowed = 180 - unchangedVal - 1
                return (
                  <div key={label}>
                    <label className={clsx("text-[10px]", text.tertiary)}>Angle {label}: {angles[i]}°</label>
                    <input
                      type="range"
                      min={1}
                      max={Math.max(maxAllowed, 1)}
                      value={angles[i]}
                      onChange={(e) => {
                        const newVal = parseInt(e.target.value, 10)
                        const newAngles: [number, number, number] = [...angles] as [number, number, number]
                        newAngles[i] = newVal
                        newAngles[lastIdx] = 180 - newVal - unchangedVal
                        useStore.getState().updateShape(data.id, { angles: newAngles })
                      }}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                )
              })}
            </div>
          )}
          {(data as Shape).kind === 'cross' && (
            <div>
              <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Arm Thickness: {Math.round(((data as Shape).crossThickness ?? 0.3) * 100)}%</label>
              <input
                type="range"
                min={5}
                max={50}
                value={Math.round(((data as Shape).crossThickness ?? 0.3) * 100)}
                onChange={(e) => useStore.getState().updateShape(data.id, { crossThickness: parseInt(e.target.value, 10) / 100 })}
                className="w-full accent-indigo-500"
              />
            </div>
          )}
          {(data as Shape).kind === 'plus' && (
            <div>
              <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Arm Thickness: {Math.round(((data as Shape).plusThickness ?? 0.3) * 100)}%</label>
              <input
                type="range"
                min={10}
                max={50}
                value={Math.round(((data as Shape).plusThickness ?? 0.3) * 100)}
                onChange={(e) => useStore.getState().updateShape(data.id, { plusThickness: parseInt(e.target.value, 10) / 100 })}
                className="w-full accent-indigo-500"
              />
            </div>
          )}
          {(data as Shape).kind === 'arrow-right' && (
            <div>
              <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Arm Thickness: {Math.round(((data as Shape).arrowThickness ?? 0.5) * 100)}%</label>
              <input
                type="range"
                min={10}
                max={100}
                value={Math.round(((data as Shape).arrowThickness ?? 0.5) * 100)}
                onChange={(e) => useStore.getState().updateShape(data.id, { arrowThickness: parseInt(e.target.value, 10) / 100 })}
                className="w-full accent-indigo-500"
              />
            </div>
          )}
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Rotation: {(data as Shape).rotation}°</label>
            <input
              type="range"
              min={-180}
              max={180}
              value={(data as Shape).rotation}
              onChange={(e) => useStore.getState().updateShape(data.id, { rotation: parseInt(e.target.value, 10) })}
              className="w-full accent-indigo-500"
            />
          </div>
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Blur: {(data as Shape).blur}px</label>
            <input
              type="range"
              min={0}
              max={20}
              value={(data as Shape).blur}
              onChange={(e) => useStore.getState().updateShape(data.id, { blur: parseInt(e.target.value, 10) })}
              className="w-full accent-indigo-500"
            />
          </div>
          {/* Shadow */}
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Shadow</label>
            <ShadowEditor
              value={(data as Shape).shadow}
              onChange={(shadows) => useStore.getState().updateShape(data.id, { shadow: shadows })}
            />
          </div>
          {/* Glow */}
          <div>
            <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Glow</label>
            <GlowEditor
              value={(data as Shape).glow}
              onChange={(glows) => useStore.getState().updateShape(data.id, { glow: glows })}
            />
          </div>
        </>
      )}

      {/* Effects (image + shape) */}
      {(kind === 'image' || kind === 'shape') && (
        <div>
          <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Effects</label>
          <EffectsEditor
            value={(data as ImageOverlay | Shape).effects}
            onChange={(patch) => updateEffects(data.id, patch)}
            onReset={() => resetEffects(data.id)}
          />
        </div>
      )}

      {/* Mask */}
      <div>
        <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Mask</label>
        {masks.length === 0 ? (
          <button
            onClick={addMask}
            className={clsx("w-full py-1.5 text-[10px] rounded transition-colors", bg.button, text.secondary)}
          >
            Add Mask
          </button>
        ) : (
          <>
            <p className={clsx("text-[11px] mb-1 capitalize", text.secondary)}>
              {masks[0].shape}
              {masks[0].inverted ? ' · inverted' : ''}
            </p>
            <div className="flex gap-1">
              <button
                onClick={reverseMask}
                className={clsx("flex-1 py-1 text-[10px] rounded transition-colors", bg.button, text.secondary)}
              >
                Reverse
              </button>
              <button
                onClick={removeMask}
                className={clsx("flex-1 py-1 text-[10px] rounded transition-colors", bg.danger)}
              >
                Remove
              </button>
            </div>
          </>
        )}
      </div>

      {/* Multi-select info + alignment tools */}
      {selectedIds.length > 1 && (
        <div className={clsx("pt-2", border.secondary)}>
          <p className={clsx("text-[11px] mb-2", text.tertiary)}>{selectedIds.length} elements selected</p>
          <label className={clsx("text-[10px] mb-1 block", text.tertiary)}>Align</label>
          <div className="grid grid-cols-3 gap-1">
            {ALIGN_BUTTONS.map(({ dir, icon: Icon, label }) => (
              <button
                key={dir}
                onClick={() => useStore.getState().alignSelected(dir)}
                title={label}
                className={clsx(
                  "flex items-center justify-center p-1.5 rounded transition-colors",
                  bg.button
                )}
              >
                <Icon size={14} strokeWidth={1.5} />
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}