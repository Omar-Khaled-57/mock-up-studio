import { useState, useCallback } from 'react'
import { useStore } from '../../store'
import { useTheme } from '../../hooks/useTheme'
import { Plus, Copy, Trash2 } from 'lucide-react'

export default function SceneTabs() {
  const scenes = useStore((s) => s.scenes)
  const activeSceneIndex = useStore((s) => s.activeSceneIndex)
  const setActiveSceneIndex = useStore((s) => s.setActiveSceneIndex)
  const addScene = useStore((s) => s.addScene)
  const duplicateScene = useStore((s) => s.duplicateScene)
  const deleteScene = useStore((s) => s.deleteScene)
  const renameScene = useStore((s) => s.renameScene)
  const pushHistory = useStore((s) => s.pushHistory)
  const { isLight, clsx } = useTheme()

  const [renamingIdx, setRenamingIdx] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [contextIdx, setContextIdx] = useState<number | null>(null)
  const [contextPos, setContextPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const handleDoubleClick = useCallback((idx: number) => {
    setRenamingIdx(idx)
    setRenameValue(scenes[idx].name)
  }, [scenes])

  const commitRename = useCallback(() => {
    if (renamingIdx === null) return
    renameScene(renamingIdx, renameValue)
    setRenamingIdx(null)
  }, [renamingIdx, renameValue, renameScene])

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

  const handleDelete = useCallback(() => {
    if (contextIdx === null) return
    if (scenes.length <= 1) return
    pushHistory('Before delete scene')
    deleteScene(contextIdx)
    setContextIdx(null)
  }, [contextIdx, scenes.length, deleteScene, pushHistory])

  return (
    <div className={clsx(
      "border-t px-2 py-1.5",
      isLight ? "border-zinc-200 bg-zinc-50" : "border-zinc-800 bg-zinc-900"
    )}>
      <div className="flex items-center gap-1 overflow-x-auto">
        {scenes.map((scene, idx) => (
          <div
            key={scene.id}
            className={`group flex items-center gap-1 px-2 py-1 text-xs rounded cursor-pointer shrink-0 transition-colors ${
              idx === activeSceneIndex
                ? isLight
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                  : 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : isLight
                  ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 border border-transparent'
                  : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 border border-transparent'
            }`}
            onClick={() => setActiveSceneIndex(idx)}
            onDoubleClick={() => handleDoubleClick(idx)}
            onContextMenu={(e) => handleContextMenu(e, idx)}
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
                className={clsx(
                  "w-20 px-1 py-0.5 text-xs rounded border outline-none",
                  isLight
                    ? "bg-white text-zinc-900 border-zinc-300"
                    : "bg-zinc-900 text-zinc-200 border-zinc-600"
                )}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate max-w-[80px]">{scene.name}</span>
            )}
          </div>
        ))}

        <button
          onClick={handleAddScene}
          className={clsx(
            "w-6 h-6 flex items-center justify-center rounded-md transition-all duration-150 shrink-0",
            isLight
              ? "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              : "text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60"
          )}
          title="Add scene"
        >
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>

      {contextIdx !== null && (
        <div
          className={clsx(
            "fixed z-[9999] rounded-lg shadow-xl py-1 min-w-[140px]",
            isLight
              ? "bg-white border border-zinc-200"
              : "bg-zinc-800 border border-zinc-700/80"
          )}
          style={{ left: contextPos.x, top: contextPos.y }}
          onMouseLeave={() => setContextIdx(null)}
        >
          <button
            onClick={handleDuplicate}
            className={clsx(
              "w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs transition-colors",
              isLight
                ? "text-zinc-700 hover:bg-zinc-100"
                : "text-zinc-300 hover:bg-zinc-700/60"
            )}
          >
            <Copy size={12} />
            Duplicate
          </button>
          {scenes.length > 1 && (
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
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
