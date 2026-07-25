import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import {
  writeRecovery,
  readRecovery,
  deleteRecovery,
  getRecentProjects,
  addRecentProject
} from './file-system'

export function registerIpcHandlers(): void {
  ipcMain.handle('save-project', async (event, projectJSON: string, assets: ArrayBuffer[]) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return

    const { filePath } = await dialog.showSaveDialog(win, {
      title: 'Save Project',
      defaultPath: 'untitled.mockup',
      filters: [{ name: 'Mockup Studio', extensions: ['mockup'] }]
    })

    if (!filePath) return

    // TODO: Phase 9 — create ZIP with jszip, write manifest.json + assets
    // For now, write the manifest JSON directly
    console.log('save-project assets count:', assets.length)
    await writeFile(filePath, projectJSON, 'utf-8')
  })

  ipcMain.handle('open-project', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null

    const { filePaths } = await dialog.showOpenDialog(win, {
      title: 'Open Project',
      filters: [{ name: 'Mockup Studio', extensions: ['mockup'] }],
      properties: ['openFile']
    })

    if (filePaths.length === 0) return null

    const filePath = filePaths[0]
    const data = await readFile(filePath, 'utf-8')

    await addRecentProject({
      path: filePath,
      name: filePath.split(/[\\/]/).pop()?.replace('.mockup', '') || 'Untitled',
      lastOpened: Date.now(),
      thumbnailPath: ''
    })

    return { manifest: data, assets: {} }
  })

  ipcMain.handle('save-image', async (_event, blob: ArrayBuffer, path: string) => {
    await writeFile(path, Buffer.from(blob))
  })

  ipcMain.handle('get-recent-projects', async () => {
    return getRecentProjects()
  })

  ipcMain.handle('write-recovery', async (_event, projectId: string, data: string) => {
    await writeRecovery(projectId, data)
  })

  ipcMain.handle('read-recovery', async (_event, projectId: string) => {
    return readRecovery(projectId)
  })

  ipcMain.handle('delete-recovery', async (_event, projectId: string) => {
    await deleteRecovery(projectId)
  })
}
