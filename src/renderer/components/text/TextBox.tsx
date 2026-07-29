import { useCallback, useState, useMemo } from 'react'
import { TextBox as TextBoxType } from '@shared/types'
import { useStore } from '../../store'
import { useDrag } from '../../hooks/useDrag'
import { useResize } from '../../hooks/useResize'
import { useSnapping } from '../../hooks/useSnapping'
import { useTripleClick } from '../../hooks/useTripleClick'
import { useTheme } from '../../hooks/useTheme'
import { buildTextStyle } from '../../lib/device-utils'
import { getMultiDragEntries } from '../../lib/multi-drag'
import ResizeHandles from '../shared/ResizeHandles'
import InlineEditor from './InlineEditor'

interface Props {
  textBox: TextBoxType
  onGuidesChange?: (guides: { verticalGuides: number[]; horizontalGuides: number[] }) => void
  onContextMenu?: (e: React.MouseEvent, type: string, id: string) => void
}

export default function TextBox({ textBox, onGuidesChange, onContextMenu }: Props) {
  const { isLight, clsx } = useTheme()
  const select = useStore((s) => s.select)
  const isSelected = useStore((s) => s.selectedIds.includes(textBox.id))
  const updateTextBox = useStore((s) => s.updateTextBox)
  const scene = useStore((s) => s.scenes[s.activeSceneIndex])
  const groupName = textBox.groupId ? scene.groups.find((g) => g.id === textBox.groupId)?.name ?? null : null
  const pushHistory = useStore((s) => s.pushHistory)
  const zoom = useStore((s) => s.zoom)

  const [isEditing, setIsEditing] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(textBox.name)
  const { computeSnap } = useSnapping()

  const commitPosition = useCallback(
    (id: string, x: number, y: number) => {
      updateTextBox(id, { x, y })
    },
    [updateTextBox]
  )

  const commitEnd = useCallback(() => {
    pushHistory('Move text box')
  }, [pushHistory])

  const snapFn = useCallback(
    (id: string, x: number, y: number, w: number, h: number) => {
      const result = computeSnap({ id, x, y, width: w, height: h })
      onGuidesChange?.({ verticalGuides: result.verticalGuides, horizontalGuides: result.horizontalGuides })
      return { x: result.x, y: result.y }
    },
    [computeSnap, onGuidesChange]
  )

  const drag = useDrag({ zoom, onDrag: commitPosition, onEnd: commitEnd, snapFn, onGuidesChange, getMultiDrag: () => getMultiDragEntries(textBox.id) })

  const commitResize = useCallback(
    (id: string, x: number, y: number, w: number, h: number) => {
      updateTextBox(id, { x, y, width: w, height: h })
    },
    [updateTextBox]
  )

  const resizeEnd = useCallback(() => {
    pushHistory('Resize text box')
  }, [pushHistory])

  const resize = useResize({ zoom, onResize: commitResize, onEnd: resizeEnd })

  const handleContext = useCallback(
    (e: React.MouseEvent) => {
      onContextMenu?.(e, 'textbox', textBox.id)
    },
    [onContextMenu, textBox.id]
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (textBox.locked) return
      e.stopPropagation()
      setIsEditing(true)
      select(textBox.id)
    },
    [textBox.id, textBox.locked, select]
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      select(textBox.id, e.shiftKey || e.ctrlKey || e.metaKey)
    },
    [textBox.id, select]
  )

  const startRename = useCallback(() => {
    if (textBox.locked || isEditing) return
    setIsRenaming(true)
    setRenameValue(textBox.name)
  }, [textBox.name, textBox.locked, isEditing])

  const { handleClick: handleTripleClick } = useTripleClick(startRename)

  const commitRename = useCallback(() => {
    if (!isRenaming) return
    const trimmed = renameValue.trim()
    if (trimmed) {
      updateTextBox(textBox.id, { name: trimmed })
      pushHistory('Rename')
    }
    setIsRenaming(false)
  }, [isRenaming, renameValue, textBox.id, updateTextBox, pushHistory])

  const cancelRename = useCallback(() => {
    setIsRenaming(false)
    setRenameValue(textBox.name)
  }, [textBox.name])

  const handleDragDown = useCallback(
    (e: React.PointerEvent) => {
      if (textBox.locked || isEditing || isRenaming) return
      drag.handlePointerDown(e, textBox.id, textBox.x, textBox.y, textBox.width, textBox.height)
    },
    [textBox, drag, isEditing, isRenaming]
  )

  const handleResizeDown = useCallback(
    (e: React.PointerEvent, handle: 'nw' | 'ne' | 'sw' | 'se') => {
      if (textBox.locked || isEditing || isRenaming) return
      resize.handlePointerDown(e, textBox.id, handle, textBox.x, textBox.y, textBox.width, textBox.height)
    },
    [textBox, resize, isEditing, isRenaming]
  )

  const handleContentCommit = useCallback(
    (text: string) => {
      updateTextBox(textBox.id, { content: text })
      pushHistory('Edit text')
    },
    [textBox.id, updateTextBox, pushHistory]
  )

  const handleStartEdit = useCallback(() => {
    setIsEditing(true)
    select(textBox.id)
  }, [textBox.id, select])

  const handleStopEdit = useCallback(() => {
    setIsEditing(false)
  }, [])

  const outerStyle = useMemo(
    () =>
      ({
        position: 'absolute' as const,
        left: textBox.x,
        top: textBox.y,
        width: textBox.width,
        height: textBox.heightAuto ? undefined : textBox.height,
        background: textBox.backgroundVisible ? textBox.backgroundColor : 'transparent',
        border: textBox.borderVisible ? `1px solid ${textBox.borderColor}` : 'none',
        borderRadius: textBox.borderRadius,
        zIndex: textBox.zIndex,
        cursor: isEditing ? 'text' : textBox.locked ? 'default' : 'move',
        opacity: textBox.locked ? 0.8 : 1,
        padding: 4,
        touchAction: 'none' as const
      }),
    [textBox, isEditing]
  )

  return (
    <div
      data-element-id={textBox.id}
      onClick={(e) => { handleClick(e); handleTripleClick() }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContext}
      onPointerDown={handleDragDown}
      onPointerMove={drag.handlePointerMove}
      onPointerUp={drag.handlePointerUp}
      style={outerStyle}
    >
      {isRenaming && (
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
          onPointerDown={(e) => e.stopPropagation()}
          className={clsx("absolute inset-0 w-full h-full px-2 text-xs font-semibold rounded border outline-none text-center", isLight ? "bg-white text-zinc-800 border-indigo-400" : "bg-zinc-900 text-zinc-100 border-indigo-500/50")}
        />
      )}
      <InlineEditor
        content={textBox.content}
        isEditing={isEditing}
        onCommit={handleContentCommit}
        onStartEdit={handleStartEdit}
        onStopEdit={handleStopEdit}
        style={buildTextStyle(textBox)}
        className="w-full h-full"
        placeholder="Type here..."
      />

      {isSelected && !textBox.locked && !isEditing && (
        <ResizeHandles onMouseDown={handleResizeDown} groupId={textBox.groupId} groupName={groupName} />
      )}
    </div>
  )
}
