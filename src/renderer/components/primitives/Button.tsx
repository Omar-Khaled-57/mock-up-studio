import { useTheme } from '../../hooks/useTheme'

export type ButtonVariant = 'default' | 'accent' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export default function Button({
  variant = 'default',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: Props) {
  const { clsx, accent, bg, text } = useTheme()

  const sizes: Record<ButtonSize, string> = {
    sm: 'h-7 px-2.5 text-xs',
    md: 'h-9 px-3 text-[13px]'
  }

  const variants: Record<ButtonVariant, string> = {
    default: clsx(bg.button, text.secondary),
    accent: clsx(accent.DEFAULT, accent.hover, 'font-medium'),
    ghost: clsx('bg-transparent', text.secondary, bg.hover),
    danger: clsx(bg.danger)
  }

  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium select-none',
        'transition-all duration-150 active:scale-[0.98]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        sizes[size],
        variants[variant],
        className
      )}
      {...rest}
    />
  )
}
