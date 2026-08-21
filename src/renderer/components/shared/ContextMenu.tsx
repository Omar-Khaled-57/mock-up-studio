import { useEffect, useCallback, useRef, useState, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../../hooks/useTheme'

export interface ContextMenuItem {
  label: string
  action: () => void
  divider?: boolean
  danger?: boolean
}

interface MenuProps {
  items: ContextMenuItem[]
  x: number
  y: number
  onClose: () => void
}

export function ContextMenu({ items, x, y, onClose }: MenuProps) {
  const { isLight, clsx } = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    // Delay attaching the outside-click listener so the mousedown that opened
    // this menu (especially button-2 / contextmenu on Linux/GTK) does not
    // immediately close it via the outside-click guard.
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
      document.addEventListener('keydown', handleEscape)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  useLayoutEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const margin = 8
    let adjustedX = x
    let adjustedY = y

    if (x + rect.width > window.innerWidth - margin) {
      adjustedX = window.innerWidth - rect.width - margin
    }
    if (x < margin) adjustedX = margin

    if (y + rect.height > window.innerHeight - margin) {
      adjustedY = y - rect.height - margin
    }
    if (adjustedY < margin) adjustedY = margin

    setPos({ x: adjustedX, y: adjustedY })
  }, [x, y])

  const menu = (
    <div
      ref={ref}
      className={clsx("fixed z-[9999] rounded-lg shadow-lg py-1 min-w-[150px]", isLight ? "bg-white border border-zinc-200" : "bg-zinc-800 border border-zinc-700")}
      style={{ left: pos.x, top: pos.y }}
    >
      {items.map((item, i) => {
        if (item.divider) {
          return <div key={i} className={clsx("my-1 border-t", isLight ? "border-zinc-200" : "border-zinc-700")} />
        }
        return (
          <button
            key={i}
            onClick={() => {
              item.action()
              onClose()
            }}
            className={`w-full text-left px-2.5 py-1.5 text-[11px] transition-colors ${
              item.danger
                ? clsx(isLight ? 'text-red-600 hover:bg-red-50' : 'text-red-400 hover:bg-red-900/30')
                : clsx(isLight ? 'text-zinc-700 hover:bg-zinc-100' : 'text-zinc-300 hover:bg-zinc-700')
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )

  return createPortal(menu, document.body)
}

// eslint-disable-next-line react-refresh/only-export-components
export function useContextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  const open = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const close = useCallback(() => setMenu(null), [])

  return { menu, open, close }
}
