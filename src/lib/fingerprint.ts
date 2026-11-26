/** Huésped histórico de 32 bits, conservado solo para reconocer bibliotecas antiguas. */
export function fingerprint(file: File): string {
  const input = `${file.name}:${file.size}:${file.lastModified}`
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export const legacyFingerprint = fingerprint

const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm|mp4)$/i
const SAMPLE_BYTES = 64 * 1024

export function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || AUDIO_EXTENSIONS.test(file.name)
}

/** SHA-256 del nombre, tamaño, fecha, primeros 64 KB y últimos 64 KB. */
export async function fileHash(file: File): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('SHA-256 no disponible en este entorno.')

  const head = new Uint8Array(await file.slice(0, SAMPLE_BYTES).arrayBuffer())
  const tail = file.size > SAMPLE_BYTES
    ? new Uint8Array(await file.slice(file.size - SAMPLE_BYTES).arrayBuffer())
    : new Uint8Array()
  const prefix = new TextEncoder().encode(`${file.name}:${file.size}:${file.lastModified}:`)
  const input = new Uint8Array(prefix.length + head.length + tail.length)
  input.set(prefix, 0)
  input.set(head, prefix.length)
  input.set(tail, prefix.length + head.length)

  const digest = await subtle.digest('SHA-256', input)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** ID estable de 32 caracteres hexadecimales. */
export async function fingerprintAsync(file: File): Promise<string> {
  return (await fileHash(file)).slice(0, 32)
}

export interface ImportIdentity {
  id: string
  hash: string
  legacyId: string
}

export interface ExistingIdentity {
  id: string
  contentHash?: string | null
}

export type IdentityResolution =
  | { status: 'duplicate' }
  | { status: 'new'; id: string; hash: string }
  | { status: 'collision'; id: string; hash: string }

/**
 * Un ID antiguo equivale al mismo archivo. Si el nuevo ID choca con contenido distinto,
 * se genera uno alternativo en vez de descartar la canción sin avisar.
 */
export function resolveImportIdentity(
  identity: ImportIdentity,
  existing: ExistingIdentity[],
): IdentityResolution {
  if (existing.some((track) => track.id === identity.legacyId)) return { status: 'duplicate' }

  const clash = existing.find((track) => track.id === identity.id)
  if (!clash) return { status: 'new', id: identity.id, hash: identity.hash }
  if (clash.contentHash === identity.hash) return { status: 'duplicate' }

  const suffix = identity.hash.slice(0, 8)
  let candidate = `${identity.id.slice(0, 24)}${suffix}`
  let counter = 1
  while (existing.some((track) => track.id === candidate)) {
    candidate = `${identity.id.slice(0, 23)}${suffix}${counter}`
    counter += 1
  }
  return { status: 'collision', id: candidate, hash: identity.hash }
}
