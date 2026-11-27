import { describe, expect, it } from 'vitest'
import { clampVolume, DEFAULT_SETTINGS, normalizeSettings } from '../src/hooks/player/settings'

describe('ajustes del reproductor', () => {
  it('limita el volumen al rango permitido', () => {
    expect(clampVolume(-1)).toBe(0)
    expect(clampVolume(0.5)).toBe(0.5)
    expect(clampVolume(3)).toBe(1)
    expect(clampVolume(Number.NaN)).toBe(0.8)
  })

  it('rellena los ajustes ausentes con los valores por defecto', () => {
    expect(normalizeSettings()).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({ playbackBarStyle: 'clasico' }).playbackBarStyle).toBe('clasico')
    expect(normalizeSettings({ playbackBarStyle: 'otro' }).playbackBarStyle).toBe('simple')
    expect(normalizeSettings({ reduceMotion: true }).reduceMotion).toBe(true)
  })

  it('acota los segundos de fundido y conserva el layout reparado', () => {
    expect(normalizeSettings({ crossfadeSeconds: 30 }).crossfadeSeconds).toBe(8)
    expect(normalizeSettings({ crossfadeSeconds: -2 }).crossfadeSeconds).toBe(0)
    expect(normalizeSettings({ crossfadeSeconds: Number.NaN }).crossfadeSeconds).toBe(0)
    expect(normalizeSettings({ islandLayout: [] }).islandLayout).toEqual(DEFAULT_SETTINGS.islandLayout)
  })
})
