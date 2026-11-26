import type { PersistedSettings, RepeatMode } from '../types'

/** Estado completo guardado en IndexedDB, sin la clave de registro. */
export type PersistedSnapshot = Omit<PersistedSettings, 'key'>

export const DEFAULT_PERSISTED_SNAPSHOT: PersistedSnapshot = {
  volume: 0.8,
  isMuted: false,
  repeatMode: 'off',
  isShuffle: false,
  queueIds: [],
  currentTrackId: null,
  currentTime: 0,
}

export function clampPersistedVolume(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : DEFAULT_PERSISTED_SNAPSHOT.volume
}

export function clampPersistedTime(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

export function normalizeRepeatMode(value: unknown): RepeatMode {
  return value === 'all' || value === 'one' ? value : 'off'
}

/** Normaliza lo que se va a guardar; la posición se lee del elemento de audio. */
export function serializePersistedState(input: Partial<PersistedSnapshot>): PersistedSnapshot {
  return {
    volume: clampPersistedVolume(input.volume ?? DEFAULT_PERSISTED_SNAPSHOT.volume),
    isMuted: Boolean(input.isMuted ?? DEFAULT_PERSISTED_SNAPSHOT.isMuted),
    repeatMode: normalizeRepeatMode(input.repeatMode ?? DEFAULT_PERSISTED_SNAPSHOT.repeatMode),
    isShuffle: Boolean(input.isShuffle ?? DEFAULT_PERSISTED_SNAPSHOT.isShuffle),
    queueIds: Array.isArray(input.queueIds)
      ? input.queueIds.filter((id): id is string => typeof id === 'string')
      : [],
    currentTrackId:
      typeof input.currentTrackId === 'string' ? input.currentTrackId : null,
    currentTime: clampPersistedTime(input.currentTime),
    preferences:
      input.preferences && typeof input.preferences === 'object' ? input.preferences : undefined,
  }
}

/** `currentTime` queda fuera: `timeupdate` no debe provocar un guardado completo. */
export const FULL_STATE_FIELDS = [
  'volume',
  'isMuted',
  'repeatMode',
  'isShuffle',
  'queueIds',
  'currentTrackId',
  'preferences',
] as const

export function shouldPersist(previous: PersistedSnapshot, next: PersistedSnapshot): boolean {
  return FULL_STATE_FIELDS.some((field) => !Object.is(previous[field], next[field]))
}
