import { useMemo, useCallback, useRef, useState } from 'react'
import type { Device, ImageOverlay as ImageOverlayType, Scene, Shape, TextBox as TextBoxType } from '@shared/types'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useRuntimeStore } from '../../runtime/store'
import { ContextMenu } from '../shared/ContextMenu'
import BackgroundRenderer from '../backgrounds/BackgroundRenderer'
import DeviceFrame from '../devices/DeviceFrame'
import TextBox from '../text/TextBox'
import ImageOverlay from '../images/ImageOverlay'
import ShapeRenderer from '../shapes/ShapeRenderer'
import Grid from './Grid'
import MaskSnapshotLayer from '../masks/MaskSnapshotLayer'
import { buildContainerClip, ContainerClipInput } from '../../services/container-clip'
import { buildMaskClipPath } from '../../services/mask-visualization'
import { screenToScene } from '../../services/viewport'

type ElementEntry =
  | { type: 'device'; zIndex: number; data: Device }
  | { type: 'textbox'; zIndex: number; data: TextBoxType }
  | { type: 'image'; zIndex: number; data: ImageOverlayType }
  | { type: 'shape'; zIndex: number; data: Shape }

type RenderNode =
  | { kind: 'element'; entry: ElementEntry }
  | { kind: 'clip'; container: ElementEntry; children: RenderNode[] }

/** Visible elements flattened across the four kinds and sorted by z-index. */
function buildSortedEntries(scene: Scene): ElementEntry[] {
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
}

function buildClipInput(container: ElementEntry): ContainerClipInput {
  switch (container.type) {
    case 'shape':
      return {
        kind: 'shape',
        width: container.data.width,
        height: container.data.height,
        shapeKind: container.data.kind,
        cornerRadius: container.data.cornerRadius,
        angles: container.data.angles,
        plusThickness: container.data.plusThickness,
        arrowThickness: container.data.arrowThickness,
        crossThickness: container.data.crossThickness
      }
    default:
      return {
        kind: container.type,
        width: container.data.width,
        height: container.data.height
      }
  }
}

export default function Scene() {
  const scene = useStore(safeScene)
  const updateGuide = useStore((s) => s.updateGuide)
  const removeGuide = useStore((s) => s.removeGuide)
  const pushHistory = useStore((s) => s.pushHistory)
  const contextMenu = useRuntimeStore((s) => s.contextMenu)
  const closeContextMenu = useRuntimeStore((s) => s.closeContextMenu)
  const focusElementId = useRuntimeStore((s) => s.focusElementId)

  /**
   * Flat render tree with container clipping. Every element that has children
   * (a `containerId` parent) renders through a clip wrapper positioned at the
   * container's box: rect boxes clip via overflow, shape parents clip to their
   * exact outline. When the container is the active `focusElementId` its clip
   * is skipped so the children render in full (fully editable), and nested
   * containers stay clipped whenever they sit inside an unfocused ancestor.
   */
  const renderNodes = useMemo(() => {
    const sorted = buildSortedEntries(scene)
    const childMap = new Map<string, ElementEntry[]>()
    for (const entry of sorted) {
      const cid = entry.data.containerId
      if (!cid) continue
      const list = childMap.get(cid)
      if (list) list.push(entry)
      else childMap.set(cid, [entry])
    }

    // Children of clipped (non-focused) containers render only inside their
    // parent's wrapper — never in the flat list (prevents double-render).
    const handledInWrapper = new Set<string>()
    for (const [cid, children] of childMap) {
      if (cid === focusElementId) continue
      for (const child of children) handledInWrapper.add(child.data.id)
    }

    const rendered = new Set<string>()
    const build = (entries: ElementEntry[]): RenderNode[] => {
      const nodes: RenderNode[] = []
      for (const entry of entries) {
        if (rendered.has(entry.data.id)) continue
        rendered.add(entry.data.id)
        const children = childMap.get(entry.data.id)
        if (children && entry.data.id !== focusElementId) {
          nodes.push({ kind: 'element', entry })
          nodes.push({ kind: 'clip', container: entry, children: build(children) })
        } else {
          nodes.push({ kind: 'element', entry })
          // A focused container is fully editable: its children render
          // unclipped directly after it instead of inside a clip wrapper.
          if (children && entry.data.id === focusElementId) {
            nodes.push(...build(children))
          }
        }
      }
      return nodes
    }

    return build(sorted.filter((e) => !handledInWrapper.has(e.data.id)))
  }, [scene, focusElementId])

  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null)

  /** Drag-to-move a guide line. */
  const dragGuide = useRef<{
    id: string
    startPos: number
    orientation: 'horizontal' | 'vertical'
    pushed: boolean
    el: HTMLElement | null
    startScenePos: number
  } | null>(null)

  const getViewportRect = useCallback((target: EventTarget | null) => {
    const viewport = (target as HTMLElement | null)?.closest<HTMLElement>('[data-canvas-viewport], [data-scene-export]')
    return viewport?.getBoundingClientRect() ?? null
  }, [])

  const handleGuidePointerDown = useCallback(
    (e: React.PointerEvent, gid: string, orientation: 'horizontal' | 'vertical', position: number) => {
      e.stopPropagation()
      setSelectedGuideId(gid)
      const el = e.target as HTMLElement | null
      if (el) {
        const capture = (el as HTMLElement & { setPointerCapture?: (id: number) => void }).setPointerCapture
        if (typeof capture === 'function') capture.call(el, e.pointerId)
      }
      const scenePoint = screenToScene(
        e.clientX,
        e.clientY,
        getViewportRect(e.currentTarget),
        { x: useStore.getState().panX, y: useStore.getState().panY },
        useStore.getState().zoom
      )

      dragGuide.current = {
        id: gid,
        startPos: position,
        orientation,
        pushed: false,
        el,
        startScenePos: orientation === 'vertical' ? scenePoint.x : scenePoint.y
      }
    },
    [getViewportRect]
  )

  const handleGuidePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const dg = dragGuide.current
      if (!dg) return
      e.stopPropagation()
      const state = useStore.getState()
      const scenePoint = screenToScene(
        e.clientX,
        e.clientY,
        getViewportRect(e.currentTarget),
        { x: state.panX, y: state.panY },
        state.zoom
      )

      if (!dg.pushed) {
        dg.pushed = true
        pushHistory('Move guide')
      }
      if (dg.orientation === 'vertical') {
        const delta = scenePoint.x - dg.startScenePos
        const newPos = Math.max(0, dg.startPos + delta)
        updateGuide(dg.id, newPos)
      } else {
        const delta = scenePoint.y - dg.startScenePos
        const newPos = Math.max(0, dg.startPos + delta)
        updateGuide(dg.id, newPos)
      }
    },
    [updateGuide, pushHistory, getViewportRect]
  )

  const handleGuidePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const dg = dragGuide.current
      if (!dg) return
      e.stopPropagation()
      dg.el?.releasePointerCapture?.(e.pointerId)

      const target = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(e.clientX, e.clientY) : null
      const ruler = target?.closest('[data-ruler]') ?? Array.from(document.querySelectorAll<HTMLElement>('[data-ruler]')).find((el) => {
        const rect = el.getBoundingClientRect()
        return e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
      })
      if (ruler) {
        pushHistory('Delete guide')
        removeGuide(dg.id)
      }

      dragGuide.current = null
      setSelectedGuideId((current) => (current === dg.id ? null : current))
    },
    [pushHistory, removeGuide]
  )

  const handleScenePointerDown = useCallback(() => {
    setSelectedGuideId(null)
  }, [])

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

  const renderElement = (entry: ElementEntry): React.ReactNode => {
    switch (entry.type) {
      case 'device':
        return <DeviceFrame key={entry.data.id} device={entry.data} />
      case 'textbox':
        return <TextBox key={entry.data.id} textBox={entry.data} />
      case 'image':
        return <ImageOverlay key={entry.data.id} image={entry.data} />
      case 'shape':
        return <ShapeRenderer key={entry.data.id} shape={entry.data} />
    }
  }

  const renderClip = (node: { container: ElementEntry; children: RenderNode[] }): React.ReactNode => {
    const container = node.container
    const d = container.data
    const clip = buildContainerClip(buildClipInput(container))

    // Counter-translate layer: wrapper box starts at the container's corner,
    // so children (positioned in scene coordinates) shift back to scene space.
    const translateLayer = (
      <div
        style={{
          position: 'absolute',
          left: -d.x,
          top: -d.y,
          width: scene.canvas.width,
          height: scene.canvas.height
        }}
      >
        {node.children.map(renderNode)}
      </div>
    )

    return (
      <div
        key={`clip-${d.id}`}
        data-container-clip={d.id}
        style={{
          position: 'absolute',
          left: d.x,
          top: d.y,
          width: d.width,
          height: d.height,
          zIndex: container.zIndex,
          overflow: 'hidden',
          ...(clip.shapeClip ? { clipPath: clip.shapeClip } : {})
        }}
      >
        {translateLayer}
      </div>
    )
  }

  const renderNode = (node: RenderNode): React.ReactNode => {
    if (node.kind === 'element') return renderElement(node.entry)
    return renderClip(node)
  }

  /**
   * Scene content clipped by mask layers. Masks are independent SCENE layers
   * with Z-AWARE semantics: a mask PRESERVES everything strictly below its
   * z-index (content beneath the mask — including the scene background and
   * anything drawn before it — shows through its region) and PUNCHES OUT
   * content at or above it. Content sharing a mask's z-index counts as ABOVE
   * the mask and is clipped — layers added after a mask can land at the same
   * z-index, and they must not leak into its region.
   *
   * To express that, content is partitioned into z-bands: band 0 holds the
   * background, the grid and every node strictly below the lowest mask; band i
   * holds `[mask[i-1].z, mask[i].z)`; the top band holds everything at or above
   * the highest mask. Band 0 renders unclipped. Each mask clips its own band
   * and every higher band by wrapping them ascending (lowest mask innermost,
   * highest outermost), so a mask affects exactly the content above it —
   * `zIndex: mask.zIndex` keeps the wrappers in the scene's stacking order.
   *
   * Editor chrome that must stay interactive or export-stripped (guides,
   * watermark, context menu) renders outside the wrapper.
   */
  // Masks are independent SCENE layers with z-aware semantics. LIVE masks (no
  // `snapshot`) drive the z-band clipping below: each mask preserves everything
  // strictly below its z-index and punches out content at or above it. FROZEN
  // masks (a `snapshot` capture) paint their snapshot layer over their hole
  // instead — they don't create bands, because their opaque snapshot is the
  // only thing the masked region shows, which makes banding them a visual
  // no-op.
  const allVisibleMasks = scene.masks
    .filter((m) => m.visible)
    .sort((a, b) => a.zIndex - b.zIndex)
  const liveMasks = allVisibleMasks.filter((m) => !m.snapshot)
  const frozenMasks = allVisibleMasks.filter((m) => m.snapshot)

  /** The band a content layer belongs to, given its z-index. */
  const bandForZ = (z: number): number => {
    for (let i = 0; i < liveMasks.length; i++) {
      if (z < liveMasks[i].zIndex) return i
    }
    return liveMasks.length
  }
  const zOfNode = (node: RenderNode): number =>
    node.kind === 'element' ? node.entry.zIndex : node.container.zIndex

  const bandContent: React.ReactNode[][] = Array.from({ length: liveMasks.length + 1 }, () => [])
  // The background is beneath every mask (a mask always preserves the canvas
  // behind it); the grid is a z-index-1 content layer, banded like any element.
  bandContent[bandForZ(-1)].push(
    <div key="scene-background" data-scene-background style={{ position: 'absolute', inset: 0 }}>
      <BackgroundRenderer background={scene.background} />
    </div>
  )
  bandContent[bandForZ(1)].push(
    <Grid key="scene-grid" grid={scene.grid} canvasWidth={scene.canvas.width} canvasHeight={scene.canvas.height} />
  )
  for (const node of renderNodes) {
    bandContent[bandForZ(zOfNode(node))].push(renderNode(node))
  }

  // Each band renders inside a `data-scene-band` grouping div. The div is inert
  // for layout — no z-index/transform, so its children keep stacking by their
  // own z-index — but lets the export engine capture the bands independently.
  const bandEls = bandContent.map((nodes, i) => (
    <div key={`scene-band-${i}`} data-scene-band={i} style={{ position: 'absolute', inset: 0 }}>
      {nodes}
    </div>
  ))

  const frozenLayers = frozenMasks.map((mask) => (
    <MaskSnapshotLayer key={mask.id} mask={mask} canvasWidth={scene.canvas.width} canvasHeight={scene.canvas.height} />
  ))

  let maskedContent: React.ReactNode
  if (liveMasks.length === 0) {
    maskedContent = (
      <>
        {bandEls[0]}
        {frozenLayers}
      </>
    )
  } else {
    // Fold descending: the top band is innermost; clip m(i) wraps band i+1 and
    // every higher mask, so each mask clips exactly the content above it. The
    // lowest mask ends up the OUTERMOST wrapper, the highest the innermost.
    let inner: React.ReactNode = null
    for (let i = liveMasks.length - 1; i >= 0; i--) {
      const mask = liveMasks[i]
      inner = (
        <div
          key={`scene-mask-${mask.id}`}
          data-scene-mask-clip="true"
          data-scene-mask-for={mask.id}
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            zIndex: mask.zIndex,
            pointerEvents: 'none',
            clipPath: buildMaskClipPath(mask, scene.canvas.width, scene.canvas.height)
          }}
        >
          {bandEls[i + 1]}
          {inner}
        </div>
      )
    }
    maskedContent = (
      <>
        {bandEls[0]}
        {inner}
        {frozenLayers}
      </>
    )
  }

  return (
    <div
      data-scene-export
      className="relative overflow-hidden"
      style={{
        width: scene.canvas.width,
        height: scene.canvas.height
      }}
    >
      {maskedContent}

      {/* User guides — interactive (drag to move, right-click to delete) */}
      <div onPointerDown={handleScenePointerDown} onPointerMove={handleGuidePointerMove} onPointerUp={handleGuidePointerUp}>
        {scene.guides.map((g) => (
          <div
            key={g.id}
            data-guide="true"
            data-guide-selected={selectedGuideId === g.id ? 'true' : 'false'}
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
                opacity: selectedGuideId === g.id ? 1 : 0.6
              }}
            />
          </div>
        ))}
      </div>

      {contextMenu && (
        <ContextMenu items={contextMenu.items} x={contextMenu.x} y={contextMenu.y} onClose={closeContextMenu} />
      )}
    </div>
  )
}
