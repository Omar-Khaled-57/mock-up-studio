import { type ElementType } from 'react'
import { MousePointer2, MousePointerSquareDashed, Hand, Paintbrush, Droplets, Eraser, Wand2, Focus, Scan, Trash2 } from 'lucide-react'

export const TOOL_ICONS: Record<string, ElementType> = {
  select: MousePointer2,
  marquee: MousePointerSquareDashed,
  hand: Hand,
  paint: Paintbrush,
  blur: Droplets,
  eraser: Eraser,
  'magic-eraser': Wand2,
  'delete-element': Trash2,
  focus: Focus,
  mask: Scan
}

export function getToolIcon(id: string): ElementType {
  return TOOL_ICONS[id] ?? MousePointer2
}
