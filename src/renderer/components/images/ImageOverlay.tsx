import { useCallback } from 'react'
import { ImageOverlay as ImageOverlayType } from '@shared/types'
import { useStore } from '../../store'
import { useDrag } from '../../hooks/useDrag'
import { useResize } from '../../hooks/useResize'
import { useSnapping } from '../../hooks/useSnapping'
import ResizeHandles from '../shared/ResizeHandles'

interface Props {
  image: ImageOverlayType
  onGuidesChange?: (guides: { verticalGuides: number[]; horizontalGuides: number[] }) => void
}

export default function ImageOverlay({ image, onGuidesChange }: Props) {
  const select = useStore((s) => s.select)
  const isSelected = useStore((s) => s.selectedIds.includes(image.id))
  const updateImage = useStore((s) => s.updateImage)
  const pushHistory = useStore((s) => s.pushHistory)
  const zoom = useStore((s) => s.zoom)

  const { computeSnap } = useSnapping()

  const commitPosition = useCallback(
    (id: string, x: number, y: number) => {
      updateImage(id, { x, y })
    },
    [updateImage]
  )

  const commitEnd = useCallback(() => {
    pushHistory('Move image')
  }, [pushHistory])

  const snapFn = useCallback(
    (id: string, x: number, y: number, w: number, h: number) => {
      const result = computeSnap({ id, x, y, width: w, height: h })
      onGuidesChange?.({ verticalGuides: result.verticalGuides, horizontalGuides: result.horizontalGuides })
      return { x: result.x, y: result.y }
    },
    [computeSnap, onGuidesChange]
  )

  const drag = useDrag({ zoom, onDrag: commitPosition, onEnd: commitEnd, snapFn, onGuidesChange })

  const commitResize = useCallback(
    (id: string, x: number, y: number, w: number, h: number) => {
      updateImage(id, { x, y, width: w, height: h })
    },
    [updateImage]
  )

  const resizeEnd = useCallback(() => {
    pushHistory('Resize image')
  }, [pushHistory])

  const resize = useResize({ zoom, onResize: commitResize, onEnd: resizeEnd })

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      select(image.id, e.shiftKey)
    },
    [image.id, select]
  )

  const handleDragDown = useCallback(
    (e: React.PointerEvent) => {
      if (image.locked) return
      drag.handlePointerDown(e, image.id, image.x, image.y, image.width, image.height)
    },
    [image, drag]
  )

  const handleResizeDown = useCallback(
    (e: React.PointerEvent, handle: 'nw' | 'ne' | 'sw' | 'se') => {
      if (image.locked) return
      resize.handlePointerDown(e, image.id, handle, image.x, image.y, image.width, image.height)
    },
    [image, resize]
  )

  return (
    <div
      onClick={handleClick}
      onPointerDown={handleDragDown}
      onPointerMove={drag.handlePointerMove}
      onPointerUp={drag.handlePointerUp}
      style={{
        position: 'absolute',
        left: image.x,
        top: image.y,
        width: image.width,
        height: image.height,
        transform: `rotate(${image.rotation}deg)`,
        zIndex: image.zIndex,
        cursor: image.locked ? 'default' : 'move',
        opacity: image.locked ? 0.8 : 1,
        overflow: 'hidden',
        touchAction: 'none'
      }}
    >
      <img
        src={image.src}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
        draggable={false}
      />

      {isSelected && !image.locked && (
        <ResizeHandles onMouseDown={handleResizeDown} />
      )}
    </div>
  )
}
