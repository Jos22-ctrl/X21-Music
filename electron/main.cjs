const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron')
const { spawn } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { normalizeUpdateInfo } = require('./update.cjs')
const {
  safeFileName,
  isWithinDirectory,
  isValidImportSource,
  MAX_IMPORT_BYTES,
} = require('./paths.cjs')

const DEV_URL = process.env.X21_DEV_URL || 'http://localhost:5173'
const GITHUB_REPO = 'Jos22-ctrl/X21-Music'

let mainWindow = null
let folderPromise = null
let updatesFolderPromise = null
/** Clave entregada a la interfaz en la última comprobación; se consume al instalar. */
let pendingUpdate = null

/** C:\Users\<usuario>\X21 Music\Música, creada la primera vez que se necesita. */
async function ensureMusicDir() {
  if (!folderPromise) {
    const dir = path.join(app.getPath('home'), 'X21 Music', 'Música')
    folderPromise = fs
      .mkdir(dir, { recursive: true })
      .then(() => dir)
      .catch((error) => {
        folderPromise = null
        throw error
      })
  }
  return folderPromise
}

/** Evita sobrescribir canciones con el mismo nombre. */
async function uniqueDestination(directory, fileName) {
  const safe = safeFileName(fileName)
  const extension = path.extname(safe)
  const base = path.basename(safe, extension) || 'cancion'
  let candidate = path.join(directory, `${base}${extension}`)
  let counter = 2
  for (;;) {
    try {
      await fs.access(candidate)
      candidate = path.join(directory, `${base} (${counter++})${extension}`)
    } catch {
      return candidate
    }
  }
}

/** Valida el origen antes de cualquier operación y limita el tamaño del archivo. */
async function validateImportSource(source, dir) {
  if (!isValidImportSource(source, dir)) throw new Error('Ruta de archivo no válida.')
  const origin = path.resolve(String(source))
  const stats = await fs.stat(origin)
  if (!stats.isFile() || stats.size > MAX_IMPORT_BYTES) {
    throw new Error('El archivo no es válido o es demasiado grande.')
  }
  return origin
}

/** Comportamiento por defecto: copiar, nunca tocar el original. */
async function copyToMusicDir(source) {
  const dir = await ensureMusicDir()
  const origin = await validateImportSource(source, dir)
  if (isWithinDirectory(dir, origin)) return origin
  const destination = await uniqueDestination(dir, path.basename(origin))
  await fs.copyFile(origin, destination)
  return destination
}

/** Solo cuando el usuario activa explícitamente «mover originales». */
async function moveToMusicDir(source) {
  const dir = await ensureMusicDir()
  const origin = await validateImportSource(source, dir)
  if (isWithinDirectory(dir, origin)) return origin

  const destination = await uniqueDestination(dir, path.basename(origin))
  try {
    await fs.rename(origin, destination)
  } catch (error) {
    // En otra unidad (EXDEV) o con el archivo bloqueado se copia primero.
    await fs.copyFile(origin, destination)
    if (error && error.code === 'EXDEV') await fs.unlink(origin)
  }
  return destination
}

/** C:\Users\<usuario>\X21 Music\Actualizaciones: update.json y el instalador descargado. */
async function ensureUpdatesDir() {
  if (!updatesFolderPromise) {
    const dir = path.join(app.getPath('home'), 'X21 Music', 'Actualizaciones')
    updatesFolderPromise = fs
      .mkdir(dir, { recursive: true })
      .then(() => dir)
      .catch((error) => {
        updatesFolderPromise = null
        throw error
      })
  }
  return updatesFolderPromise
}

function makeUpdateKey() {
  return `X21-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
}

ipcMain.handle('music:get-folder', async () => ensureMusicDir())

ipcMain.handle('music:copy-files', async (_event, paths) => {
  const copied = []
  for (const source of Array.isArray(paths) ? paths : []) {
    try {
      copied.push(await copyToMusicDir(source))
    } catch {
      // Un archivo que ya no existe no impide importar los demás.
    }
  }
  return copied
})

ipcMain.handle('music:move-files', async (_event, paths) => {
  const moved = []
  for (const source of Array.isArray(paths) ? paths : []) {
    try {
      moved.push(await moveToMusicDir(source))
    } catch {
      // Un archivo que ya no existe no impide importar los demás.
    }
  }
  return moved
})

ipcMain.handle('music:save-file', async (_event, payload) => {
  const dir = await ensureMusicDir()
  const data = payload?.data
  if (!(data instanceof ArrayBuffer) || data.byteLength > MAX_IMPORT_BYTES) {
    throw new Error('Archivo no válido o demasiado grande.')
  }
  const destination = await uniqueDestination(dir, payload?.fileName)
  await fs.writeFile(destination, Buffer.from(data))
  return destination
})

ipcMain.handle('music:trash-files', async (_event, paths) => {
  const dir = await ensureMusicDir()
  const trashed = []
  for (const candidate of Array.isArray(paths) ? paths : []) {
    // REQUIERE PRUEBA MANUAL EN WINDOWS: comprobar la papelera en el Explorador.
    if (!isWithinDirectory(dir, String(candidate ?? ''))) continue
    try {
      await shell.trashItem(path.resolve(String(candidate)))
      trashed.push(String(candidate))
    } catch {
      // Si la papelera falla, el archivo se conserva.
    }
  }
  return trashed
})

ipcMain.handle('music:open-folder', async () => {
  const dir = await ensureMusicDir()
  await shell.openPath(dir)
})

/** Consulta el último release de GitHub; devuelve null si no hay red o no sirve. */
async function checkGitHubUpdates(currentVersion) {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'X21-Music' },
    })
    if (!response.ok) return null
    const release = await response.json()
    const asset = (release.assets || []).find((item) => /\.exe$/i.test(item.name || ''))
    if (!asset) return null

    return normalizeUpdateInfo(
      {
        version: String(release.tag_name || ''),
        installer: asset.name,
        installerUrl: asset.browser_download_url,
        releaseUrl: release.html_url,
        notes: release.body || '',
      },
      currentVersion,
      'github',
    )
  } catch {
    return null
  }
}

ipcMain.handle('update:check', async () => {
  const folder = await ensureUpdatesDir()
  const currentVersion = app.getVersion()

  // GitHub primero; si falla o no trae una versión mayor, se usa la carpeta local.
  let info = await checkGitHubUpdates(currentVersion)
  if (!info || !info.available) {
    let raw = null
    try {
      raw = JSON.parse(await fs.readFile(path.join(folder, 'update.json'), 'utf8'))
    } catch {
      raw = null
    }
    info = normalizeUpdateInfo(raw, currentVersion, 'local')
  }

  if (!info.available) return { ...info, folder }

  // Cada búsqueda emite una clave nueva para que un instalador viejo no sirva.
  const key = makeUpdateKey()
  pendingUpdate = { ...info, key, folder }
  return { ...info, key, folder }
})

ipcMain.handle('update:install', async (_event, key) => {
  if (!pendingUpdate || !key || key !== pendingUpdate.key) {
    throw new Error('Clave de actualización no válida. Busca de nuevo las actualizaciones.')
  }

  const downloadDir = path.join(app.getPath('temp'), 'X21 Music Updates')
  await fs.mkdir(downloadDir, { recursive: true })
  const installerPath = path.join(downloadDir, pendingUpdate.installer)

  if (pendingUpdate.source === 'github') {
    const response = await fetch(pendingUpdate.installerUrl, {
      headers: { 'User-Agent': 'X21-Music' },
    })
    if (!response.ok) throw new Error('No se pudo descargar el instalador desde GitHub.')
    await fs.writeFile(installerPath, Buffer.from(await response.arrayBuffer()))
  } else {
    const source = path.join(pendingUpdate.folder, pendingUpdate.installer)
    await fs.access(source)
    await fs.copyFile(source, installerPath)
  }

  const child = spawn(installerPath, [`/X21KEY=${key}`, '/X21MODE=update'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  })
  child.unref()

  pendingUpdate = null
  return { installerPath }
})

ipcMain.handle('update:open-folder', async () => {
  const dir = await ensureUpdatesDir()
  await shell.openPath(dir)
})

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
      sandbox: true,
      spellcheck: false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (app.isPackaged) {
    void mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  } else {
    void mainWindow.loadURL(DEV_URL)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

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
    createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}
