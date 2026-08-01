/**
 * FocusDim — focus-mode dim layer (rendered by the OverlayRenderer, outside
 * the export node). Renders a translucent scrim over the entire canvas and a
 * highlight ring around the focused group's bounds. Non-focus content stays
 * visible but dimmed — never hidden — so the document remains visually
 * continuous and exports are unaffected (this layer lives in the overlay).
 */
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useRuntimeStore } from '../../runtime/store'
import { getFocusBounds } from '../../services/focus'

export default function FocusDim() {
  const focusGroupId = useRuntimeStore((s) => s.focusGroupId)
  const scene = useStore(safeScene)

  if (!focusGroupId) return null

  const bounds = getFocusBounds(scene, focusGroupId)

  return (
    <>
      <div
        data-focus-dim="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(9, 9, 11, 0.45)',
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
