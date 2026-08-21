/**
 * ComponentCreationModal — modal picker for saving a scene element as a
 * reusable component definition. Name input + type combobox + group dropdown.
 *
 * Opened from three entry points:
 *   - Select tool context menu → "Add to Units"
 *   - Properties Panel → Advanced → "Save as Unit"
 *   - Layers Panel context menu → "Add to Units"
 *
 * History contract: pushHistory BEFORE the mutation (inside addComponent).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Modal from '../primitives/Modal'
import { useStore } from '../../store'
import { allTypeTags } from '../../store/componentSlice'
import { safeScene } from '../../store/sceneSlice'
import { useRuntimeStore } from '../../runtime/store'
import { useTheme } from '../../hooks/useTheme'
import { renderThumbnail } from '../../lib/default-components'
import { generateId } from '../../lib/id'
import { Device, TextBox, ImageOverlay, Shape } from '@shared/types'

// ---------------------------------------------------------------------------
// Element → ComponentData serialization
// ---------------------------------------------------------------------------

function serializeElement(el: Device | TextBox | ImageOverlay | Shape) {
  if ('screenImage' in el) return null
  if ('content' in el && 'fontSize' in el) {
    const t = el as TextBox
    return {
      kind: 'text' as const,
      content: t.content,
      fontFamily: t.fontFamily,
      fontSize: t.fontSize,
      fontWeight: t.fontWeight,
      color: t.color,
      textAlign: t.textAlign,
      lineHeight: t.lineHeight,
      letterSpacing: t.letterSpacing,
      wordSpacing: t.wordSpacing,
      textTransform: t.textTransform,
      wrap: t.wrap,
      heightAuto: t.heightAuto,
      shadow: t.shadow,
      glow: t.glow,
      strokeColor: t.strokeColor,
      strokeWidth: t.strokeWidth,
      gradient: t.gradient,
      backgroundVisible: t.backgroundVisible,
      borderRadius: t.borderRadius,
      border: t.borderColor,
      backgroundColor: t.backgroundColor,
      width: t.width,
      height: t.height
    }
  }
  if ('blendMode' in el) {
    const i = el as ImageOverlay
    return {
      kind: 'image' as const,
      src: i.src,
      width: i.width,
      height: i.height,
      opacity: i.opacity,
      blendMode: i.blendMode,
      flipX: i.flipX,
      flipY: i.flipY,
      blur: i.blur,
      glow: i.glow,
      shadow: i.shadow,
      borderRadius: i.borderRadius,
      effects: i.effects
    }
  }
  if ('kind' in el && 'cornerRadius' in el && 'gradient' in el) {
    const s = el as Shape
    return {
      kind: 'shape' as const,
      shapeKind: s.kind,
      width: s.width,
      height: s.height,
      color: s.color,
      gradient: s.gradient,
      cornerRadius: s.cornerRadius,
      angles: s.angles,
      crossThickness: s.crossThickness,
      plusThickness: s.plusThickness,
      arrowThickness: s.arrowThickness,
      opacity: s.opacity,
      backgroundImage: s.backgroundImage,
      blur: s.blur,
      glow: s.glow,
      shadow: s.shadow,
      effects: s.effects
    }
  }
  return null
}

function resolveElementById(
  scene: ReturnType<typeof safeScene>,
  elementId: string
): Device | TextBox | ImageOverlay | Shape | null {
  const d = scene.devices.find((e) => e.id === elementId)
  if (d) return d
  const t = scene.textBoxes.find((e) => e.id === elementId)
  if (t) return t
  const i = scene.images.find((e) => e.id === elementId)
  if (i) return i
  const s = scene.shapes.find((e) => e.id === elementId)
  if (s) return s
  return null
}

const KIND_DEFAULT_TYPE: Record<string, string> = {
  text: 'Text',
  shape: 'Shape',
  image: 'Image'
}

// ---------------------------------------------------------------------------
// Type Combobox — editable input with portal autocomplete dropdown
// ---------------------------------------------------------------------------

function TypeCombobox({
  value,
  onChange,
  suggestions,
  clsx,
  bg,
  text: textToken,
  border
}: {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  clsx: (...classes: (string | false | null | undefined)[]) => string
  bg: { primary: string; hover: string; tertiary: string }
  text: { primary: string; secondary: string; muted: string }
  border: { primary: string }
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 })

  const filtered = useMemo(() => {
    if (!draft.trim()) return suggestions
    const q = draft.toLowerCase()
    return suggestions.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== draft.toLowerCase())
  }, [draft, suggestions])

  const updatePosition = useCallback(() => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setPanelPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
  }, [])

  // Sync draft when external value changes (e.g. on modal open)
  useEffect(() => { setDraft(value) }, [value])

  useEffect(() => {
    if (open) updatePosition()
  }, [open, updatePosition])

  const commit = useCallback(() => {
    const trimmed = draft.trim()
    if (trimmed) onChange(trimmed)
    else onChange(value) // revert to last committed value
    setOpen(false)
  }, [draft, onChange, value])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (panelRef.current && panelRef.current.contains(target)) return
      if (inputRef.current && inputRef.current.contains(target)) return
      commit()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDraft(value); setOpen(false) }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, commit, value])

  const showDropdown = open && (filtered.length > 0 || draft.trim().length > 0)

  const dropdown = showDropdown ? createPortal(
    <div
      ref={panelRef}
      className={clsx(
        'fixed z-[9500] rounded-lg border py-1',
        bg.primary, border.primary
      )}
      style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width, boxShadow: '0 8px 24px -4px rgba(99,102,241,0.15), 0 4px 12px -2px rgba(0,0,0,0.4)' }}
    >
      <div className="max-h-[140px] overflow-y-auto">
        {filtered.map((tag) => (
          <button
            key={tag}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              setDraft(tag)
              onChange(tag)
              setOpen(false)
            }}
            className={clsx(
              'w-full text-left px-2.5 py-1.5 text-[12px] transition-colors flex items-center gap-2',
              tag.toLowerCase() === draft.toLowerCase()
                ? 'bg-indigo-600/20 text-indigo-300'
                : clsx(textToken.secondary, bg.hover)
            )}
          >
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full shrink-0',
              tag.toLowerCase() === draft.toLowerCase() ? 'bg-indigo-400' : 'bg-zinc-600'
            )} />
            {tag}
          </button>
        ))}
        {draft.trim().length > 0 && !suggestions.some((s) => s.toLowerCase() === draft.trim().toLowerCase()) && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              const v = draft.trim()
              onChange(v)
              setOpen(false)
            }}
            className="w-full text-left px-2.5 py-1.5 text-[12px] text-indigo-400 hover:bg-indigo-500/10 transition-colors flex items-center gap-2"
          >
            <span className="text-[10px]">+</span>
            Create "{draft.trim()}"
          </button>
        )}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          if (!open) setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Tab' && open) { e.preventDefault(); commit() }
        }}
        placeholder="e.g. button, badge, card..."
        className={clsx(
          'w-full px-2.5 py-1.5 rounded-md text-[12px] outline-none border',
          'focus:ring-1 focus:ring-indigo-500/50 transition-colors',
          bg.primary, bg.hover, textToken.primary, border.primary
        )}
      />
      {dropdown}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filterable Group Dropdown — portaled to avoid overflow clipping
// ---------------------------------------------------------------------------

function FilterableGroupSelect({
  groups,
  value,
  onChange,
  onNewGroup,
  clsx,
  bg,
  text: textToken,
  border
}: {
  groups: { id: string; name: string }[]
  value: string
  onChange: (id: string) => void
  onNewGroup: () => void
  clsx: (...classes: (string | false | null | undefined)[]) => string
  bg: { primary: string; hover: string; tertiary: string }
  text: { primary: string; secondary: string; muted: string }
  border: { primary: string }
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 })

  const selected = groups.find((g) => g.id === value)

  const filtered = useMemo(() => {
    if (!filter.trim()) return groups
    const q = filter.toLowerCase()
    return groups.filter((g) => g.name.toLowerCase().includes(q))
  }, [groups, filter])

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPanelPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
  }, [])

  useEffect(() => {
    if (open) {
      updatePosition()
      setFilter('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (panelRef.current && panelRef.current.contains(target)) return
      if (triggerRef.current && triggerRef.current.contains(target)) return
      setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const dropdown = open ? createPortal(
    <div
      ref={panelRef}
      className={clsx(
        'fixed z-[9500] rounded-lg border py-1',
        bg.primary, border.primary
      )}
      style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width, boxShadow: '0 8px 24px -4px rgba(99,102,241,0.15), 0 4px 12px -2px rgba(0,0,0,0.4)' }}
    >
      <div className="px-2 pb-1">
        <input
          ref={inputRef}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter groups..."
          className={clsx(
            'w-full px-2 py-1.5 rounded-md text-[11px] outline-none border',
            bg.tertiary, textToken.primary, border.primary
          )}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'Enter' && filtered.length === 1) {
              onChange(filtered[0].id)
              setOpen(false)
            }
          }}
        />
      </div>
      <div className="max-h-[160px] overflow-y-auto">
        {filtered.length === 0 && (
          <div className={clsx('px-2.5 py-2 text-[11px] text-center', textToken.muted)}>No matching groups</div>
        )}
        {filtered.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => { onChange(g.id); setOpen(false) }}
            className={clsx(
              'w-full text-left px-2.5 py-1.5 text-[12px] transition-colors flex items-center gap-2',
              g.id === value
                ? 'bg-indigo-600/20 text-indigo-300'
                : clsx(textToken.secondary, bg.hover)
            )}
          >
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full shrink-0',
              g.id === value ? 'bg-indigo-400' : 'bg-zinc-600'
            )} />
            {g.name}
          </button>
        ))}
      </div>
      <div className={clsx('border-t mx-2', border.primary)} />
      <button
        type="button"
        onClick={() => { onNewGroup(); setOpen(false) }}
        className="w-full text-left px-2.5 py-1.5 text-[12px] font-medium text-indigo-400 hover:bg-indigo-500/10 transition-colors"
      >
        + New Group
      </button>
    </div>,
    document.body
  ) : null

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] text-left outline-none transition-colors border',
          bg.primary, bg.hover, textToken.primary, border.primary
        )}
      >
        <span className="flex-1 truncate">{selected?.name ?? 'Select group'}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" className={clsx('shrink-0 opacity-50 transition-transform', open && 'rotate-180')}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {dropdown}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inner form — mounts only when open; owns all scene/state subscriptions.
// ---------------------------------------------------------------------------

function ComponentCreationForm({ onClose }: { onClose: () => void }) {
  const { clsx, text, bg, border } = useTheme()

  const [name, setName] = useState('')
  const [typeTag, setTypeTag] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [creating, setCreating] = useState(false)

  const modal = useRuntimeStore((s) => s.componentCreationModal)
  const definitions = useStore((s) => s.definitions)
  const groups = useStore((s) => s.groups)
  const addComponent = useStore((s) => s.addComponent)
  const addComponentGroup = useStore((s) => s.addComponentGroup)
  const pushHistory = useStore((s) => s.pushHistory)
  const scenes = useStore((s) => s.scenes)
  const activeSceneIndex = useStore((s) => s.activeSceneIndex)

  const autoName = useMemo(() => `Unit ${definitions.length + 1}`, [definitions.length])
  const typeSuggestions = useMemo(() => allTypeTags(definitions), [definitions])

  const scene = useMemo(
    () => scenes[Math.min(activeSceneIndex, scenes.length - 1)],
    [scenes, activeSceneIndex]
  )

  const elementKind = useMemo(() => {
    if (!modal || !scene) return null
    const el = resolveElementById(scene, modal.elementId)
    if (!el) return null
    const data = serializeElement(el)
    return data?.kind ?? null
  }, [modal, scene])

  useEffect(() => {
    if (modal) {
      setName(autoName)
      setTypeTag(elementKind ? (KIND_DEFAULT_TYPE[elementKind] ?? '') : '')
      setSelectedGroupId(groups[0]?.id ?? '')
      setCreating(false)
    }
  }, [modal, autoName, groups, elementKind])

  const handleCreate = useCallback(() => {
    if (!modal || !scene) return
    const el = resolveElementById(scene, modal.elementId)
    if (!el) return

    const data = serializeElement(el)
    const kind = data?.kind ?? null
    if (!data || !kind) return

    setCreating(true)

    let groupId = selectedGroupId
    if (!groupId && groups.length > 0) {
      groupId = groups[0].id
    }

    pushHistory('Create unit')
    const thumb = renderThumbnail({
      id: generateId(), name: name.trim() || autoName, groupId: groupId ?? '',
      kind, thumbnail: '', createdAt: 0, updatedAt: 0, data,
    })
    addComponent(data, name.trim() || autoName, groupId, thumb, kind, typeTag.trim() || undefined)

    setCreating(false)
    onClose()
  }, [modal, scene, selectedGroupId, groups, name, autoName, typeTag, pushHistory, addComponent, onClose])

  const handleNewGroup = useCallback(() => {
    const group = addComponentGroup(`Group ${groups.length + 1}`, false)
    setSelectedGroupId(group.id)
  }, [addComponentGroup, groups.length])

  return (
    <Modal open title="Add to Units" onClose={onClose} width={400}>
      <div className="flex flex-col gap-4">
        {/* Unit Name */}
        <div className="flex flex-col gap-1.5">
          <label className={clsx('text-[11px] font-semibold uppercase tracking-wider', text.muted)}>Unit Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            placeholder={autoName}
            className={clsx(
              'w-full px-2.5 py-1.5 rounded-md text-[12px] outline-none border',
              'focus:ring-1 focus:ring-indigo-500/50 transition-colors',
              bg.primary, bg.hover, text.primary, border.primary
            )}
          />
        </div>

        {/* Type */}
        <div className="flex flex-col gap-1.5">
          <label className={clsx('text-[11px] font-semibold uppercase tracking-wider', text.muted)}>Type</label>
          <TypeCombobox
            value={typeTag}
            onChange={setTypeTag}
            suggestions={typeSuggestions}
            clsx={clsx}
            bg={bg}
            text={text}
            border={border}
          />
        </div>

        {/* Group */}
        <div className="flex flex-col gap-1.5">
          <label className={clsx('text-[11px] font-semibold uppercase tracking-wider', text.muted)}>Group</label>
          <FilterableGroupSelect
            groups={groups}
            value={selectedGroupId}
            onChange={setSelectedGroupId}
            onNewGroup={handleNewGroup}
            clsx={clsx}
            bg={bg}
            text={text}
            border={border}
          />
        </div>

        {/* Actions */}
        <div className={clsx('flex justify-end gap-2 pt-3 border-t', border.primary)}>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className={clsx(
              'px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors',
              bg.hover, text.secondary
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className={clsx(
              'px-4 py-1.5 rounded-md text-[12px] font-medium text-white transition-colors',
              'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50'
            )}
          >
            {creating ? 'Creating...' : 'Create Unit'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Outer shell — subscribes only to the cheap boolean/null modal state.
// Scene subscriptions live inside ComponentCreationForm (mounts only when open).
// ---------------------------------------------------------------------------

export default function ComponentCreationModal() {
  const modal = useRuntimeStore((s) => s.componentCreationModal)
  const close = useRuntimeStore((s) => s.closeComponentCreationModal)

  if (!modal) return null
  return <ComponentCreationForm onClose={close} />
}
