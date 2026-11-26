const path = require('node:path')

const AUDIO_EXTENSION = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm|mp4)$/i
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
const MAX_FILE_NAME_LENGTH = 120
const MAX_IMPORT_BYTES = 2 * 1024 ** 3

/** `basename` de Windows y limpieza de caracteres prohibidos. */
function safeFileName(fileName, fallback = 'cancion.mp3') {
  const base = path.win32
    .basename(String(fileName ?? '').trim())
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
  if (!base || base === '.' || base === '..' || RESERVED_NAMES.test(base)) return fallback
  return base.slice(0, MAX_FILE_NAME_LENGTH)
}

function normalizeForCompare(value) {
  return String(value ?? '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
}

function isWithinDirectory(directory, candidate) {
  const dir = normalizeForCompare(directory)
  const target = normalizeForCompare(candidate)
  if (!dir || !target) return false
  return target === dir || target.startsWith(`${dir}\\`)
}

/** Solo rutas Windows absolutas, de audio y fuera de la carpeta de música. */
function isValidImportSource(source, musicDir) {
  const value = String(source ?? '')
  if (!value || value.includes('\0')) return false
  if (!/^[a-zA-Z]:[\\/]|^\\\\/.test(value)) return false
  if (musicDir && isWithinDirectory(musicDir, value)) return false
  return AUDIO_EXTENSION.test(path.win32.basename(value))
}

module.exports = {
  safeFileName,
  isWithinDirectory,
  isValidImportSource,
  MAX_IMPORT_BYTES,
}
