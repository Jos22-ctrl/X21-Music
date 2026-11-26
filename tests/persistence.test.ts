import { describe, expect, it } from 'vitest'
import {
  clampPersistedTime,
  serializePersistedState,
  shouldPersist,
  type PersistedSnapshot,
} from '../src/lib/persistence'

const base: PersistedSnapshot = {
  volume: 0.8,
  isMuted: false,
  repeatMode: 'off',
  isShuffle: false,
  queueIds: ['a', 'b'],
  currentTrackId: 'a',
  currentTime: 12,
}

describe('persistencia del reproductor', () => {
  it('no guarda el estado completo solo por cambiar la posición', () => {
    expect(shouldPersist(base, { ...base, currentTime: 99 })).toBe(false)
    expect(shouldPersist(base, { ...base, volume: 0.4 })).toBe(true)
    expect(shouldPersist(base, { ...base, queueIds: ['b', 'a'] })).toBe(true)
  })

  it('serializa y normaliza la posición leída del audio', () => {
    expect(serializePersistedState({ ...base, currentTime: -5 }).currentTime).toBe(0)
    expect(clampPersistedTime(Number.NaN)).toBe(0)
    expect(clampPersistedTime(42.5)).toBe(42.5)
  })

  it('conserva las preferencias y descarta colas mal formadas', () => {
    const preferences = { crossfadeSeconds: 3 }
    const result = serializePersistedState({ ...base, queueIds: ['a', 2 as never], preferences })
    expect(result.queueIds).toEqual(['a'])
    expect(result.preferences).toBe(preferences)
  })
})
