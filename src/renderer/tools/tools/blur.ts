import { createDestructiveTool } from './destructive'
import { PAINT_VARIANTS } from './paint'

export const blurTool = createDestructiveTool({
  id: 'blur',
  group: 'brush',
  label: 'Blur Brush',
  icon: 'blur',
  brushType: 'blur',
  historyLabel: 'Blur stroke',
  shortcut: 'b',
  variants: PAINT_VARIANTS
})
