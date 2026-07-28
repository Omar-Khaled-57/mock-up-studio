import { useState, useCallback, useMemo } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { CANVAS_PRESETS } from '../../lib/constants'

const MAX_CUSTOM_SLOTS = 5

function loadCustomSlots(): { label: string; width: number; height: number }[] {
  try {
    const raw = localStorage.getItem('mockup_studio_custom_presets')
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return Array.from({ length: MAX_CUSTOM_SLOTS }, (_, i) => ({
    label: `Custom ${i + 1}`,
    width: 1920,
    height: 1080
  }))
}

function saveCustomSlots(slots: { label: string; width: number; height: number }[]) {
  localStorage.setItem('mockup_studio_custom_presets', JSON.stringify(slots))
}

export default function CanvasPresetsPanel() {
  const scene = useStore(safeScene)
  const updateCanvas = useStore((s) => s.updateCanvas)
  const pushHistory = useStore((s) => s.pushHistory)

  const [customSlots, setCustomSlots] = useState(loadCustomSlots)
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [editWidth, setEditWidth] = useState('1920')
  const [editHeight, setEditHeight] = useState('1080')
  const [editLabel, setEditLabel] = useState('')

  const currentIsPreset = useMemo(() => {
    return CANVAS_PRESETS.some(
      (p) => p.width === scene.canvas.width && p.height === scene.canvas.height
    )
  }, [scene.canvas.width, scene.canvas.height])

  const applyPreset = useCallback(
    (width: number, height: number) => {
      const ratio = width / height
      let ar = 'Custom'
      if (Math.abs(ratio - 16 / 9) < 0.01) ar = '16:9'
      else if (Math.abs(ratio - 16 / 10) < 0.01) ar = '16:10'
      else if (Math.abs(ratio - 4 / 3) < 0.01) ar = '4:3'
      else if (Math.abs(ratio - 1) < 0.01) ar = '1:1'
      else if (Math.abs(ratio - 9 / 16) < 0.01) ar = '9:16'
      else if (Math.abs(ratio - 21 / 9) < 0.01) ar = '21:9'

      updateCanvas({ width, height, aspectRatio: ar })
      pushHistory(`Canvas ${width}x${height}`)
    },
    [updateCanvas, pushHistory]
  )

  const startEditSlot = useCallback(
    (idx: number) => {
      const slot = customSlots[idx]
      setEditingSlot(idx)
      setEditWidth(String(slot.width))
      setEditHeight(String(slot.height))
      setEditLabel(slot.label)
    },
    [customSlots]
  )

  const saveSlot = useCallback(() => {
    if (editingSlot === null) return
    const w = parseInt(editWidth, 10)
    const h = parseInt(editHeight, 10)
    if (isNaN(w) || isNaN(h) || w < 100 || h < 100) return
    const updated = [...customSlots]
    updated[editingSlot] = { label: editLabel || `Custom ${editingSlot + 1}`, width: w, height: h }
    setCustomSlots(updated)
    saveCustomSlots(updated)
    setEditingSlot(null)
  }, [editingSlot, editWidth, editHeight, editLabel, customSlots])

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Quick Presets</h3>
        <div className="space-y-1">
          {CANVAS_PRESETS.map((preset) => {
            const active = scene.canvas.width === preset.width && scene.canvas.height === preset.height
            return (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset.width, preset.height)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                  active ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <span className="block">{preset.label}</span>
                <span className="block text-[10px] opacity-60">{preset.width} x {preset.height}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Resolution Presets</h3>
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
                onClick={() => applyPreset(preset.width, preset.height)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                  active ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <span className="block">{preset.label}</span>
                <span className="block text-[10px] opacity-60">{preset.width} x {preset.height}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Custom Slots</h3>
        <div className="space-y-1">
          {customSlots.map((slot, idx) => {
            if (editingSlot === idx) {
              return (
                <div key={idx} className="p-2 bg-zinc-800 rounded space-y-1.5">
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="Label"
                    className="w-full px-2 py-1 text-xs bg-zinc-900 rounded text-zinc-200 outline-none border border-zinc-700 focus:border-indigo-500"
                  />
                  <div className="flex gap-1">
                    <input
                      value={editWidth}
                      onChange={(e) => setEditWidth(e.target.value)}
                      placeholder="W"
                      type="number"
                      min={100}
                      className="flex-1 px-2 py-1 text-xs bg-zinc-900 rounded text-zinc-200 outline-none border border-zinc-700 focus:border-indigo-500"
                    />
                    <span className="text-zinc-600 self-center text-xs">×</span>
                    <input
                      value={editHeight}
                      onChange={(e) => setEditHeight(e.target.value)}
                      placeholder="H"
                      type="number"
                      min={100}
                      className="flex-1 px-2 py-1 text-xs bg-zinc-900 rounded text-zinc-200 outline-none border border-zinc-700 focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={saveSlot}
                      className="flex-1 px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingSlot(null)}
                      className="flex-1 px-2 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )
            }
            return (
              <button
                key={idx}
                onDoubleClick={() => startEditSlot(idx)}
                onClick={() => applyPreset(slot.width, slot.height)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                  scene.canvas.width === slot.width && scene.canvas.height === slot.height
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <span className="block">{slot.label}</span>
                <span className="block text-[10px] opacity-60">{slot.width} x {slot.height}</span>
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-zinc-600 mt-1.5">Double-click a slot to edit</p>
      </div>

      {!currentIsPreset && (
        <div className="text-[10px] text-zinc-600 border-t border-zinc-800 pt-2">
          Current: {scene.canvas.width} x {scene.canvas.height}
        </div>
      )}
    </div>
  )
}
