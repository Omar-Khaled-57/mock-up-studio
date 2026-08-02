import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useRuntimeStore } from '../../runtime/store'
import { collectSelectionChrome, getElementGeometry, selectionUnionBounds } from '../../services/selection-chrome'
import { getRotatedBounds, Rect } from '../../services/geometry'
import { isInFocusScope } from '../../services/focus'
import { SelectionChromeItem } from '../../services/selection-chrome'
import { MaskOverlay } from '../masks/MaskRenderer'
import { collectMaskVisuals } from '../../services/mask-visualization'
import Guides from './Guides'
import FocusDim from './FocusDim'
import StrokeSurface from './StrokeSurface'
import ResizeHandles from '../shared/ResizeHandles'

function renderSingleChrome(item: SelectionChromeItem) {
  return (
    <div
      key={item.id}
      data-chrome-element-id={item.id}
      data-chrome-element-kind={item.kind}
      style={{
        position: 'absolute',
        left: item.bounds.x,
        top: item.bounds.y,
        width: item.bounds.width,
        height: item.bounds.height,
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

  const chrome = collectSelectionChrome(scene, selectedIds)

  const maskVisuals = collectMaskVisuals(scene)

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
      <FocusDim />

      <Guides
        verticalGuides={snapGuides.verticalGuides}
        horizontalGuides={snapGuides.horizontalGuides}
        canvasWidth={scene.canvas.width}
        canvasHeight={scene.canvas.height}
      />

      <MaskOverlay width={scene.canvas.width} height={scene.canvas.height} visuals={maskVisuals} preview={maskPreview} />

      {chrome.length === 1 ? renderSingleChrome(chrome[0]) : chrome.length > 1 ? renderUnionChrome(chrome) : null}

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
    </div>
  )
}
