import { useRef, useEffect, useCallback } from 'react'

interface Props {
  content: string
  isEditing: boolean
  onCommit: (text: string) => void
  onStopEdit: () => void
  onStartEdit?: () => void
  selfStart?: boolean
  wrap?: boolean
  style?: React.CSSProperties
  className?: string
  placeholder?: string
}

export default function InlineEditor({
  content,
  isEditing,
  onCommit,
  onStopEdit,
  onStartEdit,
  selfStart = true,
  wrap = true,
  style,
  className,
  placeholder = 'Type here...'
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const committedRef = useRef(content)

  useEffect(() => {
    if (!isEditing && ref.current && ref.current.innerText !== content) {
      ref.current.innerText = content
    }
    committedRef.current = content
  }, [content, isEditing])

  useEffect(() => {
    if (isEditing && ref.current) {
      ref.current.focus()
      const range = document.createRange()
      range.selectNodeContents(ref.current)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [isEditing])

  const handleBlur = useCallback(() => {
    const text = ref.current?.innerText?.trim() ?? ''
    if (text !== committedRef.current) {
      committedRef.current = text
      onCommit(text)
    }
    onStopEdit()
  }, [onCommit, onStopEdit])

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!selfStart) return
      e.stopPropagation()
      e.preventDefault()
      onStartEdit?.()
    },
    [selfStart, onStartEdit]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        ref.current?.blur()
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        ref.current?.blur()
      }
    },
    []
  )

  const showPlaceholder = isEditing && !content

  return (
    <div
      ref={ref}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onDoubleClick={handleDoubleClick}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPointerDown={(e) => {
        if (isEditing) e.stopPropagation()
      }}
      className={className}
      style={{
        ...style,
        outline: 'none',
        cursor: isEditing ? 'text' : 'inherit',
        whiteSpace: wrap ? 'pre-wrap' : 'nowrap',
        wordBreak: wrap ? 'break-word' : 'normal',
        overflow: wrap ? undefined : isEditing ? 'visible' : 'hidden',
        textOverflow: wrap || isEditing ? undefined : 'ellipsis',
        minHeight: '1em'
      }}
      data-placeholder={showPlaceholder ? placeholder : undefined}
    />
  )
}
