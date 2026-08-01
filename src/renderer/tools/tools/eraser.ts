import { createDestructiveTool, ERASER_VARIANTS } from './destructive'

export const eraserTool = createDestructiveTool({
  id: 'eraser',
  group: 'eraser',
  label: 'Eraser',
  icon: 'eraser',
  brushType: 'eraser',
  historyLabel: 'Eraser stroke',
  shortcut: 'e',
  variants: ERASER_VARIANTS
})
