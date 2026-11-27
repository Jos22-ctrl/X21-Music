/**
 * Object URLs perezosos con tope y revocación.
 * Los blobs se registran al hidratar o importar; las URLs se crean solo cuando
 * la pista suena (audio) o su fila entra en pantalla (portada).
 */

export const MAX_COVER_URLS = 60
export const MAX_AUDIO_URLS = 3

interface CachedUrl {
  url: string
  used: number
}

interface RegisteredBlobs {
  audio: Blob | null
  cover: Blob | null
}

const audioUrls = new Map<string, CachedUrl>()
const coverUrls = new Map<string, CachedUrl>()
const blobs = new Map<string, RegisteredBlobs>()
const listeners = new Set<() => void>()

let clock = 0
let version = 0

let createUrl: (blob: Blob) => string = (blob) => URL.createObjectURL(blob)
let revokeUrl: (url: string) => void = (url) => URL.revokeObjectURL(url)

/** Solo para pruebas: sustituye la creación/revocación de URLs del navegador. */
export function configureUrlFactories(
  create: (blob: Blob) => string,
  revoke: (url: string) => void,
): void {
  createUrl = create
  revokeUrl = revoke
}

function notify(): void {
  version += 1
  listeners.forEach((listener) => listener())
}

export function subscribeUrls(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Instantánea estable para `useSyncExternalStore`. */
export function getUrlVersion(): number {
  return version
}

export function registerTrackBlobs(id: string, audio: Blob | null, cover: Blob | null): void {
  blobs.set(id, { audio, cover })
}

/** Lectura pura: nunca crea URLs durante el render. */
export function getAudioUrl(id: string | undefined): string {
  return id ? (audioUrls.get(id)?.url ?? '') : ''
}

/** Blobs registrados para el cálculo diferido de la forma de onda. */
export function getTrackBlobs(id: string): RegisteredBlobs | undefined {
  return blobs.get(id)
}

/** Lectura pura: nunca crea URLs durante el render. */
export function getCoverUrl(id: string | undefined): string {
  return id ? (coverUrls.get(id)?.url ?? '') : ''
}

function touch(cache: Map<string, CachedUrl>, id: string, url: string): void {
  clock += 1
  cache.set(id, { url, used: clock })
}

function evict(cache: Map<string, CachedUrl>, limit: number): void {
  while (cache.size > limit) {
    let oldest: [string, CachedUrl] | null = null
    for (const entry of cache) {
      if (!oldest || entry[1].used < oldest[1].used) oldest = entry
    }
    if (!oldest) return
    revokeUrl(oldest[1].url)
    cache.delete(oldest[0])
  }
}

export function ensureAudioUrl(id: string | undefined): string {
  if (!id) return ''
  const cached = audioUrls.get(id)
  if (cached) {
    clock += 1
    cached.used = clock
    return cached.url
  }
  const audio = blobs.get(id)?.audio
  if (!audio) return ''
  const url = createUrl(audio)
  touch(audioUrls, id, url)
  evict(audioUrls, MAX_AUDIO_URLS)
  notify()
  return url
}

export function ensureCoverUrl(id: string | undefined): string {
  if (!id) return ''
  const cached = coverUrls.get(id)
  if (cached) {
    clock += 1
    cached.used = clock
    return cached.url
  }
  const cover = blobs.get(id)?.cover
  if (!cover) return ''
  const url = createUrl(cover)
  touch(coverUrls, id, url)
  evict(coverUrls, MAX_COVER_URLS)
  notify()
  return url
}

/** Mantiene solo la pista actual y la siguiente; revoca el resto al fundir. */
export function prepareAudioWindow(currentId: string | undefined, nextId: string | undefined): void {
  const keep = new Set([currentId, nextId].filter(Boolean) as string[])
  let changed = false
  for (const [id, entry] of audioUrls) {
    if (!keep.has(id)) {
      revokeUrl(entry.url)
      audioUrls.delete(id)
      changed = true
    }
  }
  if (changed) notify()
}

export function releaseTrack(id: string): void {
  const audio = audioUrls.get(id)
  const cover = coverUrls.get(id)
  if (audio) revokeUrl(audio.url)
  if (cover) revokeUrl(cover.url)
  audioUrls.delete(id)
  coverUrls.delete(id)
  blobs.delete(id)
  notify()
}

/** Libera todo al desmontar el proveedor o al cerrar la ventana. */
export function clearTrackUrls(): void {
  audioUrls.forEach((entry) => revokeUrl(entry.url))
  coverUrls.forEach((entry) => revokeUrl(entry.url))
  audioUrls.clear()
  coverUrls.clear()
  blobs.clear()
  notify()
}
