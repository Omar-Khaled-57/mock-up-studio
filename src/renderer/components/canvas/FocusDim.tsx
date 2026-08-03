/**
 * FocusDim — focus-mode dim layer (rendered by the OverlayRenderer, outside
 * the export node). Renders a translucent scrim over the entire canvas and a
 * highlight ring around the focused scope's bounds (a group subtree or a
 * container element + its children). Non-focus content stays visible but
 * dimmed — never hidden — while the focused scope itself is punched out of
 * the scrim (evenodd clip), so the element under focus stays fully lit. The
 * punch subtracts the EXACT rotated box of every visible scope member (not a
 * union AABB), so the lit region hugs the focused content instead of leaving
 * a ribbon of un-dimmed canvas around it. Exports are unaffected (this layer
 * lives in the overlay).
 */
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useRuntimeStore } from '../../runtime/store'
import { getFocusScopeBounds, getFocusScopeIds } from '../../services/focus'
import { ElementGeometry, getElementGeometry } from '../../services/selection-chrome'
import { buildFocusDimPunch } from '../../services/mask-visualization'

export default function FocusDim() {
  const focusGroupId = useRuntimeStore((s) => s.focusGroupId)
  const focusElementId = useRuntimeStore((s) => s.focusElementId)
  const scene = useStore(safeScene)

  if (!focusGroupId && !focusElementId) return null

  const scopeIds = getFocusScopeIds(scene, focusGroupId, focusElementId)
  const geometries = scopeIds
    .map((id) => getElementGeometry(scene, id))
    .filter((el): el is ElementGeometry => !!el && el.visible)
  const dimPunch = buildFocusDimPunch(
    scene.canvas.width,
    scene.canvas.height,
    geometries.map((el) => ({ x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation ?? 0 }))
  )
  const bounds = getFocusScopeBounds(scene, focusGroupId, focusElementId)

  return (
    <>
      <div
        data-focus-dim="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(9, 9, 11, 0.45)',
          clipPath: dimPunch ?? undefined,
          pointerEvents: 'none'
        }}
      />
      {bounds && (
        <div
          data-focus-ring="true"
          style={{
            position: 'absolute',
            left: bounds.x,
            top: bounds.y,
            width: bounds.width,
            height: bounds.height,
            border: '2px solid #8b5cf6',
            boxShadow: '0 0 0 1px rgba(139, 92, 246, 0.35)',
            borderRadius: 4,
            pointerEvents: 'none'
          }}
        />
      )}
    </>
  )
}
