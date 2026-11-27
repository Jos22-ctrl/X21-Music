import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { updateTrackWaveform } from '../../lib/db'
import { computeWaveform } from '../../lib/metadata'
import { getTrackBlobs } from '../../lib/trackUrls'
import { shouldDecodeWaveform } from '../../lib/waveform'
import type { Track } from '../../types'

interface LazyWaveformDeps {
  tracks: Track[]
  isHydrated: boolean
  isImporting: boolean
  setTracks: Dispatch<SetStateAction<Track[]>>
}

type IdleScope = typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

/** requestIdleCallback con sustituto para navegadores sin la API. */
function idleScheduler() {
  const scope = globalThis as IdleScope
  if (typeof scope.requestIdleCallback === 'function') {
    return {
      request: (callback: () => void): number =>
        scope.requestIdleCallback!(callback, { timeout: 1000 }),
      cancel: (handle: number): void => scope.cancelIdleCallback?.(handle),
    }
  }
  return {
    request: (callback: () => void): number => window.setTimeout(callback, 32),
    cancel: (handle: number): void => window.clearTimeout(handle),
  }
}

/** Calcula una forma de onda real por pista, solo cuando el navegador está inactivo. */
export function useLazyWaveform({ tracks, isHydrated, isImporting, setTracks }: LazyWaveformDeps): void {
  const pendingRef = useRef<string[]>([])
  const queuedRef = useRef<Set<string>>(new Set())
  const tracksRef = useRef(tracks)
  const wakeRef = useRef<() => void>(() => undefined)
  tracksRef.current = tracks

  useEffect(() => {
    if (!isHydrated) return
    let added = false
    for (const track of tracks) {
      if (
        !track.waveformReal &&
        !queuedRef.current.has(track.id) &&
        shouldDecodeWaveform(track.fileSize, track.durationMs)
      ) {
        queuedRef.current.add(track.id)
        pendingRef.current.push(track.id)
        added = true
      }
    }
    if (added) wakeRef.current()
  }, [isHydrated, tracks])

  useEffect(() => {
    if (!isHydrated || isImporting) return
    const scheduler = idleScheduler()
    let cancelled = false
    let handle: number | null = null
    let running = false

    const schedule = (): void => {
      if (cancelled || handle !== null || running) return
      handle = scheduler.request(() => {
        handle = null
        void run()
      })
    }
    wakeRef.current = schedule

    const run = async (): Promise<void> => {
      // Con la ventana oculta no se decodifica audio ni se repinta la onda.
      if (cancelled || document.hidden || isImporting) {
        schedule()
        return
      }
      const id = pendingRef.current.shift()
      if (!id) return
      queuedRef.current.delete(id)
      running = true
      try {
        const track = tracksRef.current.find((item) => item.id === id)
        const blobs = getTrackBlobs(id)
        if (!track || !blobs?.audio || !shouldDecodeWaveform(track.fileSize, track.durationMs)) return
        const file = new File([blobs.audio], track.fileName, {
          type: track.mimeType || 'audio/mpeg',
        })
        // REQUIERE PRUEBA MANUAL EN WINDOWS: decodeAudioData en segundo plano (Electron 45).
        const waveform = await computeWaveform(file, {
          buckets: 80,
          durationMs: track.durationMs,
        })
        if (cancelled) return
        await updateTrackWaveform(id, waveform)
        if (cancelled) return
        setTracks((previous) =>
          previous.map((item) => (item.id === id ? { ...item, waveform, waveformReal: true } : item)),
        )
      } catch {
        // Una pista problemática no detiene la cola de ondas pendientes.
      } finally {
        running = false
        schedule()
      }
    }

    schedule()
    return () => {
      cancelled = true
      wakeRef.current = () => undefined
      if (handle !== null) scheduler.cancel(handle)
    }
  }, [isHydrated, isImporting, setTracks])
}
