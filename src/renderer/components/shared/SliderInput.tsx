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
  const { isLight, clsx } = useTheme()
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={clsx("text-[10px] w-7 shrink-0", isLight ? "text-zinc-600" : "text-zinc-500")}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 accent-indigo-500"
      />
      <span className={clsx("text-[10px] w-10 text-right", isLight ? "text-zinc-500" : "text-zinc-400")}>
        {value}{unit}
      </span>
    </div>
  )
}
