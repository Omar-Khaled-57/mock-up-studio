import { Fragment } from 'react'
import { SceneElementKind } from '../services/hit-test'
import { useStore } from '../store'
import { safeScene } from '../store/sceneSlice'
import { buildMaskClipPath } from '../services/mask-visualization'
import MaskSnapshotLayer from '../components/masks/MaskSnapshotLayer'

interface Props {
  id: string
  kind: SceneElementKind
  locked: boolean
  style: React.CSSProperties
  children: React.ReactNode
}

/**
 * Presentational positioned wrapper for every scene element.
 *
 * Renders the element's visual content plus the `data-element-id` /
 * `data-element-kind` hit surface. Deliberately has NO pointer handlers —
 * the Tool Manager owns all interactions and routes via the dispatcher.
 *
 * Also applies the element's masks here — the single shared positioned box
 * every element kind renders through, so masking works for devices, text
 * boxes, images and shapes with zero per-type code and the clip correctly
 * lives in the element's rotated local frame (§10.1). The first mask clips
 * the element's own border box (unchanged single-mask path); any additional
 * masks are intersected as nested inset-0 clip layers (multi-mask
 * compositing), each in the same local frame.
 *
 * FROZEN masks (those carrying a `snapshot`) do not clip the element — the
 * snapshot content replaces the clip for the masked region. A frozen `masks[0]`
 * cannot clip the root (its hidden region would clip the frozen layer away
 * with it), so the root stays unclipped and a `MaskSnapshotLayer` paints the
 * frozen pixels over the hidden region, keeping the element's live content
 * visible everywhere else.
 */
export default function ElementFacade({ id, kind, locked, style, children }: Props) {
  const masks = useStore((s) => safeScene(s).masks).filter((m) => m.targetId === id)
  const width = typeof style.width === 'number' ? style.width : Number(style.width) || 0
  const height = typeof style.height === 'number' ? style.height : Number(style.height) || 0
  const elementX = typeof style.left === 'number' ? style.left : Number(style.left) || 0
  const elementY = typeof style.top === 'number' ? style.top : Number(style.top) || 0

  const firstFrozen = masks.length > 0 && masks[0].snapshot != null
  const clipPath = masks.length > 0 && !firstFrozen ? buildMaskClipPath(masks[0], width, height) : undefined

  let content = children
  for (let i = masks.length - 1; i >= 1; i--) {
    const mask = masks[i]
    content = (
      <Fragment key={`${id}-mask-${i}`}>
        <div
          data-element-mask-clip="true"
          style={{ position: 'absolute', inset: 0, overflow: 'hidden', clipPath: buildMaskClipPath(mask, width, height) }}
        >
          {content}
        </div>
        {mask.snapshot ? (
          <MaskSnapshotLayer mask={mask} elementX={elementX} elementY={elementY} targetWidth={width} targetHeight={height} />
        ) : null}
      </Fragment>
    )
  }

  return (
    <div
      data-element-id={id}
      data-element-kind={kind}
      data-element-locked={locked ? 'true' : 'false'}
      style={{ ...style, touchAction: 'none', ...(clipPath ? { clipPath } : {}) }}
    >
      {content}
      {firstFrozen && masks[0].snapshot ? (
        <MaskSnapshotLayer mask={masks[0]} elementX={elementX} elementY={elementY} targetWidth={width} targetHeight={height} />
      ) : null}
    </div>
  )
}
