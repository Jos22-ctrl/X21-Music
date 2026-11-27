import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { ChevronsLeft, ChevronsRight, Disc3 } from 'lucide-react'
import { usePlayer } from '../hooks/usePlayer'
import { useCoverUrl } from '../hooks/useTrackUrls'
import type { Track } from '../types'
import { MarqueeText } from './MarqueeText'

const ACTIVATE_RATIO = 0.7
const HOLD_EDGE_RATIO = 0.9
const HOLD_INTERVAL_MS = 500

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const haptic = (ms: number): void => {
  try {
    navigator.vibrate?.(ms)
  } catch {
    // Vibración no soportada: se ignora.
  }
}

function SliderThumb({ track, isCenter }: { track: Track; isCenter: boolean }) {
  const coverUrl = useCoverUrl(track)
  return (
    <span className={isCenter ? 'is-center' : ''}>
      {coverUrl ? (
        <img src={coverUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        <Disc3 size={15} />
      )}
    </span>
  )
}

/** Isla deslizante: arrastra el Tirador para saltar canciones; mantén en el borde para seguir. */
export function TrackSliderIsland() {
  const { queue, currentTrack, jumpBy } = usePlayer()
  const trackRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const startXRef = useRef(0)
  const maxTravelRef = useRef(90)
  const holdTimerRef = useRef<number | null>(null)
  const stepOffsetRef = useRef(0)
  const directionRef = useRef<1 | -1 | 0>(0)

  const [isDragging, setIsDragging] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [stepOffset, setStepOffset] = useState(0)

  const maxMagnitude = Math.max(1, queue.length - 1)

  const clearHold = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }, [])

  const updateStep = useCallback((value: number) => {
    stepOffsetRef.current = value
    setStepOffset(value)
  }, [])

  const startHold = useCallback(
    (direction: 1 | -1) => {
      if (holdTimerRef.current !== null) return
      holdTimerRef.current = window.setInterval(() => {
        const current = stepOffsetRef.current
        const nextMagnitude = Math.min(maxMagnitude, Math.abs(current) + 1)
        const next = direction * nextMagnitude
        if (next !== current) {
          haptic(8)
          updateStep(next)
        }
      }, HOLD_INTERVAL_MS)
    },
    [maxMagnitude, updateStep],
  )

  useEffect(() => () => clearHold(), [clearHold])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    const element = trackRef.current
    if (!element) return
    maxTravelRef.current = Math.max(56, element.getBoundingClientRect().width / 2 - 36)
    pointerIdRef.current = event.pointerId
    startXRef.current = event.clientX
    directionRef.current = 0
    clearHold()
    updateStep(0)
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
    setDragX(0)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!isDragging || pointerIdRef.current !== event.pointerId) return
    const x = clamp(event.clientX - startXRef.current, -maxTravelRef.current, maxTravelRef.current)
    const ratio = maxTravelRef.current > 0 ? Math.abs(x) / maxTravelRef.current : 0
    const direction: 1 | -1 = x >= 0 ? 1 : -1
    setDragX(x)

    if (ratio < ACTIVATE_RATIO) {
      clearHold()
      directionRef.current = 0
      if (stepOffsetRef.current !== 0) updateStep(0)
      return
    }

    if (stepOffsetRef.current === 0 || directionRef.current !== direction) {
      clearHold()
      directionRef.current = direction
      haptic(14)
      updateStep(direction)
    }

    if (ratio >= HOLD_EDGE_RATIO && maxMagnitude > 1) startHold(direction)
    else clearHold()
  }

  const finishDrag = (event: PointerEvent<HTMLDivElement>, cancelled = false): void => {
    if (!isDragging || pointerIdRef.current !== event.pointerId) return
    clearHold()
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture ya liberado.
    }
    const committed = cancelled ? 0 : stepOffsetRef.current
    pointerIdRef.current = null
    directionRef.current = 0
    setIsDragging(false)
    setDragX(0)
    updateStep(0)
    if (committed !== 0) jumpBy(committed)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      jumpBy(event.shiftKey && queue.length > 2 ? 2 : 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      jumpBy(event.shiftKey && queue.length > 2 ? -2 : -1)
    }
  }

  const currentIndex = queue.findIndex((track) => track.id === currentTrack?.id)
  const trackAt = (offset: number): Track | null => {
    if (!queue.length) return null
    const base = currentIndex < 0 ? 0 : currentIndex
    const target = (((base + offset) % queue.length) + queue.length) % queue.length
    return queue[target] ?? null
  }

  const direction = dragX > 8 ? 1 : dragX < -8 ? -1 : 0
  const previewOffset = stepOffset !== 0 ? stepOffset : direction
  const preview = previewOffset !== 0 ? trackAt(previewOffset) : null
  const badge =
    stepOffset !== 0
      ? stepOffset > 0
        ? `+${stepOffset}`
        : String(stepOffset)
      : direction > 0
        ? 'Sig.'
        : 'Ant.'

  return (
    <section className="island track-slider-island" aria-label="Cambiar canción deslizando">
      {isDragging && preview && (
        <div className="track-slider__preview" aria-live="polite">
          <div className="track-slider__thumbs" aria-hidden="true">
            {[-1, 0, 1].map((relative) => {
              const item = trackAt(previewOffset + relative)
              if (!item) return null
              return (
                <SliderThumb
                  key={`${item.id}-${relative}`}
                  track={item}
                  isCenter={relative === 0}
                />
              )
            })}
          </div>
          <div className="track-slider__preview-text">
            <strong>
              <MarqueeText>{preview.title}</MarqueeText>
            </strong>
            <small>
              <MarqueeText>{preview.artist}</MarqueeText>
            </small>
          </div>
          <span className="track-slider__badge">{badge}</span>
        </div>
      )}

      <div className="track-slider" ref={trackRef}>
        <button
          type="button"
          className="track-slider__side"
          onClick={() => jumpBy(-1)}
          aria-label="Canción anterior"
          title="Anterior"
        >
          <ChevronsLeft size={20} className="animate-chevron-left" />
          <span>Anterior</span>
        </button>

        <div
          className={`track-slider__knob ${isDragging ? 'is-dragging' : ''} ${
            stepOffset !== 0 ? 'is-committed' : ''
          }`}
          role="slider"
          tabIndex={0}
          aria-roledescription="deslizador de canciones"
          aria-label="Arrastra para cambiar de canción; flechas para saltar"
          aria-valuemin={-maxMagnitude}
          aria-valuemax={maxMagnitude}
          aria-valuenow={stepOffset}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => finishDrag(event)}
          onPointerCancel={(event) => finishDrag(event, true)}
          onKeyDown={onKeyDown}
          style={{ transform: `translateX(${dragX}px) ${isDragging ? 'scale(1.08)' : ''}` }}
          title="Arrastra para cambiar de canción"
        >
          {stepOffset !== 0 ? (
            <span className="track-slider__count">{badge}</span>
          ) : (
            <div className="track-slider__grip" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          )}
        </div>

        <button
          type="button"
          className="track-slider__side"
          onClick={() => jumpBy(1)}
          aria-label="Canción siguiente"
          title="Siguiente"
        >
          <span>Siguiente</span>
          <ChevronsRight size={20} className="animate-chevron-right" />
        </button>
      </div>
    </section>
  )
}
