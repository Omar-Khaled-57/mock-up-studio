import { useCallback, useState, useMemo } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useTheme } from '../../hooks/useTheme'
import { ContextMenu, useContextMenu, type ContextMenuItem } from '../shared/ContextMenu'
import type { ElementKind } from '../../store/sceneSlice'
import { Monitor, Type, Image, Hexagon, Eye, EyeOff, Lock, Unlock, Folder, ChevronRight, ChevronDown } from 'lucide-react'

interface LayerEntry {
  id: string
  kind: ElementKind
  name: string
  visible: boolean
  locked: boolean
  zIndex: number
  groupId: string | null
  parentGroupId?: string
}

interface GroupEntry {
  id: string
  name: string
  children: LayerEntry[]
}

export default function LayersPanel() {
  const { isLight, clsx } = useTheme()
  const scene = useStore(safeScene)
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
  const clearSelection = useStore((s) => s.clearSelection)
  const ungroup = useStore((s) => s.ungroup)
  const renameGroup = useStore((s) => s.renameGroup)
  const duplicateGroup = useStore((s) => s.duplicateGroup)

  const { menu, open: openMenu, close: closeMenu } = useContextMenu()
  const [contextTarget, setContextTarget] = useState<{ id: string; kind: ElementKind; name: string } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const makeLayerEntry = (kind: ElementKind, id: string, name: string, visible: boolean, locked: boolean, zIndex: number, groupId: string | null): LayerEntry => ({
    id, kind, name, visible, locked, zIndex, groupId
  })

  const groupEntries: GroupEntry[] = useMemo(() => {
    const groups: GroupEntry[] = scene.groups.map((g) => ({
      id: g.id,
      name: g.name,
      children: []
    }))

    const allEntries: { zIndex: number; entry: LayerEntry }[] = [
      ...scene.devices.map((d) => ({ zIndex: d.zIndex, entry: makeLayerEntry('device', d.id, d.name, d.visible, d.locked, d.zIndex, d.groupId) })),
      ...scene.textBoxes.map((t) => ({ zIndex: t.zIndex, entry: makeLayerEntry('textbox', t.id, t.content.slice(0, 20) || 'Text Box', t.visible, t.locked, t.zIndex, t.groupId) })),
      ...scene.images.map((i) => ({ zIndex: i.zIndex, entry: makeLayerEntry('image', i.id, 'Image', i.visible, i.locked, i.zIndex, i.groupId) })),
      ...scene.shapes.map((s) => ({ zIndex: s.zIndex, entry: makeLayerEntry('shape', s.id, s.name || 'Shape', s.visible, s.locked, s.zIndex, s.groupId) }))
    ].sort((a, b) => b.zIndex - a.zIndex)

    groups.length = 0
    for (const g of scene.groups) {
      groups.push({ id: g.id, name: g.name, children: [] })
    }

    const orphanEntries: LayerEntry[] = []

    for (const { entry } of allEntries) {
      if (entry.groupId) {
        const parent = groups.find((g) => g.id === entry.groupId)
        if (parent) {
          parent.children.push(entry)
        } else {
          orphanEntries.push(entry)
        }
      } else {
        orphanEntries.push(entry)
      }
    }

    const flatOrphans: GroupEntry[] = orphanEntries.map((e) => ({
      id: e.id,
      name: e.name,
      children: [e]
    }))

    const result = [...groups, ...flatOrphans]
    return result.filter((g) => g.children.length > 0)
  }, [scene.devices, scene.textBoxes, scene.images, scene.shapes, scene.groups])

  const totalCount = useMemo(() =>
    groupEntries.reduce((sum, g) => sum + g.children.length, 0),
    [groupEntries]
  )

  const toggleVisibility = useCallback(
    (kind: ElementKind, id: string) => {
      if (kind === 'device') {
        const d = scene.devices.find((dev) => dev.id === id)
        if (d) updateDevice(id, { visible: !d.visible })
      } else if (kind === 'textbox') {
        const t = scene.textBoxes.find((tb) => tb.id === id)
        if (t) updateTextBox(id, { visible: !t.visible })
      } else if (kind === 'shape') {
        const s = scene.shapes.find((sh) => sh.id === id)
        if (s) useStore.getState().updateShape(id, { visible: !s.visible })
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
      } else if (kind === 'shape') {
        const s = scene.shapes.find((sh) => sh.id === id)
        if (s) useStore.getState().updateShape(id, { locked: !s.locked })
      } else {
        const i = scene.images.find((img) => img.id === id)
        if (i) updateImage(id, { locked: !i.locked })
      }
    },
    [scene, updateDevice, updateTextBox, updateImage]
  )

  const startRename = useCallback((id: string, currentName: string) => {
    setRenamingId(id)
    setRenameValue(currentName)
  }, [])

  const commitRename = useCallback(() => {
    if (!renamingId) return
    const forGroup = scene.groups.find((g) => g.id === renamingId)
    if (forGroup) {
      renameGroup(renamingId, renameValue)
      pushHistory('Rename group')
    } else {
      const kind = (() => {
        for (const ge of groupEntries) {
          const found = ge.children.find((c) => c.id === renamingId)
          if (found) return found.kind
        }
        return null
      })()
      if (kind === 'device') updateDevice(renamingId, { name: renameValue })
    }
    setRenamingId(null)
  }, [renamingId, renameValue, groupEntries, scene.groups, renameGroup, pushHistory, updateDevice])

  const handleLayerClick = useCallback(
    (entry: LayerEntry) => {
      select(entry.id)
    },
    [select]
  )

  const toggleExpand = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, id: string, kind: ElementKind, name: string) => {
      setContextTarget({ id, kind, name })
      openMenu(e)
    },
    [openMenu]
  )

  const handleGroupContext = useCallback(
    (e: React.MouseEvent, groupId: string, groupName: string) => {
      setContextTarget({ id: groupId, kind: 'group', name: groupName })
      openMenu(e)
    },
    [openMenu]
  )

  const contextItems: ContextMenuItem[] = contextTarget
    ? contextTarget.kind === 'group'
      ? [
          { label: 'Rename', action: () => startRename(contextTarget.id, contextTarget.name) },
          { label: 'Duplicate Group', action: () => { pushHistory('Duplicate group'); duplicateGroup(contextTarget.id) } },
          { divider: true, label: '', action: () => {} },
          { label: 'Ungroup', action: () => { pushHistory('Ungroup'); ungroup(contextTarget.id); clearSelection() } },
          { divider: true, label: '', action: () => {} },
          { label: 'Delete Group', danger: true, action: () => { pushHistory('Ungroup'); ungroup(contextTarget.id); clearSelection() } }
        ]
      : [
          { label: 'Rename', action: () => startRename(contextTarget.id, contextTarget.name) },
          { label: 'Duplicate', action: () => { pushHistory('Duplicate'); duplicateSelected([contextTarget.id]) } },
          { divider: true, label: '', action: () => {} },
          { label: 'Bring to Front', action: () => { pushHistory('Bring to Front'); bringToFront(contextTarget.id) } },
          { label: 'Send to Back', action: () => { pushHistory('Send to Back'); sendToBack(contextTarget.id) } },
          { label: 'Bring Forward', action: () => { pushHistory('Bring Forward'); bringForward(contextTarget.id) } },
          { label: 'Send Backward', action: () => { pushHistory('Send Backward'); sendBackward(contextTarget.id) } },
          { divider: true, label: '', action: () => {} },
          { label: 'Delete', danger: true, action: () => { pushHistory('Delete'); deleteSelected([contextTarget.id]) } }
        ]
    : []

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent, id: string) => {
      e.preventDefault()
      if (!dragId || dragId === id) return
      e.dataTransfer.dropEffect = 'move'
    },
    [dragId]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, id: string) => {
      e.preventDefault()
      if (!dragId || dragId === id) return
      let sourceKind: ElementKind | null = null
      for (const ge of groupEntries) {
        const found = ge.children.find((c) => c.id === dragId)
        if (found) { sourceKind = found.kind; break }
      }
      if (!sourceKind) return
      const targetZ = (() => {
        for (const ge of groupEntries) {
          const found = ge.children.find((c) => c.id === id)
          if (found) return found.zIndex
        }
        return 0
      })()
      useStore.getState().reorderLayer(dragId, sourceKind, targetZ)
      pushHistory('Reorder layer')
      setDragId(null)
    },
    [dragId, groupEntries, pushHistory]
  )

  const kindIcon = (kind: ElementKind) => {
    if (kind === 'device') return <Monitor size={14} strokeWidth={1.5} />
    if (kind === 'textbox') return <Type size={14} strokeWidth={1.5} />
    if (kind === 'shape') return <Hexagon size={14} strokeWidth={1.5} />
    return <Image size={14} strokeWidth={1.5} />
  }

  const renderEntry = (entry: LayerEntry, depth: number) => {
    const isSelected = selectedIds.includes(entry.id)
    return (
      <div
        key={entry.id}
        draggable
        onDragStart={(e) => handleDragStart(e, entry.id)}
        onDragOver={(e) => handleDragOver(e, entry.id)}
        onDrop={(e) => handleDrop(e, entry.id)}
        onClick={() => handleLayerClick(entry)}
        onContextMenu={(e) => handleContextMenu(e, entry.id, entry.kind, entry.name)}
        style={{ paddingLeft: 8 + depth * 16 }}
        className={clsx("group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150", isSelected ? 'bg-indigo-500/10 border border-indigo-500/20' : isLight ? "hover:bg-zinc-100 border border-transparent" : "hover:bg-zinc-800/60 border border-transparent")}
      >
        <span className={clsx("w-4 flex items-center justify-center shrink-0", isLight ? "text-zinc-400" : "text-zinc-500")}>
          {kindIcon(entry.kind)}
        </span>

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
            className={clsx("flex-1 px-1 py-0.5 text-xs rounded border outline-none min-w-0", isLight ? "bg-white text-zinc-800 border-zinc-300" : "bg-zinc-900 text-zinc-200 border-zinc-600")}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={clsx("flex-1 truncate min-w-0", isLight ? "text-zinc-800" : "text-zinc-300")}>
            {entry.name}
          </span>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); toggleVisibility(entry.kind, entry.id) }}
          className={clsx("w-4 h-4 flex items-center justify-center transition-colors shrink-0", isLight ? "text-zinc-400 hover:text-zinc-700" : "text-zinc-600 hover:text-zinc-300")}
          title={entry.visible ? 'Hide' : 'Show'}
        >
          {entry.visible ? <Eye size={11} /> : <EyeOff size={11} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); toggleLock(entry.kind, entry.id) }}
          className={clsx("w-4 h-4 flex items-center justify-center transition-colors shrink-0", isLight ? "text-zinc-400 hover:text-zinc-700" : "text-zinc-600 hover:text-zinc-300")}
          title={entry.locked ? 'Unlock' : 'Lock'}
        >
          {entry.locked ? <Lock size={11} /> : <Unlock size={11} />}
        </button>
      </div>
    )
  }

  const renderGroup = (group: GroupEntry) => {
    const isGroupNode = scene.groups.some((g) => g.id === group.id)
    const expanded = expandedGroups.has(group.id)

    if (!isGroupNode) {
      return renderEntry(group.children[0], 0)
    }

    const allChildSelected = group.children.every((c) => selectedIds.includes(c.id))
    const someChildSelected = group.children.some((c) => selectedIds.includes(c.id))

    return (
      <div key={group.id}>
        <div
          onClick={() => toggleExpand(group.id)}
          onContextMenu={(e) => handleGroupContext(e, group.id, group.name)}
          className={clsx("group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150", (allChildSelected || someChildSelected) ? 'bg-purple-500/10 border border-purple-500/20' : isLight ? "hover:bg-zinc-100 border border-transparent" : "hover:bg-zinc-800/60 border border-transparent")}
        >
          <span className="w-4 flex items-center justify-center shrink-0">
            {expanded ? <ChevronDown size={12} strokeWidth={2} /> : <ChevronRight size={12} strokeWidth={2} />}
          </span>
          <span className={clsx("w-4 flex items-center justify-center shrink-0", isLight ? "text-zinc-400" : "text-zinc-500")}>
            <Folder size={14} strokeWidth={1.5} className="text-purple-500" />
          </span>

          {renamingId === group.id ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setRenamingId(null)
              }}
              className={clsx("flex-1 px-1 py-0.5 text-xs rounded border outline-none min-w-0", isLight ? "bg-white text-zinc-800 border-zinc-300" : "bg-zinc-900 text-zinc-200 border-zinc-600")}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={clsx("flex-1 truncate min-w-0 font-semibold", isLight ? "text-zinc-800" : "text-zinc-300")}>
              {group.name}
            </span>
          )}

          <span className={clsx("text-[10px] mr-1", isLight ? "text-zinc-400" : "text-zinc-500")}>
            {group.children.length}
          </span>
        </div>
        {expanded && (
          <div className="ml-2 border-l-2 pl-1" style={{ borderColor: isLight ? '#e4e4e7' : '#3f3f46' }}>
            {group.children.map((child) => renderEntry(child, 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", isLight ? "text-zinc-600" : "text-zinc-400")}>
        Layers ({totalCount})
      </h3>
      {totalCount === 0 ? (
        <p className={clsx("text-[11px]", isLight ? "text-zinc-400" : "text-zinc-600")}>No elements on canvas yet</p>
      ) : (
        <div className="space-y-0.5">
          {groupEntries.map((group) => renderGroup(group))}
        </div>
      )}

      {menu && contextTarget && (
        <ContextMenu items={contextItems} x={menu.x} y={menu.y} onClose={closeMenu} />
      )}
    </div>
  )
}
