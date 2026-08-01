import { SceneElementKind } from '../services/hit-test'
import { useStore } from '../store'
import { safeScene } from '../store/sceneSlice'
import { buildMaskClipPath } from '../components/masks/MaskRenderer'

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
 * Also applies the element's first mask as a `clip-path` here — the single
 * shared positioned box every element kind renders through, so masking works
 * for devices, text boxes, images and shapes with zero per-type code and the
 * clip correctly lives in the element's rotated local frame (§10.1).
 */
export default function ElementFacade({ id, kind, locked, style, children }: Props) {
  const masks = useStore((s) => safeScene(s).masks).filter((m) => m.targetId === id)
  const width = typeof style.width === 'number' ? style.width : 0
  const height = typeof style.height === 'number' ? style.height : 0
  const clipPath = masks.length > 0 ? buildMaskClipPath(masks[0], width, height) : undefined
  return (
    <div
      data-element-id={id}
      data-element-kind={kind}
      data-element-locked={locked ? 'true' : 'false'}
      style={{ ...style, touchAction: 'none', ...(clipPath ? { clipPath } : {}) }}
    >
      {children}
    </div>
  )
}
