import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { uniqueDestination } from '../electron/music.cjs'
import { ensureUpdatesDir, makeUpdateKey } from '../electron/updater.cjs'

function read(relative: string): string {
  return readFileSync(resolve(process.cwd(), relative), 'utf8')
}

let temporal = ''

beforeAll(async () => {
  temporal = await mkdtemp(join(tmpdir(), 'x21-electron-'))
})

afterAll(async () => {
  await rm(temporal, { recursive: true, force: true })
})

describe('módulos de Electron', () => {
  it('mantiene los canales IPC sin cambios', () => {
    const music = read('electron/music.cjs')
    const updater = read('electron/updater.cjs')
    for (const canal of [
      'music:get-folder',
      'music:copy-files',
      'music:move-files',
      'music:save-file',
      'music:trash-files',
      'music:open-folder',
    ]) {
      expect(music).toContain(canal)
    }
    expect(updater).toContain('update:check')
    expect(updater).toContain('update:install')
  })

  it('elige un nombre libre sin sobrescribir la canción existente', async () => {
    const libre = await uniqueDestination(temporal, 'cancion.mp3')
    expect(libre).toContain('cancion.mp3')
    await writeFile(libre, '')
    const segundo = await uniqueDestination(temporal, 'cancion.mp3')
    expect(segundo).not.toBe(libre)
    expect(segundo).toContain('cancion (2).mp3')
  })

  it('usa una clave de un solo uso con el formato esperado', () => {
    expect(makeUpdateKey()).toMatch(/^X21-[0-9A-F]{8}$/)
    expect(makeUpdateKey()).not.toBe(makeUpdateKey())
  })

  it('descarga siempre en %TEMP%, sin carpeta local de actualizaciones', () => {
    const app = { getPath: (name: string) => (name === 'temp' ? 'C:\\Temp' : 'C:\\Users\\alguien') }
    expect(ensureUpdatesDir(app)).toBe('C:\\Temp\\X21 Music Updates')
  })
})
