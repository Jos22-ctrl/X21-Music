import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_COVER_URLS,
  clearTrackUrls,
  configureUrlFactories,
  ensureAudioUrl,
  ensureCoverUrl,
  getCoverUrl,
  prepareAudioWindow,
  registerTrackBlobs,
  releaseTrack,
} from '../src/lib/trackUrls'

let created: string[]
let revoked: string[]

beforeEach(() => {
  clearTrackUrls()
  created = []
  revoked = []
  configureUrlFactories(
    () => {
      const url = `blob:${created.length}`
      created.push(url)
      return url
    },
    (url) => revoked.push(url),
  )
})

describe('caché de object URLs', () => {
  it('crea una portada por pista y revoca la más antigua al pasar de 60', () => {
    for (let index = 0; index <= MAX_COVER_URLS; index += 1) {
      registerTrackBlobs(`c${index}`, null, new Blob(['portada']))
      ensureCoverUrl(`c${index}`)
    }
    expect(created).toHaveLength(MAX_COVER_URLS + 1)
    expect(revoked).toEqual(['blob:0'])
    expect(getCoverUrl('c0')).toBe('')
    expect(getCoverUrl(`c${MAX_COVER_URLS}`)).toBe(`blob:${MAX_COVER_URLS}`)
  })

  it('reutiliza la URL existente sin crear otra', () => {
    registerTrackBlobs('unica', null, new Blob(['portada']))
    expect(ensureCoverUrl('unica')).toBe(ensureCoverUrl('unica'))
    expect(created).toHaveLength(1)
  })

  it('deja solo la pista actual y la siguiente en la ventana de audio', () => {
    for (const id of ['a', 'b', 'c']) {
      registerTrackBlobs(id, new Blob(['audio']), null)
      ensureAudioUrl(id)
    }
    prepareAudioWindow('b', 'c')
    expect(revoked).toContain('blob:0')
    expect(ensureAudioUrl('b')).toBe('blob:1')
    expect(ensureAudioUrl('c')).toBe('blob:2')
  })

  it('libera las URLs de una pista al eliminarla', () => {
    registerTrackBlobs('borrar', new Blob(['audio']), new Blob(['portada']))
    ensureAudioUrl('borrar')
    ensureCoverUrl('borrar')
    releaseTrack('borrar')
    expect(revoked).toContain('blob:0')
    expect(revoked).toContain('blob:1')
    expect(getCoverUrl('borrar')).toBe('')
  })
})
