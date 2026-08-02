import type { ReactNode } from 'react'
import { useTheme } from '../../hooks/useTheme'

interface Props {
  children: ReactNode
  gap?: 'sm' | 'md'
  minChildWidth?: string
  className?: string
}

/**
 * Responsive action-group container that lays children out in a CSS Grid
 * using `auto-fit` + `minmax`. Buttons sit side-by-side when the container
 * is wide enough; below the `minChildWidth` threshold individual buttons
 * wrap to their own row and stretch to full available width.
 *
 * Unlike viewport-based Tailwind breakpoints (`sm:`), this responds to the
 * container's actual width, so it works correctly inside a narrow sidebar
 * panel even on a large window.
 */
export default function ResponsiveButtonGroup({
  children,
  gap = 'sm',
  minChildWidth = '88px',
  className = ''
}: Props) {
  const { clsx } = useTheme()
  const gapClass = gap === 'sm' ? 'gap-1' : 'gap-1.5'
  return (
    <div
      className={clsx('grid w-full', gapClass, className)}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minChildWidth}, 1fr))` }}
    >
      {children}
    </div>
  )
}
