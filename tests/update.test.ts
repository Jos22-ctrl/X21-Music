import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  detectObsoleteRelease,
  findReleaseMark,
  isNewerVersion,
  normalizeGitHubRelease,
  parseChecksumFile,
  parseVersion,
  releaseLetter,
  safeChecksumUrl,
  safeDownloadUrl,
  safeInstallerName,
} from '../electron/update.cjs'
import { checkGitHubUpdates } from '../electron/updater.cjs'

const HASH = 'a'.repeat(64)
const url = 'https://github.com/Jos22-ctrl/X21-Music/releases/download/v0.9.7/setup.exe'
const checksumUrl = `${url}.sha256`

afterEach(() => {
  vi.unstubAllGlobals()
})

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

  it('tolera sufijos con letra y guion sin comparar la letra', () => {
    expect(parseVersion('v1.0.0A')).toEqual([1, 0, 0])
    expect(parseVersion('1.0.0-A')).toEqual([1, 0, 0])
    expect(parseVersion('1.0.0+build.2')).toEqual([1, 0, 0, 2])
    expect(isNewerVersion('v1.0.0A', '0.9.9')).toBe(true)
    expect(isNewerVersion('v1.0.0A', '1.0.0')).toBe(false)
    expect(isNewerVersion('1.0.0-A', '1.0.0')).toBe(false)
    expect(releaseLetter('v1.0.0A')).toBe('A')
    expect(releaseLetter('1.0.0-M')).toBe('M')
    expect(releaseLetter('v1.0.0')).toBe('')
    expect(findReleaseMark('Alpha 1.0.0F — versión obsoleta')).toEqual({
      version: '1.0.0',
      letter: 'F',
    })
  })

  it('detecta la letra F en la lista de releases sin exigirla en la etiqueta', () => {
    const releases = [
      { tag_name: 'v1.0.1', name: 'Alpha 1.0.1A — nueva versión', html_url: 'https://github.com/x' },
      {
        tag_name: 'v1.0.0',
        name: 'Alpha 1.0.0F — versión obsoleta',
        html_url: 'https://github.com/Jos22-ctrl/X21-Music/releases/tag/v1.0.0',
      },
    ]
    expect(detectObsoleteRelease(releases)).toEqual({
      version: '1.0.0',
      letter: 'F',
      url: 'https://github.com/Jos22-ctrl/X21-Music/releases/tag/v1.0.0',
    })
    expect(detectObsoleteRelease([releases[0]])).toBeNull()
    expect(detectObsoleteRelease(null)).toBeNull()
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

describe('fallos de red al buscar actualizaciones', () => {
  it('indica que ya está al día cuando GitHub responde con la versión instalada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => release({ tag_name: 'v0.9.13' }) })),
    )
    const info = await checkGitHubUpdates('0.9.13')
    expect(info.available).toBe(false)
    expect(info.error).toBeUndefined()
    expect(info.message).toBe('Ya tienes la última versión publicada en GitHub.')
  })

  it('muestra el estado HTTP cuando GitHub responde con error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })))
    const info = await checkGitHubUpdates('0.9.12')
    expect(info.error).toBe('GitHub respondió 403.')
  })

  it('muestra el motivo de un fallo de red sin ocultarlo', async () => {
    const fallo = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw fallo
      }),
    )
    const info = await checkGitHubUpdates('0.9.12')
    expect(info.error).toContain('ENOTFOUND')
    expect(info.error).toContain('Revisa la conexión, el firewall o el proxy.')
  })

  it('avisa cuando GitHub devuelve una respuesta que no es JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new Error('<html>')
        },
      })),
    )
    const info = await checkGitHubUpdates('0.9.12')
    expect(info.error).toBe('GitHub devolvió una respuesta inesperada.')
  })

  it('muestra una F detectada sin impedir la actualización', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => release({ tag_name: 'v1.0.1' }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              tag_name: 'v1.0.0',
              name: 'Alpha 1.0.0F — versión obsoleta',
              html_url: 'https://github.com/Jos22-ctrl/X21-Music/releases/tag/v1.0.0',
            },
          ],
        }),
    )
    const info = await checkGitHubUpdates('1.0.0')
    expect(info.available).toBe(true)
    expect(info.obsoleteRelease).toEqual({
      version: '1.0.0',
      letter: 'F',
      url: 'https://github.com/Jos22-ctrl/X21-Music/releases/tag/v1.0.0',
    })
  })

  it('ignora un fallo al buscar la marca F', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => release({ tag_name: 'v1.0.1' }) })
        .mockResolvedValueOnce({ ok: false, status: 500 }),
    )
    const info = await checkGitHubUpdates('1.0.0')
    expect(info.available).toBe(true)
    expect(info.error).toBeUndefined()
    expect(info.obsoleteRelease).toBeUndefined()
  })
})
