import { useMemo } from 'react'
import { useStore } from '../../store'
import type { Device, TextBox, ImageOverlay } from '@shared/types'
import { DEVICE_ASPECT_RATIOS } from '../../lib/constants'

export default function PropertiesPanel() {
  const selectedIds = useStore((s) => s.selectedIds)
  const scenes = useStore((s) => s.scenes)
  const activeSceneIndex = useStore((s) => s.activeSceneIndex)
  const updateDevice = useStore((s) => s.updateDevice)
  const updateTextBox = useStore((s) => s.updateTextBox)
  const updateImage = useStore((s) => s.updateImage)
  const pushHistory = useStore((s) => s.pushHistory)

  const scene = scenes[activeSceneIndex]

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
  }, [selectedIds, scene])

  if (!selected) {
    return (
      <aside className="w-52 bg-zinc-900 border-l border-zinc-800 p-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-2">Properties</h3>
        <p className="text-[11px] text-zinc-600">Select an element to edit its properties</p>
      </aside>
    )
  }

  const { kind, data } = selected
  const x = data.x
  const y = data.y
  const width = data.width
  const height = data.height
  const rotation = 'rotation' in data ? data.rotation : 0

  const patchX = (v: number) => {
    if (kind === 'device') updateDevice(data.id, { x: v })
    else if (kind === 'textbox') updateTextBox(data.id, { x: v })
    else updateImage(data.id, { x: v })
  }

  const patchY = (v: number) => {
    if (kind === 'device') updateDevice(data.id, { y: v })
    else if (kind === 'textbox') updateTextBox(data.id, { y: v })
    else updateImage(data.id, { y: v })
  }

  const patchW = (v: number) => {
    if (v < 20) return
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
  }

  const patchH = (v: number) => {
    if (v < 20) return
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
  }

  const patchRotation = (v: number) => {
    if (kind === 'device') updateDevice(data.id, { rotation: v })
    else if (kind === 'image') updateImage(data.id, { rotation: v })
  }

  const handleNumericInput = (value: string, patch: (v: number) => void) => {
    const n = parseInt(value, 10)
    if (!isNaN(n)) patch(n)
  }

  return (
    <aside className="w-52 bg-zinc-900 border-l border-zinc-800 p-3 space-y-3 overflow-y-auto">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase">
        {kind === 'device' ? `Device: ${(data as Device).name}` : kind === 'textbox' ? 'Text Box' : 'Image'}
      </h3>

      {/* Position */}
      <div>
        <label className="text-[10px] text-zinc-500 mb-1 block">Position</label>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-600 w-3">X</span>
            <input
              type="number"
              value={Math.round(x)}
              onChange={(e) => handleNumericInput(e.target.value, patchX)}
              className="flex-1 px-1.5 py-1 text-xs bg-zinc-800 text-zinc-200 rounded border border-zinc-700 focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-600 w-3">Y</span>
            <input
              type="number"
              value={Math.round(y)}
              onChange={(e) => handleNumericInput(e.target.value, patchY)}
              className="flex-1 px-1.5 py-1 text-xs bg-zinc-800 text-zinc-200 rounded border border-zinc-700 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Size */}
      <div>
        <label className="text-[10px] text-zinc-500 mb-1 block">Size</label>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-600 w-3">W</span>
            <input
              type="number"
              value={Math.round(width)}
              onChange={(e) => handleNumericInput(e.target.value, patchW)}
              className="flex-1 px-1.5 py-1 text-xs bg-zinc-800 text-zinc-200 rounded border border-zinc-700 focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-600 w-3">H</span>
            <input
              type="number"
              value={Math.round(height)}
              onChange={(e) => handleNumericInput(e.target.value, patchH)}
              className="flex-1 px-1.5 py-1 text-xs bg-zinc-800 text-zinc-200 rounded border border-zinc-700 focus:border-indigo-500 outline-none"
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
              {(['contain', 'cover'] as const).map((fit) => (
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

      {/* Multi-select info */}
      {selectedIds.length > 1 && (
        <div className="pt-2 border-t border-zinc-800">
          <p className="text-[11px] text-zinc-500">{selectedIds.length} elements selected</p>
        </div>
      )}
    </aside>
  )
}
