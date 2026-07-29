import { useCallback, useRef } from 'react'
import { useStore } from '../../store'

const RULER_SIZE = 20
const VISUAL_TICK_STEP = 50

interface RulerProps {
  orientation: 'horizontal' | 'vertical'
  /** Viewport dimension in CSS pixels */
  viewportLength: number
}

export default function Ruler({ orientation, viewportLength }: RulerProps) {
  const zoom = useStore((s) => s.zoom)
  const panX = useStore((s) => s.panX)
  const panY = useStore((s) => s.panY)
  const addGuide = useStore((s) => s.addGuide)
  const pushHistory = useStore((s) => s.pushHistory)
  const dragging = useRef<{ startScenePos: number } | null>(null)
  const rulerRef = useRef<HTMLDivElement>(null)

  /** Scene position for a given viewport coordinate. */
  const viewportToScene = useCallback(
    (clientPos: number) => {
      const el = rulerRef.current
      if (!el) return 0
      const rect = el.getBoundingClientRect()
      const viewportPx = orientation === 'horizontal'
        ? clientPos - rect.left
        : clientPos - rect.top
      const pan = orientation === 'horizontal' ? panX : panY
      return Math.round((viewportPx - pan) / zoom)
    },
    [orientation, zoom, panX, panY]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const sp = viewportToScene(orientation === 'horizontal' ? e.clientX : e.clientY)
      dragging.current = { startScenePos: sp }
      const el = e.currentTarget as HTMLElement
      el.setPointerCapture(e.pointerId)
      // Show preview
      const preview = document.getElementById('ruler-guide-preview')
      if (preview) {
        const line = preview.firstChild as HTMLElement | null
        if (line) {
          if (orientation === 'horizontal') {
            line.style.left = '0'
            line.style.top = `${sp * zoom + (orientation === 'horizontal' ? panY : panX)}px`
            line.style.width = '100%'
            line.style.height = '1px'
            line.style.borderTop = '1px solid #f472b6'
          } else {
            line.style.left = `${sp * zoom + panX}px`
            line.style.top = '0'
            line.style.width = '1px'
            line.style.height = '100%'
            line.style.borderLeft = '1px solid #f472b6'
          }
        }
        preview.style.display = 'block'
      }
    },
    [orientation, zoom, panX, panY, viewportToScene]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return
      const sp = viewportToScene(orientation === 'horizontal' ? e.clientX : e.clientY)
      const preview = document.getElementById('ruler-guide-preview')
      if (preview) {
        const line = preview.firstChild as HTMLElement | null
        if (line) {
          if (orientation === 'horizontal') {
            line.style.top = `${sp * zoom + panY}px`
          } else {
            line.style.left = `${sp * zoom + panX}px`
          }
        }
      }
    },
    [orientation, zoom, panX, panY, viewportToScene]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return
      const el = e.currentTarget as HTMLElement
      el.releasePointerCapture(e.pointerId)
      const sp = viewportToScene(orientation === 'horizontal' ? e.clientX : e.clientY)
      pushHistory('Add guide')
      addGuide(orientation, Math.max(0, sp))
      const preview = document.getElementById('ruler-guide-preview')
      if (preview) preview.style.display = 'none'
      dragging.current = null
    },
    [orientation, viewportToScene, addGuide, pushHistory]
  )

  /** Generate tick marks at ~50px visual intervals */
  const ticks: React.ReactNode[] = []
  const sceneStep = Math.max(1, Math.round(VISUAL_TICK_STEP / zoom / 10) * 10)
  const pan = orientation === 'horizontal' ? panX : panY

  // Determine visible scene range
  const visibleStart = Math.max(0, Math.floor((-pan) / zoom / sceneStep) * sceneStep)
  const visibleEnd = Math.ceil((-pan + viewportLength) / zoom / sceneStep) * sceneStep

  for (let scenePos = visibleStart; scenePos <= visibleEnd; scenePos += sceneStep) {
    if (scenePos < 0) continue
    const viewportPos = scenePos * zoom + pan
    if (viewportPos < -50 || viewportPos > viewportLength + 50) continue

    ticks.push(
      <div
        key={scenePos}
        className="absolute"
        style={orientation === 'horizontal' ? { left: viewportPos, top: 0 } : { left: 0, top: viewportPos }}
        data-ruler-tick
      >
        <div
          className="bg-zinc-500"
          style={orientation === 'horizontal' ? { width: 1, height: 8, marginLeft: -0.5 } : { width: 8, height: 1, marginTop: -0.5 }}
        />
        <span
          className="absolute text-[8px] text-zinc-500 select-none"
          style={
            orientation === 'horizontal'
              ? { left: 3, top: 9 }
              : { left: 2, top: 3, whiteSpace: 'nowrap', background: '#18181b', paddingRight: 2 }
          }
        >
          {scenePos}
        </span>
      </div>
    )

    // Subtick at half step
    const sub = scenePos + sceneStep / 2
    if (sub > 0) {
      const subVp = sub * zoom + pan
      if (subVp > -30 && subVp < viewportLength + 30) {
        ticks.push(
          <div
            key={`sub-${sub}`}
            className="absolute"
            style={orientation === 'horizontal' ? { left: subVp, top: 0 } : { left: 0, top: subVp }}
          >
            <div
              className="bg-zinc-600"
              style={orientation === 'horizontal' ? { width: 1, height: 4, marginLeft: -0.5 } : { width: 4, height: 1, marginTop: -0.5 }}
            />
          </div>
        )
      }
    }
  }

  return (
    <div
      ref={rulerRef}
      className="relative bg-zinc-900/90 select-none"
      style={{
        [orientation === 'horizontal' ? 'width' : 'height']: viewportLength,
        [orientation === 'horizontal' ? 'height' : 'width']: RULER_SIZE,
        cursor: 'crosshair'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {ticks}
    </div>
  )
}
