/**
 * MaskSnapshotLayer — frozen-mask content renderer.
 *
 * A frozen mask embeds a whole-scene snapshot (`Mask.snapshot`) captured at
 * creation/refresh time. This layer paints those captured pixels inside the
 * element's clip frame: it clips to the mask's HIDDEN (masked-out) region
 * (`buildMaskPunchClipPath`), so the masked region shows exactly what the
 * canvas looked like when the mask was created — including other layers,
 * z-order and the scene background — while the element's live content keeps
 * showing through the visible region.
 *
 * `background: transparent` on the clipped container means the frozen pixels
 * are the only thing the masked region ever shows — the live canvas behind the
 * element can never leak through.
 *
 * The snapshot image is placed at `sourceBounds` offset by the element's scene
 * position (`elementX`/`elementY`), and sized to `sourceBounds` in scene units,
 * so the captured region lines up with the element's box at render time (it
 * moves/rotates with the facade, exactly like clip geometry).
 */

import type { Mask } from '@shared/types'
import { buildMaskPunchClipPath } from '../../services/mask-visualization'

interface Props {
  mask: Mask
  /** Scene-space X of the element's top-left corner (0 for the background). */
  elementX: number
  /** Scene-space Y of the element's top-left corner (0 for the background). */
  elementY: number
  targetWidth: number
  targetHeight: number
}

export default function MaskSnapshotLayer({ mask, elementX, elementY, targetWidth, targetHeight }: Props) {
  const snap = mask.snapshot
  if (!snap) return null
  return (
    <div
      data-element-mask-clip="true"
      data-mask-snapshot="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: 'transparent',
        clipPath: buildMaskPunchClipPath(mask, targetWidth, targetHeight),
        WebkitClipPath: buildMaskPunchClipPath(mask, targetWidth, targetHeight)
      }}
    >
      <img
        data-mask-snapshot-img="true"
        src={snap.dataUrl}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          left: snap.sourceBounds.x - elementX,
          top: snap.sourceBounds.y - elementY,
          width: snap.sourceBounds.width,
          height: snap.sourceBounds.height
        }}
      />
    </div>
  )
}
