import { DEFAULT_ISLAND_LAYOUT, normalizeIslandLayout } from '../../lib/islandLayout'
import { clampPersistedVolume } from '../../lib/persistence'
import type { PlaybackSettings } from '../../types'

export const DEFAULT_SETTINGS: PlaybackSettings = {
  crossfadeSeconds: 0,
  skipSilence: true,
  preventDuplicates: true,
  moveOriginals: false,
  monoDark: false,
  marqueeTitles: false,
  islandLayout: DEFAULT_ISLAND_LAYOUT,
  playbackBarStyle: 'simple',
  lowPerformance: false,
}

export const clampVolume = clampPersistedVolume

/** Repara los ajustes guardados antes de aplicarlos al reproductor. */
export function normalizeSettings(value?: Partial<PlaybackSettings>): PlaybackSettings {
  const seconds = Number(value?.crossfadeSeconds ?? 0)
  return {
    crossfadeSeconds: Number.isFinite(seconds) ? Math.min(8, Math.max(0, seconds)) : 0,
    skipSilence: value?.skipSilence ?? DEFAULT_SETTINGS.skipSilence,
    preventDuplicates: value?.preventDuplicates ?? DEFAULT_SETTINGS.preventDuplicates,
    moveOriginals: value?.moveOriginals ?? DEFAULT_SETTINGS.moveOriginals,
    monoDark: value?.monoDark ?? DEFAULT_SETTINGS.monoDark,
    marqueeTitles: value?.marqueeTitles ?? DEFAULT_SETTINGS.marqueeTitles,
    islandLayout: normalizeIslandLayout(value?.islandLayout),
    playbackBarStyle: value?.playbackBarStyle === 'clasico' ? 'clasico' : 'simple',
    lowPerformance: value?.lowPerformance ?? DEFAULT_SETTINGS.lowPerformance,
  }
}
