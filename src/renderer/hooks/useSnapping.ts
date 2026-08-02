/**
 * useSnapping — Smart-guides engine for element and grid alignment.
 *
 * Thin hook wrapper over the pure `computeSnapForScene` service. `computeSnap`
 * is a stable callback that only re-creates when `enabled` changes; the snap
 * result is cached in `snapRef` for `getLastSnap()`.
 */

import { useCallback, useRef } from 'react'
import { useStore } from '../store'
import { safeScene } from '../store/sceneSlice'
import { computeSnapForScene, SnapInput, SnapResult } from '../services/snapping'

interface UseSnappingOptions {
  enabled?: boolean
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
      // One-shot state read (no React subscription — this runs in pointermove).
      const scene = safeScene(useStore.getState())
      const result = computeSnapForScene(scene, input, { smartGuides: options?.enabled !== false, gridSnap: true })
      snapRef.current = result
      return result
    },
    [options?.enabled]
  )

  const getLastSnap = useCallback(() => snapRef.current, [])

  return { computeSnap, getLastSnap }
}
