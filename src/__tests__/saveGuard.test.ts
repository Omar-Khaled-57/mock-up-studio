import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import { withSaveGuard, savePromptMessage, SaveGuardContext } from '../renderer/lib/save-guard'
import { resetStore, makeTextBox } from './helpers'

function stubApi(overrides?: Record<string, unknown>): void {
  (window as { api?: unknown }).api = {
    saveProject: vi.fn(async () => ({ success: true })),
    saveProjectAs: vi.fn(async () => ({ success: true, filePath: '/tmp/test.mockup' })),
    ...overrides
  }
}

function dirtyProject(): void {
  useStore.getState().newProject()
  useStore.getState().setProjectName('My Project')
  useStore.getState().addTextBox(makeTextBox({ id: 'tb-1', zIndex: 5 }))
}

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
  stubApi()
})

describe('savePromptMessage', () => {
  it('interpolates the project name and context into the spec message', () => {
    expect(savePromptMessage('My Project', 'closing')).toBe(
      'Do you want to save the changes made to "My Project" before closing?\n\nYour changes will be lost if you don\'t save them.'
    )
  })

  it('writes the context phrase for each navigation kind', () => {
    const contexts: SaveGuardContext[] = [
      'closing',
      'creating a new project',
      'opening another project',
      'closing this project'
    ]
    for (const ctx of contexts) {
      expect(savePromptMessage('P', ctx)).toContain(`before ${ctx}?`)
    }
  })
})

describe('withSaveGuard', () => {
  it('runs immediately when the document is clean', () => {
    const run = vi.fn()
    withSaveGuard('closing', run)
    expect(run).toHaveBeenCalledTimes(1)
    expect(useRuntimeStore.getState().savePrompt).toBeNull()
  })

  it('opens the Save changes prompt when dirty and defers the action', () => {
    dirtyProject()
    const run = vi.fn()
    withSaveGuard('closing', run)

    expect(run).not.toHaveBeenCalled()
    const prompt = useRuntimeStore.getState().savePrompt
    expect(prompt).not.toBeNull()
    expect(prompt!.message).toContain('"My Project" before closing')
  })

  it('runs the action after a successful save (Save button contract)', async () => {
    dirtyProject()
    const run = vi.fn()
    withSaveGuard('closing', run)

    const prompt = useRuntimeStore.getState().savePrompt!
    const ok = await prompt.save()
    expect(ok).toBe(true)
    expect(useStore.getState().dirty).toBe(false)
    expect(run).not.toHaveBeenCalled()

    prompt.proceed()
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('a failed save leaves the action unrun and the prompt open', async () => {
    dirtyProject()
    stubApi({ saveProjectAs: vi.fn(async () => null) })
    const run = vi.fn()
    withSaveGuard('closing', run)

    const prompt = useRuntimeStore.getState().savePrompt!
    const ok = await prompt.save()
    expect(ok).toBe(false)
    expect(run).not.toHaveBeenCalled()
    expect(useRuntimeStore.getState().savePrompt).not.toBeNull()
  })

  it('routes Don\'t Save to the action via proceed without saving', () => {
    dirtyProject()
    const run = vi.fn()
    withSaveGuard('closing', run)

    useRuntimeStore.getState().savePrompt!.proceed()
    expect(run).toHaveBeenCalledTimes(1)
    expect(useStore.getState().dirty).toBe(true)
  })

  it('routes Cancel to the supplied cancel callback', () => {
    dirtyProject()
    const cancel = vi.fn()
    withSaveGuard('closing', vi.fn(), cancel)

    useRuntimeStore.getState().savePrompt!.cancel()
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('does not stack a second prompt over an open one', () => {
    dirtyProject()
    withSaveGuard('closing', vi.fn())
    const first = useRuntimeStore.getState().savePrompt

    withSaveGuard('opening another project', vi.fn())
    expect(useRuntimeStore.getState().savePrompt).toBe(first)
  })
})
