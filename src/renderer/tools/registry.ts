import { Tool, ToolGroup } from './types'
import { selectTool } from './tools/select'
import { marqueeTool } from './tools/marquee'
import { focusTool } from './tools/focus'
import { handTool } from './tools/hand'
import {
  paintTool,
  pencilTool,
  airbrushTool,
  markerTool,
  calligraphyTool,
  pixelTool
} from './tools/paint'
import { blurTool, blurElementTool, blurRectTool, blurEllipseTool, blurLineTool } from './tools/blur'
import { eraserTool } from './tools/eraser'
import { magicEraserTool } from './tools/magic-eraser'
import { deleteTool } from './tools/delete'
import { maskTool } from './tools/mask'

export const TOOLS: readonly Tool[] = [
  selectTool,
  marqueeTool,
  focusTool,
  handTool,
  paintTool,
  pencilTool,
  airbrushTool,
  markerTool,
  calligraphyTool,
  pixelTool,
  blurTool,
  blurElementTool,
  blurRectTool,
  blurEllipseTool,
  blurLineTool,
  eraserTool,
  magicEraserTool,
  deleteTool,
  maskTool
]

export type ToolRegistry = ReadonlyMap<string, Tool>

export function createToolRegistry(tools: readonly Tool[]): ToolRegistry {
  return new Map(tools.map((tool) => [tool.id, tool]))
}

export const toolRegistry: ToolRegistry = createToolRegistry(TOOLS)

export function getTool(registry: ToolRegistry, id: string): Tool | undefined {
  return registry.get(id)
}

export function toolsInGroup(registry: ToolRegistry, group: ToolGroup): Tool[] {
  return [...registry.values()].filter((tool) => tool.group === group)
}

export function getToolByShortcut(registry: ToolRegistry, key: string): Tool | undefined {
  const normalized = key.toLowerCase()
  for (const tool of registry.values()) {
    if (tool.shortcut === normalized) return tool
  }
  return undefined
}

export function isToolReachable(tool: Tool | undefined): boolean {
  return !!tool && !!tool.onPointerDown
}

export function cycleGroupTool(registry: ToolRegistry, group: ToolGroup, currentId: string): string {
  const groupTools = toolsInGroup(registry, group)
  if (groupTools.length === 0) return currentId
  const index = groupTools.findIndex((tool) => tool.id === currentId)
  const next = groupTools[(index + 1) % groupTools.length]
  return next.id
}
