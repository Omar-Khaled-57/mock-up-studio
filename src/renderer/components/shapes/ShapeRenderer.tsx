import { memo, useCallback, useMemo, useState } from 'react'
import type { Shape } from '@shared/types'
import { useStore } from '../../store'
import { useDrag } from '../../hooks/useDrag'
import { useResize } from '../../hooks/useResize'
import { useSnapping } from '../../hooks/useSnapping'
import { useTripleClick } from '../../hooks/useTripleClick'
import { useTheme } from '../../hooks/useTheme'
import { getMultiDragEntries } from '../../lib/multi-drag'
import ResizeHandles from '../shared/ResizeHandles'

interface Props {
  shape: Shape
  onGuidesChange: (guides: { verticalGuides: number[]; horizontalGuides: number[] }) => void
  onContextMenu?: (e: React.MouseEvent, type: string, id: string) => void
}

function getShapePath(kind: Shape['kind'], w: number, h: number, cornerRadius: number, angles?: [number, number, number], thickness?: number): string {
  switch (kind) {
    case 'rectangle': {
      if (cornerRadius <= 0) return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`
      const r = Math.min(cornerRadius, w / 2, h / 2)
      return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`
    }
    case 'circle': {
      const r = Math.min(w, h) / 2
      const cx = w / 2
      const cy = h / 2
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
    }
    case 'ellipse': {
      const rx = w / 2
      const ry = h / 2
      const cx = w / 2
      const cy = h / 2
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy} Z`
    }
    case 'triangle': {
      const [A, B] = angles || [60, 60]
      const C = 180 - A - B
      if (C <= 1 || C >= 179) return `M 0 ${h} L ${w} ${h} L ${w / 2} ${h * 0.1} Z`
      const aR = A * Math.PI / 180, bR = B * Math.PI / 180, cR = C * Math.PI / 180
      const b = w * Math.sin(bR) / Math.sin(cR)
      const x3 = Math.round(b * Math.cos(aR))
      const y3 = Math.round(h - b * Math.sin(aR))
      const cx = Math.max(0, Math.min(w, x3))
      const cy = Math.max(0, Math.min(h * 0.95, y3))
      return `M 0 ${h} L ${w} ${h} L ${cx} ${cy} Z`
    }
    case 'star': {
      const cx = w / 2
      const cy = h / 2
      const outerR = Math.min(w, h) / 2
      const innerR = outerR * 0.4
      const pts: string[] = []
      for (let i = 0; i < 5; i++) {
        const outerAngle = (i * 72 - 90) * (Math.PI / 180)
        const innerAngle = ((i * 72 + 36) - 90) * (Math.PI / 180)
        pts.push(`${cx + outerR * Math.cos(outerAngle)},${cy + outerR * Math.sin(outerAngle)}`)
        pts.push(`${cx + innerR * Math.cos(innerAngle)},${cy + innerR * Math.sin(innerAngle)}`)
      }
      return `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`
    }
    case 'hexagon':
      return `M ${w * 0.25} 0 L ${w * 0.75} 0 L ${w} ${h * 0.5} L ${w * 0.75} ${h} L ${w * 0.25} ${h} L 0 ${h * 0.5} Z`
    case 'diamond':
      return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`
    case 'parallelogram':
      return `M ${w * 0.25} 0 L ${w} 0 L ${w * 0.75} ${h} L 0 ${h} Z`
    case 'trapezoid':
      return `M ${w * 0.2} 0 L ${w * 0.8} 0 L ${w} ${h} L 0 ${h} Z`
    case 'cross':
      return ''
    case 'plus': {
      const t = (thickness ?? 0.3) * Math.min(w, h)
      const cw = w / 2, ch = h / 2, ht = t / 2
      return `M ${cw - ht} 0 L ${cw + ht} 0 L ${cw + ht} ${ch - ht} L ${w} ${ch - ht} L ${w} ${ch + ht} L ${cw + ht} ${ch + ht} L ${cw + ht} ${h} L ${cw - ht} ${h} L ${cw - ht} ${ch + ht} L 0 ${ch + ht} L 0 ${ch - ht} L ${cw - ht} ${ch - ht} Z`
    }
    case 'heart': {
      const cx = w / 2
      const tipY = h * 0.9
      return `M ${cx} ${tipY} C ${cx * 1.5} ${h * 0.55}, ${w} ${h * 0.4}, ${w} ${h * 0.3} C ${w} ${h * 0.1}, ${cx * 1.2} ${h * 0.05}, ${cx} ${h * 0.2} C ${cx * 0.8} ${h * 0.05}, 0 ${h * 0.1}, 0 ${h * 0.3} C 0 ${h * 0.4}, ${cx * 0.5} ${h * 0.55}, ${cx} ${tipY} Z`
    }
    case 'arrow-right': {
      const t = (thickness ?? 0.5) * h
      const halfT = t * 0.5, cy = h / 2, sx = w * 0.6
      return `M 0 ${cy - halfT} L ${sx} ${cy - halfT} L ${sx} ${cy - t} L ${w} ${cy} L ${sx} ${cy + t} L ${sx} ${cy + halfT} L 0 ${cy + halfT} Z`
    }
    default:
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { r: 255, g: 255, b: 255 }
  return { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
}

function CrossPaths({ w, h, thickness, fill }: { w: number; h: number; thickness: number; fill: string }) {
  const t = thickness * Math.min(w, h)
  const hw = t / 2
  const d = Math.sqrt(w * w + h * h)
  if (d <= 0) return null
  const px = h * hw / d
  const py = w * hw / d
  const arm1 = `M ${-px} ${py} L ${w - px} ${h + py} L ${w + px} ${h - py} L ${px} ${-py} Z`
  const arm2 = `M ${w - px} ${-py} L ${-px} ${h - py} L ${px} ${h + py} L ${w + px} ${py} Z`
  return <><path d={arm1} fill={fill} /><path d={arm2} fill={fill} /></>
}

function ShapeRenderer({ shape, onGuidesChange, onContextMenu }: Props) {
  const { isLight, clsx } = useTheme()
  const select = useStore((s) => s.select)
  const selectDirect = useStore((s) => s.selectDirect)
  const isSelected = useStore((s) => s.selectedIds.includes(shape.id))
  const updateShape = useStore((s) => s.updateShape)
  const pushHistory = useStore((s) => s.pushHistory)
  const zoom = useStore((s) => s.zoom)
  const scene = useStore((s) => s.scenes[s.activeSceneIndex])
  const groupName = shape.groupId ? scene.groups.find((g) => g.id === shape.groupId)?.name ?? null : null

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(shape.name)

  const { computeSnap } = useSnapping()

  const commitPosition = useCallback(
    (id: string, x: number, y: number) => {
      updateShape(id, { x, y })
    },
    [updateShape]
  )

  const commitEnd = useCallback(() => {
    pushHistory('Move shape')
  }, [pushHistory])

  const snapFn = useCallback(
    (id: string, x: number, y: number, w: number, h: number) => {
      const result = computeSnap({ id, x, y, width: w, height: h })
      onGuidesChange({ verticalGuides: result.verticalGuides, horizontalGuides: result.horizontalGuides })
      return { x: result.x, y: result.y }
    },
    [computeSnap, onGuidesChange]
  )

  const drag = useDrag({ zoom, onDrag: commitPosition, onEnd: commitEnd, snapFn, onGuidesChange, getMultiDrag: () => getMultiDragEntries(shape.id) })

  const commitResize = useCallback(
    (id: string, x: number, y: number, w: number, h: number) => {
      updateShape(id, { x, y, width: w, height: h })
    },
    [updateShape]
  )

  const resizeEnd = useCallback(() => {
    pushHistory('Resize shape')
  }, [pushHistory])

  const resize = useResize({ zoom, onResize: commitResize, onEnd: resizeEnd })

  const handleContext = useCallback(
    (e: React.MouseEvent) => {
      onContextMenu?.(e, 'shape', shape.id)
    },
    [onContextMenu, shape.id]
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      select(shape.id, e.shiftKey || e.ctrlKey || e.metaKey)
    },
    [shape.id, select]
  )

  const startRename = useCallback(() => {
    if (shape.locked) return
    setIsRenaming(true)
    setRenameValue(shape.name)
  }, [shape.name, shape.locked])

  const { handleClick: handleTripleClick } = useTripleClick(startRename)

  const commitRename = useCallback(() => {
    if (!isRenaming) return
    const trimmed = renameValue.trim()
    if (trimmed) {
      updateShape(shape.id, { name: trimmed })
      pushHistory('Rename')
    }
    setIsRenaming(false)
  }, [isRenaming, renameValue, shape.id, updateShape, pushHistory])

  const cancelRename = useCallback(() => {
    setIsRenaming(false)
    setRenameValue(shape.name)
  }, [shape.name])

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (shape.groupId) {
        e.stopPropagation()
        selectDirect(shape.id)
      }
    },
    [shape.id, shape.groupId, selectDirect]
  )

  const handleDragDown = useCallback(
    (e: React.PointerEvent) => {
      if (shape.locked || isRenaming) return
      drag.handlePointerDown(e, shape.id, shape.x, shape.y, shape.width, shape.height)
    },
    [shape, drag, isRenaming]
  )

  const handleResizeDown = useCallback(
    (e: React.PointerEvent, handle: 'nw' | 'ne' | 'sw' | 'se') => {
      if (shape.locked || isRenaming) return
      resize.handlePointerDown(e, shape.id, handle, shape.x, shape.y, shape.width, shape.height)
    },
    [shape, resize, isRenaming]
  )

  const thickness = shape.kind === 'plus' ? (shape.plusThickness ?? 0.3) : shape.kind === 'arrow-right' ? (shape.arrowThickness ?? 0.5) : undefined
  const path = useMemo(
    () => getShapePath(shape.kind, shape.width, shape.height, shape.cornerRadius, shape.angles, thickness),
    [shape.kind, shape.width, shape.height, shape.cornerRadius, shape.angles, thickness]
  )

  const filterStr = useMemo(() => {
    if (shape.blur <= 0) return undefined
    return `blur(${shape.blur}px)`
  }, [shape.blur])

  const svgFilterId = useMemo(() => {
    const hasShadow = shape.shadow?.some((s) => s.enabled)
    const hasGlow = shape.glow?.some((g) => g.enabled)
    if (!hasShadow && !hasGlow) return undefined
    return `shape-fx-${shape.id}`
  }, [shape.id, shape.shadow, shape.glow])

  const svgFilterDef = useMemo(() => {
    const items: React.ReactNode[] = []
    if (shape.shadow) {
      for (const s of shape.shadow) {
        if (!s.enabled) continue
        const { r, g, b } = hexToRgb(s.color)
        items.push(
          <feDropShadow
            key={`shadow-${s.offsetX}-${s.offsetY}-${s.blur}-${s.color}`}
            dx={s.offsetX}
            dy={s.offsetY}
            stdDeviation={s.blur}
            floodColor={`rgb(${r},${g},${b})`}
            floodOpacity={s.opacity / 100}
          />
        )
      }
    }
    if (shape.glow) {
      for (const g of shape.glow) {
        if (!g.enabled) continue
        const { r, g: gv, b } = hexToRgb(g.color)
        items.push(
          <feDropShadow
            key={`glow-${g.blur}-${g.color}`}
            dx={0}
            dy={0}
            stdDeviation={g.blur}
            floodColor={`rgb(${r},${gv},${b})`}
            floodOpacity={g.opacity / 100}
          />
        )
      }
    }
    return items.length > 0 ? items : null
  }, [shape.shadow, shape.glow])

  let fill = shape.color
  if (shape.backgroundImage) {
    fill = `url(#img-${shape.id})`
  } else if (shape.gradient?.enabled && shape.gradient.colors.length >= 2) {
    fill = `url(#gradient-${shape.id})`
  }

  return (
    <div
      data-element-id={shape.id}
      onClick={(e) => { handleClick(e); handleTripleClick() }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContext}
      onPointerDown={handleDragDown}
      onPointerMove={drag.handlePointerMove}
      onPointerUp={drag.handlePointerUp}
      style={{
        position: 'absolute',
        left: shape.x,
        top: shape.y,
        width: shape.width,
        height: shape.height,
        opacity: shape.opacity / 100,
        transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
        zIndex: shape.zIndex,
        filter: filterStr,
        cursor: shape.locked ? 'default' : 'move',
        touchAction: 'none'
      }}
    >
      {isRenaming && (
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') cancelRename()
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className={clsx("absolute inset-0 w-full h-full px-2 text-xs font-semibold rounded border outline-none text-center", isLight ? "bg-white text-zinc-800 border-indigo-400" : "bg-zinc-900 text-zinc-100 border-indigo-500/50")}
        />
      )}
      <svg
        width={shape.width}
        height={shape.height}
        viewBox={`0 0 ${shape.width} ${shape.height}`}
        style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
      >
        <defs>
          {svgFilterId && svgFilterDef && (
            <filter id={svgFilterId} x="-20%" y="-20%" width="140%" height="140%">
              {svgFilterDef}
            </filter>
          )}
          {shape.gradient?.enabled && shape.gradient.colors.length >= 2 && (
            <linearGradient id={`gradient-${shape.id}`} x1="0%" y1="0%" x2="0%" y2="100%"
              gradientTransform={`rotate(${shape.gradient.angle}, 0.5, 0.5)`}>
              {shape.gradient.colors.map((color, i) => (
                <stop key={i} offset={`${(i / (shape.gradient!.colors.length - 1)) * 100}%`} stopColor={color} />
              ))}
            </linearGradient>
          )}
          {shape.backgroundImage && (
            <pattern id={`img-${shape.id}`} width="1" height="1" patternUnits="objectBoundingBox">
              <image href={shape.backgroundImage} width={shape.width} height={shape.height} preserveAspectRatio="xMidYMid slice" />
            </pattern>
          )}
        </defs>
        <g filter={svgFilterId ? `url(#${svgFilterId})` : undefined}>
          {shape.kind === 'cross' ? <CrossPaths w={shape.width} h={shape.height} thickness={shape.crossThickness ?? 0.3} fill={fill} /> : <path d={path} fill={fill} />}
        </g>
      </svg>

      {isSelected && !shape.locked && (
        <ResizeHandles onMouseDown={handleResizeDown} groupId={shape.groupId} groupName={groupName} />
      )}
    </div>
  )
}

export default memo(ShapeRenderer)
