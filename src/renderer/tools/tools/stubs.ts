import { Tool } from '../types'

/**
 * Placeholder tools for planned features. They are fully registered and appear
 * in the toolbar (disabled) so the surface is stable, but they carry no pointer
 * handlers — `isToolReachable` is false, so shortcuts can never activate them.
 */

export const deleteElementTool: Tool = {
  id: 'delete-element',
  group: 'eraser',
  label: 'Delete Element',
  icon: 'delete-element',
  cursor: 'crosshair'
}
