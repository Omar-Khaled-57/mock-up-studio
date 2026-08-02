import { useState, useCallback } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useTheme } from '../../hooks/useTheme'
import { CANVAS_PRESETS } from '../../lib/constants'
import { Plus, Trash2, Pencil, X, Check, RotateCw } from 'lucide-react'

function loadCustomSizes(): { id: string; label: string; width: number; height: number }[] {
  try {
    const raw = localStorage.getItem('mockup_studio_custom_sizes')
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

function saveCustomSizes(sizes: { id: string; label: string; width: number; height: number }[]) {
  localStorage.setItem('mockup_studio_custom_sizes', JSON.stringify(sizes))
}

let _nextId = Date.now()
function genId() { return String(++_nextId) }

export default function CanvasPresetsPanel() {
  const { clsx, bg, text, border } = useTheme()
  const scene = useStore(safeScene)
  const updateCanvas = useStore((s) => s.updateCanvas)
  const pushHistory = useStore((s) => s.pushHistory)

  const [customSizes, setCustomSizes] = useState(loadCustomSizes)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editWidth, setEditWidth] = useState('1920')
  const [editHeight, setEditHeight] = useState('1080')

  const applySize = useCallback(
    (width: number, height: number) => {
      const ratio = width / height
      let ar = 'Custom'
      if (Math.abs(ratio - 16 / 9) < 0.01) ar = '16:9'
      else if (Math.abs(ratio - 16 / 10) < 0.01) ar = '16:10'
      else if (Math.abs(ratio - 4 / 3) < 0.01) ar = '4:3'
      else if (Math.abs(ratio - 1) < 0.01) ar = '1:1'
      else if (Math.abs(ratio - 9 / 16) < 0.01) ar = '9:16'
      else if (Math.abs(ratio - 21 / 9) < 0.01) ar = '21:9'
      pushHistory(`Canvas ${width}x${height}`)
      updateCanvas({ width, height, aspectRatio: ar })
    },
    [updateCanvas, pushHistory]
  )

  const addSize = useCallback(() => {
    const newSize = { id: genId(), label: 'New Canvas', width: 1920, height: 1080 }
    const updated = [...customSizes, newSize]
    setCustomSizes(updated)
    saveCustomSizes(updated)
    setEditingId(newSize.id)
    setEditLabel(newSize.label)
    setEditWidth(String(newSize.width))
    setEditHeight(String(newSize.height))
  }, [customSizes])

  const deleteSize = useCallback((id: string) => {
    const updated = customSizes.filter((s) => s.id !== id)
    setCustomSizes(updated)
    saveCustomSizes(updated)
    if (editingId === id) setEditingId(null)
  }, [customSizes, editingId])

  const startEdit = useCallback((id: string) => {
    const size = customSizes.find((s) => s.id === id)
    if (!size) return
    setEditingId(id)
    setEditLabel(size.label)
    setEditWidth(String(size.width))
    setEditHeight(String(size.height))
  }, [customSizes])

  const saveEdit = useCallback(() => {
    if (editingId === null) return
    const w = parseInt(editWidth, 10)
    const h = parseInt(editHeight, 10)
    if (isNaN(w) || isNaN(h) || w < 10 || h < 10) return
    const updated = customSizes.map((s) =>
      s.id === editingId ? { ...s, label: editLabel || 'Untitled', width: w, height: h } : s
    )
    setCustomSizes(updated)
    saveCustomSizes(updated)
    setEditingId(null)
  }, [editingId, editWidth, editHeight, editLabel, customSizes])

  return (
    <div className="space-y-4">
      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Canvas Rotation</h3>
        <button
          onClick={() => applySize(scene.canvas.height, scene.canvas.width)}
          className={clsx(
            "w-full flex items-center justify-center gap-2 px-3 py-2 rounded border text-sm font-medium transition-colors",
            bg.button,
            border.secondary
          )}
        >
          <RotateCw size={14} />
          Rotate 90°
        </button>
        <span className={clsx("block text-[10px] mt-1", text.muted)}>
          {scene.canvas.width} × {scene.canvas.height} → {scene.canvas.height} × {scene.canvas.width}
        </span>
      </div>

      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Quick Presets</h3>
        <div className="space-y-1">
          {CANVAS_PRESETS.map((preset) => {
            const active = scene.canvas.width === preset.width && scene.canvas.height === preset.height
            return (
              <button
                key={preset.label}
                onClick={() => applySize(preset.width, preset.height)}
                className={clsx("w-full text-left px-2 py-1.5 rounded text-sm transition-colors", active ? 'bg-indigo-600 text-white' : bg.button)}
              >
                <span className="block">{preset.label}</span>
                <span className="block text-[10px] opacity-60">{preset.width} x {preset.height}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Resolution Presets</h3>
        <div className="space-y-1">
          {[
            { label: 'Full HD', width: 1920, height: 1080 },
            { label: 'WQHD', width: 2560, height: 1440 },
            { label: '4K UHD', width: 3840, height: 2160 }
          ].map((preset) => {
            const active = scene.canvas.width === preset.width && scene.canvas.height === preset.height
            return (
              <button
                key={preset.label}
                onClick={() => applySize(preset.width, preset.height)}
                className={clsx("w-full text-left px-2 py-1.5 rounded text-sm transition-colors", active ? 'bg-indigo-600 text-white' : bg.button)}
              >
                <span className="block">{preset.label}</span>
                <span className="block text-[10px] opacity-60">{preset.width} x {preset.height}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Custom</h3>

        <button
          onClick={addSize}
          className={clsx(
            "w-full flex items-center justify-center gap-2 px-3 py-2 rounded border-2 border-dashed text-sm font-medium transition-colors mb-1.5",
            border.secondary,
            text.tertiary,
            bg.hover
          )}
        >
          <Plus size={16} />
          Add Canvas Size
        </button>

        {customSizes.map((size) => {
          const active = scene.canvas.width === size.width && scene.canvas.height === size.height

          if (editingId === size.id) {
            return (
              <div key={size.id} className={clsx("p-2 rounded space-y-1.5 mb-1", bg.surface)}>
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="Label"
                    className={clsx("w-full px-2 py-1 text-xs rounded outline-none border", bg.input)}
                  />
                <div className="flex gap-1 items-center">
                    <input
                      value={editWidth}
                      onChange={(e) => setEditWidth(e.target.value)}
                      placeholder="W"
                      type="number"
                      min={10}
                      className={clsx("flex-1 min-w-0 px-2 py-1 text-xs rounded outline-none border", bg.input)}
                    />
                    <span className={clsx("shrink-0 text-xs", text.muted)}>×</span>
                    <input
                      value={editHeight}
                      onChange={(e) => setEditHeight(e.target.value)}
                      placeholder="H"
                      type="number"
                      min={10}
                      className={clsx("flex-1 min-w-0 px-2 py-1 text-xs rounded outline-none border", bg.input)}
                  />
                  <button
                    onClick={saveEdit}
                    className="shrink-0 p-1 text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className={clsx("shrink-0 p-1 transition-colors", text.muted)}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div
              key={size.id}
              className={clsx(
                "flex items-center gap-1 px-2 py-1.5 rounded text-sm transition-colors cursor-pointer group mb-1",
                active
                  ? 'bg-indigo-600 text-white'
                  : bg.button
              )}
              onClick={() => applySize(size.width, size.height)}
            >
              <span className="flex-1 min-w-0">
                <span className="block truncate">{size.label}</span>
                <span className={clsx("block text-[10px]", active ? 'text-white/60' : 'opacity-60')}>
                  {size.width} × {size.height}
                </span>
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); startEdit(size.id) }}
                className={clsx(
                  "shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-all",
                  active ? 'hover:bg-white/20 text-white/70' : clsx(text.muted, bg.hover)
                )}
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSize(size.id) }}
                className={clsx(
                  "shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-all",
                  active ? 'hover:bg-white/20 text-white/70' : clsx('text-red-400 hover:text-red-500', bg.hover)
                )}
              >
                <Trash2 size={12} />
              </button>
            </div>
          )
        })}

        {customSizes.length === 0 && (
          <p className={clsx("text-[10px] text-center", text.muted)}>
            No custom sizes yet. Click + to add one.
          </p>
        )}
      </div>
    </div>
  )
}
