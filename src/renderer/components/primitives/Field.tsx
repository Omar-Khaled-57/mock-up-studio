import { useTheme } from '../../hooks/useTheme'

interface Props {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
  className?: string
}

export default function Field({ label, htmlFor, hint, children, className = '' }: Props) {
  const { clsx, text } = useTheme()
  return (
    <div className={`space-y-1 min-w-0 ${className}`}>
      <label htmlFor={htmlFor} className={clsx('block text-[13px] font-medium leading-tight', text.secondary)}>
        {label}
      </label>
      {children}
      {hint && <p className={clsx('text-[11px] leading-tight', text.muted)}>{hint}</p>}
    </div>
  )
}
