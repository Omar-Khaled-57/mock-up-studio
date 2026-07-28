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
 *   - Downloads silently, then shows a dialog asking the user to restart.
 *   - Does NOT auto-install — always asks first.
 */

import { autoUpdater } from 'electron-updater'
import { BrowserWindow, dialog } from 'electron'
import { is } from '@electron-toolkit/utils'

let updateCheckInterval: ReturnType<typeof setInterval> | null = null

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  if (is.dev) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', async (info) => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available.`,
      detail: 'Would you like to download and install it now?',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1
    })

    if (response === 0) {
      autoUpdater.downloadUpdate()
    }
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.setProgressBar(progress.percent / 100)
  })

  autoUpdater.on('update-downloaded', async () => {
    mainWindow.setProgressBar(-1)

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'The update has been downloaded.',
      detail: 'The app will restart to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    })

    if (response === 0) {
      autoUpdater.quitAndInstall()
    }
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message)
  })

  autoUpdater.on('update-not-available', () => {
    console.log('No update available.')
  })

  // Check on startup (after a short delay to avoid blocking launch).
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 5000)

  // Re-check every 6 hours.
  updateCheckInterval = setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 6 * 60 * 60 * 1000)
}

export function stopAutoUpdater(): void {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval)
    updateCheckInterval = null
  }
}
