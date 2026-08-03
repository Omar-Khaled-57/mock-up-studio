/**
 * parent-transform — pure parent-local transform composition.
 *
 * Children (elements with a `containerId`) store geometry in their parent's
 * UNROTATED local frame: `x/y` is the offset from the parent's top-left corner,
 * `width/height` are local dimensions and `rotation` is relative to the parent
 * frame. A child's scene transform is its parent's composed transform composed
 * with its own local transform — translation + rotation only (no scale in the
 * chain). When a parent's `width/height` change, children's local geometry is
 * rescaled proportionally at commit time via `rescaleChildGeometry`, so
 * "scale with it" stays data-driven and the composition math remains a pure
 * translate+rotate affine chain.
 *
 * Rotation follows the repo-wide center-pivot convention (`getRotatedBounds`):
 * an element rotates about its own box center, so each element's affine maps
 * its local frame into its parent's frame through that center.
 *
 * Pure leaf module — no store/DOM dependencies. Element geometry is resolved
 * directly from the scene so scene-space readers can compose without creating
 * import cycles.
 */

import { Scene } from '@shared/types'
import { ElementLike, Rect, getRotatedBounds } from './geometry'

export interface Point {
  x: number
  y: number
}

export interface SceneTransform {
  x: number
  y: number
  rotation: number
}

export interface RescaledChildGeometry {
  x: number
  y: number
  width: number
  height: number
}

/** Minimal per-kind element identity needed to walk the parent chain. */
interface ChainElement extends ElementLike {
  containerId: string | null
}

/** Affine `p → R(rotation)·p + (tx, ty)` mapping one frame into another. */
interface Affine {
  rotation: number
  tx: number
  ty: number
}

const IDENTITY: Affine = { rotation: 0, tx: 0, ty: 0 }

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Screen-space rotation (y down, positive = clockwise, matching CSS `rotate`). */
function rotatePoint(x: number, y: number, rotationDeg: number): Point {
  if (!rotationDeg) return { x, y }
  const rad = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: x * cos - y * sin, y: x * sin + y * cos }
}

function resolveElement(scene: Scene, id: string): ChainElement | null {
  const d = scene.devices.find((el) => el.id === id)
  if (d) return { id: d.id, x: d.x, y: d.y, width: d.width, height: d.height, rotation: d.rotation, containerId: d.containerId }
  const t = scene.textBoxes.find((el) => el.id === id)
  if (t) return { id: t.id, x: t.x, y: t.y, width: t.width, height: t.height, rotation: 0, containerId: t.containerId }
  const i = scene.images.find((el) => el.id === id)
  if (i) return { id: i.id, x: i.x, y: i.y, width: i.width, height: i.height, rotation: i.rotation, containerId: i.containerId }
  const s = scene.shapes.find((el) => el.id === id)
  if (s) return { id: s.id, x: s.x, y: s.y, width: s.width, height: s.height, rotation: s.rotation, containerId: s.containerId }
  return null
}

/** Affine mapping an element's local frame into its parent's frame (center pivot). */
function elementAffine(e: ChainElement): Affine {
  const rotation = e.rotation ?? 0
  const cx = e.x + e.width / 2
  const cy = e.y + e.height / 2
  const r = rotatePoint(e.x - cx, e.y - cy, rotation)
  return { rotation, tx: r.x + cx, ty: r.y + cy }
}

/** Compose two affines: `after ∘ before` (`before` is applied first). */
function compose(after: Affine, before: Affine): Affine {
  const r = rotatePoint(before.tx, before.ty, after.rotation)
  return { rotation: after.rotation + before.rotation, tx: r.x + after.tx, ty: r.y + after.ty }
}

/** Composed local→scene affine for an element (walking the chain root→leaf). */
function composedAffine(scene: Scene, id: string): Affine {
  let affine = IDENTITY
  for (const ancId of getParentChain(scene, id)) {
    const el = resolveElement(scene, ancId)
    if (!el) break
    affine = compose(affine, elementAffine(el))
  }
  return affine
}

/** Ancestor ids from the scene root down to the element (inclusive). Cycle-safe. */
export function getParentChain(scene: Scene, id: string): string[] {
  const chain: string[] = []
  const seen = new Set<string>()
  let current: string | null = id
  while (current && !seen.has(current)) {
    const el = resolveElement(scene, current)
    if (!el) break
    seen.add(current)
    chain.push(current)
    current = el.containerId ?? null
  }
  return chain.reverse()
}

/** Scene-space top-left corner + total rotation of an element's local frame. */
export function getSceneTransform(scene: Scene, id: string): SceneTransform {
  const affine = composedAffine(scene, id)
  return { x: affine.tx, y: affine.ty, rotation: affine.rotation }
}

/**
 * Maps a point in the element's local frame to scene coordinates. The local
 * frame is the element's own box frame: its box occupies `(0,0,w,h)` and its
 * position in the parent frame (`x/y`, the offset from the parent's top-left)
 * is baked into the composed affine — so `localToScene(id, (0,0))` is the
 * element's rendered top-left corner and `(width,height)` its opposite corner.
 */
export function localToScene(scene: Scene, id: string, point: Point): Point {
  const affine = composedAffine(scene, id)
  const r = rotatePoint(point.x, point.y, affine.rotation)
  return { x: r.x + affine.tx, y: r.y + affine.ty }
}

/** Maps a scene point into the element's local frame (inverse of `localToScene`). */
export function sceneToLocal(scene: Scene, id: string, point: Point): Point {
  const affine = composedAffine(scene, id)
  const dx = point.x - affine.tx
  const dy = point.y - affine.ty
  const rad = (affine.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos }
}

/**
 * Composed scene-space "unrotated box" of an element — the box the element
 * would occupy in scene coordinates if it carried no rotation, positioned so
 * that a centered rotation by the total rotation reproduces the rendered
 * element exactly. The composed affine's translation `T` is the rendered
 * position of the local origin corner (rotated); the box top-left `B` is
 * corrected by the center-pivot so `getRotatedBounds(composedBox)` equals the
 * true composed AABB. Null for an unknown id. Root elements (no `containerId`)
 * return their stored box verbatim.
 */
export function getComposedBox(scene: Scene, id: string): ElementLike | null {
  const el = resolveElement(scene, id)
  if (!el) return null
  // Root fast-path: the stored box IS the composed box, byte-exact (avoids the
  // chain walk and any floating-point drift for non-nested elements).
  if (!el.containerId) {
    return {
      id: el.id,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      rotation: el.rotation ?? 0
    }
  }
  const affine = composedAffine(scene, id)
  const c = { x: el.width / 2, y: el.height / 2 }
  const rc = rotatePoint(c.x, c.y, affine.rotation)
  return {
    id: el.id,
    x: affine.tx - c.x + rc.x,
    y: affine.ty - c.y + rc.y,
    width: el.width,
    height: el.height,
    rotation: affine.rotation
  }
}

/**
 * Composed scene AABB of the element — `getRotatedBounds` over the composed
 * box. Unlike `getRotatedBounds` over the raw stored box, this stays correct
 * once an ancestor is rotated (the box+rotation center-pivot model only
 * reproduces the render when the box is unrotated in scene space).
 */
export function getSceneRect(scene: Scene, id: string): Rect {
  const box = getComposedBox(scene, id)
  if (!box) return { x: 0, y: 0, width: 0, height: 0 }
  return getRotatedBounds(box)
}

/**
 * Maps a composed scene point into the element's STORED `x/y` coordinate frame.
 * Stored coordinates are the offset from the element's parent top-left (the
 * element's position inside its wrapper), which equals the scene point for a
 * root element and the parent-frame inverse for a child. `(0,0)` of the stored
 * frame is the element's top-left, so this is the inverse of `storedToScenePoint`.
 */
export function scenePointToStored(scene: Scene, id: string, point: Point): Point {
  const chain = getParentChain(scene, id)
  if (chain.length <= 1) return { x: point.x, y: point.y }
  const parentId = chain[chain.length - 2]
  return sceneToLocal(scene, parentId, point)
}

/**
 * Maps the element's STORED `x/y` coordinates to a composed scene point — the
 * scene position of the element's top-left. Identity for root elements.
 */
export function storedToScenePoint(scene: Scene, id: string, point: Point): Point {
  const chain = getParentChain(scene, id)
  if (chain.length <= 1) return { x: point.x, y: point.y }
  const parentId = chain[chain.length - 2]
  return localToScene(scene, parentId, point)
}

/**
 * Proportional per-child rescale when a parent's box changes (commit-time, so
 * the composition chain stays pure translate+rotate). Scales the child's local
 * offset and dimensions by `(newW/oldW, newH/oldH)` about the parent's local
 * origin; a degenerate old dimension leaves that axis unchanged.
 */
export function rescaleChildGeometry(child: ElementLike, oldW: number, oldH: number, newW: number, newH: number): RescaledChildGeometry {
  const sx = oldW > 0 ? newW / oldW : 1
  const sy = oldH > 0 ? newH / oldH : 1
  return {
    x: round2(child.x * sx),
    y: round2(child.y * sy),
    width: round2(child.width * sx),
    height: round2(child.height * sy)
  }
}
