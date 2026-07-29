import { useMemo, useState, useCallback, useRef } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import type { ContextMenuItem } from '../shared/ContextMenu'
import { ContextMenu } from '../shared/ContextMenu'
import BackgroundRenderer from '../backgrounds/BackgroundRenderer'
import DeviceFrame from '../devices/DeviceFrame'
import TextBox from '../text/TextBox'
import TitleBlock from '../text/TitleBlock'
import ImageOverlay from '../images/ImageOverlay'
import ShapeRenderer from '../shapes/ShapeRenderer'
import Grid from './Grid'
import Guides from './Guides'
import WatermarkOverlay from './WatermarkOverlay'

interface ActiveGuides {
  verticalGuides: number[]
  horizontalGuides: number[]
}

interface ContextMenuState {
  x: number
  y: number
  items: ContextMenuItem[]
}

export default function Scene() {
  const scene = useStore(safeScene)
  const updateGuide = useStore((s) => s.updateGuide)
  const pushHistory = useStore((s) => s.pushHistory)
  const [activeGuides, setActiveGuides] = useState<ActiveGuides>({ verticalGuides: [], horizontalGuides: [] })
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const handleGuidesChange = useCallback((guides: ActiveGuides) => {
    setActiveGuides(guides)
  }, [])

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

  const buildContextMenu = useCallback(
    (e: React.MouseEvent, type: string, id: string) => {
      e.preventDefault()
      e.stopPropagation()
      const state = useStore.getState()
      const isInGroup = allElements.some(
        (el) => el.data.id === id && 'groupId' in el.data && el.data.groupId
      )
      const items: ContextMenuItem[] = [
        { label: 'Bring to Front', action: () => { state.pushHistory('Bring to Front'); state.bringToFront(id) } },
        { label: 'Send to Back', action: () => { state.pushHistory('Send to Back'); state.sendToBack(id) } },
        { label: 'Bring Forward', action: () => { state.pushHistory('Bring Forward'); state.bringForward(id) } },
        { label: 'Send Backward', action: () => { state.pushHistory('Send Backward'); state.sendBackward(id) } },
        { divider: true, label: '', action: () => {} },
        { label: 'Duplicate', action: () => { state.pushHistory('Duplicate'); state.duplicateSelected([id]) } },
        { label: 'Delete', danger: true, action: () => { state.pushHistory('Delete'); state.deleteSelected([id]) } }
      ]
      if (isInGroup) {
        const groupId = allElements.find((el) => el.data.id === id)?.['data']?.['groupId']
        if (groupId) {
          items.splice(5, 0, { label: '', divider: true, action: () => {} })
          items.splice(5, 0, { label: 'Ungroup', action: () => { state.pushHistory('Ungroup'); state.ungroup(groupId); state.clearSelection() } })
        }
      }
      const selectedIds = state.selectedIds
      if (selectedIds.length >= 2) {
        items.push({ divider: true, label: '', action: () => {} })
        items.push({ label: 'Group', action: () => { state.pushHistory('Group'); state.groupSelected() } })
      }
      setContextMenu({ x: e.clientX, y: e.clientY, items })
    },
    [allElements]
  )

  const handleSceneContext = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        e.preventDefault()
        const state = useStore.getState()
        const selectedIds = state.selectedIds
        const items: ContextMenuItem[] = []
        if (selectedIds.length >= 2) {
          items.push({ label: 'Group', action: () => { state.pushHistory('Group'); state.groupSelected() } })
        }
        if (items.length > 0) {
          setContextMenu({ x: e.clientX, y: e.clientY, items })
        }
      }
    },
    []
  )

  /** Drag-to-move a guide line. */
  const dragGuide = useRef<{ id: string; startPos: number; orientation: 'horizontal' | 'vertical' } | null>(null)

  const handleGuidePointerDown = useCallback(
    (e: React.PointerEvent, gid: string, orientation: 'horizontal' | 'vertical', position: number) => {
      e.stopPropagation()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      dragGuide.current = { id: gid, startPos: position, orientation }
    },
    []
  )

  const handleGuidePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const dg = dragGuide.current
      if (!dg) return
      e.stopPropagation()
      const zoom = useStore.getState().zoom
      if (dg.orientation === 'vertical') {
        const newPos = Math.max(0, dg.startPos + e.movementX / zoom)
        updateGuide(dg.id, newPos)
      } else {
        const newPos = Math.max(0, dg.startPos + e.movementY / zoom)
        updateGuide(dg.id, newPos)
      }
    },
    [updateGuide]
  )

  const handleGuidePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const dg = dragGuide.current
      if (!dg) return
      e.stopPropagation()
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      pushHistory('Move guide')
      dragGuide.current = null
    },
    [pushHistory]
  )

  const handleGuideContext = useCallback(
    (e: React.MouseEvent, gid: string) => {
      e.preventDefault()
      e.stopPropagation()
      const state = useStore.getState()
      setContextMenu({
        x: e.clientX, y: e.clientY,
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
      onContextMenu={handleSceneContext}
    >
      <BackgroundRenderer background={scene.background} />

      <Grid grid={scene.grid} canvasWidth={scene.canvas.width} canvasHeight={scene.canvas.height} />

      {/* User guides — interactive (drag to move, right-click to delete) */}
      <div onPointerMove={handleGuidePointerMove} onPointerUp={handleGuidePointerUp}>
        {scene.guides.map((g) => (
          <div
            key={g.id}
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
                border: g.orientation === 'vertical' ? 'none' : 'none',
                background: g.orientation === 'vertical'
                  ? 'linear-gradient(90deg, transparent, #f472b6, transparent)'
                  : 'linear-gradient(0deg, transparent, #f472b6, transparent)',
                opacity: 0.6
              }}
            />
          </div>
        ))}
      </div>

      <Guides
        verticalGuides={activeGuides.verticalGuides}
        horizontalGuides={activeGuides.horizontalGuides}
        canvasWidth={scene.canvas.width}
        canvasHeight={scene.canvas.height}
      />

      {allElements.map((el) => {
        switch (el.type) {
          case 'device':
            return <DeviceFrame key={el.data.id} device={el.data} onGuidesChange={handleGuidesChange} onContextMenu={buildContextMenu} />
          case 'textbox':
            return <TextBox key={el.data.id} textBox={el.data} onGuidesChange={handleGuidesChange} onContextMenu={buildContextMenu} />
          case 'image':
            return <ImageOverlay key={el.data.id} image={el.data} onGuidesChange={handleGuidesChange} onContextMenu={buildContextMenu} />
          case 'shape':
            return <ShapeRenderer key={el.data.id} shape={el.data} onGuidesChange={handleGuidesChange} onContextMenu={buildContextMenu} />
        }
      })}

      <WatermarkOverlay />

      <TitleBlock />

      {contextMenu && (
        <ContextMenu items={contextMenu.items} x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} />
      )}
    </div>
  )
}
