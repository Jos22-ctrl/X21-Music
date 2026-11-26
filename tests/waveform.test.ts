import { describe, expect, it } from 'vitest'
import {
  MAX_WAVEFORM_BYTES,
  MAX_WAVEFORM_DURATION_MS,
  shouldDecodeWaveform,
} from '../src/lib/waveform'

describe('umbral de decodificación de forma de onda', () => {
  it('decodifica canciones de tamaño y duración normales', () => {
    expect(shouldDecodeWaveform(5 * 1024 ** 2, 3 * 60 * 1000)).toBe(true)
    expect(shouldDecodeWaveform(1024, 0)).toBe(true)
  })

  it('descarta archivos grandes, largos o sin tamaño', () => {
    expect(shouldDecodeWaveform(MAX_WAVEFORM_BYTES + 1, 60_000)).toBe(false)
    expect(shouldDecodeWaveform(1024, MAX_WAVEFORM_DURATION_MS + 1)).toBe(false)
    expect(shouldDecodeWaveform(0, 60_000)).toBe(false)
    expect(shouldDecodeWaveform(Number.NaN, 60_000)).toBe(false)
  })

  it('acepta el límite exacto', () => {
    expect(shouldDecodeWaveform(MAX_WAVEFORM_BYTES, MAX_WAVEFORM_DURATION_MS)).toBe(true)
  })
})
