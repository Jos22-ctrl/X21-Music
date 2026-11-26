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
import { DEFAULT_PALETTE, type Palette } from '../lib/color'
import { deleteTrack, loadSettings, loadTracks, saveSettings, saveTrack } from '../lib/db'
import { fingerprint, isAudioFile } from '../lib/fingerprint'
import { computeWaveform, readAudioMetadata } from '../lib/metadata'
import { DEFAULT_ISLAND_LAYOUT, normalizeIslandLayout } from '../lib/islandLayout'
import {
  baseName,
  getMusicFolder,
  moveFilesToMusicFolder,
  openMusicFolder,
  saveFileToMusicFolder,
  sourcePathOf,
} from '../lib/musicFolder'
import { extractPaletteFromBlob } from '../lib/palette'
import type {
  PersistedSettings,
  PlaybackSettings,
  RepeatMode,
  StoredTrack,
  Track,
} from '../types'

export interface PlayerContextValue {
  tracks: Track[]
  queue: Track[]
  currentTrack: Track | null
  palette: Palette
  isPlaying: boolean
  currentTime: number
  duration: number
  progress: number
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

const GAP_MS = 400

const DEFAULT_SETTINGS: PlaybackSettings = {
  crossfadeSeconds: 0,
  skipSilence: true,
  preventDuplicates: true,
  monoDark: false,
  marqueeTitles: false,
  islandLayout: DEFAULT_ISLAND_LAYOUT,
  playbackBarStyle: 'simple',
}

const clampVolume = (value: number): number =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.8))

function normalizeSettings(value?: Partial<PlaybackSettings>): PlaybackSettings {
  const seconds = Number(value?.crossfadeSeconds ?? 0)
  return {
    crossfadeSeconds: Number.isFinite(seconds) ? Math.min(8, Math.max(0, seconds)) : 0,
    skipSilence: value?.skipSilence ?? DEFAULT_SETTINGS.skipSilence,
    preventDuplicates: value?.preventDuplicates ?? DEFAULT_SETTINGS.preventDuplicates,
    monoDark: value?.monoDark ?? DEFAULT_SETTINGS.monoDark,
    marqueeTitles: value?.marqueeTitles ?? DEFAULT_SETTINGS.marqueeTitles,
    islandLayout: normalizeIslandLayout(value?.islandLayout),
    playbackBarStyle: value?.playbackBarStyle === 'clasico' ? 'clasico' : 'simple',
  }
}

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
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null)
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null)
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
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
  const fadeFrameRef = useRef<number | null>(null)
  const fadingRef = useRef(false)
  const fadeInRef = useRef(0)
  const pendingRef = useRef<number | null>(null)

  settingsRef.current = settings
  latestRef.current = { tracks, currentId, queueIds, repeatMode, isShuffle, isPlaying }

  const makeView = useCallback((record: StoredTrack): Track => {
    const audioUrl = URL.createObjectURL(record.fileBlob)
    urlsRef.current.push(audioUrl)
    const coverUrl = record.coverBlob ? URL.createObjectURL(record.coverBlob) : null
    if (coverUrl) urlsRef.current.push(coverUrl)
    return {
      id: record.id,
      title: record.title,
      artist: record.artist,
      album: record.album,
      durationMs: record.durationMs,
      fileName: record.fileName,
      filePath: record.filePath ?? null,
      mimeType: record.mimeType,
      palette: record.palette,
      waveform: record.waveform,
      addedAt: record.addedAt,
      audioUrl,
      coverUrl,
    }
  }, [])

  const currentTrack = tracks.find((track) => track.id === currentId) ?? null
  const queue = queueIds
    .map((id) => tracks.find((track) => track.id === id))
    .filter((track): track is Track => Boolean(track))
  const durationSeconds = duration || (currentTrack?.durationMs ?? 0) / 1000
  const progress = durationSeconds > 0 ? Math.min(1, currentTime / durationSeconds) : 0
  const palette = currentTrack?.palette ?? DEFAULT_PALETTE

  const clearFade = useCallback((): void => {
    if (fadeFrameRef.current !== null) cancelAnimationFrame(fadeFrameRef.current)
    fadeFrameRef.current = null
    fadingRef.current = false
  }, [])

  const clearPending = useCallback((): void => {
    if (pendingRef.current !== null) window.clearTimeout(pendingRef.current)
    pendingRef.current = null
  }, [])

  /** Fundido lineal del volumen actual; se usa para la transición gradual. */
  const fadeTo = useCallback(
    (to: number, ms: number, done?: () => void, liveTarget = false): void => {
      const audio = audioRef.current
      if (!audio || ms <= 0) {
        if (audio) audio.volume = liveTarget ? targetVolumeRef.current : to
        done?.()
        return
      }
      clearFade()
      fadingRef.current = true
      const from = audio.volume
      const started = performance.now()
      const step = (): void => {
        if (!audioRef.current) return
        const t = Math.min(1, (performance.now() - started) / ms)
        const end = liveTarget ? targetVolumeRef.current : to
        audioRef.current.volume = from + (end - from) * t
        if (t < 1) {
          fadeFrameRef.current = requestAnimationFrame(step)
        } else {
          fadingRef.current = false
          fadeFrameRef.current = null
          done?.()
        }
      }
      step()
    },
    [clearFade],
  )

  /** Cambia de pista aplicando fundido y/o suprimiendo el silencio entre canciones. */
  const changeTo = useCallback(
    (id: string, shouldPlay: boolean): void => {
      const audio = audioRef.current
      const prefs = settingsRef.current
      clearPending()
      clearFade()

      const commit = (): void => {
        fadeInRef.current = prefs.crossfadeSeconds > 0 && shouldPlay ? prefs.crossfadeSeconds * 500 : 0
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

      if (!audio || !shouldPlay || prefs.crossfadeSeconds <= 0) {
        withGap(commit)
        return
      }
      fadeTo(0, prefs.crossfadeSeconds * 500, () => withGap(commit))
    },
    [clearFade, clearPending, fadeTo],
  )

  // --- Motor de audio -----------------------------------------------------
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audioRef.current = audio
    audio.volume = targetVolumeRef.current

    const onTime = (): void => setCurrentTime(audio.currentTime)
    const onMeta = (): void =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onPlay = (): void => setIsPlaying(true)
    const onPause = (): void => setIsPlaying(false)
    const onEnded = (): void => advanceRef.current()

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
      clearFade()
      clearPending()
      audio.pause()
      audio.removeAttribute('src')
      audioRef.current = null
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      urlsRef.current = []
    }
  }, [clearFade, clearPending])

  // --- Hidratación desde IndexedDB ----------------------------------------
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [records, storedSettings] = await Promise.all([loadTracks(), loadSettings()])
      if (cancelled) return

      const views = records.map(makeView)
      setTracks(views)
      const knownIds = new Set(views.map((view) => view.id))
      const validQueue = (storedSettings?.queueIds ?? views.map((view) => view.id)).filter((id) =>
        knownIds.has(id),
      )

      setSettings(normalizeSettings(storedSettings?.preferences))
      setVolumeState(clampVolume(storedSettings?.volume ?? 0.8))
      setIsMuted(Boolean(storedSettings?.isMuted))
      setRepeatMode(storedSettings?.repeatMode ?? 'off')
      setIsShuffle(Boolean(storedSettings?.isShuffle))
      setQueueIds(validQueue)
      setCurrentId(
        storedSettings?.currentTrackId && knownIds.has(storedSettings.currentTrackId)
          ? storedSettings.currentTrackId
          : (validQueue[0] ?? null),
      )
      setCurrentTime(storedSettings?.currentTime ?? 0)
      setIsHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [makeView])

  // La carpeta de música se crea en el proceso Electron (C:\Users\<usuario>\X21 Music\Música).
  useEffect(() => {
    let cancelled = false
    void getMusicFolder().then((folder) => {
      if (!cancelled) setMusicFolder(folder)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const play = useCallback((): void => {
    const audio = audioRef.current
    if (!audio || !audio.src) return
    void audio.play().catch(() => setIsPlaying(false))
  }, [])

  const pause = useCallback((): void => {
    audioRef.current?.pause()
  }, [])

  const togglePlay = useCallback((): void => {
    if (audioRef.current?.paused) play()
    else pause()
  }, [pause, play])

  const seek = useCallback((time: number): void => {
    const audio = audioRef.current
    if (!audio) return
    const max = Number.isFinite(audio.duration) ? audio.duration : time
    const next = Math.min(Math.max(time, 0), Math.max(0, max))
    audio.currentTime = next
    setCurrentTime(next)
  }, [])

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
      const index = list.indexOf(state.currentId ?? '')

      if (auto && state.repeatMode === 'one') {
        seek(0)
        play()
        return
      }
      if (auto && state.repeatMode === 'off' && !state.isShuffle && index === list.length - 1) {
        pause()
        seek(0)
        return
      }

      let nextIndex: number
      if (state.isShuffle && list.length > 1) {
        do {
          nextIndex = Math.floor(Math.random() * list.length)
        } while (nextIndex === index)
      } else {
        nextIndex = index < 0 ? 0 : (index + 1) % list.length
      }

      changeTo(list[nextIndex], auto || state.isPlaying)
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
    if ((audioRef.current?.currentTime ?? 0) > 3) {
      seek(0)
      return
    }
    const list = state.queueIds
    if (!list.length) return
    const index = list.indexOf(state.currentId ?? '')
    const prevIndex = index <= 0 ? list.length - 1 : index - 1
    changeTo(list[prevIndex], state.isPlaying)
  }, [changeTo, seek])

  advanceRef.current = () => next(true)
  actionsRef.current = { togglePlay, next, prev }

  // --- Sincronización del elemento de audio -------------------------------
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    clearPending()
    clearFade()
    if (!currentTrack) {
      audio.pause()
      audio.removeAttribute('src')
      setDuration(0)
      setIsPlaying(false)
      return
    }
    audio.src = currentTrack.audioUrl
    audio.load()
    setDuration(currentTrack.durationMs / 1000)

    const fadeInMs = fadeInRef.current
    fadeInRef.current = 0
    if (latestRef.current.isPlaying) {
      play()
      if (fadeInMs > 0) {
        audio.volume = 0
        fadeTo(targetVolumeRef.current, fadeInMs, undefined, true)
      } else {
        audio.volume = targetVolumeRef.current
      }
    }
  }, [currentTrack?.audioUrl, clearFade, clearPending, fadeTo, play])

  useEffect(() => {
    targetVolumeRef.current = isMuted ? 0 : volume * volume
    if (!fadingRef.current && audioRef.current) audioRef.current.volume = targetVolumeRef.current
  }, [isMuted, volume])

  // --- Temporizador de apagado --------------------------------------------
  useEffect(() => {
    if (sleepEndsAt === null) return
    const tick = (): void => {
      const left = Math.max(0, Math.ceil((sleepEndsAt - Date.now()) / 1000))
      setSleepRemaining(left)
      if (left === 0) {
        pause()
        setSleepEndsAt(null)
        setSleepMinutes(null)
        setSleepRemaining(null)
        setError('Temporizador de apagado: reproducción detenida.')
      }
    }
    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [pause, sleepEndsAt])

  // --- Persistencia --------------------------------------------------------
  useEffect(() => {
    if (!isHydrated) return
    const timer = window.setTimeout(() => {
      const data: Omit<PersistedSettings, 'key'> = {
        volume,
        isMuted,
        repeatMode,
        isShuffle,
        queueIds,
        currentTrackId: currentId,
        currentTime,
        preferences: settings,
      }
      void saveSettings(data)
    }, 500)
    return () => window.clearTimeout(timer)
  }, [
    currentId,
    currentTime,
    isHydrated,
    isMuted,
    isShuffle,
    queueIds,
    repeatMode,
    settings,
    volume,
  ])

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

  // --- Biblioteca ----------------------------------------------------------
  const importFiles = useCallback(
    async (files: File[]): Promise<void> => {
      const audioFiles = files.filter(isAudioFile)
      if (!audioFiles.length) {
        setError('No se encontraron archivos de audio en la selección.')
        return
      }

      setIsImporting(true)
      setError(null)
      const collected = [...latestRef.current.tracks]
      const importedIds: string[] = []
      const preferUnique = settingsRef.current.preventDuplicates
      const metaKey = (title: string, artist: string, album: string): string =>
        `${title}|${artist}|${album}`.trim().toLowerCase()
      let moveFailed = false

      try {
        for (let i = 0; i < audioFiles.length; i++) {
          setImportProgress({ current: i + 1, total: audioFiles.length })
          const file = audioFiles[i]
          const id = fingerprint(file)
          if (collected.some((track) => track.id === id)) continue

          // Copia en memoria antes de mover el original: el <input> lee del disco.
          const sourcePath = sourcePathOf(file)
          let stableFile = file
          if (sourcePath) {
            try {
              const bytes = await file.arrayBuffer()
              stableFile = new File([bytes], file.name, { type: file.type || 'audio/mpeg' })
            } catch {
              stableFile = file
            }
          }

          const metadata = await readAudioMetadata(stableFile)
          if (
            preferUnique &&
            collected.some((track) => metaKey(track.title, track.artist, track.album) === metaKey(metadata.title, metadata.artist, metadata.album))
          ) {
            continue
          }

          const waveform = await computeWaveform(stableFile)
          const paletteForTrack = await extractPaletteFromBlob(metadata.coverBlob)

          let filePath: string | null = null
          let fileName = stableFile.name
          if (sourcePath) {
            const [destination] = await moveFilesToMusicFolder([sourcePath])
            if (destination) {
              filePath = destination
              fileName = baseName(destination)
            } else {
              moveFailed = true
            }
          }

          const record: StoredTrack = {
            id,
            title: metadata.title,
            artist: metadata.artist,
            album: metadata.album,
            durationMs: metadata.durationMs,
            fileName,
            filePath,
            mimeType: stableFile.type || 'audio/mpeg',
            fileBlob: stableFile,
            coverBlob: metadata.coverBlob,
            palette: paletteForTrack,
            waveform,
            addedAt: Date.now() + i,
          }
          await saveTrack(record)
          const view = makeView(record)
          collected.push(view)
          importedIds.push(id)
          setTracks([...collected])
        }

        if (moveFailed) {
          setError(
            'Las canciones se importaron, pero algunas no se pudieron mover a la carpeta de música.',
          )
        }

        if (importedIds.length) {
          setQueueIds((previous) =>
            previous.length ? [...previous, ...importedIds] : collected.map((track) => track.id),
          )
          if (!latestRef.current.currentId) setCurrentId(importedIds[0])
        }
      } catch {
        setError('No se pudieron importar algunos archivos.')
      } finally {
        setIsImporting(false)
        setImportProgress(null)
      }
    },
    [makeView],
  )

  const removeTrack = useCallback(async (id: string): Promise<void> => {
    const removed = latestRef.current.tracks.find((track) => track.id === id)
    const remaining = latestRef.current.tracks.filter((track) => track.id !== id)
    await deleteTrack(id)
    setTracks(remaining)
    setQueueIds((previous) => previous.filter((queued) => queued !== id))
    if (latestRef.current.currentId === id) {
      setCurrentId(remaining[0]?.id ?? null)
      setCurrentTime(0)
    }
    if (removed) {
      const obsolete = new Set([removed.audioUrl, removed.coverUrl].filter(Boolean) as string[])
      urlsRef.current = urlsRef.current.filter((url) => !obsolete.has(url))
      obsolete.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

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

  const handleOpenMusicFolder = useCallback(async (): Promise<void> => {
    await openMusicFolder()
  }, [])

  /** Escribe en la carpeta de usuario todas las canciones ya guardadas en IndexedDB. */
  const copyLibraryToFolder = useCallback(async (): Promise<number> => {
    const records = await loadTracks()
    const saved = new Map<string, { filePath: string; fileName: string }>()

    for (const record of records) {
      try {
        const data = await record.fileBlob.arrayBuffer()
        const filePath = await saveFileToMusicFolder(record.fileName, data)
        if (!filePath) continue
        await saveTrack({ ...record, filePath })
        saved.set(record.id, { filePath, fileName: baseName(filePath) })
      } catch {
        // Una pista problemática no detiene el resto.
      }
    }

    if (saved.size) {
      setTracks((previous) =>
        previous.map((track) => {
          const item = saved.get(track.id)
          return item ? { ...track, ...item } : track
        }),
      )
    }
    return saved.size
  }, [])

  const setSleepTimer = useCallback((minutes: number | null): void => {
    setSleepMinutes(minutes)
    setSleepEndsAt(minutes ? Date.now() + minutes * 60_000 : null)
    setSleepRemaining(minutes ? minutes * 60 : null)
  }, [])

  const value = useMemo<PlayerContextValue>(
    () => ({
      tracks,
      queue,
      currentTrack,
      palette,
      isPlaying,
      currentTime,
      duration: durationSeconds,
      progress,
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
      currentTime,
      durationSeconds,
      progress,
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

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext)
  if (!context) throw new Error('usePlayer debe usarse dentro de PlaybackProvider')
  return context
}
