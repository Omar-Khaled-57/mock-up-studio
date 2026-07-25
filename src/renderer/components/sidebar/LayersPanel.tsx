import { useCallback, useState } from 'react'
import { useStore } from '../../store'
import { generateId } from '../../lib/id'
import { ContextMenu, useContextMenu, type ContextMenuItem } from '../shared/ContextMenu'

type ElementKind = 'device' | 'textbox' | 'image'

interface LayerEntry {
  id: string
  kind: ElementKind
  name: string
  visible: boolean
  locked: boolean
  zIndex: number
}

export default function LayersPanel() {
  const scene = useStore((s) => s.scenes[s.activeSceneIndex])
  const selectedIds = useStore((s) => s.selectedIds)
  const select = useStore((s) => s.select)
  const updateDevice = useStore((s) => s.updateDevice)
  const updateTextBox = useStore((s) => s.updateTextBox)
  const updateImage = useStore((s) => s.updateImage)
  const deleteSelected = useStore((s) => s.deleteSelected)
  const duplicateSelected = useStore((s) => s.duplicateSelected)
  const bringToFront = useStore((s) => s.bringToFront)
  const sendToBack = useStore((s) => s.sendToBack)
  const bringForward = useStore((s) => s.bringForward)
  const sendBackward = useStore((s) => s.sendBackward)
  const pushHistory = useStore((s) => s.pushHistory)

  const { menu, open: openMenu, close: closeMenu } = useContextMenu()
  const [contextTarget, setContextTarget] = useState<LayerEntry | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)

  const entries: LayerEntry[] = [
    ...scene.devices.map((d) => ({ id: d.id, kind: 'device' as const, name: d.name, visible: d.visible, locked: d.locked, zIndex: d.zIndex })),
    ...scene.textBoxes.map((t) => ({ id: t.id, kind: 'textbox' as const, name: t.content.slice(0, 20) || 'Text Box', visible: t.visible, locked: t.locked, zIndex: t.zIndex })),
    ...scene.images.map((i) => ({ id: i.id, kind: 'image' as const, name: 'Image', visible: i.visible, locked: i.locked, zIndex: i.zIndex }))
  ].sort((a, b) => b.zIndex - a.zIndex)

  const toggleVisibility = useCallback(
    (kind: ElementKind, id: string) => {
      if (kind === 'device') {
        const d = scene.devices.find((dev) => dev.id === id)
        if (d) updateDevice(id, { visible: !d.visible })
      } else if (kind === 'textbox') {
        const t = scene.textBoxes.find((tb) => tb.id === id)
        if (t) updateTextBox(id, { visible: !t.visible })
      } else {
        const i = scene.images.find((img) => img.id === id)
        if (i) updateImage(id, { visible: !i.visible })
      }
    },
    [scene, updateDevice, updateTextBox, updateImage]
  )

  const toggleLock = useCallback(
    (kind: ElementKind, id: string) => {
      if (kind === 'device') {
        const d = scene.devices.find((dev) => dev.id === id)
        if (d) updateDevice(id, { locked: !d.locked })
      } else if (kind === 'textbox') {
        const t = scene.textBoxes.find((tb) => tb.id === id)
        if (t) updateTextBox(id, { locked: !t.locked })
      } else {
        const i = scene.images.find((img) => img.id === id)
        if (i) updateImage(id, { locked: !i.locked })
      }
    },
    [scene, updateDevice, updateTextBox, updateImage]
  )

  const startRename = useCallback((entry: LayerEntry) => {
    setRenamingId(entry.id)
    setRenameValue(entry.name)
  }, [])

  const commitRename = useCallback(() => {
    if (!renamingId) return
    const kind = entries.find((e) => e.id === renamingId)?.kind
    if (!kind) return
    if (kind === 'device') updateDevice(renamingId, { name: renameValue })
    setRenamingId(null)
  }, [renamingId, renameValue, entries, updateDevice])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, entry: LayerEntry) => {
      setContextTarget(entry)
      openMenu(e)
    },
    [openMenu]
  )

  const contextItems: ContextMenuItem[] = contextTarget
    ? [
        { label: 'Rename', action: () => startRename(contextTarget) },
        { label: 'Duplicate', action: () => { duplicateSelected([contextTarget.id]); pushHistory('Duplicate') } },
        { divider: true, label: '', action: () => {} },
        { label: 'Bring to Front', action: () => { bringToFront(contextTarget.id); pushHistory('Bring to Front') } },
        { label: 'Send to Back', action: () => { sendToBack(contextTarget.id); pushHistory('Send to Back') } },
        { label: 'Bring Forward', action: () => { bringForward(contextTarget.id); pushHistory('Bring Forward') } },
        { label: 'Send Backward', action: () => { sendBackward(contextTarget.id); pushHistory('Send Backward') } },
        { divider: true, label: '', action: () => {} },
        { label: 'Delete', danger: true, action: () => { deleteSelected([contextTarget.id]); pushHistory('Delete') } }
      ]
    : []

  const handleDragStart = useCallback((e: React.DragEvent, entry: LayerEntry) => {
    setDragId(entry.id)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetEntry: LayerEntry) => {
      e.preventDefault()
      if (!dragId || dragId === targetEntry.id) return
      e.dataTransfer.dropEffect = 'move'
    },
    [dragId]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, targetEntry: LayerEntry) => {
      e.preventDefault()
      if (!dragId || dragId === targetEntry.id) return
      const sourceKind = entries.find((en) => en.id === dragId)?.kind
      if (!sourceKind) return
      const targetZ = targetEntry.zIndex
      useStore.getState().reorderLayer(dragId, sourceKind, targetZ)
      pushHistory('Reorder layer')
      setDragId(null)
    },
    [dragId, entries, pushHistory]
  )

  const kindIcon = (kind: ElementKind) => {
    if (kind === 'device') return '📱'
    if (kind === 'textbox') return 'T'
    return '🖼'
  }

  return (
    <div>
      <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-2">
        Layers ({entries.length})
      </h3>
      <div className="space-y-0.5">
        {entries.map((entry) => (
          <div
            key={entry.id}
            draggable
            onDragStart={(e) => handleDragStart(e, entry)}
            onDragOver={(e) => handleDragOver(e, entry)}
            onDrop={(e) => handleDrop(e, entry)}
            onClick={() => select(entry.id)}
            onContextMenu={(e) => handleContextMenu(e, entry)}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
              selectedIds.includes(entry.id)
                ? 'bg-indigo-600/20 border border-indigo-500/30'
                : 'hover:bg-zinc-800 border border-transparent'
            }`}
          >
            <span className="text-[10px] w-4 text-center opacity-60">{kindIcon(entry.kind)}</span>

            {renamingId === entry.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') setRenamingId(null)
                }}
                className="flex-1 px-1 py-0.5 text-xs bg-zinc-900 text-zinc-200 rounded border border-zinc-600 outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className={`flex-1 truncate ${!entry.visible ? 'text-zinc-600' : 'text-zinc-300'}`}>
                {entry.name}
              </span>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); toggleVisibility(entry.kind, entry.id) }}
              className="w-4 h-4 flex items-center justify-center text-[9px] text-zinc-500 hover:text-zinc-300"
              title={entry.visible ? 'Hide' : 'Show'}
            >
              {entry.visible ? '👁' : '—'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleLock(entry.kind, entry.id) }}
              className="w-4 h-4 flex items-center justify-center text-[9px] text-zinc-500 hover:text-zinc-300"
              title={entry.locked ? 'Unlock' : 'Lock'}
            >
              {entry.locked ? '🔒' : '🔓'}
            </button>
          </div>
        ))}
      </div>

      {menu && contextTarget && (
        <ContextMenu items={contextItems} x={menu.x} y={menu.y} onClose={closeMenu} />
      )}
    </div>
  )
}
