import { contextBridge, ipcRenderer } from 'electron'

const api = {
  saveProject: (projectJSON: string, assets: ArrayBuffer[]): Promise<void> =>
    ipcRenderer.invoke('save-project', projectJSON, assets),

  openProject: (): Promise<{ manifest: string; assets: Record<string, ArrayBuffer> } | null> =>
    ipcRenderer.invoke('open-project'),

  saveImage: (blob: ArrayBuffer, path: string): Promise<void> =>
    ipcRenderer.invoke('save-image', blob, path),

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
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
