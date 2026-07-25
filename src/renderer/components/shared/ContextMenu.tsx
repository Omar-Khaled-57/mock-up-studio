import React, { useEffect, useCallback, useRef, useState } from 'react'

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
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const adjustedY = Math.min(y, window.innerHeight - items.length * 32 - 16)
  const adjustedX = Math.min(x, window.innerWidth - 180)

  return (
    <div
      ref={ref}
      className="fixed z-[9999] bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((item, i) => {
        if (item.divider) {
          return <div key={i} className="my-1 border-t border-zinc-700" />
        }
        return (
          <button
            key={i}
            onClick={() => {
              item.action()
              onClose()
            }}
            className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
              item.danger
                ? 'text-red-400 hover:bg-red-900/30'
                : 'text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

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
