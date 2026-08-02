import { useTheme } from '../../hooks/useTheme'

interface Props {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit: string
  onChange: (v: number) => void
  className?: string
}

export default function SliderInput({ label, value, min, max, step = 1, unit, onChange, className = '' }: Props) {
  const { clsx, text } = useTheme()
  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      <span className={clsx("text-[10px] min-w-7 shrink-0", text.secondary)}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 min-w-0 h-1 accent-indigo-500"
      />
      <span className={clsx("text-[10px] w-10 shrink-0 text-right tabular-nums", text.tertiary)}>
        {value}{unit}
      </span>
    </div>
  )
}
