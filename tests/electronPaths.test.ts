import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const paths = require('../electron/paths.cjs') as {
  safeFileName: (value: string, fallback?: string) => string
  isWithinDirectory: (dir: string, candidate: string) => boolean
  isValidImportSource: (source: string, musicDir: string | null) => boolean
  MAX_IMPORT_BYTES: number
}

describe('validación de rutas en Electron', () => {
  it('limpia nombres con path.win32.basename', () => {
    expect(paths.safeFileName('C:\\Descargas\\pista.mp3')).toBe('pista.mp3')
    expect(paths.safeFileName('..\\mal?nombre.mp3')).toBe('mal_nombre.mp3')
    expect(paths.safeFileName('NUL')).toBe('cancion.mp3')
  })

  it('no permite rutas fuera de la carpeta de música para borrar', () => {
    const dir = 'C:\\Users\\Ana\\X21 Music\\Música'
    expect(paths.isWithinDirectory(dir, `${dir}\\pista.mp3`)).toBe(true)
    expect(paths.isWithinDirectory(dir, 'C:\\Users\\Ana\\Otros\\pista.mp3')).toBe(false)
  })

  it('solo acepta orígenes absolutos de audio', () => {
    const dir = 'C:\\Users\\Ana\\X21 Music\\Música'
    expect(paths.isValidImportSource('D:\\Música\\pista.flac', dir)).toBe(true)
    expect(paths.isValidImportSource('pista.mp3', dir)).toBe(false)
    expect(paths.isValidImportSource(`${dir}\\pista.mp3`, dir)).toBe(false)
    expect(paths.MAX_IMPORT_BYTES).toBeGreaterThan(0)
  })
})
