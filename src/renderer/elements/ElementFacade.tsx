import { SceneElementKind } from '../services/hit-test'

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
 * Masks are NOT applied here: masks are independent scene layers clipped at
 * the Scene level (scene-space clip wrappers over all content), never
 * per-element clips.
 */
export default function ElementFacade({ id, kind, locked, style, children }: Props) {
  return (
    <div
      data-element-id={id}
      data-element-kind={kind}
      data-element-locked={locked ? 'true' : 'false'}
      style={{ ...style, touchAction: 'none' }}
    >
      {children}
    </div>
  )
}
