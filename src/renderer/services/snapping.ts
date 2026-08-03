/**
 * Snapping service — pure smart-guide + grid-snap computation.
 *
 * Extracted from useSnapping so tools (which cannot use hooks) can snap
 * during drag without duplicating logic. useSnapping now delegates here.
 */

import { Scene } from '@shared/types'
import { SNAP_THRESHOLD } from '../lib/constants'
import { snapAxis } from './geometry'
import { getSceneRect } from './parent-transform'

export interface SnapInput {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface SnapOptions {
  /** Element-alignment (smart-guide) snapping. Independent of grid snap. */
  smartGuides: boolean
  /** Master gate for grid snapping (still requires `scene.grid.snapEnabled`). */
  gridSnap: boolean
}

export interface SnapResult {
  x: number
  y: number
  verticalGuides: number[]
  horizontalGuides: number[]
}

/**
 * Collects left/center/right and top/center/bottom (scene-space AABB edges)
 * from all elements in the scene except the one being dragged (identified by
 * `excludeId`). Children resolve through the composed transform, so snap
 * targets stay correct once an element is nested under a moved/rotated parent.
 */
function gatherSnapTargets(scene: Scene, excludeId: string) {
  const verticals: number[] = []
  const horizontals: number[] = []

  const addElement = (el: { id: string }) => {
    if (el.id === excludeId) return
    const r = getSceneRect(scene, el.id)
    verticals.push(r.x, r.x + r.width / 2, r.x + r.width)
    horizontals.push(r.y, r.y + r.height / 2, r.y + r.height)
  }

  for (const d of scene.devices) addElement(d)
  for (const t of scene.textBoxes) addElement(t)
  for (const i of scene.images) addElement(i)
  for (const s of scene.shapes) addElement(s)

  return { verticals, horizontals }
}

export function computeSnapForScene(scene: Scene, input: SnapInput, options: SnapOptions): SnapResult {
  if (!options.smartGuides && !options.gridSnap) {
    return { x: input.x, y: input.y, verticalGuides: [], horizontalGuides: [] }
  }

  let snappedX = input.x
  let snappedY = input.y
  const vGuides: number[] = []
  const hGuides: number[] = []

  if (options.smartGuides) {
    const { verticals, horizontals } = gatherSnapTargets(scene, input.id)

    const xResult = snapAxis({ pos: input.x, size: input.width, targets: verticals, canvasSize: scene.canvas.width, threshold: SNAP_THRESHOLD })
    const yResult = snapAxis({ pos: input.y, size: input.height, targets: horizontals, canvasSize: scene.canvas.height, threshold: SNAP_THRESHOLD })

    snappedX = xResult.snapped
    snappedY = yResult.snapped
    if (xResult.guide !== null) vGuides.push(xResult.guide)
    if (yResult.guide !== null) hGuides.push(yResult.guide)
  }

  if (options.gridSnap && scene.grid.snapEnabled && scene.grid.size > 0) {
    snappedX = Math.round(input.x / scene.grid.size) * scene.grid.size
    snappedY = Math.round(input.y / scene.grid.size) * scene.grid.size
    vGuides.push(snappedX)
    hGuides.push(snappedY)
  }

  return { x: snappedX, y: snappedY, verticalGuides: vGuides, horizontalGuides: hGuides }
}
