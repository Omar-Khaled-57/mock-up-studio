import { useMemo, useCallback } from 'react'
import { useStore } from '../../store'
import { useTheme } from '../../hooks/useTheme'
import { safeScene } from '../../store/sceneSlice'
import type { Device, TextBox, ImageOverlay } from '@shared/types'
import type { AlignmentDirection } from '../../store/selectionSlice'
import { DEVICE_ASPECT_RATIOS } from '../../lib/constants'
import { AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal } from 'lucide-react'

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
  const { isLight, clsx } = useTheme()

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
    return null
  }, [selectedIds, scene.devices, scene.textBoxes, scene.images])

  const patchX = useCallback(
    (v: number) => {
      if (!selected) return
      const { kind, data } = selected
      if (kind === 'device') updateDevice(data.id, { x: v })
      else if (kind === 'textbox') updateTextBox(data.id, { x: v })
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
        "w-52 border-l p-3",
        isLight ? "bg-zinc-50 border-zinc-200" : "bg-zinc-900 border-zinc-800"
      )}>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", isLight ? "text-zinc-500" : "text-zinc-400")}>Properties</h3>
        <p className={clsx("text-[11px]", isLight ? "text-zinc-400" : "text-zinc-600")}>Select an element to edit its properties</p>
      </aside>
    )
  }

  const { kind, data } = selected
  const x = data.x
  const y = data.y
  const width = data.width
  const height = data.height
  const rotation = 'rotation' in data ? data.rotation : 0

  return (
    <aside className={clsx(
      "w-52 border-l p-3 space-y-3 overflow-y-auto",
      isLight ? "bg-zinc-50 border-zinc-200" : "bg-zinc-900/50 border-zinc-800/60"
    )}>
      <h3 className={clsx("text-xs font-semibold uppercase tracking-wider", isLight ? "text-zinc-600" : "text-zinc-400")}>
        {kind === 'device' ? `Device: ${(data as Device).name}` : kind === 'textbox' ? 'Text Box' : 'Image'}
      </h3>

      {/* Position */}
      <div>
        <label className="text-[10px] text-zinc-500 mb-1 block">Position</label>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[10px] text-zinc-600 w-3 shrink-0">X</span>
            <input
              type="number"
              value={Math.round(x)}
              onChange={(e) => handleNumericInput(e.target.value, patchX)}
              className="min-w-0 w-full px-1.5 py-1 text-xs bg-zinc-800 text-zinc-200 rounded border border-zinc-700 focus:border-indigo-500 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[10px] text-zinc-600 w-3 shrink-0">Y</span>
            <input
              type="number"
              value={Math.round(y)}
              onChange={(e) => handleNumericInput(e.target.value, patchY)}
              className="min-w-0 w-full px-1.5 py-1 text-xs bg-zinc-800 text-zinc-200 rounded border border-zinc-700 focus:border-indigo-500 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>
      </div>

      {/* Size */}
      <div>
        <label className="text-[10px] text-zinc-500 mb-1 block">Size</label>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[10px] text-zinc-600 w-3 shrink-0">W</span>
            <input
              type="number"
              value={Math.round(width)}
              onChange={(e) => handleNumericInput(e.target.value, patchW)}
              className="min-w-0 w-full px-1.5 py-1 text-xs bg-zinc-800 text-zinc-200 rounded border border-zinc-700 focus:border-indigo-500 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[10px] text-zinc-600 w-3 shrink-0">H</span>
            <input
              type="number"
              value={Math.round(height)}
              onChange={(e) => handleNumericInput(e.target.value, patchH)}
              className="min-w-0 w-full px-1.5 py-1 text-xs bg-zinc-800 text-zinc-200 rounded border border-zinc-700 focus:border-indigo-500 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>
      </div>

      {/* Rotation (devices + images) */}
      {kind !== 'textbox' && (
        <div>
          <label className="text-[10px] text-zinc-500 mb-1 block">
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

      {/* Device-specific */}
      {kind === 'device' && (
        <>
          <div>
            <label className="text-[10px] text-zinc-500 mb-1 block">Color Theme</label>
            <div className="grid grid-cols-3 gap-1">
              {(['dark', 'light', 'space-gray', 'midnight', 'custom'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => updateDevice(data.id, { colorTheme: theme })}
                  className={`px-1 py-1 text-[10px] rounded transition-colors ${
                    (data as Device).colorTheme === theme
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 mb-1 block">Object Fit</label>
            <div className="flex gap-1">
              {(['contain', 'cover', 'stretch'] as const).map((fit) => (
                <button
                  key={fit}
                  onClick={() => updateDevice(data.id, { objectFit: fit })}
                  className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                    (data as Device).objectFit === fit
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {fit}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Text-specific */}
      {kind === 'textbox' && (
        <>
          <div>
            <label className="text-[10px] text-zinc-500 mb-1 block">Font Size</label>
            <input
              type="number"
              min={8}
              max={400}
              value={(data as TextBox).fontSize}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10) || 16
                updateTextBox(data.id, { fontSize: v })
              }}
              className="w-full px-2 py-1 text-xs bg-zinc-800 text-zinc-200 rounded border border-zinc-700 focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 mb-1 block">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={(data as TextBox).color}
                onChange={(e) => updateTextBox(data.id, { color: e.target.value })}
                className="w-7 h-7 rounded border border-zinc-700 cursor-pointer bg-transparent"
              />
              <input
                value={(data as TextBox).color}
                onChange={(e) => updateTextBox(data.id, { color: e.target.value })}
                className="flex-1 px-2 py-1 text-[11px] font-mono bg-zinc-800 text-zinc-200 rounded border border-zinc-700 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 mb-1 block">Background</label>
            <div className="flex gap-1">
              <button
                onClick={() => updateTextBox(data.id, { backgroundVisible: !(data as TextBox).backgroundVisible })}
                className={`px-2 py-1 text-[10px] rounded transition-colors ${
                  (data as TextBox).backgroundVisible
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {(data as TextBox).backgroundVisible ? 'On' : 'Off'}
              </button>
              {(data as TextBox).backgroundVisible && (
                <input
                  type="color"
                  value={(data as TextBox).backgroundColor}
                  onChange={(e) => updateTextBox(data.id, { backgroundColor: e.target.value })}
                  className="w-7 h-7 rounded border border-zinc-700 cursor-pointer bg-transparent"
                />
              )}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 mb-1 block">Border</label>
            <div className="flex gap-1">
              <button
                onClick={() => updateTextBox(data.id, { borderVisible: !(data as TextBox).borderVisible })}
                className={`px-2 py-1 text-[10px] rounded transition-colors ${
                  (data as TextBox).borderVisible
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {(data as TextBox).borderVisible ? 'On' : 'Off'}
              </button>
              {(data as TextBox).borderVisible && (
                <input
                  type="color"
                  value={(data as TextBox).borderColor}
                  onChange={(e) => updateTextBox(data.id, { borderColor: e.target.value })}
                  className="w-7 h-7 rounded border border-zinc-700 cursor-pointer bg-transparent"
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Multi-select info + alignment tools */}
      {selectedIds.length > 1 && (
        <div className="pt-2 border-t border-zinc-800">
          <p className={clsx("text-[11px] mb-2", isLight ? "text-zinc-500" : "text-zinc-500")}>{selectedIds.length} elements selected</p>
          <label className={clsx("text-[10px] mb-1 block", isLight ? "text-zinc-500" : "text-zinc-500")}>Align</label>
          <div className="grid grid-cols-3 gap-1">
            {ALIGN_BUTTONS.map(({ dir, icon: Icon, label }) => (
              <button
                key={dir}
                onClick={() => useStore.getState().alignSelected(dir)}
                title={label}
                className={clsx(
                  "flex items-center justify-center p-1.5 rounded transition-colors",
                  isLight
                    ? "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-700"
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
