import { StateCreator } from 'zustand'
import { Project } from '@shared/types'
import { StoreState } from './index'

export interface ProjectSlice {
  project: Project | null
  setProject: (project: Project) => void
  clearProject: () => void
  setProjectName: (name: string) => void
}

export const createProjectSlice: StateCreator<StoreState, [], [], ProjectSlice> = (set) => ({
  project: null,

  setProject: (project) => set({ project }),

  clearProject: () => set({ project: null }),

  setProjectName: (name) =>
    set((state) => {
      if (!state.project) return state
      return { project: { ...state.project, name, updatedAt: Date.now() } }
    })
})
