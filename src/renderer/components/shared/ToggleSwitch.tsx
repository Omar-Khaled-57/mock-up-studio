import { useTheme } from '../../hooks/useTheme'

interface Props {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
}

export default function ToggleSwitch({ label, checked, onChange, className = '' }: Props) {
  const { isLight, clsx, text } = useTheme()
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className={clsx("text-[10px] cursor-pointer select-none", text.secondary)}>{label}</label>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-8 h-[18px] rounded-full border transition-colors ${
          checked
            ? 'bg-indigo-500 border-indigo-500'
            : isLight ? 'bg-zinc-200 border-zinc-300' : 'bg-zinc-700 border-zinc-600'
        }`}
      >
        <span
          className={`absolute top-[2px] left-[2px] w-3 h-3 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-[14px]' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
