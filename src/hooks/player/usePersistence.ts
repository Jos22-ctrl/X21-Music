import { useEffect } from 'react'
import type { MutableRefObject } from 'react'
import { savePlaybackPosition } from '../../lib/db'
import { shouldPersist, type PersistedSnapshot } from '../../lib/persistence'
import type { PlaybackSettings, Track } from '../../types'

interface PersistenceDeps {
  isHydrated: boolean
  isPlaying: boolean
  currentId: string | null
  isMuted: boolean
  isShuffle: boolean
  queueIds: string[]
  repeatMode: string
  settings: PlaybackSettings
  volume: number
  currentTrack: Track | null
  lastPersistedRef: MutableRefObject<PersistedSnapshot | null>
  actionsRef: MutableRefObject<{ togglePlay: () => void; next: () => void; prev: () => void }>
  persistSnapshot: () => PersistedSnapshot
  saveNow: (overrides?: Partial<PersistedSnapshot>) => void
  readPosition: () => number
}

/** Guardado con debounce, posición periódica y controles multimedia del sistema. */
export function usePersistence(deps: PersistenceDeps) {
  const {
    isHydrated,
    isPlaying,
    currentId,
    isMuted,
    isShuffle,
    queueIds,
    repeatMode,
    settings,
    volume,
    currentTrack,
    lastPersistedRef,
    actionsRef,
    persistSnapshot,
    saveNow,
    readPosition,
  } = deps

  // El estado completo se guarda con debounce; currentTime NO entra en las dependencias.
  useEffect(() => {
    if (!isHydrated) return
    const next = persistSnapshot()
    if (lastPersistedRef.current && !shouldPersist(lastPersistedRef.current, next)) return
    const timer = window.setTimeout(() => saveNow(), 500)
    return () => window.clearTimeout(timer)
  }, [
    currentId,
    isHydrated,
    isMuted,
    isShuffle,
    lastPersistedRef,
    persistSnapshot,
    queueIds,
    repeatMode,
    saveNow,
    settings,
    volume,
  ])

  // Mientras suena, solo se actualiza la posición cada 5 s.
  useEffect(() => {
    if (!isHydrated || !isPlaying) return
    const timer = window.setInterval(() => {
      void savePlaybackPosition(readPosition())
    }, 5000)
    return () => window.clearInterval(timer)
  }, [isHydrated, isPlaying, readPosition])

  useEffect(() => {
    if (!isHydrated) return
    // REQUIERE PRUEBA MANUAL EN WINDOWS: el cierre real puede cancelar escrituras de IndexedDB.
    const flush = (): void => saveNow()
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', flush)
    }
  }, [isHydrated, saveNow])

  // --- Controles multimedia del sistema -----------------------------------
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack?.title ?? 'X21 Music',
      artist: currentTrack?.artist ?? '',
      album: currentTrack?.album ?? '',
      artwork: currentTrack?.coverUrl
        ? [{ src: currentTrack.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    })
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => actionsRef.current.togglePlay()],
      ['pause', () => actionsRef.current.togglePlay()],
      ['nexttrack', () => actionsRef.current.next()],
      ['previoustrack', () => actionsRef.current.prev()],
    ]
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        // Acción no soportada por el sistema.
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null)
        } catch {
          // Ignorado.
        }
      }
    }
  }, [actionsRef, currentTrack?.album, currentTrack?.artist, currentTrack?.coverUrl, currentTrack?.title])
}
