import { useTheme } from '../../hooks/useTheme'

export type BadgeVariant = 'neutral' | 'accent' | 'danger'

interface Props {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

export default function Badge({ variant = 'neutral', children, className = '' }: Props) {
  const { clsx, bg, text, accent } = useTheme()

  const variants: Record<BadgeVariant, string> = {
    neutral: clsx(bg.tertiary, text.secondary),
    accent: accent.soft,
    danger: bg.danger
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
