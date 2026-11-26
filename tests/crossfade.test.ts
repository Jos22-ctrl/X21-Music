import { describe, expect, it } from 'vitest'
import { crossfadeGain, nextTrackId, shouldStartCrossfade } from '../src/lib/crossfade'

const base = {
  queueIds: ['a', 'b', 'c'],
  currentId: 'b',
}

describe('crossfade', () => {
  it('detiene el avance automático al final de la cola con repetición apagada', () => {
    expect(nextTrackId({ ...base, currentId: 'c', repeatMode: 'off', isShuffle: false })).toBeNull()
    expect(nextTrackId({ ...base, currentId: 'c', repeatMode: 'all', isShuffle: false })).toBe('a')
  })

  it('no genera un fundido con repetición de una sola pista', () => {
    expect(nextTrackId({ ...base, repeatMode: 'one', isShuffle: false })).toBeNull()
  })

  it('busca otra pista distinta con aleatorio', () => {
    const picked = nextTrackId({
      ...base,
      repeatMode: 'off',
      isShuffle: true,
      random: () => 0.5,
    })
    expect(picked).not.toBe('b')
    expect(base.queueIds).toContain(picked)
  })

  it('empieza solo dentro de la ventana de fundido', () => {
    const timing = {
      currentTime: 96,
      durationSeconds: 100,
      crossfadeSeconds: 4,
      nextId: 'c',
    }
    expect(shouldStartCrossfade(timing)).toBe(true)
    expect(shouldStartCrossfade({ ...timing, currentTime: 90 })).toBe(false)
    expect(shouldStartCrossfade({ ...timing, nextId: null })).toBe(false)
    expect(shouldStartCrossfade({ ...timing, crossfadeSeconds: 0 })).toBe(false)
  })

  it('admite pistas más cortas que el fundido', () => {
    expect(
      shouldStartCrossfade({
        currentTime: 0,
        durationSeconds: 2,
        crossfadeSeconds: 5,
        nextId: 'c',
      }),
    ).toBe(true)
  })

  it('mantiene la suma de ganancias en potencia constante', () => {
    const start = crossfadeGain(0)
    const half = crossfadeGain(0.5)
    const end = crossfadeGain(1)
    expect(start.to).toBeCloseTo(0, 5)
    expect(end.from).toBeCloseTo(0, 5)
    expect(half.from ** 2 + half.to ** 2).toBeCloseTo(1, 5)
  })
})
