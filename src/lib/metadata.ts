import { parseBlob } from 'music-metadata'
import { cleanFileName } from './format'

export interface AudioMetadata {
  title: string
  artist: string
  album: string
  durationMs: number
  coverBlob: Blob | null
}

function pictureToBlob(picture: { data: Uint8Array; format: string } | undefined): Blob | null {
  if (!picture) return null
  try {
    const bytes = new Uint8Array(picture.data)
    return new Blob([bytes.buffer as ArrayBuffer], {
      type: picture.format || 'image/jpeg',
    })
  } catch {
    return null
  }
}

/** Lee ID3/Vorbis desde el propio archivo, sin red ni servicios externos. */
export async function readAudioMetadata(file: File): Promise<AudioMetadata> {
  const fallback: AudioMetadata = {
    title: cleanFileName(file.name),
    artist: 'Artista desconocido',
    album: 'Álbum desconocido',
    durationMs: 0,
    coverBlob: null,
  }

  try {
    const metadata = await parseBlob(file)
    return {
      title: metadata.common.title?.trim() || fallback.title,
      artist: metadata.common.artist?.trim() || fallback.artist,
      album: metadata.common.album?.trim() || fallback.album,
      durationMs: Math.round((metadata.format.duration ?? 0) * 1000),
      coverBlob: pictureToBlob(metadata.common.picture?.[0]),
    }
  } catch {
    return fallback
  }
}

export function fallbackWaveform(seed: string, buckets = 80): number[] {
  let state = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    state = Math.imul(state ^ seed.charCodeAt(i), 0x01000193) >>> 0
  }
  return Array.from({ length: buckets }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return 0.14 + ((state >>> 24) / 255) * 0.86
  })
}

/** Picos RMS reales decodificados localmente; si falla, barras deterministas. */
export async function computeWaveform(file: File, buckets = 80): Promise<number[]> {
  try {
    const ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!ctor) return fallbackWaveform(file.name, buckets)

    const context = new ctor()
    try {
      const buffer = await context.decodeAudioData(await file.arrayBuffer())
      const data = buffer.getChannelData(0)
      const size = Math.max(1, Math.floor(data.length / buckets))
      const peaks: number[] = []
      for (let i = 0; i < buckets; i++) {
        let sum = 0
        const start = i * size
        for (let j = 0; j < size && start + j < data.length; j++) {
          sum += data[start + j] * data[start + j]
        }
        peaks.push(Math.sqrt(sum / size))
      }
      const max = Math.max(...peaks, 0.00001)
      return peaks.map((peak) => Math.min(1, Math.max(0.08, peak / max)))
    } finally {
      await context.close().catch(() => undefined)
    }
  } catch {
    return fallbackWaveform(file.name, buckets)
  }
}
