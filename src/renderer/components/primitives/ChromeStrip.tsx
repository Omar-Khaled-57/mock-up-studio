import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

interface Props {
  header: React.ReactNode
  defaultOpen?: boolean
  children?: React.ReactNode
  className?: string
  'data-strip'?: string
}

export default function ChromeStrip({
  header,
  defaultOpen = true,
  children,
  className = '',
  'data-strip': dataStrip
}: Props) {
  const { clsx, bg, text } = useTheme()
  const [open, setOpen] = useState(defaultOpen)
  const hasBody = children !== undefined

  return (
    <div data-strip={dataStrip} className={clsx('w-full min-w-0', bg.surface, className)}>
      <div className="flex items-center gap-1 px-2 py-1">
        <div className="flex-1 min-w-0">{header}</div>
        {hasBody && (
          <button
            type="button"
            aria-label={open ? 'Hide panel' : 'Show panel'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={clsx(
              'h-6 w-6 flex items-center justify-center rounded-md shrink-0 transition-colors duration-150',
              text.tertiary,
              bg.hover
            )}
          >
            {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        )}
      </div>
      {hasBody && open && <div>{children}</div>}
    </div>
  )
}
