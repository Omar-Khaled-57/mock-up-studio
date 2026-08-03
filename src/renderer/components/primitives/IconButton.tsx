import type { ElementType } from 'react'
import Button, { type ButtonVariant, type ButtonSize } from './Button'
import { useTheme } from '../../hooks/useTheme'

interface Props {
  icon: ElementType
  label: string
  onClick?: () => void
  size?: ButtonSize
  variant?: ButtonVariant
  active?: boolean
  disabled?: boolean
  className?: string
  /** Override the icon glyph size (defaults to the size-derived value). */
  iconSize?: number
}

export default function IconButton({
  icon: Icon,
  label,
  onClick,
  size = 'md',
  variant = 'ghost',
  active = false,
  disabled,
  className = '',
  iconSize
}: Props) {
  const { clsx, bg } = useTheme()
  const dims = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  return (
    <Button
      aria-label={label}
      title={label}
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={clsx('p-0 flex-shrink-0', dims, active && bg.active, className)}
    >
      <Icon size={iconSize ?? (size === 'sm' ? 14 : 16)} strokeWidth={active ? 2 : 1.75} />
    </Button>
  )
}
