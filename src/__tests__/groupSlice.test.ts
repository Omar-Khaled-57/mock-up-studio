import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { safeScene } from '../renderer/store/sceneSlice'
import { resetStore, makeDevice, makeTextBox, makeShape } from './helpers'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
})

describe('groupSelected', () => {
  it('returns null when fewer than 2 items selected', () => {
    const state = useStore.getState()
    state.select(makeDevice().id)
    const gid = useStore.getState().groupSelected()
    expect(gid).toBeNull()
  })

  it('creates a group from 2 selected devices', () => {
    const d1 = makeDevice()
    const d2 = makeDevice()
    const store = useStore.getState()
    store.addDevice(d1)
    store.addDevice(d2)
    store.select(d1.id)
    store.select(d2.id, true)
    const gid = useStore.getState().groupSelected()
    expect(gid).not.toBeNull()
    const scene = safeScene(useStore.getState())
    expect(scene.groups).toHaveLength(1)
    expect(scene.groups[0].childIds).toEqual([d1.id, d2.id])
  })

  it('sets groupId on all grouped elements', () => {
    const d1 = makeDevice()
    const d2 = makeDevice()
    const store = useStore.getState()
    store.addDevice(d1)
    store.addDevice(d2)
    store.select(d1.id)
    store.select(d2.id, true)
    const gid = useStore.getState().groupSelected()
    const scene = safeScene(useStore.getState())
    for (const d of scene.devices) {
      if (d.id === d1.id || d.id === d2.id) {
        expect(d.groupId).toBe(gid)
      }
    }
  })

  it('groups mixed element types', () => {
    const d = makeDevice()
    const t = makeTextBox()
    const s = makeShape()
    const store = useStore.getState()
    store.addDevice(d)
    store.addTextBox(t)
    store.addShape(s)
    store.select(d.id)
    store.select(t.id, true)
    store.select(s.id, true)
    const gid = useStore.getState().groupSelected()
    const scene = safeScene(useStore.getState())
    expect(scene.groups).toHaveLength(1)
    expect(scene.groups[0].childIds).toHaveLength(3)
    expect(scene.devices.find((x) => x.id === d.id)!.groupId).toBe(gid)
    expect(scene.textBoxes.find((x) => x.id === t.id)!.groupId).toBe(gid)
    expect(scene.shapes.find((x) => x.id === s.id)!.groupId).toBe(gid)
  })
})

describe('ungroup', () => {
  it('removes the group record and clears groupId from children', () => {
    const d1 = makeDevice()
    const d2 = makeDevice()
    const store = useStore.getState()
    store.addDevice(d1)
    store.addDevice(d2)
    store.select(d1.id)
    store.select(d2.id, true)
    const gid = useStore.getState().groupSelected()!
    useStore.getState().ungroup(gid)
    const scene = safeScene(useStore.getState())
    expect(scene.groups).toHaveLength(0)
    for (const d of scene.devices) {
      expect(d.groupId).toBeNull()
    }
  })

  it('clears groupId only on children of the ungrouped group', () => {
    const d1 = makeDevice()
    const d2 = makeDevice()
    const d3 = makeDevice()
    const d4 = makeDevice()
    const store = useStore.getState()
    store.addDevice(d1)
    store.addDevice(d2)
    store.addDevice(d3)
    store.addDevice(d4)
    store.select(d1.id)
    store.select(d2.id, true)
    const gid1 = useStore.getState().groupSelected()!
    store.clearSelection()
    store.select(d3.id)
    store.select(d4.id, true)
    const gid2 = useStore.getState().groupSelected()!
    useStore.getState().ungroup(gid1)
    const scene = safeScene(useStore.getState())
    expect(scene.groups).toHaveLength(1)
    expect(scene.groups[0].id).toBe(gid2)
    expect(scene.devices.find((d) => d.id === d1.id)!.groupId).toBeNull()
    expect(scene.devices.find((d) => d.id === d2.id)!.groupId).toBeNull()
    expect(scene.devices.find((d) => d.id === d3.id)!.groupId).toBe(gid2)
    expect(scene.devices.find((d) => d.id === d4.id)!.groupId).toBe(gid2)
  })
})

describe('renameGroup', () => {
  it('renames an existing group', () => {
    const d1 = makeDevice()
    const d2 = makeDevice()
    const store = useStore.getState()
    store.addDevice(d1)
    store.addDevice(d2)
    store.select(d1.id)
    store.select(d2.id, true)
    const gid = useStore.getState().groupSelected()!
    useStore.getState().renameGroup(gid, 'My Group')
    const scene = safeScene(useStore.getState())
    expect(scene.groups[0].name).toBe('My Group')
  })

  it('does nothing for a non-existent group', () => {
    const store = useStore.getState()
    store.renameGroup('nonexistent', 'New Name')
    const scene = safeScene(store)
    expect(scene.groups).toHaveLength(0)
  })
})

describe('duplicateGroup', () => {
  it('duplicates a group and its members', () => {
    const d1 = makeDevice({ x: 100, y: 100 })
    const d2 = makeDevice({ x: 200, y: 200 })
    useStore.getState().addDevice(d1)
    useStore.getState().addDevice(d2)
    useStore.getState().select(d1.id)
    useStore.getState().select(d2.id, true)
    const gid = useStore.getState().groupSelected()!
    useStore.getState().duplicateGroup(gid)
    const scene = safeScene(useStore.getState())
    expect(scene.groups).toHaveLength(2)
    expect(scene.devices).toHaveLength(4)
    const dupeGroup = scene.groups.find((g) => g.id !== gid)!
    expect(dupeGroup.childIds).toHaveLength(2)
    const origIds = [d1.id, d2.id]
    for (const cid of dupeGroup.childIds) {
      expect(origIds).not.toContain(cid)
      const dupeDev = scene.devices.find((d) => d.id === cid)!
      expect(dupeDev.groupId).toBe(dupeGroup.id)
      expect(dupeDev.x).toBeGreaterThan(100)
    }
  })
})
