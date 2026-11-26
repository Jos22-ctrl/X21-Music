/** Límites para no decodificar audio completo en archivos grandes. */
export const MAX_WAVEFORM_BYTES = 40 * 1024 ** 2
export const MAX_WAVEFORM_DURATION_MS = 12 * 60 * 1000

/** Decodifica solo archivos normales; los demás usan una forma de onda determinista. */
export function shouldDecodeWaveform(sizeBytes: number, durationMs: number): boolean {
  const size = Number.isFinite(sizeBytes) && sizeBytes > 0 ? sizeBytes : 0
  const duration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0
  if (size === 0 || size > MAX_WAVEFORM_BYTES) return false
  return duration === 0 || duration <= MAX_WAVEFORM_DURATION_MS
}
