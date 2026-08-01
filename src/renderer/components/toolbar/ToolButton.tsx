import { useTheme } from '../../hooks/useTheme'
import { Tool } from '../../tools'
import { getToolIcon } from './icons'

interface ToolButtonProps {
  tool: Tool
  /** Label shown under the icon. Defaults to the tool label; the toolbar passes
   * its group label so each face reads like a sidebar tab. */
  label?: string
  active: boolean
  disabled?: boolean
  onClick?: () => void
}

export default function ToolButton({ tool, label, active, disabled, onClick }: ToolButtonProps) {
  const { isLight, clsx, bg, text } = useTheme()
  const Icon = getToolIcon(tool.id)
  const displayLabel = label ?? tool.label

  return (
    <button
      type="button"
      aria-label={tool.label}
      aria-pressed={active}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onClick}
      title={tool.shortcut ? `${tool.label} (${tool.shortcut.toUpperCase()})` : tool.label}
      className={clsx(
        "relative w-11 h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500",
        active
          ? clsx(bg.selected)
          : disabled
            ? clsx("opacity-40 cursor-not-allowed", text.tertiary)
            : clsx(text.tertiary, bg.hover)
      )}
    >
      {active && (
        <div
          className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full ${
            isLight ? 'bg-indigo-600' : 'bg-indigo-500'
          }`}
        />
      )}
      <Icon size={16} strokeWidth={active ? 2 : 1.5} />
      <span className="text-[9px] font-medium leading-none truncate max-w-full px-0.5">{displayLabel}</span>
      {tool.shortcut && (
        <span
          className={clsx(
            "absolute top-0.5 right-1 text-[8px] font-semibold leading-none",
            active ? (isLight ? 'text-indigo-700' : 'text-indigo-300') : text.muted
          )}
        >
          {tool.shortcut.toUpperCase()}
        </span>
      )}
    </button>
  )
}
