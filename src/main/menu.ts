import { Menu, BrowserWindow, dialog } from 'electron'

export function createMenu(mainWindow: BrowserWindow): void {
  const isMac = process.platform === 'darwin'

  const send = (action: string) => mainWindow.webContents.send('menu-action', action)

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ role: 'appMenu' as const }]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => send('new-project')
        },
        {
          label: 'Open…',
          accelerator: 'CmdOrCtrl+O',
          click: () => send('open-project')
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => send('save-project')
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => send('save-project-as')
        },
        { type: 'separator' },
        { role: isMac ? 'close' : 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => send('undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: () => send('redo') },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', click: () => send('cut-selected') },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: () => send('copy-selected') },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', click: () => send('paste-clipboard') },
        { type: 'separator' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: () => send('select-all') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'User Guide',
          accelerator: 'F1',
          click: () => send('open-user-guide')
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => send('show-shortcuts')
        },
        { type: 'separator' },
        {
          label: 'About Mockup Studio',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Mockup Studio',
              message: 'Mockup Studio',
              detail: 'Desktop device mockup scene builder.\nVersion 0.1.0'
            })
          }
        },
        {
          label: 'Check for Updates…',
          click: () => send('check-for-updates')
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
