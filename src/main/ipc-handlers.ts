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

import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import { writeFile } from 'fs/promises'
import pkg from 'electron-updater'
const { autoUpdater } = pkg
import {
  writeRecovery,
  readRecovery,
  deleteRecovery,
  getRecentProjects,
  addRecentProject,
  writeMockupZip,
  readMockupZip,
  loadComponents,
  saveComponents
} from './file-system'

/** Upper bound for a single update check — a blocked/slow network must fail fast instead of hanging. */
const UPDATE_CHECK_TIMEOUT_MS = 25_000

export function registerIpcHandlers(): void {
  /**
   * Saves a project to an existing file path (used by Ctrl+S after first save).
   * The renderer sends the full manifest JSON and a flat {name: base64} assets
   * object. The main process converts the assets back to Buffers and writes
   * the ZIP.
   */
  ipcMain.handle('save-project', async (_event, filePath: string, projectJSON: string, assetsJson: string) => {
    try {
      // Reject paths that don't look like .mockup files (defense-in-depth).
      if (!filePath.endsWith('.mockup')) {
        return { success: false, error: 'Invalid file path: must end with .mockup' }
      }
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

    let filePaths: string[]
    try {
      const result = await dialog.showOpenDialog(win, {
        title: 'Open Project',
        filters: [{ name: 'Mockup Studio', extensions: ['mockup'] }],
        properties: ['openFile']
      })
      filePaths = result.filePaths
    } catch (err) {
      console.error('open-project dialog error:', err)
      return null
    }

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

    let filePath: string | undefined
    try {
      const result = await dialog.showSaveDialog(win, {
        title: 'Save Project As',
        defaultPath: 'untitled.mockup',
        filters: [{ name: 'Mockup Studio', extensions: ['mockup'] }]
      })
      filePath = result.filePath
    } catch (err) {
      console.error('save-project-as dialog error:', err)
      return null
    }

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
      if (!filePath.endsWith('.mockup')) {
        return null
      }
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

  /**
   * Opens the native Save dialog for image export, then writes the blob.
   * Returns the chosen filePath on success, or { canceled: true } if the
   * user dismissed the dialog.
   */
  ipcMain.handle('save-image-dialog', async (event, defaultName: string, blob: ArrayBuffer) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { success: false, error: 'No window' }

    let filePath: string | undefined
    let canceled = false
    try {
      const result = await dialog.showSaveDialog(win, {
        title: 'Export Image',
        defaultPath: defaultName,
        filters: [
          { name: 'PNG', extensions: ['png'] },
          { name: 'JPEG', extensions: ['jpg'] },
          { name: 'WebP', extensions: ['webp'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      filePath = result.filePath
      canceled = result.canceled
    } catch (err) {
      console.error('save-image-dialog error:', err)
      return { success: false, error: String(err) }
    }

    if (canceled || !filePath) return { success: false, canceled: true }

    try {
      await writeFile(filePath, Buffer.from(blob))
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('get-recent-projects', async () => {
    try {
      return getRecentProjects()
    } catch {
      return []
    }
  })

  ipcMain.handle('write-recovery', async (_event, projectId: string, data: string) => {
    try {
      await writeRecovery(projectId, data)
    } catch (err) {
      console.error('[write-recovery] Failed:', err)
    }
  })

  ipcMain.handle('read-recovery', async (_event, projectId: string) => {
    try {
      return readRecovery(projectId)
    } catch {
      return null
    }
  })

  ipcMain.handle('delete-recovery', async (_event, projectId: string) => {
    try {
      await deleteRecovery(projectId)
    } catch (err) {
      console.error('[delete-recovery] Failed:', err)
    }
  })

  /**
   * Triggers electron-updater's built-in check (which shows native dialogs).
   * Used by Help → "Check for Updates…" menu item.
   *
   * In unpackaged builds (dev / `npm start`) electron-updater silently skips
   * the check and resolves null — that must surface as a failure so the
   * renderer shows the styled "update check failed" prompt.
   */
  ipcMain.handle('check-for-updates-now', async () => {
    try {
      if (!app.isPackaged) {
        return {
          success: false,
          error: 'Update checks are only available in packaged builds of Mockup Studio.'
        }
      }
      const checkPromise = autoUpdater.checkForUpdates()
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('The update server did not respond in time. Check your connection and try again.')), UPDATE_CHECK_TIMEOUT_MS).unref()
      })
      // Catch the race loser to prevent an unhandled rejection (Node ≥15 crashes on those).
      const result = await Promise.race([
        checkPromise.catch(() => null),
        timeoutPromise
      ])
      if (!result) {
        return { success: false, error: 'No update source was found.' }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ── Components library ────────────────────────────────

  ipcMain.handle('load-components', async () => {
    try {
      const json = await loadComponents()
      return json
    } catch (err) {
      console.error('load-components error:', err)
      return null
    }
  })

  ipcMain.handle('save-components', async (_event, data: string) => {
    try {
      await saveComponents(data)
      return { success: true }
    } catch (err) {
      console.error('save-components error:', err)
      return { success: false, error: String(err) }
    }
  })
}
