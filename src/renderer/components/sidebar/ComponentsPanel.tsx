/**
 * ComponentsPanel — Global component library browser.
 *
 * Features (Step 4):
 *   - Searchbar filters by component name
 *   - Default/Custom toggle: ON = two sections; OFF = flat list
 *   - Groups as collapsible accordions
 *   - Click component → places it centered on canvas
 *   - Triple-click group name → inline rename
 *   - Right-click component → context menu (Rename, Delete)
 *   - Right-click group → context menu (Rename, Delete)
 *   - + New Group button
 */

import { useCallback, useMemo, useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../store'
import { useRuntimeStore } from '../../runtime/store'
import { useTheme } from '../../hooks/useTheme'
import { ComponentDefinition } from '@shared/types'
import { placeComponentAt } from '../../lib/component-utils'
import { Search, Plus, ChevronDown, ChevronRight, Trash2, Pencil, ArrowUpDown, LayoutGrid, Image, Type, Hexagon, Paintbrush, Package } from 'lucide-react'
import ComponentDeleteDialog from '../shared/ComponentDeleteDialog'

type SortMode = 'name-asc' | 'name-desc' | 'newest' | 'oldest'
type GroupMode = 'section' | 'kind' | 'type' | 'none'

export default function ComponentsPanel() {
  const { clsx, text, bg, border } = useTheme()

  const definitions = useStore((s) => s.definitions)
  const groups = useStore((s) => s.groups)
  const updateComponentDefinition = useStore((s) => s.updateComponentDefinition)
  const addComponentGroup = useStore((s) => s.addComponentGroup)
  const removeComponentGroup = useStore((s) => s.removeComponentGroup)
  const renameComponentGroup = useStore((s) => s.renameComponentGroup)
  const moveComponentToGroup = useStore((s) => s.moveComponentToGroup)

  const [search, setSearch] = useState('')
  const [showDefault, setShowDefault] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortMode>('name-asc')
  const [groupBy, setGroupBy] = useState<GroupMode>('section')
  const [sortOpen, setSortOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)

  // Inline rename state
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null)
  const [renameGroupValue, setRenameGroupValue] = useState('')
  const [renamingDefId, setRenamingDefId] = useState<string | null>(null)
  const [renameDefValue, setRenameDefValue] = useState('')

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; kind: 'component' | 'group'; id: string } | null>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)

  // Triple-click tracking for group rename
  const groupClickTracker = useRef<Map<string, number>>(new Map())

  // Filtered and sorted definitions
  const filtered = useMemo(() => {
    let result = definitions
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((d) => d.name.toLowerCase().includes(q))
    }
    switch (sortBy) {
      case 'name-asc':
        result = [...result].sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'name-desc':
        result = [...result].sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'newest':
        result = [...result].sort((a, b) => b.createdAt - a.createdAt)
        break
      case 'oldest':
        result = [...result].sort((a, b) => a.createdAt - b.createdAt)
        break
    }
    return result
  }, [definitions, search, sortBy])

  // Grouped definitions (sort order inherited from filtered)
  const groupedByGroup = useMemo(() => {
    const map = new Map<string, ComponentDefinition[]>()
    for (const def of filtered) {
      const list = map.get(def.groupId) ?? []
      list.push(def)
      map.set(def.groupId, list)
    }
    return map
  }, [filtered])

  // Default vs custom groups
  const defaultGroups = useMemo(() => groups.filter((g) => g.isDefault), [groups])
  const customGroups = useMemo(() => groups.filter((g) => !g.isDefault), [groups])

  // Kind-based grouping
  const groupedByKind = useMemo(() => {
    const map = new Map<string, ComponentDefinition[]>()
    for (const def of filtered) {
      const list = map.get(def.kind) ?? []
      list.push(def)
      map.set(def.kind, list)
    }
    return map
  }, [filtered])

  // Type-based grouping (by user-defined typeTag)
  const groupedByType = useMemo(() => {
    const map = new Map<string, ComponentDefinition[]>()
    for (const def of filtered) {
      const tag = def.typeTag || 'Uncategorized'
      const list = map.get(tag) ?? []
      list.push(def)
      map.set(tag, list)
    }
    return map
  }, [filtered])

  const kindLabels: Record<string, string> = {
    image: 'Images',
    text: 'Text',
    shape: 'Shapes',
    brush: 'Brush',
    group: 'Groups'
  }

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  // --- Placement ---

  const placeComponent = useCallback((def: ComponentDefinition, dropX?: number, dropY?: number) => {
    placeComponentAt(def, dropX, dropY)
  }, [])

  // --- Context menu ---

  const handleCtxMenu = useCallback((e: React.MouseEvent, kind: 'component' | 'group', id: string) => {
    e.preventDefault()
    e.stopPropagation()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let x = e.clientX
    let y = e.clientY
    if (x + 160 > vw) x = vw - 164
    if (y + 180 > vh) y = vh - 184
    if (x < 0) x = 4
    if (y < 0) y = 4
    setCtxMenu({ x, y, kind, id })
  }, [])

  const closeCtxMenu = useCallback(() => setCtxMenu(null), [])

  // Clamp context menu to viewport via direct DOM manipulation (no state update = no hover delay)
  useLayoutEffect(() => {
    if (!ctxMenu || !ctxMenuRef.current) return
    const el = ctxMenuRef.current
    const rect = el.getBoundingClientRect()
    const margin = 4
    let x = ctxMenu.x
    let y = ctxMenu.y
    if (x + rect.width > window.innerWidth - margin) x = window.innerWidth - rect.width - margin
    if (y + rect.height > window.innerHeight - margin) y = window.innerHeight - rect.height - margin
    if (x < margin) x = margin
    if (y < margin) y = margin
    el.style.left = `${x}px`
    el.style.top = `${y}px`
  }, [ctxMenu])

  // Close context menu on outside click
  useLayoutEffect(() => {
    if (!ctxMenu) return
    const handleClick = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setCtxMenu(null)
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [ctxMenu])

  const handleCtxRename = useCallback(() => {
    if (!ctxMenu) return
    if (ctxMenu.kind === 'component') {
      const def = definitions.find((d) => d.id === ctxMenu.id)
      if (def) {
        setRenamingDefId(def.id)
        setRenameDefValue(def.name)
      }
    } else {
      const g = groups.find((gr) => gr.id === ctxMenu.id)
      if (g) {
        setRenamingGroupId(g.id)
        setRenameGroupValue(g.name)
      }
    }
    setCtxMenu(null)
  }, [ctxMenu, definitions, groups])

  // --- Delete dialog state ---
  const [deleteDialogDef, setDeleteDialogDef] = useState<ComponentDefinition | null>(null)

  const handleCtxDelete = useCallback(() => {
    if (!ctxMenu) return
    if (ctxMenu.kind === 'component') {
      const def = definitions.find((d) => d.id === ctxMenu.id)
      if (def) setDeleteDialogDef(def)
    } else {
      removeComponentGroup(ctxMenu.id)
    }
    setCtxMenu(null)
  }, [ctxMenu, definitions, removeComponentGroup])

  const handleCtxMoveToGroup = useCallback((targetGroupId: string) => {
    if (!ctxMenu || ctxMenu.kind !== 'component') return
    moveComponentToGroup(ctxMenu.id, targetGroupId)
    setCtxMenu(null)
  }, [ctxMenu, moveComponentToGroup])

  // --- Group name triple-click ---

  const handleGroupNameClick = useCallback((groupId: string) => {
    const now = Date.now()
    const last = groupClickTracker.current.get(groupId) ?? 0
    if (now - last < 500) {
      // Triple-click: start renaming
      const g = groups.find((gr) => gr.id === groupId)
      if (g) {
        setRenamingGroupId(g.id)
        setRenameGroupValue(g.name)
      }
      groupClickTracker.current.delete(groupId)
    } else {
      toggleGroupCollapse(groupId)
      groupClickTracker.current.set(groupId, now)
    }
  }, [groups, toggleGroupCollapse])

  // --- Commit inline renames ---

  const commitGroupRename = useCallback(() => {
    if (renamingGroupId && renameGroupValue.trim()) {
      renameComponentGroup(renamingGroupId, renameGroupValue.trim())
    }
    setRenamingGroupId(null)
  }, [renamingGroupId, renameGroupValue, renameComponentGroup])

  const commitDefRename = useCallback(() => {
    if (renamingDefId && renameDefValue.trim()) {
      updateComponentDefinition(renamingDefId, { name: renameDefValue.trim() })
    }
    setRenamingDefId(null)
  }, [renamingDefId, renameDefValue, updateComponentDefinition])

  // --- Render a group section ---

  const renderGroup = (groupId: string, groupName: string) => {
    const defs = groupedByGroup.get(groupId) ?? []
    const collapsed = collapsedGroups.has(groupId)
    const isEmpty = defs.length === 0

    return (
      <div key={groupId} className="mb-1">
        <button
          onClick={() => handleGroupNameClick(groupId)}
          onContextMenu={(e) => handleCtxMenu(e, 'group', groupId)}
          className={clsx(
            "w-full flex items-center gap-1.5 px-1.5 py-1.5 rounded text-[11px] font-medium transition-colors",
            text.secondary,
            bg.hover
          )}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          {renamingGroupId === groupId ? (
            <input
              autoFocus
              value={renameGroupValue}
              onChange={(e) => setRenameGroupValue(e.target.value)}
              onBlur={commitGroupRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitGroupRename()
                if (e.key === 'Escape') setRenamingGroupId(null)
              }}
              onClick={(e) => e.stopPropagation()}
              className={clsx(
                "flex-1 min-w-0 px-1 py-0.5 rounded text-[11px] outline-none",
                bg.primary,
                text.primary,
                border.primary
              )}
            />
          ) : (
            <span className="flex-1 text-left truncate">{groupName}</span>
          )}
          <span className={clsx("text-[10px]", text.muted)}>{defs.length}</span>
        </button>
        {!collapsed && (
          isEmpty ? (
            <div className={clsx("pl-3 pt-1 pb-1 text-[10px] italic", text.muted)}>
              Empty — drag a unit here
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 pl-3 pt-1">
              {defs.map((def) => renderThumb(def))}
            </div>
          )
        )}
      </div>
    )
  }

  const handleThumbDragStart = useCallback((e: React.DragEvent, def: ComponentDefinition) => {
    e.dataTransfer.setData('application/x-mockup-unit-id', def.id)
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  const renderThumb = (def: ComponentDefinition) => (
    <button
      key={def.id}
      draggable
      onDragStart={(e) => handleThumbDragStart(e, def)}
      onClick={() => placeComponent(def)}
      onContextMenu={(e) => handleCtxMenu(e, 'component', def.id)}
      className={clsx(
        "flex flex-col items-center rounded p-1.5 transition-colors",
        bg.hover,
        border.primary
      )}
      title={def.name}
    >
      <div className={clsx(
        "w-full aspect-square rounded overflow-hidden flex items-center justify-center",
        bg.tertiary
      )}>
        {def.thumbnail ? (
          <img
            src={def.thumbnail}
            alt={def.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <span>{def.kind === 'image' ? <Image className="w-5 h-5" /> : def.kind === 'text' ? <Type className="w-5 h-5" /> : def.kind === 'shape' ? <Hexagon className="w-5 h-5" /> : def.kind === 'brush' ? <Paintbrush className="w-5 h-5" /> : <Package className="w-5 h-5" />}</span>
        )}
      </div>
      {renamingDefId === def.id ? (
        <input
          autoFocus
          value={renameDefValue}
          onChange={(e) => setRenameDefValue(e.target.value)}
          onBlur={commitDefRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitDefRename()
            if (e.key === 'Escape') setRenamingDefId(null)
          }}
          onClick={(e) => e.stopPropagation()}
          className={clsx(
            "w-full mt-0.5 px-1 py-0.5 rounded text-[10px] outline-none text-center",
            bg.primary,
            text.primary,
            border.primary
          )}
        />
      ) : (
        <span className={clsx("text-[10px] mt-0.5 truncate w-full text-center", text.secondary)}>
          {def.name}
        </span>
      )}
    </button>
  )

  const hasVisible = filtered.length > 0

  return (
    <div className="flex flex-col gap-2 h-full" onClick={closeCtxMenu}>
      {/* Searchbar */}
      <div className="relative">
        <Search size={13} className={clsx("absolute left-2 top-1/2 -translate-y-1/2", text.muted)} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search units…"
          className={clsx(
            "w-full pl-7 pr-2 py-1.5 rounded text-[11px] outline-none",
            bg.primary,
            text.primary,
            border.primary
          )}
        />
      </div>

      {/* Sort + Group By */}
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <button
            onClick={() => { setSortOpen((o) => !o); setGroupOpen(false) }}
            className={clsx(
              "flex items-center gap-1.5 w-full px-2 py-1 rounded text-[11px] transition-colors",
              bg.tertiary, text.secondary, bg.hover
            )}
          >
            <ArrowUpDown size={11} />
            <span className="flex-1 text-left truncate">{
              sortBy === 'name-asc' ? 'Name A–Z' : sortBy === 'name-desc' ? 'Name Z–A' : sortBy === 'newest' ? 'Newest' : 'Oldest'
            }</span>
            <ChevronDown size={10} />
          </button>
          {sortOpen && (
            <div className={clsx("absolute z-40 mt-0.5 w-full rounded py-1", bg.panel, border.primary)} style={{ boxShadow: '0 2px 12px -2px rgba(99,102,241,0.25), 0 1px 4px -1px rgba(0,0,0,0.3)' }}>
              {(['name-asc', 'name-desc', 'newest', 'oldest'] as SortMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setSortBy(mode); setSortOpen(false) }}
                  className={clsx(
                    "w-full text-left px-2.5 py-1 text-[11px]",
                    sortBy === mode ? bg.selected : text.secondary,
                    sortBy === mode ? '' : bg.hover
                  )}
                >
                  {mode === 'name-asc' ? 'Name A–Z' : mode === 'name-desc' ? 'Name Z–A' : mode === 'newest' ? 'Newest first' : 'Oldest first'}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative flex-1">
          <button
            onClick={() => { setGroupOpen((o) => !o); setSortOpen(false) }}
            className={clsx(
              "flex items-center gap-1.5 w-full px-2 py-1 rounded text-[11px] transition-colors",
              bg.tertiary, text.secondary, bg.hover
            )}
          >
            <LayoutGrid size={11} />
            <span className="flex-1 text-left truncate">{
              groupBy === 'section' ? 'By section' : groupBy === 'kind' ? 'By kind' : groupBy === 'type' ? 'By type' : 'No groups'
            }</span>
            <ChevronDown size={10} />
          </button>
          {groupOpen && (
            <div className={clsx("absolute z-40 mt-0.5 w-full rounded py-1", bg.panel, border.primary)} style={{ boxShadow: '0 2px 12px -2px rgba(99,102,241,0.25), 0 1px 4px -1px rgba(0,0,0,0.3)' }}>
              {(['section', 'kind', 'type', 'none'] as GroupMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setGroupBy(mode); setGroupOpen(false) }}
                  className={clsx(
                    "w-full text-left px-2.5 py-1 text-[11px]",
                    groupBy === mode ? bg.selected : text.secondary,
                    groupBy === mode ? '' : bg.hover
                  )}
                >
                  {mode === 'section' ? 'By section' : mode === 'kind' ? 'By kind' : mode === 'type' ? 'By type' : 'No groups'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Close sort/groupby popups on outside click */}
      {(sortOpen || groupOpen) && (
        <div className="fixed inset-0 z-30" onClick={() => { setSortOpen(false); setGroupOpen(false) }} />
      )}

      {/* Toggle (only relevant in section mode) */}
      {groupBy === 'section' && (
        <label className={clsx("flex items-center gap-2 text-[11px]", text.secondary)}>
          <input
            type="checkbox"
            checked={showDefault}
            onChange={(e) => setShowDefault(e.target.checked)}
            className="custom-checkbox"
          />
          Show Default & Custom sections
        </label>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!hasVisible && (
          <div className={clsx("text-center text-[11px] py-8", text.muted)}>
            {search ? 'No matching units' : 'No units yet'}
          </div>
        )}

        {groupBy === 'none' ? (
          <div className="grid grid-cols-2 gap-1.5">
            {filtered.map((def) => renderThumb(def))}
          </div>
        ) : groupBy === 'kind' ? (
          <div>
            {(['group', 'shape', 'text', 'image', 'brush'] as const).map((kind) => {
              const defs = groupedByKind.get(kind)
              if (!defs || defs.length === 0) return null
              return (
                <div key={kind} className="mb-2">
                  <div className={clsx("text-[10px] uppercase tracking-wider font-medium mb-1 px-1", text.muted)}>
                    {kindLabels[kind]}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pl-1 pt-1">
                    {defs.map((def) => renderThumb(def))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : groupBy === 'type' ? (
          <div>
            {[...groupedByType.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([tag, defs]) => (
              <div key={tag} className="mb-2">
                <div className={clsx("text-[10px] uppercase tracking-wider font-medium mb-1 px-1", text.muted)}>
                  {tag}
                </div>
                <div className="grid grid-cols-2 gap-1.5 pl-1 pt-1">
                  {defs.map((def) => renderThumb(def))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* section mode */
          showDefault ? (
            <>
              {defaultGroups.length > 0 && (
                <div className="mb-2">
                  <div className={clsx("text-[10px] uppercase tracking-wider font-medium mb-1 px-1", text.muted)}>
                    Default Units
                  </div>
                  {defaultGroups.map((g) => renderGroup(g.id, g.name))}
                </div>
              )}
              {customGroups.length > 0 && (
                <div>
                  <div className={clsx("text-[10px] uppercase tracking-wider font-medium mb-1 px-1", text.muted)}>
                    Custom Units
                  </div>
                  {customGroups.map((g) => renderGroup(g.id, g.name))}
                </div>
              )}
              {(() => {
                const knownIds = new Set(groups.map((g) => g.id))
                const orphaned = filtered.filter((d) => !knownIds.has(d.groupId))
                if (orphaned.length === 0) return null
                return (
                  <div className="mb-2">
                    <div className={clsx("text-[10px] uppercase tracking-wider font-medium mb-1 px-1", text.muted)}>
                      Ungrouped
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pl-3 pt-1">
                      {orphaned.map((def) => renderThumb(def))}
                    </div>
                  </div>
                )
              })()}
            </>
          ) : (
            /* flat mode: all in one grid */
            <div className="grid grid-cols-2 gap-1.5">
              {filtered.map((def) => renderThumb(def))}
            </div>
          )
        )}
      </div>

      {/* New Group button */}
      <button
        onClick={() => addComponentGroup(`Group ${customGroups.length + 1}`, false)}
        className={clsx(
          "flex items-center justify-center gap-1.5 w-full py-1.5 rounded text-[11px] font-medium transition-colors",
          bg.tertiary,
          text.secondary,
          bg.hover
        )}
      >
        <Plus size={12} />
        New Group
      </button>

      {/* Context menu — portaled to body so it escapes overflow and re-renders */}
      {ctxMenu && createPortal(
        <div
          ref={ctxMenuRef}
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          className={clsx("fixed z-50 min-w-[120px] rounded shadow-lg py-1", bg.panel, border.primary)}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCtxRename}
            className={clsx("flex items-center gap-2 w-full px-3 py-1.5 text-[11px]", text.secondary, bg.hover)}
          >
            <Pencil size={11} />
            Rename
          </button>
          {ctxMenu.kind === 'component' && (
            <>
              <button
                onClick={() => {
                  useRuntimeStore.getState().selectDefinition(ctxMenu.id)
                  setCtxMenu(null)
                }}
                className={clsx("flex items-center gap-2 w-full px-3 py-1.5 text-[11px]", text.secondary, bg.hover)}
              >
                Edit Properties
              </button>
              {groups.length > 1 && (() => {
                const def = definitions.find((d) => d.id === ctxMenu.id)
                const otherGroups = groups.filter((g) => g.id !== def?.groupId)
                if (otherGroups.length === 0) return null
                return (
                  <div className="border-t border-white/[0.06] pt-1 mt-1">
                    <div className={clsx("px-3 py-1 text-[10px] uppercase tracking-wider", text.muted)}>Move to group</div>
                    {otherGroups.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => handleCtxMoveToGroup(g.id)}
                        className={clsx("flex items-center gap-2 w-full px-3 py-1.5 text-[11px]", text.secondary, bg.hover)}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                )
              })()}
            </>
          )}
          <button
            onClick={handleCtxDelete}
            disabled={ctxMenu.kind === 'group' && groups.length <= 1}
            className={clsx(
              "flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-500/10",
              ctxMenu.kind === 'group' && groups.length <= 1 && "opacity-30 cursor-not-allowed"
            )}
          >
            <Trash2 size={11} />
            Delete
          </button>
        </div>,
        document.body
      )}

      <ComponentDeleteDialog
        open={!!deleteDialogDef}
        definitionId={deleteDialogDef?.id ?? null}
        definitionName={deleteDialogDef?.name ?? ''}
        onClose={() => setDeleteDialogDef(null)}
      />
    </div>
  )
}
