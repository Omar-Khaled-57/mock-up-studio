import { memo, useMemo } from 'react'
import type { Shape } from '@shared/types'
import { useStore } from '../../store'
import { useRuntimeStore } from '../../runtime/store'
import { useInstanceMirror } from '../../lib/component-utils'
import ElementFacade from '../../elements/ElementFacade'
import RenameOverlay from '../../elements/RenameOverlay'
import { buildEffectsFilter } from '../../lib/effects'
import { getShapePath } from '../../services/shape-geometry'
import { resolveLiveGhost } from '../../services/preview'

interface Props {
  shape: Shape
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

function ShapeRenderer({ shape: raw }: Props) {
  const shape = useInstanceMirror(raw)
  const editing = useRuntimeStore((s) => s.editing)
  // The select-tool ghost's raw source is the shared live-transform: while the
  // element is being dragged/resized the store geometry is untouched (it only
  // commits on pointer-up), so the SVG content must regenerate from the live
  // bounds or it would render at the start aspect ratio until release (the
  // SVG viewBox scales uniformly under `preserveAspectRatio: meet`). Renders
  // at the store geometry whenever no ghost targets this shape.
  const live = useRuntimeStore((s) => resolveLiveGhost(s.preview, shape.id))

  const isRenaming = editing?.id === shape.id && editing.mode === 'rename'

  const commitRename = (value: string) => {
    const state = useStore.getState()
    state.pushHistory('Rename')
    state.updateShape(shape.id, { name: value })
    useRuntimeStore.getState().setEditing(null)
  }

  const cancelRename = () => {
    useRuntimeStore.getState().setEditing(null)
  }

  const thickness = shape.kind === 'plus' ? (shape.plusThickness ?? 0.3) : shape.kind === 'arrow-right' ? (shape.arrowThickness ?? 0.5) : undefined
  const w = live ? live.width : shape.width
  const h = live ? live.height : shape.height
  const x = live ? live.x : shape.x
  const y = live ? live.y : shape.y
  const path = useMemo(
    () => getShapePath(shape.kind, w, h, shape.cornerRadius, shape.angles, thickness),
    [shape.kind, w, h, shape.cornerRadius, shape.angles, thickness]
  )

  const filterStr = useMemo(() => {
    const parts: string[] = []
    if (shape.blur > 0) parts.push(`blur(${shape.blur}px)`)
    const effectsFilter = buildEffectsFilter(shape.effects)
    if (effectsFilter) parts.push(effectsFilter)
    return parts.length > 0 ? parts.join(' ') : undefined
  }, [shape.blur, shape.effects])

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
  const grad = shape.gradient
  const gradType = (grad?.type ?? 'linear') as 'linear' | 'radial' | 'conic'
  const radialShape = grad?.radialShape ?? 'circle'
  const gradEnabled = !!grad?.enabled && (grad?.colors.length ?? 0) >= 2
  // The cross renders as two parallelogram arms (CrossPaths) and the conic
  // overlay is a clipped foreignObject that only makes sense for a single
  // closed path — a cross falls back to an angle-based linear gradient.
  const effGradType = gradEnabled && gradType === 'conic' && shape.kind === 'cross' ? 'linear' : gradType
  if (shape.backgroundImage) {
    fill = `url(#img-${shape.id})`
  } else if (gradEnabled && effGradType !== 'conic') {
    fill = `url(#gradient-${shape.id})`
  } else if (gradEnabled) {
    fill = grad!.colors[0]
  }

  const gradStops = (() => {
    if (!gradEnabled) return ''
    const n = grad!.colors.length - 1
    return grad!.colors.map((color, i) => `${color} ${(i / n) * 100}%`).join(', ')
  })()

  return (
    <ElementFacade
      id={shape.id}
      kind="shape"
      locked={shape.locked}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: shape.opacity / 100,
        transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
        zIndex: shape.zIndex,
        filter: filterStr,
        cursor: shape.locked ? 'default' : 'move'
      }}
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
      >
        <defs>
          {svgFilterId && svgFilterDef && (
            <filter id={svgFilterId} x="-20%" y="-20%" width="140%" height="140%">
              {svgFilterDef}
            </filter>
          )}
          {gradEnabled && effGradType === 'linear' && (
            <linearGradient id={`gradient-${shape.id}`} x1="0%" y1="0%" x2="0%" y2="100%"
              gradientTransform={`rotate(${grad!.angle ?? 135}, 0.5, 0.5)`}>
              {grad!.colors.map((color, i) => (
                <stop key={i} offset={`${(i / (grad!.colors.length - 1)) * 100}%`} stopColor={color} />
              ))}
            </linearGradient>
          )}
          {gradEnabled && effGradType === 'radial' && (
            <radialGradient id={`gradient-${shape.id}`} cx="50%" cy="50%" r={radialShape === 'ellipse' ? '50%' : '70.71%'}>
              {grad!.colors.map((color, i) => (
                <stop key={i} offset={`${(i / (grad!.colors.length - 1)) * 100}%`} stopColor={color} />
              ))}
            </radialGradient>
          )}
          {gradEnabled && effGradType === 'conic' && (
            <clipPath id={`shape-clip-${shape.id}`}>
              <path d={path} />
            </clipPath>
          )}
          {shape.backgroundImage && (
            <pattern id={`img-${shape.id}`} width="1" height="1" patternUnits="objectBoundingBox">
              <image href={shape.backgroundImage} width={w} height={h} preserveAspectRatio="xMidYMid slice" />
            </pattern>
          )}
        </defs>
        <g filter={svgFilterId ? `url(#${svgFilterId})` : undefined}>
          {shape.kind === 'cross' ? <CrossPaths w={w} h={h} thickness={shape.crossThickness ?? 0.3} fill={fill} /> : <path d={path} fill={fill} />}
          {gradEnabled && effGradType === 'conic' && (
            <g clipPath={`url(#shape-clip-${shape.id})`}>
              <foreignObject x={0} y={0} width={w} height={h}>
                <div
                  {...({ xmlns: 'http://www.w3.org/1999/xhtml' } as React.HTMLAttributes<HTMLDivElement> & { xmlns?: string })}
                  style={{ width: '100%', height: '100%', background: `conic-gradient(from ${grad!.angle ?? 0}deg, ${gradStops})` }}
                />
              </foreignObject>
            </g>
          )}
        </g>
      </svg>

      {isRenaming && <RenameOverlay name={shape.name} onCommit={commitRename} onCancel={cancelRename} />}
    </ElementFacade>
  )
}

export default memo(ShapeRenderer)
