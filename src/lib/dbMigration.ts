import type { StoredTrack } from '../types'

/** Añade el hash sin perder ningún campo de los registros de la v1. */
export function migrateTrackRecord(record: unknown): StoredTrack {
  const track = record as StoredTrack
  return track && typeof track === 'object' && !('contentHash' in track)
    ? { ...track, contentHash: null }
    : track
}

/** Devuelve true cuando la v1 necesita migración a la v2. */
export function needsTrackMigration(records: unknown[]): boolean {
  return records.some(
    (record) =>
      Boolean(record) &&
      typeof record === 'object' &&
      !('contentHash' in (record as Record<string, unknown>)),
  )
}
