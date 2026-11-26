import { useMemo } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { usePlayer, usePlayerTime } from '../hooks/usePlayer'
import { formatTime } from '../lib/format'
import { downsample, MAX_WAVE_BARS, MAX_WAVE_BARS_LOW } from '../lib/performance'

const FALLBACK_BARS = Array.from({ length: 80 }, (_, i) => 0.2 + Math.abs(Math.sin(i / 5)) * 0.45)

export function WaveformProgressIsland() {
  const { currentTrack, seekRatio, settings } = usePlayer()
  const { currentTime, duration, progress } = usePlayerTime()
  const sourceBars = currentTrack?.waveform?.length ? currentTrack.waveform : FALLBACK_BARS
  const bars = useMemo(
    () =>
      downsample(
        sourceBars,
        settings.lowPerformance ? MAX_WAVE_BARS_LOW : MAX_WAVE_BARS,
      ),
    [sourceBars, settings.lowPerformance],
  )

  const seekFromPointer = (event: PointerEvent<HTMLElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width > 0) seekRatio((event.clientX - rect.left) / rect.width)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      seekRatio(progress + 0.02)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      seekRatio(progress - 0.02)
    } else if (event.key === 'Home') {
      event.preventDefault()
      seekRatio(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      seekRatio(1)
    }
  }

  return (
    <section
      className="island wave-island"
      role="slider"
      aria-label="Progreso de la canción"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      tabIndex={0}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        seekFromPointer(event)
      }}
      onPointerMove={(event) => {
        if (event.buttons > 0) seekFromPointer(event)
      }}
      onKeyDown={onKeyDown}
    >
      <div className="wave-island__bars" aria-hidden="true">
        {bars.map((height, index) => (
          <span
            key={index}
            className={`wave-bar ${index / bars.length <= progress ? 'is-played' : ''}`}
            style={{ height: `${Math.max(8, Math.min(100, height * 100))}%` }}
          />
        ))}
      </div>
      <div className="wave-island__times tabular">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </section>
  )
}
