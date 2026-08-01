import { useCallback, useRef, useState } from 'react'
import { useTheme } from '../hooks/useTheme'

interface Props {
  name: string
  onCommit: (value: string) => void
  onCancel: () => void
}

/**
 * Inline rename input rendered by element facades while the Select tool has
 * `runtime.editing = { id, mode: 'rename' }` active.
 */
export default function RenameOverlay({ name, onCommit, onCancel }: Props) {
  const { isLight, clsx } = useTheme()
  const [value, setValue] = useState(name)
  const doneRef = useRef(false)

  const commit = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    const trimmed = value.trim()
    if (trimmed) onCommit(trimmed)
    else onCancel()
  }, [value, onCommit, onCancel])

  const cancel = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onCancel()
  }, [onCancel])

  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') cancel()
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={clsx("absolute inset-0 w-full h-full px-2 text-xs font-semibold rounded border outline-none text-center", isLight ? "bg-white text-zinc-800 border-indigo-400" : "bg-zinc-900 text-zinc-100 border-indigo-500/50")}
    />
  )
}
