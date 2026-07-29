import { useCallback } from 'react'
import { useTheme } from '../../hooks/useTheme'

interface Props {
  label?: string
  value: string
  onChange: (color: string) => void
  className?: string
}

export default function ColorInput({ label, value, onChange, className = '' }: Props) {
  const { isLight, clsx } = useTheme()
  const handleHexChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      if (/^#[0-9a-f]{0,6}$/i.test(v) || v === '') {
        onChange(v)
      }
    },
    [onChange]
  )

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {label && <span className={clsx("text-[10px] w-7 shrink-0", isLight ? "text-zinc-600" : "text-zinc-500")}>{label}</span>}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx("w-6 h-6 rounded border cursor-pointer bg-transparent shrink-0", isLight ? "border-zinc-300" : "border-zinc-700")}
      />
      <input
        type="text"
        value={value}
        onChange={handleHexChange}
        className={clsx("flex-1 px-1.5 py-0.5 text-[10px] font-mono rounded border focus:border-indigo-500 outline-none min-w-0", isLight ? "bg-zinc-100 text-zinc-800 border-zinc-300" : "bg-zinc-800 text-zinc-300 border-zinc-700")}
      />
    </div>
  )
}
