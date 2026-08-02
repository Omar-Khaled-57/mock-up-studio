import { useState, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

interface Props {
  title: string
  defaultOpen?: boolean
  valueDot?: boolean
  children: React.ReactNode
  className?: string
  'data-section'?: string
  /** Controlled open state (overrides internal state when provided). */
  open?: boolean
  /** Called only when `open` is provided (controlled mode). */
  onToggle?: (open: boolean) => void
}

export default function AccordionSection({
  title,
  defaultOpen = true,
  valueDot = false,
  children,
  className = '',
  'data-section': dataSection,
  open,
  onToggle
}: Props) {
  const { clsx, text, accent, border } = useTheme()
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const id = useId()

  const isOpen = open !== undefined ? open : internalOpen
  const toggle = () => {
    if (onToggle) onToggle(!isOpen)
    else setInternalOpen((v) => !v)
  }

  return (
    <section data-section={dataSection} className={clsx('border-t pt-2', border.primary, className)}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={`${id}-body`}
        onClick={toggle}
        className="w-full flex items-center justify-between py-1 group"
      >
        <span className={clsx('flex items-center gap-1.5 text-xs font-medium', text.secondary)}>
          {title}
          {valueDot && <span className={clsx('w-1.5 h-1.5 rounded-full', accent.fill)} />}
        </span>
        <ChevronDown
          size={12}
          className={clsx('transition-transform duration-150', text.tertiary, isOpen ? '' : '-rotate-90')}
        />
      </button>
      {isOpen && (
        <div id={`${id}-body`} className="space-y-3 py-1">
          {children}
        </div>
      )}
    </section>
  )
}
