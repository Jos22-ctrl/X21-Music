/** Comprobaciones de origen para ventanas, navegación e IPC. */

function isHttpsUrl(value) {
  try {
    return new URL(String(value || '')).protocol === 'https:'
  } catch {
    return false
  }
}

/** Enlaces externos: solo HTTPS, nunca `file:`, `javascript:` ni `data:`. */
function isAllowedExternalUrl(value) {
  return isHttpsUrl(value)
}

/** Páginas que pueden mostrar la ventana: empaquetada solo `file://`; dev solo el origen local. */
function isAllowedFrameUrl(value, options) {
  const raw = String(value || '')
  if (options?.isPackaged) return raw.startsWith('file://')
  try {
    return new URL(raw).origin === new URL(options?.devUrl || 'http://localhost:5173').origin
  } catch {
    return false
  }
}

module.exports = { isAllowedExternalUrl, isAllowedFrameUrl }
