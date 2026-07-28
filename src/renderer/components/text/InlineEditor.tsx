import { useRef, useEffect, useCallback } from 'react'

interface Props {
  content: string
  isEditing: boolean
  onCommit: (text: string) => void
  onStartEdit: () => void
  onStopEdit: () => void
  style?: React.CSSProperties
  className?: string
  placeholder?: string
}

export default function InlineEditor({
  content,
  isEditing,
  onCommit,
  onStartEdit,
  onStopEdit,
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
      e.stopPropagation()
      e.preventDefault()
      onStartEdit()
    },
    [onStartEdit]
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

  const showPlaceholder = !isEditing && !content

  return (
    <div
      ref={ref}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onDoubleClick={handleDoubleClick}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      style={{
        ...style,
        outline: 'none',
        cursor: isEditing ? 'text' : 'inherit',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        minHeight: '1em'
      }}
      data-placeholder={showPlaceholder ? placeholder : undefined}
    />
  )
}
