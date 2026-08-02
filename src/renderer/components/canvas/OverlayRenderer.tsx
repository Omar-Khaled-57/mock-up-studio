import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useRuntimeStore } from '../../runtime/store'
import { useTheme } from '../../hooks/useTheme'
import { collectSelectionChrome, getElementGeometry, selectionUnionBounds } from '../../services/selection-chrome'
import { getRotatedBounds, Rect } from '../../services/geometry'
import { isInFocusScope } from '../../services/focus'
import { SelectionChromeItem } from '../../services/selection-chrome'
import { MaskOverlay } from '../masks/MaskRenderer'
import { collectMaskVisuals } from '../../services/mask-visualization'
import { resolveLiveGhost } from '../../services/preview'
import Guides from './Guides'
import FocusDim from './FocusDim'
import StrokeSurface from './StrokeSurface'
import PreviewSurface from './PreviewSurface'
import ResizeHandles from '../shared/ResizeHandles'

function renderSingleChrome(item: SelectionChromeItem, liveBounds?: Rect | null) {
  const bounds = liveBounds ?? item.bounds
  return (
    <div
      key={item.id}
      data-chrome-element-id={item.id}
      data-chrome-element-kind={item.kind}
      style={{
        position: 'absolute',
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
        transformOrigin: 'center',
        pointerEvents: 'none'
      }}
    >
      <ResizeHandles groupId={item.groupId} groupName={item.groupName} />
    </div>
  )
}

function renderUnionChrome(items: SelectionChromeItem[]) {
  const union = selectionUnionBounds(items)
  if (!union) return null
  return (
    <div
      data-chrome-union="true"
      style={{
        position: 'absolute',
        left: union.x,
        top: union.y,
        width: union.width,
        height: union.height,
        pointerEvents: 'none'
      }}
    >
      <div style={{ position: 'absolute', inset: -1, border: '1px solid #3b82f6', borderRadius: 3 }} />
    </div>
  )
}

export default function OverlayRenderer() {
  const scene = useStore(safeScene)
  const selectedIds = useStore((s) => s.selectedIds)
  const snapGuides = useRuntimeStore((s) => s.snapGuides)
  const containerDropTarget = useRuntimeStore((s) => s.containerDropTarget)
  const marqueeRect = useRuntimeStore((s) => s.marqueeRect)
  const hoveredElement = useRuntimeStore((s) => s.hoveredElement)
  const focusGroupId = useRuntimeStore((s) => s.focusGroupId)
  const focusElementId = useRuntimeStore((s) => s.focusElementId)
  const maskPreview = useRuntimeStore((s) => s.maskPreview)
  const activeInteraction = useRuntimeStore((s) => s.activeInteraction)
  const preview = useRuntimeStore((s) => s.preview)

  const chrome = collectSelectionChrome(scene, selectedIds)
  const { isLight } = useTheme()

  const maskVisuals = collectMaskVisuals(scene)

  // During a resize gesture the element's box grows/shrinks freely in the DOM,
  // so the store-driven chrome (which commits only on pointer-up) would sit at
  // the ORIGINAL bounds — a stale box that keeps the element's start aspect
  // ratio until the resize commits ("snaps" on release). Track the live bounds
  // instead: the ghost's raw source is the shared live-transform (the element
  // facade reads the same source), so the chrome follows the resize in real
  // time. Drags keep the approved origin-outline + destination-ghost behavior
  // (chrome stays at the start bounds).
  let resizeLiveBounds: Rect | null = null
  if (activeInteraction?.kind === 'resize' && chrome.length === 1) {
    const source = resolveLiveGhost(preview, chrome[0].id)
    if (source) resizeLiveBounds = { x: source.x, y: source.y, width: source.width, height: source.height }
  }

  let hoverBounds: Rect | null = null
  if (
    hoveredElement &&
    !chrome.some((c) => c.id === hoveredElement.id) &&
    isInFocusScope(hoveredElement.id, focusGroupId, scene, focusElementId)
  ) {
    const el = getElementGeometry(scene, hoveredElement.id)
    if (el) hoverBounds = getRotatedBounds(el)
  }

  let dropBounds: Rect | null = null
  if (containerDropTarget) {
    const el = getElementGeometry(scene, containerDropTarget)
    if (el) dropBounds = getRotatedBounds(el)
  }

  return (
    <div className="absolute inset-0" style={{ pointerEvents: 'none', zIndex: 10000 }}>
      {scene.background.transparent && (
        <div
          aria-hidden="true"
          data-transparent-checker="true"
          style={{
            position: 'absolute',
            inset: 0,
            border: `1px solid ${isLight ? '#111827' : '#f9fafb'}`,
            boxShadow: `inset 0 0 0 1px ${isLight ? 'rgba(17, 24, 39, 0.2)' : 'rgba(255, 255, 255, 0.25)'}`,
            pointerEvents: 'none'
          }}
        />
      )}

      <FocusDim />

      <Guides
        verticalGuides={snapGuides.verticalGuides}
        horizontalGuides={snapGuides.horizontalGuides}
        canvasWidth={scene.canvas.width}
        canvasHeight={scene.canvas.height}
      />

      <MaskOverlay width={scene.canvas.width} height={scene.canvas.height} visuals={maskVisuals} preview={maskPreview} />

      {chrome.length === 1 ? renderSingleChrome(chrome[0], resizeLiveBounds) : chrome.length > 1 ? renderUnionChrome(chrome) : null}

      {dropBounds && (
        <div
          data-container-drop-target={containerDropTarget!}
          style={{
            position: 'absolute',
            left: dropBounds.x,
            top: dropBounds.y,
            width: dropBounds.width,
            height: dropBounds.height,
            border: '2px dashed #6366f1',
            borderRadius: 4,
            pointerEvents: 'none'
          }}
        />
      )}

      {marqueeRect && marqueeRect.width > 0 && marqueeRect.height > 0 && (
        <div
          data-marquee="true"
          style={{
            position: 'absolute',
            left: marqueeRect.x,
            top: marqueeRect.y,
            width: marqueeRect.width,
            height: marqueeRect.height,
            border: '1px solid #6366f1',
            background: 'rgba(79, 70, 229, 0.1)',
            pointerEvents: 'none'
          }}
        />
      )}

      {hoverBounds && (
        <div
          data-hover-outline={hoveredElement!.id}
          style={{
            position: 'absolute',
            left: hoverBounds.x,
            top: hoverBounds.y,
            width: hoverBounds.width,
            height: hoverBounds.height,
            border: '1px solid rgba(59, 130, 246, 0.5)',
            borderRadius: 3,
            pointerEvents: 'none'
          }}
        />
      )}

      <StrokeSurface />
      <PreviewSurface />
    </div>
  )
}
