import { useStore } from '../store'
import { useRuntimeStore } from '../runtime/store'

export type SaveGuardContext = 'closing' | 'creating a new project' | 'opening another project' | 'closing this project'

export function savePromptMessage(projectName: string, context: SaveGuardContext): string {
  return `Do you want to save the changes made to "${projectName}" before ${context}?\n\nYour changes will be lost if you don't save them.`
}

/**
 * Guard any destructive navigation (window close, close project, open another
 * project, new project). When the document is clean the action runs
 * immediately. When it is dirty a "Save changes?" prompt is shown; the action
 * only proceeds after a successful save or an explicit "Don't Save".
 *
 * A prompt that is already open is left alone (a single modal, no stacking).
 */
export function withSaveGuard(context: SaveGuardContext, run: () => void, cancel?: () => void): void {
  const state = useStore.getState()
  if (!state.dirty) {
    run()
    return
  }

  const rt = useRuntimeStore.getState()
  if (rt.savePrompt) return

  rt.openSavePrompt({
    message: savePromptMessage(state.project?.name ?? 'Untitled', context),
    save: async () => {
      const s = useStore.getState()
      return s.saveProject()
    },
    proceed: () => run(),
    cancel: () => cancel?.()
  })
}
