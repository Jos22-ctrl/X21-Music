const path = require('node:path')

/** Convierte `v1.0.0A`, `1.0.0-A` o `1.0.0+build.2` en números comparables. */
function parseVersion(value) {
  const match = String(value || '')
    .trim()
    .match(/^v?(\d+)\.(\d+)\.(\d+)(?:\+build\.(\d+))?/i)
  if (!match) return []
  const numeros = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (match[4] !== undefined) numeros.push(Number(match[4]))
  return numeros
}

/** Extrae `X.Y.Z` y su letra de un tag o del título de un release. */
function findReleaseMark(value) {
  const match = String(value || '')
    .trim()
    .match(/\bv?(\d+\.\d+\.\d+)\s*-?\s*([AMTF])\b/i)
  return match ? { version: match[1], letter: match[2].toUpperCase() } : null
}

/** Letra de etapa de un tag; F significa «versión obsoleta» en GitHub. */
function releaseLetter(value) {
  return findReleaseMark(value)?.letter ?? ''
}

/**
 * Busca una versión marcada como F en la lista de releases. Devuelve null si no hay
 * ninguna; esta búsqueda es informativa y nunca bloquea las actualizaciones.
 */
function detectObsoleteRelease(releases) {
  if (!Array.isArray(releases)) return null
  for (const release of releases) {
    const mark = findReleaseMark(release?.tag_name) ?? findReleaseMark(release?.name)
    if (mark?.letter === 'F') {
      return { version: mark.version, letter: 'F', url: safeReleaseUrl(release?.html_url) }
    }
  }
  return null
}

/** true solo si latest es mayor que current. */
function isNewerVersion(latest, current) {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  const length = Math.max(a.length, b.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference > 0) return true
    if (difference < 0) return false
  }
  return false
}

/** Acepta solo un nombre de .exe, nunca una ruta que pueda salir de la carpeta. */
function safeInstallerName(name) {
  const base = path.win32.basename(String(name || ''))
  if (!base.toLowerCase().endsWith('.exe')) return ''
  if (base.includes('..') || base.includes('/') || base.includes('\\')) return ''
  return base
}

/** Solo se descargan URLs de GitHub, nunca de un manifest arbitrario. */
function safeDownloadUrl(value) {
  const url = String(value || '')
  return url.startsWith('https://github.com/') || url.startsWith('https://objects.githubusercontent.com/')
    ? url
    : ''
}

function safeChecksumUrl(value) {
  const url = safeDownloadUrl(value)
  return /\.sha256$/i.test(url) ? url : ''
}

function safeReleaseUrl(value) {
  const url = String(value || '')
  return url.startsWith('https://github.com/') ? url : ''
}

function normalizedSha256(value) {
  const hash = String(value || '')
    .trim()
    .toLowerCase()
  return /^[0-9a-f]{64}$/.test(hash) ? hash : ''
}

/** Lee la primera línea de un .sha256 (`hash  nombre.exe`). */
function parseChecksumFile(text, installerName) {
  const line = String(text || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find(Boolean)
  if (!line) return ''
  const parts = line.split(/\s+/)
  const hash = normalizedSha256(parts[0])
  if (!hash || !installerName || parts.length < 2) return hash
  const name = parts.slice(1).join(' ').replace(/^\*/, '')
  return name === path.win32.basename(installerName) ? hash : ''
}

/** Normaliza un release de GitHub; sin .sha256 no se ofrece la actualización. */
function normalizeGitHubRelease(release, currentVersion) {
  const unavailable = { available: false, currentVersion, source: 'github' }
  if (!release || typeof release !== 'object') return unavailable

  const version = typeof release.tag_name === 'string' ? release.tag_name.trim() : ''
  const assets = Array.isArray(release.assets) ? release.assets : []
  const asset = assets.find((item) => /\.exe$/i.test(String(item?.name || '')))
  const checksum = assets.find((item) => /\.sha256$/i.test(String(item?.name || '')))
  const installer = safeInstallerName(asset?.name)
  const installerUrl = safeDownloadUrl(asset?.browser_download_url)
  const checksumUrl = safeChecksumUrl(checksum?.browser_download_url)
  if (!version || !installer || !installerUrl || !checksumUrl) return unavailable
  if (!isNewerVersion(version, currentVersion)) return unavailable

  return {
    available: true,
    currentVersion,
    version,
    installer,
    notes: typeof release.body === 'string' ? release.body.trim() : '',
    installerUrl,
    checksumUrl,
    releaseUrl: safeReleaseUrl(release.html_url),
    source: 'github',
  }
}

module.exports = {
  parseVersion,
  findReleaseMark,
  releaseLetter,
  detectObsoleteRelease,
  isNewerVersion,
  safeInstallerName,
  safeDownloadUrl,
  safeChecksumUrl,
  safeReleaseUrl,
  normalizedSha256,
  parseChecksumFile,
  normalizeGitHubRelease,
}
