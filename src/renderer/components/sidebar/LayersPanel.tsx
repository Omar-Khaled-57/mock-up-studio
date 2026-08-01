import { useCallback, useState, useMemo } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useRuntimeStore } from '../../runtime/store'
import { useTheme } from '../../hooks/useTheme'
import { ContextMenu, useContextMenu, type ContextMenuItem } from '../shared/ContextMenu'
import type { ElementKind } from '../../store/sceneSlice'
import { Monitor, Type, Image, Hexagon, Eye, EyeOff, Lock, Unlock, Folder, ChevronRight, ChevronDown, ChevronLeft, X } from 'lucide-react'

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
  children: (LayerEntry | { id: string; kind: 'subgroup'; name: string })[]
  parentGroupId: string | null
}

export default function LayersPanel() {
  const { clsx, text, border, bg } = useTheme()
  const scene = useStore(safeScene)
  const scenes = useStore((s) => s.scenes)
  const activeSceneIndex = useStore((s) => s.activeSceneIndex)
  const setActiveSceneIndex = useStore((s) => s.setActiveSceneIndex)
  const selectedIds = useStore((s) => s.selectedIds)
  const select = useStore((s) => s.select)

  const updateDevice = useStore((s) => s.updateDevice)
  const updateTextBox = useStore((s) => s.updateTextBox)
  const updateImage = useStore((s) => s.updateImage)
  const updateShape = useStore((s) => s.updateShape)
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
  const groupSelected = useStore((s) => s.groupSelected)
  const makeParentGroup = useStore((s) => s.makeParentGroup)
  const focusGroupId = useRuntimeStore((s) => s.focusGroupId)
  const enterFocus = useRuntimeStore((s) => s.enterFocus)
  const exitFocus = useRuntimeStore((s) => s.exitFocus)

  const { menu, open: openMenu, close: closeMenu } = useContextMenu()
  const [contextTarget, setContextTarget] = useState<{ id: string; kind: ElementKind; name: string } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const clickTimestamps = useMemo(() => new Map<string, number[]>(), [])

  const makeLayerEntry = (kind: ElementKind, id: string, name: string, visible: boolean, locked: boolean, zIndex: number, groupId: string | null): LayerEntry => ({
    id, kind, name, visible, locked, zIndex, groupId
  })

  const { groupEntries, focusRoot } = useMemo(() => {
    const groups: GroupEntry[] = []
    for (const g of scene.groups) {
      groups.push({ id: g.id, name: g.name, children: [], parentGroupId: g.parentGroupId ?? null })
    }

    const allEntries: { zIndex: number; entry: LayerEntry }[] = [
      ...scene.devices.map((d) => ({ zIndex: d.zIndex, entry: makeLayerEntry('device', d.id, d.name, d.visible, d.locked, d.zIndex, d.groupId) })),
      ...scene.textBoxes.map((t) => ({ zIndex: t.zIndex, entry: makeLayerEntry('textbox', t.id, t.content.slice(0, 20) || 'Text Box', t.visible, t.locked, t.zIndex, t.groupId) })),
      ...scene.images.map((i) => ({ zIndex: i.zIndex, entry: makeLayerEntry('image', i.id, 'Image', i.visible, i.locked, i.zIndex, i.groupId) })),
      ...scene.shapes.map((s) => ({ zIndex: s.zIndex, entry: makeLayerEntry('shape', s.id, s.name || 'Shape', s.visible, s.locked, s.zIndex, s.groupId) }))
    ].sort((a, b) => b.zIndex - a.zIndex)

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

    // Add sub-groups to parent groups
    for (const g of groups) {
      if (g.parentGroupId) {
        const parent = groups.find((p) => p.id === g.parentGroupId)
        if (parent) {
          parent.children.push({ id: g.id, kind: 'subgroup', name: g.name })
        }
      }
    }

    const flatOrphans: GroupEntry[] = orphanEntries.map((e) => ({
      id: e.id,
      name: e.name,
      children: [e],
      parentGroupId: null
    }))

    const result = groups.filter((g) => !g.parentGroupId)
    for (const g of groups) {
      if (g.parentGroupId) continue
      if (g.children.length === 0) continue
      if (!result.some((r) => r.id === g.id)) result.push(g)
    }
    result.push(...flatOrphans.filter((f) => !result.some((r) => r.id === f.id)))

    let focusRoot: GroupEntry | null = null
    if (focusGroupId) {
      const entry = groups.find((g) => g.id === focusGroupId)
      if (entry) focusRoot = { ...entry, parentGroupId: null }
    }

    return {
      groupEntries: result.filter((g) => g.children.length > 0),
      focusRoot
    }
  }, [scene.devices, scene.textBoxes, scene.images, scene.shapes, scene.groups, focusGroupId])

  const totalCount = useMemo(() => {
    const list = focusRoot ? [focusRoot] : groupEntries
    return list.reduce((sum, g) => sum + g.children.length, 0)
  }, [groupEntries, focusRoot])

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
        if (s) updateShape(id, { visible: !s.visible })
      } else {
        const i = scene.images.find((img) => img.id === id)
        if (i) updateImage(id, { visible: !i.visible })
      }
    },
    [scene, updateDevice, updateTextBox, updateImage, updateShape]
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
        if (s) updateShape(id, { locked: !s.locked })
      } else {
        const i = scene.images.find((img) => img.id === id)
        if (i) updateImage(id, { locked: !i.locked })
      }
    },
    [scene, updateDevice, updateTextBox, updateImage, updateShape]
  )

  const startRename = useCallback((id: string, currentName: string) => {
    setRenamingId(id)
    setRenameValue(currentName)
  }, [])

  const commitRename = useCallback(() => {
    if (!renamingId) return
    const trimmed = renameValue.trim()
    if (!trimmed) { setRenamingId(null); return }
    const forGroup = scene.groups.find((g) => g.id === renamingId)
    if (forGroup) {
      renameGroup(renamingId, trimmed)
      pushHistory('Rename group')
    } else {
      const kind = (() => {
        for (const ge of groupEntries) {
          const found = ge.children.find((c) => c.id === renamingId)
          if (found) return found.kind
        }
        return null
      })()
      if (kind === 'device') updateDevice(renamingId, { name: trimmed })
      else if (kind === 'textbox') updateTextBox(renamingId, { name: trimmed })
      else if (kind === 'image') updateImage(renamingId, { name: trimmed })
      else if (kind === 'shape') updateShape(renamingId, { name: trimmed })
      if (kind) pushHistory('Rename')
    }
    setRenamingId(null)
  }, [renamingId, renameValue, groupEntries, scene.groups, renameGroup, pushHistory, updateDevice, updateTextBox, updateImage, updateShape])

  const handleLayerClick = useCallback(
    (e: React.MouseEvent, entry: LayerEntry) => {
      if (e.ctrlKey || e.metaKey) {
        select(entry.id, true)
      } else {
        select(entry.id)
      }
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
          ...(scene.groups.some((g) => g.id !== contextTarget.id && g.parentGroupId === null)
            ? [{ label: 'Make Parent Group', action: () => {
                const other = scene.groups.find((g) => g.id !== contextTarget.id && g.parentGroupId === null)
                if (other) { pushHistory('Make parent group'); makeParentGroup(contextTarget.id, other.id) }
              }}]
            : []),
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
          ...(scene.groups.length > 0
            ? [
                { divider: true, label: '', action: () => {} },
                { label: 'Group', action: () => { pushHistory('Group'); groupSelected(); } },
              ]
            : []),
          ...(scene.groups.some((g) => g.childIds.includes(contextTarget.id))
            ? [{ label: 'Ungroup', action: () => {
                const g = scene.groups.find((gr) => gr.childIds.includes(contextTarget.id))
                if (g) { pushHistory('Ungroup'); ungroup(g.id); clearSelection() }
              }}]
            : []),
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
        const found = ge.children.find((c) => !('kind' in c && c.kind === 'subgroup') && (c as LayerEntry).id === dragId)
        if (found) { sourceKind = (found as LayerEntry).kind; break }
      }
      if (!sourceKind) return
      const targetZ = (() => {
        for (const ge of groupEntries) {
          const found = ge.children.find((c) => !('kind' in c && c.kind === 'subgroup') && (c as LayerEntry).id === id)
          if (found) return (found as LayerEntry).zIndex
        }
        return 0
      })()
      pushHistory('Reorder layer')
      useStore.getState().reorderLayer(dragId, sourceKind, targetZ)
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
    const handleTripleClick = () => {
      const now = Date.now()
      const times = clickTimestamps.get(entry.id) ?? []
      const recent = times.filter(t => now - t < 500)
      recent.push(now)
      clickTimestamps.set(entry.id, recent)
      if (recent.length >= 3) {
        clickTimestamps.set(entry.id, [])
        startRename(entry.id, entry.name)
      }
    }
    return (
      <div
        key={entry.id}
        draggable
        onDragStart={(e) => handleDragStart(e, entry.id)}
        onDragOver={(e) => handleDragOver(e, entry.id)}
        onDrop={(e) => handleDrop(e, entry.id)}
        onClick={(e) => handleLayerClick(e, entry)}
        onContextMenu={(e) => handleContextMenu(e, entry.id, entry.kind, entry.name)}
        style={{ paddingLeft: 8 + depth * 16 }}
        className={clsx("group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150", isSelected ? 'bg-indigo-500/10 border border-indigo-500/20' : clsx("border border-transparent", bg.hover))}
      >
        <span className={clsx("w-4 flex items-center justify-center shrink-0", text.muted)}>
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
            className={clsx("flex-1 px-1 py-0.5 text-xs rounded border outline-none min-w-0", bg.input)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={clsx("flex-1 truncate min-w-0 cursor-pointer", text.primary)}
            onClick={(e) => { e.stopPropagation(); handleTripleClick() }}
          >
            {entry.name}
          </span>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); toggleVisibility(entry.kind, entry.id) }}
          className={clsx("w-4 h-4 flex items-center justify-center transition-colors shrink-0", text.muted)}
          title={entry.visible ? 'Hide' : 'Show'}
        >
          {entry.visible ? <Eye size={11} /> : <EyeOff size={11} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); toggleLock(entry.kind, entry.id) }}
          className={clsx("w-4 h-4 flex items-center justify-center transition-colors shrink-0", text.muted)}
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
      return renderEntry(group.children[0] as LayerEntry, 0)
    }

    const allChildSelected = group.children.every((c) => selectedIds.includes(c.id))
    const someChildSelected = group.children.some((c) => selectedIds.includes(c.id))

    const handleTripleClickGroup = () => {
      const now = Date.now()
      const times = clickTimestamps.get(group.id) ?? []
      const recent = times.filter(t => now - t < 500)
      recent.push(now)
      clickTimestamps.set(group.id, recent)
      if (recent.length >= 3) {
        clickTimestamps.set(group.id, [])
        startRename(group.id, group.name)
      }
    }

    const parentGroup = group.parentGroupId ? scene.groups.find((g) => g.id === group.parentGroupId) : null

    return (
      <div key={group.id}>
        <div
          onClick={(e) => {
            if (e.detail >= 2) enterFocus(group.id)
            else toggleExpand(group.id)
          }}
          onContextMenu={(e) => handleGroupContext(e, group.id, group.name)}
          style={{ paddingLeft: parentGroup ? 24 : 0 }}
          className={clsx("group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150", (allChildSelected || someChildSelected) ? 'bg-purple-500/10 border border-purple-500/20' : clsx("border border-transparent", bg.hover))}
        >
          <span className="w-4 flex items-center justify-center shrink-0">
            {expanded ? <ChevronDown size={12} strokeWidth={2} /> : <ChevronRight size={12} strokeWidth={2} />}
          </span>
          <span className={clsx("w-4 flex items-center justify-center shrink-0", text.muted)}>
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
              className={clsx("flex-1 px-1 py-0.5 text-xs rounded border outline-none min-w-0", bg.input)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className={clsx("flex-1 truncate min-w-0 font-semibold", text.primary)}
              onClick={(e) => { e.stopPropagation(); handleTripleClickGroup() }}
            >
              {group.name}
            </span>
          )}

          <span className={clsx("text-[10px] mr-1", text.muted)}>
            {group.children.length}
          </span>
        </div>
        {expanded && (
          <div className={clsx("ml-2 border-l-2 pl-1", border.secondary)}>
            {group.children.map((child) => {
              if ('kind' in child && child.kind === 'subgroup') {
                const subGroup = groupEntries.find((ge) => ge.id === child.id)
                if (subGroup) return renderGroup(subGroup)
                return null
              }
              return renderEntry(child as LayerEntry, 1)
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className={clsx("flex items-center justify-between gap-2 mb-3 px-1", text.secondary)}>
        <button
          onClick={() => setActiveSceneIndex(Math.max(0, activeSceneIndex - 1))}
          disabled={activeSceneIndex <= 0}
          className={clsx("w-6 h-6 flex items-center justify-center rounded transition-colors", activeSceneIndex > 0 ? clsx(bg.hover, text.primary) : "opacity-30 cursor-default")}
        >
          <ChevronLeft size={14} />
        </button>
        <span className={clsx("text-xs font-semibold truncate", text.primary)}>
          {scenes[activeSceneIndex]?.name ?? 'Scene'}
        </span>
        <button
          onClick={() => setActiveSceneIndex(Math.min(scenes.length - 1, activeSceneIndex + 1))}
          disabled={activeSceneIndex >= scenes.length - 1}
          className={clsx("w-6 h-6 flex items-center justify-center rounded transition-colors", activeSceneIndex < scenes.length - 1 ? clsx(bg.hover, text.primary) : "opacity-30 cursor-default")}
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>
        Layers ({totalCount})
      </h3>
      {focusGroupId && (
        <div
          data-focus-tree-header
          className={clsx("flex items-center justify-between gap-2 mb-2 px-2 py-1.5 rounded-lg border", border.secondary, bg.tertiary)}
        >
          <span className={clsx("text-[11px] font-semibold truncate", text.primary)}>
            Focus: {focusRoot?.name ?? 'Group'}
          </span>
          <button
            type="button"
            aria-label="Exit focus mode"
            onClick={exitFocus}
            className={clsx("w-5 h-5 flex items-center justify-center rounded transition-colors", bg.hover, text.muted)}
          >
            <X size={12} />
          </button>
        </div>
      )}
      {totalCount === 0 ? (
        <p className={clsx("text-[11px]", text.muted)}>No elements on canvas yet</p>
      ) : (
        <div className="space-y-0.5">
          {(focusRoot ? [focusRoot] : groupEntries).map((group) => renderGroup(group))}
        </div>
      )}

      {menu && contextTarget && (
        <ContextMenu items={contextItems} x={menu.x} y={menu.y} onClose={closeMenu} />
      )}
    </div>
  )
}
