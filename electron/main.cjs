const { app, BrowserWindow, Menu, shell, ipcMain, session } = require('electron')
const path = require('node:path')
const { DEV_URL, frameOptions } = require('./ipc.cjs')
const { registerMusicIpc } = require('./music.cjs')
const { registerUpdaterIpc } = require('./updater.cjs')
const { isAllowedExternalUrl, isAllowedFrameUrl } = require('./security.cjs')

let mainWindow = null

registerMusicIpc(ipcMain, app, shell)
registerUpdaterIpc(ipcMain, app, shell)

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    // Minimums bajos para que se apliquen las media queries de tablet y móvil.
    minWidth: 480,
    minHeight: 420,
    backgroundColor: '#0a0a0c',
    show: false,
    title: 'X21 Music',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      sandbox: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  if (app.isPackaged) {
    void mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  } else {
    void mainWindow.loadURL(DEV_URL)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// REQUIERE PRUEBA MANUAL EN WINDOWS: navegación, enlaces externos y permisos.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    if (!isAllowedFrameUrl(url, frameOptions(app))) event.preventDefault()
  })
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    // Sin barra «File / Edit / View / Window / Help»: la app es solo música.
    Menu.setApplicationMenu(null)
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
      callback(false)
    })
    createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}
