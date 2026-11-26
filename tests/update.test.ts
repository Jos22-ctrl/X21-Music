import { describe, expect, it } from 'vitest'
import {
  isNewerVersion,
  normalizeGitHubRelease,
  parseChecksumFile,
  safeChecksumUrl,
  safeDownloadUrl,
  safeInstallerName,
} from '../electron/update.cjs'

const HASH = 'a'.repeat(64)
const url = 'https://github.com/Jos22-ctrl/X21-Music/releases/download/v0.9.7/setup.exe'
const checksumUrl = `${url}.sha256`

function release(overrides: Record<string, unknown> = {}) {
  return {
    tag_name: 'v0.9.7',
    html_url: 'https://github.com/Jos22-ctrl/X21-Music/releases/tag/v0.9.7',
    body: 'Release',
    assets: [
      { name: 'setup.exe', browser_download_url: url },
      { name: 'setup.exe.sha256', browser_download_url: checksumUrl },
    ],
    ...overrides,
  }
}

describe('actualizaciones desde GitHub', () => {
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

  it('acepta releases de GitHub solo con URL de descarga de GitHub', () => {
    expect(safeDownloadUrl(url)).toBe(url)
    expect(safeDownloadUrl('https://ejemplo.com/setup.exe')).toBe('')
    expect(safeChecksumUrl(checksumUrl)).toBe(checksumUrl)
    expect(safeChecksumUrl(url)).toBe('')

    const info = normalizeGitHubRelease(release(), '0.9.6')
    expect(info.available).toBe(true)
    expect(info.source).toBe('github')
    expect(info.installer).toBe('setup.exe')
    expect(info.installerUrl).toBe(url)
    expect(info.checksumUrl).toBe(checksumUrl)
    expect(info.releaseUrl).toBe('https://github.com/Jos22-ctrl/X21-Music/releases/tag/v0.9.7')
  })

  it('descarta un release sin .sha256 o sin una versión mayor', () => {
    const sinSuma = release({
      assets: [{ name: 'setup.exe', browser_download_url: url }],
    })
    expect(normalizeGitHubRelease(sinSuma, '0.9.6').available).toBe(false)
    expect(normalizeGitHubRelease(release(), '0.9.7').available).toBe(false)
    expect(normalizeGitHubRelease(null, '0.9.6').available).toBe(false)
  })

  it('descarta URLs de descarga que no sean de GitHub', () => {
    const otroDominio = release({
      assets: [
        { name: 'setup.exe', browser_download_url: 'https://ejemplo.com/setup.exe' },
        { name: 'setup.exe.sha256', browser_download_url: 'https://ejemplo.com/setup.exe.sha256' },
      ],
    })
    expect(normalizeGitHubRelease(otroDominio, '0.9.6').available).toBe(false)
  })

  it('lee el SHA-256 del archivo de suma y rechaza nombres distintos', () => {
    expect(parseChecksumFile(`${HASH}  setup.exe\n`, 'setup.exe')).toBe(HASH)
    expect(parseChecksumFile(HASH, 'setup.exe')).toBe(HASH)
    expect(parseChecksumFile(`${HASH}  otro.exe`, 'setup.exe')).toBe('')
    expect(parseChecksumFile('no es un hash', 'setup.exe')).toBe('')
  })
})
