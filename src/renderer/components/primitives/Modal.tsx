import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import IconButton from './IconButton'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: number
  className?: string
}

export default function Modal({ open, onClose, title, children, width = 480, className = '' }: Props) {
  const { clsx, bg, border, shadow, text } = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    restoreRef.current = previous
    const el = ref.current
    el?.focus()

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !el) return
      const focusables = el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', trapFocus)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', trapFocus)
      document.removeEventListener('keydown', onKeyDown)
      restoreRef.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-modal
        className={clsx(
          'relative z-10 max-h-[85vh] flex flex-col rounded-xl border outline-none',
          bg.primary,
          border.secondary,
          shadow.lg
        )}
        style={{ width }}
      >
        <div className={clsx('flex items-center justify-between px-4 py-3 shrink-0 border-b', border.primary)}>
          <h2 className={clsx('text-sm font-semibold', text.primary)}>{title}</h2>
          <IconButton icon={X} label="Close dialog" onClick={onClose} size="sm" />
        </div>
        <div className={clsx('px-4 py-4 overflow-y-auto', className)}>{children}</div>
      </div>
    </div>,
    document.body
  )
}
