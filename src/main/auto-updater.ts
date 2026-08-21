/**
 * auto-updater — Checks for updates from GitHub Releases via electron-updater.
 *
 * Usage:
 *   - Called once from main/index.ts after window creation.
 *   - Only runs in production (not in dev mode).
 *   - Requires `build.publish` config in package.json with a valid GitHub repo.
 *   - If no publish config is set, silently does nothing.
 *
 * Behavior:
 *   - Checks for updates on startup.
 *   - Re-checks every 6 hours.
 *   - Downloads silently, then asks the user to restart.
 *   - Does NOT auto-install — always asks first.
 *
 * Styled-prompt contract:
 *   All user-facing prompts are rendered in-app by the renderer (never native
 *   OS dialogs). Main sends `update-prompt` events ({ kind: 'available' |
 *   'ready' | 'failed' }) to the window; the renderer replies on the
 *   `update-response` channel with 'download' | 'later' | 'restart'.
 */

import pkg from 'electron-updater'
const { autoUpdater } = pkg
import { BrowserWindow, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import type { UpdatePromptPayload } from '../shared/types'

let updateCheckInterval: ReturnType<typeof setInterval> | null = null
let currentWindow: BrowserWindow | null = null
let updaterListenersRegistered = false
let responseHandlerRegistered = false

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  currentWindow = mainWindow
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  // Guard against duplicate listeners when initAutoUpdater is called again
  // (e.g. on macOS dock re-click recreating the window).
  if (!updaterListenersRegistered) {
    updaterListenersRegistered = true
    autoUpdater.on('update-available', (info) => {
      sendUpdatePrompt({ kind: 'available', version: info.version })
    })

    autoUpdater.on('download-progress', (progress) => {
      currentWindow?.setProgressBar(progress.percent / 100)
      currentWindow?.webContents.send('download-progress', progress.percent)
    })

    autoUpdater.on('update-downloaded', () => {
      currentWindow?.setProgressBar(-1)
      sendUpdatePrompt({ kind: 'ready' })
    })

    autoUpdater.on('error', (err) => {
      console.error('Auto-updater error:', err.message)
      sendUpdatePrompt({ kind: 'failed', message: err.message })
    })

    autoUpdater.on('update-not-available', () => {
      console.log('No update available.')
    })
  }

  // Register the renderer reply channel once (initAutoUpdater can be called
  // again on macOS window re-creation — duplicate ipcMain.on would be a leak).
  if (!responseHandlerRegistered) {
    responseHandlerRegistered = true
    ipcMain.on('update-response', (_event, action: string) => {
      switch (action) {
        case 'download':
          currentWindow?.webContents.send('download-progress', 0)
          autoUpdater.downloadUpdate()
          break
        case 'restart':
          autoUpdater.quitAndInstall()
          break
        // 'later' needs no main-side action: the update stays downloaded and
        // will only install when the user chooses Restart Now again.
      }
    })
  }

  // Skip automatic checks in dev mode (not packaged).
  if (is.dev) return

  // Check on startup (after a short delay to avoid blocking launch).
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 5000)

  // Re-check every 6 hours.
  updateCheckInterval = setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 6 * 60 * 60 * 1000)
}

function sendUpdatePrompt(payload: UpdatePromptPayload): void {
  if (currentWindow && !currentWindow.isDestroyed()) {
    currentWindow.webContents.send('update-prompt', payload)
  }
}

export function stopAutoUpdater(): void {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval)
    updateCheckInterval = null
  }
}
