/**
 * Snapping service — pure smart-guide + grid-snap computation.
 *
 * Extracted from useSnapping so tools (which cannot use hooks) can snap
 * during drag without duplicating logic. useSnapping now delegates here.
 */

import { Scene } from '@shared/types'
import { SNAP_THRESHOLD } from '../lib/constants'
import { snapAxis } from './geometry'

export interface SnapInput {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface SnapResult {
  x: number
  y: number
  verticalGuides: number[]
  horizontalGuides: number[]
}

/**
 * Collects left/center/right and top/center/bottom from all elements in the
 * scene except the one being dragged (identified by `excludeId`).
 */
function gatherSnapTargets(scene: Scene, excludeId: string) {
  const verticals: number[] = []
  const horizontals: number[] = []

  const addElement = (el: { id: string; x: number; y: number; width: number; height: number }) => {
    if (el.id === excludeId) return
    verticals.push(el.x, el.x + el.width / 2, el.x + el.width)
    horizontals.push(el.y, el.y + el.height / 2, el.y + el.height)
  }

  for (const d of scene.devices) addElement(d)
  for (const t of scene.textBoxes) addElement(t)
  for (const i of scene.images) addElement(i)
  for (const s of scene.shapes) addElement(s)

  return { verticals, horizontals }
}

export function computeSnapForScene(scene: Scene, input: SnapInput, enabled: boolean): SnapResult {
  if (!enabled) return { x: input.x, y: input.y, verticalGuides: [], horizontalGuides: [] }

  const { verticals, horizontals } = gatherSnapTargets(scene, input.id)

  const xResult = snapAxis({ pos: input.x, size: input.width, targets: verticals, canvasSize: scene.canvas.width, threshold: SNAP_THRESHOLD })
  const yResult = snapAxis({ pos: input.y, size: input.height, targets: horizontals, canvasSize: scene.canvas.height, threshold: SNAP_THRESHOLD })

  let snappedX = xResult.snapped
  let snappedY = yResult.snapped
  const vGuides: number[] = xResult.guide !== null ? [xResult.guide] : []
  const hGuides: number[] = yResult.guide !== null ? [yResult.guide] : []

  if (scene.grid.snapEnabled && scene.grid.size > 0) {
    snappedX = Math.round(input.x / scene.grid.size) * scene.grid.size
    snappedY = Math.round(input.y / scene.grid.size) * scene.grid.size
    vGuides.push(snappedX)
    hGuides.push(snappedY)
  }

  return { x: snappedX, y: snappedY, verticalGuides: vGuides, horizontalGuides: hGuides }
}
