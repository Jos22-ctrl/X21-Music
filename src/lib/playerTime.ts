/** Estado de tiempo compartido solo con las islas que lo necesitan. */
export interface PlayerTime {
  currentTime: number
  duration: number
  progress: number
}

/** Progreso 0–1, a prueba de duraciones ausentes o tiempos negativos. */
export function computeProgress(currentTime: number, duration: number): number {
  const time = Number.isFinite(currentTime) && currentTime > 0 ? currentTime : 0
  const total = Number.isFinite(duration) && duration > 0 ? duration : 0
  return total > 0 ? Math.min(1, time / total) : 0
}
