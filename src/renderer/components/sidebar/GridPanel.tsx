import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'

export default function GridPanel() {
  const grid = useStore((s) => safeScene(s).grid)
  const updateGrid = useStore((s) => s.updateGrid)
  const clearGuides = useStore((s) => s.clearGuides)

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Grid</h3>

      <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
        <input
          type="checkbox"
          checked={grid.enabled}
          onChange={(e) => updateGrid({ enabled: e.target.checked })}
          className="rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500/50"
        />
        Show grid
      </label>

      {grid.enabled && (
        <>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Grid size (px)</label>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={grid.size}
              onChange={(e) => updateGrid({ size: Number(e.target.value) })}
              className="w-full accent-blue-500"
            />
            <span className="text-xs text-zinc-500">{grid.size}px</span>
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Grid color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={grid.color.slice(0, 7)}
                onChange={(e) => updateGrid({ color: e.target.value + '33' })}
                className="w-8 h-8 rounded border border-zinc-700 cursor-pointer"
              />
              <span className="text-xs text-zinc-500">{grid.color}</span>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={grid.snapEnabled}
              onChange={(e) => updateGrid({ snapEnabled: e.target.checked })}
              className="rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500/50"
            />
            Snap to grid
          </label>
        </>
      )}

      <div className="border-t border-zinc-800 pt-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Guides</h3>
        <button
          onClick={clearGuides}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Clear all guides
        </button>
      </div>
    </div>
  )
}
