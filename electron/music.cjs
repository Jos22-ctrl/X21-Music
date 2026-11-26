const fs = require('node:fs/promises')
const path = require('node:path')
const { createTrustedHandle } = require('./ipc.cjs')
const {
  safeFileName,
  isWithinDirectory,
  isValidImportSource,
  MAX_IMPORT_BYTES,
} = require('./paths.cjs')

/** C:\Users\<usuario>\X21 Music\Música, creada la primera vez que se necesita. */
async function ensureMusicDir(app) {
  if (!ensureMusicDir.promise) {
    const dir = path.join(app.getPath('home'), 'X21 Music', 'Música')
    ensureMusicDir.promise = fs
      .mkdir(dir, { recursive: true })
      .then(() => dir)
      .catch((error) => {
        ensureMusicDir.promise = null
        throw error
      })
  }
  return ensureMusicDir.promise
}

/** Evita sobrescribir canciones con el mismo nombre. */
async function uniqueDestination(directory, fileName) {
  const safe = safeFileName(fileName)
  const extension = path.win32.extname(safe)
  const base = path.win32.basename(safe, extension) || 'cancion'
  let candidate = path.win32.join(directory, `${base}${extension}`)
  let counter = 2
  for (;;) {
    try {
      await fs.access(candidate)
      candidate = path.win32.join(directory, `${base} (${counter++})${extension}`)
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
async function copyToMusicDir(source, app) {
  const dir = await ensureMusicDir(app)
  const origin = await validateImportSource(source, dir)
  if (isWithinDirectory(dir, origin)) return origin
  const destination = await uniqueDestination(dir, path.win32.basename(origin))
  await fs.copyFile(origin, destination)
  return destination
}

/** Solo cuando el usuario activa explícitamente «mover originales». */
async function moveToMusicDir(source, app) {
  const dir = await ensureMusicDir(app)
  const origin = await validateImportSource(source, dir)
  if (isWithinDirectory(dir, origin)) return origin

  const destination = await uniqueDestination(dir, path.win32.basename(origin))
  try {
    await fs.rename(origin, destination)
  } catch (error) {
    // En otra unidad (EXDEV) o con el archivo bloqueado se copia primero.
    await fs.copyFile(origin, destination)
    if (error && error.code === 'EXDEV') await fs.unlink(origin)
  }
  return destination
}

function registerMusicIpc(ipcMain, app, shell) {
  const trustedHandle = createTrustedHandle(ipcMain, app)

  trustedHandle('music:get-folder', async () => ensureMusicDir(app))

  trustedHandle('music:copy-files', async (_event, paths) => {
    const copied = []
    for (const source of Array.isArray(paths) ? paths : []) {
      try {
        copied.push(await copyToMusicDir(source, app))
      } catch {
        // Un archivo que ya no existe no impide importar los demás.
      }
    }
    return copied
  })

  trustedHandle('music:move-files', async (_event, paths) => {
    const moved = []
    for (const source of Array.isArray(paths) ? paths : []) {
      try {
        moved.push(await moveToMusicDir(source, app))
      } catch {
        // Un archivo que ya no existe no impide importar los demás.
      }
    }
    return moved
  })

  trustedHandle('music:save-file', async (_event, payload) => {
    const dir = await ensureMusicDir(app)
    const data = payload?.data
    if (!(data instanceof ArrayBuffer) || data.byteLength > MAX_IMPORT_BYTES) {
      throw new Error('Archivo no válido o demasiado grande.')
    }
    const destination = await uniqueDestination(dir, payload?.fileName)
    await fs.writeFile(destination, Buffer.from(data))
    return destination
  })

  trustedHandle('music:trash-files', async (_event, paths) => {
    const dir = await ensureMusicDir(app)
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

  trustedHandle('music:open-folder', async () => {
    const dir = await ensureMusicDir(app)
    await shell.openPath(dir)
  })
}

module.exports = {
  ensureMusicDir,
  uniqueDestination,
  validateImportSource,
  copyToMusicDir,
  moveToMusicDir,
  registerMusicIpc,
}
