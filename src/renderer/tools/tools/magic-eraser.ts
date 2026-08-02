import { createDestructiveTool, ERASER_VARIANTS } from './destructive'

export const magicEraserTool = createDestructiveTool({
  id: 'magic-eraser',
  group: 'eraser',
  label: 'Magic',
  icon: 'magic-eraser',
  brushType: 'magic-eraser',
  historyLabel: 'Magic eraser stroke',
  shortcut: 'e',
  variants: ERASER_VARIANTS
})
