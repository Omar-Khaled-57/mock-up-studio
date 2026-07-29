import { create } from 'zustand'
import { createProjectSlice, ProjectSlice } from './projectSlice'
import { createSceneSlice, SceneSlice } from './sceneSlice'
import { createSelectionSlice, SelectionSlice } from './selectionSlice'
import { createHistorySlice, HistorySlice } from './historySlice'
import { createViewportSlice, ViewportSlice } from './viewportSlice'
import { createUiSlice, UiSlice } from './uiSlice'
import { createExportSlice, ExportSlice } from './exportSlice'
import { createClipboardSlice, ClipboardSlice } from './clipboardSlice'
import { createVersionHistorySlice, VersionHistorySlice } from './versionHistorySlice'
import { createWatermarkSlice, WatermarkSlice } from './watermarkSlice'
import { createShapeSlice, ShapeSlice } from './shapeSlice'

export type StoreState = ProjectSlice &
  SceneSlice &
  SelectionSlice &
  HistorySlice &
  ViewportSlice &
  UiSlice &
  ExportSlice &
  ClipboardSlice &
  VersionHistorySlice &
  WatermarkSlice &
  ShapeSlice

export const useStore = create<StoreState>()((...a) => ({
  ...createProjectSlice(...a),
  ...createSceneSlice(...a),
  ...createSelectionSlice(...a),
  ...createHistorySlice(...a),
  ...createViewportSlice(...a),
  ...createUiSlice(...a),
  ...createExportSlice(...a),
  ...createClipboardSlice(...a),
  ...createVersionHistorySlice(...a),
  ...createWatermarkSlice(...a),
  ...createShapeSlice(...a)
}))
