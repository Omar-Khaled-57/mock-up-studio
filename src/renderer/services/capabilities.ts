import { CapabilitySet, NO_CAPABILITIES } from '../tools/types'
import { SceneElementKind } from './hit-test'

/**
 * Element kind → capability set.
 *
 * Capabilities gate what the Select tool (and future tools) may do with an
 * element. Used by hit-testing, tools, and panels.
 */
export function getCapabilities(kind: SceneElementKind): CapabilitySet {
  switch (kind) {
    case 'device':
      return { moveable: true, resizable: true, editable: true, paintable: false, maskable: true }
    case 'textBox':
      return { moveable: true, resizable: true, editable: true, paintable: false, maskable: true }
    case 'image':
      return { moveable: true, resizable: true, editable: false, paintable: false, maskable: true }
    case 'shape':
      return { moveable: true, resizable: true, editable: true, paintable: false, maskable: true }
    default:
      return { ...NO_CAPABILITIES }
  }
}

export const MOVE_LABELS: Record<SceneElementKind, string> = {
  device: 'Move device',
  textBox: 'Move text box',
  image: 'Move image',
  shape: 'Move shape'
}

export const RESIZE_LABELS: Record<SceneElementKind, string> = {
  device: 'Resize device',
  textBox: 'Resize text box',
  image: 'Resize image',
  shape: 'Resize shape'
}
