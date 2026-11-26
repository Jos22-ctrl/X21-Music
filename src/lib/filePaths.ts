/** Utilidades puras para rutas Windows; sin Node en el renderer. */

const INVALID_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g
const AUDIO_EXTENSION = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm|mp4)$/i
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

export const MAX_FILE_NAME_LENGTH = 120
export const MAX_IMPORT_BYTES = 2 * 1024 ** 3

/** Equivalente a `path.win32.basename` para barras inversas y normales. */
export function windowsBaseName(filePath: string): string {
  const parts = String(filePath ?? '')
    .trim()
    .split(/[\\/]+/)
    .filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

/** Nombre de archivo Windows seguro, sin rutas relativas ni caracteres prohibidos. */
export function safeAudioFileName(fileName: string, fallback = 'cancion.mp3'): string {
  const base = windowsBaseName(fileName)
    .replace(INVALID_CHARS, '_')
    .replace(/[. ]+$/g, '')
    .trim()
  if (!base || base === '.' || base === '..' || RESERVED_NAMES.test(base)) return fallback
  return base.slice(0, MAX_FILE_NAME_LENGTH)
}

export function isWithinDirectory(directory: string, candidate: string): boolean {
  const normalize = (value: string): string =>
    value.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
  const dir = normalize(String(directory ?? ''))
  const target = normalize(String(candidate ?? ''))
  if (!dir || !target) return false
  return target === dir || target.startsWith(`${dir}\\`)
}

/** Acepta solo rutas Windows absolutas de audio fuera de la carpeta de música. */
export function isValidImportPath(source: string, musicDir: string | null): boolean {
  const value = String(source ?? '')
  if (!value || value.includes('\0')) return false
  if (!/^[a-zA-Z]:[\\/]|^\\\\/.test(value)) return false
  if (musicDir && isWithinDirectory(musicDir, value)) return false
  return AUDIO_EXTENSION.test(windowsBaseName(value))
}

/** Tamaño aproximado legible para la interfaz; nunca pretende ser exacto. */
export function formatApproximateSize(bytes: number): string {
  const value = Number.isFinite(bytes) && bytes > 0 ? bytes : 0
  if (value < 1024 ** 2) return `${Math.round(value / 1024)} KB`
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`
  return `${(value / 1024 ** 3).toFixed(1)} GB`
}
