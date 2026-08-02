import { useEffect, useState } from 'react'
import { useTheme } from '../../hooks/useTheme'

interface Props {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  unit?: string
  ariaLabel?: string
  className?: string
  'data-testid'?: string
}

export default function NumberInput({
  value,
  onChange,
  min,
  max,
  unit,
  ariaLabel,
  className = '',
  ...rest
}: Props) {
  const { clsx, bg, text, border } = useTheme()
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commit = (raw: string) => {
    const n = Number(raw)
    if (!Number.isFinite(n)) {
      setDraft(String(value))
      return
    }
    let v = n
    if (min !== undefined) v = Math.max(min, v)
    if (max !== undefined) v = Math.min(max, v)
    onChange(v)
    setDraft(String(v))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit(draft)
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setDraft(String(value))
    }
  }

  return (
    <div className={clsx('flex items-center gap-1.5 min-w-0', className)}>
      <input
        {...rest}
        aria-label={ariaLabel}
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={handleKeyDown}
        className={clsx(
          'min-w-0 w-full px-2 py-1.5 text-[13px] rounded-lg outline-none',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          bg.input,
          border.focus
        )}
      />
      {unit && <span className={clsx('text-[11px] shrink-0', text.muted)}>{unit}</span>}
    </div>
  )
}
