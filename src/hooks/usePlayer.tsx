import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { crossfadeGain, nextTrackId, shouldStartCrossfade } from '../lib/crossfade'
import { DEFAULT_PALETTE, type Palette } from '../lib/color'
import { savePlaybackPosition, saveSettings } from '../lib/db'
import { computeProgress, type PlayerTime } from '../lib/playerTime'
import {
  clampPersistedTime,
  serializePersistedState,
  shouldPersist,
  type PersistedSnapshot,
} from '../lib/persistence'
import { clampVolume, DEFAULT_SETTINGS, normalizeSettings } from './player/settings'
import { useLibrary } from './player/useLibrary'
import { useSleepTimer } from './player/useSleepTimer'
import type { PlaybackSettings, RepeatMode, Track } from '../types'

export interface PlayerContextValue {
  tracks: Track[]
  queue: Track[]
  currentTrack: Track | null
  palette: Palette
  isPlaying: boolean
  volume: number
  isMuted: boolean
  repeatMode: RepeatMode
  isShuffle: boolean
  isImporting: boolean
  importProgress: { current: number; total: number } | null
  settings: PlaybackSettings
  /** Carpeta local donde se guardan/mueven los archivos de música. */
  musicFolder: string | null
  sleepMinutes: number | null
  sleepRemaining: number | null
  error: string | null
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  seekRatio: (ratio: number) => void
  setVolume: (value: number) => void
  toggleMute: () => void
  next: () => void
  prev: () => void
  jumpBy: (offset: number) => void
  playTrack: (id: string) => void
  enqueue: (id: string) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  updateSettings: (patch: Partial<PlaybackSettings>) => void
  openMusicFolder: () => Promise<void>
  copyLibraryToFolder: () => Promise<number>
  setSleepTimer: (minutes: number | null) => void
  importFiles: (files: File[]) => Promise<void>
  removeTrack: (id: string) => Promise<void>
  clearError: () => void
}

const PlayerContext = createContext<PlayerContextValue | null>(null)
/** Tiempo aislado: `timeupdate` no debe repintar todas las islas. */
export const PlayerTimeContext = createContext<PlayerTime | null>(null)

const GAP_MS = 400

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [queueIds, setQueueIds] = useState<string[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off')
  const [isShuffle, setIsShuffle] = useState(false)
  const [settings, setSettings] = useState<PlaybackSettings>(DEFAULT_SETTINGS)
  const [musicFolder, setMusicFolder] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  // Dos elementos A/B permiten solapar la pista saliente y la entrante.
  const slotsRef = useRef<{ a: HTMLAudioElement | null; b: HTMLAudioElement | null }>({
    a: null,
    b: null,
  })
  const activeSlotRef = useRef<'a' | 'b'>('a')
  const crossfadeRef = useRef<{
    fromSlot: 'a' | 'b'
    raf: number | null
    startedAt: number
    durationMs: number
    fromVolume: number
  } | null>(null)
  const autoFadeRef = useRef<string | null>(null)
  const autoFadeCheckRef = useRef<() => void>(() => undefined)
  const urlsRef = useRef<string[]>([])
  const settingsRef = useRef(settings)
  const latestRef = useRef({ tracks, currentId, queueIds, repeatMode, isShuffle, isPlaying })
  const advanceRef = useRef<() => void>(() => undefined)
  const actionsRef = useRef<{ togglePlay: () => void; next: () => void; prev: () => void }>({
    togglePlay: () => undefined,
    next: () => undefined,
    prev: () => undefined,
  })
  const targetVolumeRef = useRef(clampVolume(0.8) ** 2)
  const pendingRef = useRef<number | null>(null)
  const positionRef = useRef(0)
  const restoredTimeRef = useRef<number | null>(null)
  const hydratedRef = useRef(false)
  const persistStateRef = useRef<PersistedSnapshot>({
    volume,
    isMuted,
    repeatMode,
    isShuffle,
    queueIds,
    currentTrackId: currentId,
    currentTime: 0,
    preferences: settings,
  })
  const lastPersistedRef = useRef<PersistedSnapshot | null>(null)

  settingsRef.current = settings
  latestRef.current = { tracks, currentId, queueIds, repeatMode, isShuffle, isPlaying }
  hydratedRef.current = isHydrated
  persistStateRef.current = {
    volume,
    isMuted,
    repeatMode,
    isShuffle,
    queueIds,
    currentTrackId: currentId,
    currentTime: positionRef.current,
    preferences: settings,
  }

  const currentTrack = tracks.find((track) => track.id === currentId) ?? null
  const queue = queueIds
    .map((id) => tracks.find((track) => track.id === id))
    .filter((track): track is Track => Boolean(track))
  const durationSeconds = duration || (currentTrack?.durationMs ?? 0) / 1000
  const progress = computeProgress(currentTime, durationSeconds)
  const palette = currentTrack?.palette ?? DEFAULT_PALETTE

  const activeAudio = useCallback(() => slotsRef.current[activeSlotRef.current], [])
  const idleSlot = useCallback((): 'a' | 'b' => (activeSlotRef.current === 'a' ? 'b' : 'a'), [])

  /** Cierra un fundido: calla la pista saliente y deja la activa a su volumen normal. */
  const finishCrossfade = useCallback((restoreVolume = true): void => {
    const fade = crossfadeRef.current
    if (!fade) return
    if (fade.raf !== null) cancelAnimationFrame(fade.raf)
    crossfadeRef.current = null
    const outgoing = slotsRef.current[fade.fromSlot]
    if (outgoing) {
      outgoing.pause()
      outgoing.removeAttribute('src')
      outgoing.volume = 0
    }
    const active = slotsRef.current[activeSlotRef.current]
    if (active && restoreVolume) active.volume = targetVolumeRef.current
  }, [])

  const clearPending = useCallback((): void => {
    if (pendingRef.current !== null) window.clearTimeout(pendingRef.current)
    pendingRef.current = null
  }, [])

  /** Lee la posición real del audio en el instante del guardado. */
  const readPosition = useCallback((): number => {
    const value = activeAudio()?.currentTime ?? positionRef.current
    return clampPersistedTime(value)
  }, [activeAudio])

  const persistSnapshot = useCallback(
    (overrides: Partial<PersistedSnapshot> = {}): PersistedSnapshot =>
      serializePersistedState({
        ...persistStateRef.current,
        currentTime: restoredTimeRef.current ?? readPosition(),
        ...overrides,
      }),
    [readPosition],
  )

  const saveNow = useCallback(
    (overrides: Partial<PersistedSnapshot> = {}): void => {
      if (!hydratedRef.current) return
      const data = persistSnapshot(overrides)
      lastPersistedRef.current = data
      void saveSettings(data)
    },
    [persistSnapshot],
  )

  /** Arranca la entrante en el elemento libre y funde A/B con potencia constante. */
  // REQUIERE PRUEBA MANUAL EN WINDOWS: comprobar el solape con canciones reales.
  const crossfadeTo = useCallback(
    (track: Track, seconds: number): void => {
      const from = activeAudio()
      const fromSlot = activeSlotRef.current
      const toSlot = idleSlot()
      const incoming = slotsRef.current[toSlot]
      finishCrossfade(false)
      clearPending()
      if (!from || !incoming) return

      incoming.pause()
      incoming.src = track.audioUrl
      incoming.load()
      incoming.currentTime = 0
      incoming.volume = 0

      // La interfaz pasa a reflejar la pista entrante desde el primer momento.
      activeSlotRef.current = toSlot
      autoFadeRef.current = track.id
      restoredTimeRef.current = null
      positionRef.current = 0
      saveNow({ currentTrackId: track.id, currentTime: 0 })
      setCurrentId(track.id)
      setCurrentTime(0)
      setDuration(track.durationMs / 1000)

      const target = targetVolumeRef.current
      const fromVolume = from.volume
      const fade = {
        fromSlot,
        raf: null as number | null,
        startedAt: performance.now(),
        durationMs: Math.max(1, seconds * 1000),
        fromVolume,
      }
      crossfadeRef.current = fade

      const step = (): void => {
        const current = crossfadeRef.current
        if (!current || current !== fade) return
        const t = Math.min(1, (performance.now() - current.startedAt) / current.durationMs)
        const gains = crossfadeGain(t)
        from.volume = current.fromVolume * gains.from
        incoming.volume = target * gains.to
        if (t < 1) {
          current.raf = requestAnimationFrame(step)
        } else {
          finishCrossfade(true)
        }
      }
      step()

      void incoming.play().catch(() => {
        setIsPlaying(false)
        finishCrossfade(true)
      })
    },
    [activeAudio, clearPending, finishCrossfade, idleSlot, saveNow],
  )

  /** Cambio manual o automático: fundido si se está reproduciendo, cambio seco si no. */
  const changeTo = useCallback(
    (id: string, shouldPlay: boolean): void => {
      const prefs = settingsRef.current
      const active = activeAudio()
      const track = latestRef.current.tracks.find((item) => item.id === id)
      clearPending()

      const commit = (): void => {
        finishCrossfade(true)
        autoFadeRef.current = id
        restoredTimeRef.current = null
        positionRef.current = 0
        saveNow({ currentTrackId: id, currentTime: 0 })
        setCurrentId(id)
        setCurrentTime(0)
        if (shouldPlay) setIsPlaying(true)
      }

      const withGap = (fn: () => void): void => {
        if (!prefs.skipSilence) {
          pendingRef.current = window.setTimeout(() => {
            pendingRef.current = null
            fn()
          }, GAP_MS)
        } else {
          fn()
        }
      }

      if (track && shouldPlay && prefs.crossfadeSeconds > 0 && active && !active.paused) {
        crossfadeTo(track, prefs.crossfadeSeconds)
        return
      }
      withGap(commit)
    },
    [activeAudio, clearPending, crossfadeTo, finishCrossfade, saveNow],
  )

  // Decisión de fundido automático en tiempo real, con la lógica pura de cola.
  autoFadeCheckRef.current = (): void => {
    const active = activeAudio()
    if (!active || crossfadeRef.current || !latestRef.current.isPlaying) return
    const state = latestRef.current
    const current = state.tracks.find((track) => track.id === state.currentId)
    const nextCandidates = {
      queueIds: state.queueIds,
      currentId: state.currentId,
      repeatMode: state.repeatMode,
      isShuffle: state.isShuffle,
    }
    const next = nextTrackId(nextCandidates)
    const duration =
      Number.isFinite(active.duration) && active.duration > 0
        ? active.duration
        : (current?.durationMs ?? 0) / 1000
    const seconds = settingsRef.current.crossfadeSeconds
    if (
      !shouldStartCrossfade({
        currentTime: active.currentTime,
        durationSeconds: duration,
        crossfadeSeconds: seconds,
        nextId: next,
      }) ||
      autoFadeRef.current === next
    ) {
      return
    }
    const target = state.tracks.find((track) => track.id === next)
    if (target) crossfadeTo(target, seconds)
  }

  // --- Motor de audio -----------------------------------------------------
  useEffect(() => {
    const createSlot = (): HTMLAudioElement => {
      const audio = new Audio()
      audio.preload = 'metadata'
      audio.volume = targetVolumeRef.current
      return audio
    }
    const a = createSlot()
    const b = createSlot()
    slotsRef.current = { a, b }
    activeSlotRef.current = 'a'

    const attach = (audio: HTMLAudioElement): (() => void) => {
      const onTime = (): void => {
        if (audio !== activeAudio()) return
        positionRef.current = clampPersistedTime(audio.currentTime)
        setCurrentTime(positionRef.current)
        autoFadeCheckRef.current()
      }
      const onMeta = (): void => {
        if (audio !== activeAudio()) return
        const meta = Number.isFinite(audio.duration) ? audio.duration : 0
        setDuration(meta)
        const pending = restoredTimeRef.current
        if (pending !== null && audio.currentTime < 0.25) {
          const target = Math.min(pending, meta || pending)
          audio.currentTime = target
          positionRef.current = target
          restoredTimeRef.current = null
          setCurrentTime(target)
        }
      }
      const onPlay = (): void => {
        if (audio === activeAudio()) setIsPlaying(true)
      }
      const onPause = (): void => {
        if (audio !== activeAudio()) return
        setIsPlaying(false)
        saveNow()
      }
      const onEnded = (): void => {
        if (audio === activeAudio()) advanceRef.current()
      }

      audio.addEventListener('timeupdate', onTime)
      audio.addEventListener('durationchange', onMeta)
      audio.addEventListener('loadedmetadata', onMeta)
      audio.addEventListener('play', onPlay)
      audio.addEventListener('pause', onPause)
      audio.addEventListener('ended', onEnded)
      return () => {
        audio.removeEventListener('timeupdate', onTime)
        audio.removeEventListener('durationchange', onMeta)
        audio.removeEventListener('loadedmetadata', onMeta)
        audio.removeEventListener('play', onPlay)
        audio.removeEventListener('pause', onPause)
        audio.removeEventListener('ended', onEnded)
      }
    }
    const detachA = attach(a)
    const detachB = attach(b)

    return () => {
      detachA()
      detachB()
      finishCrossfade(false)
      clearPending()
      a.pause()
      b.pause()
      a.removeAttribute('src')
      b.removeAttribute('src')
      slotsRef.current = { a: null, b: null }
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      urlsRef.current = []
    }
  }, [activeAudio, clearPending, finishCrossfade, saveNow])

  // --- Biblioteca: hidratación, importación y carpeta de música ------------
  const { importFiles, removeTrack, copyLibraryToFolder, handleOpenMusicFolder } = useLibrary({
    urlsRef,
    latestRef,
    settingsRef,
    restoredTimeRef,
    positionRef,
    setTracks,
    setSettings,
    setVolumeState,
    setIsMuted,
    setRepeatMode,
    setIsShuffle,
    setQueueIds,
    setCurrentId,
    setCurrentTime,
    setIsHydrated,
    setMusicFolder,
    setIsImporting,
    setImportProgress,
    setError,
  })

  const play = useCallback((): void => {
    const audio = activeAudio()
    if (!audio || !audio.src) return
    void audio.play().catch(() => setIsPlaying(false))
  }, [activeAudio])

  const pause = useCallback((): void => {
    finishCrossfade(true)
    clearPending()
    slotsRef.current.a?.pause()
    slotsRef.current.b?.pause()
    saveNow()
  }, [clearPending, finishCrossfade, saveNow])

  const onSleepExpired = useCallback((): void => {
    pause()
    setError('Temporizador de apagado: reproducción detenida.')
  }, [pause])

  const togglePlay = useCallback((): void => {
    if (activeAudio()?.paused) play()
    else pause()
  }, [activeAudio, pause, play])

  const seek = useCallback(
    (time: number): void => {
      const audio = activeAudio()
      if (!audio) return
      finishCrossfade(true)
      clearPending()
      const max = Number.isFinite(audio.duration) ? audio.duration : time
      const next = Math.min(Math.max(time, 0), Math.max(0, max))
      audio.currentTime = next
      positionRef.current = next
      setCurrentTime(next)
    },
    [activeAudio, clearPending, finishCrossfade],
  )

  const seekRatio = useCallback(
    (ratio: number): void => {
      seek(Math.min(1, Math.max(0, ratio)) * durationSeconds)
    },
    [durationSeconds, seek],
  )

  const next = useCallback(
    (auto = false): void => {
      const state = latestRef.current
      const list = state.queueIds
      if (!list.length) return

      if (auto && state.repeatMode === 'one') {
        seek(0)
        play()
        return
      }
      if (auto) {
        const id = nextTrackId({
          queueIds: list,
          currentId: state.currentId,
          repeatMode: state.repeatMode,
          isShuffle: state.isShuffle,
        })
        if (!id) {
          pause()
          seek(0)
          return
        }
        changeTo(id, true)
        return
      }

      const index = list.indexOf(state.currentId ?? '')
      let nextIndex: number
      if (state.isShuffle && list.length > 1) {
        do {
          nextIndex = Math.floor(Math.random() * list.length)
        } while (nextIndex === index)
      } else {
        nextIndex = index < 0 ? 0 : (index + 1) % list.length
      }
      changeTo(list[nextIndex], state.isPlaying)
    },
    [changeTo, pause, play, seek],
  )

  /** Salta N posiciones en la cola; lo usa el deslizador de canciones. */
  const jumpBy = useCallback(
    (offset: number): void => {
      const state = latestRef.current
      const list = state.queueIds
      if (!list.length || offset === 0) return
      const index = list.indexOf(state.currentId ?? '')
      const base = index < 0 ? 0 : index
      let target: number
      if (state.isShuffle && Math.abs(offset) > 1) {
        do {
          target = Math.floor(Math.random() * list.length)
        } while (target === base)
      } else {
        target = (((base + offset) % list.length) + list.length) % list.length
      }
      changeTo(list[target], state.isPlaying)
    },
    [changeTo],
  )

  const prev = useCallback((): void => {
    const state = latestRef.current
    if ((activeAudio()?.currentTime ?? 0) > 3) {
      seek(0)
      return
    }
    const list = state.queueIds
    if (!list.length) return
    const index = list.indexOf(state.currentId ?? '')
    const prevIndex = index <= 0 ? list.length - 1 : index - 1
    changeTo(list[prevIndex], state.isPlaying)
  }, [activeAudio, changeTo, seek])

  advanceRef.current = () => next(true)
  actionsRef.current = { togglePlay, next, prev }

  // --- Sincronización del elemento activo ---------------------------------
  useEffect(() => {
    if (!currentTrack) {
      clearPending()
      finishCrossfade(false)
      slotsRef.current.a?.pause()
      slotsRef.current.b?.pause()
      slotsRef.current.a?.removeAttribute('src')
      slotsRef.current.b?.removeAttribute('src')
      setDuration(0)
      setIsPlaying(false)
      return
    }
    const audio = activeAudio()
    if (!audio) return
    if (audio.src !== currentTrack.audioUrl) {
      clearPending()
      finishCrossfade(false)
      audio.src = currentTrack.audioUrl
      audio.load()
    }
    setDuration(currentTrack.durationMs / 1000)
    if (latestRef.current.isPlaying && !crossfadeRef.current) {
      audio.volume = targetVolumeRef.current
      if (audio.paused) void audio.play().catch(() => setIsPlaying(false))
    }
  }, [activeAudio, clearPending, currentTrack?.audioUrl, finishCrossfade])

  useEffect(() => {
    targetVolumeRef.current = isMuted ? 0 : volume * volume
    if (crossfadeRef.current) return
    const a = slotsRef.current.a
    const b = slotsRef.current.b
    if (a) a.volume = targetVolumeRef.current
    if (b) b.volume = targetVolumeRef.current
  }, [isMuted, volume])

  // --- Temporizador de apagado --------------------------------------------
  const { sleepMinutes, sleepRemaining, setSleepTimer } = useSleepTimer(onSleepExpired)

  // --- Persistencia --------------------------------------------------------
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
  }, [currentTrack?.album, currentTrack?.artist, currentTrack?.coverUrl, currentTrack?.title])

  const playTrack = useCallback(
    (id: string): void => {
      changeTo(id, true)
    },
    [changeTo],
  )

  const enqueue = useCallback((id: string): void => {
    setQueueIds((previous) => {
      if (settingsRef.current.preventDuplicates) {
        return previous.includes(id) ? previous : [...previous, id]
      }
      return [...previous, id]
    })
  }, [])

  const toggleShuffle = useCallback((): void => setIsShuffle((value) => !value), [])

  const cycleRepeat = useCallback((): void => {
    setRepeatMode((mode) => (mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'))
  }, [])

  const updateSettings = useCallback((patch: Partial<PlaybackSettings>): void => {
    setSettings((previous) => normalizeSettings({ ...previous, ...patch }))
  }, [])

  const timeValue = useMemo<PlayerTime>(
    () => ({ currentTime, duration: durationSeconds, progress }),
    [currentTime, durationSeconds, progress],
  )

  const value = useMemo<PlayerContextValue>(
    () => ({
      tracks,
      queue,
      currentTrack,
      palette,
      isPlaying,
      volume,
      isMuted,
      repeatMode,
      isShuffle,
      isImporting,
      importProgress,
      settings,
      musicFolder,
      sleepMinutes,
      sleepRemaining,
      error,
      play,
      pause,
      togglePlay,
      seek,
      seekRatio,
      setVolume: (next) => setVolumeState(clampVolume(next)),
      toggleMute: () => setIsMuted((muted) => !muted),
      next: () => next(),
      prev,
      jumpBy,
      playTrack,
      enqueue,
      toggleShuffle,
      cycleRepeat,
      updateSettings,
      openMusicFolder: handleOpenMusicFolder,
      copyLibraryToFolder,
      setSleepTimer,
      importFiles,
      removeTrack,
      clearError: () => setError(null),
    }),
    [
      tracks,
      queue,
      currentTrack,
      palette,
      isPlaying,
      volume,
      isMuted,
      repeatMode,
      isShuffle,
      isImporting,
      importProgress,
      settings,
      musicFolder,
      sleepMinutes,
      sleepRemaining,
      error,
      play,
      pause,
      togglePlay,
      seek,
      seekRatio,
      next,
      prev,
      jumpBy,
      playTrack,
      enqueue,
      toggleShuffle,
      cycleRepeat,
      updateSettings,
      handleOpenMusicFolder,
      copyLibraryToFolder,
      setSleepTimer,
      importFiles,
      removeTrack,
    ],
  )

  return (
    <PlayerContext.Provider value={value}>
      <PlayerTimeContext.Provider value={timeValue}>{children}</PlayerTimeContext.Provider>
    </PlayerContext.Provider>
  )
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext)
  if (!context) throw new Error('usePlayer debe usarse dentro de PlaybackProvider')
  return context
}

export function usePlayerTime(): PlayerTime {
  const context = useContext(PlayerTimeContext)
  if (!context) throw new Error('usePlayerTime debe usarse dentro de PlaybackProvider')
  return context
}
