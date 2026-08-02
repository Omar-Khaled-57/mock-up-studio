import { useState, useCallback } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useTheme } from '../../hooks/useTheme'
import { ICON } from '../../lib/icons'
import { Trash2, Plus, Minus } from 'lucide-react'
import { getHexColorWithOpacity, getOpacityPercentFromColor } from '../../lib/color-utils'

export default function GridPanel() {
  const { clsx, bg, text, border: borderT } = useTheme()
  const grid = useStore((s) => safeScene(s).grid)
  const scene = useStore(safeScene)
  const updateGrid = useStore((s) => s.updateGrid)
  const addGuide = useStore((s) => s.addGuide)
  const removeGuide = useStore((s) => s.removeGuide)
  const clearGuides = useStore((s) => s.clearGuides)
  const pushHistory = useStore((s) => s.pushHistory)

  const handleAddHorizontal = useCallback(() => {
    pushHistory('Add guide')
    addGuide('horizontal', Math.round(scene.canvas.height / 2))
  }, [addGuide, pushHistory, scene.canvas.height])

  const handleAddVertical = useCallback(() => {
    pushHistory('Add guide')
    addGuide('vertical', Math.round(scene.canvas.width / 2))
  }, [addGuide, pushHistory, scene.canvas.width])

  const handleDeleteGuide = useCallback((id: string) => {
    pushHistory('Delete guide')
    removeGuide(id)
  }, [removeGuide, pushHistory])

  const showRulers = useStore((s) => s.showRulers)
  const toggleRulers = useStore((s) => s.toggleRulers)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="space-y-4">
      <h3 className={clsx("text-xs font-semibold uppercase tracking-wider", text.secondary)}>Grid</h3>

      <label className={clsx("flex items-center gap-2 text-sm cursor-pointer", text.primary)}>
        <input
          type="checkbox"
          checked={grid.enabled}
          onChange={(e) => updateGrid({ enabled: e.target.checked })}
          className="custom-checkbox"
        />
        Show grid
      </label>

      {grid.enabled && (
        <>
          <div>
            <label className={clsx("text-xs mb-1 block", text.tertiary)}>Grid size (px)</label>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={grid.size}
              onChange={(e) => updateGrid({ size: Number(e.target.value) })}
              className="w-full accent-blue-500"
            />
            <span className={clsx("text-xs", text.tertiary)}>{grid.size}px</span>
          </div>

          <div>
            <label className={clsx("text-xs mb-1 block", text.tertiary)}>Grid color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={grid.color.slice(0, 7)}
                onChange={(e) => updateGrid({ color: getHexColorWithOpacity(e.target.value, getOpacityPercentFromColor(grid.color, 100)) })}
                className={clsx("w-8 h-8 rounded border cursor-pointer shrink-0", borderT.secondary)}
              />
              <input
                type="text"
                value={grid.color}
                onChange={(e) => {
                  const v = e.target.value
                  if (/^#[0-9a-fA-F]{0,8}$/.test(v) || v === '') updateGrid({ color: v })
                }}
                className={clsx("flex-1 px-1.5 py-0.5 text-[10px] font-mono rounded outline-none min-w-0", bg.input)}
                placeholder="#rrggbbaa"
              />
            </div>
          </div>

          <div>
            <label className={clsx("text-xs mb-1 block", text.tertiary)}>Grid opacity</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(getOpacityPercentFromColor(grid.color, (grid.opacity ?? 1) * 100))}
                onChange={(e) => {
                  const nextPercent = Number(e.target.value)
                  updateGrid({
                    color: getHexColorWithOpacity(grid.color, nextPercent),
                    opacity: nextPercent / 100,
                  })
                }}
                className="w-full accent-blue-500"
              />
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={Math.round(getOpacityPercentFromColor(grid.color, (grid.opacity ?? 1) * 100))}
                onChange={(e) => {
                  const nextPercent = Number(e.target.value)
                  updateGrid({
                    color: getHexColorWithOpacity(grid.color, nextPercent),
                    opacity: nextPercent / 100,
                  })
                }}
                className={clsx("w-16 px-1.5 py-0.5 text-[10px] font-mono rounded outline-none", bg.input)}
              />
              <span className={clsx("text-xs shrink-0", text.tertiary)}>%</span>
            </div>
          </div>

          <div>
            <label className={clsx("text-xs mb-1 block", text.tertiary)}>Grid style</label>
            <div className="flex gap-1">
              <button
                onClick={() => updateGrid({ style: 'dotted' })}
                className={clsx("flex-1 px-2 py-1 text-xs rounded border transition-colors", grid.style === 'dotted' ? bg.selected : bg.button)}
                >
                  Dotted
                </button>
                <button
                  onClick={() => updateGrid({ style: 'lines' })}
                  className={clsx("flex-1 px-2 py-1 text-xs rounded border transition-colors", grid.style === 'lines' ? bg.selected : bg.button)}
              >
                Lines
              </button>
            </div>
          </div>

      <label className={clsx("flex items-center gap-2 text-sm cursor-pointer", text.primary)}>
        <input
          type="checkbox"
          checked={grid.snapEnabled}
          onChange={(e) => updateGrid({ snapEnabled: e.target.checked })}
          className="custom-checkbox"
        />
        Snap to grid
      </label>
        </>
      )}

      <label className={clsx("flex items-center gap-2 text-sm cursor-pointer", text.primary)}>
        <input
          type="checkbox"
          checked={showRulers}
          onChange={() => toggleRulers()}
          className="custom-checkbox"
        />
        Show rulers
      </label>

      <div className={clsx("border-t pt-3", borderT.primary)}>
        <div className="flex items-center justify-between mb-2">
          <h3 className={clsx("text-xs font-semibold uppercase tracking-wider", text.secondary)}>Guides</h3>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={clsx("transition-colors", text.muted)}
          >
            {collapsed ? <Plus size={14} /> : <Minus size={14} />}
          </button>
        </div>

        {!collapsed && (
          <div className="space-y-1.5">
            <div className="flex gap-1">
              <button
                onClick={handleAddHorizontal}
                className={clsx("flex-1 px-2 py-1 text-[10px] rounded border transition-colors", bg.button)}
                >
                  + Horizontal
                </button>
                <button
                  onClick={handleAddVertical}
                  className={clsx("flex-1 px-2 py-1 text-[10px] rounded border transition-colors", bg.button)}
                >
                  + Vertical
                </button>
            </div>

            {scene.guides.length === 0 ? (
              <p className={clsx("text-[10px]", text.muted)}>No guides. Add one above or drag from the ruler.</p>
            ) : (
              <div className="space-y-0.5 max-h-[160px] overflow-y-auto">
                {scene.guides.map((g) => (
                  <div key={g.id} className={clsx("flex items-center justify-between px-2 py-1 rounded text-[10px]", bg.hover)}>
                    <span className={clsx("truncate", text.primary)}>
                      <span className={clsx("inline-block w-1 h-1 rounded-full mr-1.5", g.orientation === 'horizontal' ? "bg-pink-400" : "bg-cyan-400")} />
                      {g.orientation === 'horizontal' ? 'H' : 'V'} — {g.position}px
                    </span>
                    <button
                      onClick={() => handleDeleteGuide(g.id)}
                      className={clsx("shrink-0 transition-colors text-red-400")}
                    >
                      <Trash2 size={ICON.micro} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {scene.guides.length > 0 && (
              <button
                onClick={() => { pushHistory('Clear guides'); clearGuides() }}
                className={clsx("text-[10px] transition-colors text-red-400")}
                  >
                    Clear all
                  </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
