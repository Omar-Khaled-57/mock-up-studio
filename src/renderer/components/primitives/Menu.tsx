import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../../hooks/useTheme'

interface Props {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  children: React.ReactNode
  align?: 'start' | 'end'
  width?: number
  className?: string
  'data-menu'?: string
}

export default function Menu({
  open,
  onClose,
  anchorRef,
  children,
  align = 'start',
  width = 220,
  className = '',
  'data-menu': dataMenu
}: Props) {
  const { clsx, bg, border, shadow } = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !ref.current) return
    const anchor = anchorRef.current.getBoundingClientRect()
    const menu = ref.current.getBoundingClientRect()
    const margin = 8
    let left = align === 'start' ? anchor.left : anchor.right - menu.width
    let top = anchor.bottom + 4
    if (left < margin) left = margin
    if (left + menu.width > window.innerWidth - margin) {
      left = window.innerWidth - menu.width - margin
    }
    if (top + menu.height > window.innerHeight - margin) {
      top = anchor.top - menu.height - 4
    }
    setPos({ left, top })
  }, [open, anchorRef, align])

  useEffect(() => {
    if (!open) return
    const handleDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      if (anchorRef.current?.contains(e.target as Node)) return
      onClose()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  return createPortal(
    <div
      ref={ref}
      data-menu={dataMenu}
      role="menu"
      className={clsx(
        'fixed z-[8500] rounded-lg py-1 shadow-lg border outline-none',
        bg.primary,
        border.secondary,
        shadow.lg,
        className
      )}
      style={{ left: pos.left, top: pos.top, minWidth: width }}
    >
      {children}
    </div>,
    document.body
  )
}
