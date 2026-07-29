/**
 * useSnapping — Smart-guides engine for element and grid alignment.
 *
 * How snapping works:
 *   1. `gatherSnapTargets()` collects left/center/right (or top/center/bottom)
 *      positions from every OTHER element in the scene, plus the dragging
 *      element's own edges/center.
 *   2. If grid snap is enabled, `gatherGridSnapTargets()` adds grid
 *      intersection points to the target pool.
 *   3. `snapAxis()` tests each candidate edge against all targets. If any
 *      is within SNAP_THRESHOLD (5px), the element's position is adjusted
 *      to align exactly with that target. The first (strongest) match wins.
 *   4. Guide lines are returned so the canvas can render them.
 *
 * Performance:
 *   - Uses `useStore.getState()` for a one-shot read (no subscription overhead
 *     during the hot drag loop). This is safe because snapping is called from
 *     pointermove handlers, not during React render.
 *   - `computeSnap` is a stable callback that only re-creates when `enabled`
 *     changes. The snap result is cached in `snapRef` for `getLastSnap()`.
 */

import { useCallback, useRef } from 'react'
import { Scene } from '@shared/types'
import { useStore } from '../store'
import { safeScene } from '../store/sceneSlice'
import { SNAP_THRESHOLD } from '../lib/constants'

interface SnapResult {
  x: number
  y: number
  verticalGuides: number[]
  horizontalGuides: number[]
}

interface SnapInput {
  id: string
  x: number
  y: number
  width: number
  height: number
}

interface UseSnappingOptions {
  enabled?: boolean
}

/**
 * Collects left/center/right and top/center/bottom from all elements in the
 * scene except the one being dragged (identified by `excludeId`).
 * Returns two arrays: vertical targets (x-axis) and horizontal targets (y-axis).
 */
function gatherSnapTargets(scene: Scene, excludeId: string) {
  const verticals: number[] = []
  const horizontals: number[] = []

  const addElement = (el: { id: string; x: number; y: number; width: number; height: number }) => {
    if (el.id === excludeId) return
    // Left, center, right edges
    verticals.push(el.x, el.x + el.width / 2, el.x + el.width)
    // Top, center, bottom edges
    horizontals.push(el.y, el.y + el.height / 2, el.y + el.height)
  }

  for (const d of scene.devices) addElement(d)
  for (const t of scene.textBoxes) addElement(t)
  for (const i of scene.images) addElement(i)
  for (const s of scene.shapes) addElement(s)

  return { verticals, horizontals }
}

/**
 * Tests one axis (x or y) for snapping.
 * For each candidate edge (left/center/right or top/center/bottom), finds
 * the closest target within the threshold. Returns the snapped position and
 * the guide position to render.
 *
 * `bestOffset` tracks the element's new position (not the target's position)
 * so we can set `style.left/top` directly.
 */
function snapAxis(
  pos: number,
  size: number,
  targets: number[],
  canvasSize: number,
  threshold: number
): { snapped: number; guide: number | null } {
  const left = pos
  const center = pos + size / 2
  const right = pos + size + size * 0 // right edge = pos + size

  let bestDist = threshold + 1
  let bestOffset = 0
  let bestGuide: number | null = null

  // The three points on the element that can snap.
  const candidates = [
    { elemVal: left, offset: 0 },
    { elemVal: center, offset: size / 2 },
    { elemVal: right, offset: size }
  ]

  // Canvas edges + center are always snap targets.
  const canvasCandidates = [0, canvasSize / 2, canvasSize]

  for (const c of candidates) {
    // Check against all other elements' edges.
    for (const t of targets) {
      const dist = Math.abs(c.elemVal - t)
      if (dist < bestDist) {
        bestDist = dist
        bestOffset = t - c.elemVal + pos
        bestGuide = t
      }
    }
    // Check against canvas edges.
    for (const t of canvasCandidates) {
      const dist = Math.abs(c.elemVal - t)
      if (dist < bestDist) {
        bestDist = dist
        bestOffset = t - c.elemVal + pos
        bestGuide = t
      }
    }
  }

  // If nothing was close enough, return the original position.
  if (bestDist > threshold) {
    return { snapped: pos, guide: null }
  }

  return { snapped: Math.round(bestOffset * 100) / 100, guide: bestGuide }
}

export function useSnapping(options?: UseSnappingOptions) {
  const snapRef = useRef<SnapResult>({
    x: 0,
    y: 0,
    verticalGuides: [],
    horizontalGuides: []
  })

  const computeSnap = useCallback(
    (input: SnapInput): SnapResult => {
      if (options?.enabled === false) {
        return { x: input.x, y: input.y, verticalGuides: [], horizontalGuides: [] }
      }

      // One-shot state read (no React subscription — this runs in pointermove).
      const scene = safeScene(useStore.getState())
      const { verticals, horizontals } = gatherSnapTargets(scene, input.id)

      // Element-to-element snapping with 5px threshold.
      const xResult = snapAxis(input.x, input.width, verticals, scene.canvas.width, SNAP_THRESHOLD)
      const yResult = snapAxis(input.y, input.height, horizontals, scene.canvas.height, SNAP_THRESHOLD)

      let snappedX = xResult.snapped
      let snappedY = yResult.snapped
      const vGuides: number[] = xResult.guide !== null ? [xResult.guide] : []
      const hGuides: number[] = yResult.guide !== null ? [yResult.guide] : []

      // Grid snapping — rounds element position to the nearest grid line.
      // Active regardless of distance so elements always align to the grid.
      if (scene.grid.snapEnabled && scene.grid.size > 0) {
        snappedX = Math.round(input.x / scene.grid.size) * scene.grid.size
        snappedY = Math.round(input.y / scene.grid.size) * scene.grid.size
        vGuides.push(snappedX)
        hGuides.push(snappedY)
      }

      const result: SnapResult = {
        x: snappedX,
        y: snappedY,
        verticalGuides: vGuides,
        horizontalGuides: hGuides
      }

      snapRef.current = result
      return result
    },
    [options?.enabled]
  )

  const getLastSnap = useCallback(() => snapRef.current, [])

  return { computeSnap, getLastSnap }
}
