import { useState, useCallback } from 'react'
import { useTheme } from '../../hooks/useTheme'
import { ChevronDown } from 'lucide-react'

interface Props {
  title: string
  defaultOpen?: boolean
  count?: number
  children: React.ReactNode
  className?: string
}

export default function SectionHeader({ title, defaultOpen = true, count, children, className = '' }: Props) {
  const { clsx, text } = useTheme()
  const [open, setOpen] = useState(defaultOpen)
  const toggle = useCallback(() => setOpen((v) => !v), [])

  return (
    <div className={className}>
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between mb-1 group"
      >
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider", text.secondary)}>
          {title}{count !== undefined ? ` (${count})` : ''}
        </h3>
        <ChevronDown
          size={12}
          className={clsx("transition-transform duration-150", text.tertiary, open ? '' : '-rotate-90')}
        />
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}
