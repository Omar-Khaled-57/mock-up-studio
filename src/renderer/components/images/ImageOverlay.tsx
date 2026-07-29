import { useCallback, useMemo } from 'react'
import { ImageOverlay as ImageOverlayType } from '@shared/types'
import { useStore } from '../../store'
import { useDrag } from '../../hooks/useDrag'
import { useResize } from '../../hooks/useResize'
import { useSnapping } from '../../hooks/useSnapping'
import { getMultiDragEntries } from '../../lib/multi-drag'
import ResizeHandles from '../shared/ResizeHandles'

interface Props {
  image: ImageOverlayType
  onGuidesChange?: (guides: { verticalGuides: number[]; horizontalGuides: number[] }) => void
  onContextMenu?: (e: React.MouseEvent, type: string, id: string) => void
}

export default function ImageOverlay({ image, onGuidesChange, onContextMenu }: Props) {
  const select = useStore((s) => s.select)
  const isSelected = useStore((s) => s.selectedIds.includes(image.id))
  const updateImage = useStore((s) => s.updateImage)
  const scene = useStore((s) => s.scenes[s.activeSceneIndex])
  const groupName = image.groupId ? scene.groups.find((g) => g.id === image.groupId)?.name ?? null : null
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

  const drag = useDrag({ zoom, onDrag: commitPosition, onEnd: commitEnd, snapFn, onGuidesChange, getMultiDrag: () => getMultiDragEntries(image.id) })

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

  const handleContext = useCallback(
    (e: React.MouseEvent) => {
      onContextMenu?.(e, 'image', image.id)
    },
    [onContextMenu, image.id]
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      select(image.id, e.shiftKey || e.ctrlKey || e.metaKey)
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

  const combinedFilter = useMemo(() => {
    const filters: string[] = []
    if (image.glow.length > 0) {
      for (const g of image.glow) {
        if (!g.enabled) continue
        filters.push(`drop-shadow(0 0 ${g.blur}px ${g.color})`)
      }
    }
    if (image.shadow.length > 0) {
      for (const s of image.shadow) {
        if (!s.enabled) continue
        filters.push(`drop-shadow(${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.color})`)
      }
    }
    if (image.blur) filters.push(`blur(${image.blur}px)`)
    return filters.join(' ')
  }, [image.shadow, image.glow, image.blur])

  return (
    <div
      data-element-id={image.id}
      onClick={handleClick}
      onContextMenu={handleContext}
      onPointerDown={handleDragDown}
      onPointerMove={drag.handlePointerMove}
      onPointerUp={drag.handlePointerUp}
      style={{
        position: 'absolute',
        left: image.x,
        top: image.y,
        width: image.width,
        height: image.height,
        transform: `rotate(${image.rotation}deg) scaleX(${image.flipX ? -1 : 1}) scaleY(${image.flipY ? -1 : 1})`,
        transformOrigin: 'center center',
        zIndex: image.zIndex,
        cursor: image.locked ? 'default' : 'move',
        opacity: image.opacity / 100,
        borderRadius: image.borderRadius,
        overflow: 'hidden',
        touchAction: 'none',
        filter: combinedFilter
      }}
    >
      <img
        src={image.src}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          pointerEvents: 'none',
          mixBlendMode: image.blendMode
        }}
        draggable={false}
      />

      {isSelected && !image.locked && (
        <ResizeHandles onMouseDown={handleResizeDown} groupId={image.groupId} groupName={groupName} />
      )}
    </div>
  )
}