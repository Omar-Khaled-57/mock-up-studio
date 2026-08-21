import { contextBridge, ipcRenderer } from 'electron'
import type { UpdatePromptPayload } from '../shared/types'

const api = {
  saveProject: (filePath: string, projectJSON: string, assetsJson: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('save-project', filePath, projectJSON, assetsJson),

  saveProjectAs: (projectJSON: string, assetsJson: string): Promise<{ success: boolean; filePath?: string; error?: string } | null> =>
    ipcRenderer.invoke('save-project-as', projectJSON, assetsJson),

  openProject: (): Promise<{ manifest: string; assetsJson: string; filePath: string } | null> =>
    ipcRenderer.invoke('open-project'),

  openProjectByPath: (filePath: string): Promise<{ manifest: string; assetsJson: string; filePath: string } | null> =>
    ipcRenderer.invoke('open-project-by-path', filePath),

  saveImageDialog: (defaultName: string, blob: ArrayBuffer): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> =>
    ipcRenderer.invoke('save-image-dialog', defaultName, blob),

  getRecentProjects: (): Promise<Array<{ path: string; name: string; lastOpened: number; thumbnailPath: string }>> =>
    ipcRenderer.invoke('get-recent-projects'),

  writeRecovery: (projectId: string, data: string): Promise<void> =>
    ipcRenderer.invoke('write-recovery', projectId, data),

  readRecovery: (projectId: string): Promise<string | null> =>
    ipcRenderer.invoke('read-recovery', projectId),

  deleteRecovery: (projectId: string): Promise<void> =>
    ipcRenderer.invoke('delete-recovery', projectId),

  onMenuAction: (callback: (action: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string): void => callback(action)
    ipcRenderer.on('menu-action', handler)
    return () => ipcRenderer.removeListener('menu-action', handler)
  },

  onRequestClose: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('request-close', handler)
    return () => ipcRenderer.removeListener('request-close', handler)
  },

  confirmClose: (): void => {
    ipcRenderer.send('close-confirmed')
  },

  cancelClose: (): void => {
    ipcRenderer.send('close-canceled')
  },

  /** Notify the main process that the renderer received the close request and is
   *  handling it (Save changes? dialog open, save/save-as in flight). Cancels the
   *  3s force-close safety timer — it only fires if this never arrives (crash/hang). */
  ackClose: (): void => {
    ipcRenderer.send('close-acknowledged')
  },

  onOpenFile: (callback: (filePath: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, filePath: string): void => callback(filePath)
    ipcRenderer.on('open-file-path', handler)
    return () => ipcRenderer.removeListener('open-file-path', handler)
  },

  openUserGuide: (): void => {
    ipcRenderer.send('open-user-guide')
  },

  checkForUpdatesNow: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('check-for-updates-now'),

  onDownloadProgress: (callback: (percent: number) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, percent: number): void => callback(percent)
    ipcRenderer.on('download-progress', handler)
    return () => ipcRenderer.removeListener('download-progress', handler)
  },

  onUpdatePrompt: (callback: (prompt: UpdatePromptPayload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, prompt: UpdatePromptPayload): void => callback(prompt)
    ipcRenderer.on('update-prompt', handler)
    return () => ipcRenderer.removeListener('update-prompt', handler)
  },

  /** Reply to a styled update prompt: 'download' | 'later' | 'restart'. */
  respondToUpdate: (action: 'download' | 'later' | 'restart'): void => {
    ipcRenderer.send('update-response', action)
  },

  setNativeTheme: (theme: 'dark' | 'light'): void => {
    ipcRenderer.send('set-native-theme', theme)
  },

  loadComponents: (): Promise<string | null> =>
    ipcRenderer.invoke('load-components'),

  saveComponents: (data: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('save-components', data)
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
