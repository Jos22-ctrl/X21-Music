import type { RepeatMode } from '../types'

export interface QueueContext {
  queueIds: string[]
  currentId: string | null
  repeatMode: RepeatMode
  isShuffle: boolean
  /** Inyectable para que la elección aleatoria sea determinista en las pruebas. */
  random?: () => number
}

/** Siguiente pista candidata; null significa que no hay fundido automático. */
export function nextTrackId({
  queueIds,
  currentId,
  repeatMode,
  isShuffle,
  random = Math.random,
}: QueueContext): string | null {
  if (!queueIds.length || repeatMode === 'one') return null
  const index = queueIds.indexOf(currentId ?? '')
  if (isShuffle && queueIds.length > 1) {
    let target = Math.floor(random() * queueIds.length)
    if (target === index) target = (target + 1) % queueIds.length
    return queueIds[target] ?? null
  }
  if (!isShuffle && repeatMode === 'off' && index === queueIds.length - 1) return null
  return queueIds[(index + 1) % queueIds.length] ?? null
}

export interface CrossfadeTiming {
  currentTime: number
  durationSeconds: number
  crossfadeSeconds: number
  nextId: string | null
}

/** Empieza el fundido cuando falta como máximo `crossfadeSeconds` para terminar. */
export function shouldStartCrossfade({
  currentTime,
  durationSeconds,
  crossfadeSeconds,
  nextId,
}: CrossfadeTiming): boolean {
  if (!nextId || crossfadeSeconds <= 0 || durationSeconds <= 0) return false
  const remaining = durationSeconds - currentTime
  return remaining > 0 && remaining <= Math.min(crossfadeSeconds, durationSeconds)
}

/** Fundido de potencia constante sobre una curva de volumen ya cuadrática. */
export function crossfadeGain(progress: number): { from: number; to: number } {
  const t = Math.min(1, Math.max(0, progress))
  return { from: Math.cos((t * Math.PI) / 2), to: Math.sin((t * Math.PI) / 2) }
}
