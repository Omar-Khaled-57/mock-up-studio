import { type ElementType } from 'react'
import {
  MousePointer2,
  MousePointerSquareDashed,
  Hand,
  Paintbrush,
  Pencil,
  SprayCan,
  Highlighter,
  PenTool,
  Box,
  Droplets,
  Maximize,
  Square,
  Circle,
  Minus,
  Eraser,
  Wand2,
  Trash2,
  Focus,
  Scan
} from 'lucide-react'

export const TOOL_ICONS: Record<string, ElementType> = {
  select: MousePointer2,
  marquee: MousePointerSquareDashed,
  hand: Hand,
  paint: Paintbrush,
  pencil: Pencil,
  airbrush: SprayCan,
  marker: Highlighter,
  calligraphy: PenTool,
  pixel: Box,
  blur: Droplets,
  'blur-element': Maximize,
  'blur-rect': Square,
  'blur-ellipse': Circle,
  'blur-line': Minus,
  eraser: Eraser,
  'magic-eraser': Wand2,
  delete: Trash2,
  focus: Focus,
  mask: Scan
}

export function getToolIcon(id: string): ElementType {
  return TOOL_ICONS[id] ?? MousePointer2
}
