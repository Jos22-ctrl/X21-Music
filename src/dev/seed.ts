import { DEFAULT_PALETTE } from '../lib/color'
import { saveTracks } from '../lib/db'
import { fallbackWaveform } from '../lib/metadata'
import { registerTrackBlobs } from '../lib/trackUrls'
import type { StoredTrack } from '../types'

/** Solo desarrollo: crea pistas falsas con blobs mínimos para probar listas grandes. */
export async function seedFakeTracks(amount: number): Promise<number> {
  const total = Math.min(10_000, Math.max(0, Math.floor(Number(amount) || 0)))
  if (!total) return 0
  const now = Date.now()
  const records: StoredTrack[] = []
  for (let index = 0; index < total; index += 1) {
    const id = `semilla-${now}-${index}`
    const fileBlob = new Blob([new Uint8Array(64)], { type: 'audio/mpeg' })
    records.push({
      id,
      title: `Canción de prueba ${index + 1}`,
      artist: 'Artista de prueba',
      album: 'Álbum de prueba',
      durationMs: 180_000,
      fileName: `semilla-${index + 1}.mp3`,
      filePath: null,
      contentHash: null,
      mimeType: 'audio/mpeg',
      fileBlob,
      coverBlob: null,
      palette: { ...DEFAULT_PALETTE },
      waveform: fallbackWaveform(id, 80),
      waveformReal: false,
      addedAt: now + index,
    })
    registerTrackBlobs(id, fileBlob, null)
  }
  await saveTracks(records)
  return records.length
}
