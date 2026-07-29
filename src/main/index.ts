import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc-handlers'
import { createMenu } from './menu'
import { initAutoUpdater } from './auto-updater'

let isQuitting = false
let pendingFilePath: string | null = null

function sendFilePathToRenderer(filePath: string): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) {
    win.webContents.send('open-file-path', filePath)
  }
}

function getFilePathFromArgs(argv: string[]): string | null {
  const mockupArg = argv.find((arg) => arg.endsWith('.mockup'))
  return mockupArg || null
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    icon: join(__dirname, '../../public/logo.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    createMenu(mainWindow)
    initAutoUpdater(mainWindow)

    if (pendingFilePath) {
      sendFilePathToRenderer(pendingFilePath)
      pendingFilePath = null
    }
  })

  mainWindow.on('close', (e) => {
    if (mainWindow.isDestroyed() || isQuitting) return
    e.preventDefault()
    mainWindow.webContents.send('request-close')

    // Safety net: if renderer never responds (crash, hang), force-close after 3s.
    setTimeout(() => {
      if (!isQuitting && !mainWindow.isDestroyed()) {
        isQuitting = true
        mainWindow.destroy()
      }
    }, 3000)
  })

  ipcMain.on('close-confirmed', () => {
    isQuitting = true
    const win = BrowserWindow.getAllWindows()[0]
    if (win && !win.isDestroyed()) win.destroy()
  })

  ipcMain.on('close-canceled', () => {
    // User cancelled — do nothing, window stays open.
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.setAsDefaultProtocolClient('mockup-studio')

app.on('open-file', (_event, filePath) => {
  if (filePath.endsWith('.mockup')) {
    if (BrowserWindow.getAllWindows().length > 0) {
      sendFilePathToRenderer(filePath)
    } else {
      pendingFilePath = filePath
    }
  }
})

app.on('second-instance', (_event, argv) => {
  const filePath = getFilePathFromArgs(argv)
  if (filePath) {
    sendFilePathToRenderer(filePath)
  }
  const win = BrowserWindow.getAllWindows()[0]
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

ipcMain.on('open-user-guide', () => {
  const existing = BrowserWindow.getAllWindows().find((w) => w.title === 'Mockup Studio Guide')
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return
  }
  const win = new BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 640,
    minHeight: 400,
    title: 'Mockup Studio Guide',
    icon: join(__dirname, '../../public/logo.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })
  win.setMenuBarVisibility(false)
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '?guide=1')
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { query: { guide: '1' } })
  }
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.mockup-studio')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()

  createWindow()

  const launchFilePath = getFilePathFromArgs(process.argv)
  if (launchFilePath && !pendingFilePath) {
    pendingFilePath = launchFilePath
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
