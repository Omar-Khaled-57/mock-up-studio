import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { safeScene } from '../renderer/store/sceneSlice'
import { resetStore, makeDevice } from './helpers'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
})

describe('createSnapshot', () => {
  it('creates a snapshot with correct data', () => {
    useStore.getState().createSnapshot('Test snapshot')
    const snaps = useStore.getState().snapshots
    expect(snaps).toHaveLength(1)
    expect(snaps[0].label).toBe('Test snapshot')
    expect(JSON.parse(snaps[0].scenesJson)).toHaveLength(1)
  })

  it('prepends newest snapshots first', () => {
    useStore.getState().createSnapshot('First')
    useStore.getState().createSnapshot('Second')
    const snaps = useStore.getState().snapshots
    expect(snaps[0].label).toBe('Second')
    expect(snaps[1].label).toBe('First')
  })

  it('enforces max 50 snapshots', () => {
    for (let i = 0; i < 55; i++) {
      useStore.getState().createSnapshot(`Snap ${i}`)
    }
    expect(useStore.getState().snapshots.length).toBeLessThanOrEqual(50)
  })
})

describe('restoreSnapshot', () => {
  it('restores scenes from snapshot', () => {
    useStore.getState().createSnapshot('Before add')
    useStore.getState().addDevice(makeDevice({ id: 'snap-dev' }))
    expect(safeScene(useStore.getState()).devices).toHaveLength(2)

    const snapId = useStore.getState().snapshots[0].id
    useStore.getState().restoreSnapshot(snapId)
    expect(safeScene(useStore.getState()).devices).toHaveLength(1)
  })

  it('clears selection on restore', () => {
    useStore.getState().select('abc')
    useStore.getState().createSnapshot('with selection')
    useStore.getState().restoreSnapshot(useStore.getState().snapshots[0].id)
    expect(useStore.getState().selectedIds).toEqual([])
  })
})

describe('deleteSnapshot', () => {
  it('removes a snapshot by id', () => {
    useStore.getState().createSnapshot('Keep')
    useStore.getState().createSnapshot('Delete')
    const snapId = useStore.getState().snapshots[0].id
    useStore.getState().deleteSnapshot(snapId)
    expect(useStore.getState().snapshots).toHaveLength(1)
    expect(useStore.getState().snapshots[0].label).toBe('Keep')
  })
})

describe('clearSnapshots', () => {
  it('removes all snapshots', () => {
    useStore.getState().createSnapshot('A')
    useStore.getState().createSnapshot('B')
    useStore.getState().clearSnapshots()
    expect(useStore.getState().snapshots).toHaveLength(0)
  })
})

describe('maybeAutoSnapshot', () => {
  it('does not create snapshot when interval has not elapsed', () => {
    useStore.getState().createSnapshot('Initial')
    useStore.getState().maybeAutoSnapshot()
    expect(useStore.getState().snapshots).toHaveLength(1)
  })

  it('creates snapshot when interval has elapsed', () => {
    useStore.getState().setAutoSnapshotEnabled(true)
    useStore.getState().createSnapshot('Initial')
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    useStore.getState().maybeAutoSnapshot()
    expect(useStore.getState().snapshots).toHaveLength(2)
  })

  it('does not create snapshot when auto-snapshot is disabled', () => {
    useStore.getState().createSnapshot('Initial')
    useStore.getState().setAutoSnapshotEnabled(false)
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    useStore.getState().maybeAutoSnapshot()
    expect(useStore.getState().snapshots).toHaveLength(1)
  })
})
