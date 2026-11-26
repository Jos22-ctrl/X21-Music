import { describe, expect, it } from 'vitest'
import {
  isNewerVersion,
  normalizeUpdateInfo,
  safeDownloadUrl,
  safeInstallerName,
} from '../electron/update.cjs'

describe('actualizaciones', () => {
  it('compara versiones con prefijo y sufijo', () => {
    expect(isNewerVersion('0.9.7', '0.9.6')).toBe(true)
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true)
    expect(isNewerVersion('v0.9.6+build.2', '0.9.6')).toBe(true)
    expect(isNewerVersion('0.9.6', '0.9.6')).toBe(false)
    expect(isNewerVersion('0.9.5', '0.9.6')).toBe(false)
  })

  it('acepta solo nombres de instalador seguros', () => {
    expect(safeInstallerName('X21 Music Setup 0.9.7.exe')).toBe('X21 Music Setup 0.9.7.exe')
    expect(safeInstallerName('C:\\Users\\alguien\\mal.exe')).toBe('mal.exe')
    expect(safeInstallerName('')).toBe('')
    expect(safeInstallerName('update.json')).toBe('')
  })

  it('normaliza update.json y descarta datos incompletos', () => {
    expect(
      normalizeUpdateInfo(
        { version: '0.9.7', installer: 'X21 Music Setup 0.9.7.exe', notes: 'Mejoras' },
        '0.9.6',
      ),
    ).toEqual({
      available: true,
      currentVersion: '0.9.6',
      version: '0.9.7',
      installer: 'X21 Music Setup 0.9.7.exe',
      notes: 'Mejoras',
      installerUrl: '',
      releaseUrl: '',
      source: 'local',
    })

    expect(normalizeUpdateInfo({ version: '0.9.6', installer: 'x.exe' }, '0.9.6').available).toBe(
      false,
    )
    expect(normalizeUpdateInfo({ version: '0.9.7' }, '0.9.6').available).toBe(false)
    expect(normalizeUpdateInfo(null, '0.9.6').available).toBe(false)
  })

  it('acepta releases de GitHub solo con URL de descarga de GitHub', () => {
    const url = 'https://github.com/Jos22-ctrl/X21-Music/releases/download/v0.9.7/setup.exe'
    expect(safeDownloadUrl(url)).toBe(url)
    expect(safeDownloadUrl('https://ejemplo.com/setup.exe')).toBe('')

    const info = normalizeUpdateInfo(
      {
        version: 'v0.9.7',
        installer: 'setup.exe',
        installerUrl: url,
        releaseUrl: 'https://github.com/Jos22-ctrl/X21-Music/releases/tag/v0.9.7',
        notes: 'Release',
      },
      '0.9.6',
      'github',
    )
    expect(info.available).toBe(true)
    expect(info.source).toBe('github')
    expect(info.installerUrl).toBe(url)

    expect(
      normalizeUpdateInfo(
        { version: '0.9.7', installer: 'setup.exe' },
        '0.9.6',
        'github',
      ).available,
    ).toBe(false)
  })
})
