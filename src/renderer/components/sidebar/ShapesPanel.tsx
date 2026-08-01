import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useTheme } from '../../hooks/useTheme'
import { createDefaultShape } from '../../store/shapeSlice'
import type { ShapeKind } from '@shared/types'
import { Eye, EyeOff, Lock, Unlock, Trash2, Copy, Image as ImageIcon } from 'lucide-react'

function TrapezoidIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" className="inline-block">
      <path d="M3 3h10l2 10H1z" fill="currentColor" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" className="inline-block">
      <path d="M7 2h2v5h5v2H9v5H7V9H2V7h5z" fill="currentColor" />
    </svg>
  )
}

const SHAPE_TYPES: { kind: ShapeKind; label: string; icon: string | ReactNode }[] = [
  { kind: 'rectangle', label: 'Rectangle', icon: '\u25A0' },
  { kind: 'circle', label: 'Circle', icon: '\u25CF' },
  { kind: 'ellipse', label: 'Ellipse', icon: '\u2B2F' },
  { kind: 'triangle', label: 'Triangle', icon: '\u25B2' },
  { kind: 'star', label: 'Star', icon: '\u2605' },
  { kind: 'hexagon', label: 'Hexagon', icon: '\u2B23' },
  { kind: 'diamond', label: 'Diamond', icon: '\u25C6' },
  { kind: 'parallelogram', label: 'Parallel', icon: '\u25B1' },
  { kind: 'trapezoid', label: 'Trapezoid', icon: <TrapezoidIcon /> },
  { kind: 'cross', label: 'Cross', icon: '\u2716' },
  { kind: 'plus', label: 'Plus', icon: <PlusIcon /> },
  { kind: 'heart', label: 'Heart', icon: '\u2665' },
  { kind: 'arrow-right', label: 'Arrow', icon: '\u27A1' }
]

export default function ShapesPanel() {
  const { clsx, text, bg, isLight } = useTheme()
  const scene = useStore(safeScene)
  const selectedIds = useStore((s) => s.selectedIds)
  const select = useStore((s) => s.select)
  const addShape = useStore((s) => s.addShape)
  const updateShape = useStore((s) => s.updateShape)
  const removeShape = useStore((s) => s.removeShape)
  const duplicateSelected = useStore((s) => s.duplicateSelected)
  const pushHistory = useStore((s) => s.pushHistory)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingShapeRef = useRef<string | null>(null)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const shapes = scene.shapes
  const maxZ = shapes.reduce((max, s) => Math.max(max, s.zIndex), -1)

  const selectedShape = selectedIds.length === 1
    ? shapes.find((s) => s.id === selectedIds[0]) ?? null
    : null

  const handleAddShape = useCallback(
    (kind: ShapeKind) => {
      const shape = createDefaultShape(kind, scene.canvas.width, scene.canvas.height)
      shape.zIndex = maxZ + 1
      pushHistory(`Add ${kind}`)
      addShape(shape)
      select(shape.id)
    },
    [scene.canvas, maxZ, addShape, pushHistory, select]
  )

  const handleImageFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      const shapeId = pendingShapeRef.current
      pendingShapeRef.current = null
      if (!file || !shapeId) return
      const reader = new FileReader()
      reader.onload = () => {
        pushHistory('Set shape background image')
        updateShape(shapeId, { backgroundImage: reader.result as string })
      }
      reader.readAsDataURL(file)
      e.target.value = ''
    },
    [updateShape, pushHistory]
  )

  const handleSetImage = useCallback((shapeId: string) => {
    pendingShapeRef.current = shapeId
    fileInputRef.current?.click()
  }, [])

  const handleRemoveImage = useCallback(
    (shapeId: string) => {
      pushHistory('Remove shape background')
      updateShape(shapeId, { backgroundImage: null })
    },
    [updateShape, pushHistory]
  )

  const handleToggleVisibility = useCallback(
    (id: string) => {
      const s = shapes.find((sh) => sh.id === id)
      if (s) updateShape(id, { visible: !s.visible })
    },
    [shapes, updateShape]
  )

  const handleToggleLock = useCallback(
    (id: string) => {
      const s = shapes.find((sh) => sh.id === id)
      if (s) updateShape(id, { locked: !s.locked })
    },
    [shapes, updateShape]
  )

  const handleDelete = useCallback(
    (id: string) => {
      pushHistory('Delete shape')
      removeShape(id)
    },
    [removeShape, pushHistory]
  )

  const handleDuplicate = useCallback(
    (id: string) => {
      pushHistory('Duplicate shape')
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
      pushHistory('Rename shape')
      updateShape(renamingId, { name: trimmed })
    }
    setRenamingId(null)
  }, [renamingId, renameValue, updateShape, pushHistory])

  const cancelRename = useCallback(() => {
    setRenamingId(null)
  }, [])

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFile}
      />

      {/* Add shape buttons */}
      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Add Shape</h3>
        <div className="grid grid-cols-5 gap-1.5">
          {SHAPE_TYPES.map((st) => (
            <button
              key={st.kind}
              onClick={() => handleAddShape(st.kind)}
              className={clsx("flex flex-col items-center gap-0.5 px-1 py-2 text-xs rounded-lg transition-all duration-150", bg.button)}
              title={`Add ${st.label}`}
            >
              <span className="text-lg leading-none">{st.icon}</span>
              <span className="text-[8px] leading-tight text-center">{st.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Shape list */}
      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>
          Shapes ({shapes.length})
        </h3>
        {shapes.length === 0 ? (
          <p className={clsx("text-[11px]", text.muted)}>No shapes yet — click a shape above to add one</p>
        ) : (
          <div className="space-y-0.5">
            {shapes.map((s, i) => (
              <div
                key={s.id}
                onClick={() => select(s.id)}
                className={clsx("group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150", selectedShape?.id === s.id ? 'bg-indigo-500/10 border border-indigo-500/20' : clsx('bg.hover', 'border border-transparent'))}
              >
                {/* Shape icon */}
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <div
                    className="w-3.5 h-3.5 rounded-sm"
                    style={{
                      backgroundColor: s.color,
                      opacity: s.opacity / 100,
                      borderRadius: s.kind === 'circle' ? '50%' : s.cornerRadius > 0 ? `${Math.min(s.cornerRadius, 4)}px` : 0,
                      clipPath: s.kind === 'triangle' ? 'polygon(50% 0%, 100% 100%, 0% 100%)'
                        : s.kind === 'star' ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
                        : undefined
                    }}
                  />
                </div>

                {/* Name + image indicator */}
                {renamingId === s.id ? (
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
                    className={clsx("flex-1 truncate flex items-center gap-1", !s.visible ? text.muted : text.primary)}
                    onDoubleClick={(e) => { e.stopPropagation(); startRename(s.id, s.name || `Shape ${i + 1}`) }}
                  >
                    {s.name || `Shape ${i + 1}`}
                    {s.backgroundImage && <ImageIcon size={9} className={clsx("shrink-0", text.muted)} />}
                  </span>
                )}

                {/* Actions */}
                <button
                  onClick={(e) => { e.stopPropagation(); if (s.backgroundImage) { handleRemoveImage(s.id) } else { handleSetImage(s.id) } }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors", s.backgroundImage ? "text-indigo-500 hover:text-indigo-400" : "text-zinc-500 hover:text-zinc-400")}
                  title={s.backgroundImage ? 'Remove image' : 'Set background image'}
                >
                  <ImageIcon size={10} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleVisibility(s.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors", text.muted)}
                  title={s.visible ? 'Hide' : 'Show'}
                >
                  {s.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleLock(s.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors", text.muted)}
                  title={s.locked ? 'Unlock' : 'Lock'}
                >
                  {s.locked ? <Lock size={11} /> : <Unlock size={11} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDuplicate(s.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors", text.muted)}
                  title="Duplicate"
                >
                  <Copy size={11} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors", isLight ? "text-zinc-400 hover:text-red-600" : "text-zinc-600 hover:text-red-400")}
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
