import { useState, useCallback, useRef, useLayoutEffect, useEffect } from 'react'
import { useStore } from '../../store'
import { useTheme } from '../../hooks/useTheme'
import { ICON } from '../../lib/icons'
import { Plus, Copy, Trash2, Pin, PinOff, Pencil, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'

export default function SceneTabs({ chrome = false }: { chrome?: boolean }) {
  const scenes = useStore((s) => s.scenes)
  const activeSceneIndex = useStore((s) => s.activeSceneIndex)
  const setActiveSceneIndex = useStore((s) => s.setActiveSceneIndex)
  const addScene = useStore((s) => s.addScene)
  const duplicateScene = useStore((s) => s.duplicateScene)
  const deleteScene = useStore((s) => s.deleteScene)
  const deleteScenes = useStore((s) => s.deleteScenes)
  const renameScene = useStore((s) => s.renameScene)
  const togglePinScene = useStore((s) => s.togglePinScene)
  const reorderScene = useStore((s) => s.reorderScene)
  const pushHistory = useStore((s) => s.pushHistory)
  const { clsx, bg, text, border: borderT, shadow, isLight } = useTheme()

  const [renamingIdx, setRenamingIdx] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [contextIdx, setContextIdx] = useState<number | null>(null)
  const [contextPos, setContextPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [adjustedPos, setAdjustedPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const contextRef = useRef<HTMLDivElement>(null)
  const draggedIdx = useRef<number | null>(null)
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null)
  const lastHoverIdx = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [tabsVisible, setTabsVisible] = useState(true)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll)
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      ro.disconnect()
    }
  }, [scenes.length, checkScroll])

  const scrollToTab = useCallback((dir: -1 | 1) => {
    const el = scrollRef.current
    if (!el) return
    const tabs = Array.from(el.children) as HTMLElement[]
    const viewLeft = el.scrollLeft
    const viewRight = viewLeft + el.clientWidth
    let target: number | null = null
    if (dir === 1) {
      for (const tab of tabs) {
        const right = tab.offsetLeft + tab.offsetWidth
        if (right > viewRight + 4) {
          target = tab.offsetLeft
          break
        }
      }
      if (target === null) target = el.scrollWidth
    } else {
      for (let i = tabs.length - 1; i >= 0; i--) {
        const left = tabs[i].offsetLeft
        if (left < viewLeft - 4) {
          target = left
          break
        }
      }
      if (target === null) target = 0
    }
    if (target !== null) el.scrollTo({ left: target, behavior: 'smooth' })
  }, [])

  const handleDoubleClick = useCallback((idx: number) => {
    setRenamingIdx(idx)
    setRenameValue(scenes[idx].name)
  }, [scenes])

  const commitRename = useCallback(() => {
    if (renamingIdx === null) return
    renameScene(renamingIdx, renameValue)
    setRenamingIdx(null)
  }, [renamingIdx, renameValue, renameScene])

  useLayoutEffect(() => {
    if (!contextRef.current || contextIdx === null) return
    const rect = contextRef.current.getBoundingClientRect()
    const margin = 8
    let x = contextPos.x
    let y = contextPos.y
    if (x + rect.width > window.innerWidth - margin) x = window.innerWidth - rect.width - margin
    if (x < margin) x = margin
    if (y + rect.height > window.innerHeight - margin) y = y - rect.height - margin
    if (y < margin) y = margin
    setAdjustedPos({ x, y })
  }, [contextIdx, contextPos])

  useEffect(() => {
    if (contextIdx === null) return
    const handlePointerDown = (e: PointerEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextIdx(null)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [contextIdx])

  const handleContextMenu = useCallback((e: React.MouseEvent, idx: number) => {
    e.preventDefault()
    if (contextIdx === idx) {
      setContextIdx(null)
    } else {
      setContextIdx(idx)
      setContextPos({ x: e.clientX, y: e.clientY })
    }
  }, [contextIdx])

  const handleAddScene = useCallback(() => {
    pushHistory('Before add scene')
    addScene()
  }, [addScene, pushHistory])

  const handleDuplicate = useCallback(() => {
    if (contextIdx === null) return
    pushHistory('Before duplicate scene')
    duplicateScene(contextIdx)
    setContextIdx(null)
  }, [contextIdx, duplicateScene, pushHistory])

  const handleContextRename = useCallback(() => {
    if (contextIdx === null) return
    setRenamingIdx(contextIdx)
    setRenameValue(scenes[contextIdx].name)
    setContextIdx(null)
  }, [contextIdx, scenes])

  const handleTogglePin = useCallback(() => {
    if (contextIdx === null) return
    pushHistory('Before pin scene')
    togglePinScene(contextIdx)
    setContextIdx(null)
  }, [contextIdx, togglePinScene, pushHistory])

  const handleDelete = useCallback(() => {
    if (contextIdx === null) return
    if (scenes.length <= 1) return
    pushHistory('Before delete scene')
    deleteScene(contextIdx)
    setContextIdx(null)
  }, [contextIdx, scenes.length, deleteScene, pushHistory])

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    if (scenes[idx].pinned) {
      e.preventDefault()
      return
    }
    draggedIdx.current = idx
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }, [scenes])

  const handleDragEnd = useCallback(() => {
    draggedIdx.current = null
    setDropTargetIdx(null)
  }, [])

  const handleDeleteOtherTabs = useCallback(() => {
    if (contextIdx === null) return
    const toDelete: number[] = []
    for (let i = 0; i < scenes.length; i++) {
      if (i === contextIdx) continue
      if (scenes[i].pinned) continue
      toDelete.push(i)
    }
    if (toDelete.length === 0) { setContextIdx(null); return }
    const remaining = scenes.filter((_, i) => !toDelete.includes(i))
    if (remaining.length === 0) { setContextIdx(null); return }
    pushHistory('Before delete other tabs')
    deleteScenes(toDelete)
    setContextIdx(null)
  }, [contextIdx, scenes, deleteScenes, pushHistory])

  const pinned = scenes.filter((s) => s.pinned)
  const unpinned = scenes.filter((s) => !s.pinned)
  const showTabs = chrome || tabsVisible

  const renderTab = (scene: (typeof scenes)[number], idx: number) => (
    <div
      key={scene.id}
      draggable={!scene.pinned}
      data-idx={idx}
      className={clsx(
        "group flex items-center gap-1 px-2 py-1 text-xs rounded cursor-pointer shrink-0 transition-all duration-150 border",
        idx === activeSceneIndex
          ? clsx(bg.selected)
          : clsx(text.tertiary, bg.hover, "border-transparent"),
        dropTargetIdx === idx && "border-l-indigo-500 border-l-2"
      )}
      onClick={() => setActiveSceneIndex(idx)}
      onDoubleClick={() => handleDoubleClick(idx)}
      onContextMenu={(e) => handleContextMenu(e, idx)}
      onDragStart={(e) => handleDragStart(e, idx)}
      onDragEnd={handleDragEnd}
    >
      {renamingIdx === idx ? (
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') setRenamingIdx(null)
          }}
          className={clsx("w-20 px-1 py-0.5 text-xs rounded outline-none", bg.input)}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="truncate max-w-[80px] flex items-center gap-1">
          {scene.pinned && <Pin size={ICON.micro} className="shrink-0" />}
          {scene.name}
        </span>
      )}
    </div>
  )

  return (
    <div className={chrome ? "w-full min-w-0" : clsx("border-t w-full min-w-0 overflow-x-hidden", bg.surface)}>
      {!chrome && (
        <button
          onClick={() => setTabsVisible((v) => !v)}
          className={clsx(
            "w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold transition-colors",
            text.secondary,
            bg.hover
          )}
        >
          <span>{scenes[activeSceneIndex]?.name ?? 'Scenes'}</span>
          {tabsVisible ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      )}
      {showTabs && (
        <div className={chrome ? "px-1" : "px-2 pb-1.5"}>
          <div className="flex items-center gap-0">
            {canScrollLeft && (
              <button
                onClick={() => scrollToTab(-1)}
                className={clsx("shrink-0 w-5 h-5 flex items-center justify-center rounded text-[10px]", bg.button)}
              >
                <ChevronLeft size={12} />
              </button>
            )}
            <div
              ref={scrollRef}
              className="flex items-center gap-1 overflow-x-auto flex-1 w-0 min-w-0"
              onDragOver={(e) => {
                if (draggedIdx.current === null) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                const tabEls = Array.from(e.currentTarget.children).filter(
                  (el) => el instanceof HTMLElement && el.getAttribute('draggable') === 'true'
                ) as HTMLElement[]
                if (tabEls.length === 0) return
                const mx = e.clientX
                let closestIdx = -1
                let closestDist = Infinity
                for (const el of tabEls) {
                  const rect = el.getBoundingClientRect()
                  const center = rect.left + rect.width / 2
                  const dist = Math.abs(mx - center)
                  const sceneIdx = Number(el.getAttribute('data-idx'))
                  if (dist < closestDist && !isNaN(sceneIdx)) {
                    closestDist = dist
                    closestIdx = sceneIdx
                  }
                }
                if (closestIdx >= 0) {
                  lastHoverIdx.current = closestIdx
                  setDropTargetIdx(closestIdx)
                }
              }}
              onDragLeave={(e) => {
                const target = e.relatedTarget as Node | null
                if (target && (e.currentTarget as Node).contains(target)) return
                setDropTargetIdx(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                setDropTargetIdx(null)
                const fromIdx = draggedIdx.current
                draggedIdx.current = null
                const toIdx = lastHoverIdx.current
                lastHoverIdx.current = null
                if (fromIdx === null || toIdx === null || fromIdx === toIdx) return
                pushHistory('Before reorder scene')
                reorderScene(fromIdx, toIdx)
              }}
            >
              {pinned.length > 0 && (
                <div className={clsx("flex items-center gap-1 pr-1.5 mr-1.5 border-r", borderT.secondary)}>
                  {pinned.map((scene) => renderTab(scene, scenes.indexOf(scene)))}
                </div>
              )}
              {unpinned.map((scene) => renderTab(scene, scenes.indexOf(scene)))}
              <button
                onClick={handleAddScene}
                className={clsx(
                  "w-6 h-6 flex items-center justify-center rounded-md transition-all duration-150 shrink-0",
                  text.tertiary,
                  bg.button
                )}
                title="Add scene"
              >
                <Plus size={14} strokeWidth={2} />
              </button>
            </div>
            {canScrollRight && (
              <button
                onClick={() => scrollToTab(1)}
                className={clsx("shrink-0 w-5 h-5 flex items-center justify-center rounded text-[10px]", bg.button)}
              >
                <ChevronRight size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {contextIdx !== null && (
        <div
          ref={contextRef}
          className={clsx(
            "fixed z-[9999] rounded-lg py-1 min-w-[140px]",
            shadow.lg,
            bg.tertiary,
            borderT.secondary
          )}
          style={{ left: adjustedPos.x, top: adjustedPos.y }}
          onMouseLeave={() => setContextIdx(null)}
        >
          <button
            onClick={handleDuplicate}
            className={clsx(
              "w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs transition-colors",
              text.primary,
              bg.hover
            )}
          >
            <Copy size={12} />
            Duplicate
          </button>
          <button
            onClick={handleContextRename}
            className={clsx(
              "w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs transition-colors",
              text.primary,
              bg.hover
            )}
          >
            <Pencil size={12} />
            Rename
          </button>
          {contextIdx !== null && (
            <button
              onClick={handleTogglePin}
              className={clsx(
                "w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs transition-colors",
                text.primary,
                bg.hover
              )}
            >
              {scenes[contextIdx]?.pinned ? <PinOff size={12} /> : <Pin size={12} />}
              {scenes[contextIdx]?.pinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          <div className={clsx("my-1 border-t", isLight ? "border-zinc-200" : "border-zinc-700")} />
          <button
            onClick={handleDeleteOtherTabs}
            className={clsx(
              "w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs transition-colors",
              text.primary,
              bg.hover
            )}
          >
            <Trash2 size={12} />
            Delete Other Tabs
          </button>
          <div className={clsx("my-1 border-t", isLight ? "border-zinc-200" : "border-zinc-700")} />
          {scenes.length > 1 && (
            <button
              onClick={handleDelete}
              className={clsx("w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs transition-colors", "text-red-500 hover:bg-red-500/10")}
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}
