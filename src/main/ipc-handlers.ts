/**
 * ipc-handlers — Electron main-process IPC handlers.
 *
 * Security model:
 *   - `contextIsolation: true`, `nodeIntegration: false`.
 *   - All file I/O happens here in the main process.
 *   - Renderer communicates via `window.electronAPI.*` (contextBridge).
 *
 * File formats:
 *   - `.mockup` files are ZIP archives (manifest.json + assets).
 *   - Image exports are raw binary (PNG/JPEG/WebP).
 *
 * Recovery system:
 *   - `write-recovery` / `read-recovery` / `delete-recovery` maintain
 *     periodic crash-recovery snapshots in the app's userData directory.
 *
 * Recent projects:
 *   - `addRecentProject()` is called after every open/save-as to keep
 *     the recent list up to date.
 */

import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { get } from 'https'
import {
  writeRecovery,
  readRecovery,
  deleteRecovery,
  getRecentProjects,
  addRecentProject,
  writeMockupZip,
  readMockupZip
} from './file-system'

export function registerIpcHandlers(): void {
  /**
   * Saves a project to an existing file path (used by Ctrl+S after first save).
   * The renderer sends the full manifest JSON and a flat {name: base64} assets
   * object. The main process converts the assets back to Buffers and writes
   * the ZIP.
   */
  ipcMain.handle('save-project', async (_event, filePath: string, projectJSON: string, assetsJson: string) => {
    try {
      const assetsMap = new Map<string, Buffer>()
      const assetsObj = JSON.parse(assetsJson) as Record<string, string>
      for (const [name, base64] of Object.entries(assetsObj)) {
        assetsMap.set(name, Buffer.from(base64, 'base64'))
      }
      await writeMockupZip(filePath, projectJSON, assetsMap)
      return { success: true }
    } catch (err) {
      console.error('save-project error:', err)
      return { success: false, error: String(err) }
    }
  })

  /**
   * Opens the native file dialog, reads the selected .mockup ZIP,
   * and returns the manifest + assets to the renderer. Also adds
   * the file to the recent projects list.
   */
  ipcMain.handle('open-project', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows()[0]
    if (!win) return null

    const { filePaths } = await dialog.showOpenDialog(win, {
      title: 'Open Project',
      filters: [{ name: 'Mockup Studio', extensions: ['mockup'] }],
      properties: ['openFile']
    })

    if (filePaths.length === 0) return null

    const filePath = filePaths[0]
    try {
      const { manifest, assets } = await readMockupZip(filePath)

      // Convert Buffer map to base64 JSON for renderer (IPC can't send Buffers).
      const assetsObj: Record<string, string> = {}
      for (const [name, buffer] of assets) {
        assetsObj[name] = buffer.toString('base64')
      }

      await addRecentProject({
        path: filePath,
        name: filePath.split(/[\\/]/).pop()?.replace('.mockup', '') || 'Untitled',
        lastOpened: Date.now(),
        thumbnailPath: ''
      })

      return { manifest, assetsJson: JSON.stringify(assetsObj), filePath }
    } catch (err) {
      console.error('open-project error:', err)
      return null
    }
  })

  /**
   * Opens the native Save dialog (for "Save As" or first-time save),
   * then writes the .mockup ZIP to the chosen path.
   */
  ipcMain.handle('save-project-as', async (event, projectJSON: string, assetsJson: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null

    const { filePath } = await dialog.showSaveDialog(win, {
      title: 'Save Project As',
      defaultPath: 'untitled.mockup',
      filters: [{ name: 'Mockup Studio', extensions: ['mockup'] }]
    })

    if (!filePath) return null

    try {
      const assetsMap = new Map<string, Buffer>()
      const assetsObj = JSON.parse(assetsJson) as Record<string, string>
      for (const [name, base64] of Object.entries(assetsObj)) {
        assetsMap.set(name, Buffer.from(base64, 'base64'))
      }
      await writeMockupZip(filePath, projectJSON, assetsMap)

      await addRecentProject({
        path: filePath,
        name: filePath.split(/[\\/]/).pop()?.replace('.mockup', '') || 'Untitled',
        lastOpened: Date.now(),
        thumbnailPath: ''
      })

      return { success: true, filePath }
    } catch (err) {
      console.error('save-project-as error:', err)
      return { success: false, error: String(err) }
    }
  })

  /**
   * Opens a project by direct file path (no dialog).
   * Used by the recent projects list and OS file associations.
   */
  ipcMain.handle('open-project-by-path', async (_event, filePath: string) => {
    try {
      const { manifest, assets } = await readMockupZip(filePath)

      const assetsObj: Record<string, string> = {}
      for (const [name, buffer] of assets) {
        assetsObj[name] = buffer.toString('base64')
      }

      await addRecentProject({
        path: filePath,
        name: filePath.split(/[\\/]/).pop()?.replace('.mockup', '') || 'Untitled',
        lastOpened: Date.now(),
        thumbnailPath: ''
      })

      return { manifest, assetsJson: JSON.stringify(assetsObj), filePath }
    } catch (err) {
      console.error('open-project-by-path error:', err)
      return null
    }
  })

  /** Writes raw image data (ArrayBuffer) to a file path. Used by direct save-to-disk. */
  ipcMain.handle('save-image', async (_event, blob: ArrayBuffer, path: string) => {
    try {
      await writeFile(path, Buffer.from(blob))
    } catch (err) {
      console.error('save-image error:', err)
    }
  })

  /**
   * Opens the native Save dialog for image export, then writes the blob.
   * Returns the chosen filePath on success, or { canceled: true } if the
   * user dismissed the dialog.
   */
  ipcMain.handle('save-image-dialog', async (event, defaultName: string, blob: ArrayBuffer) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { success: false, error: 'No window' }

    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: 'Export Image',
      defaultPath: defaultName,
      filters: [
        { name: 'PNG', extensions: ['png'] },
        { name: 'JPEG', extensions: ['jpg'] },
        { name: 'WebP', extensions: ['webp'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (canceled || !filePath) return { success: false, canceled: true }

    try {
      await writeFile(filePath, Buffer.from(blob))
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: String(err) }
    }
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

  /**
   * Checks the latest GitHub release against the installed version.
   */
  ipcMain.handle('check-for-updates', async () => {
    const currentVersion = app.getVersion()
    const repo = 'anomalyco/mockup-studio'

    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) {
        return { status: 'error' as const, currentVersion, error: `GitHub API responded with ${response.status}` }
      }

      const data = await response.json()
      const latestVersion = data.tag_name?.replace(/^v/, '') || '0.0.0'
      const releaseNotes = data.body?.slice(0, 2000) || ''
      const downloadUrl = data.html_url || ''

      const currentParts = currentVersion.split('.').map(Number)
      const latestParts = latestVersion.split('.').map(Number)

      let isNewer = false
      for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
        const c = currentParts[i] || 0
        const l = latestParts[i] || 0
        if (l > c) { isNewer = true; break }
        if (l < c) break
      }

      if (isNewer) {
        return {
          status: 'available' as const,
          currentVersion,
          latestVersion,
          releaseNotes,
          downloadUrl
        }
      }

      return { status: 'up-to-date' as const, currentVersion }
    } catch (err) {
      return { status: 'error' as const, currentVersion, error: String(err) }
    }
  })

  /**
   * Downloads an update from a given URL to the app's temp directory.
   */
  let activeDownload: { abort: () => void; bytesDownloaded: number; totalBytes: number } | null = null

  ipcMain.handle('download-update', async (event, url: string) => {
    const sender = event.sender
    const dest = join(app.getPath('temp'), `mockup-studio-update-${Date.now()}.exe`)

    return new Promise((resolve) => {
      const req = get(url, (response) => {
        const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
        let bytesDownloaded = 0
        const chunks: Buffer[] = []

        activeDownload = {
          abort: () => req.destroy(),
          bytesDownloaded: 0,
          totalBytes
        }

        response.on('data', (chunk: Buffer) => {
          bytesDownloaded += chunk.length
          chunks.push(chunk)
          if (activeDownload) activeDownload.bytesDownloaded = bytesDownloaded
          if (totalBytes > 0) {
            sender.send('update-progress', Math.round((bytesDownloaded / totalBytes) * 100))
          }
        })

        response.on('end', async () => {
          activeDownload = null
          try {
            const buffer = Buffer.concat(chunks)
            await writeFile(dest, buffer)
            resolve({ success: true })
          } catch (err) {
            resolve({ success: false, error: String(err) })
          }
        })

        response.on('error', (err) => {
          activeDownload = null
          resolve({ success: false, error: err.message })
        })
      })

      req.on('error', (err) => {
        activeDownload = null
        resolve({ success: false, error: err.message })
      })

      req.end()
    })
  })

  ipcMain.handle('install-update', async () => {
    app.quit()
  })
}
