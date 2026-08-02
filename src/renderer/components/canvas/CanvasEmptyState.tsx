import { Monitor, Type, ImagePlus, Palette } from 'lucide-react'
import { useStore } from '../../store'
import { useRuntimeStore } from '../../runtime/store'
import { useTheme } from '../../hooks/useTheme'
import type { SidebarTab } from '../../store/uiSlice'

/**
 * Canvas empty state (v0.3.0 IA §7): first-run overlay over an empty scene.
 * Rendered by Canvas; the overlay is pointer-events-none except its actions,
 * so canvas interactions pass straight through. Dismissal is session-scoped
 * (runtime store) — a pointer-down outside the actions or any element add hides
 * it for the rest of the session.
 */
export default function CanvasEmptyState() {
  const { clsx, text, bg, accent, radius } = useTheme()
  const setSidebarTab = useStore((s) => s.setSidebarTab)
  const dismiss = useRuntimeStore((s) => s.dismissCanvasEmptyState)

  const go = (tab: SidebarTab) => {
    setSidebarTab(tab)
    dismiss()
  }

  const primary = clsx(
    "inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors",
    accent.DEFAULT
  )
  const secondary = clsx(
    "inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors",
    bg.button
  )

  return (
    <div data-empty-state className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none select-none">
      <div className="max-w-md w-full mx-6 text-center">
        <div className={clsx("w-12 h-12 mx-auto mb-4 flex items-center justify-center rounded-xl", bg.tertiary, radius.lg)}>
          <Palette size={20} strokeWidth={1.75} className={accent.text} />
        </div>
        <h2 className={clsx("text-lg font-semibold mb-1", text.primary)}>Build your first mockup</h2>
        <p className={clsx("text-xs leading-relaxed mb-5", text.tertiary)}>
          Drag a device onto the canvas, add a headline, or drop in an image to get started.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
          <button className={primary} onClick={() => go('devices')}>
            <Monitor size={14} strokeWidth={1.75} />
            Add device
          </button>
          <button className={secondary} onClick={() => go('text')}>
            <Type size={14} strokeWidth={1.75} />
            Add text
          </button>
          <button className={secondary} onClick={() => go('images')}>
            <ImagePlus size={14} strokeWidth={1.75} />
            Import image
          </button>
        </div>

        <button
          onClick={() => go('canvas')}
          className={clsx("mt-3 inline-flex items-center gap-1.5 text-xs pointer-events-auto transition-colors", text.secondary, "hover:" + accent.text)}
        >
          <Palette size={12} strokeWidth={1.75} />
          Browse template presets
        </button>

        <div className={clsx("mt-6 inline-flex items-center gap-2 text-[10px]", text.muted)}>
          <kbd className={clsx("px-1 py-0.5 rounded", bg.tertiary)}>V</kbd>
          <span>select</span>
          <span>·</span>
          <kbd className={clsx("px-1 py-0.5 rounded", bg.tertiary)}>B</kbd>
          <span>brush</span>
          <span>·</span>
          <kbd className={clsx("px-1 py-0.5 rounded", bg.tertiary)}>G</kbd>
          <span>mask</span>
          <span>·</span>
          <kbd className={clsx("px-1 py-0.5 rounded", bg.tertiary)}>Ctrl+E</kbd>
          <span>export</span>
        </div>
      </div>
    </div>
  )
}
