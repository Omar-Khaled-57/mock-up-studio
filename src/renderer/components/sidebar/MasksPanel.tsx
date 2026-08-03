import { useCallback, useState } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { nextMaskZIndex } from '../../store/maskSlice'
import { useTheme } from '../../hooks/useTheme'
import { generateId } from '../../lib/id'
import { ICON } from '../../lib/icons'
import type { Mask } from '@shared/types'
import { Plus, Eye, EyeOff, Lock, Unlock, Trash2, Copy, FlipVertical2, RefreshCw } from 'lucide-react'

const SHAPE_LABEL: Record<Mask['shape'], string> = {
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  brush: 'Brush'
}

export default function MasksPanel() {
  const { clsx, text, isLight, bg } = useTheme()
  const scene = useStore(safeScene)
  const updateMask = useStore((s) => s.updateMask)
  const removeMask = useStore((s) => s.removeMask)
  const reverseMask = useStore((s) => s.reverseMask)
  const clearAllMasks = useStore((s) => s.clearAllMasks)
  const refreshMaskSnapshot = useStore((s) => s.refreshMaskSnapshot)
  const pushHistory = useStore((s) => s.pushHistory)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const masks = scene.masks

  const handleAdd = useCallback(() => {
    const state = useStore.getState()
    const scene = safeScene(state)
    const mask: Mask = {
      id: generateId(),
      name: `Mask ${scene.masks.length + 1}`,
      shape: 'rectangle',
      x: 0,
      y: 0,
      width: scene.canvas.width,
      height: scene.canvas.height,
      points: [],
      inverted: true,
      zIndex: nextMaskZIndex(scene),
      visible: true,
      locked: false
    }
    state.pushHistory('Add mask')
    state.addMask(mask)
  }, [])

  const handleToggleVisibility = useCallback(
    (id: string) => {
      const m = masks.find((mask) => mask.id === id)
      if (m) updateMask(id, { visible: !m.visible })
    },
    [masks, updateMask]
  )

  const handleToggleLock = useCallback(
    (id: string) => {
      const m = masks.find((mask) => mask.id === id)
      if (m) updateMask(id, { locked: !m.locked })
    },
    [masks, updateMask]
  )

  const handleDelete = useCallback(
    (id: string) => {
      pushHistory('Remove mask')
      removeMask(id)
    },
    [removeMask, pushHistory]
  )

  const handleDuplicate = useCallback(
    (id: string) => {
      const state = useStore.getState()
      const scene = safeScene(state)
      const m = scene.masks.find((mask) => mask.id === id)
      if (!m) return
      state.pushHistory('Duplicate mask')
      state.addMask({
        ...m,
        id: generateId(),
        name: `${m.name} copy`,
        zIndex: nextMaskZIndex(scene)
      })
    },
    []
  )

  const handleReverse = useCallback(
    (id: string) => {
      pushHistory('Reverse mask')
      reverseMask(id)
    },
    [reverseMask, pushHistory]
  )

  const handleFreeze = useCallback(
    (id: string) => {
      void refreshMaskSnapshot(id)
    },
    [refreshMaskSnapshot]
  )

  const handleClearAll = useCallback(() => {
    if (masks.length === 0) return
    pushHistory('Clear masks')
    clearAllMasks()
  }, [masks.length, clearAllMasks, pushHistory])

  const startRename = useCallback((id: string, currentName: string) => {
    setRenamingId(id)
    setRenameValue(currentName)
  }, [])

  const commitRename = useCallback(() => {
    if (!renamingId) return
    const trimmed = renameValue.trim()
    if (trimmed) {
      pushHistory('Rename mask')
      updateMask(renamingId, { name: trimmed })
    }
    setRenamingId(null)
  }, [renamingId, renameValue, updateMask, pushHistory])

  const cancelRename = useCallback(() => {
    setRenamingId(null)
  }, [])

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Add Mask</h3>
        <button
          onClick={handleAdd}
          className={clsx("w-full flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs rounded-lg transition-all duration-150", bg.button)}
        >
          <Plus size={ICON.micro} strokeWidth={2} />
          Full Canvas Mask
        </button>
        <p className={clsx("mt-1.5 text-[10px] leading-snug", text.muted)}>
          Draw with the Mask tool (G) on canvas to add a freehand, rect or ellipse mask.
        </p>
      </div>

      {/* Mask list */}
      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>
          Masks ({masks.length})
        </h3>
        {masks.length === 0 ? (
          <p className={clsx("text-[11px]", text.muted)}>No masks yet — draw one with the Mask tool</p>
        ) : (
          <div className="space-y-0.5">
            {masks.map((m) => (
              <div
                key={m.id}
                className={clsx(
                  "group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all duration-150",
                  !m.visible ? clsx(bg.tertiary, "opacity-70") : clsx(bg.hover, "border border-transparent")
                )}
              >
                <div className={clsx("flex-1 min-w-0")}>
                  {renamingId === m.id ? (
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
                      className={clsx("flex-1 px-1 py-0.5 text-xs rounded border outline-none min-w-0 w-full", bg.input)}
                    />
                  ) : (
                    <span
                      className={clsx("block truncate", !m.visible ? (isLight ? text.muted : text.tertiary) : (isLight ? text.primary : text.secondary))}
                      onDoubleClick={(e) => { e.stopPropagation(); startRename(m.id, m.name) }}
                    >
                      {m.name}
                    </span>
                  )}
                  <span className={clsx("block text-[10px] capitalize", text.muted)}>
                    {SHAPE_LABEL[m.shape]}
                    {m.inverted ? ' · inverted' : ''}
                  </span>
                </div>

                {/* Actions */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleVisibility(m.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors shrink-0", text.muted)}
                  title={m.visible ? 'Hide' : 'Show'}
                >
                  {m.visible ? <Eye size={ICON.micro} /> : <EyeOff size={ICON.micro} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleLock(m.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors shrink-0", text.muted)}
                  title={m.locked ? 'Unlock' : 'Lock'}
                >
                  {m.locked ? <Lock size={ICON.micro} /> : <Unlock size={ICON.micro} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleReverse(m.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors shrink-0", text.muted)}
                  title={m.inverted ? 'Switch to reveal' : 'Switch to punch'}
                >
                  <FlipVertical2 size={ICON.micro} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleFreeze(m.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors shrink-0", text.muted)}
                  title={m.snapshot ? 'Refresh frozen snapshot' : 'Freeze current canvas'}
                >
                  <RefreshCw size={ICON.micro} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDuplicate(m.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors shrink-0", text.muted)}
                  title="Duplicate"
                >
                  <Copy size={ICON.micro} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(m.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors shrink-0 text-red-400")}
                  title="Delete"
                >
                  <Trash2 size={ICON.micro} />
                </button>
              </div>
            ))}
            <button
              onClick={handleClearAll}
              className={clsx("w-full mt-1 px-2.5 py-1.5 text-[11px] rounded-lg transition-colors", bg.danger)}
            >
              Clear all masks
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
