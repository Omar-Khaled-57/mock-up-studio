import { create } from 'zustand'
import { createProjectSlice, ProjectSlice } from './projectSlice'
import { createSceneSlice, SceneSlice } from './sceneSlice'
import { createSelectionSlice, SelectionSlice } from './selectionSlice'
import { createHistorySlice, HistorySlice } from './historySlice'
import { createViewportSlice, ViewportSlice } from './viewportSlice'
import { createUiSlice, UiSlice } from './uiSlice'
import { createExportSlice, ExportSlice } from './exportSlice'

export type StoreState = ProjectSlice &
  SceneSlice &
  SelectionSlice &
  HistorySlice &
  ViewportSlice &
  UiSlice &
  ExportSlice

export const useStore = create<StoreState>()((...a) => ({
  ...createProjectSlice(...a),
  ...createSceneSlice(...a),
  ...createSelectionSlice(...a),
  ...createHistorySlice(...a),
  ...createViewportSlice(...a),
  ...createUiSlice(...a),
  ...createExportSlice(...a)
}))
