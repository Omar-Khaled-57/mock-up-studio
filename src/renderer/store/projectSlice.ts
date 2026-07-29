import { StateCreator } from 'zustand'
import { Project } from '@shared/types'
import { StoreState } from './index'
import { serializeProject, loadProjectFromZipResult } from '../lib/project-serialization'
import { createDefaultScene } from './sceneSlice'

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
      onOpenFile: (callback: (filePath: string) => void) => (() => void)
      openUserGuide: () => void
      checkForUpdates: () => Promise<{ status: 'available' | 'up-to-date' | 'error'; currentVersion: string; latestVersion?: string; releaseNotes?: string; downloadUrl?: string; error?: string }>
      downloadUpdate: (url: string) => Promise<{ success: boolean; error?: string }>
      onUpdateProgress: (callback: (percent: number) => void) => (() => void)
      installUpdate: () => Promise<void>
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
    const state = get()
    const { project, scenes, activeSceneIndex, filePath } = state
    if (!project) return false

    const { manifest, assets } = serializeProject(
      { id: project.id, name: project.name, createdAt: project.createdAt, updatedAt: project.updatedAt },
      scenes as unknown as Array<Record<string, unknown>>,
      activeSceneIndex
    )

    const assetsObj: Record<string, string> = {}
    for (const [name, buffer] of assets) {
      assetsObj[name] = buffer.toString('base64')
    }
    const assetsJson = JSON.stringify(assetsObj)

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
  },

  saveProjectAs: async () => {
    const state = get()
    const { project, scenes, activeSceneIndex } = state
    if (!project) return false

    const { manifest, assets } = serializeProject(
      { id: project.id, name: project.name, createdAt: project.createdAt, updatedAt: project.updatedAt },
      scenes as unknown as Array<Record<string, unknown>>,
      activeSceneIndex
    )

    const assetsObj: Record<string, string> = {}
    for (const [name, buffer] of assets) {
      assetsObj[name] = buffer.toString('base64')
    }
    const assetsJson = JSON.stringify(assetsObj)

    const result = await window.api.saveProjectAs(manifest, assetsJson)
    if (result?.success && result.filePath) {
      set({ filePath: result.filePath, dirty: false, lastSaved: Date.now() })
      return true
    }
    return false
  },

  openProject: async () => {
    try {
      const result = await window.api.openProject()
      if (!result) return false

      const { project, scenes, activeSceneIndex } = loadProjectFromZipResult(result)

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

      return true
    } catch (err) {
      console.error('openProject error:', err)
      return false
    }
  },

  newProject: () => {
    const id = crypto.randomUUID()
    const now = Date.now()
    const defaultScene = createDefaultScene()
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
  }
})
