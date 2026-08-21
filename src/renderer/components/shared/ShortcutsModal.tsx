import Modal from '../primitives/Modal'

interface Props {
  open: boolean
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
      { keys: 'Escape', action: 'Exit focus / Deselect' },
      { keys: 'Alt + Drag / Middle click', action: 'Pan canvas' },
      { keys: 'Ctrl + Scroll', action: 'Zoom in/out' }
    ]
  },
  {
    title: 'Tools',
    shortcuts: [
      { keys: 'V', action: 'Select' },
      { keys: 'M', action: 'Marquee' },
      { keys: 'H', action: 'Hand (pan)' },
      { keys: 'Space', action: 'Temporary hand (hold)' },
      { keys: 'B', action: 'Paint brush' },
      { keys: 'G', action: 'Mask tool' },
      { keys: 'X', action: 'Focus mode' },
      { keys: 'Enter', action: 'Enter focus (group)' }
    ]
  }
]

export default function ShortcutsModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard Shortcuts" width={480}>
      <div className="space-y-3">
        {SECTIONS.map((section, i) => (
          <div key={section.title}>
            {i > 0 && (
              <div className="mb-2 h-px bg-zinc-800 dark:bg-zinc-700" aria-hidden="true" />
            )}
            <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-1 text-zinc-300">
              {section.title}
            </h3>
            <div className="space-y-[3px]">
              {section.shortcuts.map((s) => (
                <div key={s.action} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">{s.action}</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
