/**
 * MaskSnapshotLayer — frozen-mask content renderer (scene layer).
 *
 * A frozen mask embeds a whole-scene snapshot (`Mask.snapshot`) captured at
 * creation/refresh time. This layer paints those captured pixels inside the
 * mask's clip frame in SCENE coordinates: the inset-0 wrapper spans the whole
 * canvas and clips to the mask's HIDDEN (masked-out) region
 * (`buildMaskPunchClipPath`), so the masked region shows exactly what the
 * canvas looked like when the mask was created — including other layers,
 * z-order and the scene background — while live content keeps showing through
 * the visible region.
 *
 * `background: transparent` on the clipped container means the frozen pixels
 * are the only thing the masked region ever shows — the live canvas behind the
 * mask can never leak through.
 *
 * The snapshot image is placed at its own `sourceBounds` (already scene-space),
 * so the captured region lines up with the canvas at render time (masks are
 * scene layers, no element offset).
 */

import type { Mask } from '@shared/types'
import { buildMaskPunchClipPath } from '../../services/mask-visualization'

interface Props {
  mask: Mask
  canvasWidth: number
  canvasHeight: number
}

export default function MaskSnapshotLayer({ mask, canvasWidth, canvasHeight }: Props) {
  const snap = mask.snapshot
  if (!snap) return null
  const punch = buildMaskPunchClipPath(mask, canvasWidth, canvasHeight)
  return (
    <div
      data-scene-mask-snapshot="true"
      data-mask-snapshot="true"
      data-mask-snapshot-for={mask.id}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: 'transparent',
        clipPath: punch,
        WebkitClipPath: punch
      }}
    >
      <img
        data-mask-snapshot-img="true"
        src={snap.dataUrl}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          left: snap.sourceBounds.x,
          top: snap.sourceBounds.y,
          width: snap.sourceBounds.width,
          height: snap.sourceBounds.height
        }}
      />
    </div>
  )
}
