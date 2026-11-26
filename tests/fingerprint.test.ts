import { describe, expect, it } from 'vitest'
import { fingerprintAsync, isAudioFile, resolveImportIdentity } from '../src/lib/fingerprint'

function makeFile(name: string, bytes: number[], lastModified = 1000): File {
  return new File([new Uint8Array(bytes)], name, { type: 'audio/mpeg', lastModified })
}

describe('huella SHA-256 de importación', () => {
  it('distingue archivos con el mismo nombre pero contenido distinto', async () => {
    const first = await fingerprintAsync(makeFile('cancion.mp3', [1, 2, 3]))
    const second = await fingerprintAsync(makeFile('cancion.mp3', [9, 8, 7]))
    expect(first).toMatch(/^[0-9a-f]{32}$/)
    expect(first).not.toBe(second)
  })

  it('detecta cambios en nombre, tamaño o fecha', async () => {
    const original = await fingerprintAsync(makeFile('a.mp3', [1, 2, 3]))
    expect(await fingerprintAsync(makeFile('b.mp3', [1, 2, 3]))).not.toBe(original)
    expect(await fingerprintAsync(makeFile('a.mp3', [1, 2, 3, 4]))).not.toBe(original)
    expect(await fingerprintAsync(makeFile('a.mp3', [1, 2, 3], 2000))).not.toBe(original)
  })

  it('reconoce duplicados por ID antiguo y por hash', () => {
    const identity = { id: 'nuevo', hash: 'abc123', legacyId: 'antiguo' }
    expect(resolveImportIdentity(identity, [{ id: 'antiguo' }])).toEqual({ status: 'duplicate' })
    expect(
      resolveImportIdentity(identity, [{ id: 'nuevo', contentHash: 'abc123' }]),
    ).toEqual({ status: 'duplicate' })
  })

  it('genera un ID alternativo ante una colisión real', () => {
    const identity = { id: 'nuevo', hash: 'abcdef123456', legacyId: 'antiguo' }
    const result = resolveImportIdentity(identity, [{ id: 'nuevo', contentHash: 'otro' }])
    expect(result.status).toBe('collision')
    expect(result.id).not.toBe('nuevo')
    expect(result.id).toContain('abcdef12')
  })

  it('acepta extensiones de audio sin tipo MIME', () => {
    const file = new File([new Uint8Array([1])], 'pista.flac', { type: '' })
    expect(isAudioFile(file)).toBe(true)
    expect(isAudioFile(new File([new Uint8Array([1])], 'notas.txt', { type: '' }))).toBe(false)
  })
})
