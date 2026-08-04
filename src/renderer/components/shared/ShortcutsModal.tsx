import { useEffect, useCallback } from 'react'
import { useTheme } from '../../hooks/useTheme'

interface Props {
  onClose: () => void
}

const SECTIONS = [
  {
    title: 'File',
    shortcuts: [
      { keys: 'Ctrl+N', action: 'New project' },
      { keys: 'Ctrl+O', action: 'Open project' },
      { keys: 'Ctrl+S', action: 'Save' },
      { keys: 'Ctrl+Shift+S', action: 'Save As' },
      { keys: 'Ctrl+E', action: 'Open export dialog' }
    ]
  },
  {
    title: 'Edit',
    shortcuts: [
      { keys: 'Ctrl+Z', action: 'Undo' },
      { keys: 'Ctrl+Shift+Z / Ctrl+Y', action: 'Redo' },
      { keys: 'Ctrl+C', action: 'Copy' },
      { keys: 'Ctrl+X', action: 'Cut' },
      { keys: 'Ctrl+V', action: 'Paste' },
      { keys: 'Ctrl+D', action: 'Duplicate' },
      { keys: 'Ctrl+A', action: 'Select all' },
      { keys: 'Delete / Backspace', action: 'Delete selected' }
    ]
  },
  {
    title: 'Canvas',
    shortcuts: [
      { keys: 'Arrow keys', action: 'Nudge 1px' },
      { keys: 'Shift + Arrow', action: 'Nudge 10px' },
      { keys: 'Escape', action: 'Deselect all' },
      { keys: 'Alt + Drag / Middle click', action: 'Pan canvas' },
      { keys: 'Ctrl + Scroll', action: 'Zoom in/out' }
    ]
  }
]

export default function ShortcutsModal({ onClose }: Props) {
  const { isLight, clsx } = useTheme()
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      className="fixed inset-0 z-[9998] bg-black/60 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className={clsx("rounded-xl shadow-2xl w-[480px] max-h-[85vh] overflow-y-auto px-4 py-3", isLight ? "bg-white border border-zinc-200" : "bg-zinc-900 border border-zinc-700")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2.5">
          <h2 className={clsx("text-sm font-semibold", isLight ? "text-zinc-800" : "text-zinc-200")}>Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className={clsx("text-xs", isLight ? "text-zinc-600 hover:text-zinc-800" : "text-zinc-400 hover:text-zinc-200")}
          >
            Close
          </button>
        </div>

        <div className="space-y-2">
          {SECTIONS.map((section, i) => (
            <div key={section.title}>
              {i > 0 && (
                <div
                  aria-hidden="true"
                  className={clsx("mb-2 h-px", isLight ? "bg-zinc-200" : "bg-zinc-800")}
                />
              )}
              <h3 className={clsx("text-[10px] font-semibold uppercase tracking-wider mb-0.5", isLight ? "text-black" : "text-white")}>
                {section.title}
              </h3>
              <div className="space-y-[3px]">
                {section.shortcuts.map((s) => (
                  <div key={s.action} className="flex items-center justify-between">
                    <span className={clsx("text-xs", isLight ? "text-zinc-600" : "text-zinc-400")}>{s.action}</span>
                    <kbd className={clsx("px-1.5 text-[10px] font-mono rounded", isLight ? "text-zinc-700 bg-zinc-100 border border-zinc-200" : "text-zinc-300 bg-zinc-800 border border-zinc-700")}>
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
