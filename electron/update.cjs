const path = require('node:path')

/** Convierte "v0.9.7" o "0.9.7+build" en números comparables. */
function parseVersion(value) {
  return String(value || '')
    .replace(/^v/i, '')
    .split(/[.\-+]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((number) => Number.isFinite(number))
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
  const base = path.basename(String(name || ''))
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

/** Normaliza un release de GitHub o un update.json local y decide si hay actualización. */
function normalizeUpdateInfo(raw, currentVersion, source = 'local') {
  const fallback = { available: false, currentVersion, source }
  if (!raw || typeof raw !== 'object') return fallback

  const version = typeof raw.version === 'string' ? raw.version.trim() : ''
  const installer = safeInstallerName(raw.installer)
  if (!version || !installer || !isNewerVersion(version, currentVersion)) return fallback

  const installerUrl = safeDownloadUrl(raw.installerUrl)
  if (source === 'github' && !installerUrl) return fallback

  return {
    available: true,
    currentVersion,
    version,
    installer,
    notes: typeof raw.notes === 'string' ? raw.notes.trim() : '',
    installerUrl,
    releaseUrl: source === 'github' ? String(raw.releaseUrl || '') : '',
    source,
  }
}

module.exports = {
  parseVersion,
  isNewerVersion,
  safeInstallerName,
  safeDownloadUrl,
  normalizeUpdateInfo,
}
