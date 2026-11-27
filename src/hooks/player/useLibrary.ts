import { useCallback, useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { chunk, mapWithConcurrency, shouldReportProgress, yieldToBrowser } from '../../lib/batch'
import { shrinkCover } from '../../lib/coverThumbnail'
import {
  deleteTrack,
  loadSettings,
  loadTracks,
  saveTracks,
} from '../../lib/db'
import {
  fileHash,
  isAudioFile,
  legacyFingerprint,
  resolveImportIdentity,
} from '../../lib/fingerprint'
import { DEFAULT_PALETTE } from '../../lib/color'
import { fallbackWaveform, readAudioMetadata } from '../../lib/metadata'
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
import { registerTrackBlobs, releaseTrack } from '../../lib/trackUrls'
import { clampVolume, normalizeSettings } from './settings'
import type { PlaybackSettings, RepeatMode, StoredTrack, Track } from '../../types'

/** Tamaño del lote de escritura en IndexedDB. */
const IMPORT_BATCH_SIZE = 20

/** Estado compartido con el provider; los setters son los de useState. */
export interface LibraryDeps {
  latestRef: {
    current: {
      tracks: Track[]
      currentId: string | null
      queueIds: string[]
      repeatMode: RepeatMode
      isShuffle: boolean
      isPlaying: boolean
    }
  }
  settingsRef: { current: PlaybackSettings }
  restoredTimeRef: { current: number | null }
  positionRef: { current: number }
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

  const importAbortRef = useRef<AbortController | null>(null)
  useEffect(() => () => importAbortRef.current?.abort(), [])

  /**
   * Registra los blobs y deja las URLs sin crear: el audio se abre solo para la
   * pista actual/siguiente y la portada solo cuando su fila entra en pantalla.
   */
  const makeView = useCallback((record: StoredTrack): Track => {
    registerTrackBlobs(record.id, record.fileBlob, record.coverBlob)
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
      waveformReal: record.waveformReal,
      addedAt: record.addedAt,
      fileSize: record.fileBlob?.size ?? 0,
      audioUrl: '',
      coverUrl: null,
    }
  }, [])

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

      const controller = new AbortController()
      importAbortRef.current = controller
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
      let processed = 0
      let lastProgressAt: number | null = null

      try {
        for (const batch of chunk(audioFiles, IMPORT_BATCH_SIZE)) {
          if (controller.signal.aborted) break
          const pending: StoredTrack[] = []
          const processedBatch = await mapWithConcurrency(batch, 2, async (file) => {
            processed += 1
            const now = Date.now()
            if (shouldReportProgress(now, lastProgressAt)) {
              lastProgressAt = now
              setImportProgress({ current: processed, total: audioFiles.length })
            }
            // Cede el hilo antes de tocar el archivo: la ventana sigue respondiendo.
            await yieldToBrowser()
            if (controller.signal.aborted) return null

            const hash = await fileHash(file)
            if (controller.signal.aborted) return null
            const resolution = resolveImportIdentity(
              { id: hash.slice(0, 32), hash, legacyId: legacyFingerprint(file) },
              [...collected, ...pending],
            )
            if (resolution.status === 'duplicate') return null
            if (resolution.status === 'collision') identityCollision = true
            const id = resolution.id

            let stableFile: File | null = null
            try {
              stableFile = new File([await file.arrayBuffer()], file.name, {
                type: file.type || 'audio/mpeg',
              })
            } catch {
              stableFile = file
            }
            const readable = stableFile ?? file
            const metadata = await readAudioMetadata(readable)
            if (controller.signal.aborted) return null
            if (
              preferUnique &&
              [...collected, ...pending].some(
                (track) =>
                  metaKey(track.title, track.artist, track.album) ===
                  metaKey(metadata.title, metadata.artist, metadata.album),
              )
            ) {
              return null
            }
            // Sin awaits entre comprobación y reserva: dos pistas iguales no se solapan.
            if (pending.some((track) => track.id === id)) return null
            const record: StoredTrack = {
              id,
              title: metadata.title,
              artist: metadata.artist,
              album: metadata.album,
              durationMs: metadata.durationMs,
              fileName: readable.name,
              filePath: null,
              contentHash: resolution.hash,
              mimeType: readable.type || 'audio/mpeg',
              fileBlob: readable,
              coverBlob: null,
              palette: { ...DEFAULT_PALETTE },
              // La onda real se calcula en tiempo de inactividad al reproducir.
              waveform: fallbackWaveform(readable.name, 80),
              waveformReal: false,
              addedAt: Date.now() + processed,
            }
            pending.push(record)

            const sourcePath = sourcePathOf(file)
            let filePath: string | null = null
            let fileName = readable.name
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
            record.filePath = filePath
            record.fileName = fileName

            // Solo portadas nuevas: se reduce la miniatura antes de guardarla.
            record.coverBlob = await shrinkCover(metadata.coverBlob)
            record.palette = await extractPaletteFromBlob(record.coverBlob)
            return controller.signal.aborted ? null : record
          })

          const accepted = processedBatch.filter((record): record is StoredTrack => Boolean(record))
          if (accepted.length) {
            // Una transacción y un único setState por lote.
            await saveTracks(accepted)
            const views = accepted.map(makeView)
            collected.push(...views)
            importedIds.push(...accepted.map((record) => record.id))
            setTracks((previous) => [...previous, ...views])
          }
          await yieldToBrowser()
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
        importAbortRef.current = null
        setIsImporting(false)
        setImportProgress(null)
      }
    },
    [latestRef, makeView, setCurrentId, setError, setImportProgress, setIsImporting, setQueueIds, setSettings, setTracks],
  )

  const removeTrack = useCallback(
    async (id: string): Promise<void> => {
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
      releaseTrack(id)
    },
    [latestRef, setCurrentId, setCurrentTime, setQueueIds, setTracks, settingsRef],
  )

  /** Escribe en la carpeta de usuario todas las canciones ya guardadas en IndexedDB. */
  const copyLibraryToFolder = useCallback(async (): Promise<number> => {
    const records = await loadTracks()
    const saved = new Map<string, { filePath: string; fileName: string }>()
    const updated: StoredTrack[] = []

    for (const batch of chunk(records, IMPORT_BATCH_SIZE)) {
      for (const record of batch) {
        try {
          const data = await record.fileBlob.arrayBuffer()
          const filePath = await saveFileToMusicFolder(record.fileName, data)
          if (!filePath) continue
          updated.push({ ...record, filePath })
          saved.set(record.id, { filePath, fileName: baseName(filePath) })
        } catch {
          // Una pista problemática no detiene el resto.
        }
      }
      if (updated.length) {
        await saveTracks(updated.splice(0))
        await yieldToBrowser()
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
