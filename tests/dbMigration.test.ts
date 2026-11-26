import { describe, expect, it } from 'vitest'
import { migrateTrackRecord, needsTrackMigration } from '../src/lib/dbMigration'

const oldRecord = { id: 'a', title: 'Canción', addedAt: 1, waveform: [1, 2] }

describe('migración IndexedDB v1 → v2', () => {
  it('añade contentHash sin perder los campos anteriores', () => {
    const migrated = migrateTrackRecord(oldRecord)
    expect(migrated.id).toBe('a')
    expect(migrated.waveform).toEqual([1, 2])
    expect(migrated.contentHash).toBeNull()
  })

  it('respeta registros ya migrados', () => {
    const current = { ...oldRecord, contentHash: 'abc' }
    expect(migrateTrackRecord(current)).toEqual(current)
    expect(needsTrackMigration([current])).toBe(false)
    expect(needsTrackMigration([oldRecord])).toBe(true)
  })
})
