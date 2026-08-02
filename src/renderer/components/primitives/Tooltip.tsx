import { useTheme } from '../../hooks/useTheme'

interface Props {
  content: string
  children: React.ReactNode
  className?: string
}

export default function Tooltip({ content, children, className = '' }: Props) {
  const { clsx, bg, text, shadow } = useTheme()
  return (
    <span className={clsx('relative inline-flex group', className)}>
      {children}
      <span
        role="tooltip"
        data-tooltip
        className={clsx(
          'pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-[9500]',
          'whitespace-nowrap px-2 py-1 text-[11px] font-medium rounded-md',
          'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150',
          bg.secondary,
          text.primary,
          shadow.sm
        )}
      >
        {content}
      </span>
    </span>
  )
}
