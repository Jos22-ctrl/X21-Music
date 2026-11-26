/** Límites de trabajo para mantener la interfaz fluida con bibliotecas grandes. */
export const PAGE_SIZE_NORMAL = 50
export const PAGE_SIZE_LOW = 20
export const MAX_WAVE_BARS = 96
export const MAX_WAVE_BARS_LOW = 24

export function pageSizeFor(lowPerformance: boolean): number {
  return lowPerformance ? PAGE_SIZE_LOW : PAGE_SIZE_NORMAL
}

/** Reduce una forma de onda larga promediando bloques, sin perder el perfil general. */
export function downsample(values: number[], maxBars: number): number[] {
  if (maxBars <= 0 || values.length <= maxBars) return values
  const result: number[] = []
  const step = values.length / maxBars
  for (let index = 0; index < maxBars; index += 1) {
    const start = Math.floor(index * step)
    const end = Math.max(start + 1, Math.floor((index + 1) * step))
    let sum = 0
    for (let position = start; position < end; position += 1) sum += values[position] ?? 0
    result.push(sum / (end - start))
  }
  return result
}
