import { useCallback, useState, useMemo } from 'react'
import { TextBox as TextBoxType } from '@shared/types'
import { useStore } from '../../store'
import { useDrag } from '../../hooks/useDrag'
import { useResize } from '../../hooks/useResize'
import { buildTextStyle } from '../../lib/device-utils'
import ResizeHandles from '../shared/ResizeHandles'
import InlineEditor from './InlineEditor'

interface Props {
  textBox: TextBoxType
}

export default function TextBox({ textBox }: Props) {
  const select = useStore((s) => s.select)
  const isSelected = useStore((s) => s.selectedIds.includes(textBox.id))
  const updateTextBox = useStore((s) => s.updateTextBox)
  const pushHistory = useStore((s) => s.pushHistory)
  const zoom = useStore((s) => s.zoom)

  const [isEditing, setIsEditing] = useState(false)

  const commitPosition = useCallback(
    (id: string, x: number, y: number) => {
      updateTextBox(id, { x, y })
    },
    [updateTextBox]
  )

  const commitEnd = useCallback(() => {
    pushHistory('Move text box')
  }, [pushHistory])

  const drag = useDrag({ zoom, onDrag: commitPosition, onEnd: commitEnd })

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

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      select(textBox.id, e.shiftKey)
    },
    [textBox.id, select]
  )

  const handleDragDown = useCallback(
    (e: React.PointerEvent) => {
      if (textBox.locked || isEditing) return
      drag.handlePointerDown(e, textBox.id, textBox.x, textBox.y)
    },
    [textBox, drag, isEditing]
  )

  const handleResizeDown = useCallback(
    (e: React.PointerEvent, handle: 'nw' | 'ne' | 'sw' | 'se') => {
      if (textBox.locked || isEditing) return
      resize.handlePointerDown(e, textBox.id, handle, textBox.x, textBox.y, textBox.width, textBox.height)
    },
    [textBox, resize, isEditing]
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
      onClick={handleClick}
      onPointerDown={handleDragDown}
      onPointerMove={drag.handlePointerMove}
      onPointerUp={drag.handlePointerUp}
      style={outerStyle}
    >
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
        <ResizeHandles onMouseDown={handleResizeDown} />
      )}
    </div>
  )
}
