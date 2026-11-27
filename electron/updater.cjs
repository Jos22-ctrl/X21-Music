const { spawn } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { createTrustedHandle } = require('./ipc.cjs')
const {
  isNewerVersion,
  normalizeGitHubRelease,
  parseChecksumFile,
} = require('./update.cjs')

const GITHUB_REPO = 'Jos22-ctrl/X21-Music'
const MAX_INSTALLER_BYTES = 200 * 1024 ** 2
const MAX_CHECKSUM_BYTES = 64 * 1024
const CHECK_TIMEOUT_MS = 15_000
const DOWNLOAD_TIMEOUT_MS = 60_000

/**
 * En Electron se usa net.fetch: respeta la configuración de red de Windows (proxy incluido).
 * Fuera de Electron (pruebas unitarias) se mantiene el fetch de Node.
 */
function networkFetch(url, options) {
  try {
    const electron = require('electron')
    if (typeof electron?.net?.fetch === 'function') return electron.net.fetch(url, options)
  } catch {
    // En las pruebas `electron` es solo la ruta al ejecutable, no un módulo con API.
  }
  return fetch(url, options)
}

/** Convierte un fallo de red en un detalle corto y seguro para mostrar en la interfaz. */
function describeFetchError(error) {
  const message = String(error?.message || error || '')
  if (error?.name === 'TimeoutError' || /timeout|abort/i.test(message)) {
    return ' (tiempo de espera agotado)'
  }
  const code = error?.cause?.code || error?.code
  if (typeof code === 'string' && /^[A-Za-z0-9_]+$/.test(code)) return ` (${code})`
  const netError = message.match(/net::[A-Z_]+/)
  return netError ? ` (${netError[0]})` : ''
}

/** Clave entregada a la interfaz en la última comprobación; se consume al instalar. */
let pendingUpdate = null

/** El instalador se descarga a %TEMP%; no hay carpeta local de actualizaciones. */
function ensureUpdatesDir(app) {
  return path.join(app.getPath('temp'), 'X21 Music Updates')
}

function makeUpdateKey() {
  return `X21-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
}

/** Descarga por partes con límite de tamaño y timeout; devuelve el SHA-256. */
async function downloadWithHash(url, destination, maxBytes) {
  const response = await networkFetch(url, {
    headers: { 'User-Agent': 'X21-Music' },
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error('No se pudo descargar el archivo.')
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > maxBytes) throw new Error('El archivo descargado es demasiado grande.')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('La descarga no devolvió datos.')
  const hash = crypto.createHash('sha256')
  const handle = await fs.open(destination, 'w')
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) throw new Error('El archivo descargado es demasiado grande.')
      hash.update(value)
      await handle.write(value)
    }
  } finally {
    await handle.close().catch(() => undefined)
    await reader.cancel().catch(() => undefined)
  }
  return hash.digest('hex')
}

/** Hash de un archivo local sin cargarlo entero en memoria. */
async function fileSha256(filePath) {
  const hash = crypto.createHash('sha256')
  const handle = await fs.open(filePath, 'r')
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024)
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null)
      if (!bytesRead) break
      hash.update(buffer.subarray(0, bytesRead))
    }
  } finally {
    await handle.close()
  }
  return hash.digest('hex')
}

/** Consulta solo releases de GitHub; nunca usa archivos locales. */
async function checkGitHubUpdates(currentVersion) {
  const unavailable = (error) => ({ available: false, currentVersion, source: 'github', error })
  try {
    const response = await networkFetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'X21-Music' },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    })
    if (!response.ok) return unavailable(`GitHub respondió ${response.status}.`)

    let release
    try {
      release = await response.json()
    } catch {
      return unavailable('GitHub devolvió una respuesta inesperada.')
    }

    const info = normalizeGitHubRelease(release, currentVersion)
    if (!info.available && !isNewerVersion(release?.tag_name, currentVersion)) {
      return { ...info, message: 'Ya tienes la última versión publicada en GitHub.' }
    }
    if (!info.available) {
      return unavailable('El último release de GitHub no trae un instalador verificable.')
    }
    return info
  } catch (error) {
    const detalle = describeFetchError(error)
    return unavailable(
      `No se pudo conectar con GitHub${detalle}. Revisa la conexión, el firewall o el proxy.`,
    )
  }
}

function registerUpdaterIpc(ipcMain, app, shell) {
  const trustedHandle = createTrustedHandle(ipcMain, app)

  trustedHandle('update:check', async () => {
    const info = await checkGitHubUpdates(app.getVersion())
    if (!info.available) return info

    // Cada búsqueda emite una clave nueva para que un instalador viejo no sirva.
    const key = makeUpdateKey()
    pendingUpdate = { ...info, key }
    return { ...info, key }
  })

  trustedHandle('update:install', async (_event, key) => {
    if (!pendingUpdate || !key || key !== pendingUpdate.key) {
      throw new Error('Clave de actualización no válida. Busca de nuevo las actualizaciones.')
    }

    const downloadDir = ensureUpdatesDir(app)
    await fs.mkdir(downloadDir, { recursive: true })
    const installerPath = path.join(downloadDir, pendingUpdate.installer)

    if (!pendingUpdate.checksumUrl) {
      throw new Error('El release no incluye su archivo .sha256; no se puede verificar.')
    }
    const checksumPath = path.join(downloadDir, `${pendingUpdate.installer}.sha256`)
    await downloadWithHash(pendingUpdate.checksumUrl, checksumPath, MAX_CHECKSUM_BYTES)
    const expected = parseChecksumFile(
      await fs.readFile(checksumPath, 'utf8'),
      pendingUpdate.installer,
    )
    await downloadWithHash(pendingUpdate.installerUrl, installerPath, MAX_INSTALLER_BYTES)

    // Ningún instalador se lanza sin comparar su SHA-256 con el publicado.
    const actual = await fileSha256(installerPath)
    if (!expected || actual !== expected) {
      await fs.unlink(installerPath).catch(() => undefined)
      throw new Error('La comprobación SHA-256 ha fallado; el instalador no se ha abierto.')
    }

    // REQUIERE PRUEBA MANUAL EN WINDOWS: descarga real, verificación y handshake con el NSIS.
    const child = spawn(installerPath, [`/X21KEY=${key}`, '/X21MODE=update'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    })
    child.unref()

    pendingUpdate = null
    return { installerPath }
  })
}

module.exports = {
  ensureUpdatesDir,
  makeUpdateKey,
  checkGitHubUpdates,
  registerUpdaterIpc,
}
