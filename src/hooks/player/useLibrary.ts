import { useCallback, useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import {
  deleteTrack,
  loadSettings,
  loadTracks,
  saveTrack,
} from '../../lib/db'
import {
  fileHash,
  isAudioFile,
  legacyFingerprint,
  resolveImportIdentity,
} from '../../lib/fingerprint'
import { computeWaveform, readAudioMetadata } from '../../lib/metadata'
import { clampPersistedTime } from '../../lib/persistence'
import { reconcileQueue } from '../../lib/queue'
import {
  baseName,
  copyFilesToMusicFolder,
  getMusicFolder,
  moveFilesToMusicFolder,
  openMusicFolder as openMusicFolderApi,
  saveFileToMusicFolder,
  sourcePathOf,
  trashMusicFiles,
} from '../../lib/musicFolder'
import { extractPaletteFromBlob } from '../../lib/palette'
import { clampVolume, normalizeSettings } from './settings'
import type { PlaybackSettings, RepeatMode, StoredTrack, Track } from '../../types'

/** Estado compartido con el provider; los setters son los de useState. */
export interface LibraryDeps {
  urlsRef: MutableRefObject<string[]>
  latestRef: MutableRefObject<{
    tracks: Track[]
    currentId: string | null
    queueIds: string[]
    repeatMode: RepeatMode
    isShuffle: boolean
    isPlaying: boolean
  }>
  settingsRef: MutableRefObject<PlaybackSettings>
  restoredTimeRef: MutableRefObject<number | null>
  positionRef: MutableRefObject<number>
  setTracks: Dispatch<SetStateAction<Track[]>>
  setSettings: Dispatch<SetStateAction<PlaybackSettings>>
  setVolumeState: Dispatch<SetStateAction<number>>
  setIsMuted: Dispatch<SetStateAction<boolean>>
  setRepeatMode: Dispatch<SetStateAction<RepeatMode>>
  setIsShuffle: Dispatch<SetStateAction<boolean>>
  setQueueIds: Dispatch<SetStateAction<string[]>>
  setCurrentId: Dispatch<SetStateAction<string | null>>
  setCurrentTime: Dispatch<SetStateAction<number>>
  setIsHydrated: Dispatch<SetStateAction<boolean>>
  setMusicFolder: Dispatch<SetStateAction<string | null>>
  setIsImporting: Dispatch<SetStateAction<boolean>>
  setImportProgress: Dispatch<SetStateAction<{ current: number; total: number } | null>>
  setError: Dispatch<SetStateAction<string | null>>
}

/** Hidratación, importación y copia de la biblioteca guardada en IndexedDB. */
export function useLibrary(deps: LibraryDeps) {
  const {
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
  } = deps

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
      fileSize: record.fileBlob?.size ?? 0,
      audioUrl,
      coverUrl,
    }
  }, [urlsRef])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [records, storedSettings] = await Promise.all([loadTracks(), loadSettings()])
      if (cancelled) return

      const views = records.map(makeView)
      setTracks(views)
      const knownIds = new Set(views.map((view) => view.id))
      // Una cola antigua no debe dejar fuera canciones que ya están en la biblioteca.
      const validQueue = reconcileQueue(
        storedSettings?.queueIds,
        views.map((view) => view.id),
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
      restoredTimeRef.current = clampPersistedTime(storedSettings?.currentTime)
      setCurrentTime(restoredTimeRef.current)
      positionRef.current = restoredTimeRef.current
      setIsHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [makeView, positionRef, restoredTimeRef, setCurrentId, setCurrentTime, setIsHydrated, setIsMuted, setIsShuffle, setQueueIds, setRepeatMode, setSettings, setTracks, setVolumeState])

  // La carpeta de música se crea en el proceso Electron (C:\Users\<usuario>\X21 Music\Música).
  useEffect(() => {
    let cancelled = false
    void getMusicFolder().then((folder) => {
      if (!cancelled) setMusicFolder(folder)
    })
    return () => {
      cancelled = true
    }
  }, [setMusicFolder])

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
      const shouldMove = settingsRef.current.moveOriginals
      const metaKey = (title: string, artist: string, album: string): string =>
        `${title}|${artist}|${album}`.trim().toLowerCase()
      let moveFailed = false
      let identityCollision = false

      try {
        for (let i = 0; i < audioFiles.length; i++) {
          setImportProgress({ current: i + 1, total: audioFiles.length })
          const file = audioFiles[i]
          // SHA-256 evita las colisiones del huésped de 32 bits; el ID antiguo sigue contando.
          const hash = await fileHash(file)
          const resolution = resolveImportIdentity(
            { id: hash.slice(0, 32), hash, legacyId: legacyFingerprint(file) },
            collected,
          )
          if (resolution.status === 'duplicate') continue
          if (resolution.status === 'collision') identityCollision = true
          const id = resolution.id

          // Una sola lectura: los bytes se reutilizan para la forma de onda.
          const sourcePath = sourcePathOf(file)
          let stableFile = file
          let bytes: ArrayBuffer | null = null
          try {
            bytes = await file.arrayBuffer()
            stableFile = new File([bytes], file.name, { type: file.type || 'audio/mpeg' })
          } catch {
            bytes = null
            stableFile = file
          }

          const metadata = await readAudioMetadata(stableFile)
          if (
            preferUnique &&
            collected.some((track) => metaKey(track.title, track.artist, track.album) === metaKey(metadata.title, metadata.artist, metadata.album))
          ) {
            continue
          }

          const waveform = await computeWaveform(stableFile, {
            bytes,
            durationMs: metadata.durationMs,
          })
          const paletteForTrack = await extractPaletteFromBlob(metadata.coverBlob)

          let filePath: string | null = null
          let fileName = stableFile.name
          if (sourcePath) {
            const [destination] = shouldMove
              ? await moveFilesToMusicFolder([sourcePath])
              : await copyFilesToMusicFolder([sourcePath])
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
            contentHash: resolution.hash,
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

        const issues: string[] = []
        if (moveFailed) {
          issues.push(
            shouldMove
              ? 'Las canciones se importaron, pero algunas no se pudieron mover a la carpeta de música.'
              : 'Las canciones se importaron, pero algunas no se pudieron copiar a la carpeta de música.',
          )
        }
        if (identityCollision) {
          issues.push('Algunas canciones con ID en conflicto recibieron un identificador nuevo.')
        }
        if (issues.length) setError(issues.join(' '))

        if (importedIds.length) {
          setQueueIds((previous) =>
            reconcileQueue([...previous, ...importedIds], collected.map((track) => track.id)),
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
    [latestRef, makeView, setCurrentId, setError, setImportProgress, setIsImporting, setQueueIds, setTracks],
  )

  const removeTrack = useCallback(async (id: string): Promise<void> => {
    const removed = latestRef.current.tracks.find((track) => track.id === id)
    const remaining = latestRef.current.tracks.filter((track) => track.id !== id)
    await deleteTrack(id)
    // REQUIERE PRUEBA MANUAL EN WINDOWS: confirmar que la papelera recibe el archivo.
    if (settingsRef.current.moveOriginals && removed?.filePath) {
      await trashMusicFiles([removed.filePath])
    }
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
  }, [latestRef, setCurrentId, setCurrentTime, setQueueIds, setTracks, settingsRef, urlsRef])

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
  }, [setTracks])

  const handleOpenMusicFolder = useCallback(async (): Promise<void> => {
    await openMusicFolderApi()
  }, [])

  return { importFiles, removeTrack, copyLibraryToFolder, handleOpenMusicFolder }
}
