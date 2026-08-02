import { useTheme } from '../../hooks/useTheme'

export interface SegmentOption {
  value: string
  label: string
}

interface Props {
  options: SegmentOption[]
  value: string
  onChange: (v: string) => void
  ariaLabel?: string
  className?: string
}

export default function SegmentedControl({ options, value, onChange, ariaLabel, className = '' }: Props) {
  const { clsx, accent, bg, text } = useTheme()
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={clsx('flex gap-0.5 p-0.5 rounded-lg', bg.tertiary, className)}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={clsx(
              'flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors duration-150',
              active ? accent.soft : clsx(text.tertiary, bg.hover)
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
