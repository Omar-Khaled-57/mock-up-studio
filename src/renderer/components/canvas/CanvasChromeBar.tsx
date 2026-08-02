import { useCallback, useRef, useState, type ElementType } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useTheme } from '../../hooks/useTheme'
import { ZoomIn, ZoomOut, Maximize2, SlidersHorizontal, Ruler, Grid3X3, Magnet, Sparkles, Check } from 'lucide-react'
import SceneTabs from '../sidebar/SceneTabs'
import Menu from '../primitives/Menu'
import { ICON } from '../../lib/icons'

function ViewMenuItem({
  icon: Icon,
  label,
  checked,
  onSelect
}: {
  icon: ElementType
  label: string
  checked?: boolean
  onSelect: () => void
}) {
  const { clsx, text, bg, accent } = useTheme()
  return (
    <button
      role="menuitemcheckbox"
      aria-checked={!!checked}
      onClick={onSelect}
      className={clsx("w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-colors", text.primary, bg.hover)}
    >
      <Icon size={14} strokeWidth={1.75} className={checked ? accent.text : text.tertiary} />
      <span className="flex-1">{label}</span>
      {checked && <Check size={14} className={accent.text} />}
    </button>
  )
}

/**
 * Canvas chrome bar (v0.3.0 IA §5): scene tabs on the left, zoom controls in
 * the center, and a View menu (rulers / grid / snap / smart guides) on the right.
 */
export default function CanvasChromeBar() {
  const { clsx, bg, text, border: borderT, accent } = useTheme()
  const scene = useStore(safeScene)
  const zoom = useStore((s) => s.zoom)
  const zoomIn = useStore((s) => s.zoomIn)
  const zoomOut = useStore((s) => s.zoomOut)
  const resetZoom = useStore((s) => s.resetZoom)
  const fitToWindow = useStore((s) => s.fitToWindow)

  const showRulers = useStore((s) => s.showRulers)
  const toggleRulers = useStore((s) => s.toggleRulers)
  const grid = useStore((s) => safeScene(s).grid)
  const updateGrid = useStore((s) => s.updateGrid)
  const showSmartGuides = useStore((s) => s.showSmartGuides)
  const toggleSmartGuides = useStore((s) => s.toggleSmartGuides)

  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const viewButtonRef = useRef<HTMLButtonElement>(null)

  const handleFit = useCallback(() => {
    const el = document.querySelector<HTMLElement>('[data-canvas-viewport]')
    if (!el) return
    fitToWindow(scene.canvas.width, scene.canvas.height, el.clientWidth, el.clientHeight)
  }, [fitToWindow, scene.canvas.width, scene.canvas.height])

  const closeViewMenu = useCallback(() => setViewMenuOpen(false), [])

  return (
    <div className={clsx("flex items-center h-10 px-2 gap-2 border-b shrink-0 min-w-0", bg.primary, borderT.primary)}>
      {/* Scene tabs strip (left) */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <SceneTabs chrome />
      </div>

      {/* Zoom controls (center) */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={zoomOut}
          aria-label="Zoom out"
          title="Zoom out"
          className={clsx("h-7 w-7 flex items-center justify-center rounded-lg transition-all duration-150 active:scale-[0.98]", text.secondary, bg.hover)}
        >
          <ZoomOut size={ICON.hero} strokeWidth={ICON.stroke} />
        </button>
        <button
          onClick={resetZoom}
          title="Reset zoom"
          className={clsx("min-w-[52px] h-7 px-2 rounded-md text-xs font-medium transition-colors", bg.button, text.primary)}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={zoomIn}
          aria-label="Zoom in"
          title="Zoom in"
          className={clsx("h-7 w-7 flex items-center justify-center rounded-lg transition-all duration-150 active:scale-[0.98]", text.secondary, bg.hover)}
        >
          <ZoomIn size={ICON.hero} strokeWidth={ICON.stroke} />
        </button>
        <button
          onClick={handleFit}
          title="Fit to window"
          className={clsx("h-7 flex items-center gap-1 px-2 rounded-md text-xs font-medium transition-colors", bg.button, text.primary)}
        >
          <Maximize2 size={ICON.compact} strokeWidth={ICON.stroke} className={accent.text} />
          Fit
        </button>
      </div>

      {/* View menu (right) */}
      <div className="shrink-0">
        <button
          ref={viewButtonRef}
          onClick={() => setViewMenuOpen((v) => !v)}
          aria-label="View options"
          aria-haspopup="menu"
          aria-expanded={viewMenuOpen}
          title="View options"
          className={clsx(
            "h-7 w-7 flex items-center justify-center rounded-md transition-colors",
            bg.button,
            viewMenuOpen && bg.active
          )}
        >
          <SlidersHorizontal size={14} strokeWidth={1.75} />
        </button>
        <Menu
          open={viewMenuOpen}
          onClose={closeViewMenu}
          anchorRef={viewButtonRef}
          align="end"
          width={200}
          data-menu="canvas-view-menu"
        >
          <ViewMenuItem
            icon={Ruler}
            label="Show rulers"
            checked={showRulers}
            onSelect={() => { toggleRulers(); closeViewMenu() }}
          />
          <ViewMenuItem
            icon={Grid3X3}
            label="Show grid"
            checked={grid.enabled}
            onSelect={() => { updateGrid({ enabled: !grid.enabled }); closeViewMenu() }}
          />
          <ViewMenuItem
            icon={Magnet}
            label="Snap to grid"
            checked={grid.snapEnabled}
            onSelect={() => { updateGrid({ snapEnabled: !grid.snapEnabled }); closeViewMenu() }}
          />
          <ViewMenuItem
            icon={Sparkles}
            label="Smart guides"
            checked={showSmartGuides}
            onSelect={() => { toggleSmartGuides(); closeViewMenu() }}
          />
          <div className={clsx("my-1 border-t", borderT.secondary)} />
          <ViewMenuItem
            icon={Maximize2}
            label="Reset zoom"
            onSelect={() => { resetZoom(); closeViewMenu() }}
          />
        </Menu>
      </div>
    </div>
  )
}
