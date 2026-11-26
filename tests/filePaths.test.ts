import { describe, expect, it } from 'vitest'
import {
  formatApproximateSize,
  isWithinDirectory,
  isValidImportPath,
  safeAudioFileName,
  windowsBaseName,
} from '../src/lib/filePaths'

describe('rutas y nombres de archivo', () => {
  it('extrae solo el nombre con cualquier separador', () => {
    expect(windowsBaseName('C:\\Música\\canción.mp3')).toBe('canción.mp3')
    expect(windowsBaseName('C:/Música/canción.mp3')).toBe('canción.mp3')
    expect(windowsBaseName('C:\\Música\\')).toBe('Música')
  })

  it('rechaza rutas relativas, vacías y caracteres Windows prohibidos', () => {
    expect(safeAudioFileName('..\\..\\mal.mp3')).toBe('mal.mp3')
    expect(safeAudioFileName('a:b?c.mp3')).toBe('a_b_c.mp3')
    expect(safeAudioFileName('CON')).toBe('cancion.mp3')
    expect(safeAudioFileName('   ')).toBe('cancion.mp3')
  })

  it('comprueba que la ruta esté dentro de la carpeta', () => {
    const dir = 'C:\\Users\\Ana\\X21 Music\\Música'
    expect(isWithinDirectory(dir, `${dir}\\pista.mp3`)).toBe(true)
    expect(isWithinDirectory(dir, 'C:\\Users\\Ana\\Otros\\pista.mp3')).toBe(false)
    expect(isWithinDirectory(dir, `${dir}hermana\\pista.mp3`)).toBe(false)
  })

  it('valida orígenes de importación', () => {
    const dir = 'C:\\Users\\Ana\\X21 Music\\Música'
    expect(isValidImportPath('D:\\Descargas\\pista.mp3', dir)).toBe(true)
    expect(isValidImportPath(`${dir}\\pista.mp3`, dir)).toBe(false)
    expect(isValidImportPath('Descargas\\pista.mp3', dir)).toBe(false)
    expect(isValidImportPath('D:\\Descargas\\notas.txt', dir)).toBe(false)
    expect(isValidImportPath('D:\\Descargas\\pista.mp3\u0000', dir)).toBe(false)
  })

  it('muestra el espacio aproximado en español', () => {
    expect(formatApproximateSize(512 * 1024)).toBe('512 KB')
    expect(formatApproximateSize(5 * 1024 ** 2)).toBe('5.0 MB')
    expect(formatApproximateSize(-1)).toBe('0 KB')
  })
})
