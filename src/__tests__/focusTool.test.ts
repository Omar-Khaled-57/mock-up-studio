/**
 * focus tool — left-click on an element inside a group enters that group's
 * focus; clicking again drills into a subgroup within the focused scope;
 * dimmed (out-of-scope) elements are rejected so focus can never escape the
 * focused subtree. Driven through the tool manager against the real stores.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import { createToolManager, toolRegistry } from '../renderer/tools'
import { resetStore, makeDevice } from './helpers'

type Ptr = {
  pointerId: number
  button: number
  clientX: number
  clientY: number
  altKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

function evt(partial: Partial<Ptr>): PointerEvent {
  return {
    pointerId: 1,
    button: 0,
    clientX: 0,
    clientY: 0,
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false,
    ...partial
  } as unknown as PointerEvent
}

function point(x: number, y: number) {
  return { x, y }
}

function sceneWithGroups(groups: { id: string; name: string; childIds: string[]; parentGroupId: string | null }[]) {
  const devices = groups.flatMap((g) =>
    g.childIds.map((id) => makeDevice({ id, x: 100, y: 100, width: 600, height: 400, groupId: g.id }))
  )
  const scene = useStore.getState().scenes[0]
  useStore.setState({ scenes: [{ ...scene, devices, groups }] })
}

function focusContext(manager: ReturnType<typeof createToolManager>, id: string, kind = 'device') {
  return manager.buildContext({
    scenePoint: point(150, 150),
    hitResult: { id, kind, zIndex: 0, locked: false },
    toolId: 'focus'
  })
}

describe('focus tool', () => {
  beforeEach(() => {
    resetStore()
  })

  it('clicking an element in a group enters that group focus', () => {
    sceneWithGroups([{ id: 'g-1', name: 'G', childIds: ['dev-1'], parentGroupId: null }])

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('focus')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(focusContext(manager, 'dev-1'), evt({}))

    expect(useRuntimeStore.getState().focusGroupId).toBe('g-1')
  })

  it('clicking an element in a subgroup drills into the subgroup within the focused scope', () => {
    sceneWithGroups([
      { id: 'g-1', name: 'G', childIds: ['dev-1'], parentGroupId: null },
      { id: 'g-1-1', name: 'Sub', childIds: ['dev-1-1'], parentGroupId: 'g-1' }
    ])
    useRuntimeStore.getState().enterFocus('g-1')

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('focus')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(focusContext(manager, 'dev-1-1'), evt({}))

    expect(useRuntimeStore.getState().focusGroupId).toBe('g-1-1')
  })

  it('rejects a dimmed element outside the focused subtree (cannot escape focus)', () => {
    sceneWithGroups([
      { id: 'g-1', name: 'G', childIds: ['dev-1'], parentGroupId: null },
      { id: 'g-2', name: 'Other', childIds: ['dev-2'], parentGroupId: null }
    ])
    useRuntimeStore.getState().enterFocus('g-1')

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('focus')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(focusContext(manager, 'dev-2'), evt({}))

    expect(useRuntimeStore.getState().focusGroupId).toBe('g-1')
  })

  it('does nothing when clicking an ungrouped element', () => {
    sceneWithGroups([])

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('focus')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(focusContext(manager, 'dev-1'), evt({}))

    expect(useRuntimeStore.getState().focusGroupId).toBeNull()
  })

  it('does nothing on empty canvas (no hit)', () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('focus')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(10, 10), toolId: 'focus' }), evt({}))

    expect(useRuntimeStore.getState().focusGroupId).toBeNull()
  })

  it('ignores non-primary buttons', () => {
    sceneWithGroups([{ id: 'g-1', name: 'G', childIds: ['dev-1'], parentGroupId: null }])

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('focus')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(focusContext(manager, 'dev-1'), evt({ button: 2 }))

    expect(useRuntimeStore.getState().focusGroupId).toBeNull()
  })
})
