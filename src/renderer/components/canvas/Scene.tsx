import { useMemo, useCallback, useRef } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useRuntimeStore } from '../../runtime/store'
import { ContextMenu } from '../shared/ContextMenu'
import BackgroundRenderer from '../backgrounds/BackgroundRenderer'
import DeviceFrame from '../devices/DeviceFrame'
import TextBox from '../text/TextBox'
import TitleBlock from '../text/TitleBlock'
import ImageOverlay from '../images/ImageOverlay'
import ShapeRenderer from '../shapes/ShapeRenderer'
import Grid from './Grid'
import WatermarkOverlay from './WatermarkOverlay'

export default function Scene() {
  const scene = useStore(safeScene)
  const updateGuide = useStore((s) => s.updateGuide)
  const pushHistory = useStore((s) => s.pushHistory)
  const contextMenu = useRuntimeStore((s) => s.contextMenu)
  const closeContextMenu = useRuntimeStore((s) => s.closeContextMenu)

  const allElements = useMemo(() => {
    const sortedDevices = [...scene.devices]
      .filter((d) => d.visible)
      .sort((a, b) => a.zIndex - b.zIndex)

    const sortedTextBoxes = [...scene.textBoxes]
      .filter((t) => t.visible)
      .sort((a, b) => a.zIndex - b.zIndex)

    const sortedImages = [...scene.images]
      .filter((i) => i.visible)
      .sort((a, b) => a.zIndex - b.zIndex)

    const sortedShapes = [...scene.shapes]
      .filter((s) => s.visible)
      .sort((a, b) => a.zIndex - b.zIndex)

    return [
      ...sortedDevices.map((d) => ({ type: 'device' as const, zIndex: d.zIndex, data: d })),
      ...sortedTextBoxes.map((t) => ({ type: 'textbox' as const, zIndex: t.zIndex, data: t })),
      ...sortedImages.map((i) => ({ type: 'image' as const, zIndex: i.zIndex, data: i })),
      ...sortedShapes.map((s) => ({ type: 'shape' as const, zIndex: s.zIndex, data: s }))
    ].sort((a, b) => a.zIndex - b.zIndex)
  }, [scene.devices, scene.textBoxes, scene.images, scene.shapes])

  /** Drag-to-move a guide line. */
  const dragGuide = useRef<{
    id: string
    startPos: number
    orientation: 'horizontal' | 'vertical'
    pushed: boolean
    el: HTMLElement | null
  } | null>(null)

  const handleGuidePointerDown = useCallback(
    (e: React.PointerEvent, gid: string, orientation: 'horizontal' | 'vertical', position: number) => {
      e.stopPropagation()
      const el = e.target as HTMLElement
      el.setPointerCapture(e.pointerId)
      dragGuide.current = { id: gid, startPos: position, orientation, pushed: false, el }
    },
    []
  )

  const handleGuidePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const dg = dragGuide.current
      if (!dg) return
      e.stopPropagation()
      const zoom = useStore.getState().zoom
      if (!dg.pushed) {
        dg.pushed = true
        pushHistory('Move guide')
      }
      if (dg.orientation === 'vertical') {
        const newPos = Math.max(0, dg.startPos + e.movementX / zoom)
        updateGuide(dg.id, newPos)
      } else {
        const newPos = Math.max(0, dg.startPos + e.movementY / zoom)
        updateGuide(dg.id, newPos)
      }
    },
    [updateGuide, pushHistory]
  )

  const handleGuidePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const dg = dragGuide.current
      if (!dg) return
      e.stopPropagation()
      dg.el?.releasePointerCapture?.(e.pointerId)
      dragGuide.current = null
    },
    []
  )

  const handleGuideContext = useCallback(
    (e: React.MouseEvent, gid: string) => {
      e.preventDefault()
      e.stopPropagation()
      const state = useStore.getState()
      useRuntimeStore.getState().openContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          { label: 'Delete Guide', danger: true, action: () => { state.pushHistory('Delete guide'); state.removeGuide(gid) } }
        ]
      })
    },
    []
  )

  return (
    <div
      data-scene-export
      className="relative overflow-hidden"
      style={{
        width: scene.canvas.width,
        height: scene.canvas.height
      }}
    >
      <div data-scene-background>
        <BackgroundRenderer background={scene.background} />
      </div>

      <Grid grid={scene.grid} canvasWidth={scene.canvas.width} canvasHeight={scene.canvas.height} />

      {/* User guides — interactive (drag to move, right-click to delete) */}
      <div onPointerMove={handleGuidePointerMove} onPointerUp={handleGuidePointerUp}>
        {scene.guides.map((g) => (
          <div
            key={g.id}
            data-guide="true"
            className="absolute cursor-ew-resize hover:z-10"
            style={{
              ...(g.orientation === 'vertical'
                ? { left: g.position, top: 0, width: 4, height: scene.canvas.height, marginLeft: -2 }
                : { left: 0, top: g.position, width: scene.canvas.width, height: 4, marginTop: -2 }),
              zIndex: 9998
            }}
            onPointerDown={(e) => handleGuidePointerDown(e, g.id, g.orientation, g.position)}
            onContextMenu={(e) => handleGuideContext(e, g.id)}
          >
            <div
              className="w-full h-full pointer-events-none"
              style={{
                background: g.orientation === 'vertical'
                  ? 'linear-gradient(90deg, transparent, #f472b6, transparent)'
                  : 'linear-gradient(0deg, transparent, #f472b6, transparent)',
                opacity: 0.6
              }}
            />
          </div>
        ))}
      </div>

      {allElements.map((el) => {
        switch (el.type) {
          case 'device':
            return <DeviceFrame key={el.data.id} device={el.data} />
          case 'textbox':
            return <TextBox key={el.data.id} textBox={el.data} />
          case 'image':
            return <ImageOverlay key={el.data.id} image={el.data} />
          case 'shape':
            return <ShapeRenderer key={el.data.id} shape={el.data} />
        }
      })}

      <WatermarkOverlay />

      <TitleBlock />

      {contextMenu && (
        <ContextMenu items={contextMenu.items} x={contextMenu.x} y={contextMenu.y} onClose={closeContextMenu} />
      )}
    </div>
  )
}
