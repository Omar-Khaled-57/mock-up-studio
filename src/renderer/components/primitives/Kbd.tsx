import { useTheme } from '../../hooks/useTheme'

interface Props {
  children: React.ReactNode
  className?: string
}

export default function Kbd({ children, className = '' }: Props) {
  const { clsx, bg, text, border } = useTheme()
  return (
    <kbd
      className={clsx(
        'inline-flex items-center justify-center px-1 py-0.5 text-[10px] font-medium leading-none rounded',
        bg.tertiary,
        text.muted,
        border.secondary,
        'border',
        className
      )}
    >
      {children}
    </kbd>
  )
}
