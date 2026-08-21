import { StateCreator } from 'zustand'
import { Project, UpdatePromptPayload } from '@shared/types'
import { StoreState } from './index'
import { serializeProject, loadProjectFromZipResult } from '../lib/project-serialization'
import { createDefaultScene } from './sceneSlice'
import { resetRuntime } from '../runtime/store'
import { withDirtySuppressed } from './dirtyTracking'

declare global {
  interface Window {
    api: {
      saveProject: (filePath: string, projectJSON: string, assetsJson: string) => Promise<{ success: boolean; error?: string }>
      saveProjectAs: (projectJSON: string, assetsJson: string) => Promise<{ success: boolean; filePath?: string; error?: string } | null>
      openProject: () => Promise<{ manifest: string; assetsJson: string; filePath: string } | null>
      openProjectByPath: (filePath: string) => Promise<{ manifest: string; assetsJson: string; filePath: string } | null>
      getRecentProjects: () => Promise<Array<{ path: string; name: string; lastOpened: number; thumbnailPath: string }>>
      writeRecovery: (projectId: string, data: string) => Promise<void>
      readRecovery: (projectId: string) => Promise<string | null>
      deleteRecovery: (projectId: string) => Promise<void>
      saveImageDialog: (defaultName: string, blob: ArrayBuffer) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
      onMenuAction: (callback: (action: string) => void) => (() => void)
      onRequestClose: (callback: () => void) => (() => void)
      confirmClose: () => void
      cancelClose: () => void
      ackClose: () => void
      onOpenFile: (callback: (filePath: string) => void) => (() => void)
      openUserGuide: () => void
      checkForUpdatesNow: () => Promise<{ success: boolean; error?: string }>
      onDownloadProgress: (callback: (percent: number) => void) => (() => void)
      onUpdatePrompt: (callback: (prompt: UpdatePromptPayload) => void) => (() => void)
      respondToUpdate: (action: 'download' | 'later' | 'restart') => void
      setNativeTheme: (theme: 'dark' | 'light') => void
      loadComponents: () => Promise<string | null>
      saveComponents: (data: string) => Promise<{ success: boolean; error?: string }>
    }
  }
}

export interface ProjectSlice {
  project: Project | null
  filePath: string | null
  dirty: boolean
  lastSaved: number | null
  setProject: (project: Project) => void
  clearProject: () => void
  setProjectName: (name: string) => void
  setFilePath: (path: string | null) => void
  setDirty: (dirty: boolean) => void
  saveProject: () => Promise<boolean>
  saveProjectAs: () => Promise<boolean>
  openProject: () => Promise<boolean>
  newProject: () => void
}

function encodeAssets(assets: Map<string, Uint8Array>): string {
  const assetsObj: Record<string, string> = {}
  for (const [name, bytes] of assets) {
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    assetsObj[name] = btoa(binary)
  }
  return JSON.stringify(assetsObj)
}

// Module-level debounce for save operations — coalesces rapid saves into one write.
let savePending: Promise<boolean> = Promise.resolve(false)
// Generation counter — incremented on newProject/openProject so in-flight saves
// detect that the project changed mid-flight and bail out.
let saveGeneration = 0

export const createProjectSlice: StateCreator<StoreState, [], [], ProjectSlice> = (set, get) => ({
  project: null,
  filePath: null,
  dirty: false,
  lastSaved: null,

  setProject: (project) => set({ project }),

  clearProject: () => set({ project: null, filePath: null, dirty: false }),

  setProjectName: (name) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: { ...state.project, name, updatedAt: Date.now() },
        dirty: true
      }
    }),

  setFilePath: (path) => set({ filePath: path }),

  setDirty: (dirty) => set({ dirty }),

  saveProject: async () => {
    // Chain onto the pending save — only the latest snapshot is written.
    savePending = savePending.then(async () => {
      try {
        const gen = saveGeneration
        const state = get()
        const { project, scenes, activeSceneIndex, filePath } = state
        if (!project) return false

        const { manifest, assets } = serializeProject(
          { id: project.id, name: project.name, createdAt: project.createdAt, updatedAt: project.updatedAt },
          scenes as unknown as Array<Record<string, unknown>>,
          activeSceneIndex
        )

        const assetsJson = encodeAssets(assets)

        // The project may have changed (newProject/open) while the serialize was in flight.
        if (saveGeneration !== gen) return false

        if (filePath) {
          const result = await window.api.saveProject(filePath, manifest, assetsJson)
          if (result.success) {
            set({ dirty: false, lastSaved: Date.now() })
            return true
          }
          return false
        }

        const result = await window.api.saveProjectAs(manifest, assetsJson)
        if (result?.success && result.filePath) {
          set({ filePath: result.filePath, dirty: false, lastSaved: Date.now() })
          return true
        }
        return false
      } catch (err) {
        console.error('[saveProject] Failed:', err)
        return false
      }
    })
    return savePending
  },

  saveProjectAs: async () => {
    // Chain onto the same mutex so save+saveAs never run concurrently.
    savePending = savePending.then(async () => {
      try {
        const gen = saveGeneration
        const state = get()
        const { project, scenes, activeSceneIndex } = state
        if (!project) return false

        const { manifest, assets } = serializeProject(
          { id: project.id, name: project.name, createdAt: project.createdAt, updatedAt: project.updatedAt },
          scenes as unknown as Array<Record<string, unknown>>,
          activeSceneIndex
        )

        const assetsJson = encodeAssets(assets)

        if (saveGeneration !== gen) return false

        const result = await window.api.saveProjectAs(manifest, assetsJson)
        if (result?.success && result.filePath) {
          set({ filePath: result.filePath, dirty: false, lastSaved: Date.now() })
          return true
        }
        return false
      } catch (err) {
        console.error('[saveProjectAs] Failed:', err)
        return false
      }
    })
    return savePending
  },

  openProject: async () => {
    try {
      saveGeneration++
      const result = await window.api.openProject()
      if (!result) return false

      const { project, scenes, activeSceneIndex } = loadProjectFromZipResult(result)

      withDirtySuppressed(() =>
        set({
          project: project as unknown as Project,
          scenes: scenes as never[],
          activeSceneIndex,
          filePath: result.filePath,
          dirty: false,
          lastSaved: Date.now(),
          undoStack: [],
          redoStack: [],
          selectedIds: []
        })
      )
      // New document — restore default tool, clear focus and transient state.
      resetRuntime('all')

      return true
    } catch (err) {
      console.error('openProject error:', err)
      return false
    }
  },

  newProject: () => {
    saveGeneration++
    const id = crypto.randomUUID()
    const now = Date.now()
    const defaultScene = createDefaultScene()
    withDirtySuppressed(() =>
      set({
        project: {
          id,
          name: 'Untitled',
          createdAt: now,
          updatedAt: now,
          scenes: [defaultScene],
          activeSceneIndex: 0
        },
        scenes: [defaultScene],
        activeSceneIndex: 0,
        filePath: null,
        dirty: false,
        lastSaved: null,
        undoStack: [],
        redoStack: [],
        selectedIds: []
      })
    )
    resetRuntime('all')
  }
})
