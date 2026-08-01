/**
 * toolManager tests — covers effective-tool resolution, temporary-tool stack,
 * pointer ownership, cursor priority, modifier fan-out, shortcut cycling, and
 * runtime-store mirroring.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useRuntimeStore } from '../renderer/runtime/store'
import {
  createToolManager,
  createToolRegistry,
  ToolRegistry,
  Tool,
  NO_CAPABILITIES,
  InteractionContext,
  Modifiers
} from '../renderer/tools'
import { resetStore } from './helpers'

let registry: ToolRegistry

beforeEach(() => {
  resetStore()
  registry = createToolRegistry(
    ['select', 'marquee', 'hand', 'paint', 'blur', 'eraser', 'magic-eraser', 'focus', 'mask'].map(
      (id) => {
        const byId: Record<string, Tool> = {
          select: {
            id: 'select',
            group: 'select',
            label: 'Select / Move',
            icon: 'cursor',
            cursor: 'default',
            shortcut: 'v',
            onPointerDown: () => {}
          },
          marquee: {
            id: 'marquee',
            group: 'select',
            label: 'Marquee Select',
            icon: 'marquee',
            cursor: 'crosshair',
            shortcut: 'm'
          },
          hand: {
            id: 'hand',
            group: 'select',
            label: 'Hand',
            icon: 'hand',
            cursor: 'grab',
            shortcut: 'h',
            onPointerDown: () => {}
          },
          paint: {
            id: 'paint',
            group: 'brush',
            label: 'Paint Brush',
            icon: 'brush',
            cursor: 'crosshair',
            shortcut: 'b'
          },
          blur: { id: 'blur', group: 'brush', label: 'Blur Brush', icon: 'blur', cursor: 'crosshair', shortcut: 'b' },
          eraser: {
            id: 'eraser',
            group: 'eraser',
            label: 'Eraser',
            icon: 'eraser',
            cursor: 'crosshair',
            shortcut: 'e'
          },
          'magic-eraser': {
            id: 'magic-eraser',
            group: 'eraser',
            label: 'Magic Eraser',
            icon: 'magic-eraser',
            cursor: 'crosshair',
            shortcut: 'e'
          },
          focus: {
            id: 'focus',
            group: 'select',
            label: 'Focus Tool',
            icon: 'focus',
            cursor: 'crosshair',
            shortcut: 'x'
          },
          mask: {
            id: 'mask',
            group: 'mask',
            label: 'Mask Tool',
            icon: 'mask',
            cursor: 'crosshair',
            shortcut: 'g'
          }
        }
        return byId[id]
      }
    )
  )
})

describe('effective tool resolution', () => {
  it('starts with select', () => {
    const manager = createToolManager(registry)
    expect(manager.getEffectiveToolId()).toBe('select')
    expect(manager.getActiveTool().id).toBe('select')
  })

  it('base tool drives the effective tool when the temporary stack is empty', () => {
    const manager = createToolManager(registry)
    manager.setActiveTool('paint')
    expect(manager.getEffectiveToolId()).toBe('paint')
  })

  it('temporary tool becomes effective until popped', () => {
    const manager = createToolManager(registry)
    manager.setActiveTool('paint')
    manager.pushTemporaryTool('hand', 'keyup')
    expect(manager.getEffectiveToolId()).toBe('hand')
    manager.popTemporaryTool()
    expect(manager.getEffectiveToolId()).toBe('paint')
  })

  it('ignores unknown tool ids without throwing', () => {
    const manager = createToolManager(registry)
    manager.setActiveTool('nope')
    expect(manager.getEffectiveToolId()).toBe('select')
    manager.pushTemporaryTool('nope', 'keyup')
    expect(manager.getEffectiveToolId()).toBe('select')
  })
})

describe('temporary tool stack', () => {
  it('pops all entries released by their until condition (LIFO)', () => {
    const manager = createToolManager(registry)
    manager.setActiveTool('paint')
    manager.pushTemporaryTool('hand', 'keyup')
    manager.pushTemporaryTool('hand', 'keyup')
    manager.releaseTemporaryUntil('keyup')
    expect(manager.getEffectiveToolId()).toBe('paint')
  })

  it('does not release entries with a longer-lived until condition', () => {
    const manager = createToolManager(registry)
    manager.setActiveTool('paint')
    manager.pushTemporaryTool('hand', 'pointerup')
    manager.pushTemporaryTool('hand', 'keyup')
    manager.releaseTemporaryUntil('pointerup')
    expect(manager.getEffectiveToolId()).toBe('hand')
    manager.releaseTemporaryUntil('keyup')
    expect(manager.getEffectiveToolId()).toBe('hand')
    manager.releaseTemporaryUntil('pointerup')
    expect(manager.getEffectiveToolId()).toBe('paint')
  })

  it('handleEscape clears the temporary stack', () => {
    const manager = createToolManager(registry)
    manager.pushTemporaryTool('hand', 'keyup')
    manager.handleEscape()
    expect(manager.getEffectiveToolId()).toBe('select')
  })

  it('releaseTemporaryTools clears the stack regardless of until condition', () => {
    const manager = createToolManager(registry)
    manager.setActiveTool('paint')
    manager.pushTemporaryTool('hand', 'keyup')
    manager.pushTemporaryTool('hand', 'pointerup')
    manager.releaseTemporaryTools()
    expect(manager.getEffectiveToolId()).toBe('paint')
    expect(useRuntimeStore.getState().temporaryToolStack).toHaveLength(0)
  })
})

describe('pointer ownership', () => {
  it('acquires a pointer for the first tool', () => {
    const manager = createToolManager(registry)
    expect(manager.acquirePointer(1, 'select')).toBe(true)
    expect(manager.getOwner(1)).toBe('select')
    expect(manager.isPointerOwned()).toBe(true)
  })

  it('rejects a different tool on an owned pointer', () => {
    const manager = createToolManager(registry)
    manager.acquirePointer(1, 'select')
    expect(manager.acquirePointer(1, 'hand')).toBe(false)
    expect(manager.getOwner(1)).toBe('select')
  })

  it('allows a second pointer for the same tool', () => {
    const manager = createToolManager(registry)
    manager.acquirePointer(1, 'select')
    expect(manager.acquirePointer(2, 'select')).toBe(true)
    expect(manager.isPointerOwned()).toBe(true)
  })

  it('releases a single pointer without disturbing others', () => {
    const manager = createToolManager(registry)
    manager.acquirePointer(1, 'select')
    manager.acquirePointer(2, 'select')
    manager.releasePointer(1)
    expect(manager.getOwner(1)).toBeNull()
    expect(manager.getOwner(2)).toBe('select')
    manager.releasePointer(2)
    expect(manager.isPointerOwned()).toBe(false)
  })

  it('handleEscape releases all pointers', () => {
    const manager = createToolManager(registry)
    manager.acquirePointer(1, 'select')
    manager.handleEscape()
    expect(manager.isPointerOwned()).toBe(false)
  })
})

describe('interruptTools', () => {
  it('handleEscape interrupts every registered tool', () => {
    const interrupted: string[] = []
    const tool: Tool = {
      id: 'select',
      group: 'select',
      label: 'Select / Move',
      icon: 'cursor',
      cursor: 'default',
      onPointerDown: () => {},
      onInterrupt: () => interrupted.push('select')
    }
    const reg = createToolRegistry([tool])
    const manager = createToolManager(reg)
    manager.acquirePointer(1, 'select')
    manager.handleEscape()
    expect(interrupted).toEqual(['select'])
  })

  it('reset interrupts pending gestures', () => {
    const interrupted: string[] = []
    const tool: Tool = {
      id: 'select',
      group: 'select',
      label: 'Select / Move',
      icon: 'cursor',
      cursor: 'default',
      onPointerDown: () => {},
      onInterrupt: () => interrupted.push('select')
    }
    const manager = createToolManager(createToolRegistry([tool]))
    manager.acquirePointer(1, 'select')
    manager.reset()
    expect(interrupted).toEqual(['select'])
    expect(manager.getActiveTool().id).toBe('select')
    expect(manager.isPointerOwned()).toBe(false)
  })

  it('interruptTools alone interrupts without touching ownership', () => {
    const interrupted: string[] = []
    const tool: Tool = {
      id: 'select',
      group: 'select',
      label: 'Select / Move',
      icon: 'cursor',
      cursor: 'default',
      onPointerDown: () => {},
      onInterrupt: () => interrupted.push('select')
    }
    const manager = createToolManager(createToolRegistry([tool]))
    manager.acquirePointer(1, 'select')
    manager.interruptTools()
    expect(interrupted).toEqual(['select'])
    expect(manager.isPointerOwned()).toBe(true)
  })
})

describe('cursor resolution', () => {
  it('returns the active tool cursor by default', () => {
    const manager = createToolManager(registry)
    expect(manager.getCursor()).toBe('default')
    manager.setActiveTool('hand')
    expect(manager.getCursor()).toBe('grab')
  })

  it('prefers the temporary tool cursor over the base tool', () => {
    const manager = createToolManager(registry)
    manager.pushTemporaryTool('hand', 'keyup')
    expect(manager.getCursor()).toBe('grab')
  })

  it('prefers pointer ownership cursor over everything', () => {
    const manager = createToolManager(registry)
    manager.pushTemporaryTool('hand', 'keyup')
    expect(manager.getCursor({ pointerOwned: true })).toBe('grabbing')
    expect(manager.getCursor({ pointerOwned: true, draggingCursor: 'ew-resize' })).toBe('ew-resize')
  })

  it('shows move over a moveable element only for select-group tools', () => {
    const manager = createToolManager(registry)
    const moveable = { ...NO_CAPABILITIES, moveable: true }
    expect(manager.getCursor({ hoveredCapabilities: moveable })).toBe('move')
    manager.setActiveTool('hand')
    expect(manager.getCursor({ hoveredCapabilities: moveable })).toBe('grab')
  })

  it('falls back to default on dimmed regions only when nothing higher applies', () => {
    const manager = createToolManager(registry)
    expect(manager.getCursor({ focusDimmed: true })).toBe('default')
    manager.pushTemporaryTool('hand', 'keyup')
    expect(manager.getCursor({ focusDimmed: true })).toBe('grab')
  })
})

describe('modifier tracking', () => {
  it('tracks modifier state', () => {
    const manager = createToolManager(registry)
    expect(manager.getModifiers()).toEqual({ shift: false, ctrl: false, alt: false, meta: false })
    manager.setModifier('shift', true)
    expect(manager.getModifiers().shift).toBe(true)
    manager.setModifier('shift', false)
    expect(manager.getModifiers().shift).toBe(false)
  })

  it('fans out modifier changes to the effective tool only', () => {
    const seen: { ctx: InteractionContext; mods: Modifiers }[] = []
    const spyTool: Tool = {
      id: 'spy',
      group: 'select',
      label: 'Spy',
      icon: 'spy',
      cursor: 'default',
      onModifierChange: (ctx, mods) => seen.push({ ctx, mods })
    }
    const local = createToolRegistry([spyTool, registry.get('hand')!])
    const manager = createToolManager(local)
    manager.setActiveTool('spy')
    manager.setModifier('shift', true)
    expect(seen).toHaveLength(1)
    expect(seen[0].mods.shift).toBe(true)
    expect(seen[0].ctx.effectiveToolId).toBe('spy')
  })

  it('does not fan out for the effective tool if it has no handler', () => {
    const manager = createToolManager(registry)
    manager.setModifier('shift', true)
    expect(manager.getModifiers().shift).toBe(true)
  })
})

describe('shortcut cycling', () => {
  it('re-activating a single-shortcut tool stays put (V → select)', () => {
    const manager = createToolManager(registry)
    expect(manager.handleToolShortcut('v')).toBe(true)
    expect(manager.getEffectiveToolId()).toBe('select')
    expect(manager.handleToolShortcut('v')).toBe(true)
    expect(manager.getEffectiveToolId()).toBe('select')
  })

  it('cycles within the brush group via B (paint, blur)', () => {
    const manager = createToolManager(registry)
    expect(manager.handleToolShortcut('b')).toBe(true)
    expect(manager.getEffectiveToolId()).toBe('paint')
    expect(manager.handleToolShortcut('b')).toBe(true)
    expect(manager.getEffectiveToolId()).toBe('blur')
    expect(manager.handleToolShortcut('b')).toBe(true)
    expect(manager.getEffectiveToolId()).toBe('paint')
  })

  it('cycles within the eraser group via E (eraser, magic-eraser)', () => {
    const manager = createToolManager(registry)
    expect(manager.handleToolShortcut('e')).toBe(true)
    expect(manager.getEffectiveToolId()).toBe('eraser')
    expect(manager.handleToolShortcut('e')).toBe(true)
    expect(manager.getEffectiveToolId()).toBe('magic-eraser')
    expect(manager.handleToolShortcut('e')).toBe(true)
    expect(manager.getEffectiveToolId()).toBe('eraser')
  })

  it('jumps to the hand tool via H without cycling the select group', () => {
    const manager = createToolManager(registry)
    expect(manager.handleToolShortcut('h')).toBe(true)
    expect(manager.getEffectiveToolId()).toBe('hand')
  })

  it('returns false for unknown keys', () => {
    const manager = createToolManager(registry)
    expect(manager.handleToolShortcut('z')).toBe(false)
    expect(manager.getEffectiveToolId()).toBe('select')
  })
})

describe('reachable shortcuts (fully-implemented tools only)', () => {
  it('keeps select active when it is the only reachable tool for its key', () => {
    const manager = createToolManager(registry)
    expect(manager.handleReachableShortcut('v')).toBe(true)
    expect(manager.getEffectiveToolId()).toBe('select')
  })

  it('cycles through reachable tools sharing a shortcut key', () => {
    const reachable = [...registry.values()].map((tool) =>
      tool.id === 'paint' || tool.id === 'blur' ? { ...tool, onPointerDown: () => {} } : tool
    )
    const manager = createToolManager(createToolRegistry(reachable))
    expect(manager.handleReachableShortcut('b')).toBe(true)
    expect(manager.getEffectiveToolId()).toBe('paint')
    expect(manager.handleReachableShortcut('b')).toBe(true)
    expect(manager.getEffectiveToolId()).toBe('blur')
    expect(manager.handleReachableShortcut('b')).toBe(true)
    expect(manager.getEffectiveToolId()).toBe('paint')
  })

  it('jumps to a reachable tool sharing no key with the active tool', () => {
    const manager = createToolManager(registry)
    expect(manager.handleReachableShortcut('h')).toBe(true)
    expect(manager.getEffectiveToolId()).toBe('hand')
  })

  it('refuses stub tools without pointer handling', () => {
    const manager = createToolManager(registry)
    for (const key of ['m', 'b', 'g', 'x']) {
      expect(manager.handleReachableShortcut(key)).toBe(false)
      expect(manager.getEffectiveToolId()).toBe('select')
    }
  })
})

describe('reset', () => {
  it('restores the default tool, clears temp stack, ownership, and modifiers, and mirrors runtime', () => {
    const manager = createToolManager(registry)
    manager.setActiveTool('hand')
    manager.pushTemporaryTool('hand', 'keyup')
    manager.acquirePointer(1, 'hand')
    manager.setModifier('shift', true)

    manager.reset()

    expect(manager.getActiveTool().id).toBe('select')
    expect(manager.getEffectiveToolId()).toBe('select')
    expect(manager.isPointerOwned()).toBe(false)
    expect(manager.getModifiers()).toEqual({ shift: false, ctrl: false, alt: false, meta: false })
    expect(useRuntimeStore.getState().activeToolId).toBe('select')
    expect(useRuntimeStore.getState().temporaryToolStack).toHaveLength(0)
  })
})

describe('runtime mirroring', () => {
  it('mirrors the active base tool', () => {
    const manager = createToolManager(registry)
    manager.setActiveTool('paint')
    expect(useRuntimeStore.getState().activeToolId).toBe('paint')
  })

  it('mirrors the temporary stack', () => {
    const manager = createToolManager(registry)
    manager.pushTemporaryTool('hand', 'keyup')
    expect(useRuntimeStore.getState().temporaryToolStack).toHaveLength(1)
    manager.popTemporaryTool()
    expect(useRuntimeStore.getState().temporaryToolStack).toHaveLength(0)
  })

  it('handleEscape clears the mirrored temporary stack', () => {
    const manager = createToolManager(registry)
    manager.pushTemporaryTool('hand', 'keyup')
    manager.handleEscape()
    expect(useRuntimeStore.getState().temporaryToolStack).toHaveLength(0)
  })
})

describe('activation handoff', () => {
  it('calls onDeactivate on the old tool and onActivate on the new tool', () => {
    const calls: string[] = []
    const aTool: Tool = {
      id: 'a',
      group: 'select',
      label: 'A',
      icon: 'a',
      cursor: 'default',
      onActivate: () => calls.push('activate a'),
      onDeactivate: () => calls.push('deactivate a')
    }
    const bTool: Tool = {
      id: 'b',
      group: 'brush',
      label: 'B',
      icon: 'b',
      cursor: 'default',
      onActivate: () => calls.push('activate b')
    }
    const local = createToolRegistry([aTool, bTool])
    const manager = createToolManager(local)
    manager.setActiveTool('a')
    manager.setActiveTool('b')
    expect(calls).toEqual(['activate a', 'deactivate a', 'activate b'])
  })
})
